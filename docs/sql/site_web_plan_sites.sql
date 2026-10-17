-- ═══════════════════════════════════════════════════════════════════════════
-- SITE WEB — liste des sites publiés, pour l'index commun des plans de site
--
-- Le Worker « sites-ecoles » sert https://senclass.com/sitemap-ecoles.xml :
-- un index qui pointe vers https://<adresse>.senclass.com/sitemap.xml pour
-- chaque site publié. Envoyé une seule fois à Google Search Console, il fait
-- découvrir chaque nouveau site sans démarche manuelle.
--
--   • sites_publies() : lecture ouverte à tous, mais ne rend QUE l'adresse
--     (slug) et la date de publication. Même filtre que site_public
--     (site_web_beta.sql) : école bêta, site publié.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.sites_publies()
returns table (slug text, publie_le timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.slug, ss.publie_le
    from public.schools s
    join public.school_sites ss on ss.school_id = s.id
   where s.beta_testeur = true
     and ss.publie is not null
     and s.slug is not null and s.slug <> ''
   order by s.slug;
$$;
revoke all on function public.sites_publies() from public;
grant execute on function public.sites_publies() to anon, authenticated;
