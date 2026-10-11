-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — L'élève voit ses notes dans son portail
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après formation_pro_*.sql).
--
-- Jusqu'ici, toutes les tables fp_* n'étaient lisibles que par le personnel
-- (school_id = get_my_school_id()) : un élève connecté ne lisait AUCUNE ligne,
-- la rubrique Notes de son portail restait vide.
--
-- On ajoute des policies de LECTURE seule, strictement bornées :
--   - le programme de SA promotion (niveau, matières, coefficients, barème,
--     périodes, évaluations) ;
--   - SES notes, SES stages — jamais celles d'un camarade ;
--   - les examens de sa promotion seulement une fois VERROUILLÉS par le
--     directeur : une note d'examen n'est pas montrée avant la délibération.
-- Les policies du personnel restent inchangées (les policies s'additionnent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Fonctions d'accès (security definer : pas de récursion RLS) ───────────
create or replace function public.fp_my_promotion_id() returns uuid
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select p.id from public.fp_promotions p
  where p.class_id = public.get_my_student_class_id()
  limit 1;
$$;

create or replace function public.fp_my_niveau_id() returns uuid
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select p.niveau_id from public.fp_promotions p where p.id = public.fp_my_promotion_id();
$$;

create or replace function public.fp_my_formation_id() returns uuid
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select n.formation_id from public.fp_niveaux n where n.id = public.fp_my_niveau_id();
$$;

-- Examens de sa promotion déjà verrouillés (résultats arrêtés par le jury).
create or replace function public.fp_my_examens_publies() returns setof uuid
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select x.id from public.fp_examens x
  where x.promotion_id = public.fp_my_promotion_id() and x.verrouille;
$$;

revoke all on function public.fp_my_promotion_id()    from public, anon;
revoke all on function public.fp_my_niveau_id()       from public, anon;
revoke all on function public.fp_my_formation_id()    from public, anon;
revoke all on function public.fp_my_examens_publies() from public, anon;
grant execute on function public.fp_my_promotion_id()    to authenticated;
grant execute on function public.fp_my_niveau_id()       to authenticated;
grant execute on function public.fp_my_formation_id()    to authenticated;
grant execute on function public.fp_my_examens_publies() to authenticated;

-- ─── Programme de sa promotion ──────────────────────────────────────────────
drop policy if exists "fp_promotions: student select" on public.fp_promotions;
create policy "fp_promotions: student select" on public.fp_promotions for select
  using (id = public.fp_my_promotion_id());

drop policy if exists "fp_niveaux: student select" on public.fp_niveaux;
create policy "fp_niveaux: student select" on public.fp_niveaux for select
  using (id = public.fp_my_niveau_id());

drop policy if exists "fp_niveau_matieres: student select" on public.fp_niveau_matieres;
create policy "fp_niveau_matieres: student select" on public.fp_niveau_matieres for select
  using (niveau_id = public.fp_my_niveau_id());

drop policy if exists "fp_matieres: student select" on public.fp_matieres;
create policy "fp_matieres: student select" on public.fp_matieres for select
  using (id in (select nm.matiere_id from public.fp_niveau_matieres nm where nm.niveau_id = public.fp_my_niveau_id()));

drop policy if exists "fp_bareme_categories: student select" on public.fp_bareme_categories;
create policy "fp_bareme_categories: student select" on public.fp_bareme_categories for select
  using (formation_id = public.fp_my_formation_id());

drop policy if exists "fp_periodes: student select" on public.fp_periodes;
create policy "fp_periodes: student select" on public.fp_periodes for select
  using (promotion_id = public.fp_my_promotion_id());

drop policy if exists "fp_evaluations: student select" on public.fp_evaluations;
create policy "fp_evaluations: student select" on public.fp_evaluations for select
  using (promotion_id = public.fp_my_promotion_id());

-- ─── SES notes et SES stages ────────────────────────────────────────────────
drop policy if exists "fp_notes: student select" on public.fp_notes;
create policy "fp_notes: student select" on public.fp_notes for select
  using (student_enrollment_id = public.get_my_student_enrollment_id());

drop policy if exists "fp_stages: student select" on public.fp_stages;
create policy "fp_stages: student select" on public.fp_stages for select
  using (student_enrollment_id = public.get_my_student_enrollment_id());

-- ─── Examens verrouillés de sa promotion ────────────────────────────────────
drop policy if exists "fp_examens: student select" on public.fp_examens;
create policy "fp_examens: student select" on public.fp_examens for select
  using (id in (select public.fp_my_examens_publies()));

drop policy if exists "fp_examen_tours: student select" on public.fp_examen_tours;
create policy "fp_examen_tours: student select" on public.fp_examen_tours for select
  using (examen_id in (select public.fp_my_examens_publies()));

drop policy if exists "fp_examen_epreuves: student select" on public.fp_examen_epreuves;
create policy "fp_examen_epreuves: student select" on public.fp_examen_epreuves for select
  using (tour_id in (select t.id from public.fp_examen_tours t where t.examen_id in (select public.fp_my_examens_publies())));

drop policy if exists "fp_examen_notes: student select" on public.fp_examen_notes;
create policy "fp_examen_notes: student select" on public.fp_examen_notes for select
  using (
    student_enrollment_id = public.get_my_student_enrollment_id()
    and epreuve_id in (
      select e.id from public.fp_examen_epreuves e
      join public.fp_examen_tours t on t.id = e.tour_id
      where t.examen_id in (select public.fp_my_examens_publies())
    )
  );
