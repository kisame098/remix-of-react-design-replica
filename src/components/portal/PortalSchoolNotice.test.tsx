import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PortalSchoolNotice from './PortalSchoolNotice';

// ════════════════════════════════════════════════════════════════════════════
// LE BANDEAU VU PAR L'ÉLÈVE.
//
// Deux erreurs possibles, symétriques : ne pas prévenir une famille dont
// l'école est en défaut, ou alarmer pour rien une famille dont l'école est à
// jour. Ce composant est minuscule, mais il s'affiche sur CHAQUE écran du
// portail — c'est la première chose que l'élève lit.
// ════════════════════════════════════════════════════════════════════════════

const useAuthMock = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const monter = (accountRole: string | null, statut: string | null, echeance = '2020-01-01') => {
  useAuthMock.mockReturnValue({
    accountRole,
    school: statut === null ? null
      : { subscription_status: statut, subscription_expires_at: echeance },
  });
  render(
    <MemoryRouter initialEntries={['/portail']}>
      <Routes>
        <Route element={<PortalSchoolNotice />}>
          <Route path="/portail" element={<p>contenu du portail</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

const bandeau = () => screen.queryByRole('status');

beforeEach(() => useAuthMock.mockReset());

describe('bandeau « école impayée »', () => {
  it('prévient l\'élève quand son école est suspendue', () => {
    monter('student', 'suspended');
    expect(bandeau()).toBeInTheDocument();
    expect(bandeau()!.textContent).toContain('n\'a pas encore réglé son abonnement');
  });

  it.each(['cancelled', 'trial'])('prévient aussi sur un abonnement « %s » terminé', (statut) => {
    monter('student', statut, '2020-01-01');
    expect(bandeau()).toBeInTheDocument();
  });

  it('RASSURE sur l\'accès aux données — l\'élève ne perd rien', () => {
    monter('student', 'suspended');
    const texte = bandeau()!.textContent ?? '';
    expect(texte).toContain('restent accessibles');
    // Le message ne réclame rien à l'élève : il n'y peut rien.
    expect(texte.toLowerCase()).not.toContain('payez');
    expect(texte.toLowerCase()).not.toContain('régularisez');
  });

  it('N\'AFFICHE RIEN quand l\'école est à jour', () => {
    monter('student', 'active', '2099-01-01');
    expect(bandeau()).not.toBeInTheDocument();
  });

  it('n\'alarme pas pour un abonnement PAYANT échu — le système ne coupe jamais seul', () => {
    monter('student', 'active', '2020-01-01');
    expect(bandeau()).not.toBeInTheDocument();
  });

  it('ne s\'affiche pas pour un professeur : lui est renvoyé vers l\'écran d\'abonnement', () => {
    monter('teacher', 'suspended');
    expect(bandeau()).not.toBeInTheDocument();
  });

  it('ne s\'affiche pas tant que l\'école n\'est pas chargée', () => {
    monter('student', null);
    expect(bandeau()).not.toBeInTheDocument();
  });

  it('LAISSE TOUJOURS PASSER LE CONTENU du portail, bandeau ou non', () => {
    // Le point capital : informer ne doit jamais retirer l'accès.
    monter('student', 'suspended');
    expect(screen.getByText('contenu du portail')).toBeInTheDocument();
  });
});
