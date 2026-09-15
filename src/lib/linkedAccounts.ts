import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// ─── Comptes liés (portail) ──────────────────────────────────────────────────
// Permet à un même appareil de garder plusieurs comptes élève/prof "à portée
// de main" (ex: un parent avec plusieurs enfants scolarisés) et de basculer
// instantanément de l'un à l'autre — SANS repasser par un vrai écran de
// connexion à chaque fois. Ce n'est pas un nouveau rôle "parent" côté base de
// données : chaque compte lié reste un compte élève/prof normal, avec
// exactement les mêmes droits qu'avant (rien ne change côté RLS). Le lien est
// purement local à cet appareil (localStorage), jamais synchronisé.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const STORAGE_KEY = 'teranga_linked_accounts';

export interface LinkedAccount {
  userId: string;        // auth.users.id
  email: string;
  displayName: string;
  displayId: string;     // ETU-... ou PROF-...
  role: 'student' | 'teacher';
  schoolName: string;
  photoUrl?: string;
  accessToken: string;
  refreshToken: string;
  addedAt: string;       // ISO — première fois que ce compte a été lié sur cet appareil
}

const readAll = (): LinkedAccount[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LinkedAccount[]) : [];
  } catch {
    return [];
  }
};

const writeAll = (accounts: LinkedAccount[]): void => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts)); } catch { /* ignore */ }
};

export const getLinkedAccounts = (): LinkedAccount[] =>
  readAll().sort((a, b) => a.displayName.localeCompare(b.displayName));

/** Ajoute ou met à jour une entrée (conserve `addedAt` d'origine si déjà présent). */
export const upsertLinkedAccount = (account: Omit<LinkedAccount, 'addedAt'> & { addedAt?: string }): void => {
  const accounts = readAll();
  const idx = accounts.findIndex(a => a.userId === account.userId);
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...account, addedAt: accounts[idx].addedAt };
  } else {
    accounts.push({ ...account, addedAt: account.addedAt ?? new Date().toISOString() });
  }
  writeAll(accounts);
};

export const removeLinkedAccount = (userId: string): void => {
  writeAll(readAll().filter(a => a.userId !== userId));
};

/**
 * Authentifie un autre compte élève/prof SANS toucher à la session active —
 * passe par un client Supabase jetable, dédié à cette seule requête.
 */
export const addLinkedAccount = async (email: string, password: string): Promise<LinkedAccount> => {
  const tempClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await tempClient.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(
      error?.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect'
        : (error?.message ?? 'Échec de connexion'),
    );
  }

  const { data: acct, error: acctError } = await tempClient
    .from('school_accounts')
    .select('role, display_name, display_id, school_name, student_enrollment_id')
    .eq('auth_user_id', data.user.id)
    .single();

  if (acctError || !acct || (acct.role !== 'student' && acct.role !== 'teacher')) {
    throw new Error("Ce compte n'est pas un compte élève ou professeur du portail");
  }

  let photoUrl: string | undefined;
  if (acct.role === 'student' && acct.student_enrollment_id) {
    const { data: enrollData } = await tempClient
      .from('student_enrollments')
      .select('student_profiles(photo_url)')
      .eq('id', acct.student_enrollment_id)
      .single();
    if (enrollData?.student_profiles) {
      photoUrl = (enrollData.student_profiles as { photo_url: string | null }).photo_url ?? undefined;
    }
  }

  const linked: LinkedAccount = {
    userId:       data.user.id,
    email,
    displayName:  acct.display_name,
    displayId:    acct.display_id,
    role:         acct.role as 'student' | 'teacher',
    schoolName:   acct.school_name,
    photoUrl,
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
    addedAt:      new Date().toISOString(),
  };

  // Ne JAMAIS signOut() ce client jetable : ça révoquerait le refresh_token
  // qu'on vient de sauvegarder, rendant le compte lié inutilisable direct.
  upsertLinkedAccount(linked);
  return linked;
};

/**
 * Bascule la session active de l'app vers un compte déjà lié. Ce n'est PAS une
 * déconnexion : toute l'app recharge son contexte pour cette nouvelle identité
 * (AuthContext réagit normalement à onAuthStateChange).
 */
export const switchToLinkedAccount = async (account: LinkedAccount): Promise<void> => {
  const { data, error } = await supabase.auth.setSession({
    access_token:  account.accessToken,
    refresh_token: account.refreshToken,
  });
  if (error || !data.session) {
    removeLinkedAccount(account.userId);
    throw new Error('Session expirée pour ce compte — reconnectez-vous avec son mot de passe.');
  }
  // Le refresh_token peut avoir tourné : on garde l'entrée à jour pour la prochaine fois.
  upsertLinkedAccount({ ...account, accessToken: data.session.access_token, refreshToken: data.session.refresh_token });
};
