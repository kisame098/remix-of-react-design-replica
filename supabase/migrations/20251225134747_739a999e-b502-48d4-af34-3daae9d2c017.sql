-- =====================================================
-- TERANGA SCHOOL - ARCHITECTURE MULTI-TENANT
-- Version 1.0.0 - 2025-12-25
-- =====================================================

-- 1. TYPES ET ENUMS
-- =====================================================

-- Rôles applicatifs
CREATE TYPE public.app_role AS ENUM (
  'admin_school',    -- Administrateur d'école (directeur)
  'teacher',         -- Professeur
  'secretary'        -- Secrétaire
);

-- Statut d'abonnement
CREATE TYPE public.subscription_status AS ENUM (
  'trial',      -- Période d'essai
  'active',     -- Abonnement actif
  'suspended',  -- Suspendu (impayé)
  'cancelled'   -- Annulé
);

-- 2. TABLE SCHOOLS (TENANT)
-- =====================================================

CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_schools_subscription_status ON public.schools(subscription_status);

-- Activer RLS
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. TABLE PROFILES
-- =====================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour recherche par école
CREATE INDEX idx_profiles_school_id ON public.profiles(school_id);

-- Activer RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. TABLE USER_ROLES (Séparée pour sécurité)
-- =====================================================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Index pour vérification rapide des rôles
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- Activer RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. FONCTIONS DE SÉCURITÉ (SECURITY DEFINER)
-- =====================================================

-- Vérification de rôle
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Récupération du school_id de l'utilisateur
CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- 6. FONCTION D'INSCRIPTION ÉCOLE (ATOMIQUE)
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_school_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_school_id UUID;
  school_name TEXT;
  user_full_name TEXT;
BEGIN
  -- Extraire les métadonnées
  school_name := NEW.raw_user_meta_data ->> 'school_name';
  user_full_name := NEW.raw_user_meta_data ->> 'full_name';
  
  -- Si pas de nom d'école, ne pas créer (login normal)
  IF school_name IS NULL OR school_name = '' THEN
    RETURN NEW;
  END IF;
  
  -- 1. Créer l'école
  INSERT INTO public.schools (name)
  VALUES (school_name)
  RETURNING id INTO new_school_id;
  
  -- 2. Créer le profil lié à l'école
  INSERT INTO public.profiles (id, school_id, full_name, email)
  VALUES (NEW.id, new_school_id, COALESCE(user_full_name, ''), NEW.email);
  
  -- 3. Attribuer le rôle admin_school
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin_school');
  
  RETURN NEW;
END;
$$;

-- Trigger sur auth.users pour inscription automatique
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_school_signup();

-- 7. POLITIQUES RLS
-- =====================================================

-- SCHOOLS
-- Les utilisateurs authentifiés peuvent voir leur propre école
CREATE POLICY "Users can view own school"
ON public.schools FOR SELECT
TO authenticated
USING (id = public.get_user_school_id(auth.uid()));

-- Les admins peuvent modifier leur école
CREATE POLICY "Admins can update own school"
ON public.schools FOR UPDATE
TO authenticated
USING (
  id = public.get_user_school_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin_school')
)
WITH CHECK (
  id = public.get_user_school_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin_school')
);

-- PROFILES
-- Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Les admins peuvent voir tous les profils de leur école
CREATE POLICY "Admins can view school profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin_school')
);

-- Les utilisateurs peuvent modifier leur propre profil (sauf school_id)
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- USER_ROLES
-- Les admins peuvent voir les rôles des utilisateurs de leur école
CREATE POLICY "Admins can view school user roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
    AND p.school_id = public.get_user_school_id(auth.uid())
  )
  AND public.has_role(auth.uid(), 'admin_school')
);

-- Les admins peuvent ajouter des rôles aux utilisateurs de leur école
CREATE POLICY "Admins can insert school user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
    AND p.school_id = public.get_user_school_id(auth.uid())
  )
  AND public.has_role(auth.uid(), 'admin_school')
);

-- Les admins peuvent supprimer des rôles des utilisateurs de leur école
CREATE POLICY "Admins can delete school user roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
    AND p.school_id = public.get_user_school_id(auth.uid())
  )
  AND public.has_role(auth.uid(), 'admin_school')
);