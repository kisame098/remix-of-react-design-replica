-- ═══════════════════════════════════════════════════════════════════════════
-- DOCUMENTS — modèles HTML des écoles (mode classique)
--
-- Une école enregistre ses propres modèles de documents (certificat de
-- scolarité, attestation…) en HTML, avec des champs entre crochets que
-- SenClass remplit pour chaque élève. Les modèles fournis par SenClass ne sont
-- PAS ici : ils sont livrés avec l'application (src/lib/modelesDocumentsParDefaut.ts).
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
  -- 1 Mo au plus (même limite que l'application) : de quoi intégrer un cachet en image.
  html        text not null check (length(html) between 1 and 1000000),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
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
