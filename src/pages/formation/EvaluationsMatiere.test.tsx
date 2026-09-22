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
// Évaluations — étape 3, dans une matière : sidebar des évaluations (comme la
// sidebar matières de src/pages/SubjectGrades.tsx) + tableau de saisie des
// notes avec sauvegarde automatique.
// ════════════════════════════════════════════════════════════════════════════

const ctx = {
  loading: false,
  promotions: [{ id: 'p1', niveauId: 'n1', classId: 'c1', name: 'CAP 1 — Promo Septembre 2026', studentLimit: 30, rythme: 'jour' as const, startDate: '2026-09-01', endDate: '2027-06-30', status: 'active' as const, createdAt: '' }],
  formations: [{ id: 'f1', name: 'CAP Restauration', ordering: 0, createdAt: '', active: true }],
  niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '' }],
  niveauMatieres: [{ id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'TP Cuisine', type: 'obligatoire' as const, coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 }],
  baremeCategories: [{ id: 'cc', formationId: 'f1', name: 'Contrôle continu', pourcentage: 30, ordering: 0 }],
  periodes: [{ id: 'per1', promotionId: 'p1', name: 'Semestre 1', ordering: 0 }],
  evaluations: [{ id: 'e1', promotionId: 'p1', niveauMatiereId: 'nm1', periodeId: 'per1', categorieId: 'cc', type: 'Devoir', title: 'Devoir 1', date: '2026-09-18', bareme: 20, poids: 1, createdAt: '' }],
  notes: [{ id: 'note1', evaluationId: 'e1', studentEnrollmentId: 's1', valeur: 14, statut: 'note' as const }],
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

import EvaluationsMatiere from './EvaluationsMatiere';

const rendre = () => render(
  <MemoryRouter initialEntries={['/formation/evaluations/p1/per1/nm1']}>
    <Routes><Route path="/formation/evaluations/:promotionId/:periodeId/:matiereId" element={<EvaluationsMatiere />} /></Routes>
  </MemoryRouter>,
);

describe('EvaluationsMatiere — sidebar des évaluations + saisie des notes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sélectionne automatiquement la seule évaluation et pré-remplit les notes existantes', () => {
    rendre();
    expect(screen.getAllByText('Devoir 1').length).toBeGreaterThan(0);
    expect(screen.getByText('Diop')).toBeInTheDocument();
    const ligneAwa = screen.getByText('Diop').closest('tr')!;
    expect(within(ligneAwa).getByRole('spinbutton')).toHaveValue(14);
  });

  it('modifier une note l\'enregistre après un court délai (sauvegarde automatique)', async () => {
    const user = userEvent.setup();
    rendre();
    const ligneMoussa = screen.getByText('Fall').closest('tr')!;
    const input = within(ligneMoussa).getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '18');
    expect(ctx.saisirNote).not.toHaveBeenCalled();
    await new Promise(resolve => setTimeout(resolve, 900));
    expect(ctx.saisirNote).toHaveBeenCalledWith('e1', 's2', { valeur: 18, statut: 'note' });
  }, 10000);

  it('changer le statut à « Absent » désactive le champ note', async () => {
    const user = userEvent.setup();
    rendre();
    const ligneMoussa = screen.getByText('Fall').closest('tr')!;
    await user.click(within(ligneMoussa).getByRole('combobox'));
    await user.click(screen.getByText('Absent'));
    expect(within(ligneMoussa).getByRole('spinbutton')).toBeDisabled();
  });

  it('supprimer l\'évaluation sélectionnée demande confirmation', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByTitle('Supprimer l\'évaluation'));
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(ctx.deleteEvaluation).toHaveBeenCalledWith('e1');
  });

  it('crée une nouvelle évaluation sans avoir à re-choisir la matière ou la période', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Nouvelle évaluation/ }));
    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(screen.getByRole('option', { name: 'Contrôle continu (30 %)' }));
    await user.type(screen.getByLabelText('Titre *'), 'Contrôle pratique n°2');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(ctx.addEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      promotionId: 'p1', niveauMatiereId: 'nm1', periodeId: 'per1', categorieId: 'cc', title: 'Contrôle pratique n°2',
    }));
  });

  it('aucune évaluation : création désactivée si la formule n\'existe pas', () => {
    const original = ctx.baremeCategories;
    ctx.baremeCategories = [];
    rendre();
    expect(screen.getByRole('button', { name: /Nouvelle évaluation/ })).toBeDisabled();
    ctx.baremeCategories = original;
  });
});
