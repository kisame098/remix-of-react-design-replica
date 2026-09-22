import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// jsdom n'implémente pas l'API Pointer Capture que Radix UI (le <Select>)
// utilise en interne — sans ce filet, tout clic dans un <SelectItem> plante.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// ════════════════════════════════════════════════════════════════════════════
// Évaluations : même langage visuel que Gestion des Notes (classique) —
// panneau gauche (périodes → évaluations), panneau droit (tableau de saisie,
// sauvegarde automatique) — plutôt qu'une suite de formulaires modaux.
// ════════════════════════════════════════════════════════════════════════════

const ctx = {
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', ordering: 0, createdAt: '', active: true }],
  niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '' }],
  niveauMatieres: [{ id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'TP Cuisine', type: 'obligatoire' as const, coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 }],
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

import Evaluations from './Evaluations';

const rendre = () => render(<MemoryRouter><Evaluations /></MemoryRouter>);

describe('Évaluations — choisir une promotion (grille, comme Gestion des Notes)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche les promotions groupées par formation et niveau', () => {
    rendre();
    expect(screen.getByText('CAP Restauration')).toBeInTheDocument();
    expect(screen.getByText('CAP 1')).toBeInTheDocument();
    expect(screen.getByText('CAP 1 — Promo Septembre 2026')).toBeInTheDocument();
    expect(screen.getByText('1 évaluation')).toBeInTheDocument();
  });

  it('aucune promotion créée : invite à en créer une', () => {
    const original = ctx.promotions;
    ctx.promotions = [];
    rendre();
    expect(screen.getByText('Aucune promotion créée')).toBeInTheDocument();
    ctx.promotions = original;
  });
});

describe('Évaluations — dans une promotion (périodes, évaluations, saisie)', () => {
  beforeEach(() => vi.clearAllMocks());

  const entrerDansLaPromotion = async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('CAP 1 — Promo Septembre 2026'));
    return user;
  };

  it('affiche la période, l\'évaluation existante et bascule vers la saisie au clic', async () => {
    const user = await entrerDansLaPromotion();
    expect(screen.getByText('Semestre 1')).toBeInTheDocument();
    expect(screen.getByText('Devoir 1')).toBeInTheDocument();
    await user.click(screen.getByText('Devoir 1'));
    expect(screen.getAllByText('Devoir 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Diop')).toBeInTheDocument();
    expect(screen.getByText('Fall')).toBeInTheDocument();
  });

  it('la note déjà saisie est pré-remplie dans le tableau', async () => {
    const user = await entrerDansLaPromotion();
    await user.click(screen.getByText('Devoir 1'));
    const ligneAwa = screen.getByText('Diop').closest('tr')!;
    expect(within(ligneAwa).getByRole('spinbutton')).toHaveValue(14);
  });

  it('modifier une note l\'enregistre après un court délai (sauvegarde automatique)', async () => {
    const user = await entrerDansLaPromotion();
    await user.click(screen.getByText('Devoir 1'));
    const ligneMoussa = screen.getByText('Fall').closest('tr')!;
    const input = within(ligneMoussa).getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '18');
    expect(ctx.saisirNote).not.toHaveBeenCalled();
    await new Promise(resolve => setTimeout(resolve, 900));
    expect(ctx.saisirNote).toHaveBeenCalledWith('e1', 's2', { valeur: 18, statut: 'note' });
  }, 10000);

  it('changer le statut à « Absent » désactive le champ note', async () => {
    const user = await entrerDansLaPromotion();
    await user.click(screen.getByText('Devoir 1'));
    const ligneMoussa = screen.getByText('Fall').closest('tr')!;
    await user.click(within(ligneMoussa).getByRole('combobox'));
    await user.click(screen.getByText('Absent'));
    expect(within(ligneMoussa).getByRole('spinbutton')).toBeDisabled();
  });

  it('crée une nouvelle période', async () => {
    const user = await entrerDansLaPromotion();
    await user.click(screen.getByTitle('Nouvelle période'));
    await user.type(screen.getByLabelText('Nom *'), 'Semestre 2');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(ctx.addPeriode).toHaveBeenCalledWith('p1', { name: 'Semestre 2' });
  });

  it('supprimer une période demande confirmation', async () => {
    const user = await entrerDansLaPromotion();
    await user.click(screen.getByTitle('Supprimer la période'));
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(ctx.deletePeriode).toHaveBeenCalledWith('per1');
  });

  it('supprimer une évaluation demande confirmation', async () => {
    const user = await entrerDansLaPromotion();
    await user.click(screen.getByText('Devoir 1'));
    await user.click(screen.getByTitle('Supprimer l\'évaluation'));
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(ctx.deleteEvaluation).toHaveBeenCalledWith('e1');
  });

  it('crée une nouvelle évaluation depuis la période', async () => {
    const user = await entrerDansLaPromotion();
    await user.click(screen.getByTitle('Nouvelle évaluation'));
    const selects = screen.getAllByRole('combobox');
    await user.click(selects[0]);
    await user.click(screen.getByRole('option', { name: 'TP Cuisine' }));
    await user.click(screen.getAllByRole('combobox')[2]);
    await user.click(screen.getByRole('option', { name: 'Contrôle continu (30 %)' }));
    await user.type(screen.getByLabelText('Titre *'), 'Contrôle pratique n°2');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(ctx.addEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      promotionId: 'p1', niveauMatiereId: 'nm1', periodeId: 'per1', categorieId: 'cc', title: 'Contrôle pratique n°2',
    }));
  });

  it('formation sans formule d\'évaluation : message d\'aide, création désactivée', async () => {
    const original = ctx.baremeCategories;
    ctx.baremeCategories = [];
    const user = await entrerDansLaPromotion();
    expect(screen.getByText(/Aucune formule d'évaluation définie/)).toBeInTheDocument();
    ctx.baremeCategories = original;
  });
});
