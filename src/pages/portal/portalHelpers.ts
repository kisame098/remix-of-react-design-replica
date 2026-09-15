// ─── Shared types ────────────────────────────────────────────────────────────

export interface GradePeriod {
  id: string;
  name: string;
  ordering: number;
}

export interface SubjectGrade {
  id: string;
  subjectId: string;
  subjectName: string;
  coefficient: number;
  periodId: string;
  devoir1: number | null;
  devoir2: number | null;
  devoir3: number | null;
  devoir4: number | null;
  devoir5: number | null;
  composition: number | null;
  note: number | null;
}

export interface SlotEvent {
  id: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherName: string;
  className?: string;
  color: string;
  /** "all" = toute la classe ; sinon le cours ne concerne qu'un groupe. */
  groupId?: string;
  groupName?: string;
}

export interface Payment {
  id: string;
  type: string;
  serviceId: string | null;
  monthKey: string | null;
  amount: number;
  paidAt: string;
  method: string;
  reference: string | null;
  note: string | null;
  receivedBy: string | null;
  status: 'confirmed' | 'cancelled';
  cancelledAt: string | null;
  cancelledBy: string | null;
}

export interface AnnexSvc {
  id: string;
  name: string;
  amount: number;
  frequency: string;
}

export interface Attendance {
  id: string;
  status: string;
  isJustified: boolean;
  justification: string | null;
  date: string;
  subjectName: string;
  startTime: string;
  endTime: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const DAYS_LONG  = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
export const DAYS_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam'];
export const MONTHS_FULL = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre',
];
export const SCHOOL_MONTHS = [
  'Septembre','Octobre','Novembre','Décembre',
  'Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août',
];

const jsDay = new Date().getDay();
export const TODAY_I = jsDay === 0 ? -1 : jsDay - 1;

// ─── Grade helpers ───────────────────────────────────────────────────────────

export const weightedAvg = (gs: SubjectGrade[]): number | null => {
  const v = gs.filter(g => g.note !== null);
  if (!v.length) return null;
  const sc = v.reduce((s, g) => s + g.coefficient, 0);
  return sc ? v.reduce((s, g) => s + g.note! * g.coefficient, 0) / sc : null;
};

export const fmtGrade = (n: number | null): string =>
  n == null ? '—' : n.toFixed(2);

export const fmtTime = (t: string): string =>
  t ? t.slice(0, 5) : '—';

export const fmtDateFull = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
};

/** Date + heure exacte — pour l'audit des paiements ("2 septembre 2026 à 18:52"). */
export const fmtDateTimeFull = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${fmtDateFull(iso)} à ${hh}:${mm}`;
};

/** Référence courte et unique d'un paiement, dérivée de son UUID (premier bloc). */
export const paymentRef = (id: string): string =>
  id ? id.split('-')[0].toUpperCase() : '—';

export const fmtAmount = (n: number): string =>
  n.toLocaleString('fr-FR') + ' FCFA';

export type GradeLevel = 'excellent' | 'bien' | 'passable' | 'insuffisant' | 'none';

export const gradeLevel = (n: number | null): GradeLevel => {
  if (n == null) return 'none';
  if (n >= 16)   return 'excellent';
  if (n >= 14)   return 'bien';
  if (n >= 10)   return 'passable';
  return 'insuffisant';
};

export const GP: Record<GradeLevel, {
  bar: string; text: string; bg: string; border: string; mention: string;
}> = {
  excellent:   { bar:'bg-emerald-500', text:'text-emerald-700', bg:'bg-emerald-50',  border:'border-emerald-200', mention:'Excellent'   },
  bien:        { bar:'bg-green-500',   text:'text-green-700',   bg:'bg-green-50',    border:'border-green-200',   mention:'Bien'        },
  passable:    { bar:'bg-blue-500',    text:'text-blue-700',    bg:'bg-blue-50',     border:'border-blue-200',    mention:'Passable'    },
  insuffisant: { bar:'bg-red-500',     text:'text-red-700',     bg:'bg-red-50',      border:'border-red-200',     mention:'Insuffisant' },
  none:        { bar:'bg-muted',       text:'text-muted-foreground', bg:'bg-muted/40', border:'border-border',  mention:'—'           },
};

// ─── Payment helpers ──────────────────────────────────────────────────────────

/** Convertit une clé de mois "AAAA-MM" en libellé lisible "Novembre 2025". */
export const monthKeyLabel = (key: string | null | undefined): string => {
  if (!key) return '';
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key; // format inconnu (ancienne donnée non migrée) — affiché tel quel
  const [, year, month] = m;
  const label = MONTHS_FULL[parseInt(month, 10) - 1];
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)} ${year}` : key;
};

export const paymentLabel = (p: Payment, services: AnnexSvc[]): string => {
  if (p.type === 'inscription') return "Frais d'inscription";
  if (p.type === 'tuition') {
    const m = monthKeyLabel(p.monthKey);
    return `Scolarité${m ? ' — ' + m : ''}`;
  }
  if (p.type === 'service') {
    const srv = services.find(s => s.id === p.serviceId);
    const m   = monthKeyLabel(p.monthKey);
    return (srv?.name ?? 'Service') + (m ? ' — ' + m : '');
  }
  return p.type;
};

export type MethodKey = 'cash' | 'mobile' | 'bank' | 'cheque' | 'other';

export const methodKey = (method: string): MethodKey => {
  // La base stocke les clés SANS accent ('especes', 'cheque' — voir
  // PaymentMethod dans types/payment.ts) ; les formes accentuées ne viennent
  // que de saisies libres anciennes. Les deux doivent être reconnues, sinon un
  // paiement en espèces s'affiche en gris « autre » sur le reçu de la famille.
  const m = (method || '').toLowerCase();
  if (/esp[èe]ce|cash|liquide/.test(m))    return 'cash';
  if (/wave|orange|mobile|momo/.test(m))   return 'mobile';
  if (/virement|bank|transfer/.test(m))    return 'bank';
  if (/ch[èe]que|check/.test(m))           return 'cheque';
  return 'other';
};

export const methodLabel = (method: string): string => {
  const k = methodKey(method);
  if (k === 'cash')   return 'Espèces';
  if (k === 'mobile') return method || 'Mobile money';
  if (k === 'bank')   return 'Virement';
  if (k === 'cheque') return 'Chèque';
  return method || '—';
};

export const methodColorCls = (method: string): string => {
  const k = methodKey(method);
  if (k === 'cash')   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (k === 'mobile') return 'bg-orange-50  text-orange-700  border-orange-200';
  if (k === 'bank')   return 'bg-blue-50    text-blue-700    border-blue-200';
  if (k === 'cheque') return 'bg-violet-50  text-violet-700  border-violet-200';
  return 'bg-muted text-muted-foreground border-border';
};

// ─── Duration helper ──────────────────────────────────────────────────────────

export const slotDuration = (start: string, end: string): string => {
  const diff =
    (parseInt(end.slice(0,2)) * 60 + parseInt(end.slice(3,5))) -
    (parseInt(start.slice(0,2)) * 60 + parseInt(start.slice(3,5)));
  if (diff <= 0) return '';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return h ? `${h}h${m ? m.toString().padStart(2, '0') : ''}` : `${m} min`;
};

// ─── Initials ─────────────────────────────────────────────────────────────────

export const initials = (name: string): string =>
  name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
