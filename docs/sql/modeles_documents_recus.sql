-- ═══════════════════════════════════════════════════════════════════════════
-- DOCUMENTS → REÇUS — catégorie des modèles
--
-- Un modèle de l'école est soit un DOCUMENT (certificat, convocation…), soit
-- un modèle de REÇU (onglet Documents → Reçus), utilisé à la caisse si le
-- directeur le choisit (réglage `modeleRecu` de l'école). Les modèles déjà
-- enregistrés restent des documents.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.modeles_documents
  add column if not exists categorie text not null default 'document';

alter table public.modeles_documents
  drop constraint if exists modeles_documents_categorie_check;
alter table public.modeles_documents
  add constraint modeles_documents_categorie_check check (categorie in ('document', 'recu'));
