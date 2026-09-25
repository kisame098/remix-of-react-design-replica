-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — Bulletins et relevés au format de l'école
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après formation_pro_documents.sql).
-- Uniquement des colonnes FACULTATIVES ajoutées : aucune donnée modifiée.
--
-- D'après les documents d'IFHO (relevé CAP DECPC 2022, relevé d'examen blanc
-- BEP 2024) : chaque TOUR d'un examen a sa propre moyenne exigée (CAP : 12 au
-- 1er tour — « total demandé » 156 = 13 × 12 —, 10 au 2e tour), et le 1er
-- tour donne une décision d'admissibilité avant le 2e.
-- ═══════════════════════════════════════════════════════════════════════════

-- Moyenne exigée pour un tour (vide : le seuil d'admission de l'examen).
alter table public.fp_examen_tours
  add column if not exists moyenne_exigee numeric check (moyenne_exigee is null or (moyenne_exigee > 0 and moyenne_exigee <= 20));

-- Relevé d'examen : centre d'examen et président du jury.
alter table public.fp_examens add column if not exists centre text;
alter table public.fp_examens add column if not exists president_jury text;

-- Titre du relevé : « Brevet d'Étude Professionnelle (BEP) », « Option RESTAURATION ».
alter table public.fp_formations add column if not exists intitule_diplome text;
alter table public.fp_formations add column if not exists option_diplome text;
