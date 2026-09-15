-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTIF : le rejet d'une déclaration de paiement ne fonctionnait pas
-- À coller et exécuter dans l'éditeur SQL Supabase.
--
-- Symptôme : dans l'espace du chef du système, le bouton « Rejeter » d'une
-- déclaration en attente ne faisait rien.
--
-- Cause : la contrainte de la table n'autorisait que
--     'pending' | 'completed' | 'failed' | 'cancelled'
-- alors que platform_review_payment_claim écrit 'rejected' quand on rejette.
-- Chaque rejet levait donc une erreur 23514 et n'écrivait RIEN. L'approbation,
-- elle, marchait : elle écrit 'completed', qui figurait dans la liste.
--
-- Reproduit en base avant correction :
--   ERROR: 23514 new row for relation "billing_transactions"
--   violates check constraint "billing_transactions_status_check"
--
-- 'failed' et 'cancelled' sont CONSERVÉS : 8 déclarations de septembre 2026
-- les portent (ancienne intégration de paiement, antérieure à Wave). Les
-- retirer ferait échouer la contrainte sur des écritures comptables
-- existantes — et l'historique ne se réécrit pas.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.billing_transactions
  drop constraint if exists billing_transactions_status_check;

alter table public.billing_transactions
  add constraint billing_transactions_status_check
  check (status in (
    'pending',     -- déclarée par l'école, en attente de vérification
    'completed',   -- vérifiée et acceptée
    'rejected',    -- refusée par le chef du système (l'école repasse en suspendu)
    'failed',      -- hérité de l'ancienne intégration de paiement
    'cancelled'    -- hérité de l'ancienne intégration de paiement
  ));

-- ── Contrôle ───────────────────────────────────────────────────────────────
-- Après exécution, ceci doit renvoyer une ligne « rejected » puis tout annuler :
--
--   BEGIN;
--   INSERT INTO public.billing_transactions
--     (school_id, school_name, plan, amount, currency, ref_command, status, payment_method)
--   SELECT id, name, 'mensuel', 25000, 'XOF', 'TEST-REJET', 'pending', 'wave'
--     FROM public.schools LIMIT 1;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claim.sub = '<uuid du chef du système>';
--   SELECT public.platform_review_payment_claim(
--     (select id from public.billing_transactions where ref_command = 'TEST-REJET'),
--     false, 'test');
--   SET LOCAL role postgres;
--   SELECT status, rejection_reason FROM public.billing_transactions
--    WHERE ref_command = 'TEST-REJET';
--   ROLLBACK;
