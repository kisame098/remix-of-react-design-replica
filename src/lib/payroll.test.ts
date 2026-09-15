import { describe, it, expect } from 'vitest';
import {
  computeAmountOwed, getPaidAmountForPeriod, computeRemaining, payrollMonthKey,
} from './payroll';
import type { SalaryPayment } from '@/types/payroll';

// ════════════════════════════════════════════════════════════════════════════
// SALAIRES — l'autre bout du chemin de l'argent : ce que l'école SORT.
// Distinction capitale : `null` (« on ne sait pas encore, à saisir ») n'est pas
// `0` (« rien à payer »). Les confondre ferait signer un bon de paiement à zéro
// franc à quelqu'un qui a travaillé tout le mois.
// ════════════════════════════════════════════════════════════════════════════

const MONTH = '2026-05';

const salary = (over: Partial<SalaryPayment>): SalaryPayment => ({
  id: `s-${Math.random()}`, payeeType: 'teacher', teacherEnrollmentId: 'prof-1',
  periodMonthKey: MONTH, amountDue: 100_000, amountPaid: 100_000,
  method: 'especes', paidAt: '2026-05-31T10:00:00Z', status: 'confirmed',
  createdAt: '2026-05-31T10:00:00Z', ...over,
});

describe('computeAmountOwed', () => {
  it('prof à l\'heure : heures effectives × taux', () => {
    // 300 minutes = 5 h à 3 000 F/h.
    expect(computeAmountOwed('teacher', 'hourly', 3_000, 300)).toBe(15_000);
  });

  it('compte les minutes au prorata, sans arrondi caché', () => {
    expect(computeAmountOwed('teacher', 'hourly', 3_000, 90)).toBe(4_500); // 1h30
    expect(computeAmountOwed('teacher', 'hourly', 3_000, 20)).toBe(1_000); // 20 min
  });

  it('un prof à l\'heure qui n\'a aucune séance pointée est dû de 0, pas de null', () => {
    // 0 est une information : il n'a rien fait ce mois-ci, la ligne reste
    // visible à zéro plutôt que de demander une saisie manuelle.
    expect(computeAmountOwed('teacher', 'hourly', 3_000, 0)).toBe(0);
    expect(computeAmountOwed('teacher', 'hourly', 3_000, undefined)).toBe(0);
  });

  it('salaire fixe : le montant mensuel, sans regarder les heures', () => {
    expect(computeAmountOwed('teacher', 'fixed', 250_000, 12_000)).toBe(250_000);
    expect(computeAmountOwed('staff', 'fixed', 120_000)).toBe(120_000);
  });

  it('PERSONNEL à l\'heure : null — aucun pointage automatique n\'existe pour lui', () => {
    expect(computeAmountOwed('staff', 'hourly', 2_000)).toBeNull();
    expect(computeAmountOwed('staff', 'hourly', 2_000, 600)).toBeNull();
  });

  it('ne rend jamais NaN', () => {
    for (const v of [computeAmountOwed('teacher', 'hourly', 0, 0),
                     computeAmountOwed('teacher', 'fixed', 0)]) {
      expect(Number.isNaN(v as number)).toBe(false);
    }
  });
});

describe('getPaidAmountForPeriod', () => {
  it('additionne les versements du mois', () => {
    const payments = [salary({ amountPaid: 60_000 }), salary({ amountPaid: 40_000 })];
    expect(getPaidAmountForPeriod(payments, 'teacher', 'prof-1', MONTH)).toBe(100_000);
  });

  it('UN VERSEMENT ANNULÉ ne compte plus comme payé', () => {
    const payments = [salary({ amountPaid: 100_000, status: 'cancelled' })];
    expect(getPaidAmountForPeriod(payments, 'teacher', 'prof-1', MONTH)).toBe(0);
  });

  it('ne compte que le mois demandé', () => {
    const payments = [salary({ amountPaid: 100_000, periodMonthKey: '2026-04' })];
    expect(getPaidAmountForPeriod(payments, 'teacher', 'prof-1', MONTH)).toBe(0);
  });

  it('NE CONFOND PAS un prof et un salarié portant le même identifiant', () => {
    // Les deux tables ont des UUID distincts, mais le filtre doit rester strict.
    const payments = [
      salary({ amountPaid: 50_000, payeeType: 'staff', payrollEmployeeId: 'prof-1', teacherEnrollmentId: undefined }),
    ];
    expect(getPaidAmountForPeriod(payments, 'teacher', 'prof-1', MONTH)).toBe(0);
    expect(getPaidAmountForPeriod(payments, 'staff', 'prof-1', MONTH)).toBe(50_000);
  });

  it('ne compte pas le versement d\'un autre employé', () => {
    const payments = [salary({ amountPaid: 100_000, teacherEnrollmentId: 'prof-2' })];
    expect(getPaidAmountForPeriod(payments, 'teacher', 'prof-1', MONTH)).toBe(0);
  });

  it('rend 0 et non NaN quand rien n\'a été versé', () => {
    expect(getPaidAmountForPeriod([], 'teacher', 'prof-1', MONTH)).toBe(0);
  });
});

describe('computeRemaining', () => {
  it('calcule le reste à payer', () => {
    expect(computeRemaining(100_000, 60_000)).toBe(40_000);
    expect(computeRemaining(100_000, 100_000)).toBe(0);
  });

  it('rend un reste NÉGATIF en cas de trop-versé, au lieu de le masquer', () => {
    // Un trop-payé doit se voir, pas se faire arrondir à zéro en silence.
    expect(computeRemaining(100_000, 130_000)).toBe(-30_000);
  });

  it('reste null tant que le montant dû doit être saisi', () => {
    expect(computeRemaining(null, 0)).toBeNull();
    expect(computeRemaining(null, 50_000)).toBeNull();
  });

  it('cas complet : prof à l\'heure, acompte versé', () => {
    const owed = computeAmountOwed('teacher', 'hourly', 3_000, 1_200); // 20 h → 60 000
    const paid = getPaidAmountForPeriod(
      [salary({ amountPaid: 20_000 }), salary({ amountPaid: 5_000, status: 'cancelled' })],
      'teacher', 'prof-1', MONTH);
    expect(owed).toBe(60_000);
    expect(paid).toBe(20_000);              // l'acompte annulé ne compte pas
    expect(computeRemaining(owed, paid)).toBe(40_000);
  });
});

describe('payrollMonthKey', () => {
  it('zéro-pade le mois pour que les clés se trient naturellement', () => {
    expect(payrollMonthKey(2026, 5)).toBe('2026-05');
    expect(payrollMonthKey(2026, 12)).toBe('2026-12');
  });

  it('les clés d\'une année se trient dans l\'ordre des mois', () => {
    const keys = [1, 2, 9, 10, 11, 12].map(m => payrollMonthKey(2026, m));
    expect([...keys].sort()).toEqual(keys);
  });
});
