-- ═══════════════════════════════════════════════════════════════════════════
-- MENSUALITÉ PAR MOIS (propre à chaque classe)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
-- tuition_configs.monthly_fees : seulement les mois dont le montant diffère de
-- la mensualité de base, ex. {"2026-10": 20000, "2026-11": 15000}. Vide = tous
-- les mois à la mensualité de base : rien ne change pour les tarifs existants.
-- Voir src/lib/mensualites.ts.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.tuition_configs
  add column if not exists monthly_fees jsonb not null default '{}'::jsonb;

alter table public.tuition_configs drop constraint if exists tuition_configs_monthly_fees_objet;
alter table public.tuition_configs
  add constraint tuition_configs_monthly_fees_objet check (jsonb_typeof(monthly_fees) = 'object');
