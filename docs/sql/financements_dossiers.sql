-- ═══════════════════════════════════════════════════════════════════════════
-- FINANCEMENTS (3FPT…) — Dossiers des apprenants financés (étape 1)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
-- Les ORGANISMES (nom, part financée, tranches, frais concernés, pièces
-- exigées) sont des réglages de l'école : ils vivent dans
-- schools.settings.financements (src/lib/financements.ts), pas ici.
--
-- Un DOSSIER = un apprenant pour une année (son inscription,
-- student_enrollments) pris en charge par UN organisme : contrat, lettre
-- d'engagement, pièces, statut, situation (abandon, exclusion…).
--
-- Les FICHIERS (contrat signé, lettre, pièces scannées) vont dans le bucket
-- privé « financements », rangés par école : <school_id>/<dossier>/<fichier>.
-- Personne d'une autre école ne peut les lire, ni un élève depuis son portail.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.fin_dossiers (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  -- Identifiant de l'organisme dans schools.settings.financements.
  organisme_id          text not null,
  statut                text not null default 'en_attente'
                        check (statut in ('en_attente', 'complet', 'valide', 'a_regulariser')),
  contrat_numero        text,
  contrat_date          date,
  contrat_signe         boolean not null default false,
  contrat_fichier       text,
  engagement_date       date,
  engagement_signe      boolean not null default false,
  engagement_fichier    text,
  situation             text not null default 'en_formation'
                        check (situation in ('en_formation', 'abandon', 'exclusion', 'changement', 'terminee')),
  situation_date        date,
  situation_motif       text,
  note                  text,
  -- Réductions posées sur les frais de l'apprenant (student_fee_adjustments) :
  -- retirées si le financement est désactivé avant que les frais soient payés.
  ajustement_ids        uuid[] not null default '{}',
  -- Une entrée par pièce exigée : { piece_id, fournie, conforme, fichier, commentaire }.
  pieces                jsonb not null default '[]'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Un apprenant n'a qu'un financement par inscription.
  unique (student_enrollment_id)
);
create index if not exists fin_dossiers_ecole_idx on public.fin_dossiers (school_id);

alter table public.fin_dossiers enable row level security;

-- Le personnel de l'école seulement : get_my_school_id() est vide pour un élève
-- connecté à son portail.
do $$
begin
  execute 'drop policy if exists "fin_dossiers: staff select" on public.fin_dossiers';
  execute 'create policy "fin_dossiers: staff select" on public.fin_dossiers for select using (school_id = get_my_school_id())';
  execute 'drop policy if exists "fin_dossiers: staff insert" on public.fin_dossiers';
  execute 'create policy "fin_dossiers: staff insert" on public.fin_dossiers for insert with check (school_id = get_my_school_id())';
  execute 'drop policy if exists "fin_dossiers: staff update" on public.fin_dossiers';
  execute 'create policy "fin_dossiers: staff update" on public.fin_dossiers for update using (school_id = get_my_school_id()) with check (school_id = get_my_school_id())';
  execute 'drop policy if exists "fin_dossiers: staff delete" on public.fin_dossiers';
  execute 'create policy "fin_dossiers: staff delete" on public.fin_dossiers for delete using (school_id = get_my_school_id())';
end $$;

-- ─── Fichiers : bucket privé, un dossier par école ──────────────────────────
-- 10 Mo par fichier : un contrat scanné en PDF tient largement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('financements', 'financements', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
              'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare op text;
begin
  foreach op in array array['select', 'insert', 'update', 'delete']
  loop
    execute format('drop policy if exists "financements: staff %1$s" on storage.objects', op);
    if op = 'insert' then
      execute 'create policy "financements: staff insert" on storage.objects for insert to authenticated
        with check (bucket_id = ''financements'' and (storage.foldername(name))[1] = get_my_school_id()::text)';
    elsif op = 'update' then
      execute 'create policy "financements: staff update" on storage.objects for update to authenticated
        using (bucket_id = ''financements'' and (storage.foldername(name))[1] = get_my_school_id()::text)
        with check (bucket_id = ''financements'' and (storage.foldername(name))[1] = get_my_school_id()::text)';
    else
      execute format('create policy "financements: staff %1$s" on storage.objects for %1$s to authenticated
        using (bucket_id = ''financements'' and (storage.foldername(name))[1] = get_my_school_id()::text)', op);
    end if;
  end loop;
end $$;
