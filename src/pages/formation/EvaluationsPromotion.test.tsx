import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// jsdom n'implémente pas l'API Pointer Capture que Radix UI (le <Select>)
// utilise en interne — sans ce filet, tout clic dans un <SelectItem> plante.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// ════════════════════════════════════════════════════════════════════════════
// Évaluations — un seul espace de travail par promotion : périodes en
// pastilles, catégories du barème en blocs, matières en sidebar, saisie des
// notes avec sauvegarde automatique.
// ════════════════════════════════════════════════════════════════════════════

const ctx = {
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', ordering: 0, createdAt: '', active: true }],
  niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '' }],
  niveauMatieres: [
    { id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'TP Cuisine', type: 'obligatoire' as const, coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 },
    { id: 'nm2', niveauId: 'n1', matiereId: 'm2', matiereName: 'Français', type: 'obligatoire' as const, coefficient: 2, nature: 'theorique' as const, ordering: 1 },
  ],
  baremeCategories: [
    { id: 'cc', formationId: 'f1', name: 'Contrôle continu', pourcentage: 30, ordering: 0 },
    { id: 'tp', formationId: 'f1', name: 'TP', pourcentage: 30, ordering: 1 },
    { id: 'eb', formationId: 'f1', name: 'Examen blanc', pourcentage: 10, ordering: 2 },
    { id: 'ef', formationId: 'f1', name: 'Examen final', pourcentage: 30, ordering: 3 },
  ],
  promotions: [{ id: 'p1', niveauId: 'n1', classId: 'c1', name: 'CAP 1 — Promo Septembre 2026', studentLimit: 30, rythme: 'jour' as const, startDate: '2026-09-01', endDate: '2027-06-30', status: 'active' as const, createdAt: '' }],
  periodes: [{ id: 'per1', promotionId: 'p1', name: 'Semestre 1', ordering: 0 }],
  evaluations: [{ id: 'e1', promotionId: 'p1', niveauMatiereId: 'nm1', periodeId: 'per1', categorieId: 'cc', type: 'Devoir', title: 'Devoir 1', date: '2026-09-18', bareme: 20, poids: 1, createdAt: '' }],
  notes: [{ id: 'note1', evaluationId: 'e1', studentEnrollmentId: 's1', valeur: 14, statut: 'note' as const }],
  addPeriode: vi.fn().mockResolvedValue({ id: 'pernew' }),
  deletePeriode: vi.fn().mockResolvedValue(undefined),
  addEvaluation: vi.fn().mockResolvedValue({ id: 'enew' }),
  deleteEvaluation: vi.fn().mockResolvedValue(undefined),
  saisirNote: vi.fn().mockResolvedValue(undefined),
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

describe('EvaluationsPromotion — périodes, catégories en blocs, matières en sidebar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sélectionne la seule période et affiche les 4 catégories en blocs', () => {
    rendre();
    expect(screen.getByRole('heading', { name: 'CAP 1 — Promo Septembre 2026' })).toBeInTheDocument();
    expect(screen.getByText('Semestre 1')).toBeInTheDocument();
    expect(screen.getByText('Contrôle continu')).toBeInTheDocument();
    expect(screen.getByText('TP')).toBeInTheDocument();
    expect(screen.getByText('Examen blanc')).toBeInTheDocument();
    expect(screen.getByText('Examen final')).toBeInTheDocument();
  });

  it('les matières sont dans une sidebar', () => {
    rendre();
    expect(screen.getByText('Matières')).toBeInTheDocument();
    expect(screen.getByText('TP Cuisine')).toBeInTheDocument();
    expect(screen.getByText('Français')).toBeInTheDocument();
  });

  it('cliquer une matière (catégorie Contrôle continu déjà sélectionnée par défaut) affiche ses évaluations et les notes déjà saisies', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('TP Cuisine'));
    expect(screen.getAllByText('Devoir 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Diop')).toBeInTheDocument();
    const ligneAwa = screen.getByText('Diop').closest('tr')!;
    expect(within(ligneAwa).getByRole('spinbutton')).toHaveValue(14);
  });

  it('changer de catégorie masque les évaluations d\'une autre catégorie', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('TP Cuisine'));
    expect(screen.getAllByText('Devoir 1').length).toBeGreaterThan(0);
    await user.click(screen.getByText('TP'));
    expect(screen.queryByText('Devoir 1')).not.toBeInTheDocument();
    expect(screen.getByText(/Aucune évaluation pour/)).toBeInTheDocument();
  });

  it('modifier une note l\'enregistre après un court délai (sauvegarde automatique)', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('TP Cuisine'));
    const ligneMoussa = screen.getByText('Fall').closest('tr')!;
    const input = within(ligneMoussa).getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '18');
    expect(ctx.saisirNote).not.toHaveBeenCalled();
    await new Promise(resolve => setTimeout(resolve, 900));
    expect(ctx.saisirNote).toHaveBeenCalledWith('e1', 's2', { valeur: 18, statut: 'note' });
  }, 10000);

  it('crée une nouvelle évaluation sans avoir à re-choisir la matière, la période ou la catégorie', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('TP Cuisine'));
    await user.click(screen.getByRole('button', { name: /Nouvelle évaluation/ }));
    await user.type(screen.getByLabelText('Titre *'), 'Contrôle pratique n°2');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(ctx.addEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      promotionId: 'p1', niveauMatiereId: 'nm1', periodeId: 'per1', categorieId: 'cc', title: 'Contrôle pratique n°2',
    }));
  });

  it('crée une nouvelle période', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByTitle('Nouvelle période'));
    await user.type(screen.getByLabelText('Nom *'), 'Semestre 2');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(ctx.addPeriode).toHaveBeenCalledWith('p1', { name: 'Semestre 2' });
  });

  it('aucune période créée : invite à en créer une, pas de catégories affichées', () => {
    const original = ctx.periodes;
    ctx.periodes = [];
    rendre();
    expect(screen.getByText(/Aucune période/)).toBeInTheDocument();
    expect(screen.queryByText('Contrôle continu')).not.toBeInTheDocument();
    ctx.periodes = original;
  });

  it('formation sans formule d\'évaluation : message d\'aide, pas de matières affichées', () => {
    const original = ctx.baremeCategories;
    ctx.baremeCategories = [];
    rendre();
    expect(screen.getByText(/Aucune formule d'évaluation définie/)).toBeInTheDocument();
    expect(screen.queryByText('Matières')).not.toBeInTheDocument();
    ctx.baremeCategories = original;
  });
});
