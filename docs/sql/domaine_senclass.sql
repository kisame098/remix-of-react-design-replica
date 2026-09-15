-- ═══════════════════════════════════════════════════════════════════════════
-- CHANGEMENT DE NOM : Teranga School → SenClass
--
-- Les adresses de connexion générées pour les élèves, les professeurs et le
-- personnel passent de prenom.nom.12345@terranga.com à …@senclass.com
-- (src/lib/accountUtils.ts → DOMAINE_COMPTES).
--
-- handle_new_user() se déclenche à chaque création de compte. Il distingue
-- ces comptes générés des directeurs qui s'inscrivent : pour eux, il ne crée
-- ni profil, ni école. Il ne reconnaissait que @terranga.com — un élève créé
-- en @senclass.com serait passé pour un directeur, et la base lui aurait
-- créé une fausse école « Mon École » dont il serait devenu l'administrateur.
--
-- Les DEUX domaines restent reconnus : les comptes existants en @terranga.com
-- gardent leur adresse, leurs identifiants ont déjà été distribués.
--
-- Seule modification par rapport à la version en place (relue dans la base
-- avant d'écrire ce fichier) : la première condition. Le reste est identique.
--
-- À exécuter AVANT de créer le moindre nouveau compte élève ou professeur.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  new_school_id UUID;
  school_name   TEXT;
BEGIN
  -- Compte généré par l'application (élève, professeur, personnel) : ni
  -- profil, ni école. terranga.com = comptes créés avant le changement de nom.
  IF lower(split_part(NEW.email, '@', 2)) IN ('senclass.com', 'terranga.com') THEN
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
