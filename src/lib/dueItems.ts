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
import { resteAPayer } from '@/lib/paiementPartiel';
import { mensualiteDuMois, type MontantsParMois } from '@/lib/mensualites';
import { montantEleve, type AjustementTarif } from '@/lib/tarifsEleve';
import { partager, type PriseEnCharge } from '@/lib/priseEnCharge';

// ─── Vue caisse ─────────────────────────────────────────────────────────────

export interface PayableItem {
  id: string;
  label: string;
  sublabel?: string;
  /**
   * Reste à payer PAR L'APPRENANT : sa part (tout le frais, ou ce qu'un
   * organisme ne prend pas en charge) moins ses acomptes.
   */
  amount: number;
  /** Acomptes déjà versés sur cet élément (0 s'il n'y en a pas). */
  dejaVerse: number;
  /** Tarif normal (classe / mois) avant le tarif personnalisé de l'élève. */
  tarifNormal: number;
  /** Ce qui est dû à l'école sur ce frais (après tarif personnalisé), toutes parts confondues. */
  du: number;
  /** Part prise en charge par un organisme (3FPT…) — facturée à l'organisme, jamais à la caisse. */
  partOrganisme: number;
  /** Nom de l'organisme qui prend ce frais en charge. */
  organisme?: string;
  /** L'organisme prend TOUT en charge : rien à encaisser auprès de l'apprenant, ne bloque pas la suite. */
  priseEnChargeTotale: boolean;
  /** L'élève a un tarif personnalisé sur ce frais (src/lib/tarifsEleve.ts). */
  personnalise: boolean;
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
  /** `montantsParMois` : mois au montant personnalisé (src/lib/mensualites.ts). */
  tuitionConfig?: { inscriptionFee: number; monthlyFee: number; montantsParMois?: MontantsParMois };
  className?: string;
  /** Services auxquels l'élève est rattaché (obligatoires + optionnels souscrits). */
  services: AnnexService[];
  hasPaidInscription: () => boolean;
  hasPaidTuitionMonth: (monthKey: string) => boolean;
  hasPaidService: (serviceId: string, monthKey?: string) => boolean;
  isEnrolledInService: (serviceId: string, monthIndex: number) => boolean;
  /** Acomptes déjà versés sur un élément non soldé (absent = aucun). */
  acomptes?: (e: { type: PaymentType; monthKey?: MonthKey; serviceId?: string }) => number;
  /** Tarif personnalisé de CET élève, indexé par frais (indexerAjustements). */
  ajustements?: Map<string, AjustementTarif>;
  /** Prise en charge par un organisme (3FPT…) : partage les frais concernés (src/lib/priseEnCharge.ts). */
  priseEnCharge?: PriseEnCharge;
}

export const buildPayableItems = (input: PayableItemsInput): PayableItem[] => {
  const {
    academicMonths, billableKeys, tuitionConfig, className, services,
    hasPaidInscription, hasPaidTuitionMonth, hasPaidService, isEnrolledInService,
  } = input;
  const acomptes = input.acomptes ?? (() => 0);
  const ajustements = input.ajustements ?? new Map<string, AjustementTarif>();

  const items: PayableItem[] = [];
  // Ce que CET élève doit (tarif personnalisé éventuel), partagé avec
  // l'organisme qui le prend en charge, moins ses acomptes.
  // Un élément soldé garde son montant, sans acompte ; `rien` = 0 F dû :
  // l'élément n'apparaît pas et ne bloque pas le suivant.
  const montants = (base: number, paid: boolean, e: { type: PaymentType; monthKey?: MonthKey; serviceId?: string }) => {
    const m = montantEleve(base, e, ajustements);
    const parts = partager(m.du, input.priseEnCharge, e);
    const dejaVerse = paid ? 0 : acomptes(e);
    return {
      amount: resteAPayer(parts.apprenant, dejaVerse), dejaVerse,
      tarifNormal: m.tarifNormal, personnalise: !!m.ajustement,
      du: m.du, partOrganisme: parts.organisme,
      ...(parts.organisme > 0 ? { organisme: input.priseEnCharge?.organisme } : {}),
      priseEnChargeTotale: parts.organisme > 0 && parts.apprenant <= 0,
      rien: m.du <= 0 && !paid,
    };
  };
  const sansDrapeau = <T extends { rien: boolean }>({ rien: _rien, ...reste }: T) => reste;

  // 1. Frais d'inscription
  const inscription = tuitionConfig ? montants(tuitionConfig.inscriptionFee, hasPaidInscription(), { type: 'inscription' }) : null;
  if (tuitionConfig && inscription && !inscription.rien) {
    const paid = hasPaidInscription();
    items.push({
      id: 'inscription',
      label: 'Frais d\'inscription',
      sublabel: className,
      ...sansDrapeau(inscription),
      paid,
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
      // Montant propre à ce mois pour cette classe, puis tarif de l'élève ; un
      // mois à 0 F n'est rien à payer : il n'apparaît pas et ne bloque rien.
      const m = montants(mensualiteDuMois(tuitionConfig, key), paid, { type: 'tuition', monthKey: key });
      if (m.rien) continue;
      items.push({
        id: `tuition_${key}`,
        label: `Scolarité — ${label}`,
        ...sansDrapeau(m),
        paid,
        overdue: isMonthOverdue(month, paid),
        blocked: !prevPaid && !paid && !m.priseEnChargeTotale,
        type: 'tuition',
        monthKey: key,
      });
      // Un mois que l'organisme prend entièrement en charge n'attend rien de l'apprenant.
      prevPaid = paid || m.priseEnChargeTotale;
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
        const m = montants(svc.amount, paid, { type: 'service', serviceId: svc.id, monthKey: key });
        if (m.rien) { prevPaid = true; continue; }
        items.push({
          id: `service_${svc.id}_${key}`,
          label: `${svc.name} — ${label}`,
          sublabel: svc.isObligatory ? 'Service obligatoire' : 'Service optionnel',
          ...sansDrapeau(m),
          paid,
          // Seul un service obligatoire bloque la suite : on ne verrouille pas
          // la cantine de mars parce que celle de février n'est pas réglée.
          blocked: svc.isObligatory ? (!prevPaid && !paid && !m.priseEnChargeTotale) : false,
          type: 'service',
          monthKey: key,
          serviceId: svc.id,
        });
        prevPaid = paid || m.priseEnChargeTotale;
      }
    } else {
      const paid = hasPaidService(svc.id);
      const m = montants(svc.amount, paid, { type: 'service', serviceId: svc.id });
      if (m.rien) continue;
      items.push({
        id: `service_${svc.id}`,
        label: svc.name,
        sublabel: svc.isObligatory ? 'Service obligatoire' : 'Service optionnel',
        ...sansDrapeau(m),
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
  /** Reste à payer : le tarif moins les acomptes déjà versés. */
  amount: number;
  /** Acomptes déjà versés (0 s'il n'y en a pas). */
  dejaVerse: number;
  /** Tarif normal avant le tarif personnalisé de l'élève. */
  tarifNormal: number;
  /** L'élève a un tarif personnalisé sur ce frais. */
  personnalise: boolean;
  /** Part prise en charge par un organisme (3FPT…), que la famille n'a pas à payer. */
  partOrganisme: number;
  organisme?: string;
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
  /** Mois au montant personnalisé (src/lib/mensualites.ts). */
  montantsParMois?: MontantsParMois;
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
  /** Acompte : ne solde pas l'élément (src/lib/paiementPartiel.ts). */
  partiel?: boolean | null;
  amount?: number;
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
  /** Tarif personnalisé de l'élève, indexé par frais (indexerAjustements). */
  ajustements: Map<string, AjustementTarif> = new Map(),
  /** Prise en charge par un organisme (3FPT…) : la famille ne voit que SA part. */
  priseEnCharge?: PriseEnCharge,
): DueItem[] => {
  const items: DueItem[] = [];

  // Un tarif défini pour une autre classe ne s'applique pas à cet élève.
  if (!tuition || tuition.classId !== classId) return items;

  // Un paiement annulé ne compte plus comme payé — l'élément redevient dû.
  // Un ACOMPTE ne solde pas : l'élément reste dû, pour le reste seulement.
  const isPaid = (pred: (p: DuePayment) => boolean) =>
    payments.some(p => p.status !== 'cancelled' && !p.partiel && pred(p));
  const verse = (pred: (p: DuePayment) => boolean) => payments
    .filter(p => p.status !== 'cancelled' && p.partiel && pred(p))
    .reduce((s, p) => s + (p.amount ?? 0), 0);
  // Ce que CET élève doit (tarif personnalisé éventuel), moins ses acomptes.
  // Puis partagé avec l'organisme qui le prend en charge : `apprenant` est la part de la famille.
  const du = (base: number, e: { type: PaymentType; monthKey?: string; serviceId?: string }) => {
    const m = montantEleve(base, e, ajustements);
    return { ...m, ...partager(m.du, priseEnCharge, e) };
  };
  const reste = (m: ReturnType<typeof du>, pred: (p: DuePayment) => boolean) => {
    const dejaVerse = verse(pred);
    return {
      amount: resteAPayer(m.apprenant, dejaVerse), dejaVerse, tarifNormal: m.tarifNormal, personnalise: !!m.ajustement,
      partOrganisme: m.organisme, ...(m.organisme > 0 ? { organisme: priseEnCharge?.organisme } : {}),
    };
  };

  const insc = du(tuition.inscriptionFee, { type: 'inscription' });
  if (insc.apprenant > 0 && !isPaid(p => p.type === 'inscription')) {
    // L'inscription ne fait pas partie de la chaîne mensuelle : elle se règle
    // quand la famille veut, sans bloquer la scolarité.
    items.push({
      key: 'inscription', label: "Frais d'inscription",
      ...reste(insc, p => p.type === 'inscription'),
      type: 'inscription', echeance: 'du', verrouille: false,
    });
  }

  // Scolarité : TOUS les mois facturables de l'année, pas seulement les mois
  // échus. Une famille qui en a les moyens doit pouvoir régler l'année
  // d'avance — dans l'ordre : payer septembre ouvre octobre, qui ouvre
  // novembre. C'est la même règle qu'à la caisse (buildPayableItems).
  {
    let precedentPaye = true;
    for (const month of billableMonths) {
      // Montant propre à ce mois, puis tarif de l'élève ; 0 F = rien à payer ni ne bloque.
      const m = du(mensualiteDuMois(tuition, month.key), { type: 'tuition', monthKey: month.key });
      if (m.du <= 0) continue;
      // Entièrement pris en charge : rien à payer pour la famille, et ça ne bloque pas la suite.
      const paye = m.apprenant <= 0 || isPaid(p => p.type === 'tuition' && p.monthKey === month.key);
      if (!paye) {
        items.push({
          key: `tuition-${month.key}`, label: `Scolarité ${month.label}`,
          ...reste(m, p => p.type === 'tuition' && p.monthKey === month.key),
          type: 'tuition', monthKey: month.key,
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
        const m = du(svc.amount, { type: 'service', serviceId: svc.id, monthKey: month.key });
        if (m.du <= 0) continue;
        const paye = m.apprenant <= 0 || isPaid(p => p.type === 'service' && p.serviceId === svc.id && p.monthKey === month.key);
        if (!paye) {
          items.push({
            key: `svc-${svc.id}-${month.key}`, label: `${svc.name} — ${month.label}`,
            ...reste(m, p => p.type === 'service' && p.serviceId === svc.id && p.monthKey === month.key),
            type: 'service', serviceId: svc.id, monthKey: month.key,
            echeance: month.index <= currentIdx ? 'du' : 'avance',
            verrouille: !precedentPaye,
          });
        }
        precedentPaye = paye;
      }
    } else {
      if (isPaid(p => p.type === 'service' && p.serviceId === svc.id)) continue;
      const m = du(svc.amount, { type: 'service', serviceId: svc.id });
      if (m.apprenant <= 0) continue;
      items.push({
        key: `svc-${svc.id}`, label: svc.name,
        ...reste(m, p => p.type === 'service' && p.serviceId === svc.id),
        type: 'service', serviceId: svc.id, echeance: 'du', verrouille: false,
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

/** Libellé sur les documents de la famille : on y précise qu'elle ne règle que sa part. */
export const designationFamille = (e: Pick<PayableItem, 'label' | 'partOrganisme' | 'organisme'>): string =>
  e.partOrganisme > 0 ? `${e.label} (part de l'apprenant — ${e.organisme ?? 'organisme'} prend en charge le reste)` : e.label;
