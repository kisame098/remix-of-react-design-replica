-- ═══════════════════════════════════════════════════════════════════════════
-- SITE WEB DE L'ÉCOLE — le directeur choisit l'adresse <adresse>.senclass.com
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après site_web_beta.sql).
--
--   • site_verifier_adresse(p_slug) : dit si une adresse est libre, déjà
--     prise, réservée à SenClass ou mal écrite — vérifiée en direct pendant
--     la saisie.
--   • site_publier(p_slug) : publie ET enregistre l'adresse choisie (ou garde
--     l'actuelle, ou en crée une depuis le nom si l'école n'en a pas).
--   • Index unique : deux écoles ne peuvent jamais avoir la même adresse,
--     même si elles valident au même instant.
--   • La liste des adresses réservées est la même que dans l'application
--     (src/lib/hoteEcole.ts, SOUS_DOMAINES_RESERVES).
-- ═══════════════════════════════════════════════════════════════════════════

create unique index if not exists schools_slug_unique on public.schools (slug) where slug is not null;

-- « null » si l'adresse est utilisable, sinon la raison : 'format' ou 'reservee'.
create or replace function public.site_adresse_refusee(p_slug text)
returns text
language plpgsql immutable set search_path = public as $$
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$' then return 'format'; end if;
  if p_slug = any (array['www', 'maj', 'send', 'rsend', 'app', 'api', 'admin', 'mail', 'smtp', 'email', 'senclass',
                         'platform', 'plateforme', 'status', 'docs', 'aide', 'blog', 'support', 'dev', 'staging', 'test'])
    then return 'reservee'; end if;
  return null;
end $$;

-- 'libre' | 'actuelle' | 'prise' | 'reservee' | 'format'
create or replace function public.site_verifier_adresse(p_slug text)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_school uuid := get_my_school_id();
  v_refus  text := public.site_adresse_refusee(p_slug);
begin
  if v_school is null or not public.peut_gerer_site(v_school) then raise exception 'Non autorisé'; end if;
  if v_refus is not null then return v_refus; end if;
  if exists (select 1 from public.schools where id = v_school and slug = p_slug) then return 'actuelle'; end if;
  if exists (select 1 from public.schools where slug = p_slug) then return 'prise'; end if;
  return 'libre';
end $$;
revoke all on function public.site_verifier_adresse(text) from public, anon;
grant execute on function public.site_verifier_adresse(text) to authenticated;

-- L'ancienne version (sans adresse) est remplacée : une seule fonction, adresse facultative.
drop function if exists public.site_publier();

create or replace function public.site_publier(p_slug text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := get_my_school_id();
  v_nom    text;
  v_slug   text;
  v_base   text;
  v_refus  text;
  n        int := 1;
begin
  if v_school is null or not public.peut_gerer_site(v_school) then raise exception 'Non autorisé'; end if;
  if not exists (select 1 from public.school_sites where school_id = v_school) then raise exception 'Aucun site à publier'; end if;

  select name, slug into v_nom, v_slug from public.schools where id = v_school;

  if p_slug is not null and p_slug <> coalesce(v_slug, '') then
    -- Adresse choisie par le directeur.
    v_refus := public.site_adresse_refusee(p_slug);
    if v_refus = 'format' then raise exception 'Adresse invalide : lettres minuscules, chiffres et tirets (3 caractères au moins).'; end if;
    if v_refus = 'reservee' then raise exception 'Cette adresse est réservée à SenClass.'; end if;
    if exists (select 1 from public.schools where slug = p_slug and id <> v_school) then raise exception 'Cette adresse est déjà prise par une autre école.'; end if;
    v_slug := p_slug;
    update public.schools set slug = v_slug where id = v_school;
  elsif v_slug is null or v_slug = '' then
    -- Pas d'adresse choisie ni existante : une adresse tirée du nom de l'école.
    v_base := trim(both '-' from regexp_replace(
      translate(lower(v_nom), 'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
      '[^a-z0-9]+', '-', 'g'));
    if length(v_base) < 3 or public.site_adresse_refusee(left(v_base, 60)) is not null then v_base := 'ecole-' || v_base; end if;
    v_base := trim(both '-' from left(v_base, 60));
    v_slug := v_base;
    while exists (select 1 from public.schools where slug = v_slug and id <> v_school) loop
      n := n + 1;
      v_slug := left(v_base, 56) || '-' || n;
    end loop;
    update public.schools set slug = v_slug where id = v_school;
  end if;

  update public.school_sites set publie = brouillon, publie_le = now() where school_id = v_school;
  return v_slug;
end $$;
revoke all on function public.site_publier(text) from public, anon;
grant execute on function public.site_publier(text) to authenticated;
