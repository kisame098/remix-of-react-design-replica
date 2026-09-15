import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import Papa from 'papaparse';

import {
  getAcademicMonths, getBillableMonthsFor, getSchoolBillableMonths, getStudentBillableMonths,
  readBillingRules, encodePaymentIntent, decodePaymentIntent,
  type AcademicMonth, type BillingRules,
} from '@/types/payment';
import { buildCsv, escapeCsvField } from '@/lib/csvExport';
import { computeAmountOwed, computeRemaining, getPaidAmountForPeriod } from '@/lib/payroll';
import { computeMonthlyHours, calcDuration } from '@/lib/teacherHours';
import { computeClassRanking } from '@/hooks/useClassRanking';
import { computeElementaryClassRanking } from '@/hooks/useElementaryClassRanking';
import { averageAcrossPeriods } from '@/lib/cumulativeAverage';
import { getSubscriptionGate } from '@/lib/subscription';
import type { Student, Subject, Grade, ElementaryClassLine, ElementaryGrade, ElementaryLineSetting } from '@/contexts/SchoolContext';
import type { SalaryPayment } from '@/types/payroll';
import type { AttendanceSession, TeacherAttendance, TeacherAttendanceStatus } from '@/types/attendance';

// ════════════════════════════════════════════════════════════════════════════
// TESTS PAR PROPRIÉTÉS
//
// Les tests classiques vérifient des cas que j'ai imaginés. Ceux-ci génèrent
// des milliers de situations ALÉATOIRES et vérifient qu'une règle tient
// toujours — ils trouvent les cas auxquels personne n'a pensé.
//
// Quand une propriété tombe, fast-check réduit automatiquement le contre-exemple
// au plus petit cas qui échoue encore, et affiche la graine pour le rejouer.
//
// Nombre de cas piloté par FC_RUNS (défaut 200 ; la campagne longue monte à
// plusieurs milliers) — voir scripts/campagne.mjs.
// ════════════════════════════════════════════════════════════════════════════

const RUNS = Number(process.env.FC_RUNS ?? 200);
const params = { numRuns: RUNS, ...(process.env.FC_SEED ? { seed: Number(process.env.FC_SEED) } : {}) };

// Le délai par test suit le nombre de tirages : à 100 000 cas, une propriété
// met légitimement une minute. Sans cela, la campagne longue rendrait un
// verdict rouge pour une simple question de chronomètre — et un verdict rouge
// qui n'est pas un vrai défaut, on apprend vite à l'ignorer.
vi.setConfig({ testTimeout: Math.max(10_000, RUNS * 3) });

// ─── Générateurs du domaine ─────────────────────────────────────────────────

/** Une date ISO plausible d'année scolaire. */
const isoDate = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31'), noInvalidDate: true })
  .map(d => d.toISOString().slice(0, 10));

/** Une année scolaire cohérente (début < fin, 1 à 14 mois). */
const anneeScolaire = fc.record({
  start: isoDate,
  duree: fc.integer({ min: 0, max: 13 }),
}).map(({ start, duree }) => {
  const d = new Date(start);
  const end = new Date(d.getFullYear(), d.getMonth() + duree, 28);
  return { start, end: end.toISOString().slice(0, 10) };
});

const note20 = fc.float({ min: 0, max: 20, noNaN: true, noDefaultInfinity: true });
const coefficient = fc.integer({ min: 1, max: 10 });

// ════════════════════════════════════════════════════════════════════════════
// 1. MOIS FACTURABLES
// ════════════════════════════════════════════════════════════════════════════

describe('propriétés — mois facturables', () => {
  const moisDeLAnnee = anneeScolaire.map(({ start, end }) => getAcademicMonths(start, end));

  it('les mois dus sont TOUJOURS un sous-ensemble des mois de l\'année', () => {
    fc.assert(fc.property(
      moisDeLAnnee,
      fc.array(fc.string()),
      fc.option(fc.integer({ min: 1, max: 31 }), { nil: null }),
      fc.option(isoDate, { nil: undefined }),
      (mois, exclus, jour, inscrit) => {
        const rules: BillingRules = { excludedMonths: exclus, waiveArrivalMonthFromDay: jour };
        const dus = getBillableMonthsFor(mois, rules, inscrit);
        const cles = new Set(mois.map(m => m.key));
        // Jamais de mois inventé, jamais de doublon, ordre préservé.
        expect(dus.every(m => cles.has(m.key))).toBe(true);
        expect(new Set(dus.map(m => m.key)).size).toBe(dus.length);
        expect(dus.map(m => m.key)).toEqual([...dus].sort((a, b) => a.key.localeCompare(b.key)).map(m => m.key));
      },
    ), params);
  });

  it('un mois décoché n\'est JAMAIS facturé, quelle que soit la date d\'inscription', () => {
    fc.assert(fc.property(
      moisDeLAnnee, fc.option(isoDate, { nil: undefined }),
      (mois, inscrit) => {
        fc.pre(mois.length > 0);
        const exclu = mois[Math.floor(mois.length / 2)].key;
        const rules: BillingRules = { excludedMonths: [exclu], waiveArrivalMonthFromDay: null };
        expect(getBillableMonthsFor(mois, rules, inscrit).some(m => m.key === exclu)).toBe(false);
      },
    ), params);
  });

  it('un élève inscrit avant l\'ouverture doit exactement les mois non décochés', () => {
    fc.assert(fc.property(moisDeLAnnee, (mois) => {
      fc.pre(mois.length > 0);
      const avant = new Date(new Date(`${mois[0].key}-01`).getTime() - 86400000 * 400)
        .toISOString().slice(0, 10);
      const rules: BillingRules = { excludedMonths: [], waiveArrivalMonthFromDay: null };
      expect(getBillableMonthsFor(mois, rules, avant).map(m => m.key)).toEqual(mois.map(m => m.key));
    }), params);
  });

  it('le filtre est idempotent : re-filtrer ne retire rien de plus', () => {
    fc.assert(fc.property(
      moisDeLAnnee, fc.array(fc.string()), fc.option(isoDate, { nil: undefined }),
      (mois, exclus, inscrit) => {
        const rules: BillingRules = { excludedMonths: exclus, waiveArrivalMonthFromDay: null };
        const une = getBillableMonthsFor(mois, rules, inscrit);
        const deux = getBillableMonthsFor(une, rules, inscrit);
        expect(deux.map(m => m.key)).toEqual(une.map(m => m.key));
      },
    ), params);
  });

  it('offrir le mois d\'arrivée ne peut que RÉDUIRE la facture, jamais l\'augmenter', () => {
    fc.assert(fc.property(
      moisDeLAnnee, isoDate, fc.integer({ min: 1, max: 31 }),
      (mois, inscrit, jour) => {
        const sans = getStudentBillableMonths(mois, inscrit, null).length;
        const avec = getStudentBillableMonths(mois, inscrit, jour).length;
        expect(avec).toBeLessThanOrEqual(sans);
      },
    ), params);
  });

  it('les deux filtres commutent : école puis élève = élève puis école', () => {
    fc.assert(fc.property(
      moisDeLAnnee, fc.array(fc.string()), fc.option(isoDate, { nil: undefined }),
      fc.option(fc.integer({ min: 1, max: 31 }), { nil: null }),
      (mois, exclus, inscrit, jour) => {
        const a = getStudentBillableMonths(getSchoolBillableMonths(mois, exclus), inscrit, jour);
        const b = getSchoolBillableMonths(getStudentBillableMonths(mois, inscrit, jour), exclus);
        expect(a.map(m => m.key)).toEqual(b.map(m => m.key));
      },
    ), params);
  });

  it('les réglages d\'école ne plantent jamais, quelle que soit la valeur stockée', () => {
    fc.assert(fc.property(
      fc.dictionary(fc.string(), fc.anything()),
      (settings) => {
        const r = readBillingRules(settings as Record<string, unknown>);
        expect(Array.isArray(r.excludedMonths)).toBe(true);
        expect(r.excludedMonths.every(k => typeof k === 'string')).toBe(true);
        expect(r.waiveArrivalMonthFromDay === null
          || (Number.isInteger(r.waiveArrivalMonthFromDay) && r.waiveArrivalMonthFromDay >= 1 && r.waiveArrivalMonthFromDay <= 31)).toBe(true);
      },
    ), params);
  });

  it('les mois de l\'année sont toujours consécutifs et bien formés', () => {
    fc.assert(fc.property(anneeScolaire, ({ start, end }) => {
      const mois = getAcademicMonths(start, end);
      for (let i = 0; i < mois.length; i++) {
        expect(mois[i].key).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
        expect(mois[i].index).toBe(i);
        expect(mois[i].dueDate.slice(0, 7)).toBe(mois[i].key);
        if (i > 0) expect(mois[i].key > mois[i - 1].key).toBe(true);
      }
    }), params);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. QR DE PAIEMENT
// ════════════════════════════════════════════════════════════════════════════

describe('propriétés — QR de paiement', () => {
  const idSain = fc.stringMatching(/^[A-Za-z0-9-]{1,40}$/);

  it('encoder puis décoder rend exactement l\'intention de départ', () => {
    fc.assert(fc.property(
      idSain, idSain, fc.stringMatching(/^\d{4}-\d{2}$/),
      fc.constantFrom('inscription', 'tuition', 'service'),
      (enrollmentId, serviceId, monthKey, type) => {
        const intent = type === 'inscription' ? { enrollmentId, type } as const
          : type === 'tuition' ? { enrollmentId, type, monthKey } as const
          : { enrollmentId, type, serviceId, monthKey } as const;
        expect(decodePaymentIntent(encodePaymentIntent(intent))).toEqual(intent);
      },
    ), params);
  });

  it('un code quelconque ne devient jamais une intention valide par accident', () => {
    fc.assert(fc.property(fc.string(), (code) => {
      const r = decodePaymentIntent(code);
      // Soit null, soit une intention réellement cohérente.
      if (r !== null) {
        expect(r.enrollmentId.length).toBeGreaterThan(0);
        expect(['inscription', 'tuition', 'service']).toContain(r.type);
      }
    }), params);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. EXPORT CSV — aller-retour avec un vrai parseur
// ════════════════════════════════════════════════════════════════════════════

describe('propriétés — export CSV', () => {
  it('ce qui est exporté se relit à l\'identique (guillemets, virgules, retours ligne)', () => {
    fc.assert(fc.property(
      fc.array(fc.string({ maxLength: 40 }), { minLength: 1, maxLength: 6 }),
      fc.array(fc.array(fc.string({ maxLength: 40 }), { minLength: 1, maxLength: 6 }), { maxLength: 8 }),
      (entetes, lignes) => {
        // Toutes les lignes doivent avoir le même nombre de colonnes.
        const rows = lignes.map(r => entetes.map((_, i) => r[i] ?? ''));
        const csv = buildCsv(entetes, rows);
        const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ''), { delimiter: ';' });
        expect(parsed.data[0]).toEqual(entetes);
        rows.forEach((row, i) => expect(parsed.data[i + 1]).toEqual(row));
      },
    ), params);
  });

  it('un champ échappé est toujours entouré de guillemets équilibrés', () => {
    fc.assert(fc.property(fc.string(), (v) => {
      const e = escapeCsvField(v);
      expect(e.startsWith('"')).toBe(true);
      expect(e.endsWith('"')).toBe(true);
      // Les guillemets internes sont doublés : leur nombre est donc pair.
      expect((e.match(/"/g) ?? []).length % 2).toBe(0);
    }), params);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. CLASSEMENTS ET MOYENNES
// ════════════════════════════════════════════════════════════════════════════

const eleve = (id: string): Student => ({
  id, studentId: `ETU-${id}`, firstName: id, lastName: id,
  dateOfBirth: '2010-01-01', placeOfBirth: 'Dakar', sex: 'homme', residence: 'Dakar',
  tutor1: { status: 'pere', phone: '77' } as Student['tutor1'],
  classId: 'C', createdAt: new Date(), enrolledAt: '2025-09-01',
});

describe('propriétés — classement collège', () => {
  const scenario = fc.array(
    fc.record({ note: note20, coef: coefficient }),
    { minLength: 1, maxLength: 8 },
  );

  it('la moyenne générale reste dans [0, 20]', () => {
    fc.assert(fc.property(scenario, (matieres) => {
      const subjects: Subject[] = matieres.map((m, i) => ({
        id: `m${i}`, name: `M${i}`, coefficient: m.coef, classId: 'C', periodId: 'P',
        ordering: i, subjectType: 'obligatoire',
      }));
      const grades: Grade[] = matieres.map((m, i) => ({
        id: `g${i}`, studentEnrollmentId: 'a', subjectId: `m${i}`, devoir1: m.note, composition: m.note,
      }));
      const [r] = computeClassRanking('P', 'C', 'all', [eleve('a')], subjects, grades, () => undefined, false);
      expect(r.averageGeneral).toBeGreaterThanOrEqual(0);
      expect(r.averageGeneral).toBeLessThanOrEqual(20);
      expect(Number.isNaN(r.averageGeneral)).toBe(false);
    }), params);
  });

  it('AJOUTER UNE MATIÈRE NON NOTÉE ne change pas la moyenne', () => {
    // L'invariant le plus coûteux du produit : une matière oubliée par un prof
    // ne doit jamais faire chuter la moyenne de toute une classe.
    fc.assert(fc.property(scenario, coefficient, (matieres, coefVide) => {
      const base: Subject[] = matieres.map((m, i) => ({
        id: `m${i}`, name: `M${i}`, coefficient: m.coef, classId: 'C', periodId: 'P',
        ordering: i, subjectType: 'obligatoire',
      }));
      const grades: Grade[] = matieres.map((m, i) => ({
        id: `g${i}`, studentEnrollmentId: 'a', subjectId: `m${i}`, devoir1: m.note, composition: m.note,
      }));
      const avec: Subject[] = [...base, {
        id: 'vide', name: 'NonNotee', coefficient: coefVide, classId: 'C', periodId: 'P',
        ordering: 99, subjectType: 'obligatoire',
      }];
      const sans = computeClassRanking('P', 'C', 'all', [eleve('a')], base, grades, () => undefined, false)[0];
      const plus = computeClassRanking('P', 'C', 'all', [eleve('a')], avec, grades, () => undefined, false)[0];
      expect(plus.averageGeneral).toBeCloseTo(sans.averageGeneral, 9);
      expect(plus.totalCoef).toBe(sans.totalCoef);
    }), params);
  });

  it('le rang 1 a toujours la meilleure moyenne, et les rangs sont cohérents', () => {
    fc.assert(fc.property(
      fc.array(note20, { minLength: 1, maxLength: 12 }),
      (notes) => {
        const students = notes.map((_, i) => eleve(`e${i}`));
        const subjects: Subject[] = [{
          id: 'm', name: 'M', coefficient: 2, classId: 'C', periodId: 'P',
          ordering: 0, subjectType: 'obligatoire',
        }];
        const grades: Grade[] = notes.map((n, i) => ({
          id: `g${i}`, studentEnrollmentId: `e${i}`, subjectId: 'm', devoir1: n, composition: n,
        }));
        const classement = computeClassRanking('P', 'C', 'all', students, subjects, grades, () => undefined, false);
        const tries = [...classement].sort((a, b) => b.averageGeneral - a.averageGeneral);
        expect(tries[0].rank).toBe(1);
        for (let i = 1; i < tries.length; i++) {
          // Rang croissant, et égalité de moyenne ⇒ égalité de rang.
          expect(tries[i].rank).toBeGreaterThanOrEqual(tries[i - 1].rank);
          if (tries[i].averageGeneral === tries[i - 1].averageGeneral) {
            expect(tries[i].rank).toBe(tries[i - 1].rank);
          } else {
            expect(tries[i].rank).toBeGreaterThan(tries[i - 1].rank);
          }
        }
        expect(classement).toHaveLength(notes.length);
      },
    ), params);
  });

  it('en examen interne, seule la note unique compte', () => {
    fc.assert(fc.property(note20, note20, note20, (note, devoir, compo) => {
      const subjects: Subject[] = [{
        id: 'm', name: 'M', coefficient: 3, classId: 'C', periodId: 'P',
        ordering: 0, subjectType: 'obligatoire',
      }];
      const grades: Grade[] = [{
        id: 'g', studentEnrollmentId: 'a', subjectId: 'm', note, devoir1: devoir, composition: compo,
      }];
      const [r] = computeClassRanking('P', 'C', 'all', [eleve('a')], subjects, grades, () => undefined, true);
      expect(r.averageGeneral).toBeCloseTo(note, 9);
    }), params);
  });
});

describe('propriétés — classement élémentaire', () => {
  const disciplines = fc.array(
    fc.record({ max: fc.integer({ min: 1, max: 60 }), obtenu: fc.integer({ min: 0, max: 60 }) }),
    { minLength: 1, maxLength: 12 },
  );

  const construire = (lignes: { max: number; obtenu: number }[], saisies: boolean[]) => {
    const lines: ElementaryClassLine[] = lignes.map((l, i) => ({
      id: `l${i}`, classId: 'C', periodId: 'P', domaine: 'LC', registre: 'RESSOURCES',
      name: `D${i}`, pointMax: l.max, ordering: i,
    }));
    const grades: ElementaryGrade[] = lignes.flatMap((l, i) => saisies[i]
      ? [{ id: `g${i}`, lineId: `l${i}`, studentEnrollmentId: 'a', pointsObtenus: Math.min(l.obtenu, l.max) }]
      : []);
    return { lines, grades };
  };

  it('la moyenne élémentaire reste dans [0, 10] ou indéfinie', () => {
    fc.assert(fc.property(disciplines, (lignes) => {
      const { lines, grades } = construire(lignes, lignes.map(() => true));
      const [r] = computeElementaryClassRanking('C', 'P', [eleve('a')], lines, grades, []);
      expect(r.average === undefined || (r.average >= 0 && r.average <= 10)).toBe(true);
      expect(Number.isNaN(r.average ?? 0)).toBe(false);
    }), params);
  });

  it('une discipline NON SAISIE ne change pas la moyenne', () => {
    fc.assert(fc.property(disciplines, fc.integer({ min: 1, max: 60 }), (lignes, maxVide) => {
      const { lines, grades } = construire(lignes, lignes.map(() => true));
      const avecVide: ElementaryClassLine[] = [...lines, {
        id: 'vide', classId: 'C', periodId: 'P', domaine: 'LC', registre: 'RESSOURCES',
        name: 'Vide', pointMax: maxVide, ordering: 99,
      }];
      const sans = computeElementaryClassRanking('C', 'P', [eleve('a')], lines, grades, [])[0];
      const plus = computeElementaryClassRanking('C', 'P', [eleve('a')], avecVide, grades, [])[0];
      expect(plus.average).toBeCloseTo(sans.average ?? 0, 9);
    }), params);
  });

  it('DISPENSER une discipline non saisie ne change RIEN', () => {
    fc.assert(fc.property(disciplines, (lignes) => {
      fc.pre(lignes.length >= 2);
      const saisies = lignes.map((_, i) => i !== 0); // la première n'est pas saisie
      const { lines, grades } = construire(lignes, saisies);
      const dispense: ElementaryLineSetting[] = [
        { id: 's', lineId: 'l0', studentEnrollmentId: 'a', active: false },
      ];
      const sans = computeElementaryClassRanking('C', 'P', [eleve('a')], lines, grades, [])[0];
      const avec = computeElementaryClassRanking('C', 'P', [eleve('a')], lines, grades, dispense)[0];
      expect(avec.average).toBeCloseTo(sans.average ?? 0, 9);
    }), params);
  });

  it('les points retenus ne dépassent jamais le barème des disciplines comptées', () => {
    fc.assert(fc.property(disciplines, fc.array(fc.boolean(), { minLength: 12, maxLength: 12 }), (lignes, bools) => {
      const saisies = lignes.map((_, i) => bools[i % bools.length]);
      const { lines, grades } = construire(lignes, saisies);
      const [r] = computeElementaryClassRanking('C', 'P', [eleve('a')], lines, grades, []);
      expect(r.pointsObtenus).toBeLessThanOrEqual(r.pointsMax);
      expect(r.pointsMax).toBeLessThanOrEqual(lignes.reduce((s, l) => s + l.max, 0));
    }), params);
  });
});

describe('propriétés — moyenne cumulée', () => {
  it('la moyenne annuelle est toujours entre la plus basse et la plus haute période', () => {
    fc.assert(fc.property(
      fc.array(fc.array(fc.record({ studentId: fc.constant('a'), average: note20 }), { minLength: 1, maxLength: 1 }),
        { minLength: 1, maxLength: 4 }),
      (periodes) => {
        const [r] = averageAcrossPeriods(periodes);
        const valeurs = periodes.flat().map(p => p.average);
        expect(r.average).toBeGreaterThanOrEqual(Math.min(...valeurs) - 1e-9);
        expect(r.average).toBeLessThanOrEqual(Math.max(...valeurs) + 1e-9);
      },
    ), params);
  });

  it('chaque élève n\'apparaît qu\'une fois, quel que soit le nombre de périodes', () => {
    fc.assert(fc.property(
      fc.array(fc.array(fc.record({
        studentId: fc.stringMatching(/^e[0-9]$/), average: note20,
      }), { maxLength: 8 }), { maxLength: 4 }),
      (periodes) => {
        const r = averageAcrossPeriods(periodes);
        expect(new Set(r.map(x => x.studentId)).size).toBe(r.length);
      },
    ), params);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. SALAIRES ET HEURES
// ════════════════════════════════════════════════════════════════════════════

describe('propriétés — salaires', () => {
  it('le dû n\'est jamais négatif, et null seulement pour le personnel horaire', () => {
    fc.assert(fc.property(
      fc.constantFrom('teacher' as const, 'staff' as const),
      fc.constantFrom('hourly' as const, 'fixed' as const),
      fc.integer({ min: 0, max: 5_000_000 }),
      fc.integer({ min: 0, max: 20_000 }),
      (payee, type, montant, minutes) => {
        const owed = computeAmountOwed(payee, type, montant, minutes);
        if (payee === 'staff' && type === 'hourly') {
          expect(owed).toBeNull();
        } else {
          expect(owed).not.toBeNull();
          expect(owed!).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(owed!)).toBe(true);
        }
      },
    ), params);
  });

  it('reste à payer = dû − versé, exactement', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5_000_000 }),
      fc.array(fc.record({ montant: fc.integer({ min: 0, max: 500_000 }), annule: fc.boolean() }), { maxLength: 10 }),
      (owed, versements) => {
        const payments: SalaryPayment[] = versements.map((v, i) => ({
          id: `s${i}`, payeeType: 'teacher', teacherEnrollmentId: 'p1', periodMonthKey: '2026-05',
          amountDue: owed, amountPaid: v.montant, method: 'especes', paidAt: '', createdAt: '',
          status: v.annule ? 'cancelled' : 'confirmed',
        }));
        const paid = getPaidAmountForPeriod(payments, 'teacher', 'p1', '2026-05');
        const attendu = versements.filter(v => !v.annule).reduce((s, v) => s + v.montant, 0);
        expect(paid).toBe(attendu);
        expect(computeRemaining(owed, paid)).toBe(owed - paid);
      },
    ), params);
  });

  it('les heures payées ne dépassent jamais les heures théoriques validées', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        debutH: fc.integer({ min: 6, max: 18 }),
        duree: fc.integer({ min: 1, max: 4 }),
        statut: fc.constantFrom<TeacherAttendanceStatus>('present', 'absent', 'late', 'incomplete', 'undefined'),
        minutes: fc.integer({ min: 0, max: 240 }),
      }), { maxLength: 12 }),
      (seances) => {
        const sessions: AttendanceSession[] = seances.map((s, i) => ({
          id: `s${i}`, scheduleEventId: `e${i}`, date: '2026-05-04', dayIndex: 0,
          startTime: `${String(s.debutH).padStart(2, '0')}:00`,
          endTime: `${String(s.debutH + s.duree).padStart(2, '0')}:00`,
          classId: 'C', className: 'C', teacherId: 'p1', teacherName: 'P',
          subjectName: 'M', groupId: 'all', groupName: 'all',
          studentAttendanceComplete: false, teacherAttendanceComplete: false,
        }));
        const atts: TeacherAttendance[] = seances.map((s, i) => ({
          id: `a${i}`, sessionId: `s${i}`, teacherId: 'p1', status: s.statut,
          effectiveMinutes: Math.min(s.minutes, s.duree * 60),
          theoreticalMinutes: s.duree * 60, recordedAt: new Date(), isLocked: false,
        }));
        const r = computeMonthlyHours('p1', 5, 2026, 'P', sessions, atts);
        expect(r.totalEffectiveMinutes).toBeLessThanOrEqual(r.totalTheoreticalMinutes);
        expect(r.validatedSessions + r.absentSessions + r.undefinedSessions).toBe(r.totalSessions);
        expect(r.totalEffectiveMinutes).toBeGreaterThanOrEqual(0);
      },
    ), params);
  });

  it('une durée de créneau n\'est jamais négative', () => {
    fc.assert(fc.property(
      fc.stringMatching(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
      fc.stringMatching(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
      (a, b) => {
        expect(calcDuration(a, b)).toBeGreaterThanOrEqual(0);
      },
    ), params);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. ABONNEMENTS
// ════════════════════════════════════════════════════════════════════════════

describe('propriétés — abonnement', () => {
  it('un abonnement PAYANT n\'est jamais bloqué, quelle que soit son échéance', () => {
    fc.assert(fc.property(fc.option(isoDate, { nil: null }), (echeance) => {
      expect(getSubscriptionGate('active', echeance)).toBe('ok');
    }), params);
  });

  it('suspendu ou annulé est bloqué, quelle que soit l\'échéance', () => {
    fc.assert(fc.property(
      fc.constantFrom('suspended' as const, 'cancelled' as const),
      fc.option(isoDate, { nil: null }),
      (statut, echeance) => {
        expect(getSubscriptionGate(statut, echeance)).not.toBe('ok');
      },
    ), params);
  });

  it('le verdict ne dépend que du statut et de l\'échéance (fonction pure)', () => {
    fc.assert(fc.property(
      fc.constantFrom('trial' as const, 'active' as const, 'suspended' as const, 'cancelled' as const),
      fc.option(isoDate, { nil: null }),
      (statut, echeance) => {
        expect(getSubscriptionGate(statut, echeance)).toBe(getSubscriptionGate(statut, echeance));
      },
    ), params);
  });
});
