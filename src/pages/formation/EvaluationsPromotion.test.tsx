import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// jsdom n'implémente pas l'API Pointer Capture que Radix UI utilise en
// interne — sans ce filet, tout clic dans un <Select> ou un <Popover> plante.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// ════════════════════════════════════════════════════════════════════════════
// Évaluations — l'espace de travail d'une promotion : période en pastilles,
// matière à gauche, UNE grille où chaque catégorie de la formule est un
// groupe de colonnes. La catégorie n'est plus un filtre à choisir puis à
// redemander dans un formulaire « Nouvelle évaluation ».
// ════════════════════════════════════════════════════════════════════════════

const ctxInitial = () => ({
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', ordering: 0, createdAt: '', active: true }],
  niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '' }],
  niveauMatieres: [
    { id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'TP Cuisine', type: 'obligatoire' as const, coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 },
    { id: 'nm2', niveauId: 'n1', matiereId: 'm2', matiereName: 'Français', type: 'obligatoire' as const, coefficient: 2, nature: 'theorique' as const, ordering: 1 },
    { id: 'nmS', niveauId: 'n1', matiereId: 'm9', matiereName: 'Stage en entreprise', type: 'obligatoire' as const, coefficient: 2, nature: 'stage' as const, ordering: 2 },
  ],
  baremeCategories: [
    { id: 'cc', formationId: 'f1', name: 'Contrôle continu', pourcentage: 30, ordering: 0 },
    { id: 'tp', formationId: 'f1', name: 'TP', pourcentage: 30, ordering: 1 },
    { id: 'eb', formationId: 'f1', name: 'Examen blanc', pourcentage: 10, ordering: 2, sourceExamen: 'blanc' as const },
    { id: 'ef', formationId: 'f1', name: 'Examen final', pourcentage: 30, ordering: 3, sourceExamen: 'officiel' as const },
  ],
  promotions: [{ id: 'p1', niveauId: 'n1', classId: 'c1', name: 'CAP 1 — Promo Septembre 2026', studentLimit: 30, rythme: 'jour' as const, startDate: '2026-09-01', endDate: '2027-06-30', status: 'active' as const, createdAt: '' }],
  periodes: [{ id: 'per1', promotionId: 'p1', name: 'Semestre 1', ordering: 0 }] as { id: string; promotionId: string; name: string; ordering: number }[],
  evaluations: [
    { id: 'e1', promotionId: 'p1', niveauMatiereId: 'nm1', periodeId: 'per1', categorieId: 'cc', type: 'Contrôle continu', title: 'Devoir 1', date: '2026-09-18', bareme: 20, poids: 1, createdAt: '1' },
    { id: 'e2', promotionId: 'p1', niveauMatiereId: 'nm2', periodeId: 'per1', categorieId: 'cc', type: 'Contrôle continu', title: 'Dictée', date: '2026-09-20', bareme: 20, poids: 1, createdAt: '2' },
  ],
  notes: [
    { id: 'note1', evaluationId: 'e1', studentEnrollmentId: 's1', valeur: 14, statut: 'note' as const },
    { id: 'note2', evaluationId: 'e2', studentEnrollmentId: 's1', valeur: 8, statut: 'note' as const },
    { id: 'note3', evaluationId: 'e1', studentEnrollmentId: 's2', valeur: 16, statut: 'note' as const },
  ],
  addPeriode: vi.fn().mockResolvedValue({ id: 'pernew' }),
  updatePeriode: vi.fn().mockResolvedValue(undefined),
  deletePeriode: vi.fn().mockResolvedValue(undefined),
  addEvaluation: vi.fn().mockResolvedValue({ id: 'enew' }),
  updateEvaluation: vi.fn().mockResolvedValue(undefined),
  deleteEvaluation: vi.fn().mockResolvedValue(undefined),
  saisirNote: vi.fn().mockResolvedValue(undefined),
  supprimerNote: vi.fn().mockResolvedValue(undefined),
});
let ctx = ctxInitial();
vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => ctx }));

// L'examen final du Semestre 1 : TP Cuisine (épreuve rattachée à nm1), Diop 20/20.
const examensInitial = () => ({
  loading: false,
  examens: [{ id: 'x1', promotionId: 'p1', name: 'Examen final', type: 'officiel' as const, periodeId: 'per1', seuilAdmission: 10, verrouille: false, createdAt: '2026-06-01T00:00:00Z' }],
  tours: [{ id: 't1', examenId: 'x1', name: 'Pratique', ordering: 0 }],
  epreuves: [{ id: 'ep1', tourId: 't1', niveauMatiereId: 'nm1', nom: 'TP Cuisine', coefficient: 1, bareme: 20, ordering: 0 }],
  notes: [{ id: 'xn1', epreuveId: 'ep1', studentEnrollmentId: 's1', valeur: 20, statut: 'note' as const }],
});
let examens = examensInitial();
vi.mock('@/contexts/ExamensContext', () => ({ useExamens: () => examens }));

// Stage de Diop au Semestre 1, noté 12 : il remplit la matière « Stage ».
const stagesInitial = () => ({
  loading: false,
  entreprises: [{ id: 'e1', nom: 'Hôtel Terrou-Bi' }],
  stages: [{ id: 'st1', promotionId: 'p1', studentEnrollmentId: 's1', entrepriseId: 'e1', conventionSignee: false, abandonne: false,
    niveauMatiereId: 'nmS', periodeId: 'per1', note: 12, createdAt: '' }],
});
let stagesCtx = stagesInitial();
vi.mock('@/contexts/StagesContext', () => ({ useStages: () => stagesCtx }));
vi.mock('@/contexts/SchoolContext', () => ({
  useSchool: () => ({
    students: [
      { id: 's1', firstName: 'Awa', lastName: 'Diop', classId: 'c1' },
      { id: 's2', firstName: 'Moussa', lastName: 'Fall', classId: 'c1' },
    ],
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
// Les boutons de documents ne fabriquent rien tant qu'on ne clique pas : une fabrique vide suffit.
vi.mock('@/hooks/useDocumentsFormation', () => ({ useDonneesDocuments: () => ({}) }));

import EvaluationsPromotion from './EvaluationsPromotion';

const rendre = () => render(
  <MemoryRouter initialEntries={['/formation/evaluations/p1']}>
    <Routes><Route path="/formation/evaluations/:promotionId" element={<EvaluationsPromotion />} /></Routes>
  </MemoryRouter>,
);
const attendreSauvegarde = () => act(() => new Promise(resolve => setTimeout(resolve, 900)));
const caseDe = (evaluation: string, eleve: string) => screen.getByLabelText(`${evaluation} — ${eleve}`);

describe('EvaluationsPromotion — une grille par matière, catégories en colonnes', () => {
  beforeEach(() => { ctx = ctxInitial(); examens = examensInitial(); stagesCtx = stagesInitial(); });

  it('ouvre directement la première matière : seules les catégories saisies ici ont des colonnes', () => {
    examens.notes = [];
    rendre();
    expect(screen.getByRole('heading', { name: 'CAP 1 — Promo Septembre 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /TP Cuisine/ })).toBeInTheDocument();
    for (const cat of ['Contrôle continu', 'TP']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(`^${cat} ·`) })).toBeInTheDocument();
    }
    // Examen blanc et Examen final : plus de colonne ici, seulement rappelés dans la formule.
    expect(screen.queryByRole('columnheader', { name: /^Examen blanc/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Examen final/ })).not.toBeInTheDocument();
    expect(screen.getByText('Examen final 30 %')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Saisir les examens/ })).toHaveAttribute('href', '/formation/examens/p1');
    expect(caseDe('Devoir 1', 'Diop Awa')).toHaveValue('14');
    const ligneAwa = screen.getByText('Diop').closest('tr')!;
    expect(within(ligneAwa).getAllByText('14').length).toBeGreaterThan(0);   // moyenne de la matière
  });

  it('la moyenne compte l\'examen final saisi dans la rubrique Examens — sans le ressaisir', () => {
    rendre();
    const ligneAwa = screen.getByText('Diop').closest('tr')!;
    // Contrôle continu 14 (30 %) + Examen final 20 (30 %) → 17
    expect(within(ligneAwa).getByText('17')).toBeInTheDocument();
    expect(screen.getByText(/examens inclus/)).toBeInTheDocument();
  });

  it('plus de formulaire « Nouvelle évaluation » : « + » dans l\'en-tête de la catégorie crée la colonne directement', async () => {
    const user = userEvent.setup();
    rendre();
    expect(screen.queryByRole('button', { name: /Nouvelle évaluation/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajouter une évaluation en TP' }));
    expect(ctx.addEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      promotionId: 'p1', niveauMatiereId: 'nm1', periodeId: 'per1', categorieId: 'tp', type: 'TP', title: 'TP 1', bareme: 20, poids: 1,
    }));
  });

  it('une note tapée est enregistrée automatiquement après un court délai', async () => {
    const user = userEvent.setup();
    rendre();
    await user.type(caseDe('Devoir 1', 'Fall Moussa'), '{Backspace}{Backspace}12,5');
    expect(ctx.saisirNote).not.toHaveBeenCalled();
    await attendreSauvegarde();
    expect(ctx.saisirNote).toHaveBeenLastCalledWith('e1', 's2', { valeur: 12.5, statut: 'note' });
  }, 10000);

  it('« A » enregistre une absence, jamais une note de 0', async () => {
    const user = userEvent.setup();
    rendre();
    const c = caseDe('Devoir 1', 'Fall Moussa');
    await user.clear(c);
    await user.type(c, 'A');
    await attendreSauvegarde();
    expect(ctx.saisirNote).toHaveBeenCalledWith('e1', 's2', { statut: 'absent' });
  }, 10000);

  it('vider une case retire la note en base (elle ne reste plus en silence)', async () => {
    const user = userEvent.setup();
    rendre();
    await user.clear(caseDe('Devoir 1', 'Diop Awa'));
    await attendreSauvegarde();
    expect(ctx.supprimerNote).toHaveBeenCalledWith('e1', 's1');
    expect(ctx.saisirNote).not.toHaveBeenCalled();
  }, 10000);

  it('une note au-dessus du barème est signalée et jamais enregistrée', async () => {
    const user = userEvent.setup();
    rendre();
    const c = caseDe('Devoir 1', 'Fall Moussa');
    await user.clear(c);
    await user.type(c, '25');
    expect(c).toHaveAttribute('aria-invalid', 'true');
    await attendreSauvegarde();
    expect(ctx.saisirNote).not.toHaveBeenCalledWith('e1', 's2', expect.objectContaining({ valeur: 25 }));
  }, 10000);

  it('changer de matière juste après avoir tapé ne perd pas la note (ancien bug)', async () => {
    const user = userEvent.setup();
    rendre();
    const c = caseDe('Devoir 1', 'Fall Moussa');
    await user.clear(c);
    await user.type(c, '9');
    await user.click(screen.getByRole('button', { name: /Français/ }));   // moins de 800 ms plus tard
    expect(screen.getByRole('heading', { name: /Français/ })).toBeInTheDocument();
    await attendreSauvegarde();
    expect(ctx.saisirNote).toHaveBeenCalledWith('e1', 's2', { valeur: 9, statut: 'note' });
  }, 10000);

  it('cliquer le titre d\'une colonne permet d\'en changer la date et le barème', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Devoir 1/ }));
    const bareme = screen.getByLabelText('Noté sur');
    await user.clear(bareme);
    await user.type(bareme, '40');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(ctx.updateEvaluation).toHaveBeenCalledWith('e1', expect.objectContaining({ bareme: 40, title: 'Devoir 1' }));
  });

  it('le récapitulatif donne la moyenne générale pondérée par les coefficients et le rang', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Récapitulatif/ }));
    const ligneAwa = screen.getByText('Diop').closest('tr')!;
    // TP Cuisine : CC 14 et examen final 20 → 17 ; Français 8 ; Stage 12 → (17×4 + 8×2 + 12×2) / 8 = 13,5
    expect(within(ligneAwa).getByText('13,5')).toBeInTheDocument();
    const ligneMoussa = screen.getByText('Fall').closest('tr')!;
    expect(within(ligneMoussa).getAllByText('1').length).toBeGreaterThan(0);   // 16 : premier
    expect(within(ligneAwa).getByText('2')).toBeInTheDocument();
  });

  it('une matière « Stage » n\'a rien à saisir : elle montre la note venue de la rubrique Stages', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Stage en entreprise/ }));
    expect(screen.getByText(/rien à taper ici/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Stages' })).toHaveAttribute('href', '/formation/stages/p1');
    const ligneAwa = screen.getByText('Diop').closest('tr')!;
    expect(within(ligneAwa).getByText('Hôtel Terrou-Bi')).toBeInTheDocument();
    expect(within(ligneAwa).getByText('12')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter une évaluation/ })).not.toBeInTheDocument();
  });

  it('crée une nouvelle période', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByTitle('Nouvelle période'));
    await user.click(screen.getByRole('button', { name: 'Semestre 2' }));
    await user.click(screen.getByRole('button', { name: 'Créer la période' }));
    expect(ctx.addPeriode).toHaveBeenCalledWith('p1', { name: 'Semestre 2', startDate: undefined, endDate: undefined });
  });

  it('aucune période créée : invite à en créer une, pas de grille', () => {
    ctx.periodes = [];
    rendre();
    expect(screen.getByText('Aucune période')).toBeInTheDocument();
    expect(screen.queryByText('Contrôle continu')).not.toBeInTheDocument();
  });

  it('formation sans formule d\'évaluation : message d\'aide, pas de grille', () => {
    ctx.baremeCategories = [];
    rendre();
    expect(screen.getByText(/Aucune formule d'évaluation définie/)).toBeInTheDocument();
    expect(screen.queryByText('Matières')).not.toBeInTheDocument();
  });
});
