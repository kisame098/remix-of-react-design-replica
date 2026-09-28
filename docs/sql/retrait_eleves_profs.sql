-- ═══════════════════════════════════════════════════════════════════════════
-- RETIRER UN ÉLÈVE OU UN PROFESSEUR (sans rien effacer)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor.
--
-- « Retirer » ne supprime rien : effacer une inscription effacerait en cascade
-- ses paiements (payments → student_enrollments ON DELETE CASCADE), donc les
-- reçus et la caisse. On marque l'inscription de l'année `withdrawn` et on
-- désactive le compte de connexion (school_accounts.is_active = false).
-- « Réintégrer » fait l'inverse.
--
-- Ce fichier :
--   1. autorise `withdrawn` pour les professeurs (déjà permis pour les élèves) ;
--   2. fait respecter school_accounts.is_active par les fonctions d'accès du
--      portail : un compte désactivé ne voit plus rien.
--   3. retire les élèves `withdrawn` du classement par matière du portail.
-- Au moment de l'écriture, tous les comptes existants sont actifs : rien ne
-- change pour eux.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Statut des inscriptions des professeurs
alter table public.teacher_enrollments drop constraint if exists teacher_enrollments_status_check;
alter table public.teacher_enrollments
  add constraint teacher_enrollments_status_check check (status in ('active', 'withdrawn'));

-- 2. Fonctions d'accès : compte désactivé = plus d'accès
create or replace function public.get_my_student_enrollment_id() returns uuid
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  -- AUCUN contrôle d'abonnement ici, volontairement : l'élève et sa famille
  -- ne sont jamais pénalisés par l'impayé de l'établissement.
  -- Compte désactivé (élève retiré) : plus d'accès.
  select student_enrollment_id from public.school_accounts
  where auth_user_id = auth.uid() and role = 'student' and is_active limit 1;
$$;

create or replace function public.get_my_student_class_id() returns uuid
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select se.class_id from public.student_enrollments se
  join public.school_accounts sa on sa.student_enrollment_id = se.id
  where sa.auth_user_id = auth.uid() and sa.role = 'student' and sa.is_active limit 1;
$$;

create or replace function public.get_my_account_school_id() returns uuid
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select a.school_id from public.school_accounts a
  where a.auth_user_id = auth.uid() and a.is_active
    and (a.role = 'student' or public.is_school_access_allowed(a.school_id)) limit 1;
$$;

create or replace function public.get_my_teacher_enrollment_id() returns uuid
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select a.teacher_enrollment_id from public.school_accounts a
  where a.auth_user_id = auth.uid() and a.role = 'teacher' and a.is_active
    and public.is_school_access_allowed(a.school_id) limit 1;
$$;

create or replace function public.get_my_portal_school_id() returns uuid
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select school_id from public.school_accounts
  where auth_user_id = auth.uid() and is_active limit 1;
$$;

-- 3. get_my_subject_ranks : compte actif, et classement sans les élèves retirés.
-- La fonction est longue : on la modifie en place (espaces multiples tolérés),
-- et on s'arrête si le texte attendu n'est pas trouvé (rien n'est alors changé).
do $$
declare
  d text := pg_get_functiondef('public.get_my_subject_ranks()'::regprocedure);
  avant text := d;
begin
  if d not like '%sa.is_active%' then
    d := regexp_replace(d, $x$AND\s+sa\.role\s*=\s*'student'$x$, $x$AND sa.role = 'student' AND sa.is_active$x$);
    if d = avant then raise exception 'get_my_subject_ranks : compte, texte attendu introuvable'; end if;
  end if;
  if d not like '%se.status = ''active''%' then
    avant := d;
    d := regexp_replace(d, $x$WHERE\s+se\.class_id\s*=\s*v_class_id$x$, $x$WHERE se.class_id = v_class_id AND se.status = 'active'$x$);
    if d = avant then raise exception 'get_my_subject_ranks : classe, texte attendu introuvable'; end if;
  end if;
  execute d;
end $$;
