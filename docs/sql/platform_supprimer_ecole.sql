-- ═══════════════════════════════════════════════════════════════════════════
-- CHEF DU SYSTÈME : voir les e-mails des écoles + supprimer une école
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après platform_admin_v2.sql).
--
-- Suppression d'une école = DÉFINITIVE. Elle efface, en une seule transaction :
--   • l'école et TOUTES ses données (élèves, professeurs, classes, notes,
--     présences, paiements, reçus, bulletins, salaires…) — chaque table qui
--     porte un school_id est en ON DELETE CASCADE ;
--   • les comptes de connexion qui n'appartiennent qu'à cette école (élèves,
--     professeurs, directeur, personnel, caisse) : supprimés d'auth.users.
--
-- Ce qui est CONSERVÉ, volontairement :
--   • billing_transactions : la trace des abonnements payés à SenClass reste
--     (school_id passe à NULL, school_name garde le nom) — c'est VOTRE
--     comptabilité, pas celle de l'école ;
--   • les comptes chef du système, et le compte qui exécute la suppression ;
--   • platform_deleted_schools : une ligne par école supprimée (nom, e-mails,
--     effectifs, qui, quand). Aucune donnée d'élève n'y figure.
--
-- Garde-fous côté serveur (l'interface n'est pas la seule barrière) :
--   • réservé au chef du système ;
--   • le nom EXACT de l'école et le mot SUPPRIMER doivent être fournis.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_deleted_schools (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null,
  school_name   text not null,
  school_email  text,
  admin_emails  text[] not null default '{}',
  counts        jsonb not null default '{}'::jsonb,
  deleted_by    uuid,
  deleted_at    timestamptz not null default now()
);

alter table public.platform_deleted_schools enable row level security;

drop policy if exists "platform: lit les écoles supprimées" on public.platform_deleted_schools;
create policy "platform: lit les écoles supprimées" on public.platform_deleted_schools
  for select using (get_is_platform_admin());
-- Aucune politique d'écriture : seule platform_delete_school (SECURITY DEFINER) écrit.


-- ─── E-mails de chaque école ────────────────────────────────────────────────
-- `profiles` n'est lisible que par son propriétaire : le chef du système ne
-- pouvait donc pas retrouver l'e-mail d'un directeur. Cette fonction lit
-- auth.users, réservée au chef du système.
create or replace function public.platform_school_emails()
returns table (school_id uuid, contact_email text, admin_emails text[])
language plpgsql security definer set search_path = public as $$
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;

  return query
  select s.id,
         nullif(btrim(s.email), ''),
         coalesce((
           select array_agg(distinct u.email::text order by u.email::text)
             from public.school_members m
             join auth.users u on u.id = m.user_id
            where m.school_id = s.id and m.role = 'admin_school' and u.email is not null
         ), '{}')
    from public.schools s;
end $$;

revoke all on function public.platform_school_emails() from public, anon;
grant execute on function public.platform_school_emails() to authenticated;


-- ─── Ce qui serait supprimé (aperçu, ne supprime rien) ──────────────────────
create or replace function public.platform_school_deletion_preview(p_school_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_users uuid[];
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'École introuvable';
  end if;

  select coalesce(array_agg(distinct uid), '{}') into v_users
    from (select auth_user_id as uid from public.school_accounts where school_id = p_school_id and auth_user_id is not null
          union select user_id from public.school_members where school_id = p_school_id) t
   where not exists (select 1 from public.platform_admins pa where pa.auth_user_id = t.uid)
     and uid is distinct from auth.uid()
     and not exists (select 1 from public.school_accounts a where a.auth_user_id = t.uid and a.school_id <> p_school_id)
     and not exists (select 1 from public.school_members  m where m.user_id      = t.uid and m.school_id <> p_school_id);

  return jsonb_build_object(
    'eleves',        (select count(*) from public.student_enrollments where school_id = p_school_id),
    'professeurs',   (select count(*) from public.teacher_enrollments where school_id = p_school_id),
    'classes',       (select count(*) from public.classes             where school_id = p_school_id),
    'paiements',     (select count(*) from public.payments            where school_id = p_school_id),
    'recus',         (select count(*) from public.receipts            where school_id = p_school_id),
    'bulletins',     (select count(*) from public.published_bulletins where school_id = p_school_id),
    'comptes',       cardinality(v_users),
    'compte_chef_conserve',
      exists (select 1 from public.school_members m
               where m.school_id = p_school_id
                 and m.user_id in (select auth_user_id from public.platform_admins))
  );
end $$;

revoke all on function public.platform_school_deletion_preview(uuid) from public, anon;
grant execute on function public.platform_school_deletion_preview(uuid) to authenticated;


-- ─── Suppression définitive ────────────────────────────────────────────────
create or replace function public.platform_delete_school(
  p_school_id    uuid,
  p_confirm_name text,
  p_confirm_word text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_school  public.schools;
  v_users   uuid[];
  v_admins  text[];
  v_counts  jsonb;
  v_deleted integer;
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;

  select * into v_school from public.schools where id = p_school_id;
  if v_school.id is null then
    raise exception 'École introuvable';
  end if;

  if btrim(coalesce(p_confirm_name, '')) <> btrim(v_school.name) then
    raise exception 'Le nom saisi ne correspond pas à celui de l''école';
  end if;
  if coalesce(p_confirm_word, '') <> 'SUPPRIMER' then
    raise exception 'Confirmation manquante';
  end if;

  -- Les comptes à supprimer : ceux qui n'appartiennent QU'À cette école, hors
  -- chef du système et hors compte appelant.
  select coalesce(array_agg(distinct uid), '{}') into v_users
    from (select auth_user_id as uid from public.school_accounts where school_id = p_school_id and auth_user_id is not null
          union select user_id from public.school_members where school_id = p_school_id) t
   where not exists (select 1 from public.platform_admins pa where pa.auth_user_id = t.uid)
     and uid is distinct from auth.uid()
     and not exists (select 1 from public.school_accounts a where a.auth_user_id = t.uid and a.school_id <> p_school_id)
     and not exists (select 1 from public.school_members  m where m.user_id      = t.uid and m.school_id <> p_school_id);

  select coalesce(array_agg(distinct u.email::text order by u.email::text), '{}') into v_admins
    from public.school_members m join auth.users u on u.id = m.user_id
   where m.school_id = p_school_id and m.role = 'admin_school' and u.email is not null;

  v_counts := public.platform_school_deletion_preview(p_school_id);

  -- Trace de la suppression, écrite AVANT d'effacer quoi que ce soit.
  insert into public.platform_deleted_schools (school_id, school_name, school_email, admin_emails, counts, deleted_by)
  values (v_school.id, v_school.name, v_school.email, v_admins, v_counts, auth.uid());

  -- La comptabilité d'abonnement survit : détacher les auteurs supprimés.
  update public.billing_transactions set submitted_by = null where submitted_by = any(v_users);
  update public.billing_transactions set reviewed_by  = null where reviewed_by  = any(v_users);

  -- L'école et, par cascade, toutes ses données.
  delete from public.schools where id = p_school_id;

  -- Puis ses comptes de connexion (profil, abonnements push, files : en cascade).
  delete from auth.users where id = any(v_users);
  get diagnostics v_deleted = row_count;

  return v_counts || jsonb_build_object('comptes_supprimes', v_deleted);
end $$;

revoke all on function public.platform_delete_school(uuid, text, text) from public, anon;
grant execute on function public.platform_delete_school(uuid, text, text) to authenticated;
