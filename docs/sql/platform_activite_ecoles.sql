-- ═══════════════════════════════════════════════════════════════════════════
-- CHEF DU SYSTÈME : effectifs et activité de chaque école
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après platform_admin_v2.sql).
--
-- Rien de ce qui suit ne renvoie de donnée personnelle d'élève : uniquement des
-- COMPTES (nombre d'élèves, de notes saisies, de paiements…) et des DATES.
--
-- Activité — trois sources, affichées séparément :
--   • dernière connexion : auth.users.last_sign_in_at des comptes de l'école ;
--   • dernière saisie : horodatages des tables métier (notes, présences,
--     paiements, reçus, bulletins, inscriptions) — disponible DÈS MAINTENANT,
--     y compris pour le passé ;
--   • présence dans l'application : school_user_days, alimentée par
--     record_activity() à chaque ouverture de l'appli (une ligne par
--     utilisateur et par jour, le jour étant celui de Dakar). Elle sert à savoir
--     « combien de personnes se sont servies de l'appli ce jour-là », même sans
--     rien saisir. Elle commence à la date de mise en service de ce fichier.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.school_user_days (
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id   uuid not null,
  kind      text not null check (kind in ('admin', 'staff', 'teacher', 'student')),
  day       date not null,
  first_at  timestamptz not null default now(),
  last_at   timestamptz not null default now(),
  pings     integer not null default 1,
  primary key (school_id, user_id, day)
);

create index if not exists school_user_days_day_idx on public.school_user_days (school_id, day);

-- Aucune politique : ni lecture ni écriture directes. Tout passe par les fonctions ci-dessous.
alter table public.school_user_days enable row level security;
revoke all on table public.school_user_days from anon, authenticated;


-- ─── Ping d'activité (appelé par l'application, jamais bloquant) ─────────────
create or replace function public.record_activity()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_school uuid;
  v_kind   text;
begin
  if v_uid is null then return; end if;

  select m.school_id, case when m.role = 'admin_school' then 'admin' else 'staff' end
    into v_school, v_kind
    from public.school_members m
   where m.user_id = v_uid and m.is_active
   limit 1;

  if v_school is null then
    select a.school_id, case when a.role in ('teacher', 'student') then a.role else 'staff' end
      into v_school, v_kind
      from public.school_accounts a
     where a.auth_user_id = v_uid and a.is_active
     limit 1;
  end if;

  if v_school is null then return; end if;   -- chef du système, compte orphelin : rien à compter

  insert into public.school_user_days (school_id, user_id, kind, day)
  values (v_school, v_uid, v_kind, (now() at time zone 'Africa/Dakar')::date)
  on conflict (school_id, user_id, day)
  do update set last_at = now(), pings = public.school_user_days.pings + 1;
end $$;

revoke all on function public.record_activity() from public, anon;
grant execute on function public.record_activity() to authenticated;


-- ─── Aides internes (non appelables depuis l'application) ───────────────────

-- Dernière trace d'activité de l'école, toutes sources confondues.
create or replace function public._school_last_activity(p_school uuid)
returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(
    (select max(last_at)     from public.school_user_days   where school_id = p_school),
    (select max(u.last_sign_in_at) from auth.users u
       where u.id in (select user_id from public.school_members where school_id = p_school
                      union select auth_user_id from public.school_accounts where school_id = p_school and auth_user_id is not null)),
    (select max(updated_at)  from public.grades              where school_id = p_school),
    (select max(updated_at)  from public.elementary_grades   where school_id = p_school),
    (select max(created_at)  from public.attendance_sessions where school_id = p_school),
    (select max(paid_at)     from public.payments            where school_id = p_school),
    (select max(created_at)  from public.receipts            where school_id = p_school),
    (select max(published_at) from public.published_bulletins where school_id = p_school),
    (select max(enrolled_at) from public.student_enrollments where school_id = p_school)
  );
$$;

-- Jours (Dakar) où l'école a fait quelque chose, depuis p_from.
create or replace function public._school_active_days(p_school uuid, p_from date)
returns setof date
language sql stable security definer set search_path = public as $$
  select distinct d from (
    select day as d from public.school_user_days where school_id = p_school
    union all select (updated_at at time zone 'Africa/Dakar')::date from public.grades where school_id = p_school
    union all select (updated_at at time zone 'Africa/Dakar')::date from public.elementary_grades where school_id = p_school
    union all select (created_at at time zone 'Africa/Dakar')::date from public.attendance_sessions where school_id = p_school
    union all select (paid_at at time zone 'Africa/Dakar')::date from public.payments where school_id = p_school
    union all select (created_at at time zone 'Africa/Dakar')::date from public.receipts where school_id = p_school
    union all select (published_at at time zone 'Africa/Dakar')::date from public.published_bulletins where school_id = p_school
    union all select (enrolled_at at time zone 'Africa/Dakar')::date from public.student_enrollments where school_id = p_school
  ) t where d >= p_from;
$$;

revoke all on function public._school_last_activity(uuid) from public, anon, authenticated;
revoke all on function public._school_active_days(uuid, date) from public, anon, authenticated;


-- ─── Vue d'ensemble : une ligne par école ───────────────────────────────────
create or replace function public.platform_schools_overview()
returns table (
  school_id uuid, eleves bigint, professeurs bigint, personnel bigint, classes bigint,
  notes bigint, derniere_activite timestamptz, jours_actifs_30 bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;

  return query
  select s.id,
         (select count(*) from public.student_enrollments e where e.school_id = s.id),
         (select count(*) from public.teacher_enrollments t where t.school_id = s.id),
         (select count(*) from public.school_members m where m.school_id = s.id and m.role = 'staff'),
         (select count(*) from public.classes c where c.school_id = s.id),
         (select count(*) from public.grades g where g.school_id = s.id
            and (g.devoir1 is not null or g.devoir2 is not null or g.devoir3 is not null or g.devoir4 is not null
                 or g.devoir5 is not null or g.composition is not null or g.note is not null))
         + (select count(*) from public.elementary_grades g where g.school_id = s.id and g.points_obtenus is not null),
         public._school_last_activity(s.id),
         (select count(*) from public._school_active_days(s.id, ((now() at time zone 'Africa/Dakar')::date - 29)))
    from public.schools s;
end $$;

revoke all on function public.platform_schools_overview() from public, anon;
grant execute on function public.platform_schools_overview() to authenticated;


-- ─── Fiche détaillée d'une école ────────────────────────────────────────────
create or replace function public.platform_school_detail(p_school_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_school   public.schools;
  v_today    date := (now() at time zone 'Africa/Dakar')::date;
  v_users    uuid[];
  v_result   jsonb;
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;
  select * into v_school from public.schools where id = p_school_id;
  if v_school.id is null then raise exception 'École introuvable'; end if;

  select coalesce(array_agg(distinct uid), '{}') into v_users
    from (select user_id as uid from public.school_members where school_id = p_school_id
          union select auth_user_id from public.school_accounts where school_id = p_school_id and auth_user_id is not null) t;

  v_result := jsonb_build_object(
    'ecole', jsonb_build_object(
      'id', v_school.id, 'nom', v_school.name, 'ville', v_school.city, 'pays', v_school.country,
      'creee_le', v_school.created_at, 'statut', v_school.subscription_status,
      'plan', v_school.subscription_plan, 'expire_le', v_school.subscription_expires_at),

    'effectifs', jsonb_build_object(
      'eleves',      (select count(*) from public.student_enrollments where school_id = p_school_id),
      'eleves_par_annee', coalesce((select jsonb_agg(jsonb_build_object('annee', a, 'eleves', n) order by a desc)
                          from (select academic_year_label a, count(*) n from public.student_enrollments
                                 where school_id = p_school_id group by 1) x), '[]'::jsonb),
      'professeurs', (select count(*) from public.teacher_enrollments where school_id = p_school_id),
      'directeurs',  (select count(*) from public.school_members where school_id = p_school_id and role = 'admin_school'),
      'personnel',   (select count(*) from public.school_members where school_id = p_school_id and role = 'staff'),
      'caisses',     (select count(*) from public.school_members where school_id = p_school_id and 'cashier' = any(permissions)),
      'classes',     (select count(*) from public.classes where school_id = p_school_id),
      'matieres',    (select count(distinct name) from public.subjects where school_id = p_school_id),
      'creneaux_emploi_du_temps', (select count(*) from public.schedule_events where school_id = p_school_id)),

    'comptes', jsonb_build_object(
      'eleves',        (select count(*) from public.school_accounts where school_id = p_school_id and role = 'student'),
      'eleves_connectes', (select count(*) from public.school_accounts a join auth.users u on u.id = a.auth_user_id
                            where a.school_id = p_school_id and a.role = 'student' and u.last_sign_in_at is not null),
      'professeurs',   (select count(*) from public.school_accounts where school_id = p_school_id and role = 'teacher'),
      'professeurs_connectes', (select count(*) from public.school_accounts a join auth.users u on u.id = a.auth_user_id
                            where a.school_id = p_school_id and a.role = 'teacher' and u.last_sign_in_at is not null)),

    'saisie', jsonb_build_object(
      'notes', (select count(*) from public.grades g where g.school_id = p_school_id
                 and (g.devoir1 is not null or g.devoir2 is not null or g.devoir3 is not null or g.devoir4 is not null
                      or g.devoir5 is not null or g.composition is not null or g.note is not null)),
      'notes_elementaire', (select count(*) from public.elementary_grades where school_id = p_school_id and points_obtenus is not null),
      'seances_presence', (select count(*) from public.attendance_sessions where school_id = p_school_id),
      'presences_eleves', (select count(*) from public.student_attendances where school_id = p_school_id),
      'paiements', (select count(*) from public.payments where school_id = p_school_id and status = 'confirmed'),
      'paiements_annules', (select count(*) from public.payments where school_id = p_school_id and status = 'cancelled'),
      'total_encaisse', coalesce((select sum(amount) from public.payments where school_id = p_school_id and status = 'confirmed'), 0),
      'recus', (select count(*) from public.receipts where school_id = p_school_id),
      'bulletins_publies', (select count(*) from public.published_bulletins where school_id = p_school_id)),

    'dates', jsonb_build_object(
      'derniere_activite', public._school_last_activity(p_school_id),
      'derniere_connexion', (select max(last_sign_in_at) from auth.users where id = any(v_users)),
      'derniere_presence_appli', (select max(last_at) from public.school_user_days where school_id = p_school_id),
      'derniere_saisie_notes', (select max(updated_at) from public.grades where school_id = p_school_id),
      'derniere_saisie_presences', (select max(created_at) from public.attendance_sessions where school_id = p_school_id),
      'dernier_paiement', (select max(paid_at) from public.payments where school_id = p_school_id),
      'premiere_activite', (select min(d) from public._school_active_days(p_school_id, date '2000-01-01') d),
      'suivi_appli_depuis', (select min(day) from public.school_user_days where school_id = p_school_id),
      'jours_actifs_30', (select count(*) from public._school_active_days(p_school_id, v_today - 29)),
      'jours_actifs_90', (select count(*) from public._school_active_days(p_school_id, v_today - 89))),

    -- Historique jour par jour (90 jours). « connectes » = personnes distinctes ayant ouvert
    -- l'application ce jour-là (suivi depuis la mise en service) ; le reste vient des données saisies.
    'historique', coalesce((
      select jsonb_agg(jsonb_build_object(
               'jour', x.d, 'connectes', coalesce(c.n, 0), 'notes', coalesce(g.n, 0),
               'seances', coalesce(s.n, 0), 'paiements', coalesce(p.n, 0), 'inscriptions', coalesce(i.n, 0)) order by x.d desc)
        from (select gs::date as d from generate_series(v_today - 89, v_today, interval '1 day') gs) x
        left join (select day, count(distinct user_id) n from public.school_user_days where school_id = p_school_id group by 1) c on c.day = x.d
        left join (select (updated_at at time zone 'Africa/Dakar')::date as day, count(*) n from public.grades where school_id = p_school_id group by 1) g on g.day = x.d
        left join (select (created_at at time zone 'Africa/Dakar')::date as day, count(*) n from public.attendance_sessions where school_id = p_school_id group by 1) s on s.day = x.d
        left join (select (paid_at at time zone 'Africa/Dakar')::date as day, count(*) n from public.payments where school_id = p_school_id group by 1) p on p.day = x.d
        left join (select (enrolled_at at time zone 'Africa/Dakar')::date as day, count(*) n from public.student_enrollments where school_id = p_school_id group by 1) i on i.day = x.d
    ), '[]'::jsonb)
  );

  return v_result;
end $$;

revoke all on function public.platform_school_detail(uuid) from public, anon;
grant execute on function public.platform_school_detail(uuid) to authenticated;
