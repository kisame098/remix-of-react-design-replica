# Documentation Technique Supabase - SenClass

> **Dernière mise à jour :** 2025-12-25  
> **Version :** 1.0.0  
> **Statut :** ✅ Implémenté et fonctionnel

---

## 1. Architecture Multi-Tenant

### Principe
L'architecture suit un modèle **Multi-Tenant** où chaque **École** (School) est un tenant isolé. Les données appartiennent à l'école, pas à l'utilisateur individuel.

```
┌─────────────────────────────────────────────────────────┐
│                     auth.users                          │
│                 (Gestion Supabase)                      │
└─────────────────────┬───────────────────────────────────┘
                      │ 1:1
                      ▼
┌─────────────────────────────────────────────────────────┐
│                     profiles                            │
│              (Extension utilisateur)                    │
│         ┌──────────────────────────────┐               │
│         │ id (FK → auth.users)         │               │
│         │ school_id (FK → schools)     │◄──────────────┤
│         │ full_name                    │               │
│         │ email                        │               │
│         └──────────────────────────────┘               │
└─────────────────────┬───────────────────────────────────┘
                      │ N:1
                      ▼
┌─────────────────────────────────────────────────────────┐
│                     schools                             │
│                  (Tenant/École)                         │
│         ┌──────────────────────────────┐               │
│         │ id (PK)                      │               │
│         │ name                         │               │
│         │ subscription_status          │               │
│         │ created_at (immuable)        │               │
│         └──────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   user_roles                            │
│               (Rôles séparés)                           │
│         ┌──────────────────────────────┐               │
│         │ user_id (FK → auth.users)    │               │
│         │ role (app_role enum)         │               │
│         └──────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Conventions de Nommage

| Élément          | Convention       | Exemple                |
|------------------|------------------|------------------------|
| Tables           | snake_case       | `user_roles`           |
| Colonnes         | snake_case       | `school_id`, `created_at` |
| Enums            | snake_case       | `app_role`, `subscription_status` |
| Fonctions        | snake_case       | `handle_new_school_signup` |
| Policies         | Description claire | "Users can view own profile" |

---

## 3. Schéma de Base de Données

### 3.1 Types et Enums

```sql
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
```

### 3.2 Table `schools`

```sql
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_schools_subscription_status ON public.schools(subscription_status);

-- Le created_at est IMMUABLE (important pour calcul période d'essai)
```

### 3.3 Table `profiles`

```sql
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
```

### 3.4 Table `user_roles`

```sql
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Index pour vérification rapide des rôles
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
```

---

## 4. Fonctions de Sécurité

### 4.1 Vérification de rôle (Security Definer)

```sql
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
```

### 4.2 Récupération du school_id de l'utilisateur

```sql
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
```

### 4.3 Fonction d'inscription école (atomique)

```sql
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
  
  -- Si pas de nom d'école, ne pas créer (utilisateur normal)
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
```

---

## 5. Politiques RLS (Row Level Security)

### Règle Fondamentale

```
Access Granted ⟺ User.school_id == Data.school_id
```

### 5.1 Table `schools`

```sql
-- Les admins peuvent voir leur propre école
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
);
```

### 5.2 Table `profiles`

```sql
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

-- Les utilisateurs peuvent modifier leur propre profil
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());
```

### 5.3 Table `user_roles`

```sql
-- Lecture seule pour les admins de l'école
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
```

---

## 6. Journal des Modifications

| Date       | Version | Action                                      |
|------------|---------|---------------------------------------------|
| 2025-12-25 | 1.0.0   | Création initiale : schools, profiles, user_roles |
| 2025-12-25 | 1.0.0   | Implémentation RLS multi-tenant            |
| 2025-12-25 | 1.0.0   | Fonction atomique d'inscription école      |

---

## 7. Prochaines Tables (Futures)

Les tables suivantes seront liées au `school_id` :

- `students` - Élèves de l'école
- `teachers` - Professeurs (liés via profiles)
- `classes` - Classes
- `subjects` - Matières
- `grades` - Notes
- `payments` - Paiements

Toutes suivront la règle RLS : `school_id = get_user_school_id(auth.uid())`
