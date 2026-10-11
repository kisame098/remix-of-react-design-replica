-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — Le formateur saisit ses notes dans son portail
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après formation_pro_*.sql).
--
-- En formation, rien ne disait quel formateur enseigne quelle matière : la
-- rubrique Notes du portail professeur affichait « Aucune matière assignée ».
-- L'école affecte désormais UN formateur à chaque matière d'une promotion
-- (Évaluations → la matière → « Formateur »). Le formateur peut alors, pour
-- ces matières-là SEULEMENT :
--   - lire le programme utile (promotion, matière, barème, périodes) ;
--   - créer, modifier, supprimer les évaluations ;
--   - saisir les notes de ses élèves (chaque correction est tracée).
-- Il voit les élèves de ses promotions comme ceux de ses classes classiques
-- (get_my_teacher_class_ids). Les policies du personnel restent inchangées.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.fp_affectations (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  promotion_id          uuid not null references public.fp_promotions(id) on delete cascade,
  niveau_matiere_id     uuid not null references public.fp_niveau_matieres(id) on delete cascade,
  teacher_enrollment_id uuid not null references public.teacher_enrollments(id) on delete cascade,
  created_at            timestamptz not null default now(),
  unique (promotion_id, niveau_matiere_id)
);
create index if not exists fp_affectations_teacher_idx on public.fp_affectations (teacher_enrollment_id);

alter table public.fp_affectations enable row level security;

drop policy if exists "fp_affectations: staff select" on public.fp_affectations;
create policy "fp_affectations: staff select" on public.fp_affectations for select using (school_id = get_my_school_id());
drop policy if exists "fp_affectations: staff insert" on public.fp_affectations;
create policy "fp_affectations: staff insert" on public.fp_affectations for insert with check (school_id = get_my_school_id());
drop policy if exists "fp_affectations: staff update" on public.fp_affectations;
create policy "fp_affectations: staff update" on public.fp_affectations for update using (school_id = get_my_school_id()) with check (school_id = get_my_school_id());
drop policy if exists "fp_affectations: staff delete" on public.fp_affectations;
create policy "fp_affectations: staff delete" on public.fp_affectations for delete using (school_id = get_my_school_id());
drop policy if exists "fp_affectations: teacher select" on public.fp_affectations;
create policy "fp_affectations: teacher select" on public.fp_affectations for select
  using (teacher_enrollment_id = public.get_my_teacher_enrollment_id());

-- ─── Fonctions d'accès (security definer : pas de récursion RLS) ───────────
create or replace function public.fp_mes_affectations_prof()
returns table (promotion_id uuid, niveau_matiere_id uuid)
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select a.promotion_id, a.niveau_matiere_id from public.fp_affectations a
  where a.teacher_enrollment_id = public.get_my_teacher_enrollment_id();
$$;

create or replace function public.fp_prof_enseigne(p_promotion uuid, p_matiere uuid) returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from public.fp_affectations a
    where a.teacher_enrollment_id = public.get_my_teacher_enrollment_id()
      and a.promotion_id = p_promotion and a.niveau_matiere_id = p_matiere
  );
$$;

revoke all on function public.fp_mes_affectations_prof()   from public, anon;
revoke all on function public.fp_prof_enseigne(uuid, uuid) from public, anon;
grant execute on function public.fp_mes_affectations_prof()   to authenticated;
grant execute on function public.fp_prof_enseigne(uuid, uuid) to authenticated;

-- Les classes du professeur : celles de ses matières classiques, de son
-- emploi du temps… et désormais celles des promotions où il est affecté.
-- C'est cette fonction qui lui ouvre la liste des élèves.
create or replace function public.get_my_teacher_class_ids()
returns setof uuid
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select class_id from public.subjects where teacher_id = public.get_my_teacher_enrollment_id()
  union
  select class_id from public.schedule_events where teacher_id = public.get_my_teacher_enrollment_id()
  union
  select p.class_id from public.fp_promotions p
  join public.fp_affectations a on a.promotion_id = p.id
  where a.teacher_enrollment_id = public.get_my_teacher_enrollment_id();
$$;

-- ─── Lecture du programme utile ─────────────────────────────────────────────
drop policy if exists "fp_promotions: teacher select" on public.fp_promotions;
create policy "fp_promotions: teacher select" on public.fp_promotions for select
  using (id in (select promotion_id from public.fp_mes_affectations_prof()));

drop policy if exists "fp_niveaux: teacher select" on public.fp_niveaux;
create policy "fp_niveaux: teacher select" on public.fp_niveaux for select
  using (id in (select p.niveau_id from public.fp_promotions p
                where p.id in (select promotion_id from public.fp_mes_affectations_prof())));

drop policy if exists "fp_niveau_matieres: teacher select" on public.fp_niveau_matieres;
create policy "fp_niveau_matieres: teacher select" on public.fp_niveau_matieres for select
  using (id in (select niveau_matiere_id from public.fp_mes_affectations_prof()));

drop policy if exists "fp_matieres: teacher select" on public.fp_matieres;
create policy "fp_matieres: teacher select" on public.fp_matieres for select
  using (id in (select nm.matiere_id from public.fp_niveau_matieres nm
                where nm.id in (select niveau_matiere_id from public.fp_mes_affectations_prof())));

drop policy if exists "fp_bareme_categories: teacher select" on public.fp_bareme_categories;
create policy "fp_bareme_categories: teacher select" on public.fp_bareme_categories for select
  using (formation_id in (select n.formation_id from public.fp_niveaux n
                          join public.fp_promotions p on p.niveau_id = n.id
                          where p.id in (select promotion_id from public.fp_mes_affectations_prof())));

drop policy if exists "fp_periodes: teacher select" on public.fp_periodes;
create policy "fp_periodes: teacher select" on public.fp_periodes for select
  using (promotion_id in (select promotion_id from public.fp_mes_affectations_prof()));

-- ─── Évaluations de SES matières ────────────────────────────────────────────
drop policy if exists "fp_evaluations: teacher select" on public.fp_evaluations;
create policy "fp_evaluations: teacher select" on public.fp_evaluations for select
  using (public.fp_prof_enseigne(promotion_id, niveau_matiere_id));
drop policy if exists "fp_evaluations: teacher insert" on public.fp_evaluations;
create policy "fp_evaluations: teacher insert" on public.fp_evaluations for insert
  with check (public.fp_prof_enseigne(promotion_id, niveau_matiere_id) and school_id = public.get_my_portal_school_id());
drop policy if exists "fp_evaluations: teacher update" on public.fp_evaluations;
create policy "fp_evaluations: teacher update" on public.fp_evaluations for update
  using (public.fp_prof_enseigne(promotion_id, niveau_matiere_id))
  with check (public.fp_prof_enseigne(promotion_id, niveau_matiere_id) and school_id = public.get_my_portal_school_id());
drop policy if exists "fp_evaluations: teacher delete" on public.fp_evaluations;
create policy "fp_evaluations: teacher delete" on public.fp_evaluations for delete
  using (public.fp_prof_enseigne(promotion_id, niveau_matiere_id));

-- ─── Notes de ces évaluations, pour SES élèves ──────────────────────────────
-- Toujours bornées par fp_prof_enseigne : un ÉLÈVE, qui lit les évaluations de
-- sa promotion, ne doit jamais passer par ces policies pour lire les notes de
-- ses camarades.
drop policy if exists "fp_notes: teacher select" on public.fp_notes;
create policy "fp_notes: teacher select" on public.fp_notes for select
  using (evaluation_id in (select e.id from public.fp_evaluations e where public.fp_prof_enseigne(e.promotion_id, e.niveau_matiere_id)));
drop policy if exists "fp_notes: teacher insert" on public.fp_notes;
create policy "fp_notes: teacher insert" on public.fp_notes for insert
  with check (
    evaluation_id in (select e.id from public.fp_evaluations e where public.fp_prof_enseigne(e.promotion_id, e.niveau_matiere_id))
    and student_enrollment_id in (select se.id from public.student_enrollments se where se.class_id in (select public.get_my_teacher_class_ids()))
    and school_id = public.get_my_portal_school_id()
  );
drop policy if exists "fp_notes: teacher update" on public.fp_notes;
create policy "fp_notes: teacher update" on public.fp_notes for update
  using (evaluation_id in (select e.id from public.fp_evaluations e where public.fp_prof_enseigne(e.promotion_id, e.niveau_matiere_id)))
  with check (evaluation_id in (select e.id from public.fp_evaluations e where public.fp_prof_enseigne(e.promotion_id, e.niveau_matiere_id)) and school_id = public.get_my_portal_school_id());
drop policy if exists "fp_notes: teacher delete" on public.fp_notes;
create policy "fp_notes: teacher delete" on public.fp_notes for delete
  using (evaluation_id in (select e.id from public.fp_evaluations e where public.fp_prof_enseigne(e.promotion_id, e.niveau_matiere_id)));

drop policy if exists "fp_notes_historique: teacher insert" on public.fp_notes_historique;
create policy "fp_notes_historique: teacher insert" on public.fp_notes_historique for insert
  with check (
    note_id in (select n.id from public.fp_notes n
                join public.fp_evaluations e on e.id = n.evaluation_id
                where public.fp_prof_enseigne(e.promotion_id, e.niveau_matiere_id))
    and school_id = public.get_my_portal_school_id()
  );
