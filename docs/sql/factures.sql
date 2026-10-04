-- ═══════════════════════════════════════════════════════════════════════════
-- FACTURATION — factures et rappels remis aux familles
--
-- Une facture dit à une famille ce qu'elle doit, et avant quelle date. Elle est
-- NUMÉROTÉE (FAC-2026-00001, RAP-2026-00001 pour un rappel) et ENREGISTRÉE :
--   • on la réimprime à l'identique (duplicata) ;
--   • on sait, ligne par ligne, ce qui a été payé depuis (suivi) ;
--   • un rappel cite la facture d'origine et sa date limite dépassée.
--
-- Les lignes sont figées au moment de l'émission (instantané en jsonb) : un
-- tarif modifié plus tard ne réécrit pas une facture déjà remise. Le reste à
-- payer « aujourd'hui » se recalcule côté application, à partir des paiements.
--
-- Une facture ne s'efface pas (pas de policy DELETE) : c'est une pièce remise.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.factures (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  academic_year_label   text not null,
  type                  text not null check (type in ('facture', 'rappel')),
  number                integer not null check (number > 0),
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  facture_origine_id    uuid references public.factures(id) on delete set null,
  date_limite           date not null,
  -- [{ cle, designation, montant, deja_verse, reste, en_retard }]
  lignes                jsonb not null check (jsonb_typeof(lignes) = 'array'),
  total                 integer not null check (total > 0),
  issued_by             uuid,
  created_at            timestamptz not null default now(),
  unique (school_id, academic_year_label, type, number)
);

create index if not exists factures_eleve_idx on public.factures (student_enrollment_id);
create index if not exists factures_ecole_annee_idx on public.factures (school_id, academic_year_label);

alter table public.factures enable row level security;

-- Lecture : l'école, ou l'élève pour SES factures. Écriture : uniquement par
-- emettre_factures (numérotation sous verrou).
drop policy if exists "factures: lecture (école ou élève)" on public.factures;
create policy "factures: lecture (école ou élève)" on public.factures
  for select
  using (school_id = get_my_school_id() or student_enrollment_id = get_my_student_enrollment_id());

revoke insert, update, delete, truncate on public.factures from anon, authenticated;

-- ── Émission par lot ─────────────────────────────────────────────────────────
-- p_factures : [{ enrollment_id, lignes, total, facture_origine_id? }]
-- Renvoie les factures créées, dans l'ordre reçu, numérotées à la suite.
create or replace function public.emettre_factures(
  p_annee text, p_type text, p_date_limite date, p_factures jsonb
)
returns setof public.factures
language plpgsql security definer set search_path = public as $$
declare
  v_school  uuid := get_my_school_id();
  v_numero  integer;
  v_f       jsonb;
  v_ligne   public.factures;
  v_total   integer;
  v_eleve   uuid;
  v_origine uuid;
begin
  if v_school is null or not can_manage_payments() then
    raise exception 'Non autorisé';
  end if;
  if p_type not in ('facture', 'rappel') then raise exception 'Type de facture inconnu'; end if;
  if p_date_limite is null then raise exception 'Date limite obligatoire'; end if;
  if jsonb_typeof(p_factures) <> 'array' or jsonb_array_length(p_factures) = 0
     or jsonb_array_length(p_factures) > 2000 then
    raise exception 'Liste de factures invalide';
  end if;

  -- Une émission à la fois par école : les numéros restent consécutifs.
  perform pg_advisory_xact_lock(hashtext('facture:' || v_school::text));

  select coalesce(max(number), 0) into v_numero
    from public.factures
   where school_id = v_school and academic_year_label = p_annee and type = p_type;

  for v_f in select * from jsonb_array_elements(p_factures) loop
    v_eleve := (v_f->>'enrollment_id')::uuid;
    v_total := (v_f->>'total')::integer;
    v_origine := nullif(v_f->>'facture_origine_id', '')::uuid;

    if not exists (select 1 from public.student_enrollments
                    where id = v_eleve and school_id = v_school) then
      raise exception 'Élève introuvable';
    end if;
    if v_total is null or v_total <= 0 then raise exception 'Montant de facture invalide'; end if;
    if jsonb_typeof(v_f->'lignes') <> 'array' or jsonb_array_length(v_f->'lignes') = 0 then
      raise exception 'Facture sans ligne';
    end if;
    -- Un rappel cite une facture de la même école et du même élève.
    if p_type = 'rappel' and not exists (
      select 1 from public.factures
       where id = v_origine and school_id = v_school and student_enrollment_id = v_eleve
    ) then
      raise exception 'Facture d''origine introuvable';
    end if;

    v_numero := v_numero + 1;
    insert into public.factures (
      school_id, academic_year_label, type, number, student_enrollment_id,
      facture_origine_id, date_limite, lignes, total, issued_by
    ) values (
      v_school, p_annee, p_type, v_numero, v_eleve,
      case when p_type = 'rappel' then v_origine end, p_date_limite, v_f->'lignes', v_total, auth.uid()
    ) returning * into v_ligne;
    return next v_ligne;
  end loop;
end $$;

revoke all on function public.emettre_factures(text, text, date, jsonb) from public, anon;
grant execute on function public.emettre_factures(text, text, date, jsonb) to authenticated;

-- ── Contrôle ───────────────────────────────────────────────────────────────
--   select count(*) from public.factures;
