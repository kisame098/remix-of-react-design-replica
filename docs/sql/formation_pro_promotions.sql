-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — Promotions (étape 2)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après formation_pro_formations.sql).
--
-- Une promotion (« CAP 1 — Promo Septembre 2026 ») représente les élèves qui
-- suivent, ensemble, le programme d'UN niveau. Plutôt que reconstruire à côté
-- l'inscription, les paiements, les présences, l'emploi du temps et le
-- portail élève — qui fonctionnent déjà très bien sans rien savoir de Cursus,
-- juste à partir d'une ligne `classes` — chaque promotion EN CRÉE une, et la
-- possède (colonne `class_id`, unique).
--
-- Cette table `fp_promotions` reste isolée comme le reste du module : c'est
-- elle qui porte tout ce qui est propre à la formation professionnelle
-- (le niveau suivi, le statut, le rythme, les dates). La table `classes`
-- elle-même n'est pas modifiée d'une seule colonne — une école classique ne
-- voit jamais rien de ce fichier.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.fp_promotions (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  niveau_id   uuid not null references public.fp_niveaux(id) on delete restrict,
  -- La classe qui porte réellement l'effectif, les paiements, les présences,
  -- l'emploi du temps — jamais recréée ni dupliquée, une seule par promotion.
  class_id    uuid not null unique references public.classes(id) on delete cascade,
  rythme      text not null default 'jour' check (rythme in ('jour', 'soir')),
  start_date  date,
  end_date    date,
  status      text not null default 'active' check (status in ('a_venir', 'active', 'terminee', 'archivee')),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists fp_promotions_school_idx on public.fp_promotions (school_id);
create index if not exists fp_promotions_niveau_idx on public.fp_promotions (niveau_id);

alter table public.fp_promotions enable row level security;

drop policy if exists "fp_promotions: staff select" on public.fp_promotions;
create policy "fp_promotions: staff select" on public.fp_promotions for select using (school_id = get_my_school_id());
drop policy if exists "fp_promotions: staff insert" on public.fp_promotions;
create policy "fp_promotions: staff insert" on public.fp_promotions for insert with check (school_id = get_my_school_id());
drop policy if exists "fp_promotions: staff update" on public.fp_promotions;
create policy "fp_promotions: staff update" on public.fp_promotions for update using (school_id = get_my_school_id()) with check (school_id = get_my_school_id());
drop policy if exists "fp_promotions: staff delete" on public.fp_promotions;
create policy "fp_promotions: staff delete" on public.fp_promotions for delete using (school_id = get_my_school_id());
