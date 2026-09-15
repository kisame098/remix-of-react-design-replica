import { describe, it, expect } from 'vitest';
import {
  hasPaidInscription, hasPaidTuitionMonth, hasPaidService, getTotalCollectedForYear,
  isEnrolledInService, getStudentActiveServices, getAvailableServicesForStudent,
} from './paymentQueries';
import type { AnnexService, Payment, ServiceEnrollment } from '@/types/payment';

// ════════════════════════════════════════════════════════════════════════════
// « A-T-IL PAYÉ ? » — la question la plus posée du produit, à la caisse comme
// au portail. Deux règles y reviennent toujours :
//   • un paiement ANNULÉ ne solde rien ;
//   • tout est borné à l'année scolaire courante — la scolarité de l'an dernier
//     ne paie pas celle de cette année.
// ════════════════════════════════════════════════════════════════════════════

const YEAR = '2025-2026';
const LAST_YEAR = '2024-2025';
const STUDENT = 'enr-1';

const pay = (over: Partial<Payment>): Payment => ({
  id: `p-${Math.random()}`, studentId: STUDENT, studentUniqueId: 'ETU-1',
  academicYearLabel: YEAR, type: 'tuition', amount: 15_000, method: 'especes',
  paidAt: '2025-10-05T10:00:00Z', status: 'confirmed', ...over,
});

const svc = (over: Partial<AnnexService> = {}): AnnexService => ({
  id: 'svc-cantine', name: 'Cantine', amount: 5_000, frequency: 'monthly',
  isObligatory: false, scope: 'all', classIds: [], academicYearLabel: YEAR,
  createdAt: '2025-09-01', ...over,
});

const enr = (over: Partial<ServiceEnrollment> = {}): ServiceEnrollment => ({
  id: 'e1', studentId: STUDENT, serviceId: 'svc-cantine', academicYearLabel: YEAR,
  startMonthIndex: 0, createdAt: '2025-09-01', ...over,
});

describe('hasPaidInscription', () => {
  it('reconnaît une inscription réglée', () => {
    expect(hasPaidInscription([pay({ type: 'inscription' })], YEAR, STUDENT)).toBe(true);
  });

  it('un paiement ANNULÉ ne solde pas l\'inscription', () => {
    expect(hasPaidInscription([pay({ type: 'inscription', status: 'cancelled' })], YEAR, STUDENT)).toBe(false);
  });

  it('l\'inscription de l\'an dernier ne vaut pas pour cette année', () => {
    expect(hasPaidInscription([pay({ type: 'inscription', academicYearLabel: LAST_YEAR })], YEAR, STUDENT)).toBe(false);
  });

  it('ne confond pas deux élèves', () => {
    expect(hasPaidInscription([pay({ type: 'inscription', studentId: 'autre' })], YEAR, STUDENT)).toBe(false);
  });

  it('un paiement de scolarité ne vaut pas inscription', () => {
    expect(hasPaidInscription([pay({ type: 'tuition' })], YEAR, STUDENT)).toBe(false);
  });
});

describe('hasPaidTuitionMonth', () => {
  it('reconnaît le mois payé, et lui seul', () => {
    const payments = [pay({ monthKey: '2025-10' })];
    expect(hasPaidTuitionMonth(payments, YEAR, STUDENT, '2025-10')).toBe(true);
    expect(hasPaidTuitionMonth(payments, YEAR, STUDENT, '2025-11')).toBe(false);
  });

  it('un mois annulé redevient impayé', () => {
    expect(hasPaidTuitionMonth([pay({ monthKey: '2025-10', status: 'cancelled' })], YEAR, STUDENT, '2025-10')).toBe(false);
  });

  it('reste payé s\'il existe AUSSI un paiement annulé pour ce mois (régularisation)', () => {
    // Cas réel : encaissement erroné annulé, puis ré-encaissement correct.
    const payments = [
      pay({ monthKey: '2025-10', status: 'cancelled' }),
      pay({ monthKey: '2025-10', status: 'confirmed' }),
    ];
    expect(hasPaidTuitionMonth(payments, YEAR, STUDENT, '2025-10')).toBe(true);
  });

  it('ne compte pas un mois de même libellé payé une autre année', () => {
    expect(hasPaidTuitionMonth([pay({ monthKey: '2025-10', academicYearLabel: LAST_YEAR })], YEAR, STUDENT, '2025-10')).toBe(false);
  });
});

describe('hasPaidService', () => {
  it('exige le bon mois pour un service mensuel', () => {
    const payments = [pay({ type: 'service', serviceId: 'svc-cantine', monthKey: '2025-10' })];
    expect(hasPaidService(payments, YEAR, STUDENT, 'svc-cantine', '2025-10')).toBe(true);
    expect(hasPaidService(payments, YEAR, STUDENT, 'svc-cantine', '2025-11')).toBe(false);
  });

  it('accepte n\'importe quel paiement du service quand aucun mois n\'est demandé (annuel)', () => {
    const payments = [pay({ type: 'service', serviceId: 'svc-assur' })];
    expect(hasPaidService(payments, YEAR, STUDENT, 'svc-assur')).toBe(true);
  });

  it('ne confond pas deux services', () => {
    const payments = [pay({ type: 'service', serviceId: 'svc-bus', monthKey: '2025-10' })];
    expect(hasPaidService(payments, YEAR, STUDENT, 'svc-cantine', '2025-10')).toBe(false);
  });

  it('un service annulé redevient dû', () => {
    const payments = [pay({ type: 'service', serviceId: 'svc-assur', status: 'cancelled' })];
    expect(hasPaidService(payments, YEAR, STUDENT, 'svc-assur')).toBe(false);
  });
});

describe('getTotalCollectedForYear', () => {
  it('additionne uniquement les paiements confirmés de l\'année', () => {
    const payments = [
      pay({ amount: 15_000 }),
      pay({ amount: 25_000, type: 'inscription' }),
      pay({ amount: 99_000, status: 'cancelled' }),            // annulé
      pay({ amount: 50_000, academicYearLabel: LAST_YEAR }),   // autre année
    ];
    expect(getTotalCollectedForYear(payments, YEAR)).toBe(40_000);
  });

  it('compte TOUS les élèves, pas seulement un (chiffre de l\'école)', () => {
    const payments = [pay({ amount: 10_000 }), pay({ amount: 10_000, studentId: 'autre' })];
    expect(getTotalCollectedForYear(payments, YEAR)).toBe(20_000);
  });

  it('rend 0 et non NaN sans aucun paiement', () => {
    expect(getTotalCollectedForYear([], YEAR)).toBe(0);
  });
});

describe('isEnrolledInService', () => {
  const call = (services: AnnexService[], enrollments: ServiceEnrollment[],
                classId: string | null = 'cls-1', monthIndex?: number, serviceId = 'svc-cantine') =>
    isEnrolledInService(services, enrollments, YEAR, STUDENT, classId, serviceId, monthIndex);

  it('inscrit d\'office tout élève du périmètre à un service OBLIGATOIRE', () => {
    expect(call([svc({ isObligatory: true })], [])).toBe(true);
  });

  it('exige une souscription pour un service optionnel', () => {
    expect(call([svc()], [])).toBe(false);
    expect(call([svc()], [enr()])).toBe(true);
  });

  it('respecte le périmètre de classes d\'un service ciblé', () => {
    const cible = svc({ isObligatory: true, scope: 'specific', classIds: ['cls-2'] });
    expect(call([cible], [], 'cls-1')).toBe(false);
    expect(call([cible], [], 'cls-2')).toBe(true);
  });

  it('n\'inscrit pas un élève sans classe à un service ciblé', () => {
    expect(call([svc({ isObligatory: true, scope: 'specific', classIds: ['cls-1'] })], [], null)).toBe(false);
  });

  it('respecte la fenêtre de mois de la souscription', () => {
    const e = [enr({ startMonthIndex: 2, endMonthIndex: 4 })];
    expect(call([svc()], e, 'cls-1', 1)).toBe(false);  // avant
    expect(call([svc()], e, 'cls-1', 2)).toBe(true);   // premier mois inclus
    expect(call([svc()], e, 'cls-1', 4)).toBe(true);   // dernier mois inclus
    expect(call([svc()], e, 'cls-1', 5)).toBe(false);  // après
  });

  it('une souscription sans fin court jusqu\'au bout de l\'année', () => {
    expect(call([svc()], [enr({ startMonthIndex: 0 })], 'cls-1', 8)).toBe(true);
  });

  it('sans mois précisé, seule une souscription EN COURS compte', () => {
    expect(call([svc()], [enr({ endMonthIndex: 3 })])).toBe(false);
    expect(call([svc()], [enr()])).toBe(true);
  });

  it('ignore une souscription d\'une autre année', () => {
    expect(call([svc()], [enr({ academicYearLabel: LAST_YEAR })])).toBe(false);
  });

  it('ne dit jamais oui pour un service qui n\'existe plus', () => {
    expect(call([], [enr()])).toBe(false);
  });
});

describe('getStudentActiveServices', () => {
  const call = (services: AnnexService[], enrollments: ServiceEnrollment[], classId: string | null = 'cls-1') =>
    getStudentActiveServices(services, enrollments, YEAR, STUDENT, classId);

  it('rend les obligatoires du périmètre et les optionnels souscrits', () => {
    const services = [
      svc({ id: 'svc-frais', isObligatory: true }),
      svc({ id: 'svc-cantine' }),
      svc({ id: 'svc-bus' }),
    ];
    expect(call(services, [enr({ serviceId: 'svc-cantine' })]).map(s => s.id))
      .toEqual(['svc-frais', 'svc-cantine']);
  });

  it('retire un service dont l\'élève s\'est désinscrit', () => {
    expect(call([svc()], [enr({ endMonthIndex: 3 })])).toEqual([]);
  });

  it('ignore les services d\'une autre année scolaire', () => {
    expect(call([svc({ isObligatory: true, academicYearLabel: LAST_YEAR })], [])).toEqual([]);
  });

  it('ne rend rien pour un élève sans classe', () => {
    expect(call([svc({ isObligatory: true })], [], null)).toEqual([]);
  });

  it('respecte le périmètre de classes d\'un service ciblé', () => {
    const cible = svc({ isObligatory: true, scope: 'specific', classIds: ['cls-2'] });
    expect(call([cible], [], 'cls-1')).toEqual([]);
    expect(call([cible], [], 'cls-2').map(s => s.id)).toEqual(['svc-cantine']);
  });

  it('ne rend pas un service optionnel hors périmètre, même souscrit par erreur', () => {
    const cible = svc({ scope: 'specific', classIds: ['cls-2'] });
    expect(call([cible], [enr()], 'cls-1')).toEqual([]);
  });
});

describe('getAvailableServicesForStudent', () => {
  const call = (services: AnnexService[], enrollments: ServiceEnrollment[], classId: string | null = 'cls-1') =>
    getAvailableServicesForStudent(services, enrollments, YEAR, STUDENT, classId);

  it('propose les optionnels non encore souscrits', () => {
    expect(call([svc({ id: 'svc-cantine' }), svc({ id: 'svc-bus' })], []).map(s => s.id))
      .toEqual(['svc-cantine', 'svc-bus']);
  });

  it('NE PROPOSE PAS un service obligatoire — il n\'y a rien à souscrire', () => {
    expect(call([svc({ isObligatory: true })], [])).toEqual([]);
  });

  it('ne propose pas un service déjà souscrit et en cours', () => {
    expect(call([svc()], [enr()])).toEqual([]);
  });

  it('re-propose un service quitté en cours d\'année', () => {
    expect(call([svc()], [enr({ endMonthIndex: 3 })]).map(s => s.id)).toEqual(['svc-cantine']);
  });

  it('ne propose rien à un élève sans classe', () => {
    expect(call([svc()], [], null)).toEqual([]);
  });

  it('ne propose pas un service d\'une autre année scolaire', () => {
    expect(call([svc({ academicYearLabel: LAST_YEAR })], [])).toEqual([]);
  });

  it('ne propose pas un service réservé à une autre classe', () => {
    expect(call([svc({ scope: 'specific', classIds: ['cls-2'] })], [], 'cls-1')).toEqual([]);
    expect(call([svc({ scope: 'specific', classIds: ['cls-1'] })], [], 'cls-1').map(s => s.id))
      .toEqual(['svc-cantine']);
  });

  it('actif et disponible sont deux ensembles disjoints', () => {
    const services = [svc({ id: 'a', isObligatory: true }), svc({ id: 'b' }), svc({ id: 'c' })];
    const enrollments = [enr({ serviceId: 'b' })];
    const actifs = getStudentActiveServices(services, enrollments, YEAR, STUDENT, 'cls-1').map(s => s.id);
    const dispos = call(services, enrollments).map(s => s.id);
    expect(actifs.filter(id => dispos.includes(id))).toEqual([]);
  });
});
