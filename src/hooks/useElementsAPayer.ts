import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool, type Student } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { buildPayableItems, type PayableItem } from '@/lib/dueItems';
import {
  DEFAULT_TUITION_BILLING_TIMING, getAcademicMonths, getBillableMonthsFor, readBillingRules,
  type AcademicMonth, type TuitionBillingTiming,
} from '@/types/payment';

/**
 * Les éléments à payer de N'IMPORTE QUEL élève, branchés exactement comme à la
 * caisse (PaymentEntry) : mêmes mois facturables, mêmes acomptes, même tarif
 * personnalisé. La facturation ne peut donc rien réclamer que la caisse
 * n'encaisserait pas.
 */
export function useElementsAPayer(): {
  mois: AcademicMonth[];
  elementsDe: (eleve: Student) => PayableItem[];
} {
  const { school } = useAuth();
  const { classes } = useSchool();
  const { currentYear } = useSchoolYear();
  const {
    getTuitionConfig, getStudentActiveServices,
    hasPaidInscription, hasPaidTuitionMonth, hasPaidService, getAcomptes, getAjustementsEleve,
    isEnrolledInService,
  } = usePayment();

  const billingTiming = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
  const mois = useMemo(
    () => currentYear ? getAcademicMonths(currentYear.startDate, currentYear.endDate, billingTiming) : [],
    [currentYear, billingTiming],
  );
  const billingRules = useMemo(() => readBillingRules(school?.settings), [school]);

  const elementsDe = useCallback((eleve: Student): PayableItem[] => buildPayableItems({
    academicMonths: mois,
    billableKeys: new Set(getBillableMonthsFor(mois, billingRules, eleve.enrolledAt).map(m => m.key)),
    tuitionConfig: eleve.classId ? getTuitionConfig(eleve.classId) : undefined,
    className: eleve.classId ? classes.find(c => c.id === eleve.classId)?.name : undefined,
    services: getStudentActiveServices(eleve.id, eleve.classId),
    hasPaidInscription: () => hasPaidInscription(eleve.id),
    hasPaidTuitionMonth: (key) => hasPaidTuitionMonth(eleve.id, key),
    hasPaidService: (serviceId, monthKey) => hasPaidService(eleve.id, serviceId, monthKey),
    isEnrolledInService: (serviceId, monthIndex) => isEnrolledInService(eleve.id, eleve.classId, serviceId, monthIndex),
    acomptes: (e) => getAcomptes(eleve.id, e),
    ajustements: getAjustementsEleve(eleve.id),
  }), [mois, billingRules, getTuitionConfig, classes, getStudentActiveServices, hasPaidInscription,
    hasPaidTuitionMonth, hasPaidService, isEnrolledInService, getAcomptes, getAjustementsEleve]);

  return { mois, elementsDe };
}
