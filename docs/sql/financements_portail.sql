-- ═══════════════════════════════════════════════════════════════════════════
-- FINANCEMENTS (3FPT…) — L'élève voit SA part dans son portail
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor, après financements_dossiers.sql.
--
-- Un apprenant financé ne doit voir, dans « Mes paiements », que la part qui
-- lui revient (10 % pour le 3FPT). Son dossier reste réservé au personnel
-- (note interne, pièces, contrat) : cette fonction ne lui donne QUE
-- l'identifiant de l'organisme qui le prend en charge, et seulement quand
-- son dossier est VALIDÉ (avant, il paie ses frais en entier). La part et les frais
-- concernés sont lus dans les réglages de l'école, comme à la caisse.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.fin_mon_organisme() returns text
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select d.organisme_id from public.fin_dossiers d
  where d.student_enrollment_id = public.get_my_student_enrollment_id()
    and d.statut = 'valide'
  limit 1;
$$;

revoke all on function public.fin_mon_organisme() from public;
grant execute on function public.fin_mon_organisme() to authenticated;
