import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ════════════════════════════════════════════════════════════════════════════
// PLUS JAMAIS DE ROUE QUI TOURNE À L'INFINI.
//
// Ouverte hors connexion, l'application a une session (gardée sur l'appareil)
// mais pas de rôle (il se lit chez Supabase) : sans ces règles, l'utilisateur
// restait devant « Chargement du profil… » pour toujours.
// ════════════════════════════════════════════════════════════════════════════

const useAuthMock = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

import ProtectedRoute, { DELAI_CHARGEMENT_LENT } from './ProtectedRoute';

let enLigne = true;
Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => enLigne });

const auth = (surcharge: Record<string, unknown> = {}) => ({
  user: { id: 'u1' }, loading: false, accountRole: 'admin', staffPermissions: [],
  isPlatformAdmin: false,
  school: { subscription_status: 'active', subscription_expires_at: null },
  ...surcharge,
});

const monter = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<p>tableau de bord</p>} />
      </Route>
      <Route path="/auth" element={<p>connexion</p>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { useAuthMock.mockReset(); enLigne = true; });
afterEach(() => { enLigne = true; });

describe('ProtectedRoute — attente', () => {
  it('rôle connu : la page s\'affiche', () => {
    useAuthMock.mockReturnValue(auth());
    monter();
    expect(screen.getByText('tableau de bord')).toBeInTheDocument();
  });

  it('en ligne, rôle en cours de chargement : écran d\'attente', () => {
    useAuthMock.mockReturnValue(auth({ accountRole: null }));
    monter();
    expect(screen.getByText('Chargement du profil…')).toBeInTheDocument();
  });

  it('HORS CONNEXION, rôle introuvable : on le DIT au lieu de tourner', () => {
    enLigne = false;
    useAuthMock.mockReturnValue(auth({ accountRole: null }));
    monter();
    expect(screen.getByRole('heading')).toHaveTextContent('Vous êtes hors connexion');
    expect(screen.queryByText('Chargement du profil…')).toBeNull();
  });

  it('hors connexion pendant la vérification de session : même message', () => {
    enLigne = false;
    useAuthMock.mockReturnValue(auth({ loading: true }));
    monter();
    expect(screen.getByRole('heading')).toHaveTextContent('Vous êtes hors connexion');
  });

  it('hors connexion mais rôle DÉJÀ connu : la page reste utilisable', () => {
    // Le réseau tombe en pleine journée : on n'éjecte personne de son écran.
    enLigne = false;
    useAuthMock.mockReturnValue(auth());
    monter();
    expect(screen.getByText('tableau de bord')).toBeInTheDocument();
  });

  it('non connecté : direction la page de connexion, en ligne ou pas', () => {
    enLigne = false;
    useAuthMock.mockReturnValue(auth({ user: null, accountRole: null }));
    monter();
    expect(screen.getByText('connexion')).toBeInTheDocument();
  });
});

describe('ProtectedRoute — réseau lent (en ligne, mais rien n\'arrive)', () => {
  it('propose de réessayer passé le délai', () => {
    vi.useFakeTimers();
    useAuthMock.mockReturnValue(auth({ accountRole: null }));
    monter();
    expect(screen.queryByRole('button', { name: /Réessayer/ })).toBeNull();

    act(() => { vi.advanceTimersByTime(DELAI_CHARGEMENT_LENT); });
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeInTheDocument();
    expect(screen.getByText(/connexion est peut-être lente/)).toBeInTheDocument();
  });

  it('pas avant le délai : un chargement normal ne doit pas inquiéter', () => {
    vi.useFakeTimers();
    useAuthMock.mockReturnValue(auth({ accountRole: null }));
    monter();
    act(() => { vi.advanceTimersByTime(DELAI_CHARGEMENT_LENT - 1); });
    expect(screen.queryByRole('button', { name: /Réessayer/ })).toBeNull();
  });

  it('le délai reste raisonnable : ni panique, ni attente sans fin', () => {
    expect(DELAI_CHARGEMENT_LENT).toBeGreaterThanOrEqual(8_000);
    expect(DELAI_CHARGEMENT_LENT).toBeLessThanOrEqual(30_000);
  });
});
