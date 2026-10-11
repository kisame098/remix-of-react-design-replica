-- ═══════════════════════════════════════════════════════════════════════════
-- PERSONNEL AVEC UN VRAI E-MAIL : PLUS D'ÉCOLE « MON ÉCOLE » EN DOUBLE
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (remplace la version de
-- handle_new_user posée par personnel_vrai_email.sql).
--
-- Le défaut : personnel_vrai_email.sql comptait sur app_metadata.compte_ecole
-- pour que le déclencheur ne crée pas d'école. Or Supabase (auth.admin.createUser)
-- insère d'abord l'utilisateur, PUIS ajoute l'app_metadata par une mise à jour :
-- au moment où le déclencheur AFTER INSERT s'exécute, la marque n'existe pas
-- encore. Chaque membre du personnel avec une vraie adresse recevait donc une
-- école vide « Mon École » dont il était directeur, et c'est elle qu'il
-- retrouvait à la connexion au lieu de l'école qui l'emploie.
--
-- Correctif : le déclencheur reconnaît le personnel à la ligne school_accounts
-- que le directeur prépare TOUJOURS avant d'appeler create-staff-account
-- (rôle staff, même adresse, pas encore reliée). Ce sont des données serveur :
-- une inscription publique ne peut pas les fabriquer. Au pire, quelqu'un qui
-- s'inscrit lui-même avec une adresse qu'un directeur vient de préparer
-- n'obtient ni école ni accès (create-staff-account refusera ensuite l'adresse
-- déjà utilisée et retirera la ligne préparée).
--
-- Puis : suppression des écoles « Mon École » créées par erreur, si elles sont
-- vides (aucun élève, compte ni classe, un seul membre). Les comptes de
-- connexion sont conservés : ils appartiennent à la vraie école.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  new_school_id UUID;
  school_name TEXT;
BEGIN
  -- Compte généré par l'application (élève, professeur, personnel) : ni
  -- profil, ni école. terranga.com = comptes créés avant le changement de nom.
  IF lower(split_part(NEW.email, '@', 2)) IN ('senclass.com', 'terranga.com') THEN
    RETURN NEW;
  END IF;

  -- Compte créé par une école pour son personnel, avec une vraie adresse :
  -- create-staff-account crée lui-même le profil et l'accès. La ligne
  -- school_accounts préparée par le directeur est le signal fiable (la marque
  -- app_metadata.compte_ecole arrive APRÈS l'insertion, voir plus haut).
  IF EXISTS (
    SELECT 1 FROM public.school_accounts a
     WHERE a.role = 'staff'
       AND a.auth_user_id IS NULL
       AND lower(a.email) = lower(NEW.email)
  ) THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.raw_app_meta_data->>'compte_ecole', '') = 'true' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.banned_accounts WHERE email = lower(NEW.email)) THEN
    RAISE EXCEPTION 'Inscription refusée';
  END IF;

  school_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'school_name'), ''),
    'Mon École'
  );

  INSERT INTO public.profiles (id, email, registered_at)
  VALUES (NEW.id, NEW.email, NOW());

  INSERT INTO public.schools (name, created_at, subscription_expires_at)
  VALUES (school_name, NOW(), NOW() + INTERVAL '7 days')
  RETURNING id INTO new_school_id;

  INSERT INTO public.school_members (school_id, user_id, role, joined_at)
  VALUES (new_school_id, NEW.id, 'admin_school', NOW());

  RETURN NEW;
END;
$function$;


-- ─── Nettoyage des écoles créées par erreur ─────────────────────────────────
delete from public.schools s
 where s.name = 'Mon École'
   and exists (
     select 1 from public.school_members m
       join auth.users u on u.id = m.user_id
      where m.school_id = s.id and m.role = 'admin_school'
        and coalesce(u.raw_app_meta_data->>'compte_ecole', '') = 'true'
   )
   and (select count(*) from public.school_members m where m.school_id = s.id) = 1
   and not exists (select 1 from public.student_enrollments e where e.school_id = s.id)
   and not exists (select 1 from public.school_accounts a     where a.school_id = s.id)
   and not exists (select 1 from public.classes c             where c.school_id = s.id);
