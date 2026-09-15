-- ═══════════════════════════════════════════════════════════════════════════
-- BLOCAGE D'ABONNEMENT CÔTÉ SERVEUR
-- À coller et exécuter dans l'éditeur SQL Supabase.
--
-- Deux trous fermés ici :
--
--  1. Une école suspendue n'était bloquée QUE par le routeur React. Un appel
--     direct à l'API (curl, console du navigateur) rendait toutes ses données.
--
--  2. PLUS GRAVE — le rôle `authenticated` avait le droit d'écrire
--     subscription_status / subscription_expires_at / subscription_plan sur sa
--     propre école : n'importe quel admin pouvait s'accorder un abonnement
--     actif jusqu'en 2099 en une requête. Vérifié en base avant écriture.
--
-- Ce qui reste ACCESSIBLE à une école bloquée (sinon elle ne pourrait jamais
-- se remettre en règle) :
--   • lire sa propre fiche `schools` (pour voir sa suspension) ;
--   • lire et déposer une preuve de paiement (billing_transactions) ;
--   • lire `school_members` (démarrage de session) ;
--   • modifier sa fiche école / ses paramètres — miroir exact de
--     SUBSCRIPTION_EXEMPT_PATHS dans ProtectedRoute.tsx.
--
-- Les élèves et les professeurs ne sont JAMAIS bloqués par l'abonnement :
-- c'est la règle déjà posée côté client (ProtectedRoute.tsx:59-63), on la
-- reproduit ici à l'identique plutôt que d'en inventer une autre.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Le statut d'abonnement n'appartient qu'au chef du système ────────────
-- ATTENTION : `authenticated` a un GRANT UPDATE au niveau de la TABLE. Un
-- REVOKE colonne par colonne serait alors un coup d'épée dans l'eau (testé :
-- l'écriture passe quand même). Il faut retirer le droit de table, puis ne
-- re-donner QUE les colonnes de la fiche école.
--
-- Les écrans plateforme passent par des RPC SECURITY DEFINER
-- (platform_update_subscription, platform_review_payment_claim,
-- submit_payment_claim) qui s'exécutent avec les droits du propriétaire :
-- ce REVOKE ne leur retire rien.
revoke update on public.schools from authenticated;
revoke update on public.schools from anon;

grant update (name, slug, country, city, phone, email, logo_url, settings, updated_at)
  on public.schools to authenticated;
-- Rien pour `anon` : un visiteur non connecté n'a aucune raison d'écrire ici.

-- ── 2. L'abonnement autorise-t-il l'accès ? ─────────────────────────────────
-- Miroir exact de getSubscriptionGate() (src/lib/subscription.ts) :
-- suspendu / annulé → non ; essai écoulé → non ; abonnement PAYANT échu → OUI
-- (le système ne coupe jamais de lui-même une école qui a payé, il le signale).
create or replace function public.is_school_access_allowed(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((
    select case
      when s.subscription_status in ('suspended', 'cancelled') then false
      when s.subscription_status = 'trial'
           and s.subscription_expires_at is not null
           and s.subscription_expires_at < now() then false
      else true
    end
    from public.schools s
    where s.id = p_school_id
  ), false);
$$;

-- ── 3. L'appartenance BRUTE, sans contrôle d'abonnement ─────────────────────
-- Réservée aux quelques tables de secours listées en tête de fichier.
create or replace function public.get_my_membership_school_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select school_id
  from public.school_members
  where user_id = auth.uid()
    and is_active = true
  limit 1;
$$;

-- ── 4. get_my_school_id() devient le point de blocage unique ────────────────
-- 148 des 153 policies de la base passent par cette fonction : la faire rendre
-- NULL ferme d'un coup toutes les données de l'école, sans réécrire 148
-- policies (et sans risquer d'en oublier une demain).
-- NULL ne fait jamais correspondre `school_id = NULL` : aucune ligne ne passe.
create or replace function public.get_my_school_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select m.school_id
  from public.school_members m
  where m.user_id = auth.uid()
    and m.is_active = true
    and public.is_school_access_allowed(m.school_id)
  limit 1;
$$;

-- ── 5. Les tables de secours passent sur l'appartenance brute ───────────────

-- Voir sa propre école (donc le motif de sa suspension).
drop policy if exists "schools: select (staff, student or platform admin)" on public.schools;
create policy "schools: select (staff, student or platform admin)"
on public.schools for select
using (
  id = get_my_membership_school_id()
  or id = get_my_account_school_id()
  or get_is_platform_admin()
);

-- Modifier sa fiche et ses paramètres reste permis (/parametres est exempt
-- côté client). Sans danger depuis l'étape 1 : les colonnes d'abonnement ne
-- sont plus écrivables par `authenticated`.
drop policy if exists "schools: admin update" on public.schools;
create policy "schools: admin update"
on public.schools for update
using (id = get_my_membership_school_id() or get_is_platform_admin());

-- Voir son historique de facturation, même bloquée : « l'historique est
-- capital », et c'est là qu'elle constate ce qu'elle a déjà payé.
drop policy if exists "billing_transactions: select (own school or platform admin)" on public.billing_transactions;
create policy "billing_transactions: select (own school or platform admin)"
on public.billing_transactions for select
using (
  (school_id = get_my_membership_school_id() and is_school_admin())
  or get_is_platform_admin()
);

-- Déposer une preuve de paiement Wave : c'est la porte de sortie.
drop policy if exists "billing_transactions: school insert claim" on public.billing_transactions;
create policy "billing_transactions: school insert claim"
on public.billing_transactions for insert
with check (
  school_id = get_my_membership_school_id()
  and is_school_admin()
  and status = 'pending'
);

-- Démarrage de session : le client lit son adhésion pour connaître son rôle.
drop policy if exists "school_members: school read" on public.school_members;
create policy "school_members: school read"
on public.school_members for select
using (school_id = get_my_membership_school_id());

-- ── 6. La RPC de paiement doit survivre à la suspension ─────────────────────
-- Sans ce changement, une école suspendue ne pourrait plus payer : la seule
-- action qui la débloque deviendrait impossible.
create or replace function public.submit_payment_claim(
  p_plan text, p_amount integer, p_wave_number text,
  p_wave_account_name text, p_proof_screenshot text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_school_id uuid; v_school_name text; v_tx_id uuid;
begin
  -- Appartenance BRUTE : une école suspendue doit pouvoir payer.
  v_school_id := get_my_membership_school_id();
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
  ) returning id into v_tx_id;

  -- Paiement Wave « par confiance » : réactivation immédiate, vérifiée ensuite
  -- par le chef du système. Une école ANNULÉE (départ définitif) ne se
  -- réactive pas toute seule — il faut une décision humaine.
  update public.schools
     set subscription_status = 'active'
   where id = v_school_id
     and subscription_status <> 'cancelled';

  return v_tx_id;
end;
$function$;

-- ── 7. Contrôle ─────────────────────────────────────────────────────────────
-- Après exécution, ces deux lignes doivent rendre `false` puis `true` :
--   select public.is_school_access_allowed(id) from public.schools where subscription_status = 'suspended';
--   select public.is_school_access_allowed(id) from public.schools where subscription_status = 'active';
