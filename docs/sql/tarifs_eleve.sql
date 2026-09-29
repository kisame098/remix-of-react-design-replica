-- ═══════════════════════════════════════════════════════════════════════════
-- TARIF PERSONNALISÉ D'UN ÉLÈVE (réductions, bourses, cas particuliers)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
-- • student_fee_adjustments : pour un élève et une année, ce qu'il paie sur
--   un frais précis (inscription, un mois, un service) : réduction en %, en
--   francs, ou montant fixe, avec un MOTIF. Calcul : src/lib/tarifsEleve.ts.
-- • student_fee_adjustments_journal : trace de chaque ajout, modification et
--   retrait (qui, quand, quoi). Une réduction, c'est de l'argent en moins
--   pour l'école : le directeur doit pouvoir savoir qui l'a accordée.
-- • Écriture UNIQUEMENT par les fonctions appliquer_tarifs_eleve et
--   retirer_tarifs_eleve : directeur, ou personnel ayant la permission
--   « reductions ». Aucune écriture directe sur les tables.
-- • Lecture : le personnel de l'école, et l'élève pour lui-même (portail).
-- Rien ne touche aux paiements déjà enregistrés.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Qui peut accorder une réduction ────────────────────────────────────────
create or replace function public.can_manage_reductions()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.school_members
    where user_id = auth.uid() and is_active = true
      and (role = 'admin_school' or 'reductions' = any(permissions))
  );
$$;

-- ─── Tarifs personnalisés ───────────────────────────────────────────────────
create table if not exists public.student_fee_adjustments (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  academic_year_label   text not null,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  element_type          text not null check (element_type in ('inscription', 'tuition', 'service')),
  month_key             text check (month_key is null or month_key ~ '^\d{4}-\d{2}$'),
  service_id            uuid references public.annex_services(id) on delete cascade,
  mode                  text not null check (mode in ('pourcentage', 'reduction', 'montant')),
  valeur                integer not null check (valeur >= 0),
  motif                 text not null check (length(btrim(motif)) >= 3),
  granted_by            uuid default auth.uid(),
  granted_by_name       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (mode <> 'pourcentage' or (valeur between 1 and 100)),
  check (mode <> 'reduction' or valeur > 0),
  check (element_type <> 'inscription' or (month_key is null and service_id is null)),
  check (element_type <> 'tuition' or (month_key is not null and service_id is null)),
  check (element_type <> 'service' or service_id is not null)
);

-- Un seul tarif personnalisé par élève et par frais.
create unique index if not exists student_fee_adjustments_unique on public.student_fee_adjustments
  (school_id, academic_year_label, student_enrollment_id, element_type,
   coalesce(month_key, ''), coalesce(service_id::text, ''));
create index if not exists student_fee_adjustments_eleve on public.student_fee_adjustments (student_enrollment_id);

alter table public.student_fee_adjustments enable row level security;
drop policy if exists "tarifs eleve : lecture" on public.student_fee_adjustments;
create policy "tarifs eleve : lecture" on public.student_fee_adjustments for select
  using (school_id = get_my_school_id() or student_enrollment_id = get_my_student_enrollment_id());

-- ─── Journal ────────────────────────────────────────────────────────────────
create table if not exists public.student_fee_adjustments_journal (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  academic_year_label   text not null,
  student_enrollment_id uuid not null,
  action                text not null check (action in ('ajout', 'modification', 'retrait')),
  element_type          text not null,
  month_key             text,
  service_id            uuid,
  mode                  text,
  valeur                integer,
  motif                 text,
  par                   uuid default auth.uid(),
  par_nom               text,
  le                    timestamptz not null default now()
);
create index if not exists student_fee_adjustments_journal_ecole on public.student_fee_adjustments_journal (school_id, le desc);

alter table public.student_fee_adjustments_journal enable row level security;
drop policy if exists "tarifs eleve journal : lecture" on public.student_fee_adjustments_journal;
create policy "tarifs eleve journal : lecture" on public.student_fee_adjustments_journal for select
  using (school_id = get_my_school_id() and can_manage_reductions());

-- ─── Accorder / modifier ────────────────────────────────────────────────────
-- p_lignes : [{ "type": "tuition", "month_key": "2026-10", "service_id": null,
--              "mode": "pourcentage", "valeur": 50, "motif": "Enfant du personnel" }, …]
create or replace function public.appliquer_tarifs_eleve(p_eleve uuid, p_lignes jsonb)
returns setof public.student_fee_adjustments
language plpgsql security definer set search_path to 'public' as $$
declare
  v_school uuid := get_my_school_id();
  v_annee  text;
  v_nom    text;
  l        jsonb;
  v_type   text;
  v_mois   text;
  v_svc    uuid;
  v_mode   text;
  v_valeur integer;
  v_motif  text;
  v_ancien public.student_fee_adjustments;
  v_ligne  public.student_fee_adjustments;
begin
  if v_school is null or not can_manage_reductions() then
    raise exception 'Non autorisé : réservé au directeur ou au personnel autorisé';
  end if;
  select academic_year_label into v_annee from public.student_enrollments
   where id = p_eleve and school_id = v_school;
  if v_annee is null then raise exception 'Élève introuvable'; end if;
  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0
     or jsonb_array_length(p_lignes) > 60 then
    raise exception 'Liste de frais invalide';
  end if;
  select coalesce(nullif(btrim(full_name), ''), email) into v_nom from public.profiles where id = auth.uid();

  for l in select * from jsonb_array_elements(p_lignes) loop
    v_type   := l->>'type';
    v_mois   := nullif(l->>'month_key', '');
    v_svc    := nullif(l->>'service_id', '')::uuid;
    v_mode   := l->>'mode';
    v_valeur := (l->>'valeur')::integer;
    v_motif  := btrim(coalesce(l->>'motif', ''));
    if v_svc is not null and not exists (select 1 from public.annex_services where id = v_svc and school_id = v_school) then
      raise exception 'Service introuvable';
    end if;

    select * into v_ancien from public.student_fee_adjustments
     where school_id = v_school and academic_year_label = v_annee and student_enrollment_id = p_eleve
       and element_type = v_type and coalesce(month_key, '') = coalesce(v_mois, '')
       and coalesce(service_id::text, '') = coalesce(v_svc::text, '');

    if v_ancien.id is null then
      insert into public.student_fee_adjustments
        (school_id, academic_year_label, student_enrollment_id, element_type, month_key, service_id,
         mode, valeur, motif, granted_by_name)
      values (v_school, v_annee, p_eleve, v_type, v_mois, v_svc, v_mode, v_valeur, v_motif, v_nom)
      returning * into v_ligne;
    else
      update public.student_fee_adjustments
         set mode = v_mode, valeur = v_valeur, motif = v_motif,
             granted_by = auth.uid(), granted_by_name = v_nom, updated_at = now()
       where id = v_ancien.id
      returning * into v_ligne;
    end if;

    insert into public.student_fee_adjustments_journal
      (school_id, academic_year_label, student_enrollment_id, action, element_type, month_key, service_id,
       mode, valeur, motif, par_nom)
    values (v_school, v_annee, p_eleve, case when v_ancien.id is null then 'ajout' else 'modification' end,
            v_type, v_mois, v_svc, v_mode, v_valeur, v_motif, v_nom);

    return next v_ligne;
    v_ancien := null;
  end loop;
end $$;

-- ─── Retirer (l'élève repaie le tarif normal) ───────────────────────────────
create or replace function public.retirer_tarifs_eleve(p_ids uuid[])
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_school uuid := get_my_school_id();
  v_nom    text;
  v_n      integer;
begin
  if v_school is null or not can_manage_reductions() then
    raise exception 'Non autorisé : réservé au directeur ou au personnel autorisé';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 200 then
    raise exception 'Liste invalide';
  end if;
  select coalesce(nullif(btrim(full_name), ''), email) into v_nom from public.profiles where id = auth.uid();

  insert into public.student_fee_adjustments_journal
    (school_id, academic_year_label, student_enrollment_id, action, element_type, month_key, service_id,
     mode, valeur, motif, par_nom)
  select school_id, academic_year_label, student_enrollment_id, 'retrait', element_type, month_key, service_id,
         mode, valeur, motif, v_nom
    from public.student_fee_adjustments
   where id = any(p_ids) and school_id = v_school;

  delete from public.student_fee_adjustments where id = any(p_ids) and school_id = v_school;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.appliquer_tarifs_eleve(uuid, jsonb) from public, anon;
revoke all on function public.retirer_tarifs_eleve(uuid[]) from public, anon;
grant execute on function public.appliquer_tarifs_eleve(uuid, jsonb) to authenticated;
grant execute on function public.retirer_tarifs_eleve(uuid[]) to authenticated;
