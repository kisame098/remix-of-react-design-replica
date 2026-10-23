import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { nomDuCompte } from '@/lib/nomCompte';

// ════════════════════════════════════════════════════════════════════════════
// LE BUG : trois encaissements de La Recherche (reçus 266, 300, 301, octobre
// 2026) sont partis avec « Encaissé par : Non renseigné ». Le même compte, dans
// la même matinée, encaissait avant et après AVEC son nom : un onglet n'avait
// pas pu lire la fiche profil au démarrage, l'erreur était ignorée, le rôle se
// chargeait quand même — et l'onglet vivait sans profil.
//
// Ce test fait tourner le vrai AuthProvider avec une lecture du profil qui échoue.
// ════════════════════════════════════════════════════════════════════════════

const etat = vi.hoisted(() => ({ echecsProfil: 0 }));

const SESSION = {
  access_token: 'jeton-1', refresh_token: 'r-1', expires_at: 9999999999,
  user: { id: 'u1', email: 'caisse@ecole.sn' },
};

vi.mock('@/integrations/supabase/client', () => {
  const reponses: Record<string, unknown> = {
    profiles: { id: 'u1', full_name: 'MADAME MANE', email: 'caisse@ecole.sn' },
    schools: { id: 's1', name: 'École Test', settings: {} },
    school_members: { role: 'staff', permissions: ['payments'] },
  };
  const requete = (table: string) => {
    const chaine: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'is', 'not', 'in']) chaine[m] = () => chaine;
    chaine.maybeSingle = () => {
      if (table === 'profiles' && etat.echecsProfil > 0) {
        etat.echecsProfil -= 1;
        return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
      }
      return Promise.resolve({ data: reponses[table] ?? null, error: null });
    };
    chaine.single = chaine.maybeSingle;
    return chaine;
  };
  return {
    supabase: {
      from: (t: string) => requete(t),
      rpc: (nom: string) => Promise.resolve(nom === 'get_my_membership_school_id' ? { data: 's1', error: null } : { data: null, error: null }),
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
        getSession: () => Promise.resolve({ data: { session: SESSION } }),
        signOut: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

vi.mock('@/lib/notificationsPush', () => ({ retirerAbonnementDuCompte: vi.fn() }));

import { AuthProvider, useAuth } from './AuthContext';

/** Ce que la caisse écrirait dans « Encaissé par » à cet instant. */
const Caisse = () => {
  const { accountRole, profile, user } = useAuth();
  if (!accountRole) return <div>attente</div>;
  return <div>encaissé par : {nomDuCompte(profile, user) ?? 'VIDE'}</div>;
};

describe('profil illisible au démarrage : « Encaissé par » reste renseigné', () => {
  beforeEach(() => { localStorage.clear(); });

  it('une erreur passagère : on relit, et le nom revient', async () => {
    etat.echecsProfil = 1;
    render(<AuthProvider><Caisse /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('encaissé par : MADAME MANE')).toBeTruthy());
  });

  it("le profil reste illisible : l'e-mail de connexion prend le relais, jamais vide", async () => {
    etat.echecsProfil = 2;
    render(<AuthProvider><Caisse /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('encaissé par : caisse@ecole.sn')).toBeTruthy());
  });
});
