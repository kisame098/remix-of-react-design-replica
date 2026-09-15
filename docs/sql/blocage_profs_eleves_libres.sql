-- ═══════════════════════════════════════════════════════════════════════════
-- ABONNEMENT IMPAYÉ : les PROFESSEURS sont bloqués comme le personnel,
--                     les ÉLÈVES gardent TOUT.
-- À coller et exécuter dans l'éditeur SQL Supabase.
--
-- Décision produit : une école qui ne paie pas ne doit pas pénaliser les
-- familles. L'élève garde l'intégralité de son portail — notes, bulletins,
-- emploi du temps, paiements, présences — et voit seulement un bandeau lui
-- expliquant la situation de son école. Le professeur, lui, fait partie de
-- l'équipe : il est traité comme le personnel et ne peut plus travailler.
--
-- Trois voies d'accès existent en base ; on les traite séparément :
--
--   • get_my_student_enrollment_id()   → l'élève. JAMAIS bloquée.
--   • get_my_teacher_enrollment_id()   → le prof (16 policies : notes,
--     présences, matières, emploi du temps) — BLOQUÉE ici.
--     get_my_teacher_class_ids() en dérive, donc se ferme avec elle.
--   • get_my_account_school_id()       → données de référence communes
--     (années, périodes, filières, tarifs…). Bloquée pour le prof,
--     laissée ouverte à l'élève.
--
-- Une voie de secours est ajoutée pour que le prof bloqué puisse quand même
-- lire la fiche de son école, et donc SAVOIR pourquoi il est bloqué.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Lecture de la fiche école : ouverte à tout compte portail ────────────
-- Sans contrôle d'abonnement : c'est ce qui permet d'afficher « votre école
-- n'a pas payé » — à l'élève comme au professeur.
create or replace function public.get_my_portal_school_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select school_id
  from public.school_accounts
  where auth_user_id = auth.uid()
  limit 1;
$$;

drop policy if exists "schools: select (staff, student or platform admin)" on public.schools;
create policy "schools: select (staff, student or platform admin)"
on public.schools for select
using (
  id = get_my_membership_school_id()   -- personnel : voie de secours
  or id = get_my_portal_school_id()    -- élève ET prof : voie de secours
  or get_is_platform_admin()
);

-- ── 2. Le professeur est bloqué comme le personnel ─────────────────────────
-- Ferme d'un coup ses 16 policies : saisie des notes, présences, matières,
-- emploi du temps, et l'accès aux élèves de ses classes.
create or replace function public.get_my_teacher_enrollment_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select a.teacher_enrollment_id
  from public.school_accounts a
  where a.auth_user_id = auth.uid()
    and a.role = 'teacher'
    and public.is_school_access_allowed(a.school_id)
  limit 1;
$$;

-- ── 3. Données de référence : fermées au prof, ouvertes à l'élève ──────────
-- Cette fonction sert 14 tables communes (années scolaires, périodes de notes,
-- filières, tarifs…). L'élève en a besoin pour lire son bulletin ; le prof
-- bloqué n'a plus rien à y faire.
create or replace function public.get_my_account_school_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select a.school_id
  from public.school_accounts a
  where a.auth_user_id = auth.uid()
    and (a.role = 'student' or public.is_school_access_allowed(a.school_id))
  limit 1;
$$;

-- ── 4. L'élève reste explicitement hors de tout blocage ────────────────────
-- Réécrite à l'identique, pour que son absence de contrôle soit un choix écrit
-- et non un oubli : c'est la fonction qui garantit l'accès des familles.
create or replace function public.get_my_student_enrollment_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  -- AUCUN contrôle d'abonnement ici, volontairement : l'élève et sa famille
  -- ne sont jamais pénalisés par l'impayé de l'établissement.
  select student_enrollment_id
  from public.school_accounts
  where auth_user_id = auth.uid()
    and role = 'student'
  limit 1;
$$;

-- ── Contrôle ───────────────────────────────────────────────────────────────
-- En se mettant dans la peau d'un prof d'une école suspendue :
--   select public.get_my_teacher_enrollment_id();  -- doit être NULL
--   select count(*) from public.grades;            -- doit être 0
--   select count(*) from public.schools;           -- doit être 1 (voir pourquoi)
-- Et d'un élève de la même école :
--   select count(*) from public.grades;            -- inchangé
