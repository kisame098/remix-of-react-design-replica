-- ═══════════════════════════════════════════════════════════════════════════
-- Élémentaire (CI-CM2) — Phase B : table des notes (points obtenus par ligne)
-- À coller et exécuter dans l'éditeur SQL Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.elementary_grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  line_id uuid not null references public.elementary_class_lines(id) on delete cascade,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  points_obtenus numeric,
  updated_at timestamptz not null default now(),
  unique (school_id, line_id, student_enrollment_id)
);

create index if not exists idx_elementary_grades_line on public.elementary_grades(line_id);
create index if not exists idx_elementary_grades_enrollment on public.elementary_grades(student_enrollment_id);

-- Le barème max varie par ligne (contrairement à /20 fixe pour grades.devoir*),
-- donc une simple CHECK constraint ne suffit pas : trigger qui va chercher le
-- point_max de la ligne concernée.
create or replace function public.enforce_elementary_points_le_max()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_point_max numeric;
begin
  if new.points_obtenus is null then
    return new;
  end if;
  if new.points_obtenus < 0 then
    raise exception 'Les points ne peuvent pas être négatifs';
  end if;
  select point_max into v_point_max from public.elementary_class_lines where id = new.line_id;
  if v_point_max is not null and new.points_obtenus > v_point_max then
    raise exception 'Les points obtenus (%) dépassent le barème de la ligne (%)', new.points_obtenus, v_point_max;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_elementary_points_le_max on public.elementary_grades;
create trigger trg_enforce_elementary_points_le_max
before insert or update on public.elementary_grades
for each row execute function public.enforce_elementary_points_le_max();

alter table public.elementary_grades enable row level security;

-- RLS consolidée : une seule policy par action (miroir exact de `grades`).
create policy "elementary_grades: select (staff or student)"
on public.elementary_grades for select
using (
  school_id = get_my_school_id()
  or student_enrollment_id = get_my_student_enrollment_id()
  or line_id in (select id from public.elementary_class_lines where teacher_id = get_my_teacher_enrollment_id())
);

create policy "elementary_grades: insert"
on public.elementary_grades for insert
with check (
  school_id = get_my_school_id()
  or exists (
    select 1 from public.elementary_class_lines l
    where l.id = elementary_grades.line_id
      and l.teacher_id = get_my_teacher_enrollment_id()
      and l.school_id = elementary_grades.school_id
  )
);

create policy "elementary_grades: update"
on public.elementary_grades for update
using (
  school_id = get_my_school_id()
  or exists (
    select 1 from public.elementary_class_lines l
    where l.id = elementary_grades.line_id
      and l.teacher_id = get_my_teacher_enrollment_id()
  )
);

create policy "elementary_grades: members delete"
on public.elementary_grades for delete
using (school_id = get_my_school_id());
