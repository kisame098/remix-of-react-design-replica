-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — Stages (étape 5)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après formation_pro_examens_formule.sql).
--
-- Un stage concerne UN élève (son entreprise, ses dates) — pas toute la
-- promotion d'un coup. Un élève peut en faire plusieurs.
--
-- Note : UNE seule note sur 20, donnée à la fin (choix de l'école : pas de
-- décomposition entreprise / rapport / soutenance). Elle se saisit une seule
-- fois, ici, et remplit la matière de nature « Stage » du programme dans
-- Évaluations, pour la période choisie — jamais de double saisie.
-- ═══════════════════════════════════════════════════════════════════════════

-- Carnet d'entreprises de l'école : on ne retape jamais « Hôtel Terrou-Bi ».
create table if not exists public.fp_entreprises (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  nom         text not null,
  secteur     text,
  adresse     text,
  telephone   text,
  email       text,
  contact     text,
  created_at  timestamptz not null default now()
);
-- Deux fois le même nom (casse et espaces ignorés) : refusé.
create unique index if not exists fp_entreprises_nom_unique on public.fp_entreprises (school_id, lower(trim(nom)));

create table if not exists public.fp_stages (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  promotion_id          uuid not null references public.fp_promotions(id) on delete cascade,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  -- Une entreprise encore utilisée ne peut pas être supprimée du carnet.
  entreprise_id         uuid references public.fp_entreprises(id) on delete restrict,
  poste                 text,
  tuteur                text,
  tuteur_telephone      text,
  date_debut            date,
  date_fin              date,
  convention_signee     boolean not null default false,
  abandonne             boolean not null default false,
  -- Où compte la note : la matière « Stage » du programme, dans une période.
  niveau_matiere_id     uuid references public.fp_niveau_matieres(id) on delete set null,
  periode_id            uuid references public.fp_periodes(id) on delete set null,
  note                  numeric check (note is null or (note >= 0 and note <= 20)),
  appreciation          text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (date_debut is null or date_fin is null or date_debut <= date_fin)
);
create index if not exists fp_stages_promotion_idx on public.fp_stages (promotion_id);
create index if not exists fp_stages_eleve_idx on public.fp_stages (student_enrollment_id);

-- Visites de suivi (facultatives).
create table if not exists public.fp_stage_visites (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  stage_id     uuid not null references public.fp_stages(id) on delete cascade,
  date         date not null,
  visiteur     text,
  observation  text,
  created_at   timestamptz not null default now()
);
create index if not exists fp_stage_visites_stage_idx on public.fp_stage_visites (stage_id);

-- ─── RLS : chaque école ne voit que ses lignes ───────────────────────────────
alter table public.fp_entreprises    enable row level security;
alter table public.fp_stages         enable row level security;
alter table public.fp_stage_visites  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['fp_entreprises','fp_stages','fp_stage_visites']
  loop
    execute format('drop policy if exists "%1$s: staff select" on public.%1$s', t);
    execute format('create policy "%1$s: staff select" on public.%1$s for select using (school_id = get_my_school_id())', t);
    execute format('drop policy if exists "%1$s: staff insert" on public.%1$s', t);
    execute format('create policy "%1$s: staff insert" on public.%1$s for insert with check (school_id = get_my_school_id())', t);
    execute format('drop policy if exists "%1$s: staff update" on public.%1$s', t);
    execute format('create policy "%1$s: staff update" on public.%1$s for update using (school_id = get_my_school_id()) with check (school_id = get_my_school_id())', t);
    execute format('drop policy if exists "%1$s: staff delete" on public.%1$s', t);
    execute format('create policy "%1$s: staff delete" on public.%1$s for delete using (school_id = get_my_school_id())', t);
  end loop;
end $$;
