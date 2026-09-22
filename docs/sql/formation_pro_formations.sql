-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — Catalogue des formations (étape 1)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après platform_mode_gestion.sql).
--
-- Même principe que Cursus (filieres / filiere_mandatory_subjects…), mais dans
-- des tables séparées : un « bloc » est le programme d'UNE année d'UNE
-- formation (ex: « CAP Restauration — Année 1 »), pas partagé entre années —
-- pour passer à l'année suivante, l'école duplique le bloc, exactement comme
-- un bloc de lycée en Cursus.
--
-- Portée volontairement libre (le métier de l'école n'est pas le nôtre) :
-- formation, année, diplôme et durée sont du texte libre, pas des catégories
-- fixes — l'école tape ce qui lui correspond.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.fp_blocs (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  formation_name text not null,
  annee_label    text not null,
  diplome        text,
  duree          text,
  description    text,
  ordering       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists fp_blocs_school_idx on public.fp_blocs (school_id);

create table if not exists public.fp_bloc_matieres (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  bloc_id         uuid not null references public.fp_blocs(id) on delete cascade,
  type            text not null check (type in ('obligatoire', 'facultative')),
  name            text not null,
  coefficient     numeric not null default 1 check (coefficient > 0),
  volume_horaire  numeric check (volume_horaire is null or volume_horaire >= 0),
  nature          text not null default 'theorique' check (nature in ('theorique', 'pratique', 'stage')),
  ordering        integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists fp_bloc_matieres_bloc_idx on public.fp_bloc_matieres (bloc_id);

create table if not exists public.fp_bloc_choix (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  bloc_id     uuid not null references public.fp_blocs(id) on delete cascade,
  label       text not null,
  coefficient numeric not null default 1 check (coefficient > 0),
  ordering    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists fp_bloc_choix_bloc_idx on public.fp_bloc_choix (bloc_id);

create table if not exists public.fp_bloc_choix_options (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  choix_id     uuid not null references public.fp_bloc_choix(id) on delete cascade,
  subject_name text not null,
  ordering     integer not null default 0
);
create index if not exists fp_bloc_choix_options_choix_idx on public.fp_bloc_choix_options (choix_id);

alter table public.fp_blocs               enable row level security;
alter table public.fp_bloc_matieres        enable row level security;
alter table public.fp_bloc_choix           enable row level security;
alter table public.fp_bloc_choix_options   enable row level security;

-- Réservé au personnel de l'école (comme Cursus) — pas encore de lecture élève,
-- le catalogue n'est pas encore relié à une inscription (étape 2).
drop policy if exists "fp_blocs: staff select" on public.fp_blocs;
create policy "fp_blocs: staff select" on public.fp_blocs for select using (school_id = get_my_school_id());
drop policy if exists "fp_blocs: staff insert" on public.fp_blocs;
create policy "fp_blocs: staff insert" on public.fp_blocs for insert with check (school_id = get_my_school_id());
drop policy if exists "fp_blocs: staff update" on public.fp_blocs;
create policy "fp_blocs: staff update" on public.fp_blocs for update using (school_id = get_my_school_id()) with check (school_id = get_my_school_id());
drop policy if exists "fp_blocs: staff delete" on public.fp_blocs;
create policy "fp_blocs: staff delete" on public.fp_blocs for delete using (school_id = get_my_school_id());

drop policy if exists "fp_bloc_matieres: staff select" on public.fp_bloc_matieres;
create policy "fp_bloc_matieres: staff select" on public.fp_bloc_matieres for select using (school_id = get_my_school_id());
drop policy if exists "fp_bloc_matieres: staff insert" on public.fp_bloc_matieres;
create policy "fp_bloc_matieres: staff insert" on public.fp_bloc_matieres for insert with check (school_id = get_my_school_id());
drop policy if exists "fp_bloc_matieres: staff update" on public.fp_bloc_matieres;
create policy "fp_bloc_matieres: staff update" on public.fp_bloc_matieres for update using (school_id = get_my_school_id()) with check (school_id = get_my_school_id());
drop policy if exists "fp_bloc_matieres: staff delete" on public.fp_bloc_matieres;
create policy "fp_bloc_matieres: staff delete" on public.fp_bloc_matieres for delete using (school_id = get_my_school_id());

drop policy if exists "fp_bloc_choix: staff select" on public.fp_bloc_choix;
create policy "fp_bloc_choix: staff select" on public.fp_bloc_choix for select using (school_id = get_my_school_id());
drop policy if exists "fp_bloc_choix: staff insert" on public.fp_bloc_choix;
create policy "fp_bloc_choix: staff insert" on public.fp_bloc_choix for insert with check (school_id = get_my_school_id());
drop policy if exists "fp_bloc_choix: staff update" on public.fp_bloc_choix;
create policy "fp_bloc_choix: staff update" on public.fp_bloc_choix for update using (school_id = get_my_school_id()) with check (school_id = get_my_school_id());
drop policy if exists "fp_bloc_choix: staff delete" on public.fp_bloc_choix;
create policy "fp_bloc_choix: staff delete" on public.fp_bloc_choix for delete using (school_id = get_my_school_id());

drop policy if exists "fp_bloc_choix_options: staff select" on public.fp_bloc_choix_options;
create policy "fp_bloc_choix_options: staff select" on public.fp_bloc_choix_options for select using (school_id = get_my_school_id());
drop policy if exists "fp_bloc_choix_options: staff insert" on public.fp_bloc_choix_options;
create policy "fp_bloc_choix_options: staff insert" on public.fp_bloc_choix_options for insert with check (school_id = get_my_school_id());
drop policy if exists "fp_bloc_choix_options: staff update" on public.fp_bloc_choix_options;
create policy "fp_bloc_choix_options: staff update" on public.fp_bloc_choix_options for update using (school_id = get_my_school_id()) with check (school_id = get_my_school_id());
drop policy if exists "fp_bloc_choix_options: staff delete" on public.fp_bloc_choix_options;
create policy "fp_bloc_choix_options: staff delete" on public.fp_bloc_choix_options for delete using (school_id = get_my_school_id());

-- ─── Ajout : niveau d'entrée du bloc (ex: « CM2 à 4e », « BFEM requis ») ────
alter table public.fp_blocs add column if not exists niveau_entree text;
