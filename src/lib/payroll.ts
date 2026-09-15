// ═══════════════════════════════════════════════════════════════════════════
// SALAIRES — combien doit-on à qui ce mois-ci, et combien a déjà été versé.
//
//   • prof payé à l'heure   → heures EFFECTIVES × taux (voir teacherHours.ts :
//     une séance non pointée ne rapporte rien) ;
//   • salaire fixe          → le montant mensuel, prof ou personnel ;
//   • personnel à l'heure   → null = à saisir à la main (aucun pointage
//     automatique n'existe pour le personnel non-enseignant).
//
// `null` et `0` ne veulent PAS dire la même chose : null = « on ne sait pas
// encore », 0 = « rien à payer ». Les confondre ferait signer un bon de
// paiement à zéro franc.
//
// Fonctions pures (payroll.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

import type { PayeeType, PayrollMonthKey, PayrollPaymentType, SalaryPayment } from '@/types/payroll';

/** Montant dû pour le mois ; null quand il doit être saisi manuellement. */
export const computeAmountOwed = (
  payeeType: PayeeType,
  paymentType: PayrollPaymentType,
  salaryAmount: number,
  effectiveMinutes?: number,
): number | null => {
  if (paymentType === 'fixed') return salaryAmount;
  if (payeeType === 'teacher') return ((effectiveMinutes ?? 0) / 60) * salaryAmount;
  return null; // personnel non-enseignant à l'heure : heures saisies à la main
};

/** Somme réellement versée sur la période — une annulation ne compte plus. */
export const getPaidAmountForPeriod = (
  salaryPayments: SalaryPayment[],
  payeeType: PayeeType,
  id: string,
  periodMonthKey: PayrollMonthKey,
): number =>
  salaryPayments
    .filter(p =>
      p.payeeType === payeeType &&
      (payeeType === 'teacher' ? p.teacherEnrollmentId === id : p.payrollEmployeeId === id) &&
      p.periodMonthKey === periodMonthKey &&
      p.status !== 'cancelled')
    .reduce((sum, p) => sum + p.amountPaid, 0);

/** Reste à payer ; null tant que le dû n'est pas connu. */
export const computeRemaining = (owed: number | null, paid: number): number | null =>
  owed === null ? null : owed - paid;

export const payrollMonthKey = (year: number, month: number): PayrollMonthKey =>
  `${year}-${String(month).padStart(2, '0')}`;
