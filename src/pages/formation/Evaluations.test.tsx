import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// ════════════════════════════════════════════════════════════════════════════
// Évaluations — étape 1 : choisir une promotion (même grille que
// Gestion des Notes, src/pages/GradeManagement.tsx, pour choisir une classe).
// ════════════════════════════════════════════════════════════════════════════

const ctx = {
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', ordering: 0, createdAt: '', active: true }],
  niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '' }],
  promotions: [{ id: 'p1', niveauId: 'n1', classId: 'c1', name: 'CAP 1 — Promo Septembre 2026', studentLimit: 30, rythme: 'jour' as const, startDate: '2026-09-01', endDate: '2027-06-30', status: 'active' as const, createdAt: '' }],
  evaluations: [{ id: 'e1', promotionId: 'p1', niveauMatiereId: 'nm1', periodeId: 'per1', categorieId: 'cc', type: 'Devoir', title: 'Devoir 1', date: '2026-09-18', bareme: 20, poids: 1, createdAt: '' }],
};
const navigateMock = vi.fn();
vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => ctx }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import Evaluations from './Evaluations';

const rendre = () => render(<MemoryRouter><Evaluations /></MemoryRouter>);

describe('Évaluations — choisir une promotion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche les promotions groupées par formation et niveau, avec le nombre d\'évaluations', () => {
    rendre();
    expect(screen.getByText('CAP Restauration')).toBeInTheDocument();
    expect(screen.getByText('CAP 1')).toBeInTheDocument();
    expect(screen.getByText('CAP 1 — Promo Septembre 2026')).toBeInTheDocument();
    expect(screen.getByText('1 évaluation')).toBeInTheDocument();
  });

  it('cliquer une promotion navigue vers sa page dédiée', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('CAP 1 — Promo Septembre 2026'));
    expect(navigateMock).toHaveBeenCalledWith('/formation/evaluations/p1');
  });

  it('aucune promotion créée : invite à en créer une', () => {
    const original = ctx.promotions;
    ctx.promotions = [];
    rendre();
    expect(screen.getByText('Aucune promotion créée')).toBeInTheDocument();
    ctx.promotions = original;
  });
});
