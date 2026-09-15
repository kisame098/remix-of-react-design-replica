-- ═══════════════════════════════════════════════════════════════════════════
-- Abonnements v2 : historique comptable indestructible + purge de la capture
-- À coller et exécuter dans l'éditeur SQL Supabase (après platform_admin.sql).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. La trace écrite doit survivre à TOUT ───────────────────────────────
-- school_name : copie du nom au moment de la déclaration — reste lisible même
-- si l'école est supprimée plus tard.
-- screenshot_deleted_at : on peut purger l'image sans toucher à la trace.
alter table public.billing_transactions
  add column if not exists school_name text,
  add column if not exists screenshot_deleted_at timestamptz;

update public.billing_transactions bt
set school_name = s.name
from public.schools s
where s.id = bt.school_id and bt.school_name is null;

-- La FK était ON DELETE CASCADE : supprimer une école effaçait TOUT son
-- historique de paiement. Inacceptable pour une trace comptable → SET NULL,
-- la ligne survit (avec school_name conservé).
alter table public.billing_transactions alter column school_id drop not null;
alter table public.billing_transactions drop constraint billing_transactions_school_id_fkey;
alter table public.billing_transactions
  add constraint billing_transactions_school_id_fkey
  foreign key (school_id) references public.schools(id) on delete set null;

-- Rappel : aucune policy DELETE n'existe sur billing_transactions — ni une
-- école ni le chef du système ne peut effacer une ligne via l'API. Voulu.

-- ─── 2. Purge de la capture d'écran uniquement ─────────────────────────────
create or replace function public.platform_delete_payment_screenshot(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;

  update public.billing_transactions
    set proof_screenshot_url = null,
        screenshot_deleted_at = now()
    where id = p_transaction_id;
end;
$$;

-- ─── 3. submit_payment_claim : enregistre aussi le nom de l'école ──────────
create or replace function public.submit_payment_claim(
  p_plan text,
  p_amount integer,
  p_wave_number text,
  p_wave_account_name text,
  p_proof_screenshot text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_school_name text;
  v_tx_id uuid;
begin
  v_school_id := get_my_school_id();
  if v_school_id is null or not is_school_admin() then
    raise exception 'Non autorisé';
  end if;

  select name into v_school_name from public.schools where id = v_school_id;

  insert into public.billing_transactions (
    school_id, school_name, plan, amount, currency, ref_command, status,
    payment_method, wave_number, wave_account_name, proof_screenshot_url, submitted_by
  ) values (
    v_school_id, v_school_name, p_plan, p_amount, 'XOF',
    'WAVE-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 6),
    'pending', 'wave', p_wave_number, p_wave_account_name, p_proof_screenshot, auth.uid()
  )
  returning id into v_tx_id;

  update public.schools set subscription_status = 'active' where id = v_school_id;

  return v_tx_id;
end;
$$;
