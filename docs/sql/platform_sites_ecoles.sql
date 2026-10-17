-- ═══════════════════════════════════════════════════════════════════════════
-- PLATEFORME — la liste des sites web des écoles
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après site_web_beta.sql).
--
--   • platform_sites_ecoles() : réservée au chef du système. Une ligne par
--     école qui a commencé un site : adresse, modèle, nom affiché, en ligne
--     ou non, dates, modifications pas encore publiées. Jamais le contenu
--     complet (photos et logos en base64 pèsent lourd).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.platform_sites_ecoles()
returns table (
  school_id uuid, ecole text, ville text, slug text, modele text, nom_site text,
  en_ligne boolean, publie_le timestamptz, modifie_le timestamptz, modifications_en_attente boolean
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;

  return query
  select s.id, s.name, s.city, s.slug,
         coalesce(ss.publie, ss.brouillon) -> 'identite' ->> 'modele',
         coalesce(ss.publie, ss.brouillon) -> 'identite' ->> 'nom',
         ss.publie is not null,
         ss.publie_le,
         ss.updated_at,
         ss.publie is not null and ss.publie is distinct from ss.brouillon
    from public.school_sites ss
    join public.schools s on s.id = ss.school_id
   order by (ss.publie is not null) desc, ss.updated_at desc;
end $$;
revoke all on function public.platform_sites_ecoles() from public, anon;
grant execute on function public.platform_sites_ecoles() to authenticated;
