import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

// ════════════════════════════════════════════════════════════════════════════
// LE BUG : on travaille (une fenêtre ouverte, un formulaire à moitié rempli), on va
// voir un PDF dans un autre onglet, on revient — et tout est remis à zéro.
//
// À chaque retour sur l'onglet, la bibliothèque d'authentification envoie un
// événement SIGNED_IN pour la session DÉJÀ ouverte. L'application le traitait comme
// une nouvelle connexion : « chargement en cours », l'écran d'attente remplaçait
// toute la page, et tout ce qui était en cours disparaissait.
//
// Ce test fait tourner le vrai AuthProvider avec un faux client Supabase.
// ════════════════════════════════════════════════════════════════════════════

type Rappel = (event: string, session: unknown) => void;
const etat = vi.hoisted(() => ({ rappel: null as null | ((e: string, s: unknown) => void), requetes: [] as string[] }));

const SESSION = {
  access_token: 'jeton-1', refresh_token: 'r-1', expires_at: 9999999999,
  user: { id: 'u1', email: 'dir@ecole.sn' },
};

vi.mock('@/integrations/supabase/client', () => {
  const reponses: Record<string, unknown> = {
    profiles: { id: 'u1', full_name: 'Directeur' },
    schools: { id: 's1', name: 'École Test', settings: {} },
    school_members: { role: 'admin', permissions: [] },
  };
  const requete = (table: string) => {
    etat.requetes.push(table);
    const chaine: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'is', 'not', 'in']) chaine[m] = () => chaine;
    chaine.maybeSingle = () => Promise.resolve({ data: reponses[table] ?? null, error: null });
    chaine.single = chaine.maybeSingle;
    return chaine;
  };
  return {
    supabase: {
      from: (t: string) => requete(t),
      rpc: (nom: string) => Promise.resolve(nom === 'get_my_membership_school_id' ? { data: 's1', error: null } : { data: null, error: null }),
      auth: {
        onAuthStateChange: (cb: Rappel) => { etat.rappel = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
        getSession: () => Promise.resolve({ data: { session: SESSION } }),
        signOut: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

vi.mock('@/lib/notificationsPush', () => ({ retirerAbonnementDuCompte: vi.fn() }));

import { AuthProvider, useAuth } from './AuthContext';

/** Comme ProtectedRoute : pendant le chargement, l'écran d'attente REMPLACE la page. */
const Page = () => {
  const { loading, accountRole } = useAuth();
  if (loading || !accountRole) return <div>attente</div>;
  return <Travail />;
};

/** Du « travail en cours » : un état local, qui disparaît si la page est démontée. */
let montages = 0;
const Travail = () => {
  const [saisie, setSaisie] = useState('');
  montages++;
  return <input aria-label="formulaire" value={saisie} onChange={e => setSaisie(e.target.value)} />;
};

const monter = async () => {
  montages = 0; etat.requetes = [];
  render(<AuthProvider><Page /></AuthProvider>);
  await screen.findByLabelText('formulaire');
  fireEvent.change(screen.getByLabelText('formulaire'), { target: { value: 'Awa Diop — brouillon' } });
};

const emettre = (evenement: string, session: unknown = SESSION) =>
  act(async () => { etat.rappel!(evenement, session); await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => { localStorage.clear(); });

describe('retour sur l\'onglet : le travail en cours survit', () => {
  it('SIGNED_IN pour la session DÉJÀ ouverte (ce que Supabase envoie à chaque retour) : rien ne bouge', async () => {
    await monter();
    const montagesAvant = montages;

    await emettre('SIGNED_IN');

    // La page n'a pas été démontée : ni écran d'attente, ni remontage, ni saisie perdue.
    expect(screen.queryByText('attente')).toBeNull();
    expect((screen.getByLabelText('formulaire') as HTMLInputElement).value).toBe('Awa Diop — brouillon');
    expect(montages).toBe(montagesAvant);
  });

  it('… et ne recharge pas le profil, l\'école ni le rôle pour rien', async () => {
    await monter();
    etat.requetes = [];
    await emettre('SIGNED_IN');
    expect(etat.requetes).toEqual([]);
  });

  it('plusieurs retours d\'onglet de suite : toujours rien', async () => {
    await monter();
    for (let i = 0; i < 5; i++) await emettre('SIGNED_IN');
    expect((screen.getByLabelText('formulaire') as HTMLInputElement).value).toBe('Awa Diop — brouillon');
  });

  it('le jeton renouvelé (TOKEN_REFRESHED) ne change rien non plus', async () => {
    await monter();
    await emettre('TOKEN_REFRESHED', { ...SESSION, access_token: 'jeton-2' });
    expect((screen.getByLabelText('formulaire') as HTMLInputElement).value).toBe('Awa Diop — brouillon');
  });

  it('un nouveau jeton reçu au retour est bien retenu (les comptes liés en ont besoin)', async () => {
    await monter();
    let jetonVu = '';
    const Sonde = () => { jetonVu = useAuth().session?.access_token ?? ''; return null; };
    render(<AuthProvider><Sonde /></AuthProvider>);
    await waitFor(() => expect(jetonVu).toBe('jeton-1'));
    await emettre('SIGNED_IN', { ...SESSION, access_token: 'jeton-2' });
    expect(jetonVu).toBe('jeton-2');
  });
});

describe('les vrais changements de compte, eux, rechargent bien', () => {
  it('un AUTRE utilisateur se connecte : l\'application recharge son profil', async () => {
    await monter();
    etat.requetes = [];
    await emettre('SIGNED_IN', { ...SESSION, user: { id: 'u2', email: 'autre@ecole.sn' } });
    await waitFor(() => expect(etat.requetes).toContain('profiles'));
  });

  it('la déconnexion vide bien la session', async () => {
    await monter();
    await emettre('SIGNED_OUT', null);
    await waitFor(() => expect(screen.getByText('attente')).toBeInTheDocument());
  });
});
