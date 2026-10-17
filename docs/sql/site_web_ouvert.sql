-- ═══════════════════════════════════════════════════════════════════════════
-- SITE WEB — fin de la bêta : ouvert à TOUTES les écoles
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après site_web_beta.sql,
-- site_web_adresse.sql et site_web_plan_sites.sql).
--
-- Toute école, gratuite comme payante, peut construire et publier son site
-- sur <adresse>.senclass.com. Seul un nom de domaine propre sera payant, et
-- passera par SenClass (étape suivante).
--
-- On retire la condition « école bêta-testeuse » des trois fonctions qui la
-- portaient ; tout le reste est inchangé :
--   • peut_gerer_site : le directeur actif d'une école dont l'accès est ouvert ;
--   • site_public     : la version publiée, et rien d'autre ;
--   • sites_publies   : adresse + date de publication, pour Google.
-- La colonne schools.beta_testeur reste, pour les prochaines nouveautés.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.peut_gerer_site(p_school_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
      from public.school_members m
     where m.user_id = auth.uid()
       and m.is_active = true
       and m.role = 'admin_school'
       and m.school_id = p_school_id
       and public.is_school_access_allowed(m.school_id)
  );
$$;
revoke all on function public.peut_gerer_site(uuid) from public, anon;
grant execute on function public.peut_gerer_site(uuid) to authenticated;

create or replace function public.site_public(p_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select ss.publie
    from public.schools s
    join public.school_sites ss on ss.school_id = s.id
   where s.slug = p_slug
     and ss.publie is not null
   limit 1;
$$;
revoke all on function public.site_public(text) from public;
grant execute on function public.site_public(text) to anon, authenticated;

create or replace function public.sites_publies()
returns table (slug text, publie_le timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.slug, ss.publie_le
    from public.schools s
    join public.school_sites ss on ss.school_id = s.id
   where ss.publie is not null
     and s.slug is not null and s.slug <> ''
   order by s.slug;
$$;
revoke all on function public.sites_publies() from public;
grant execute on function public.sites_publies() to anon, authenticated;
