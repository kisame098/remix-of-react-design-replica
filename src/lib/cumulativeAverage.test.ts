import { describe, it, expect } from 'vitest';
import { selectSemestersSoFar, averageAcrossPeriods, type PeriodAverage } from './cumulativeAverage';
import type { GradePeriod } from '@/contexts/SchoolContext';

// ════════════════════════════════════════════════════════════════════════════
// MOYENNE CUMULÉE / ANNUELLE — la ligne du bas du bulletin, celle sur laquelle
// s'appuie une décision de passage.
//
// Le piège : on ne sait JAMAIS à l'avance combien de périodes l'école fera
// (2 ou 3). Écrire « Moyenne Annuelle » sur le bulletin du 1er semestre parce
// que le 2e n'est pas encore créé annoncerait une décision définitive qui n'en
// est pas une.
// ════════════════════════════════════════════════════════════════════════════

const YEAR = '2025-2026';
const CLASS = 'cls-1';

const period = (id: string, ordering: number, over: Partial<GradePeriod> = {}): GradePeriod => ({
  id, name: `Semestre ${ordering + 1}`, type: 'semester', academicYearLabel: YEAR,
  ordering, createdAt: new Date('2025-09-01'), ...over,
});

const allClasses = () => true;

describe('selectSemestersSoFar — quelles périodes cumuler', () => {
  it('NE CUMULE RIEN sur la première période de l\'année', () => {
    const periods = [period('s1', 0), period('s2', 1)];
    expect(selectSemestersSoFar(periods, allClasses, 's1', CLASS)).toBeNull();
  });

  it('cumule les deux semestres sur le second, et l\'appelle « Moyenne Annuelle »', () => {
    const periods = [period('s1', 0), period('s2', 1)];
    const sel = selectSemestersSoFar(periods, allClasses, 's2', CLASS)!;
    expect(sel.periodsSoFar.map(p => p.id)).toEqual(['s1', 's2']);
    expect(sel.isFinal).toBe(true);
    expect(sel.label).toBe('Moyenne Annuelle');
  });

  it('DIT « Moyenne cumulée » — pas « annuelle » — sur un trimestre intermédiaire', () => {
    const periods = [period('t1', 0), period('t2', 1), period('t3', 2)];
    const sel = selectSemestersSoFar(periods, allClasses, 't2', CLASS)!;
    expect(sel.periodsSoFar.map(p => p.id)).toEqual(['t1', 't2']);
    expect(sel.isFinal).toBe(false);
    expect(sel.label).toBe('Moyenne cumulée');
  });

  it('S\'AUTO-CORRIGE quand un trimestre suivant est créé plus tard', () => {
    // Le bulletin n'est jamais mis en cache : régénérer l'ancien bulletin après
    // la création du 3e trimestre doit changer l'étiquette tout seul.
    const deux = [period('t1', 0), period('t2', 1)];
    expect(selectSemestersSoFar(deux, allClasses, 't2', CLASS)!.label).toBe('Moyenne Annuelle');
    const trois = [...deux, period('t3', 2)];
    expect(selectSemestersSoFar(trois, allClasses, 't2', CLASS)!.label).toBe('Moyenne cumulée');
  });

  it('suit l\'ordre déclaré des périodes, pas leur ordre de création en base', () => {
    const desordre = [period('s2', 1), period('s1', 0)];
    expect(selectSemestersSoFar(desordre, allClasses, 's2', CLASS)!.periodsSoFar.map(p => p.id))
      .toEqual(['s1', 's2']);
  });

  it('NE CUMULE PAS un examen interne — il ne se moyenne pas avec des semestres', () => {
    const periods = [period('s1', 0), period('ex', 1, { type: 'exam' })];
    expect(selectSemestersSoFar(periods, allClasses, 'ex', CLASS)).toBeNull();
  });

  it('ignore un examen glissé entre deux semestres', () => {
    const periods = [period('s1', 0), period('ex', 1, { type: 'exam' }), period('s2', 2)];
    expect(selectSemestersSoFar(periods, allClasses, 's2', CLASS)!.periodsSoFar.map(p => p.id))
      .toEqual(['s1', 's2']);
  });

  it('ne compte que les périodes de CETTE classe', () => {
    // Une classe de lycée sur 2 semestres pendant que le collège en a 3.
    const periods = [period('t1', 0), period('t2', 1), period('t3', 2)];
    const lyceeSurDeux = (periodId: string) => periodId !== 't2';
    const sel = selectSemestersSoFar(periods, lyceeSurDeux, 't3', CLASS)!;
    expect(sel.periodsSoFar.map(p => p.id)).toEqual(['t1', 't3']);
    expect(sel.isFinal).toBe(true);
  });

  it('ne mélange pas deux années scolaires', () => {
    const periods = [
      period('vieux', 0, { academicYearLabel: '2024-2025' }),
      period('s1', 0), period('s2', 1),
    ];
    expect(selectSemestersSoFar(periods, allClasses, 's2', CLASS)!.periodsSoFar.map(p => p.id))
      .toEqual(['s1', 's2']);
  });

  it('ne plante pas sur une période inconnue', () => {
    expect(selectSemestersSoFar([period('s1', 0)], allClasses, 'inexistante', CLASS)).toBeNull();
    expect(selectSemestersSoFar([], allClasses, 's1', CLASS)).toBeNull();
  });
});

describe('averageAcrossPeriods — moyenne des moyennes', () => {
  const p = (studentId: string, average: number): PeriodAverage => ({ studentId, average });

  it('fait la moyenne des périodes, élève par élève', () => {
    const res = averageAcrossPeriods([[p('a', 10), p('b', 16)], [p('a', 14), p('b', 12)]]);
    const byId = Object.fromEntries(res.map(r => [r.studentId, r.average]));
    expect(byId.a).toBeCloseTo(12, 10);
    expect(byId.b).toBeCloseTo(14, 10);
  });

  it('pèse chaque période également, quel que soit le nombre de matières', () => {
    const res = averageAcrossPeriods([[p('a', 20)], [p('a', 10)], [p('a', 0)]]);
    expect(res[0].average).toBeCloseTo(10, 10);
  });

  it('NE COMPTE PAS comme 0 une période où l\'élève n\'a pas de note', () => {
    // Élève arrivé au 2e semestre : sa moyenne annuelle est celle du 2e,
    // pas la moitié.
    const res = averageAcrossPeriods([[p('a', 10)], [p('a', 14), p('nouveau', 16)]]);
    const byId = Object.fromEntries(res.map(r => [r.studentId, r.average]));
    expect(byId.nouveau).toBeCloseTo(16, 10);
    expect(byId.a).toBeCloseTo(12, 10);
  });

  it('classe du meilleur au moins bon', () => {
    const res = averageAcrossPeriods([[p('a', 8), p('b', 16), p('c', 12)]]);
    expect(res.map(r => r.studentId)).toEqual(['b', 'c', 'a']);
    expect(res.map(r => r.rank)).toEqual([1, 2, 3]);
  });

  it('donne le même rang aux ex æquo et saute le suivant', () => {
    const res = averageAcrossPeriods([[p('a', 15), p('b', 15), p('c', 10)]]);
    expect(res.map(r => r.rank)).toEqual([1, 1, 3]);
  });

  it('rend une liste vide sans aucune note, plutôt que de planter', () => {
    expect(averageAcrossPeriods([])).toEqual([]);
    expect(averageAcrossPeriods([[], []])).toEqual([]);
  });

  it('ne rend jamais NaN', () => {
    const res = averageAcrossPeriods([[p('a', 0)], [p('a', 0)]]);
    expect(Number.isNaN(res[0].average)).toBe(false);
    expect(res[0].average).toBe(0);
  });

  it('chaque élève n\'apparaît qu\'une fois dans le classement annuel', () => {
    const res = averageAcrossPeriods([[p('a', 10), p('b', 12)], [p('a', 14), p('b', 8)]]);
    expect(new Set(res.map(r => r.studentId)).size).toBe(res.length);
    expect(res).toHaveLength(2);
  });
});
