import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// ════════════════════════════════════════════════════════════════════════════
// Documents — on choisit un élève, on trouve tous ses documents. Les documents
// officiels ne s'émettent qu'aux bonnes conditions et se réimpriment sans
// nouveau numéro.
// ════════════════════════════════════════════════════════════════════════════

const fp = {
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', diplomaType: "Diplôme de l'établissement", ordering: 0, createdAt: '', active: true }],
  niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 2', ordering: 0, createdAt: '' }],
  promotions: [{ id: 'p1', niveauId: 'n1', classId: 'c1', name: 'Promo 2025', studentLimit: 30, rythme: 'jour' as const, status: 'active' as const, createdAt: '' }],
  periodes: [{ id: 'per1', promotionId: 'p1', name: 'Semestre 1', ordering: 0 }],
};
const exInitial = () => ({
  loading: false,
  examens: [{ id: 'x1', promotionId: 'p1', name: 'Examen final 2027', type: 'officiel' as const, seuilAdmission: 10, verrouille: true, createdAt: '' }],
  candidats: [{ examenId: 'x1', studentEnrollmentId: 's1' }, { examenId: 'x1', studentEnrollmentId: 's2' }],
  resultats: [
    { id: 'r1', examenId: 'x1', studentEnrollmentId: 's1', decision: 'admis', mention: 'bien', moyenne: 14.2, elimine: false },
    { id: 'r2', examenId: 'x1', studentEnrollmentId: 's2', decision: 'ajourne', moyenne: 8, elimine: false },
  ],
});
let ex = exInitial();
let role = 'admin';
const emettre = vi.fn();
let documents: unknown[] = [];

vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => fp }));
vi.mock('@/contexts/ExamensContext', () => ({ useExamens: () => ex }));
vi.mock('@/contexts/StagesContext', () => ({ useStages: () => ({ loading: false, stages: [], entreprises: [] }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ accountRole: role, school: { logo_url: null } }) }));
vi.mock('@/contexts/SchoolContext', () => ({
  useSchool: () => ({
    students: [
      { id: 's1', firstName: 'Awa', lastName: 'Diop', classId: 'c1', studentId: 'ETU-1', sex: 'femme' },
      { id: 's2', firstName: 'Moussa', lastName: 'Fall', classId: 'c1', studentId: 'ETU-2', sex: 'homme' },
      { id: 's9', firstName: 'Hors', lastName: 'Formation', classId: 'autre', studentId: 'ETU-9', sex: 'homme' },
    ],
  }),
}));
vi.mock('@/hooks/useDocumentsFormation', () => ({
  useDonneesDocuments: () => ({ periodesDe: () => fp.periodes, contenuOfficiel: () => ({ eleve: {} }), bulletins: vi.fn(), convocations: vi.fn(), attestationStage: vi.fn() }),
  useDocumentsOfficiels: () => ({ documents, loading: false, disponible: true, emettre }),
}));
vi.mock('@/components/documents/DocumentDialog', () => ({ DocumentDialog: ({ ouvert, titre }: { ouvert: boolean; titre: string }) => (ouvert ? <div role="dialog">{titre}</div> : null) }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import Documents from './Documents';

const rendre = () => render(<MemoryRouter><Documents /></MemoryRouter>);
// La ligne du document dans la carte « Documents officiels » (le même libellé peut figurer dans l'historique).
const ligneDocument = (libelle: string) => screen.getAllByText(libelle)[0].closest('div.flex.items-center.justify-between')! as HTMLElement;

describe('Documents — par élève', () => {
  beforeEach(() => { ex = exInitial(); role = 'admin'; documents = []; vi.clearAllMocks(); });

  it('liste seulement les élèves des promotions de formation professionnelle', () => {
    rendre();
    expect(screen.getByText('Diop Awa')).toBeInTheDocument();
    expect(screen.getByText('Fall Moussa')).toBeInTheDocument();
    expect(screen.queryByText('Formation Hors')).not.toBeInTheDocument();
  });

  it('élève admis à l\'examen verrouillé : bulletin, convocation et les trois documents officiels disponibles', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('Diop Awa'));
    expect(screen.getByRole('button', { name: /Bulletin/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Convocation$/ })).toBeEnabled();
    for (const l of ["Attestation d'inscription", 'Attestation de réussite', 'Diplôme']) {
      expect(within(ligneDocument(l)).getByRole('button', { name: /Émettre/ })).toBeEnabled();
    }
  });

  it('élève ajourné : réussite et diplôme grisés, avec la raison', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('Fall Moussa'));
    expect(within(ligneDocument('Attestation de réussite')).getByRole('button', { name: /Émettre/ })).toBeDisabled();
    expect(screen.getAllByText(/pas admis/).length).toBe(2);
    expect(within(ligneDocument("Attestation d'inscription")).getByRole('button', { name: /Émettre/ })).toBeEnabled();
  });

  it('le personnel (non directeur) ne peut émettre ni réussite ni diplôme', async () => {
    role = 'staff';
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('Diop Awa'));
    expect(within(ligneDocument('Diplôme')).getByRole('button', { name: /Émettre/ })).toBeDisabled();
    expect(screen.getAllByText(/Réservé au directeur/).length).toBe(2);
  });

  it('pas de diplôme de l\'école pour une formation « Diplôme d\'État »', async () => {
    fp.formations[0].diplomaType = "Diplôme d'État";
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('Diop Awa'));
    expect(within(ligneDocument('Diplôme')).getByRole('button', { name: /Émettre/ })).toBeDisabled();
    expect(screen.getByText(/délivré par l'État/)).toBeInTheDocument();
    fp.formations[0].diplomaType = "Diplôme de l'établissement";
  });

  it('émettre demande confirmation, puis appelle la numérotation de la base', async () => {
    emettre.mockResolvedValue({ id: 'd1', type: 'attestation_inscription', annee: 2026, numero: 4, studentEnrollmentId: 's1', emisLe: '', contenu: {} });
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('Diop Awa'));
    await user.click(within(ligneDocument("Attestation d'inscription")).getByRole('button', { name: /Émettre/ }));
    expect(emettre).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Émettre' }));
    expect(emettre).toHaveBeenCalledWith('attestation_inscription', 's1', 'p1', null, expect.anything());
    expect(await screen.findByRole('dialog')).toHaveTextContent('INS-2026-00004');
  });

  it('un diplôme déjà émis ne se réémet pas : il se réimprime depuis l\'historique', async () => {
    documents = [{ id: 'd9', type: 'diplome', annee: 2026, numero: 2, studentEnrollmentId: 's1', examenId: 'x1', emisLe: '2026-09-20T10:00:00Z', contenu: { examen: { nom: 'Examen final 2027' } } }];
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByText('Diop Awa'));
    expect(within(ligneDocument('Diplôme')).getByRole('button', { name: /Émettre/ })).toBeDisabled();
    expect(screen.getByText(/Déjà émis \(DIP-2026-00002\)/)).toBeInTheDocument();
    expect(screen.getByText('DIP-2026-00002')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Réimprimer/ }));
    expect(emettre).not.toHaveBeenCalled();
  });
});
