-- ═══════════════════════════════════════════════════════════════════════════
-- REÇUS DE PAIEMENT — numéro unique et séquentiel par école et par année
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
-- Principes :
--
--   • Un reçu couvre UN ENCAISSEMENT, pas une ligne de paiement : inscription +
--     trois mois payés d'un coup = un seul reçu, avec quatre lignes.
--
--   • Le numéro est attribué APRÈS l'encaissement, par une fonction séparée. Le
--     chemin d'encaissement existant (insertion dans `payments`, règle RLS
--     `payments_insert`) n'est PAS touché : un bug dans les reçus ne peut jamais
--     empêcher un caissier d'encaisser. Un paiement resté sans reçu (coupure
--     entre les deux appels) se rattrape depuis l'historique.
--
--   • Numérotation sans trou dans le cas normal : séquentielle par (école,
--     année), sous verrou. Les paiements antérieurs à ce système n'ont pas de
--     reçu ; il leur en est attribué un à la demande, avec le prochain numéro.
--
--   • Un reçu ne se supprime ni ne se modifie : aucune politique d'écriture.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.receipts (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  academic_year_label   text not null,
  number                integer not null check (number > 0),
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  issued_by             uuid,
  created_at            timestamptz not null default now(),
  unique (school_id, academic_year_label, number)
);

create index if not exists receipts_student_idx on public.receipts (student_enrollment_id);

alter table public.receipts enable row level security;

-- Le personnel de l'école lit les reçus de l'école ; un élève lit les siens
-- (sans contrôle d'abonnement, comme pour ses paiements : la famille n'est
-- jamais pénalisée par l'impayé de l'établissement).
drop policy if exists "recus: lecture (école ou élève)" on public.receipts;
create policy "recus: lecture (école ou élève)" on public.receipts
  for select
  using (school_id = get_my_school_id() or student_enrollment_id = get_my_student_enrollment_id());

-- Aucune politique d'insertion, de modification ni de suppression : tout passe
-- par issue_receipt ci-dessous.

alter table public.payments
  add column if not exists receipt_id uuid references public.receipts(id) on delete set null;

create index if not exists payments_receipt_idx on public.payments (receipt_id);


-- Attribue un reçu aux paiements donnés (tous du même élève, de la même année).
--   • aucun paiement encore rattaché → crée le reçu, prochain numéro ;
--   • tous déjà rattachés au MÊME reçu → renvoie ce reçu (idempotent : rappeler
--     la fonction après une coupure ne crée pas de second reçu) ;
--   • tout mélange → refusé.
create or replace function public.issue_receipt(p_payment_ids uuid[])
returns public.receipts
language plpgsql security definer set search_path = public as $$
declare
  v_school   uuid := get_my_school_id();
  v_ids      uuid[];
  v_found    integer;
  v_students integer;
  v_years    integer;
  v_year     text;
  v_student  uuid;
  v_nulls    integer;
  v_recus    integer;
  v_annules  integer;
  v_autres   integer;
  v_recu     public.receipts;
  v_numero   integer;
begin
  if v_school is null or not can_manage_payments() then
    raise exception 'Non autorisé';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_payment_ids) as x;
  if v_ids is null or cardinality(v_ids) = 0 or cardinality(v_ids) > 60 then
    raise exception 'Liste de paiements invalide';
  end if;

  -- Un seul reçu à la fois par école : la numérotation reste séquentielle même
  -- si deux caissiers valident au même instant.
  perform pg_advisory_xact_lock(hashtext('recu:' || v_school::text));

  select count(*),
         count(distinct student_enrollment_id),
         count(distinct academic_year_label),
         min(academic_year_label),
         (array_agg(student_enrollment_id))[1],
         count(*) filter (where receipt_id is null),
         count(distinct receipt_id),
         count(*) filter (where status = 'cancelled'),
         count(*) filter (where school_id <> v_school)
    into v_found, v_students, v_years, v_year, v_student, v_nulls, v_recus, v_annules, v_autres
    from public.payments
   where id = any(v_ids);

  if v_found <> cardinality(v_ids) or v_autres > 0 then
    raise exception 'Paiement introuvable';
  end if;
  if v_students <> 1 or v_years <> 1 then
    raise exception 'Un reçu ne couvre qu''un seul élève et une seule année';
  end if;

  -- Déjà tous rattachés au même reçu : on le renvoie tel quel.
  if v_nulls = 0 and v_recus = 1 then
    select r.* into v_recu from public.receipts r
     where r.id = (select receipt_id from public.payments where id = v_ids[1]);
    return v_recu;
  end if;
  if v_nulls <> cardinality(v_ids) then
    raise exception 'Ces paiements appartiennent déjà à des reçus différents';
  end if;
  -- Un paiement annulé n'a pas à recevoir de numéro : il fausserait la suite.
  if v_annules > 0 then
    raise exception 'Paiement annulé : aucun reçu à émettre';
  end if;

  select coalesce(max(number), 0) + 1 into v_numero
    from public.receipts
   where school_id = v_school and academic_year_label = v_year;

  insert into public.receipts (school_id, academic_year_label, number, student_enrollment_id, issued_by)
  values (v_school, v_year, v_numero, v_student, auth.uid())
  returning * into v_recu;

  update public.payments set receipt_id = v_recu.id where id = any(v_ids);

  return v_recu;
end $$;

revoke all on function public.issue_receipt(uuid[]) from public, anon;
grant execute on function public.issue_receipt(uuid[]) to authenticated;
