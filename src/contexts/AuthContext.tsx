import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, School } from '@/lib/supabase';
import type { Json } from '@/integrations/supabase/types';
import { getSubscriptionGate } from '@/lib/subscription';
import { confirmationRequise, adresseRetourConfirmation } from '@/lib/confirmationEmail';
import { enregistrer, lire, effacerUtilisateur } from '@/lib/cacheHorsLigne';
import { retirerAbonnementDuCompte } from '@/lib/notificationsPush';
import { actionPourEvenement } from '@/lib/evenementsAuth';

// platform_admins n'est pas encore dans les types générés (table ajoutée
// après la dernière génération) — cast localisé, comme ailleurs dans l'app
// pour les tables toutes neuves (voir sbElementary dans SchoolContext.tsx).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbPlatform = supabase as any;

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AccountRole = 'admin' | 'staff' | 'student' | 'teacher';

export interface SchoolAccount {
  id: string;
  schoolId: string;
  authUserId: string;
  role: 'student' | 'teacher';
  studentEnrollmentId?: string;
  teacherEnrollmentId?: string;
  email: string;
  displayName: string;
  displayId: string;
  className?: string;
  schoolName: string;
  isActive: boolean;
  createdAt: string;
  photoUrl?: string;       // photo de profil (élèves)
}

interface AuthContextType {
  session:      Session | null;
  user:         User | null;
  profile:      Profile | null;
  school:       School | null;
  loading:      boolean;
  authLoading:  boolean;

  /** Rôle de l'utilisateur connecté (null = inconnu / non chargé) */
  accountRole:  AccountRole | null;
  /** Permissions du personnel (staff) — vide/ignoré pour admin (accès total) */
  staffPermissions: string[];
  /** Données du compte élève/prof (null pour les admins) */
  schoolAccount: SchoolAccount | null;
  /** Compte "chef du système" — pilote toutes les écoles, n'appartient à aucune (orthogonal à accountRole, qui reste null pour lui). */
  isPlatformAdmin: boolean;
  /** L'abonnement ferme-t-il l'accès aux données de l'école ? (suspendu, annulé,
   *  essai écoulé). Les policies bloquent déjà tout côté serveur : ce drapeau
   *  évite aux écrans de lancer des requêtes qui ne peuvent que revenir vides —
   *  et surtout d'en déduire « école neuve, il faut tout initialiser ». */
  isSchoolAccessBlocked: boolean;

  /** `confirmationRequise` : Supabase a créé le compte mais attend que le
   *  directeur clique le lien reçu par e-mail (réglage Supabase, pas code). */
  signUp:        (params: SignUpParams) => Promise<{ error: AuthError | null; confirmationRequise: boolean }>;
  signIn:        (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut:       () => Promise<void>;
  updateProfile: (data: Partial<Pick<Profile, 'full_name' | 'avatar_url'>>) => Promise<void>;
  /** Infos générales de l'école (nom, ville, logo...) — Paramètres */
  updateSchool:  (data: Partial<Pick<School, 'name' | 'city' | 'country' | 'phone' | 'email' | 'logo_url'>>) => Promise<void>;
  /** Fusionne des clés dans schools.settings (jsonb) — ex: heures d'emploi du temps */
  updateSchoolSettings: (data: Record<string, unknown>) => Promise<void>;
}

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  schoolName: string;
}

/** Ce qu'on garde sur l'appareil pour reconnaître le compte hors connexion. */
interface IdentiteMemorisee {
  profile: unknown;
  school: unknown;
  accountRole: AccountRole | null;
  staffPermissions: string[];
  schoolAccount: SchoolAccount | null;
  isPlatformAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session,       setSession]       = useState<Session | null>(null);
  const [user,          setUser]          = useState<User | null>(null);
  const [profile,       setProfile]       = useState<Profile | null>(null);
  const [school,        setSchool]        = useState<School | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [authLoading,   setAuthLoading]   = useState(false);
  const [accountRole,   setAccountRole]   = useState<AccountRole | null>(null);
  const [staffPermissions, setStaffPermissions] = useState<string[]>([]);
  const [schoolAccount, setSchoolAccount] = useState<SchoolAccount | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  // Lus depuis des écouteurs (retour du réseau, renouvellement du jeton) qui
  // ne voient pas l'état React à jour : on les tient aussi dans des refs.
  const userIdRef    = useRef<string | null>(null);
  const roleConnuRef = useRef(false);
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user]);
  useEffect(() => { roleConnuRef.current = accountRole !== null || isPlatformAdmin; }, [accountRole, isPlatformAdmin]);

  // Dès que l'identité est connue, on la garde sur l'appareil : c'est elle qui
  // permettra d'ouvrir l'application hors connexion sans rester bloqué.
  useEffect(() => {
    if (!user?.id) return;
    if (!accountRole && !isPlatformAdmin) return;   // rien d'utile à mémoriser
    enregistrer(user.id, 'identite', {
      profile, school, accountRole, staffPermissions, schoolAccount, isPlatformAdmin,
    });
  }, [user?.id, profile, school, accountRole, staffPermissions, schoolAccount, isPlatformAdmin]);

  // ── Identité gardée sur l'appareil ──────────────────────────────────────────
  // Le rôle d'un utilisateur se lit dans la base. Sans réseau, l'application
  // ne saurait plus s'il est directeur, élève ou professeur, et resterait
  // bloquée sur « hors connexion ». On garde donc la dernière identité connue,
  // par compte, effacée à la déconnexion.
  const appliquerIdentite = useCallback((i: IdentiteMemorisee) => {
    setProfile(i.profile as Profile | null);
    setSchool(i.school as School | null);
    setAccountRole(i.accountRole);
    setStaffPermissions(i.staffPermissions ?? []);
    setSchoolAccount(i.schoolAccount);
    setIsPlatformAdmin(!!i.isPlatformAdmin);
  }, []);

  // ── Chargement profil + rôle ────────────────────────────────────────────────
  const loadUserData = useCallback(async (userId: string) => {
    // Hors connexion : inutile d'attendre des requêtes qui échoueront.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const memorisee = lire<IdentiteMemorisee>(userId, 'identite');
      if (memorisee) appliquerIdentite(memorisee.donnees);
      return;
    }
    try {
      // 1. Profil utilisateur
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      setProfile(profileData as Profile | null);

      // 1bis. Compte "chef du système" ? N'appartient à aucune école — vérifié
      // AVANT la logique école, car get_my_school_id() renverrait NULL pour lui
      // de toute façon (pas de ligne school_members) et on ne veut pas tomber
      // dans la branche "compte inconnu".
      const { data: platformAdminRow } = await sbPlatform
        .from('platform_admins')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (platformAdminRow) {
        setIsPlatformAdmin(true);
        setAccountRole(null);
        setStaffPermissions([]);
        setSchoolAccount(null);
        setSchool(null);
        return;
      }
      setIsPlatformAdmin(false);

      // 2. Vérifier si c'est un membre de l'école (admin ou personnel).
      //
      // On interroge l'appartenance BRUTE, pas get_my_school_id() : cette
      // dernière renvoie NULL dès que l'abonnement bloque l'accès (suspendu,
      // annulé, essai écoulé — voir docs/sql/subscription_enforcement.sql).
      // L'utiliser ici ferait croire que l'admin d'une école bloquée n'est pas
      // membre du tout : on le chercherait alors parmi les élèves, on n'en
      // trouverait aucun, et il resterait coincé sur « Chargement du profil… »
      // sans jamais voir l'écran qui lui annonce la fin de son essai.
      //
      // Les données de l'école restent fermées par les policies ; ce qu'on
      // charge ici (fiche école + rôle) fait partie des accès de secours
      // prévus exprès pour qu'il puisse constater sa situation et payer.
      const { data: schoolId, error: rpcError } = await sbPlatform.rpc('get_my_membership_school_id');

      if (!rpcError && schoolId) {
        // ── Admin ou secrétaire : charger l'école + distinguer le rôle ──────
        const { data: schoolData } = await supabase
          .from('schools')
          .select('*')
          .eq('id', schoolId)
          .maybeSingle();
        setSchool(schoolData as School | null);

        // maybeSingle : `single()` répond 406 quand il n'y a pas exactement une
        // ligne, et l'absence de ligne est un cas normal, pas une erreur.
        const { data: memberData } = await supabase
          .from('school_members')
          .select('role, permissions')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();
        setAccountRole(memberData?.role === 'staff' ? 'staff' : 'admin');
        setStaffPermissions(memberData?.permissions ?? []);
        setSchoolAccount(null);
      } else {
        // ── Pas admin : vérifier si élève/prof ─────────────────────────────
        // maybeSingle : un utilisateur qui n'est ni membre ni élève/prof est un
        // cas normal (compte orphelin, invitation en cours) — pas un 406.
        const { data: acct } = await supabase
          .from('school_accounts')
          .select('id, school_id, auth_user_id, role, student_enrollment_id, teacher_enrollment_id, email, display_name, display_id, class_name, school_name, is_active, created_at')
          .eq('auth_user_id', userId)
          .maybeSingle();

        if (acct) {
          // Récupérer la photo depuis student_profiles via student_enrollments
          let photoUrl: string | undefined = undefined;
          if (acct.role === 'student' && acct.student_enrollment_id) {
            const { data: enrollData } = await supabase
              .from('student_enrollments')
              .select('student_profiles(photo_url)')
              .eq('id', acct.student_enrollment_id)
              .maybeSingle();
            if (enrollData?.student_profiles) {
              const sp = enrollData.student_profiles as { photo_url: string | null };
              photoUrl = sp.photo_url ?? undefined;
            }
          }

          const mapped: SchoolAccount = {
            id:                   acct.id,
            schoolId:             acct.school_id,
            authUserId:           acct.auth_user_id,
            role:                 acct.role as 'student' | 'teacher',
            studentEnrollmentId:  acct.student_enrollment_id ?? undefined,
            teacherEnrollmentId:  acct.teacher_enrollment_id ?? undefined,
            email:                acct.email,
            displayName:          acct.display_name,
            displayId:            acct.display_id,
            className:            acct.class_name ?? undefined,
            schoolName:           acct.school_name,
            isActive:             acct.is_active,
            createdAt:            acct.created_at,
            photoUrl,
          };
          setSchoolAccount(mapped);
          setAccountRole(acct.role as 'student' | 'teacher');
          // Nom de l'école + état de son abonnement : ce dernier sert au bandeau
          // affiché à l'élève (« ton école n'a pas réglé son abonnement ») et au
          // blocage du professeur, traité comme le personnel.
          const { data: schoolData } = await supabase
            .from('schools')
            .select('id, name, country, city, phone, email, logo_url, settings, subscription_status, subscription_expires_at')
            .eq('id', acct.school_id)
            .maybeSingle();
          setSchool(schoolData as School | null);
        } else {
          // Compte inconnu (ni admin ni élève/prof)
          setAccountRole(null);
          setSchoolAccount(null);
        }
        setStaffPermissions([]);
      }
    } catch {
      // Réseau défaillant : on repart de la dernière identité connue, sinon
      // l'utilisateur resterait devant « Chargement du profil… ».
      const memorisee = lire<IdentiteMemorisee>(userId, 'identite');
      if (memorisee) appliquerIdentite(memorisee.donnees);
    }
  }, [appliquerIdentite]);

  // ── Initialisation ──────────────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // À CHAQUE retour sur l'onglet, la bibliothèque d'authentification envoie
        // SIGNED_IN pour la session DÉJÀ ouverte (elle « récupère » la session
        // après une absence). Rien n'a changé pour l'utilisateur : le traiter
        // comme une nouvelle connexion mettait `loading` à vrai, l'écran d'attente
        // remplaçait TOUTE la page, et une fenêtre ouverte ou un formulaire à moitié
        // rempli disparaissaient dès qu'on revenait d'un autre onglet (aller voir un
        // PDF, par exemple). La décision vit dans src/lib/evenementsAuth.ts.
        const action = actionPourEvenement(event, {
          utilisateurRecu: session?.user?.id ?? null,
          utilisateurCourant: userIdRef.current,
          roleConnu: roleConnuRef.current,
        });

        if (action === 'deconnecter') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setSchool(null);
          setAccountRole(null);
          setStaffPermissions([]);
          setSchoolAccount(null);
          setIsPlatformAdmin(false);
          setLoading(false);
          return;
        }

        // On garde la MÊME référence tant que rien n'a réellement changé : un
        // nouvel objet identique déclencherait, chez tous ceux qui dépendent de
        // `session` ou `user`, des recalculs et des écritures inutiles. Un jeton
        // différent (renouvelé, ou reçu d'un autre onglet) est en revanche bien
        // retenu : les comptes liés y stockent leur jeton de reconnexion.
        setSession(prev => (prev && session && prev.access_token === session.access_token ? prev : session));
        setUser(prev => (prev && session?.user && prev.id === session.user.id && event !== 'USER_UPDATED' ? prev : session?.user ?? null));

        if (action === 'noter-le-jeton') return;

        // Le rôle n'a jamais pu être chargé (application ouverte hors connexion,
        // jeton renouvelé au retour du réseau) : c'est le moment de le charger,
        // sinon l'utilisateur resterait bloqué sur « Chargement du profil… ». Pas
        // de setLoading(true) : il est déjà devant l'écran d'attente, inutile de le
        // faire clignoter.
        if (action === 'charger-le-role') { loadUserData(session!.user.id); return; }

        // Vraie nouvelle connexion : bloquer ProtectedRoute jusqu'à ce que le rôle
        // soit connu (évite le flash du Dashboard pour les élèves/profs).
        setLoading(true);
        loadUserData(session!.user.id).finally(() => setLoading(false));
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  // ── Retour du réseau ────────────────────────────────────────────────────────
  // Ouverte hors connexion, l'application a une session (gardée sur l'appareil)
  // mais pas de rôle (il se lit chez Supabase). Dès que le réseau revient, on
  // recharge le profil : l'écran « Vous êtes hors connexion » cède la place à
  // la bonne page sans que l'utilisateur ait rien à faire.
  useEffect(() => {
    const auRetourDuReseau = () => {
      const id = userIdRef.current;
      if (id && !roleConnuRef.current) loadUserData(id);
    };
    window.addEventListener('online', auRetourDuReseau);
    return () => window.removeEventListener('online', auRetourDuReseau);
  }, [loadUserData]);

  // ── Inscription (admins seulement) ──────────────────────────────────────────
  const signUp = useCallback(async ({ email, password, fullName, schoolName }: SignUpParams) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: adresseRetourConfirmation(window.location.origin),
          data: { full_name: fullName, school_name: schoolName },
        },
      });
      return { error, confirmationRequise: confirmationRequise(data) };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // ── Connexion ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // ── Déconnexion ─────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    // Avant de perdre l'identifiant : effacer les données gardées sur
    // l'appareil pour ce compte (le téléphone peut être partagé).
    effacerUtilisateur(userIdRef.current);
    // Tant que la session existe : le serveur doit savoir de quel compte retirer
    // l'abonnement aux notifications de cet appareil.
    await retirerAbonnementDuCompte();
    await supabase.auth.signOut();
    setProfile(null);
    setSchool(null);
    setAccountRole(null);
    setStaffPermissions([]);
    setSchoolAccount(null);
    setIsPlatformAdmin(false);
  }, []);

  // ── Mise à jour profil ──────────────────────────────────────────────────────
  const updateProfile = useCallback(async (data: Partial<Pick<Profile, 'full_name' | 'avatar_url'>>) => {
    if (!user) return;
    const { data: updated, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    if (updated) setProfile(updated as Profile);
  }, [user]);

  // ── Mise à jour infos école ─────────────────────────────────────────────────
  const updateSchool = useCallback(async (data: Partial<Pick<School, 'name' | 'city' | 'country' | 'phone' | 'email' | 'logo_url'>>) => {
    if (!school) return;
    const { data: updated, error } = await supabase
      .from('schools')
      .update(data)
      .eq('id', school.id)
      .select()
      .single();
    if (error) throw error;
    if (updated) setSchool(updated as School);
  }, [school]);

  // ── Fusion de clés dans schools.settings (jsonb) ────────────────────────────
  const updateSchoolSettings = useCallback(async (data: Record<string, unknown>) => {
    if (!school) return;
    const merged = { ...(school.settings ?? {}), ...data };
    const { data: updated, error } = await supabase
      .from('schools')
      .update({ settings: merged as Json })
      .eq('id', school.id)
      .select()
      .single();
    if (error) throw error;
    if (updated) setSchool(updated as School);
  }, [school]);

  // Un abonnement bloqué ferme les données côté serveur (get_my_school_id →
  // NULL). Les écrans doivent le savoir pour ne pas confondre « rien à lire »
  // avec « école neuve à initialiser » : cette confusion déclenchait une rafale
  // d'INSERT tous refusés en 403, et retardait l'affichage de plusieurs secondes.
  const isSchoolAccessBlocked = !!school
    && !isPlatformAdmin
    && getSubscriptionGate(school.subscription_status, school.subscription_expires_at) !== 'ok';

  return (
    <AuthContext.Provider value={{
      session, user, profile, school,
      loading, authLoading,
      accountRole, staffPermissions, schoolAccount, isPlatformAdmin, isSchoolAccessBlocked,
      signUp, signIn, signOut, updateProfile, updateSchool, updateSchoolSettings,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ──────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
