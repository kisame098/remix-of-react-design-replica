import { describe, it, expect } from 'vitest';
import { notesDeLaPeriode, periodeEnCours, type DonneesNotesFormation } from './portailNotesFormation';
import type { Evaluation, Note } from './formationPro';

const ev = (id: string, matiere: string, categorie: string, bareme = 20, periode = 'S1'): Evaluation => ({
  id, promotionId: 'P', niveauMatiereId: matiere, periodeId: periode, categorieId: categorie,
  type: 'Contrôle continu', title: id, date: '2026-10-01', bareme, poids: 1, createdAt: '',
});
const note = (evaluationId: string, valeur: number, eleve = 'E'): Note => ({
  id: `${evaluationId}-${eleve}`, evaluationId, studentEnrollmentId: eleve, valeur, statut: 'note',
});

const base = (): DonneesNotesFormation => ({
  promotionId: 'P', eleveId: 'E',
  periodes: [
    { id: 'S1', promotionId: 'P', name: 'Semestre 1', startDate: '2026-09-01', endDate: '2027-01-31', ordering: 0 },
    { id: 'S2', promotionId: 'P', name: 'Semestre 2', startDate: '2027-02-01', endDate: '2027-06-30', ordering: 1 },
  ],
  matieres: [
    { id: 'M1', matiereName: 'Cuisine', coefficient: 3, nature: 'pratique', ordering: 0 },
    { id: 'M2', matiereName: 'Hygiène', coefficient: 1, nature: 'theorique', ordering: 1 },
    { id: 'ST', matiereName: 'Stage', coefficient: 2, nature: 'stage', ordering: 2 },
  ],
  categories: [
    { id: 'CC', formationId: 'F', name: 'Contrôle continu', pourcentage: 50, ordering: 0 },
    { id: 'TP', formationId: 'F', name: 'TP', pourcentage: 50, ordering: 1 },
  ],
  evaluations: [ev('a', 'M1', 'CC'), ev('b', 'M1', 'TP', 10), ev('c', 'M2', 'CC'), ev('z', 'M1', 'CC', 20, 'S2')],
  notes: [note('a', 12), note('b', 8), note('c', 10)],
  examens: [], tours: [], epreuves: [], notesExamen: [], stages: [],
});

describe('notesDeLaPeriode', () => {
  it("calcule les moyennes de l'élève avec la formule de l'école", () => {
    const r = notesDeLaPeriode(base(), 'S1');
    const cuisine = r.matieres.find(m => m.id === 'M1')!;
    // CC 12/20 et TP 8/10 = 16/20, 50/50 → 14
    expect(cuisine.moyenne).toBeCloseTo(14);
    expect(cuisine.evaluations.map(e => e.evaluation.id)).toEqual(['a', 'b']);
    expect(cuisine.evaluations[1].categorieName).toBe('TP');
    // (14×3 + 10×1) / 4 = 13 — le stage sans note n'est pas compté 0
    expect(r.generale).toBeCloseTo(13);
  });

  it('une évaluation sans note reste affichée, sans valeur', () => {
    const d = base();
    d.notes = d.notes.filter(n => n.evaluationId !== 'c');
    const hygiene = notesDeLaPeriode(d, 'S1').matieres.find(m => m.id === 'M2')!;
    expect(hygiene.moyenne).toBeNull();
    expect(hygiene.evaluations[0].note).toBeUndefined();
  });

  it('la matière Stage prend la note du stage', () => {
    const d = base();
    d.stages = [{
      id: 's', promotionId: 'P', studentEnrollmentId: 'E', conventionSignee: true, abandonne: false,
      niveauMatiereId: 'ST', periodeId: 'S1', note: 16, createdAt: '',
    }];
    const stage = notesDeLaPeriode(d, 'S1').matieres.find(m => m.id === 'ST')!;
    expect(stage.moyenne).toBe(16);
    expect(stage.noteDuStage).toBe(true);
  });

  it("n'utilise que les évaluations de la période choisie", () => {
    const cuisine = notesDeLaPeriode(base(), 'S2').matieres.find(m => m.id === 'M1')!;
    expect(cuisine.evaluations.map(e => e.evaluation.id)).toEqual(['z']);
    expect(cuisine.moyenne).toBeNull();
  });
});

describe('periodeEnCours', () => {
  it("prend la période qui contient aujourd'hui", () => {
    expect(periodeEnCours(base().periodes, '2027-03-10')?.id).toBe('S2');
  });
  it('avant la première période, prend la première', () => {
    expect(periodeEnCours(base().periodes, '2026-08-01')?.id).toBe('S1');
  });
  it('entre deux périodes ou après la fin, prend la dernière commencée', () => {
    expect(periodeEnCours(base().periodes, '2027-08-01')?.id).toBe('S2');
  });
});
