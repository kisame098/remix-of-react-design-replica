-- ═══════════════════════════════════════════════════════════════════════════
-- PERSONNEL AVEC UN VRAI E-MAIL
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor, AVANT de créer un compte du
-- personnel avec une vraie adresse.
--
-- Le déclencheur on_auth_user_created (handle_new_user) crée une ÉCOLE et en
-- fait l'utilisateur directeur, sauf pour les adresses générées
-- (@senclass.com, @terranga.com). Un membre du personnel avec une vraie
-- adresse (gmail…) serait donc devenu directeur d'une école « Mon École ».
--
-- Correctif : la fonction create-staff-account marque le compte
-- app_metadata.compte_ecole = true, et le déclencheur l'ignore. app_metadata
-- n'est modifiable que par le serveur : une inscription publique ne peut pas
-- s'en servir pour contourner la création de l'école.
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
  -- create-staff-account crée lui-même le profil et l'accès.
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
