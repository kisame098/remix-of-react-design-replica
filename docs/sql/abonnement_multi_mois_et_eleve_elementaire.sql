-- ═══════════════════════════════════════════════════════════════════════════
-- 1. L'élève d'élémentaire ne voyait pas ses notes
-- 2. L'abonnement se règle désormais sur plusieurs mois
-- À coller et exécuter dans l'éditeur SQL Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. L'ÉLÈVE DOIT POUVOIR LIRE SA PROPRE CLASSE ──────────────────────────
-- Symptôme : un élève de CI-CM2 se connectait et ne voyait aucune note.
--
-- Cause : le portail reconnaît l'élémentaire en lisant le NIVEAU de la classe
-- de l'élève (CI, CP, CE1…) pour lui servir l'écran à barème de points. Or la
-- policy de `classes` n'avait aucune branche « élève » : la lecture renvoyait
-- zéro ligne, le niveau restait inconnu, et l'élève recevait l'écran COLLÈGE —
-- bâti sur devoirs + composition + coefficients, qui n'existent pas chez lui.
-- Il cherchait donc des notes dans des tables où il n'y en a jamais.
--
-- Vérifié en base avant correction : `select count(*) from classes` renvoyait
-- 0 pour un élève, alors que ses 52 disciplines et ses 39 notes étaient bien
-- lisibles.
--
-- On n'ouvre QUE sa classe — pas celles des autres.
drop policy if exists "classes: school members read" on public.classes;
create policy "classes: school members read"
on public.classes for select
using (
  school_id = get_my_school_id()
  or id in (select get_my_teacher_class_ids())
  or id = get_my_student_class_id()      -- sa classe à lui, et elle seule
);

-- ── 2. ABONNEMENT SUR PLUSIEURS MOIS ───────────────────────────────────────
-- Une école peut régler 1 à 12 mois d'un coup, avec une remise qui grandit
-- avec la durée (grille dans src/lib/subscriptionPlans.ts).
--
-- Jusqu'ici la durée n'était stockée nulle part, et l'approbation prolongeait
-- toujours d'un mois : une école ayant payé l'année n'aurait reçu qu'un mois.

alter table public.billing_transactions
  add column if not exists months integer not null default 1;

comment on column public.billing_transactions.months is
  'Nombre de mois d''abonnement réglés par cette déclaration (1 à 12).';

-- Garde-fou : une durée hors grille n'entre pas en base.
alter table public.billing_transactions
  drop constraint if exists billing_transactions_months_check;
alter table public.billing_transactions
  add constraint billing_transactions_months_check
  check (months between 1 and 12);

-- ── 3. La déclaration de paiement porte la durée ───────────────────────────
create or replace function public.submit_payment_claim(
  p_plan text, p_amount integer, p_wave_number text,
  p_wave_account_name text, p_proof_screenshot text,
  p_months integer default 1
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school_id uuid; v_school_name text; v_tx_id uuid; v_months integer;
begin
  -- Appartenance BRUTE : une école suspendue doit pouvoir payer.
  v_school_id := get_my_membership_school_id();
  if v_school_id is null or not is_school_admin() then
    raise exception 'Non autorisé';
  end if;

  -- La durée vient du client : on la borne ici, c'est le serveur qui décide.
  v_months := least(greatest(coalesce(p_months, 1), 1), 12);

  select name into v_school_name from public.schools where id = v_school_id;

  insert into public.billing_transactions (
    school_id, school_name, plan, amount, months, currency, ref_command, status,
    payment_method, wave_number, wave_account_name, proof_screenshot_url, submitted_by
  ) values (
    v_school_id, v_school_name, p_plan, p_amount, v_months, 'XOF',
    'WAVE-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 6),
    'pending', 'wave', p_wave_number, p_wave_account_name, p_proof_screenshot, auth.uid()
  ) returning id into v_tx_id;

  -- Paiement Wave « par confiance » : réactivation immédiate, vérifiée ensuite
  -- par le chef du système. Une école ANNULÉE ne se réactive pas toute seule.
  update public.schools
     set subscription_status = 'active'
   where id = v_school_id
     and subscription_status <> 'cancelled';

  return v_tx_id;
end;
$function$;

-- ── 4. L'approbation prolonge du BON nombre de mois ────────────────────────
create or replace function public.platform_review_payment_claim(
  p_transaction_id uuid, p_approve boolean, p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school_id uuid;
  v_current_expiry timestamptz;
  v_months integer;
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;

  select school_id, coalesce(months, 1) into v_school_id, v_months
    from public.billing_transactions where id = p_transaction_id;
  if v_school_id is null then
    raise exception 'Transaction introuvable';
  end if;

  if p_approve then
    update public.billing_transactions
      set status = 'completed', reviewed_by = auth.uid(), reviewed_at = now(), completed_at = now()
      where id = p_transaction_id;

    select subscription_expires_at into v_current_expiry from public.schools where id = v_school_id;

    -- Empile le renouvellement sur l'expiration existante si elle est encore
    -- valide (renouvellement anticipé), sinon repart de maintenant — et
    -- prolonge d'AUTANT DE MOIS QUE L'ÉCOLE EN A PAYÉ.
    update public.schools
      set subscription_status = 'active',
          subscription_expires_at =
            greatest(coalesce(v_current_expiry, now()), now()) + (v_months || ' month')::interval
      where id = v_school_id;
  else
    update public.billing_transactions
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_rejection_reason
      where id = p_transaction_id;

    -- Annule le bénéfice du doute accordé par submit_payment_claim.
    update public.schools set subscription_status = 'suspended' where id = v_school_id;
  end if;
end;
$function$;

-- ── Contrôle ───────────────────────────────────────────────────────────────
--   select count(*) from public.classes;   -- en tant qu'élève : doit valoir 1
--   select months from public.billing_transactions limit 5;
