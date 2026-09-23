import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// ════════════════════════════════════════════════════════════════════════════
// Examens — une grille par examen : candidats en lignes, épreuves en colonnes
// groupées par tour, puis moyenne, décision proposée et mention ; le
// directeur règle les épreuves et verrouille.
// ════════════════════════════════════════════════════════════════════════════

const fp = {
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', ordering: 0, createdAt: '', active: true }],
  niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '' }],
  promotions: [{ id: 'p1', niveauId: 'n1', classId: 'c1', name: 'CAP 1 — Promo 2026', studentLimit: 30, rythme: 'jour' as const, status: 'active' as const, createdAt: '' }],
  niveauMatieres: [
    { id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'Français', type: 'obligatoire' as const, coefficient: 2, nature: 'theorique' as const, ordering: 0 },
    { id: 'nm2', niveauId: 'n1', matiereId: 'm2', matiereName: 'TP Cuisine', type: 'obligatoire' as const, coefficient: 4, nature: 'pratique' as const, ordering: 1 },
  ],
  periodes: [
    { id: 'per1', promotionId: 'p1', name: 'Semestre 1', ordering: 0 },
    { id: 'per2', promotionId: 'p1', name: 'Semestre 2', ordering: 1 },
  ],
  baremeCategories: [
    { id: 'cc', formationId: 'f1', name: 'Contrôle continu', pourcentage: 30, ordering: 0 },
    { id: 'eb', formationId: 'f1', name: 'Examen blanc', pourcentage: 10, ordering: 1, sourceExamen: 'blanc' as const },
  ],
};

const exInitial = () => ({
  loading: false,
  disponible: true,
  examens: [{ id: 'x1', promotionId: 'p1', name: 'Examen blanc n°1', type: 'blanc' as const, seuilAdmission: 10, verrouille: false, createdAt: '2026-01-01' }],
  tours: [
    { id: 't1', examenId: 'x1', name: 'Écrit', ordering: 0 },
    { id: 't2', examenId: 'x1', name: 'Pratique', ordering: 1 },
  ],
  epreuves: [
    { id: 'ep1', tourId: 't1', nom: 'Français', coefficient: 2, bareme: 20, ordering: 0 },
    { id: 'ep2', tourId: 't2', nom: 'TP Cuisine', coefficient: 4, bareme: 20, seuilEliminatoire: 8, ordering: 0 },
  ] as { id: string; tourId: string; nom: string; coefficient: number; bareme: number; seuilEliminatoire?: number; ordering: number }[],
  candidats: [{ examenId: 'x1', studentEnrollmentId: 's1' }, { examenId: 'x1', studentEnrollmentId: 's2' }],
  notes: [
    { id: 'a', epreuveId: 'ep1', studentEnrollmentId: 's1', valeur: 12, statut: 'note' as const },
    { id: 'b', epreuveId: 'ep2', studentEnrollmentId: 's1', valeur: 14, statut: 'note' as const },
    { id: 'c', epreuveId: 'ep1', studentEnrollmentId: 's2', valeur: 15, statut: 'note' as const },
    { id: 'd', epreuveId: 'ep2', studentEnrollmentId: 's2', valeur: 6, statut: 'note' as const },
  ],
  resultats: [] as { id: string; examenId: string; studentEnrollmentId: string; decision?: string; mention?: string; moyenne?: number; elimine: boolean }[],
  addExamen: vi.fn().mockResolvedValue({ id: 'xnew' }),
  updateExamen: vi.fn(), deleteExamen: vi.fn(),
  addTour: vi.fn().mockResolvedValue({ id: 'tnew' }), updateTour: vi.fn(), deleteTour: vi.fn(),
  addEpreuve: vi.fn().mockResolvedValue({ id: 'epnew' }), updateEpreuve: vi.fn(), deleteEpreuve: vi.fn(),
  ajouterCandidat: vi.fn(), retirerCandidat: vi.fn(),
  saisirNote: vi.fn().mockResolvedValue(undefined), supprimerNote: vi.fn().mockResolvedValue(undefined),
  choisirDecision: vi.fn().mockResolvedValue(undefined),
  verrouiller: vi.fn().mockResolvedValue(undefined), deverrouiller: vi.fn().mockResolvedValue(undefined),
});
let ex = exInitial();
let role = 'admin';

vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => fp }));
vi.mock('@/contexts/ExamensContext', () => ({ useExamens: () => ex }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ accountRole: role }) }));
vi.mock('@/contexts/SchoolContext', () => ({
  useSchool: () => ({
    students: [
      { id: 's1', firstName: 'Awa', lastName: 'Diop', classId: 'c1', studentId: 'ETU-1' },
      { id: 's2', firstName: 'Moussa', lastName: 'Fall', classId: 'c1', studentId: 'ETU-2' },
    ],
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import ExamensPromotion from './ExamensPromotion';
import { toast } from '@/hooks/use-toast';

const rendre = () => render(
  <MemoryRouter initialEntries={['/formation/examens/p1']}>
    <Routes><Route path="/formation/examens/:promotionId" element={<ExamensPromotion />} /></Routes>
  </MemoryRouter>,
);
const ligne = (nom: string) => screen.getByText(nom).closest('tr')!;

describe('ExamensPromotion — la grille d\'un examen', () => {
  beforeEach(() => { ex = exInitial(); role = 'admin'; vi.clearAllMocks(); });

  it('tours en groupes de colonnes, moyenne pondérée et décision proposée', () => {
    rendre();
    expect(screen.getByRole('columnheader', { name: /^Écrit/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^Pratique/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Français — Diop Awa')).toHaveValue('12');
    // (12×2 + 14×4) / 6 = 13,33 → admis, assez bien
    expect(within(ligne('Diop')).getByText('13,33')).toBeInTheDocument();
    expect(within(ligne('Diop')).getByText('Admis (proposé)')).toBeInTheDocument();
    expect(within(ligne('Diop')).getByText('Assez bien (proposé)')).toBeInTheDocument();
  });

  it('une note sous le seuil éliminatoire : Éliminé et Refusé proposé, malgré la moyenne', () => {
    rendre();
    const l = ligne('Fall');
    expect(within(l).getByText('Éliminé')).toBeInTheDocument();
    expect(within(l).getByText('Refusé (proposé)')).toBeInTheDocument();
    expect(screen.getByText('1 admis')).toBeInTheDocument();
    expect(screen.getByText('1 refusé')).toBeInTheDocument();
  });

  it('le directeur ajoute une épreuve avec « + » dans l\'en-tête du tour', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: 'Ajouter une épreuve en Pratique' }));
    expect(ex.addEpreuve).toHaveBeenCalledWith('t2', { nom: 'Épreuve 2', coefficient: 1, bareme: 20 });
  });

  it('le personnel saisit les notes mais ne touche pas aux épreuves ni au verrou', () => {
    role = 'staff';
    rendre();
    expect(screen.queryByRole('button', { name: /Ajouter une épreuve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Verrouiller/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Français — Diop Awa')).not.toBeDisabled();
  });

  it('une note tapée est enregistrée automatiquement ; « NE » n\'existe pas à un examen', async () => {
    const user = userEvent.setup();
    rendre();
    const c = screen.getByLabelText('TP Cuisine — Fall Moussa');
    await user.clear(c);
    await user.type(c, 'NE');
    expect(c).toHaveAttribute('aria-invalid', 'true');
    await user.clear(c);
    await user.type(c, '9,5');
    await act(() => new Promise(r => setTimeout(r, 900)));
    expect(ex.saisirNote).toHaveBeenCalledWith('ep2', 's2', { valeur: 9.5, statut: 'note' });
  }, 10000);

  it('verrouiller fige moyenne, élimination, décision et mention de chaque candidat', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Verrouiller les résultats/ }));
    await user.click(screen.getByRole('button', { name: 'Verrouiller' }));
    expect(ex.verrouiller).toHaveBeenCalledWith('x1', [
      expect.objectContaining({ studentEnrollmentId: 's1', decision: 'admis', mention: 'assez_bien', elimine: false }),
      expect.objectContaining({ studentEnrollmentId: 's2', decision: 'refuse', mention: null, elimine: true }),
    ]);
  });

  it('refuse de verrouiller tant qu\'un candidat n\'a pas de décision', async () => {
    ex.notes = ex.notes.filter(n => n.id !== 'd');   // Fall n'a pas de note en TP Cuisine
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Verrouiller les résultats/ }));
    expect(ex.verrouiller).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Décisions manquantes' }));
  });

  it('examen verrouillé : cases en lecture seule, décisions figées affichées, bouton Déverrouiller', () => {
    ex.examens = [{ ...ex.examens[0], verrouille: true }];
    ex.resultats = [
      { id: 'r1', examenId: 'x1', studentEnrollmentId: 's1', decision: 'admis', mention: 'bien', moyenne: 13.33, elimine: false },
      { id: 'r2', examenId: 'x1', studentEnrollmentId: 's2', decision: 'ajourne', moyenne: 9, elimine: true },
    ];
    rendre();
    expect(screen.getByLabelText('Français — Diop Awa')).toBeDisabled();
    expect(within(ligne('Diop')).getByText('Bien')).toBeInTheDocument();          // choix du jury, pas la proposition
    expect(within(ligne('Fall')).getByText('Ajourné')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Déverrouiller/ })).toBeInTheDocument();
  });

  it('créer un examen inscrit les élèves de la promotion et reprend le programme', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByTitle('Nouvel examen'));
    await user.type(screen.getByLabelText('Nom *'), 'Examen final');
    await user.click(screen.getByRole('button', { name: 'Créer l\'examen' }));
    expect(ex.addExamen).toHaveBeenCalledWith(
      'p1',
      // Compte par défaut dans la dernière période de la promotion.
      expect.objectContaining({ name: 'Examen final', type: 'blanc', seuilAdmission: 10, periodeId: 'per2' }),
      ['s1', 's2'],
      [
        { tour: 'Écrit', epreuves: [{ niveauMatiereId: 'nm1', nom: 'Français', coefficient: 2, bareme: 20 }] },
        { tour: 'Pratique', epreuves: [{ niveauMatiereId: 'nm2', nom: 'TP Cuisine', coefficient: 4, bareme: 20 }] },
      ],
    );
  });

  it('dit clairement où comptent les notes de l\'examen dans les moyennes', () => {
    ex.examens = [{ ...ex.examens[0], periodeId: 'per1' } as typeof ex.examens[0]];
    rendre();
    expect(screen.getByText('Examen blanc (10 %)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Semestre 1' })).toHaveAttribute('href', '/formation/evaluations/p1');
  });

  it('un examen sans période ne compte dans aucune moyenne — et le dit', () => {
    rendre();
    expect(screen.getByText(/Ne compte dans aucune moyenne/)).toBeInTheDocument();
  });

  it('une épreuve rattachée à aucune matière est signalée « hors moyenne »', () => {
    rendre();
    expect(screen.getAllByText('hors moyenne').length).toBe(2);
  });

  it('aucun examen : invite à en créer un', () => {
    ex.examens = [];
    rendre();
    expect(screen.getByText('Aucun examen')).toBeInTheDocument();
  });

  it('tables absentes en base : message clair au lieu d\'une page cassée', () => {
    ex.disponible = false;
    rendre();
    expect(screen.getByText(/pas encore activé/)).toBeInTheDocument();
  });
});
