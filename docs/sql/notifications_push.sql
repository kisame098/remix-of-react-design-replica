-- ═══════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS PUSH — élèves : nouvelle note, bulletin publié, paiement reçu
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor. Aucun secret à fournir :
-- celui du planificateur est généré ici, dans le coffre chiffré (Vault), et les
-- clés VAPID sont fabriquées par la fonction send-notifications à son premier
-- appel, la privée allant elle aussi dans le coffre. Personne ne les voit.
--
-- Ce que ça met en place :
--   • push_subscriptions   : un abonnement par couple (appareil, compte). Un
--                            parent qui garde plusieurs enfants sur son
--                            téléphone reçoit les notifications de chacun.
--   • notification_queue   : file d'attente, remplie par des déclencheurs.
--   • déclencheurs         : grades / elementary_grades / published_bulletins /
--                            payments / student_attendances / attendance_sessions. AUCUN ne peut bloquer l'écriture : un
--                            bug de notification ne doit jamais empêcher un
--                            professeur d'enregistrer ses notes ni un caissier
--                            d'encaisser (bloc EXCEPTION dans chacun).
--   • une tâche planifiée  : toutes les 10 secondes, s'il y a quelque chose à envoyer,
--                            elle appelle la fonction send-notifications.
--
-- Rien n'est mis en file pour un élève sans abonnement : la table ne grossit
-- que pour ceux qui ont activé les notifications.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Extensions ───────────────────────────────────────────────────────────
create extension if not exists pg_net  with schema extensions;
create extension if not exists pg_cron with schema extensions;


-- ─── 1 bis. Secrets, dans le coffre chiffré (Vault) ──────────────────────────
-- Rien de secret n'est stocké en clair dans une table. Le coffre chiffre au
-- repos ; la lecture passe par des fonctions réservées à la clé de service.

-- Secret partagé entre la tâche planifiée et la fonction. Généré ICI, une seule
-- fois (deux UUID v4 : ~240 bits d'aléa) ; il ne s'affiche nulle part.
select vault.create_secret(
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'senclass_cron_secret'
)
where not exists (select 1 from vault.secrets where name = 'senclass_cron_secret');

-- Seule la clé PUBLIQUE VAPID vit dans une table : elle est publique par nature,
-- l'application la lit pour s'abonner.
create table if not exists public.push_config (
  cle      text primary key,
  valeur   text not null,
  cree_le  timestamptz not null default now()
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

create or replace function public.cle_publique_push()
returns text
language sql stable security definer set search_path = public as $$
  select valeur from public.push_config where cle = 'vapid_public';
$$;
revoke all on function public.cle_publique_push() from public, anon;
grant execute on function public.cle_publique_push() to authenticated;

-- Lecture d'un secret du coffre : réservée à la fonction (clé de service).
create or replace function public.push_secret_lire(p_nom text)
returns text
language sql security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets
   where name = p_nom and p_nom in ('senclass_cron_secret', 'senclass_vapid_privee')
   limit 1;
$$;
revoke all on function public.push_secret_lire(text) from public, anon, authenticated;
grant execute on function public.push_secret_lire(text) to service_role;

-- Enregistre la paire de clés fabriquée par la fonction — UNE SEULE FOIS : si
-- elle existe déjà on ne l'écrase jamais (ce serait invalider tous les
-- abonnements). Renvoie false quand une autre exécution a été plus rapide.
create or replace function public.push_initialiser_cles(p_publique text, p_privee text)
returns boolean
language plpgsql security definer set search_path = public, vault as $$
begin
  perform pg_advisory_xact_lock(hashtext('senclass_push_init'));
  if exists (select 1 from public.push_config where cle = 'vapid_public') then
    return false;
  end if;
  perform vault.create_secret(p_privee, 'senclass_vapid_privee');
  insert into public.push_config (cle, valeur) values ('vapid_public', p_publique);
  return true;
end $$;
revoke all on function public.push_initialiser_cles(text, text) from public, anon, authenticated;
grant execute on function public.push_initialiser_cles(text, text) to service_role;


-- ─── 2. Abonnements ──────────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  -- Un appareil peut porter plusieurs comptes (parent + enfants) : l'unicité
  -- porte sur le COUPLE, pas sur l'appareil seul.
  unique (endpoint, auth_user_id)
);

create index if not exists push_subscriptions_utilisateur_idx
  on public.push_subscriptions (auth_user_id);

alter table public.push_subscriptions enable row level security;

-- On ne lit que SES abonnements. Aucune politique d'écriture : tout passe par
-- les deux fonctions ci-dessous, qui posent elles-mêmes l'identité.
drop policy if exists "voir ses abonnements push" on public.push_subscriptions;
create policy "voir ses abonnements push" on public.push_subscriptions
  for select to authenticated using (auth.uid() = auth_user_id);

create or replace function public.enregistrer_abonnement_push(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Abonnement incomplet';
  end if;

  insert into public.push_subscriptions (auth_user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint, auth_user_id) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end $$;

-- Ne retire que l'abonnement du COMPTE connecté : les autres comptes du même
-- appareil continuent de recevoir les leurs.
create or replace function public.supprimer_abonnement_push(p_endpoint text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.push_subscriptions
   where endpoint = p_endpoint and auth_user_id = auth.uid();
end $$;

revoke all on function public.enregistrer_abonnement_push(text, text, text, text) from public, anon;
revoke all on function public.supprimer_abonnement_push(text)                     from public, anon;
grant execute on function public.enregistrer_abonnement_push(text, text, text, text) to authenticated;
grant execute on function public.supprimer_abonnement_push(text)                     to authenticated;


-- ─── 3. File d'attente ───────────────────────────────────────────────────────
create table if not exists public.notification_queue (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('grade', 'bulletin', 'payment', 'attendance')),
  -- Jamais de valeur de note ni de montant ici : le texte affiché sur un écran
  -- verrouillé ne doit rien révéler de sensible.
  payload       jsonb not null default '{}'::jsonb,
  send_after    timestamptz not null default now(),
  attempts      integer not null default 0,
  claimed_at    timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notification_queue_a_envoyer_idx
  on public.notification_queue (send_after) where sent_at is null;

-- Base déjà installée avant l'ajout des présences : on élargit la contrainte.
alter table public.notification_queue drop constraint if exists notification_queue_kind_check;
alter table public.notification_queue add constraint notification_queue_kind_check
  check (kind in ('grade', 'bulletin', 'payment', 'attendance'));

-- RLS sans aucune politique : ni les élèves ni les professeurs n'y touchent,
-- seule la fonction (clé de service) lit et écrit.
alter table public.notification_queue enable row level security;
revoke all on public.notification_queue from anon, authenticated;

-- Réserve un lot de notifications prêtes. Une série (même compte, même type)
-- n'est prête que lorsque plus aucune ligne n'attend encore : plusieurs notes
-- saisies à quelques secondes d'écart pour le même élève n'envoient qu'UNE
-- notification groupée, 20 secondes après la dernière. Le délai est court
-- exprès : une notification qui arrive minutes après coup perd son intérêt.
-- Au-delà de 30 minutes d'attente, on envoie quand même.
create or replace function public.notifications_reclamer(p_limite integer default 500)
returns setof public.notification_queue
language sql security definer set search_path = public as $$
  update public.notification_queue q
     set claimed_at = now(), attempts = q.attempts + 1
   where q.id in (
     select f.id
       from public.notification_queue f
      where f.sent_at is null
        and f.attempts < 3
        and (f.claimed_at is null or f.claimed_at < now() - interval '5 minutes')
        and f.send_after <= now()
        and (
          not exists (
            select 1 from public.notification_queue attente
             where attente.auth_user_id = f.auth_user_id
               and attente.kind = f.kind
               and attente.sent_at is null
               and attente.send_after > now()
          )
          or f.created_at < now() - interval '30 minutes'
        )
      order by f.created_at
      limit p_limite
      for update skip locked
   )
  returning q.*;
$$;

revoke all on function public.notifications_reclamer(integer) from public, anon, authenticated;
grant execute on function public.notifications_reclamer(integer) to service_role;


-- ─── 4. Déclencheurs ─────────────────────────────────────────────────────────
-- Comptes élèves actifs rattachés à une inscription ET abonnés aux notifications.
create or replace function public.comptes_eleve_abonnes(p_inscription uuid)
returns table (auth_user_id uuid)
language sql stable security definer set search_path = public as $$
  select a.auth_user_id
    from public.school_accounts a
   where a.student_enrollment_id = p_inscription
     and a.role = 'student'
     and a.is_active
     and a.auth_user_id is not null
     and exists (select 1 from public.push_subscriptions s where s.auth_user_id = a.auth_user_id);
$$;
revoke all on function public.comptes_eleve_abonnes(uuid) from public, anon, authenticated;

-- Nouvelle note : une valeur qui APPARAÎT (vide → remplie). Corriger une note
-- déjà saisie ne notifie personne.
create or replace function public.notifier_nouvelle_note()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_apparait boolean;
  v_matiere  text;
begin
  begin
    if TG_OP = 'INSERT' then
      v_apparait := coalesce(NEW.devoir1, NEW.devoir2, NEW.devoir3, NEW.devoir4, NEW.devoir5,
                             NEW.composition, NEW.note) is not null;
    else
      v_apparait :=
           (OLD.devoir1 is null and NEW.devoir1 is not null)
        or (OLD.devoir2 is null and NEW.devoir2 is not null)
        or (OLD.devoir3 is null and NEW.devoir3 is not null)
        or (OLD.devoir4 is null and NEW.devoir4 is not null)
        or (OLD.devoir5 is null and NEW.devoir5 is not null)
        or (OLD.composition is null and NEW.composition is not null)
        or (OLD.note is null and NEW.note is not null);
    end if;

    if v_apparait then
      select name into v_matiere from public.subjects where id = NEW.subject_id;
      insert into public.notification_queue (auth_user_id, kind, payload, send_after)
      select c.auth_user_id, 'grade',
             jsonb_build_object('matiere', coalesce(v_matiere, 'une matière')),
             now() + interval '20 seconds'
        from public.comptes_eleve_abonnes(NEW.student_enrollment_id) c;
    end if;
  exception when others then
    -- Une notification manquée est un moindre mal ; une note non enregistrée non.
    raise warning 'notifier_nouvelle_note : %', sqlerrm;
  end;
  return NEW;
end $$;

create or replace function public.notifier_nouvelle_note_elementaire()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_discipline text;
begin
  begin
    if NEW.points_obtenus is not null
       and (TG_OP = 'INSERT' or OLD.points_obtenus is null) then
      select name into v_discipline from public.elementary_class_lines where id = NEW.line_id;
      insert into public.notification_queue (auth_user_id, kind, payload, send_after)
      select c.auth_user_id, 'grade',
             jsonb_build_object('matiere', coalesce(v_discipline, 'une matière')),
             now() + interval '20 seconds'
        from public.comptes_eleve_abonnes(NEW.student_enrollment_id) c;
    end if;
  exception when others then
    raise warning 'notifier_nouvelle_note_elementaire : %', sqlerrm;
  end;
  return NEW;
end $$;

-- Bulletin publié : à l'INSERTION seulement. Republier (mise à jour) après une
-- correction ne renotifie pas.
create or replace function public.notifier_bulletin_publie()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_periode text;
begin
  begin
    select name into v_periode from public.grade_periods where id = NEW.period_id;
    insert into public.notification_queue (auth_user_id, kind, payload, send_after)
    select c.auth_user_id, 'bulletin',
           jsonb_build_object('periode', coalesce(v_periode, 'la période')),
           now() + interval '10 seconds'
      from public.comptes_eleve_abonnes(NEW.student_enrollment_id) c;
  exception when others then
    raise warning 'notifier_bulletin_publie : %', sqlerrm;
  end;
  return NEW;
end $$;

-- Paiement enregistré : simple reçu, sans montant. (Une annulation est une
-- mise à jour : elle ne notifie pas.)
create or replace function public.notifier_paiement_recu()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if NEW.status is distinct from 'cancelled' then
      insert into public.notification_queue (auth_user_id, kind, payload, send_after)
      select c.auth_user_id, 'payment',
             jsonb_build_object('type', NEW.type, 'mois', NEW.month_key),
             now() + interval '10 seconds'
        from public.comptes_eleve_abonnes(NEW.student_enrollment_id) c;
    end if;
  exception when others then
    raise warning 'notifier_paiement_recu : %', sqlerrm;
  end;
  return NEW;
end $$;

revoke all on function public.notifier_nouvelle_note()             from public, anon, authenticated;
revoke all on function public.notifier_nouvelle_note_elementaire() from public, anon, authenticated;
revoke all on function public.notifier_bulletin_publie()           from public, anon, authenticated;
revoke all on function public.notifier_paiement_recu()             from public, anon, authenticated;

drop trigger if exists notifier_nouvelle_note on public.grades;
create trigger notifier_nouvelle_note
  after insert or update on public.grades
  for each row execute function public.notifier_nouvelle_note();

drop trigger if exists notifier_nouvelle_note_elementaire on public.elementary_grades;
create trigger notifier_nouvelle_note_elementaire
  after insert or update on public.elementary_grades
  for each row execute function public.notifier_nouvelle_note_elementaire();

drop trigger if exists notifier_bulletin_publie on public.published_bulletins;
create trigger notifier_bulletin_publie
  after insert on public.published_bulletins
  for each row execute function public.notifier_bulletin_publie();

drop trigger if exists notifier_paiement_recu on public.payments;
create trigger notifier_paiement_recu
  after insert on public.payments
  for each row execute function public.notifier_paiement_recu();


-- ─── 4 bis. Présences : absence, retard, renvoi ──────────────────────────────
-- Personne n'est prévenu pendant que le professeur fait l'appel : il coche,
-- se corrige, hésite. La notification part quand il valide (« Saisie
-- complète ») — ou, si l'appel est déjà validé, dès qu'un statut change.
--
--   • absent / en retard / renvoyé  → mis en file (45 secondes de recul) ;
--   • le professeur corrige avant l'envoi → la notification est retirée ;
--   • le professeur corrige APRÈS l'envoi → une notification de correction
--     part, pour ne pas laisser une famille sur une fausse absence.
create or replace function public.reconcilier_presence(
  p_inscription uuid, p_session uuid, p_statut text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_matiere text; v_date date; v_heure text;
begin
  select subject_name, date, start_time into v_matiere, v_date, v_heure
    from public.attendance_sessions where id = p_session;

  -- Ce qui attendait encore d'être envoyé pour cette séance n'a plus lieu d'être.
  delete from public.notification_queue q
   using public.comptes_eleve_abonnes(p_inscription) c
   where q.auth_user_id = c.auth_user_id
     and q.kind = 'attendance'
     and q.sent_at is null and q.claimed_at is null
     and q.payload->>'session' = p_session::text;

  if p_statut in ('absent', 'late', 'expelled') then
    insert into public.notification_queue (auth_user_id, kind, payload, send_after)
    select c.auth_user_id, 'attendance',
           jsonb_build_object('statut', p_statut, 'matiere', nullif(v_matiere, ''),
                              'date', v_date, 'heure', v_heure, 'session', p_session),
           now() + interval '45 seconds'
      from public.comptes_eleve_abonnes(p_inscription) c;

  elsif p_statut = 'present' then
    -- Déjà notifié d'une absence pour cette séance ? Alors on corrige.
    insert into public.notification_queue (auth_user_id, kind, payload, send_after)
    select c.auth_user_id, 'attendance',
           jsonb_build_object('statut', 'corrige', 'matiere', nullif(v_matiere, ''),
                              'date', v_date, 'heure', v_heure, 'session', p_session),
           now() + interval '45 seconds'
      from public.comptes_eleve_abonnes(p_inscription) c
     where (
       select n.payload->>'statut'
         from public.notification_queue n
        where n.auth_user_id = c.auth_user_id and n.kind = 'attendance'
          and n.sent_at is not null and n.payload->>'session' = p_session::text
        order by n.sent_at desc, n.created_at desc limit 1
     ) in ('absent', 'late', 'expelled');
  end if;
end $$;
revoke all on function public.reconcilier_presence(uuid, uuid, text) from public, anon, authenticated;

-- Un statut change APRÈS la validation de l'appel.
create or replace function public.notifier_presence_eleve()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_valide boolean;
begin
  begin
    if TG_OP = 'UPDATE' and OLD.status is not distinct from NEW.status then return NEW; end if;
    -- Les lignes « présent » créées à l'ouverture de l'appel ne disent rien.
    if TG_OP = 'INSERT' and NEW.status = 'present' then return NEW; end if;

    select coalesce(student_attendance_complete, false) into v_valide
      from public.attendance_sessions where id = NEW.session_id;
    if v_valide then
      perform public.reconcilier_presence(NEW.student_enrollment_id, NEW.session_id, NEW.status);
    end if;
  exception when others then
    -- Un appel qui ne s'enregistre pas est bien pire qu'une notification manquée.
    raise warning 'notifier_presence_eleve : %', sqlerrm;
  end;
  return NEW;
end $$;

-- L'appel vient d'être validé : on prévient les absents, retardataires, renvoyés.
create or replace function public.notifier_presences_validees()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  begin
    if coalesce(OLD.student_attendance_complete, false) = false
       and coalesce(NEW.student_attendance_complete, false) = true then
      for r in
        select student_enrollment_id, status from public.student_attendances
         where session_id = NEW.id and status in ('absent', 'late', 'expelled')
      loop
        perform public.reconcilier_presence(r.student_enrollment_id, NEW.id, r.status);
      end loop;
    end if;
  exception when others then
    raise warning 'notifier_presences_validees : %', sqlerrm;
  end;
  return NEW;
end $$;

revoke all on function public.notifier_presence_eleve()      from public, anon, authenticated;
revoke all on function public.notifier_presences_validees()  from public, anon, authenticated;

drop trigger if exists notifier_presence_eleve on public.student_attendances;
create trigger notifier_presence_eleve
  after insert or update on public.student_attendances
  for each row execute function public.notifier_presence_eleve();

drop trigger if exists notifier_presences_validees on public.attendance_sessions;
create trigger notifier_presences_validees
  after update of student_attendance_complete on public.attendance_sessions
  for each row execute function public.notifier_presences_validees();


-- ─── 5. Planification ────────────────────────────────────────────────────────
-- Toutes les 10 secondes : on n'appelle la fonction que s'il y a quelque chose
-- à envoyer, donc une file vide ne coûte presque rien.
select cron.unschedule('senclass-notifications')
 where exists (select 1 from cron.job where jobname = 'senclass-notifications');

select cron.schedule(
  'senclass-notifications',
  '10 seconds',
  $$
  select net.http_post(
    url     := 'https://gofwbpmmarwckwvcfbmp.supabase.co/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                         where name = 'senclass_cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  where exists (
    select 1 from public.notification_queue
     where sent_at is null and attempts < 3 and send_after <= now()
  )
  -- Tant que les clés VAPID n'existent pas, on appelle la fonction : c'est
  -- elle qui les fabrique. Ensuite cette condition ne se déclenche plus.
  or not exists (select 1 from public.push_config where cle = 'vapid_public');
  $$
);

-- Nettoyage : les notifications envoyées depuis plus d'une semaine.
select cron.unschedule('senclass-notifications-nettoyage')
 where exists (select 1 from cron.job where jobname = 'senclass-notifications-nettoyage');

select cron.schedule(
  'senclass-notifications-nettoyage',
  '17 3 * * *',
  $$ delete from public.notification_queue where sent_at < now() - interval '7 days'; $$
);
