-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — Documents officiels numérotés (étape 6)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après formation_pro_stages.sql).
--
-- Bulletins, convocations et attestations de stage se fabriquent à la
-- demande (rien à stocker). Seuls les documents OFFICIELS sont numérotés et
-- archivés : attestation d'inscription, attestation de réussite, diplôme.
--
--   • Le numéro repart à 1 chaque année civile, par type de document
--     (même principe que les reçus) : INS-2026-00001, REU-2026-00001…
--   • Le contenu est FIGÉ à l'émission (contenu jsonb) : réimprimer donne
--     exactement le même document, même si un nom change ensuite.
--   • Un document émis ne se modifie ni ne se supprime : aucune politique
--     d'écriture, tout passe par fp_emettre_document.
--   • Attestation de réussite et diplôme : directeur seulement.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.fp_documents_officiels (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  type                  text not null check (type in ('attestation_inscription', 'attestation_reussite', 'diplome')),
  annee                 integer not null,
  numero                integer not null check (numero > 0),
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  promotion_id          uuid references public.fp_promotions(id) on delete set null,
  examen_id             uuid references public.fp_examens(id) on delete set null,
  contenu               jsonb not null,
  emis_par              uuid,
  emis_le               timestamptz not null default now(),
  unique (school_id, type, annee, numero)
);
create index if not exists fp_documents_officiels_eleve_idx on public.fp_documents_officiels (student_enrollment_id);

alter table public.fp_documents_officiels enable row level security;

drop policy if exists "fp_documents_officiels: lecture école" on public.fp_documents_officiels;
create policy "fp_documents_officiels: lecture école" on public.fp_documents_officiels
  for select using (school_id = get_my_school_id());
-- Aucune politique d'insertion, de modification ni de suppression.

create or replace function public.fp_emettre_document(
  p_type text, p_student_enrollment_id uuid, p_promotion_id uuid, p_examen_id uuid, p_contenu jsonb
) returns public.fp_documents_officiels
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := get_my_school_id();
  v_annee  integer := extract(year from (now() at time zone 'Africa/Dakar'))::integer;
  v_numero integer;
  v_doc    public.fp_documents_officiels;
begin
  if v_school is null then
    raise exception 'Non autorisé';
  end if;
  if p_type in ('attestation_reussite', 'diplome') and not is_school_admin() then
    raise exception 'Seul le directeur peut émettre une attestation de réussite ou un diplôme.';
  end if;
  -- L'élève doit appartenir à l'école.
  if not exists (select 1 from public.student_enrollments e where e.id = p_student_enrollment_id and e.school_id = v_school) then
    raise exception 'Élève introuvable';
  end if;
  -- Réussite et diplôme : seulement pour un candidat ADMIS d'un examen VERROUILLÉ de l'école.
  if p_type in ('attestation_reussite', 'diplome') and not exists (
    select 1 from public.fp_examens x
      join public.fp_examen_resultats r on r.examen_id = x.id
     where x.id = p_examen_id and x.school_id = v_school and x.verrouille
       and r.student_enrollment_id = p_student_enrollment_id and r.decision = 'admis'
  ) then
    raise exception 'Réservé à un candidat admis, une fois l''examen verrouillé.';
  end if;

  -- Un document à la fois par école et par type : numérotation sans trou ni doublon.
  perform pg_advisory_xact_lock(hashtext('fp_document:' || v_school::text || ':' || p_type));
  select coalesce(max(numero), 0) + 1 into v_numero
    from public.fp_documents_officiels
   where school_id = v_school and type = p_type and annee = v_annee;

  insert into public.fp_documents_officiels (school_id, type, annee, numero, student_enrollment_id, promotion_id, examen_id, contenu, emis_par)
  values (v_school, p_type, v_annee, v_numero, p_student_enrollment_id, p_promotion_id, p_examen_id, p_contenu, auth.uid())
  returning * into v_doc;
  return v_doc;
end $$;

revoke all on function public.fp_emettre_document(text, uuid, uuid, uuid, jsonb) from public, anon;
grant execute on function public.fp_emettre_document(text, uuid, uuid, uuid, jsonb) to authenticated;
