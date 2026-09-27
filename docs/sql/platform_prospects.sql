-- ═══════════════════════════════════════════════════════════════════════════
-- CHEF DU SYSTÈME — Prospects et e-mails commerciaux
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après platform_admin.sql).
--
-- Tout est réservé au chef du système (get_is_platform_admin()) : aucune
-- école, aucun élève n'y a accès.
--   • platform_prospects        : les écoles à démarcher (statut, relance…) ;
--   • platform_echanges         : l'historique (e-mail, appel, WhatsApp, rendez-vous,
--                                 note), rattaché à un prospect OU à une école cliente ;
--   • platform_modeles_email    : les modèles de messages, modifiables.
-- Les e-mails partent par la fonction `envoyer-email` (Resend, depuis
-- contact@senclass.com) ; la clé Resend vit dans les secrets des fonctions,
-- jamais dans une table.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_prospects (
  id           uuid primary key default gen_random_uuid(),
  ecole        text not null,
  responsable  text,
  telephone    text,
  email        text,
  ville        text,
  source       text,
  statut       text not null default 'nouveau'
               check (statut in ('nouveau', 'contacte', 'demo', 'interesse', 'client', 'perdu')),
  relance_le   date,
  notes        text,
  -- Devenu client : l'école inscrite sur SenClass.
  school_id    uuid references public.schools(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists platform_prospects_statut_idx on public.platform_prospects (statut);
create index if not exists platform_prospects_relance_idx on public.platform_prospects (relance_le);

create table if not exists public.platform_echanges (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid references public.platform_prospects(id) on delete cascade,
  school_id    uuid references public.schools(id) on delete cascade,
  type         text not null check (type in ('email', 'appel', 'whatsapp', 'rendez_vous', 'note')),
  objet        text,
  contenu      text,
  destinataire text,
  -- E-mails : 'envoye' ou 'echec' (avec le message d'erreur dans `erreur`).
  statut_envoi text check (statut_envoi is null or statut_envoi in ('envoye', 'echec')),
  erreur       text,
  resend_id    text,
  auteur       uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  check (prospect_id is not null or school_id is not null)
);
create index if not exists platform_echanges_prospect_idx on public.platform_echanges (prospect_id, created_at desc);
create index if not exists platform_echanges_school_idx on public.platform_echanges (school_id, created_at desc);

create table if not exists public.platform_modeles_email (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  objet       text not null,
  contenu     text not null,
  ordre       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Accès : le chef du système seulement ───────────────────────────────────
alter table public.platform_prospects     enable row level security;
alter table public.platform_echanges      enable row level security;
alter table public.platform_modeles_email enable row level security;

do $$
declare t text;
begin
  foreach t in array array['platform_prospects', 'platform_echanges', 'platform_modeles_email']
  loop
    execute format('drop policy if exists "%1$s: chef du système" on public.%1$s', t);
    execute format('create policy "%1$s: chef du système" on public.%1$s for all using (get_is_platform_admin()) with check (get_is_platform_admin())', t);
  end loop;
end $$;

-- ─── Modèles de départ (modifiables dans l'application) ─────────────────────
-- {{ecole}} et {{responsable}} sont remplacés à l'envoi.
insert into public.platform_modeles_email (nom, objet, contenu, ordre)
select * from (values
  ('Présentation', 'SenClass — la gestion de votre école, simplement',
   E'Bonjour {{responsable}},\n\nJe me permets de vous contacter au sujet de {{ecole}}.\n\nSenClass est un logiciel de gestion scolaire conçu à Dakar : inscriptions, notes et bulletins, emplois du temps, présences et paiements, au même endroit.\n\nSeriez-vous disponible pour une courte démonstration, à l''école ou en ligne ?\n\nBien cordialement,\nL''équipe SenClass', 0),
  ('Relance', 'Suite à notre échange — SenClass',
   E'Bonjour {{responsable}},\n\nJe reviens vers vous au sujet de SenClass pour {{ecole}}.\n\nAvez-vous eu le temps d''y réfléchir ? Je reste disponible pour répondre à vos questions ou organiser une démonstration.\n\nBien cordialement,\nL''équipe SenClass', 1),
  ('Invitation à une démonstration', 'Démonstration de SenClass pour {{ecole}}',
   E'Bonjour {{responsable}},\n\nNous serions ravis de vous présenter SenClass en 30 minutes, avec les vraies situations de {{ecole}} : inscriptions, bulletins, paiements.\n\nQuel jour et quelle heure vous conviendraient ?\n\nBien cordialement,\nL''équipe SenClass', 2)
) as m(nom, objet, contenu, ordre)
where not exists (select 1 from public.platform_modeles_email);
