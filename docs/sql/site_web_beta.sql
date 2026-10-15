-- ═══════════════════════════════════════════════════════════════════════════
-- SITE WEB DE L'ÉCOLE — ouvert aux seules écoles « bêta-testeuses »
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
--   • schools.beta_testeur : faux par défaut. Seul le chef du système le
--     change (platform_set_school_beta), exactement comme le mode de gestion :
--     le rôle « authenticated » n'a AUCUN droit UPDATE sur cette colonne (les
--     droits sur « schools » sont accordés colonne par colonne). Chaque
--     changement est journalisé (platform_beta_changes).
--   • school_sites : un site par école — le brouillon (enregistré au fil de
--     l'eau) et la version publiée. Seul le DIRECTEUR (admin_school) d'une
--     école bêta le lit et le modifie.
--   • Photos du site : stockage public « sites-ecoles », un dossier par école ;
--     seul le directeur d'une école bêta y dépose ou retire des fichiers.
--   • site_publier / site_depublier : la publication copie le brouillon.
--     L'adresse publique est /site/<slug> ; le slug est créé depuis le nom de
--     l'école à la première publication s'il manque.
--   • site_public(p_slug) : la SEULE lecture ouverte à tous. Elle ne rend que
--     la version publiée d'une école bêta, jamais le brouillon ni rien d'autre.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Le drapeau bêta-testeur ─────────────────────────────────────────────
alter table public.schools
  add column if not exists beta_testeur boolean not null default false;

-- Lisible par l'école (pour afficher la rubrique), jamais modifiable par elle.
grant select (beta_testeur) on public.schools to authenticated;

create table if not exists public.platform_beta_changes (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  school_name text not null,
  beta        boolean not null,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
alter table public.platform_beta_changes enable row level security;
drop policy if exists "platform: lit les changements bêta" on public.platform_beta_changes;
create policy "platform: lit les changements bêta" on public.platform_beta_changes
  for select using (get_is_platform_admin());

create or replace function public.platform_school_beta(p_school_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v boolean;
begin
  if not get_is_platform_admin() then raise exception 'Non autorisé'; end if;
  select beta_testeur into v from public.schools where id = p_school_id;
  if v is null then raise exception 'École introuvable'; end if;
  return v;
end $$;
revoke all on function public.platform_school_beta(uuid) from public, anon;
grant execute on function public.platform_school_beta(uuid) to authenticated;

create or replace function public.platform_set_school_beta(p_school_id uuid, p_beta boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_school public.schools;
begin
  if not get_is_platform_admin() then raise exception 'Non autorisé'; end if;
  if p_beta is null then raise exception 'Valeur manquante'; end if;
  select * into v_school from public.schools where id = p_school_id;
  if v_school.id is null then raise exception 'École introuvable'; end if;
  if v_school.beta_testeur = p_beta then return p_beta; end if;

  insert into public.platform_beta_changes (school_id, school_name, beta, changed_by)
  values (v_school.id, v_school.name, p_beta, auth.uid());

  update public.schools set beta_testeur = p_beta where id = p_school_id;
  return p_beta;
end $$;
revoke all on function public.platform_set_school_beta(uuid, boolean) from public, anon;
grant execute on function public.platform_set_school_beta(uuid, boolean) to authenticated;

-- ─── 2. Qui peut travailler sur le site : le directeur d'une école bêta ────
create or replace function public.peut_gerer_site(p_school_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from public.school_members m
      join public.schools s on s.id = m.school_id
     where m.user_id = auth.uid()
       and m.is_active = true
       and m.role = 'admin_school'
       and m.school_id = p_school_id
       and s.beta_testeur = true
       and public.is_school_access_allowed(m.school_id)
  );
$$;
revoke all on function public.peut_gerer_site(uuid) from public, anon;
grant execute on function public.peut_gerer_site(uuid) to authenticated;

-- ─── 3. Les sites ───────────────────────────────────────────────────────────
create table if not exists public.school_sites (
  school_id   uuid primary key references public.schools(id) on delete cascade,
  brouillon   jsonb not null default '{}'::jsonb,
  publie      jsonb,
  publie_le   timestamptz,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.school_sites enable row level security;

drop policy if exists "site: le directeur lit" on public.school_sites;
create policy "site: le directeur lit" on public.school_sites
  for select using (public.peut_gerer_site(school_id));
drop policy if exists "site: le directeur crée" on public.school_sites;
create policy "site: le directeur crée" on public.school_sites
  for insert with check (public.peut_gerer_site(school_id));
drop policy if exists "site: le directeur modifie" on public.school_sites;
create policy "site: le directeur modifie" on public.school_sites
  for update using (public.peut_gerer_site(school_id)) with check (public.peut_gerer_site(school_id));

-- Le directeur n'écrit que le brouillon ; la version publiée passe par site_publier.
revoke all on public.school_sites from anon, authenticated;
grant select on public.school_sites to authenticated;
grant insert (school_id, brouillon, updated_at, updated_by) on public.school_sites to authenticated;
grant update (brouillon, updated_at, updated_by) on public.school_sites to authenticated;

-- ─── 4. Publier / retirer ───────────────────────────────────────────────────
create or replace function public.site_publier()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := get_my_school_id();
  v_nom    text;
  v_slug   text;
  v_base   text;
  n        int := 1;
begin
  if v_school is null or not public.peut_gerer_site(v_school) then raise exception 'Non autorisé'; end if;
  if not exists (select 1 from public.school_sites where school_id = v_school) then raise exception 'Aucun site à publier'; end if;

  select name, slug into v_nom, v_slug from public.schools where id = v_school;
  if v_slug is null or v_slug = '' then
    v_base := trim(both '-' from regexp_replace(
      translate(lower(v_nom), 'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
      '[^a-z0-9]+', '-', 'g'));
    if v_base = '' then v_base := 'ecole'; end if;
    v_slug := left(v_base, 60);
    while exists (select 1 from public.schools where slug = v_slug and id <> v_school) loop
      n := n + 1;
      v_slug := left(v_base, 56) || '-' || n;
    end loop;
    update public.schools set slug = v_slug where id = v_school;
  end if;

  update public.school_sites set publie = brouillon, publie_le = now() where school_id = v_school;
  return v_slug;
end $$;
revoke all on function public.site_publier() from public, anon;
grant execute on function public.site_publier() to authenticated;

create or replace function public.site_depublier()
returns void
language plpgsql security definer set search_path = public as $$
declare v_school uuid := get_my_school_id();
begin
  if v_school is null or not public.peut_gerer_site(v_school) then raise exception 'Non autorisé'; end if;
  update public.school_sites set publie = null, publie_le = null where school_id = v_school;
end $$;
revoke all on function public.site_depublier() from public, anon;
grant execute on function public.site_depublier() to authenticated;

-- ─── 5. La lecture publique : le site publié, et rien d'autre ──────────────
create or replace function public.site_public(p_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select ss.publie
    from public.schools s
    join public.school_sites ss on ss.school_id = s.id
   where s.slug = p_slug
     and s.beta_testeur = true
     and ss.publie is not null
   limit 1;
$$;
revoke all on function public.site_public(text) from public;
grant execute on function public.site_public(text) to anon, authenticated;

-- ─── 6. Les photos des sites ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sites-ecoles', 'sites-ecoles', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Lecture : publique (le bucket est public, les photos s'affichent sur le site).
-- Écriture : le directeur d'une école bêta, dans le dossier de SON école uniquement.
drop policy if exists "sites-ecoles: le directeur dépose" on storage.objects;
create policy "sites-ecoles: le directeur dépose" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sites-ecoles'
              and (storage.foldername(name))[1] = get_my_school_id()::text
              and public.peut_gerer_site(get_my_school_id()));
drop policy if exists "sites-ecoles: le directeur retire" on storage.objects;
create policy "sites-ecoles: le directeur retire" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sites-ecoles'
         and (storage.foldername(name))[1] = get_my_school_id()::text
         and public.peut_gerer_site(get_my_school_id()));
