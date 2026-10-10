-- ═══════════════════════════════════════════════════════════════════════════
-- DOCUMENTS — modèles de documents des écoles (mode classique)
--
-- Une école enregistre ses propres modèles de documents (certificat de
-- scolarité, attestation…) : page créée dans l'éditeur visuel, fichier Word
-- ou HTML, avec des champs entre accolades que SenClass remplit pour chaque
-- élève. Les modèles fournis par SenClass ne sont PAS ici : ils sont livrés
-- avec l'application (src/lib/modelesDocumentsParDefaut.ts).
--
-- Les documents produits ne sont pas enregistrés (ni numérotés) : seul le
-- modèle l'est.
--
-- Droits : tout le personnel de l'école LIT les modèles (pour produire les
-- documents) ; seul le directeur les crée, les modifie ou les supprime.
--
-- La vérification des champs (aucun champ inconnu de SenClass) est faite par
-- l'application, à l'enregistrement ET à chaque impression : le catalogue des
-- champs vit dans le code (src/lib/modelesDocuments.ts).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.modeles_documents (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  nom         text not null check (length(btrim(nom)) between 1 and 120),
  -- visuel : page de l'éditeur (contenu) ; html : HTML écrit ou importé (html) ;
  -- word : fichier .docx gardé tel quel, en base64 (fichier).
  genre       text not null default 'visuel' check (genre in ('visuel', 'html', 'word')),
  contenu     jsonb,
  html        text check (html is null or length(html) between 1 and 1000000),
  -- 5 Mo de Word ≈ 7 millions de caractères en base64.
  fichier     text check (fichier is null or length(fichier) between 1 and 7000000),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Chaque genre a SA donnée, et rien d'autre.
  check (
    (genre = 'visuel' and contenu is not null and html is null and fichier is null)
    or (genre = 'html' and html is not null and contenu is null and fichier is null)
    or (genre = 'word' and fichier is not null and contenu is null and html is null)
  ),
  -- Une page de l'éditeur (images comprises) reste raisonnable : 3 Mo.
  check (contenu is null or pg_column_size(contenu) <= 3000000)
);

create index if not exists modeles_documents_ecole_idx on public.modeles_documents (school_id);

alter table public.modeles_documents enable row level security;

drop policy if exists "modeles_documents: lecture école" on public.modeles_documents;
create policy "modeles_documents: lecture école" on public.modeles_documents
  for select using (school_id = get_my_school_id());

drop policy if exists "modeles_documents: création directeur" on public.modeles_documents;
create policy "modeles_documents: création directeur" on public.modeles_documents
  for insert with check (school_id = get_my_school_id() and is_school_admin());

drop policy if exists "modeles_documents: modification directeur" on public.modeles_documents;
create policy "modeles_documents: modification directeur" on public.modeles_documents
  for update using (school_id = get_my_school_id() and is_school_admin())
  with check (school_id = get_my_school_id() and is_school_admin());

drop policy if exists "modeles_documents: suppression directeur" on public.modeles_documents;
create policy "modeles_documents: suppression directeur" on public.modeles_documents
  for delete using (school_id = get_my_school_id() and is_school_admin());

-- Date de modification tenue par la base, pas par le navigateur.
create or replace function public.modeles_documents_horodater()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists modeles_documents_horodater on public.modeles_documents;
create trigger modeles_documents_horodater
  before update on public.modeles_documents
  for each row execute function public.modeles_documents_horodater();
