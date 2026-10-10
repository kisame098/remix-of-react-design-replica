-- ═══════════════════════════════════════════════════════════════════════════
-- DOCUMENTS DÉLIVRÉS — numérotation et registre (rubrique Documents)
--
-- Un modèle qui contient le champ {NUMÉRO DU DOCUMENT} reçoit, à l'impression
-- ou au téléchargement (jamais à l'aperçu), un numéro attribué par la base :
--   CS-2026-00001  =  préfixe du modèle - année de début de l'année scolaire -
--                     compteur sur 5 chiffres, propre à l'école, à l'année et
--                     au préfixe (même logique que les reçus REC-…).
--
-- Chaque document délivré est inscrit au registre avec son contenu exact :
-- on peut vérifier un certificat présenté (numéro, personne, date) et le
-- réimprimer à l'identique. Un document délivré ne s'efface pas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Qui peut délivrer : le directeur, ou le personnel « Élèves » ───────────
create or replace function public.peut_delivrer_documents()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.school_members
    where user_id = auth.uid() and is_active = true
      and (role = 'admin_school' or 'students' = any(permissions))
  );
$$;

create table if not exists public.documents_delivres (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  academic_year_label text not null,
  prefixe             text not null check (prefixe ~ '^[A-Z]{1,6}$'),
  numero_seq          integer not null check (numero_seq > 0),
  numero              text not null,
  modele_nom          text not null,
  -- « senclass:certificat-scolarite » pour un modèle fourni, sinon l'id du modèle de l'école.
  modele_ref          text not null,
  personne_type       text not null check (personne_type in ('eleve', 'professeur', 'aucune')),
  personne_id         uuid,
  personne_nom        text not null default '',
  -- Le document tel qu'il a été délivré (HTML nettoyé), pour la réimpression à l'identique.
  contenu_html        text check (contenu_html is null or length(contenu_html) <= 3000000),
  delivre_par         uuid,
  created_at          timestamptz not null default now(),
  unique (school_id, academic_year_label, prefixe, numero_seq)
);

create index if not exists documents_delivres_ecole_idx on public.documents_delivres (school_id, created_at desc);
create index if not exists documents_delivres_numero_idx on public.documents_delivres (school_id, numero);

alter table public.documents_delivres enable row level security;

drop policy if exists "documents_delivres: lecture école" on public.documents_delivres;
create policy "documents_delivres: lecture école" on public.documents_delivres
  for select using (school_id = get_my_school_id());

-- Écriture du contenu, une seule fois, juste après la délivrance.
drop policy if exists "documents_delivres: contenu une fois" on public.documents_delivres;
create policy "documents_delivres: contenu une fois" on public.documents_delivres
  for update using (school_id = get_my_school_id() and contenu_html is null and peut_delivrer_documents())
  with check (school_id = get_my_school_id());
-- Aucune politique d'insertion (seulement par delivrer_documents) ni de suppression.

-- Rien d'autre que le contenu ne change, et seulement s'il était vide.
create or replace function public.documents_delivres_figer()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.contenu_html is not null
     or new.id <> old.id or new.school_id <> old.school_id or new.academic_year_label <> old.academic_year_label
     or new.prefixe <> old.prefixe or new.numero_seq <> old.numero_seq or new.numero <> old.numero
     or new.modele_nom <> old.modele_nom or new.modele_ref <> old.modele_ref
     or new.personne_type <> old.personne_type or new.personne_id is distinct from old.personne_id
     or new.personne_nom <> old.personne_nom or new.delivre_par is distinct from old.delivre_par
     or new.created_at <> old.created_at then
    raise exception 'Un document délivré ne se modifie pas';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_delivres_figer on public.documents_delivres;
create trigger documents_delivres_figer
  before update on public.documents_delivres
  for each row execute function public.documents_delivres_figer();

-- ─── Délivrer : un numéro par personne, sous verrou ─────────────────────────
-- p_personnes : [{ "id": uuid|null, "nom": "DIOP Awa" }, …] (un élément sans
-- id pour un document qui ne concerne personne en particulier).
create or replace function public.delivrer_documents(
  p_annee text, p_prefixe text, p_modele_nom text, p_modele_ref text, p_personne_type text, p_personnes jsonb
) returns setof public.documents_delivres
language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := get_my_school_id();
  v_nombre integer;
  v_dernier integer;
  v_an text;
begin
  if v_school is null or not peut_delivrer_documents() then
    raise exception 'Non autorisé';
  end if;
  if p_prefixe !~ '^[A-Z]{1,6}$' then
    raise exception 'Préfixe invalide';
  end if;
  v_an := substring(p_annee from '^\d{4}');
  if v_an is null then
    raise exception 'Année scolaire invalide';
  end if;
  if p_personne_type not in ('eleve', 'professeur', 'aucune') then
    raise exception 'Type de document invalide';
  end if;
  v_nombre := jsonb_array_length(p_personnes);
  if v_nombre < 1 or v_nombre > 300 then
    raise exception 'Nombre de documents invalide';
  end if;

  -- Une seule délivrance à la fois par école, année et préfixe : jamais deux fois le même numéro.
  perform pg_advisory_xact_lock(hashtext('documents:' || v_school::text || ':' || p_annee || ':' || p_prefixe));

  select coalesce(max(numero_seq), 0) into v_dernier
    from public.documents_delivres
   where school_id = v_school and academic_year_label = p_annee and prefixe = p_prefixe;

  return query
  insert into public.documents_delivres (
    school_id, academic_year_label, prefixe, numero_seq, numero, modele_nom, modele_ref,
    personne_type, personne_id, personne_nom, delivre_par
  )
  select v_school, p_annee, p_prefixe, v_dernier + p.ordre,
         p_prefixe || '-' || v_an || '-' || lpad((v_dernier + p.ordre)::text, 5, '0'),
         left(p_modele_nom, 200), left(p_modele_ref, 100), p_personne_type,
         nullif(p.valeur->>'id', '')::uuid, left(coalesce(p.valeur->>'nom', ''), 200), auth.uid()
    from jsonb_array_elements(p_personnes) with ordinality as p(valeur, ordre)
  returning *;
end;
$$;

revoke all on function public.delivrer_documents(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.delivrer_documents(text, text, text, text, text, jsonb) to authenticated;
