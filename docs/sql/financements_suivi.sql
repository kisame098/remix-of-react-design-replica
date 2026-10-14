-- ═══════════════════════════════════════════════════════════════════════════
-- FINANCEMENTS (3FPT…) — Factures, versements, rapports, insertion (étapes 2 à 5)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor, APRÈS financements_dossiers.sql.
-- Les étapes 2 à 5 sont réunies ici : un seul passage dans l'éditeur.
--
--   fin_factures   : factures à l'organisme (une tranche : acompte, solde…),
--                    pour une cohorte entière OU pour un apprenant. Jamais
--                    supprimées : une facture fausse s'ANNULE (pièce comptable),
--                    et son numéro n'est jamais réattribué.
--   fin_versements : ce que l'organisme a payé sur une facture.
--   fin_rapports   : rapports de fin de formation (cohorte OU apprenant),
--                    leur état et leur fichier.
--   fin_journal    : l'historique (émissions, versements, transmissions…).
--   fin_insertions : la situation professionnelle de chaque bénéficiaire,
--                    datée, sans jamais écraser la précédente.
--
-- Personnel de l'école seulement (get_my_school_id() est vide pour un élève).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.fin_factures (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id) on delete cascade,
  organisme_id         text not null,
  numero               integer not null check (numero > 0),
  annee                integer not null,
  tranche_id           text not null,
  tranche_libelle      text not null,
  tranche_pourcentage  numeric not null,
  portee               text not null check (portee in ('cohorte', 'apprenant')),
  class_id             uuid references public.classes(id) on delete set null,
  date_emission        date not null default current_date,
  date_echeance        date,
  -- [{ dossier_id, student_enrollment_id, nom, matricule, finance, montant }]
  lignes               jsonb not null default '[]'::jsonb,
  total                numeric not null check (total >= 0),
  annulee              boolean not null default false,
  annulee_le           timestamptz,
  annulee_par          text,
  note                 text,
  cree_par             text,
  created_at           timestamptz not null default now(),
  -- Deux factures ne portent jamais le même numéro (par organisme et par année).
  unique (school_id, organisme_id, annee, numero)
);
create index if not exists fin_factures_ecole_idx on public.fin_factures (school_id);

create table if not exists public.fin_versements (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  -- Une facture qui a reçu de l'argent ne disparaît pas.
  facture_id  uuid not null references public.fin_factures(id) on delete restrict,
  montant     numeric not null check (montant > 0),
  date        date not null default current_date,
  reference   text,
  note        text,
  cree_par    text,
  created_at  timestamptz not null default now()
);
create index if not exists fin_versements_facture_idx on public.fin_versements (facture_id);

create table if not exists public.fin_rapports (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  organisme_id       text not null,
  portee             text not null check (portee in ('cohorte', 'apprenant')),
  class_id           uuid not null references public.classes(id) on delete cascade,
  dossier_id         uuid references public.fin_dossiers(id) on delete cascade,
  titre              text not null check (length(btrim(titre)) between 1 and 200),
  statut             text not null default 'a_produire' check (statut in ('a_produire', 'en_cours', 'transmis', 'valide')),
  fichier            text,
  date_transmission  date,
  date_validation    date,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Un rapport d'apprenant désigne son dossier ; un rapport de cohorte, aucun.
  check ((portee = 'apprenant') = (dossier_id is not null))
);
create index if not exists fin_rapports_ecole_idx on public.fin_rapports (school_id);

create table if not exists public.fin_journal (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  objet       text not null check (objet in ('rapport', 'facture', 'dossier')),
  objet_id    uuid not null,
  action      text not null,
  detail      text,
  par_nom     text,
  created_at  timestamptz not null default now()
);
create index if not exists fin_journal_objet_idx on public.fin_journal (school_id, objet_id);

create table if not exists public.fin_insertions (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  dossier_id  uuid not null references public.fin_dossiers(id) on delete cascade,
  date        date not null,
  situation   text not null check (situation in ('emploi', 'auto_emploi', 'stage', 'etudes', 'recherche', 'sans_nouvelles')),
  structure   text,
  poste       text,
  note        text,
  cree_par    text,
  created_at  timestamptz not null default now()
);
create index if not exists fin_insertions_dossier_idx on public.fin_insertions (dossier_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.fin_factures   enable row level security;
alter table public.fin_versements enable row level security;
alter table public.fin_rapports   enable row level security;
alter table public.fin_journal    enable row level security;
alter table public.fin_insertions enable row level security;

do $$
declare t text;
begin
  -- Lecture et ajout : tout le personnel de l'école.
  foreach t in array array['fin_factures', 'fin_versements', 'fin_rapports', 'fin_journal', 'fin_insertions']
  loop
    execute format('drop policy if exists "%1$s: staff select" on public.%1$s', t);
    execute format('create policy "%1$s: staff select" on public.%1$s for select using (school_id = get_my_school_id())', t);
    execute format('drop policy if exists "%1$s: staff insert" on public.%1$s', t);
    execute format('create policy "%1$s: staff insert" on public.%1$s for insert with check (school_id = get_my_school_id())', t);
  end loop;
  -- Modification : factures (annulation), rapports, insertions. Le journal ne se réécrit pas.
  foreach t in array array['fin_factures', 'fin_rapports', 'fin_insertions']
  loop
    execute format('drop policy if exists "%1$s: staff update" on public.%1$s', t);
    execute format('create policy "%1$s: staff update" on public.%1$s for update using (school_id = get_my_school_id()) with check (school_id = get_my_school_id())', t);
  end loop;
  -- Suppression : rapports et insertions (saisie erronée). Un versement saisi
  -- par erreur ne se retire que par le directeur ; une facture, jamais.
  foreach t in array array['fin_rapports', 'fin_insertions']
  loop
    execute format('drop policy if exists "%1$s: staff delete" on public.%1$s', t);
    execute format('create policy "%1$s: staff delete" on public.%1$s for delete using (school_id = get_my_school_id())', t);
  end loop;
  execute 'drop policy if exists "fin_versements: directeur delete" on public.fin_versements';
  execute 'create policy "fin_versements: directeur delete" on public.fin_versements for delete using (school_id = get_my_school_id() and is_school_admin())';
end $$;
