-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — Catalogue des formations (étape 1, v2)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après platform_mode_gestion.sql).
--
-- Remplace le schéma « bloc = une année dupliquée » par une vraie hiérarchie,
-- au plus près de comment une école pense sa propre organisation :
--
--   FORMATION (« CAP Restauration »)
--     └─ NIVEAU (« CAP 1 », « CAP 2 »… ou « Cycle unique »)
--          └─ MATIÈRE DU NIVEAU (coefficient, volume horaire, nature, type,
--             catégorie) — pointe vers une matière du CATALOGUE de l'école
--             (fp_matieres), pour ne jamais retaper « Anglais » deux fois
--             avec une faute qui le dédouble silencieusement.
--          └─ CRÉNEAU AU CHOIX (ex: spécialité Cuisine/Pâtisserie/Bar), avec
--             ses options.
--
-- Personne n'inscrit un élève en « CAP Restauration Année 2 » : on dit
-- « il est en CAP 2 ». La navigation colle à ça.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.fp_formations (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  name         text not null,
  -- Texte libre suggéré par une liste de valeurs côté écran (Diplôme d'État,
  -- de l'établissement, Attestation, Certificat, Autre) : le métier de
  -- l'école n'est pas le nôtre, elle reste libre de taper autre chose.
  diploma_type text,
  duration     text,
  entry_level  text,
  description  text,
  active       boolean not null default true,
  ordering     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists fp_formations_school_idx on public.fp_formations (school_id);

create table if not exists public.fp_niveaux (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  formation_id   uuid not null references public.fp_formations(id) on delete cascade,
  name           text not null,
  description    text,
  ordering       integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists fp_niveaux_formation_idx on public.fp_niveaux (formation_id);

-- Catalogue des noms de matières de l'école — PAS un contenu pédagogique (pas
-- de coefficient ici) : juste un nom, réutilisable par tous les niveaux de
-- toutes les formations. « Anglais » existe une fois ; chaque niveau qui
-- l'enseigne lui attribue SON coefficient dans fp_niveau_matieres.
create table if not exists public.fp_matieres (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);
create index if not exists fp_matieres_school_idx on public.fp_matieres (school_id);

create table if not exists public.fp_niveau_matieres (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  niveau_id      uuid not null references public.fp_niveaux(id) on delete cascade,
  matiere_id     uuid not null references public.fp_matieres(id) on delete restrict,
  type           text not null check (type in ('obligatoire', 'facultative')),
  coefficient    numeric not null default 1 check (coefficient > 0),
  volume_horaire numeric check (volume_horaire is null or volume_horaire >= 0),
  nature         text not null default 'theorique' check (nature in ('theorique', 'pratique', 'stage', 'projet')),
  -- Regroupement libre affiché à l'écran (« Enseignement général », « …
  -- professionnel »…) — texte libre, comme le reste.
  categorie      text,
  ordering       integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (niveau_id, matiere_id)
);
create index if not exists fp_niveau_matieres_niveau_idx on public.fp_niveau_matieres (niveau_id);
create index if not exists fp_niveau_matieres_matiere_idx on public.fp_niveau_matieres (matiere_id);

create table if not exists public.fp_choix (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  niveau_id   uuid not null references public.fp_niveaux(id) on delete cascade,
  label       text not null,
  coefficient numeric not null default 1 check (coefficient > 0),
  ordering    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists fp_choix_niveau_idx on public.fp_choix (niveau_id);

create table if not exists public.fp_choix_options (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  choix_id     uuid not null references public.fp_choix(id) on delete cascade,
  subject_name text not null,
  ordering     integer not null default 0
);
create index if not exists fp_choix_options_choix_idx on public.fp_choix_options (choix_id);

alter table public.fp_formations       enable row level security;
alter table public.fp_niveaux          enable row level security;
alter table public.fp_matieres         enable row level security;
alter table public.fp_niveau_matieres  enable row level security;
alter table public.fp_choix            enable row level security;
alter table public.fp_choix_options    enable row level security;

-- Réservé au personnel de l'école (comme Cursus) — pas encore de lecture
-- élève, le catalogue n'est pas encore relié à une inscription (étape 2).
do $$
declare t text;
begin
  foreach t in array array['fp_formations','fp_niveaux','fp_matieres','fp_niveau_matieres','fp_choix','fp_choix_options']
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
