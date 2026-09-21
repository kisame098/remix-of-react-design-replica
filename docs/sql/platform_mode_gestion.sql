-- ═══════════════════════════════════════════════════════════════════════════
-- MODE DE GESTION D'UNE ÉCOLE : « classique » ou « formation professionnelle »
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
--   • schools.management_mode : 'classique' (défaut, comportement actuel) ou
--     'formation_pro'.
--   • Seul le chef du système le change, via platform_set_school_mode.
--     Le rôle `authenticated` n'a AUCUN droit UPDATE sur cette colonne (les
--     droits sont accordés colonne par colonne sur `schools`) : un directeur ne
--     peut donc pas basculer son école lui-même, même en appelant l'API.
--   • Basculer ne supprime ni ne modifie aucune donnée : le mode ne change que
--     les écrans affichés. Revenir en arrière est toujours possible.
--   • Chaque changement est journalisé (platform_mode_changes).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.schools
  add column if not exists management_mode text not null default 'classique'
  check (management_mode in ('classique', 'formation_pro'));

create table if not exists public.platform_mode_changes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  school_name text not null,
  from_mode   text not null,
  to_mode     text not null,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
alter table public.platform_mode_changes enable row level security;
drop policy if exists "platform: lit les changements de mode" on public.platform_mode_changes;
create policy "platform: lit les changements de mode" on public.platform_mode_changes
  for select using (get_is_platform_admin());

create or replace function public.platform_school_mode(p_school_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not get_is_platform_admin() then raise exception 'Non autorisé'; end if;
  select management_mode into v from public.schools where id = p_school_id;
  if v is null then raise exception 'École introuvable'; end if;
  return v;
end $$;
revoke all on function public.platform_school_mode(uuid) from public, anon;
grant execute on function public.platform_school_mode(uuid) to authenticated;

create or replace function public.platform_set_school_mode(p_school_id uuid, p_mode text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_school public.schools;
begin
  if not get_is_platform_admin() then raise exception 'Non autorisé'; end if;
  if p_mode not in ('classique', 'formation_pro') then raise exception 'Mode inconnu'; end if;
  select * into v_school from public.schools where id = p_school_id;
  if v_school.id is null then raise exception 'École introuvable'; end if;
  if v_school.management_mode = p_mode then return p_mode; end if;

  insert into public.platform_mode_changes (school_id, school_name, from_mode, to_mode, changed_by)
  values (v_school.id, v_school.name, v_school.management_mode, p_mode, auth.uid());

  update public.schools set management_mode = p_mode where id = p_school_id;
  return p_mode;
end $$;
revoke all on function public.platform_set_school_mode(uuid, text) from public, anon;
grant execute on function public.platform_set_school_mode(uuid, text) to authenticated;
