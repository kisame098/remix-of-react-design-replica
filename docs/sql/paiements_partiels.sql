-- ═══════════════════════════════════════════════════════════════════════════
-- PAIEMENTS PARTIELS (ACOMPTES)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor, AVANT la mise en ligne de
-- l'application qui propose les acomptes.
--
-- 1. payments.partiel : true = acompte (ne solde pas l'élément). Tous les
--    paiements existants valent false : ils restent des paiements qui soldent,
--    rien ne change pour eux.
-- 2. Les index uniques qui empêchent le double encaissement ne portent plus
--    que sur les paiements qui SOLDENT (and not partiel) : plusieurs acomptes
--    sont permis sur un même mois, mais toujours un seul solde. La protection
--    reste entière pour le paiement complet.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.payments add column if not exists partiel boolean not null default false;

-- Inscription : un seul paiement qui solde par élève et par année.
drop index if exists public.idx_payments_inscription_uniq;
create unique index idx_payments_inscription_uniq on public.payments
  (school_id, academic_year_label, student_enrollment_id)
  where type = 'inscription' and status = 'confirmed' and not partiel;

-- Scolarité : un seul paiement qui solde par mois.
drop index if exists public.idx_payments_tuition_uniq;
create unique index idx_payments_tuition_uniq on public.payments
  (school_id, academic_year_label, student_enrollment_id, month_key)
  where type = 'tuition' and month_key is not null and status = 'confirmed' and not partiel;

-- Service annuel ou ponctuel : un seul paiement qui solde.
drop index if exists public.idx_payments_service_annual_uniq;
create unique index idx_payments_service_annual_uniq on public.payments
  (school_id, academic_year_label, student_enrollment_id, service_id)
  where type = 'service' and month_key is null and status = 'confirmed' and not partiel;
