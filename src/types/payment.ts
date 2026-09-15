// ─── Payment Types ───────────────────────────────────────────────────────────

export type PaymentMethod = 'especes' | 'wave' | 'orange_money' | 'virement' | 'cheque';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  especes: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  virement: 'Virement bancaire',
  cheque: 'Chèque',
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  especes: '💵',
  wave: '📱',
  orange_money: '🟠',
  virement: '🏦',
  cheque: '📄',
};

// ─── Academic months ─────────────────────────────────────────────────────────
// Calculés dynamiquement à partir des dates d'ouverture/fermeture de l'année
// scolaire courante (Paramètres > Année scolaire) — un mois par mois calendaire
// entre les deux dates, inclus.

/**
 * Quand la scolarité du mois est-elle due ?
 * - 'advance' : payable avant/dès le début du mois (échéance = 1er du mois)
 * - 'arrears' : payable à la fin du mois, une fois le mois passé (échéance = dernier jour du mois)
 */
export type TuitionBillingTiming = 'advance' | 'arrears';

export const TUITION_BILLING_TIMING_LABELS: Record<TuitionBillingTiming, string> = {
  advance: 'Avant le début du mois (à l\'avance)',
  arrears: 'À la fin du mois (à terme échu)',
};

export const DEFAULT_TUITION_BILLING_TIMING: TuitionBillingTiming = 'arrears';

export interface AcademicMonth {
  key:     string;  // "2026-10" — stable et trié naturellement
  label:   string;  // "Octobre 2026"
  index:   number;  // 0-based, dans l'ordre de l'année scolaire
  dueDate: string;  // ISO "2026-10-01" ou "2026-10-31" selon le mode de facturation
}

const MONTH_LABELS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export const getAcademicMonths = (
  startDate: string,
  endDate: string,
  billingTiming: TuitionBillingTiming = DEFAULT_TUITION_BILLING_TIMING,
): AcademicMonth[] => {
  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const months: AcademicMonth[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last   = new Date(end.getFullYear(), end.getMonth(), 1);
  let index = 0;
  while (cursor <= last) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const dueDay  = billingTiming === 'advance' ? new Date(y, m, 1) : new Date(y, m + 1, 0); // dernier jour du mois
    const dueDate = `${dueDay.getFullYear()}-${String(dueDay.getMonth() + 1).padStart(2, '0')}-${String(dueDay.getDate()).padStart(2, '0')}`;
    months.push({
      key:   `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${MONTH_LABELS[m]} ${y}`,
      index,
      dueDate,
    });
    cursor.setMonth(cursor.getMonth() + 1);
    index++;
  }
  return months;
};

/** Un mois impayé est en retard dès que sa date d'échéance est passée. */
export const isMonthOverdue = (month: AcademicMonth, paid: boolean): boolean =>
  !paid && new Date(month.dueDate) < new Date(new Date().toDateString());

// ─── Mois réellement facturables ─────────────────────────────────────────────
// Deux filtres se superposent aux mois calendaires de l'année :
//  1. l'école décoche les mois qu'elle ne facture pas (Paramètres > Année
//     scolaire) — on stocke les mois EXCLUS, pour qu'un mois nouvellement
//     couvert (dates d'année élargies) soit facturable par défaut plutôt
//     qu'oublié en silence ;
//  2. un élève ne paie jamais un mois antérieur à son inscription — arrivé en
//     janvier, il ne doit rien pour septembre→décembre.
// Règle de sûreté comptable : ces filtres disent ce qui est DÛ, jamais ce qui
// s'affiche — un mois déjà payé reste toujours visible côté écrans.

/** Retire les mois décochés par l'école. */
export const getSchoolBillableMonths = (
  months: AcademicMonth[],
  excludedKeys: string[] = [],
): AcademicMonth[] =>
  excludedKeys.length === 0 ? months : months.filter(m => !excludedKeys.includes(m.key));

/**
 * Retire les mois antérieurs au mois d'inscription de l'élève.
 *
 * `waiveFromDay` (réglage de l'école) : jour du mois à partir duquel le mois
 * d'arrivée est OFFERT — un élève arrivé le 24 avec un seuil à 20 commence à
 * payer le mois suivant. `null` = le mois d'arrivée est toujours dû en entier,
 * quel que soit le jour.
 *
 * Les clés `YYYY-MM` étant zéro-paddées, la comparaison lexicographique suffit.
 */
export const getStudentBillableMonths = (
  months: AcademicMonth[],
  enrolledAt: string | undefined | null,
  waiveFromDay: number | null = null,
): AcademicMonth[] => {
  if (!enrolledAt) return months;
  const d = new Date(enrolledAt);
  if (Number.isNaN(d.getTime())) return months;

  let year  = d.getFullYear();
  let month = d.getMonth();            // 0-based
  if (waiveFromDay !== null && d.getDate() >= waiveFromDay) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  const startKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  return months.filter(m => m.key >= startKey);
};

// ─── Règles de facturation de l'école (schools.settings) ─────────────────────
export const EXCLUDED_BILLING_MONTHS_KEY = 'excludedBillingMonths';
export const ARRIVAL_MONTH_WAIVE_DAY_KEY = 'arrivalMonthWaiveFromDay';

export interface BillingRules {
  /** Mois décochés par l'école — jamais facturés à personne. */
  excludedMonths: string[];
  /** Jour (1-31) à partir duquel le mois d'arrivée est offert ; null = toujours dû. */
  waiveArrivalMonthFromDay: number | null;
}

export const readExcludedBillingMonths = (settings: Record<string, unknown> | undefined | null): string[] => {
  const raw = settings?.[EXCLUDED_BILLING_MONTHS_KEY];
  return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [];
};

/** Les deux règles sont lues ensemble : un appelant ne peut pas en oublier une. */
export const readBillingRules = (settings: Record<string, unknown> | undefined | null): BillingRules => {
  const rawDay = settings?.[ARRIVAL_MONTH_WAIVE_DAY_KEY];
  const day = typeof rawDay === 'number' && rawDay >= 1 && rawDay <= 31 ? Math.floor(rawDay) : null;
  return { excludedMonths: readExcludedBillingMonths(settings), waiveArrivalMonthFromDay: day };
};

/** Point d'entrée unique : mois dus par CET élève dans CETTE école. */
export const getBillableMonthsFor = (
  months: AcademicMonth[],
  rules: BillingRules,
  enrolledAt?: string | null,
): AcademicMonth[] =>
  getStudentBillableMonths(
    getSchoolBillableMonths(months, rules.excludedMonths),
    enrolledAt,
    rules.waiveArrivalMonthFromDay,
  );

export type MonthKey = string;

/** Index du mois calendaire courant dans une liste de mois académiques donnée
 *  (retombe sur le dernier mois si on est après la fin d'année, le premier si avant). */
export const getCurrentMonthIndex = (months: AcademicMonth[]): number => {
  if (months.length === 0) return 0;
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const found = months.find(m => m.key === key);
  if (found) return found.index;
  return key < months[0].key ? 0 : months[months.length - 1].index;
};

// ─── Tuition Config (per class) ───────────────────────────────────────────────
export interface TuitionConfig {
  id: string;                  // UUID (tuition_configs.id)
  classId: string;             // UUID (classes.id)
  academicYearLabel: string;   // "2024-2025"
  inscriptionFee: number;      // Frais d'inscription (one-time)
  monthlyFee: number;          // Scolarité mensuelle
}

// ─── Annex Service ────────────────────────────────────────────────────────────
export type ServiceFrequency = 'monthly' | 'annual' | 'one_time';
export type ServiceScope = 'all' | 'specific';  // All classes or specific ones

export interface AnnexService {
  id: string;                  // UUID
  name: string;
  description?: string;
  amount: number;
  frequency: ServiceFrequency;
  isObligatory: boolean;       // If true, auto-added to payment list
  scope: ServiceScope;
  classIds: string[];          // UUID[] — relevant when scope === 'specific'
  academicYearLabel: string;
  createdAt: string;
}

export const SERVICE_FREQUENCY_LABELS: Record<ServiceFrequency, string> = {
  monthly: 'Mensuel',
  annual: 'Annuel',
  one_time: 'Ponctuel (une fois)',
};

// ─── Payment ──────────────────────────────────────────────────────────────────
export type PaymentType = 'inscription' | 'tuition' | 'service';

export type PaymentStatus = 'confirmed' | 'cancelled';

export interface Payment {
  id: string;                  // UUID
  studentId: string;           // student_enrollment UUID
  studentUniqueId: string;     // snapshot of student readable ID
  academicYearLabel: string;
  type: PaymentType;
  serviceId?: string;          // UUID — for type === 'service'
  monthKey?: MonthKey;         // for type === 'tuition' | monthly service
  amount: number;
  method: PaymentMethod;
  reference?: string;          // Chèque/virement ref
  note?: string;
  paidAt: string;              // ISO datetime
  receivedBy?: string;
  // Annulation : le paiement n'est JAMAIS supprimé (pièce comptable) — il
  // passe juste à ce statut, avec la trace de qui/quand pour l'audit.
  status: PaymentStatus;
  cancelledAt?: string;
  cancelledBy?: string;
}

// ─── Service Enrollment (optional services only) ──────────────────────────────
// Obligatory services are implicitly enrolled for all in-scope students.
// Optional services require explicit enrollment.
export interface ServiceEnrollment {
  id: string;                  // UUID
  studentId: string;           // student_enrollment UUID
  serviceId: string;           // UUID
  academicYearLabel: string;
  startMonthIndex: number;     // 0–9, inclusive (first month they pay)
  endMonthIndex?: number;      // 0–9, inclusive (last month they pay), undefined = still active
  createdAt: string;           // ISO datetime
}

// ─── QR de paiement direct (élève → caisse) ───────────────────────────────────
// L'élève génère ce QR depuis son portail pour UN élément précis à payer.
// L'admin le scanne dans Gestion Paiements pour pré-sélectionner directement
// cet élément, sans recherche ni sélection manuelle.
export interface PaymentIntent {
  enrollmentId: string;
  type: PaymentType;
  serviceId?: string;
  monthKey?: string;
}

export const encodePaymentIntent = (intent: PaymentIntent): string => {
  const parts = ['PAY', intent.enrollmentId, intent.type];
  if (intent.type === 'service' && intent.serviceId) parts.push(intent.serviceId);
  if (intent.monthKey) parts.push(intent.monthKey);
  return parts.join('|');
};

export const decodePaymentIntent = (code: string): PaymentIntent | null => {
  const parts = code.trim().split('|');
  if (parts[0] !== 'PAY' || parts.length < 3) return null;
  const [, enrollmentId, type, ...rest] = parts;
  if (!enrollmentId) return null;
  if (type === 'inscription') return { enrollmentId, type };
  if (type === 'tuition' && rest[0]) return { enrollmentId, type, monthKey: rest[0] };
  if (type === 'service' && rest[0]) return { enrollmentId, type, serviceId: rest[0], monthKey: rest[1] };
  return null;
};

/** Reconstruit l'id d'un PayableItem (PaymentEntry.tsx) à partir d'une intention scannée. */
export const paymentIntentToItemId = (intent: PaymentIntent): string => {
  if (intent.type === 'inscription') return 'inscription';
  if (intent.type === 'tuition') return `tuition_${intent.monthKey}`;
  if (intent.type === 'service') {
    return intent.monthKey ? `service_${intent.serviceId}_${intent.monthKey}` : `service_${intent.serviceId}`;
  }
  return '';
};

// ─── Payment Summary for a student ────────────────────────────────────────────
export interface StudentPaymentStatus {
  studentId: string;           // enrollment UUID
  studentUniqueId: string;
  firstName: string;
  lastName: string;
  classId: string | null;      // UUID
  // Inscription
  inscriptionPaid: boolean;
  inscriptionPayment?: Payment;
  // Tuition months: monthKey → payment
  tuitionByMonth: Partial<Record<MonthKey, Payment>>;
  // Services: serviceId → payment (or month → payment for monthly services)
  servicePayments: Record<string, Payment>;  // key: `${serviceId}` or `${serviceId}_${monthKey}`
  // Computed
  totalPaid: number;
  totalDue: number;
  balance: number;
}
