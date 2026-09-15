-- ═══════════════════════════════════════════════════════════════════════════
-- Élémentaire — dispenses par élève (ex: inapte EPS)
-- À coller et exécuter dans l'éditeur SQL Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- Miroir exact de student_subject_settings, mais pour une discipline
-- élémentaire. active = false → la discipline sort du calcul de la moyenne de
-- CET élève (ni au numérateur, ni au dénominateur), sans toucher aux autres.
create table if not exists public.elementary_student_line_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  line_id uuid not null references public.elementary_class_lines(id) on delete cascade,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  active boolean not null default true,
  override_reason text,
  updated_at timestamptz not null default now(),
  unique (school_id, line_id, student_enrollment_id)
);

create index if not exists idx_elem_line_settings_student
  on public.elementary_student_line_settings(student_enrollment_id);

alter table public.elementary_student_line_settings enable row level security;

-- Lecture : le personnel de l'école, et l'élève concerné (le portail doit
-- savoir qu'une discipline est dispensée pour l'exclure de sa moyenne).
create policy "elementary_student_line_settings: select (staff or student)"
on public.elementary_student_line_settings for select
using (
  school_id = get_my_school_id()
  or student_enrollment_id = get_my_student_enrollment_id()
);

-- Écriture réservée au personnel de l'école — un élève ne se dispense pas
-- lui-même.
create policy "elementary_student_line_settings: members insert"
on public.elementary_student_line_settings for insert
with check (school_id = get_my_school_id());

create policy "elementary_student_line_settings: members update"
on public.elementary_student_line_settings for update
using (school_id = get_my_school_id());

create policy "elementary_student_line_settings: members delete"
on public.elementary_student_line_settings for delete
using (school_id = get_my_school_id());
