// ═══════════════════════════════════════════════════════════════════════════
// « Que doit cet élève ? » — les deux réponses du produit, réunies ici.
//
//  • buildPayableItems : vue CAISSE (PaymentEntry). Toute l'année d'un coup,
//    payé et impayé, car l'admin peut encaisser un mois d'avance.
//  • computeDueItems   : vue ÉLÈVE (PortalPaiements). Uniquement ce qui est dû
//    À CE JOUR et non payé — un élève n'a pas à voir une dette pour juin en
//    novembre.
//
// Ces deux fonctions sont volontairement PURES (aucun hook, aucun accès
// Supabase) : c'est le seul moyen de les tester, et c'est le code où une
// régression silencieuse se paie en fin de mois. Tout changement de règle ici
// doit casser un test de dueItems.test.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { AcademicMonth, AnnexService, MonthKey, PaymentType, isMonthOverdue } from '@/types/payment';

// ─── Vue caisse ─────────────────────────────────────────────────────────────

export interface PayableItem {
  id: string;
  label: string;
  sublabel?: string;
  amount: number;
  paid: boolean;
  blocked: boolean;
  overdue?: boolean;
  type: PaymentType;
  monthKey?: MonthKey;
  serviceId?: string;
}

export interface PayableItemsInput {
  /** TOUS les mois de l'année — y compris non facturables : un mois déjà payé doit rester visible. */
  academicMonths: AcademicMonth[];
  /** Clés des mois réellement dus par CET élève (getBillableMonthsFor). */
  billableKeys: Set<string>;
  tuitionConfig?: { inscriptionFee: number; monthlyFee: number };
  className?: string;
  /** Services auxquels l'élève est rattaché (obligatoires + optionnels souscrits). */
  services: AnnexService[];
  hasPaidInscription: () => boolean;
  hasPaidTuitionMonth: (monthKey: string) => boolean;
  hasPaidService: (serviceId: string, monthKey?: string) => boolean;
  isEnrolledInService: (serviceId: string, monthIndex: number) => boolean;
}

export const buildPayableItems = (input: PayableItemsInput): PayableItem[] => {
  const {
    academicMonths, billableKeys, tuitionConfig, className, services,
    hasPaidInscription, hasPaidTuitionMonth, hasPaidService, isEnrolledInService,
  } = input;

  const items: PayableItem[] = [];

  // 1. Frais d'inscription
  if (tuitionConfig) {
    items.push({
      id: 'inscription',
      label: 'Frais d\'inscription',
      sublabel: className,
      amount: tuitionConfig.inscriptionFee,
      paid: hasPaidInscription(),
      blocked: false,
      type: 'inscription',
    });
  }

  // 2. Scolarité mensuelle — séquentielle : on ne saute pas un mois impayé.
  //    Un mois non dû mais DÉJÀ PAYÉ reste affiché (trace comptable) : d'où le
  //    `&& !paid` sur le filtre de facturabilité.
  if (tuitionConfig) {
    let prevPaid = true;
    for (const month of academicMonths) {
      const { key, label } = month;
      const paid = hasPaidTuitionMonth(key);
      if (!billableKeys.has(key) && !paid) continue;
      items.push({
        id: `tuition_${key}`,
        label: `Scolarité — ${label}`,
        amount: tuitionConfig.monthlyFee,
        paid,
        overdue: isMonthOverdue(month, paid),
        blocked: !prevPaid && !paid,
        type: 'tuition',
        monthKey: key,
      });
      prevPaid = paid;
    }
  }

  // 3. Services annexes
  for (const svc of services) {
    if (svc.frequency === 'monthly') {
      let prevPaid = true;
      for (const { key, label, index } of academicMonths) {
        if (!isEnrolledInService(svc.id, index)) { prevPaid = true; continue; }
        const paid = hasPaidService(svc.id, key);
        if (!billableKeys.has(key) && !paid) { prevPaid = true; continue; }
        items.push({
          id: `service_${svc.id}_${key}`,
          label: `${svc.name} — ${label}`,
          sublabel: svc.isObligatory ? 'Service obligatoire' : 'Service optionnel',
          amount: svc.amount,
          paid,
          // Seul un service obligatoire bloque la suite : on ne verrouille pas
          // la cantine de mars parce que celle de février n'est pas réglée.
          blocked: svc.isObligatory ? (!prevPaid && !paid) : false,
          type: 'service',
          monthKey: key,
          serviceId: svc.id,
        });
        prevPaid = paid;
      }
    } else {
      const paid = hasPaidService(svc.id);
      items.push({
        id: `service_${svc.id}`,
        label: svc.name,
        sublabel: svc.isObligatory ? 'Service obligatoire' : 'Service optionnel',
        amount: svc.amount,
        paid,
        blocked: false,
        type: 'service',
        serviceId: svc.id,
      });
    }
  }

  return items;
};

// ─── Vue élève (portail) ────────────────────────────────────────────────────

export interface DueItem {
  key: string;
  label: string;
  amount: number;
  type: 'inscription' | 'tuition' | 'service';
  monthKey?: string;
  serviceId?: string;
  /**
   * 'du'     : exigible aujourd'hui (mois échu ou en cours) ;
   * 'avance' : mois à venir, que la famille PEUT régler par anticipation.
   *
   * La distinction n'est pas cosmétique : le total affiché en rouge ne compte
   * que le 'du'. Afficher toute l'année comme une dette alarmerait une famille
   * parfaitement à jour.
   */
  echeance: 'du' | 'avance';
  /**
   * true = un mois antérieur reste impayé, celui-ci n'est pas encore payable.
   * La scolarité se règle dans l'ordre : payer septembre ouvre octobre, qui
   * ouvre novembre, et ainsi de suite.
   */
  verrouille: boolean;
}

export interface DueTuitionConfig {
  classId: string;
  inscriptionFee: number;
  monthlyFee: number;
}

export interface DueServiceEnrollment {
  serviceId: string;
  startMonthIndex: number;
  endMonthIndex?: number | null;
}

// Types structurels minimaux : le portail charge ses propres lignes Supabase
// (portalHelpers.Payment/AnnexSvc), plus permissives que celles de la caisse.
// On demande ici le strict nécessaire pour que les deux appelants entrent.
export interface DuePayment {
  type: string;
  serviceId?: string | null;
  monthKey?: string | null;
  status: string;
}

export interface DueService {
  id: string;
  name: string;
  amount: number;
  frequency: string;
}

export const computeDueItems = (
  payments: DuePayment[],
  tuition: DueTuitionConfig | null,
  services: DueService[],
  enrollments: DueServiceEnrollment[],
  classId: string,
  /** Mois DÉJÀ filtrés par getBillableMonthsFor — mois décochés et pré-inscription exclus. */
  billableMonths: AcademicMonth[],
  currentIdx: number,
): DueItem[] => {
  const items: DueItem[] = [];

  // Un tarif défini pour une autre classe ne s'applique pas à cet élève.
  if (!tuition || tuition.classId !== classId) return items;

  // Un paiement annulé ne compte plus comme payé — l'élément redevient dû.
  const isPaid = (pred: (p: DuePayment) => boolean) =>
    payments.some(p => p.status !== 'cancelled' && pred(p));

  if (tuition.inscriptionFee > 0 && !isPaid(p => p.type === 'inscription')) {
    // L'inscription ne fait pas partie de la chaîne mensuelle : elle se règle
    // quand la famille veut, sans bloquer la scolarité.
    items.push({
      key: 'inscription', label: "Frais d'inscription", amount: tuition.inscriptionFee,
      type: 'inscription', echeance: 'du', verrouille: false,
    });
  }

  // Scolarité : TOUS les mois facturables de l'année, pas seulement les mois
  // échus. Une famille qui en a les moyens doit pouvoir régler l'année
  // d'avance — dans l'ordre : payer septembre ouvre octobre, qui ouvre
  // novembre. C'est la même règle qu'à la caisse (buildPayableItems).
  if (tuition.monthlyFee > 0) {
    let precedentPaye = true;
    for (const month of billableMonths) {
      const paye = isPaid(p => p.type === 'tuition' && p.monthKey === month.key);
      if (!paye) {
        items.push({
          key: `tuition-${month.key}`, label: `Scolarité ${month.label}`,
          amount: tuition.monthlyFee, type: 'tuition', monthKey: month.key,
          echeance: month.index <= currentIdx ? 'du' : 'avance',
          verrouille: !precedentPaye,
        });
      }
      precedentPaye = paye;
    }
  }

  for (const enr of enrollments) {
    const svc = services.find(s => s.id === enr.serviceId);
    if (!svc) continue;

    if (svc.frequency === 'monthly') {
      // Même principe que la scolarité : la fenêtre de souscription décide des
      // mois concernés, et on va jusqu'au bout de l'année plutôt que de
      // s'arrêter au mois courant.
      const fin = enr.endMonthIndex ?? Infinity;
      let precedentPaye = true;
      for (const month of billableMonths) {
        if (month.index < enr.startMonthIndex || month.index > fin) continue;
        const paye = isPaid(p => p.type === 'service' && p.serviceId === svc.id && p.monthKey === month.key);
        if (!paye) {
          items.push({
            key: `svc-${svc.id}-${month.key}`, label: `${svc.name} — ${month.label}`,
            amount: svc.amount, type: 'service', serviceId: svc.id, monthKey: month.key,
            echeance: month.index <= currentIdx ? 'du' : 'avance',
            verrouille: !precedentPaye,
          });
        }
        precedentPaye = paye;
      }
    } else {
      if (isPaid(p => p.type === 'service' && p.serviceId === svc.id)) continue;
      items.push({
        key: `svc-${svc.id}`, label: svc.name, amount: svc.amount, type: 'service',
        serviceId: svc.id, echeance: 'du', verrouille: false,
      });
    }
  }

  return items;
};

/** Ce que la famille doit AUJOURD'HUI — le seul montant à afficher comme dette. */
export const totalExigible = (items: DueItem[]): number =>
  items.filter(i => i.echeance === 'du').reduce((s, i) => s + i.amount, 0);

/** Le prochain élément réellement payable : le premier non verrouillé. */
export const prochainPayable = (items: DueItem[]): DueItem | undefined =>
  items.find(i => !i.verrouille);
