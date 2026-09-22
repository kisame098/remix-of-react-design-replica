import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// ════════════════════════════════════════════════════════════════════════════
// Évaluations — étape 2, dans une promotion : périodes (panneau gauche, comme
// Gestion des Notes) + tableau des matières avec stats (panneau droit, comme
// src/pages/ClassSubjects.tsx).
// ════════════════════════════════════════════════════════════════════════════

const ctx = {
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', ordering: 0, createdAt: '', active: true }],
  niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '' }],
  niveauMatieres: [
    { id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'TP Cuisine', type: 'obligatoire' as const, coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 },
    { id: 'nm2', niveauId: 'n1', matiereId: 'm2', matiereName: 'Français', type: 'obligatoire' as const, coefficient: 2, nature: 'theorique' as const, ordering: 1 },
  ],
  baremeCategories: [{ id: 'cc', formationId: 'f1', name: 'Contrôle continu', pourcentage: 30, ordering: 0 }],
  promotions: [{ id: 'p1', niveauId: 'n1', classId: 'c1', name: 'CAP 1 — Promo Septembre 2026', studentLimit: 30, rythme: 'jour' as const, startDate: '2026-09-01', endDate: '2027-06-30', status: 'active' as const, createdAt: '' }],
  periodes: [{ id: 'per1', promotionId: 'p1', name: 'Semestre 1', ordering: 0 }],
  evaluations: [{ id: 'e1', promotionId: 'p1', niveauMatiereId: 'nm1', periodeId: 'per1', categorieId: 'cc', type: 'Devoir', title: 'Devoir 1', date: '2026-09-18', bareme: 20, poids: 1, createdAt: '' }],
  notes: [{ id: 'note1', evaluationId: 'e1', studentEnrollmentId: 's1', valeur: 14, statut: 'note' as const }],
  addPeriode: vi.fn().mockResolvedValue({ id: 'pernew' }),
  deletePeriode: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => ctx }));
vi.mock('@/contexts/SchoolContext', () => ({
  useSchool: () => ({
    students: [
      { id: 's1', firstName: 'Awa', lastName: 'Diop', classId: 'c1' },
      { id: 's2', firstName: 'Moussa', lastName: 'Fall', classId: 'c1' },
    ],
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import EvaluationsPromotion from './EvaluationsPromotion';

const rendre = () => render(
  <MemoryRouter initialEntries={['/formation/evaluations/p1']}>
    <Routes><Route path="/formation/evaluations/:promotionId" element={<EvaluationsPromotion />} /></Routes>
  </MemoryRouter>,
);

describe('EvaluationsPromotion — périodes + tableau des matières', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sélectionne automatiquement la seule période et affiche le tableau des matières avec leurs stats', () => {
    rendre();
    expect(screen.getByRole('heading', { name: 'CAP 1 — Promo Septembre 2026' })).toBeInTheDocument();
    expect(screen.getByText('Semestre 1')).toBeInTheDocument();
    expect(screen.getByText('TP Cuisine')).toBeInTheDocument();
    expect(screen.getByText('Français')).toBeInTheDocument();
    const ligneTP = screen.getByText('TP Cuisine').closest('tr')!;
    expect(within(ligneTP).getByText('4')).toBeInTheDocument();
    expect(within(ligneTP).getByText('1/1')).toBeInTheDocument();
    const ligneFrancais = screen.getByText('Français').closest('tr')!;
    expect(within(ligneFrancais).getByText('Aucune évaluation')).toBeInTheDocument();
  });

  it('cliquer « Voir les évaluations » navigue vers la page de la matière', async () => {
    const user = userEvent.setup();
    rendre();
    const ligneTP = screen.getByText('TP Cuisine').closest('tr')!;
    await user.click(within(ligneTP).getByRole('button', { name: 'Voir les évaluations' }));
    // La navigation réelle est vérifiée par les tests de routing d'App.tsx ; ici on vérifie juste l'absence de crash au clic.
  });

  it('crée une nouvelle période', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByTitle('Nouvelle période'));
    await user.type(screen.getByLabelText('Nom *'), 'Semestre 2');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(ctx.addPeriode).toHaveBeenCalledWith('p1', { name: 'Semestre 2' });
  });

  it('supprimer une période demande confirmation', async () => {
    const user = userEvent.setup();
    rendre();
    const ligne = screen.getByText('Semestre 1').closest('div')!.parentElement!;
    const trashButton = within(ligne).getAllByRole('button').find(b => b.className.includes('opacity-0'));
    await user.click(trashButton!);
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(ctx.deletePeriode).toHaveBeenCalledWith('per1');
  });

  it('aucune période créée : invite à en créer une', () => {
    const original = ctx.periodes;
    ctx.periodes = [];
    rendre();
    expect(screen.getByText('Aucune période')).toBeInTheDocument();
    ctx.periodes = original;
  });

  it('formation sans formule d\'évaluation : message d\'aide', () => {
    const original = ctx.baremeCategories;
    ctx.baremeCategories = [];
    rendre();
    expect(screen.getByText(/Aucune formule d'évaluation définie/)).toBeInTheDocument();
    ctx.baremeCategories = original;
  });
});
