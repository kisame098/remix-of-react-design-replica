import { describe, it, expect } from 'vitest';
import { computeElementaryClassRanking } from './useElementaryClassRanking';
import type { Student, ElementaryClassLine, ElementaryGrade, ElementaryLineSetting } from '@/contexts/SchoolContext';

// ════════════════════════════════════════════════════════════════════════════
// MOYENNE ÉLÉMENTAIRE (CI → CM2) — barème de points, pas de coefficients :
//   MOYENNE = (Σ points obtenus × 10) / (Σ points max des disciplines SAISIES)
// Une discipline non saisie ou dispensée sort des DEUX sommes.
// ════════════════════════════════════════════════════════════════════════════

const PERIOD = 'per-1';
const CLASS = 'cls-1';

const student = (id: string, over: Partial<Student> = {}): Student => ({
  id, studentId: `ETU-${id}`, firstName: `P${id}`, lastName: `N${id}`,
  dateOfBirth: '2016-01-01', placeOfBirth: 'Dakar', sex: 'femme',
  residence: 'Dakar', tutor1: { status: 'mere', phone: '77' } as Student['tutor1'],
  classId: CLASS, createdAt: new Date('2025-09-01'), enrolledAt: '2025-09-01', ...over,
});

const line = (id: string, pointMax: number, over: Partial<ElementaryClassLine> = {}): ElementaryClassLine => ({
  id, classId: CLASS, periodId: PERIOD, domaine: 'LC', registre: 'RESSOURCES',
  name: `Discipline ${id}`, pointMax, ordering: 0, ...over,
});

const note = (studentEnrollmentId: string, lineId: string, pointsObtenus?: number): ElementaryGrade => ({
  id: `g-${studentEnrollmentId}-${lineId}`, lineId, studentEnrollmentId, pointsObtenus,
});

const exemption = (studentEnrollmentId: string, lineId: string): ElementaryLineSetting => ({
  id: `s-${studentEnrollmentId}-${lineId}`, lineId, studentEnrollmentId,
  active: false, overrideReason: 'manual',
});

const run = (
  students: Student[], lines: ElementaryClassLine[], grades: ElementaryGrade[],
  settings: ElementaryLineSetting[] = [],
) => computeElementaryClassRanking(CLASS, PERIOD, students, lines, grades, settings);

describe('computeElementaryClassRanking', () => {
  it('ramène le total de points sur 10', () => {
    const [r] = run(
      [student('a')],
      [line('l1', 50), line('l2', 50)],
      [note('a', 'l1', 40), note('a', 'l2', 30)],
    );
    expect(r.average).toBeCloseTo(7, 10);     // 70 × 10 / 100
    expect(r.pointsObtenus).toBe(70);
    expect(r.pointsMax).toBe(100);
  });

  it('EXCLUT une discipline non saisie des deux sommes (jamais comptée 0)', () => {
    const [r] = run(
      [student('a')],
      [line('l1', 50), line('l2', 50)],
      [note('a', 'l1', 40)], // l2 pas saisie
    );
    expect(r.average).toBeCloseTo(8, 10);     // 40 × 10 / 50, et non 40/100
    expect(r.pointsMax).toBe(50);
  });

  it('traite une saisie explicite à 0 comme une vraie note, pas comme une absence de saisie', () => {
    const [r] = run(
      [student('a')],
      [line('l1', 50), line('l2', 50)],
      [note('a', 'l1', 40), note('a', 'l2', 0)],
    );
    expect(r.average).toBeCloseTo(4, 10);     // 40 × 10 / 100
  });

  it('laisse la moyenne indéfinie tant qu\'aucune discipline n\'est saisie', () => {
    const [r] = run([student('a')], [line('l1', 50)], []);
    expect(r.average).toBeUndefined();
    expect(r.rank).toBe(0);
  });

  it('ignore une ligne de grade qui pointe vers une autre période ou classe', () => {
    const [r] = run(
      [student('a')],
      [line('l1', 50)],
      [note('a', 'l1', 25), note('a', 'l-inconnue', 50)],
    );
    expect(r.average).toBeCloseTo(5, 10);
  });

  it('borne la moyenne à 10 même si la saisie dépasse le barème', () => {
    const [r] = run([student('a')], [line('l1', 50)], [note('a', 'l1', 80)]);
    expect(r.average).toBe(10);
  });

  it('ne descend jamais sous 0', () => {
    const [r] = run([student('a')], [line('l1', 50)], [note('a', 'l1', -20)]);
    expect(r.average).toBe(0);
  });

  // ── Dispenses ────────────────────────────────────────────────────────────
  it('sort une discipline dispensée du numérateur ET du dénominateur', () => {
    const lines = [line('l1', 50), line('l2', 50)];
    const grades = [note('a', 'l1', 40), note('a', 'l2', 10)];

    const sans = run([student('a')], lines, grades)[0];
    expect(sans.average).toBeCloseTo(5, 10);  // 50 × 10 / 100

    const avec = run([student('a')], lines, grades, [exemption('a', 'l2')])[0];
    expect(avec.average).toBeCloseTo(8, 10);  // 40 × 10 / 50 — ni pénalisé, ni avantagé
    expect(avec.pointsMax).toBe(50);
  });

  it('ne dispense QUE l\'élève concerné', () => {
    const lines = [line('l1', 50), line('l2', 50)];
    const grades = [
      note('a', 'l1', 40), note('a', 'l2', 10),
      note('b', 'l1', 40), note('b', 'l2', 10),
    ];
    const r = run([student('a'), student('b')], lines, grades, [exemption('a', 'l2')]);
    expect(r.find(x => x.studentId === 'a')!.average).toBeCloseTo(8, 10);
    expect(r.find(x => x.studentId === 'b')!.average).toBeCloseTo(5, 10);
  });

  it('un réglage actif=true ne dispense de rien', () => {
    const settings: ElementaryLineSetting[] = [
      { id: 's1', lineId: 'l2', studentEnrollmentId: 'a', active: true },
    ];
    const [r] = run([student('a')], [line('l1', 50), line('l2', 50)],
      [note('a', 'l1', 40), note('a', 'l2', 10)], settings);
    expect(r.average).toBeCloseTo(5, 10);
  });

  // ── Rangs ────────────────────────────────────────────────────────────────
  it('classe et gère les ex æquo comme le collège', () => {
    const lines = [line('l1', 100)];
    const r = run(
      [student('a'), student('b'), student('c')],
      lines,
      [note('a', 'l1', 60), note('b', 'l1', 90), note('c', 'l1', 60)],
    );
    const byId = Object.fromEntries(r.map(x => [x.studentId, x.rank]));
    expect(byId).toEqual({ b: 1, a: 2, c: 2 });
  });

  it('place les élèves sans aucune note en rang 0, derrière tout le monde', () => {
    const r = run(
      [student('a'), student('b')],
      [line('l1', 100)],
      [note('a', 'l1', 50)],
    );
    expect(r.find(x => x.studentId === 'b')!.rank).toBe(0);
    expect(r.find(x => x.studentId === 'a')!.rank).toBe(1);
  });

  it('rend un résultat par élève de la classe, dans l\'ordre d\'entrée', () => {
    const r = run([student('a'), student('b')], [line('l1', 100)], [note('b', 'l1', 100)]);
    expect(r.map(x => x.studentId)).toEqual(['a', 'b']);
  });

  it('ignore les élèves d\'une autre classe', () => {
    const r = run([student('a'), student('z', { classId: 'autre' })], [line('l1', 100)], []);
    expect(r).toHaveLength(1);
  });
});
