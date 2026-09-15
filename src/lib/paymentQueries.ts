// ═══════════════════════════════════════════════════════════════════════════
// INTERROGATIONS SUR LES PAIEMENTS — « a-t-il payé ? », « est-il inscrit à ce
// service ? ». Ces quatre questions décident de ce que la caisse encaisse et de
// ce que le portail réclame. Deux règles y reviennent sans cesse :
//
//   1. Un paiement ANNULÉ ne compte pas comme payé (l'élément redevient dû).
//   2. Tout est borné à l'ANNÉE SCOLAIRE courante : la scolarité de l'an
//      dernier ne solde pas celle de cette année.
//
// Fonctions pures extraites de PaymentContext pour être testables
// (paymentQueries.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { AnnexService, MonthKey, Payment, ServiceEnrollment } from '@/types/payment';

const isLive = (p: Payment, studentId: string, yearLabel: string): boolean =>
  p.studentId === studentId && p.academicYearLabel === yearLabel && p.status !== 'cancelled';

export const hasPaidInscription = (
  payments: Payment[], yearLabel: string, studentId: string,
): boolean => payments.some(p => isLive(p, studentId, yearLabel) && p.type === 'inscription');

export const hasPaidTuitionMonth = (
  payments: Payment[], yearLabel: string, studentId: string, monthKey: MonthKey,
): boolean => payments.some(p =>
  isLive(p, studentId, yearLabel) && p.type === 'tuition' && p.monthKey === monthKey);

/** `monthKey` omis : n'importe quel paiement de ce service compte (annuel/ponctuel). */
export const hasPaidService = (
  payments: Payment[], yearLabel: string, studentId: string, serviceId: string, monthKey?: MonthKey,
): boolean => payments.some(p =>
  isLive(p, studentId, yearLabel) && p.type === 'service' && p.serviceId === serviceId &&
  (monthKey === undefined || p.monthKey === monthKey));

export const getTotalCollectedForYear = (payments: Payment[], yearLabel: string): number =>
  payments
    .filter(p => p.academicYearLabel === yearLabel && p.status !== 'cancelled')
    .reduce((s, p) => s + p.amount, 0);

/**
 * Un service obligatoire s'applique d'office à tout élève de son périmètre ;
 * un service optionnel exige une souscription explicite, avec sa fenêtre de
 * mois (startMonthIndex → endMonthIndex, ce dernier absent = toujours en cours).
 */
export const isEnrolledInService = (
  annexServices: AnnexService[], serviceEnrollments: ServiceEnrollment[], yearLabel: string,
  studentId: string, classId: string | null, serviceId: string, monthIndex?: number,
): boolean => {
  const svc = annexServices.find(s => s.id === serviceId);
  if (!svc) return false;

  const inScope = svc.scope === 'all' || (classId !== null && svc.classIds.includes(classId));
  if (!inScope) return false;

  if (svc.isObligatory) return true;

  const enrollment = serviceEnrollments.find(e =>
    e.studentId === studentId && e.serviceId === serviceId && e.academicYearLabel === yearLabel
  );
  if (!enrollment) return false;

  if (monthIndex === undefined) return enrollment.endMonthIndex === undefined;
  return monthIndex >= enrollment.startMonthIndex &&
    (enrollment.endMonthIndex === undefined || monthIndex <= enrollment.endMonthIndex);
};

/** Services auxquels l'élève est rattaché AUJOURD'HUI (obligatoires + souscriptions en cours). */
export const getStudentActiveServices = (
  annexServices: AnnexService[], serviceEnrollments: ServiceEnrollment[], yearLabel: string,
  studentId: string, classId: string | null,
): AnnexService[] => {
  if (classId === null) return [];
  return annexServices.filter(svc => {
    if (svc.academicYearLabel !== yearLabel) return false;
    const inScope = svc.scope === 'all' || svc.classIds.includes(classId);
    if (!inScope) return false;
    if (svc.isObligatory) return true;
    const enrollment = serviceEnrollments.find(e =>
      e.studentId === studentId && e.serviceId === svc.id && e.academicYearLabel === yearLabel
    );
    return !!enrollment && enrollment.endMonthIndex === undefined;
  });
};

/** Services optionnels que l'élève PEUT encore souscrire (ou re-souscrire). */
export const getAvailableServicesForStudent = (
  annexServices: AnnexService[], serviceEnrollments: ServiceEnrollment[], yearLabel: string,
  studentId: string, classId: string | null,
): AnnexService[] => {
  if (classId === null) return [];
  return annexServices.filter(svc => {
    if (svc.academicYearLabel !== yearLabel) return false;
    if (svc.isObligatory) return false;
    const inScope = svc.scope === 'all' || svc.classIds.includes(classId);
    if (!inScope) return false;
    const enrollment = serviceEnrollments.find(e =>
      e.studentId === studentId && e.serviceId === svc.id && e.academicYearLabel === yearLabel
    );
    return !enrollment || enrollment.endMonthIndex !== undefined;
  });
};
