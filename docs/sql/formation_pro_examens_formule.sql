-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — Les examens alimentent la formule d'évaluation
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après formation_pro_examens.sql).
--
-- Un examen ne se saisit plus qu'à UN endroit : la rubrique Examens.
-- La formule d'une formation (Contrôle continu 30 % · TP 30 % · Examen blanc
-- 10 % · Examen final 30 %) reste la même, mais une catégorie peut désormais
-- être « alimentée » par les examens de la promotion :
--   - source_examen = null       : notes saisies dans Évaluations (CC, TP…) ;
--   - source_examen = 'blanc'    : notes des examens blancs ;
--   - source_examen = 'officiel' : notes des examens finaux.
-- Pour cela, un examen indique la période (semestre…) dans laquelle il compte.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.fp_bareme_categories
  add column if not exists source_examen text check (source_examen in ('blanc', 'officiel'));

-- Les formules déjà créées : « Examen blanc » et « Examen final » passent aux examens.
update public.fp_bareme_categories set source_examen = 'blanc'
  where source_examen is null and lower(trim(name)) = 'examen blanc';
update public.fp_bareme_categories set source_examen = 'officiel'
  where source_examen is null and lower(trim(name)) = 'examen final';

alter table public.fp_examens
  add column if not exists periode_id uuid references public.fp_periodes(id) on delete set null;
create index if not exists fp_examens_periode_idx on public.fp_examens (periode_id);
