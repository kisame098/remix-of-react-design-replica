-- ═══════════════════════════════════════════════════════════════════════════
-- « ENCAISSÉ PAR » ET « ANNULÉ PAR » GARANTIS PAR LA BASE
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
-- Le défaut : payments.received_by et cancelled_by étaient des textes ENVOYÉS
-- PAR L'ÉCRAN, écrits tels quels. Un onglet qui n'avait pas pu lire la fiche
-- profil encaissait sans nom (« Non renseigné » : reçus 266, 300, 301 de
-- La Recherche, octobre 2026) ; et rien n'empêchait d'écrire le nom d'un autre.
--
-- Désormais, pour toute écriture faite par un compte connecté :
--   1. la base écrit elle-même le nom du compte RÉELLEMENT connecté
--      (auth.uid()) et garde son identifiant (received_by_id, cancelled_by_id) ;
--      ce que l'écran envoie ne sert que si la base ne trouve aucun nom ;
--   2. une fois écrite, la trace ne change plus (une valeur vide peut être
--      complétée une fois, rien d'autre) ;
--   3. les trois paiements sans nom sont complétés avec le compte qui a émis
--      leur reçu (receipts.issued_by, écrit par la base au moment du reçu).
--
-- Ne touche ni à la règle d'ajout (payments_insert) ni aux index anti-doublon :
-- le chemin d'encaissement reste celui d'aujourd'hui.
-- Les écritures faites sans compte connecté (éditeur SQL, imports) gardent la
-- valeur fournie.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.payments add column if not exists received_by_id  uuid;
alter table public.payments add column if not exists cancelled_by_id uuid;

-- Nom affiché d'un compte : fiche profil, puis nom dans l'école, puis e-mails.
create or replace function public.nom_du_compte(p_uid uuid)
returns text
language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select nullif(btrim(full_name), '') from public.profiles where id = p_uid),
    (select nullif(btrim(display_name), '') from public.school_accounts
      where auth_user_id = p_uid order by is_active desc, created_at desc limit 1),
    (select nullif(btrim(email), '') from public.profiles where id = p_uid),
    (select nullif(btrim(email::text), '') from auth.users where id = p_uid)
  );
$$;

-- Personne ne l'appelle directement : il donnerait le nom de n'importe quel compte.
revoke all on function public.nom_du_compte(uuid) from public, anon, authenticated;


create or replace function public.payments_trace_auteur()
returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if v_uid is not null then
      new.received_by_id := v_uid;
      new.received_by    := coalesce(public.nom_du_compte(v_uid), nullif(btrim(new.received_by), ''));
    end if;
    return new;
  end if;

  -- UPDATE : qui a encaissé ne change plus une fois écrit.
  if old.received_by is not null and btrim(old.received_by) <> '' then
    new.received_by := old.received_by;
  end if;
  if old.received_by_id is not null then
    new.received_by_id := old.received_by_id;
  end if;

  -- Passage à « annulé » : la base écrit qui annule.
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and v_uid is not null then
    new.cancelled_by_id := v_uid;
    new.cancelled_by    := coalesce(public.nom_du_compte(v_uid), nullif(btrim(new.cancelled_by), ''));
  end if;

  -- Qui a annulé, et quand, ne changent plus une fois écrits.
  if old.cancelled_by is not null and btrim(old.cancelled_by) <> '' then
    new.cancelled_by := old.cancelled_by;
  end if;
  if old.cancelled_by_id is not null then
    new.cancelled_by_id := old.cancelled_by_id;
  end if;
  if old.cancelled_at is not null then
    new.cancelled_at := old.cancelled_at;
  end if;
  return new;
end $$;

drop trigger if exists payments_trace_auteur on public.payments;
create trigger payments_trace_auteur
  before insert or update on public.payments
  for each row execute function public.payments_trace_auteur();


-- ── Rattrapage : paiements sans nom, complétés par le compte du reçu ────────
update public.payments p
   set received_by    = public.nom_du_compte(r.issued_by),
       received_by_id = r.issued_by
  from public.receipts r
 where p.receipt_id = r.id
   and r.issued_by is not null
   and (p.received_by is null or btrim(p.received_by) = '')
   and public.nom_du_compte(r.issued_by) is not null;


-- ── Contrôles ──────────────────────────────────────────────────────────────
-- 1. Plus aucun paiement réel sans nom (l'école de test de charge, sans reçu, peut rester) :
--
--   select s.name, count(*) from public.payments p join public.schools s on s.id = p.school_id
--    where p.received_by is null or btrim(p.received_by) = '' group by s.name;
--
-- 2. Le déclencheur est en place :
--
--   select tgname from pg_trigger where tgrelid = 'public.payments'::regclass and not tgisinternal;
--   → notifier_paiement_recu, payments_trace_auteur
