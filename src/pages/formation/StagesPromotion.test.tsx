import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// ════════════════════════════════════════════════════════════════════════════
// Stages — un tableau d'élèves (un stage = un élève, son entreprise, ses
// dates), une seule note sur 20 qui remplit la matière « Stage ».
// ════════════════════════════════════════════════════════════════════════════

const fp = {
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', ordering: 0, createdAt: '', active: true }],
  niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '' }],
  promotions: [{ id: 'p1', niveauId: 'n1', classId: 'c1', name: 'CAP 1 — Promo 2026', studentLimit: 30, rythme: 'jour' as const, status: 'active' as const, createdAt: '' }],
  niveauMatieres: [
    { id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'Français', type: 'obligatoire' as const, coefficient: 2, nature: 'theorique' as const, ordering: 0 },
    { id: 'nmS', niveauId: 'n1', matiereId: 'm9', matiereName: 'Stage en entreprise', type: 'obligatoire' as const, coefficient: 3, nature: 'stage' as const, ordering: 1 },
  ],
  periodes: [
    { id: 'per1', promotionId: 'p1', name: 'Semestre 1', startDate: '2026-09-01', endDate: '2027-01-31', ordering: 0 },
    { id: 'per2', promotionId: 'p1', name: 'Semestre 2', startDate: '2027-02-01', endDate: '2027-06-30', ordering: 1 },
  ],
};

const stInitial = () => ({
  loading: false,
  disponible: true,
  entreprises: [{ id: 'e1', nom: 'Hôtel Terrou-Bi' }],
  stages: [
    { id: 'st1', promotionId: 'p1', studentEnrollmentId: 's1', entrepriseId: 'e1', poste: 'Cuisine', dateDebut: '2026-06-01', dateFin: '2026-08-31',
      conventionSignee: true, abandonne: false, niveauMatiereId: 'nmS', periodeId: 'per1', createdAt: '' },
  ] as Record<string, unknown>[],
  visites: [],
  entrepriseParNom: vi.fn().mockImplementation(async (nom: string) => ({ id: nom === 'Hôtel Terrou-Bi' ? 'e1' : 'enew', nom })),
  updateEntreprise: vi.fn(), deleteEntreprise: vi.fn(),
  addStage: vi.fn().mockResolvedValue({ id: 'stnew' }),
  updateStage: vi.fn().mockResolvedValue(undefined),
  deleteStage: vi.fn().mockResolvedValue(undefined),
  addVisite: vi.fn().mockResolvedValue(undefined), deleteVisite: vi.fn(),
});
let st = stInitial();

vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => fp }));
vi.mock('@/contexts/StagesContext', () => ({ useStages: () => st }));
vi.mock('@/contexts/SchoolContext', () => ({
  useSchool: () => ({
    students: [
      { id: 's1', firstName: 'Awa', lastName: 'Diop', classId: 'c1' },
      { id: 's2', firstName: 'Moussa', lastName: 'Fall', classId: 'c1' },
    ],
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import StagesPromotion from './StagesPromotion';

const rendre = () => render(
  <MemoryRouter initialEntries={['/formation/stages/p1']}>
    <Routes><Route path="/formation/stages/:promotionId" element={<StagesPromotion />} /></Routes>
  </MemoryRouter>,
);
const ligne = (nom: string) => screen.getByText(nom).closest('tr')!;

describe('StagesPromotion — les élèves et leurs stages', () => {
  beforeEach(() => { st = stInitial(); vi.clearAllMocks(); });

  it('une ligne par stage, et « Aucun stage » pour un élève qui n\'en a pas', () => {
    rendre();
    expect(within(ligne('Diop')).getByText('Hôtel Terrou-Bi')).toBeInTheDocument();
    // Fini depuis le 31 août, pas encore de note : « À noter ».
    expect(within(ligne('Diop')).getByText('À noter')).toBeInTheDocument();
    expect(within(ligne('Fall')).getByText('Aucun stage')).toBeInTheDocument();
    expect(screen.getByText(/remplit « Stage en entreprise » \(×3\)/)).toBeInTheDocument();
  });

  it('les filtres par statut', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /^Sans stage/ }));
    expect(screen.getByText('Fall')).toBeInTheDocument();
    expect(screen.queryByText('Diop')).not.toBeInTheDocument();
  });

  it('créer un stage depuis la ligne de l\'élève : entreprise ajoutée au carnet, période déduite de la date de fin', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(within(ligne('Fall')).getByRole('button', { name: /Ajouter un stage/ }));
    await user.type(screen.getByLabelText('Entreprise'), 'Radisson Blu');
    expect(screen.getByText(/sera ajoutée au carnet/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Début'), '2027-03-01');
    await user.type(screen.getByLabelText('Fin'), '2027-04-15');
    await user.click(screen.getByRole('button', { name: 'Créer le stage' }));
    expect(st.entrepriseParNom).toHaveBeenCalledWith('Radisson Blu');
    expect(st.addStage).toHaveBeenCalledWith('p1', expect.objectContaining({
      studentEnrollmentId: 's2', entrepriseId: 'enew', dateDebut: '2027-03-01', dateFin: '2027-04-15',
      periodeId: 'per2', niveauMatiereId: 'nmS', note: undefined,
    }));
  });

  it('noter un stage : une seule note sur 20', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(within(ligne('Diop')).getByText('Hôtel Terrou-Bi'));
    expect(screen.getByText(/remplit « Stage en entreprise » \(×3\) dans Évaluations, pour Semestre 1/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Note sur 20'), '15,5');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(st.updateStage).toHaveBeenCalledWith('st1', expect.objectContaining({ note: 15.5, periodeId: 'per1' }));
  });

  it('refuse une note au-dessus de 20', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(within(ligne('Diop')).getByText('Hôtel Terrou-Bi'));
    await user.type(screen.getByLabelText('Note sur 20'), '25');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(st.updateStage).not.toHaveBeenCalled();
  });

  it('tables absentes en base : message clair', () => {
    st.disponible = false;
    rendre();
    expect(screen.getByText(/pas encore activé/)).toBeInTheDocument();
  });
});
