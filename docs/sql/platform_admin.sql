-- ═══════════════════════════════════════════════════════════════════════════
-- Compte Admin Plateforme + Paiement Wave par confiance
-- À coller et exécuter dans l'éditeur SQL Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Table platform_admins ─────────────────────────────────────────────
create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create policy "platform_admins: self select"
on public.platform_admins for select
using (auth_user_id = auth.uid());

-- ─── 2. Table banned_accounts ──────────────────────────────────────────────
create table if not exists public.banned_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  school_name text,
  reason text,
  banned_at timestamptz not null default now(),
  banned_by uuid references auth.users(id)
);

alter table public.banned_accounts enable row level security;

-- ─── 3. Fonction get_is_platform_admin() ───────────────────────────────────
create or replace function public.get_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where auth_user_id = auth.uid()
  );
$$;

create policy "banned_accounts: platform admin only"
on public.banned_accounts for all
using (get_is_platform_admin())
with check (get_is_platform_admin());

-- ─── 4. RLS consolidée : schools ────────────────────────────────────────────
drop policy if exists "schools: select (staff or student)" on public.schools;
create policy "schools: select (staff, student or platform admin)"
on public.schools for select
using (
  id = get_my_school_id()
  or id = get_my_account_school_id()
  or get_is_platform_admin()
);

drop policy if exists "schools: admin update" on public.schools;
create policy "schools: admin update"
on public.schools for update
using (id = get_my_school_id() or get_is_platform_admin())
with check (id = get_my_school_id() or get_is_platform_admin());

-- Verrou anti-triche : seules les RPCs SECURITY DEFINER plus bas peuvent
-- changer l'abonnement — même un admin d'école ne peut pas le faire par un
-- appel direct à l'API (bug ou tentative malveillante), seulement via
-- submit_payment_claim (qui active SA PROPRE école, jamais une autre).
revoke update (subscription_status, subscription_plan, subscription_expires_at)
  on public.schools from authenticated;

-- ─── 5. billing_transactions : colonnes + RLS ───────────────────────────────
alter table public.billing_transactions
  add column if not exists wave_number text,
  add column if not exists wave_account_name text,
  add column if not exists proof_screenshot_url text,
  add column if not exists submitted_by uuid references auth.users(id),
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text;

drop policy if exists "billing_transactions: select own school" on public.billing_transactions;
create policy "billing_transactions: select (own school or platform admin)"
on public.billing_transactions for select
using (
  (school_id = get_my_school_id() and is_school_admin())
  or get_is_platform_admin()
);

create policy "billing_transactions: school insert claim"
on public.billing_transactions for insert
with check (
  school_id = get_my_school_id()
  and is_school_admin()
  and status = 'pending'
);

create policy "billing_transactions: platform admin update"
on public.billing_transactions for update
using (get_is_platform_admin())
with check (get_is_platform_admin());

-- ─── 6. RPC submit_payment_claim — l'école déclare avoir payé ──────────────
-- "Bénéfice du doute" : active tout de suite, sans attendre la vérification.
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
  v_tx_id uuid;
begin
  v_school_id := get_my_school_id();
  if v_school_id is null or not is_school_admin() then
    raise exception 'Non autorisé';
  end if;

  insert into public.billing_transactions (
    school_id, plan, amount, currency, ref_command, status,
    payment_method, wave_number, wave_account_name, proof_screenshot_url, submitted_by
  ) values (
    v_school_id, p_plan, p_amount, 'XOF',
    'WAVE-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(gen_random_uuid()::text, 1, 6),
    'pending', 'wave', p_wave_number, p_wave_account_name, p_proof_screenshot, auth.uid()
  )
  returning id into v_tx_id;

  update public.schools set subscription_status = 'active' where id = v_school_id;

  return v_tx_id;
end;
$$;

-- ─── 7. RPC platform_review_payment_claim — vérification a posteriori ──────
create or replace function public.platform_review_payment_claim(
  p_transaction_id uuid,
  p_approve boolean,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_current_expiry timestamptz;
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;

  select school_id into v_school_id from public.billing_transactions where id = p_transaction_id;
  if v_school_id is null then
    raise exception 'Transaction introuvable';
  end if;

  if p_approve then
    update public.billing_transactions
      set status = 'completed', reviewed_by = auth.uid(), reviewed_at = now(), completed_at = now()
      where id = p_transaction_id;

    select subscription_expires_at into v_current_expiry from public.schools where id = v_school_id;

    -- Empile le renouvellement sur l'expiration existante si elle est encore
    -- valide (renouvellement anticipé), sinon repart de maintenant.
    update public.schools
      set subscription_status = 'active',
          subscription_expires_at = greatest(coalesce(v_current_expiry, now()), now()) + interval '1 month'
      where id = v_school_id;
  else
    update public.billing_transactions
      set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_rejection_reason
      where id = p_transaction_id;

    -- Annule le bénéfice du doute accordé par submit_payment_claim.
    update public.schools set subscription_status = 'suspended' where id = v_school_id;
  end if;
end;
$$;

-- ─── 8. RPC platform_update_subscription — activation/suspension manuelle ──
create or replace function public.platform_update_subscription(
  p_school_id uuid,
  p_status subscription_status,
  p_plan text default null,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;

  update public.schools
    set subscription_status = p_status,
        subscription_plan = coalesce(p_plan, subscription_plan),
        subscription_expires_at = coalesce(p_expires_at, subscription_expires_at)
    where id = p_school_id;
end;
$$;

-- ─── 9. RPC platform_ban_account — bannissement définitif par email ────────
create or replace function public.platform_ban_account(
  p_email text,
  p_reason text default null,
  p_school_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;

  insert into public.banned_accounts (email, school_name, reason, banned_by)
  values (lower(p_email), p_school_name, p_reason, auth.uid())
  on conflict (email) do update set reason = excluded.reason, banned_at = now(), banned_by = excluded.banned_by;
end;
$$;

-- ─── 10. handle_new_user() — essai 7 jours + blocage des comptes bannis ────
-- Fonction existante modifiée (mêmes 3 étapes qu'avant : profil, école,
-- membership admin), avec 2 ajouts : vérif banned_accounts en tête, et
-- subscription_expires_at fixé à +7 jours (jamais fait jusqu'ici).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  new_school_id UUID;
  school_name   TEXT;
BEGIN
  IF NEW.email ILIKE '%@terranga.com' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.banned_accounts WHERE email = lower(NEW.email)) THEN
    RAISE EXCEPTION 'Inscription refusée';
  END IF;

  school_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'school_name'), ''),
    'Mon École'
  );

  INSERT INTO public.profiles (id, email, registered_at)
  VALUES (NEW.id, NEW.email, NOW());

  INSERT INTO public.schools (name, created_at, subscription_expires_at)
  VALUES (school_name, NOW(), NOW() + INTERVAL '7 days')
  RETURNING id INTO new_school_id;

  INSERT INTO public.school_members (school_id, user_id, role, joined_at)
  VALUES (new_school_id, NEW.id, 'admin_school', NOW());

  RETURN NEW;
END;
$function$;
