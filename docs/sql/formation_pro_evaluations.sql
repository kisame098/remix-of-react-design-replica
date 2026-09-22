-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — Évaluations (étape 3)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après formation_pro_promotions.sql).
--
-- Une évaluation est une activité notée (« Contrôle pratique n°1 », /20, le
-- 18/09/2026), rattachée à UNE promotion, UNE matière de son niveau et UNE
-- période — jamais un seul chiffre agrégé par catégorie : un professeur donne
-- plusieurs contrôles dans l'année, chacun garde son titre et sa date.
--
-- Le calcul se fait à trois étages, jamais recalculé à la main :
--   1. dans une catégorie   : moyenne des évaluations, pondérée par leur poids
--   2. entre catégories     : pondérée par le pourcentage du barème de la
--                              formation (fp_bareme_categories)
--   3. entre matières       : pondérée par le coefficient de la matière
--                              (déjà dans fp_niveau_matieres — jamais resaisi)
--
-- Une note « absente » ou « non évaluée » n'est JAMAIS comptée comme 0 — elle
-- est exclue du calcul, comme partout ailleurs dans SenClass.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Barème : les catégories de la formule d'évaluation, par formation ─────
create table if not exists public.fp_bareme_categories (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  formation_id  uuid not null references public.fp_formations(id) on delete cascade,
  name          text not null,
  pourcentage   numeric not null check (pourcentage > 0 and pourcentage <= 100),
  ordering      integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (formation_id, name)
);
create index if not exists fp_bareme_categories_formation_idx on public.fp_bareme_categories (formation_id);

-- ─── Périodes : propres à CHAQUE promotion (pas de calendrier commun — une
-- formation de 6 mois et un CAP de 3 ans ne suivent pas le même rythme). ────
create table if not exists public.fp_periodes (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  promotion_id  uuid not null references public.fp_promotions(id) on delete cascade,
  name          text not null,
  start_date    date,
  end_date      date,
  ordering      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists fp_periodes_promotion_idx on public.fp_periodes (promotion_id);

create table if not exists public.fp_evaluations (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  promotion_id      uuid not null references public.fp_promotions(id) on delete cascade,
  niveau_matiere_id uuid not null references public.fp_niveau_matieres(id) on delete cascade,
  periode_id        uuid not null references public.fp_periodes(id) on delete cascade,
  -- La catégorie DOIT exister dans le barème de la formation suivie par la
  -- promotion — sans quoi la note n'entrerait dans aucun calcul.
  categorie_id      uuid not null references public.fp_bareme_categories(id) on delete restrict,
  type              text not null default 'Contrôle continu',
  title             text not null,
  date              date not null,
  bareme            numeric not null default 20 check (bareme > 0),
  poids             numeric not null default 1 check (poids > 0),
  description       text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists fp_evaluations_promotion_idx on public.fp_evaluations (promotion_id);
create index if not exists fp_evaluations_periode_idx on public.fp_evaluations (periode_id);
create index if not exists fp_evaluations_niveau_matiere_idx on public.fp_evaluations (niveau_matiere_id);

create table if not exists public.fp_notes (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  evaluation_id  uuid not null references public.fp_evaluations(id) on delete cascade,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  valeur         numeric check (valeur is null or valeur >= 0),
  statut         text not null default 'note' check (statut in ('note', 'absent', 'absent_justifie', 'non_evalue')),
  observation    text,
  updated_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (evaluation_id, student_enrollment_id),
  -- Une note « absente » ou « non évaluée » n'a pas de valeur — évite un 0 qui
  -- se lirait comme une vraie note, la faute qui a déjà été corrigée ailleurs.
  check ((statut = 'note') = (valeur is not null))
);
create index if not exists fp_notes_evaluation_idx on public.fp_notes (evaluation_id);
create index if not exists fp_notes_student_idx on public.fp_notes (student_enrollment_id);

-- ─── Historique : toute correction d'une note déjà saisie laisse une trace,
-- jamais un motif obligatoire (pas de friction pour une faute de frappe). ──
create table if not exists public.fp_notes_historique (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  note_id        uuid not null references public.fp_notes(id) on delete cascade,
  ancienne_valeur numeric,
  ancien_statut  text,
  nouvelle_valeur numeric,
  nouveau_statut text,
  modifie_par    uuid,
  modifie_le     timestamptz not null default now()
);
create index if not exists fp_notes_historique_note_idx on public.fp_notes_historique (note_id);

alter table public.fp_bareme_categories  enable row level security;
alter table public.fp_periodes           enable row level security;
alter table public.fp_evaluations        enable row level security;
alter table public.fp_notes              enable row level security;
alter table public.fp_notes_historique   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['fp_bareme_categories','fp_periodes','fp_evaluations','fp_notes','fp_notes_historique']
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
