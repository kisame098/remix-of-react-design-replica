import { describe, it, expect } from 'vitest';
import { computeClassRanking, type RankingCalculationMode } from './useClassRanking';
import type { Student, Subject, Grade, SubjectSettingsData } from '@/contexts/SchoolContext';

// ════════════════════════════════════════════════════════════════════════════
// MOYENNE GÉNÉRALE 6ème→Terminale — la formule qui décide d'un passage.
//   μ_dev = moyenne des devoirs actifs retenus (top2 / top3 / toutes)
//   μ_mat = (μ_dev + Composition) / 2
//   P_pond = μ_mat × coefficient de l'élève
//   Moyenne = Σ P_pond / Σ Coef
// Cas examen interne : une seule note, μ_mat = la note.
// ════════════════════════════════════════════════════════════════════════════

const PERIOD = 'per-1';
const CLASS = 'cls-1';

const student = (id: string, over: Partial<Student> = {}): Student => ({
  id, studentId: `ETU-${id}`, firstName: `P${id}`, lastName: `N${id}`,
  dateOfBirth: '2010-01-01', placeOfBirth: 'Dakar', sex: 'homme',
  residence: 'Dakar', tutor1: { status: 'pere', phone: '77' } as Student['tutor1'],
  classId: CLASS, createdAt: new Date('2025-09-01'), enrolledAt: '2025-09-01', ...over,
});

const subject = (id: string, coefficient: number, over: Partial<Subject> = {}): Subject => ({
  id, name: `Matière ${id}`, coefficient, classId: CLASS, periodId: PERIOD,
  ordering: 0, subjectType: 'obligatoire', ...over,
});

const grade = (studentEnrollmentId: string, subjectId: string, over: Partial<Grade> = {}): Grade => ({
  id: `g-${studentEnrollmentId}-${subjectId}`, studentEnrollmentId, subjectId, ...over,
});

const noSettings = () => undefined;

const settingsFrom = (map: Record<string, Partial<SubjectSettingsData>>) =>
  (subjectId: string): SubjectSettingsData | undefined => {
    const s = map[subjectId];
    if (!s) return undefined;
    return {
      id: '', subjectId,
      devoir1Active: true, devoir2Active: true, devoir3Active: true,
      devoir4Active: false, devoir5Active: false,
      studentSettings: {}, ...s,
    };
  };

const run = (
  students: Student[], subjects: Subject[], grades: Grade[],
  mode: RankingCalculationMode = 'all',
  getSettings: (id: string) => SubjectSettingsData | undefined = noSettings,
  isExam = false,
) => computeClassRanking(PERIOD, CLASS, mode, students, subjects, grades, getSettings, isExam);

describe('computeClassRanking — semestre', () => {
  it('applique la formule (μ_dev + compo)/2 pondérée par le coefficient', () => {
    const [r] = run(
      [student('a')],
      [subject('m1', 4), subject('m2', 2)],
      [
        grade('a', 'm1', { devoir1: 12, devoir2: 14, composition: 10 }), // μ_dev 13 → μ_mat 11.5
        grade('a', 'm2', { devoir1: 16, composition: 16 }),              // μ_mat 16
      ],
    );
    // (11.5×4 + 16×2) / 6 = 78 / 6 = 13
    expect(r.averageGeneral).toBeCloseTo(13, 10);
    expect(r.totalCoef).toBe(6);
  });

  it('retient les 2 meilleurs devoirs en mode top2', () => {
    const [r] = run(
      [student('a')], [subject('m1', 1)],
      [grade('a', 'm1', { devoir1: 5, devoir2: 15, devoir3: 13, composition: 10 })],
      'top2',
    );
    // top2 = (15+13)/2 = 14 → μ_mat = (14+10)/2 = 12
    expect(r.averageGeneral).toBeCloseTo(12, 10);
  });

  it('retient les 3 meilleurs devoirs en mode top3', () => {
    const [r] = run(
      [student('a')], [subject('m1', 1)],
      [grade('a', 'm1', { devoir1: 5, devoir2: 15, devoir3: 13, composition: 10 })],
      'top3',
    );
    // top3 = (5+15+13)/3 = 11 → μ_mat = 10.5
    expect(r.averageGeneral).toBeCloseTo(10.5, 10);
  });

  it('ne sélectionne rien de plus que les devoirs existants (moins de notes que N)', () => {
    const [r] = run(
      [student('a')], [subject('m1', 1)],
      [grade('a', 'm1', { devoir1: 10, composition: 10 })],
      'top3',
    );
    expect(r.averageGeneral).toBeCloseTo(10, 10);
  });

  it('ignore un devoir désactivé dans les réglages de la matière', () => {
    const [r] = run(
      [student('a')], [subject('m1', 1)],
      [grade('a', 'm1', { devoir1: 20, devoir2: 10, composition: 10 })],
      'all',
      settingsFrom({ m1: { devoir1Active: false } }),
    );
    // devoir1 ignoré → μ_dev = 10 → μ_mat = 10
    expect(r.averageGeneral).toBeCloseTo(10, 10);
  });

  it('prend un devoir 4/5 seulement s\'il a été activé', () => {
    const grades = [grade('a', 'm1', { devoir1: 10, devoir4: 20, composition: 10 })];
    const off = run([student('a')], [subject('m1', 1)], grades)[0];
    expect(off.averageGeneral).toBeCloseTo(10, 10); // devoir4 inactif par défaut

    const on = run([student('a')], [subject('m1', 1)], grades, 'all',
      settingsFrom({ m1: { devoir4Active: true } }))[0];
    expect(on.averageGeneral).toBeCloseTo(12.5, 10); // μ_dev 15 → μ_mat 12.5
  });

  it('accepte une matière sans composition (μ_mat = μ_dev) ou sans devoir (μ_mat = compo)', () => {
    const sansCompo = run([student('a')], [subject('m1', 1)], [grade('a', 'm1', { devoir1: 12 })])[0];
    expect(sansCompo.averageGeneral).toBeCloseTo(12, 10);

    const sansDevoir = run([student('a')], [subject('m1', 1)], [grade('a', 'm1', { composition: 8 })])[0];
    expect(sansDevoir.averageGeneral).toBeCloseTo(8, 10);
  });

  it('EXCLUT une matière non notée des DEUX sommes — jamais comptée comme 0', () => {
    const [r] = run(
      [student('a')],
      [subject('m1', 4), subject('m2', 6)],
      [grade('a', 'm1', { devoir1: 12, composition: 12 })], // m2 jamais saisie
    );
    expect(r.averageGeneral).toBeCloseTo(12, 10); // et non 12×4/10 = 4.8
    expect(r.totalCoef).toBe(4);
    expect(r.subjectDetails.find(d => d.subjectName === 'Matière m2')?.pPond).toBeNull();
  });

  it('exclut une matière dont l\'élève est dispensé, sans toucher aux autres élèves', () => {
    const settings = settingsFrom({ m2: { studentSettings: { a: { active: false } } } });
    const rankings = run(
      [student('a'), student('b')],
      [subject('m1', 2), subject('m2', 2)],
      [
        grade('a', 'm1', { devoir1: 10, composition: 10 }),
        grade('a', 'm2', { devoir1: 20, composition: 20 }),
        grade('b', 'm1', { devoir1: 10, composition: 10 }),
        grade('b', 'm2', { devoir1: 20, composition: 20 }),
      ],
      'all', settings,
    );
    const a = rankings.find(r => r.studentId === 'a')!;
    const b = rankings.find(r => r.studentId === 'b')!;
    expect(a.averageGeneral).toBeCloseTo(10, 10); // m2 dispensée
    expect(a.totalCoef).toBe(2);
    expect(b.averageGeneral).toBeCloseTo(15, 10); // b garde les deux
  });

  it('applique un coefficient personnalisé pour un élève', () => {
    const settings = settingsFrom({ m1: { studentSettings: { a: { active: true, customCoef: '5' } } } });
    const [r] = run([student('a')], [subject('m1', 2)],
      [grade('a', 'm1', { devoir1: 10, composition: 10 })], 'all', settings);
    expect(r.totalCoef).toBe(5);
  });

  it('retombe sur le coefficient de la matière si le coefficient personnalisé est vide', () => {
    const settings = settingsFrom({ m1: { studentSettings: { a: { active: true, customCoef: '' } } } });
    const [r] = run([student('a')], [subject('m1', 3)],
      [grade('a', 'm1', { devoir1: 10, composition: 10 })], 'all', settings);
    expect(r.totalCoef).toBe(3);
  });

  it('donne 0 (et non NaN) à un élève sans aucune note', () => {
    const [r] = run([student('a')], [subject('m1', 2)], []);
    expect(r.averageGeneral).toBe(0);
    expect(r.totalCoef).toBe(0);
  });

  it('ne retient que les élèves et matières de la classe et de la période demandées', () => {
    const rankings = run(
      [student('a'), student('z', { classId: 'autre-classe' })],
      [subject('m1', 1), subject('m9', 1, { periodId: 'autre-periode' })],
      [grade('a', 'm1', { devoir1: 10, composition: 10 }), grade('a', 'm9', { devoir1: 20, composition: 20 })],
    );
    expect(rankings).toHaveLength(1);
    expect(rankings[0].averageGeneral).toBeCloseTo(10, 10);
  });
});

describe('computeClassRanking — rangs', () => {
  const setup = (averages: Record<string, number>) => {
    const students = Object.keys(averages).map(id => student(id));
    const subjects = [subject('m1', 1)];
    const grades = Object.entries(averages).map(([id, note]) =>
      grade(id, 'm1', { devoir1: note, composition: note }));
    return run(students, subjects, grades);
  };

  it('classe du meilleur au moins bon', () => {
    const r = setup({ a: 8, b: 16, c: 12 });
    expect(r.map(x => x.studentId)).toEqual(['b', 'c', 'a']);
    expect(r.map(x => x.rank)).toEqual([1, 2, 3]);
  });

  it('donne le MÊME rang aux ex æquo et saute le rang suivant', () => {
    const r = setup({ a: 16, b: 16, c: 12 });
    expect(r.map(x => x.rank)).toEqual([1, 1, 3]);
  });

  it('gère trois ex æquo en tête', () => {
    const r = setup({ a: 15, b: 15, c: 15, d: 10 });
    expect(r.map(x => x.rank)).toEqual([1, 1, 1, 4]);
  });

  it('rend une liste vide pour une classe sans élève', () => {
    expect(run([], [subject('m1', 1)], [])).toEqual([]);
  });
});

describe('computeClassRanking — examen interne', () => {
  it('utilise la note unique, sans devoirs ni composition', () => {
    const [r] = run(
      [student('a')], [subject('m1', 3)],
      [grade('a', 'm1', { note: 14 })],
      'all', noSettings, true,
    );
    expect(r.averageGeneral).toBeCloseTo(14, 10);
    expect(r.subjectDetails[0]).toMatchObject({ muMat: 14, muDev: null, composition: null, coef: 3 });
  });

  it('pondère les notes d\'examen par les coefficients', () => {
    const [r] = run(
      [student('a')], [subject('m1', 1), subject('m2', 3)],
      [grade('a', 'm1', { note: 8 }), grade('a', 'm2', { note: 16 })],
      'all', noSettings, true,
    );
    expect(r.averageGeneral).toBeCloseTo((8 + 48) / 4, 10); // 14
  });

  it('IGNORE devoirs et composition en période d\'examen (régression)', () => {
    // Bug corrigé : le classement lisait devoir1/composition et jetait la note.
    const [r] = run(
      [student('a')], [subject('m1', 1)],
      [grade('a', 'm1', { note: 5, devoir1: 20, composition: 20 })],
      'all', noSettings, true,
    );
    expect(r.averageGeneral).toBeCloseTo(5, 10);
  });

  it('exclut une matière d\'examen non notée plutôt que de la compter 0', () => {
    const [r] = run(
      [student('a')], [subject('m1', 2), subject('m2', 8)],
      [grade('a', 'm1', { note: 15 })],
      'all', noSettings, true,
    );
    expect(r.averageGeneral).toBeCloseTo(15, 10);
    expect(r.totalCoef).toBe(2);
  });
});
