import type { Payment, PaymentMethod, PaymentType } from '@/types/payment';

// ═══════════════════════════════════════════════════════════════════════════
// D'OÙ VIENT L'ARGENT ENCAISSÉ — Gestion des paiements → Total encaissé →
// détail. Chaque paiement non annulé devient une ligne rangée par rubrique
// (inscription, mensualités, services annexes), par frais précis, par classe
// et par cycle (ou formation) ; on filtre puis on additionne. Fonctions
// pures, testées dans detailEncaissements.test.ts.
// ═══════════════════════════════════════════════════════════════════════════

export type Rubrique = PaymentType;

export const LIBELLES_RUBRIQUE: Record<Rubrique, string> = {
  inscription: 'Inscriptions',
  tuition: 'Mensualités',
  service: 'Services annexes',
};
export const RUBRIQUES: Rubrique[] = ['inscription', 'tuition', 'service'];

export interface LigneEncaissement {
  id: string;
  eleveId: string;
  rubrique: Rubrique;
  /** Le frais précis : 'inscription', 'tuition:2026-10', 'service:<id>'. */
  frais: string;
  montant: number;
  methode: PaymentMethod;
  /** Jour de l'encaissement, AAAA-MM-JJ. */
  jour: string;
  classId?: string;
  /** Cycle (classique) ou formation (formation professionnelle) de la classe. */
  groupe?: string;
}

export interface FiltresEncaissements {
  rubrique: 'toutes' | Rubrique;
  frais: 'tous' | string;
  groupe: 'tous' | string;
  classe: 'toutes' | string;
  methode: 'toutes' | PaymentMethod;
  du: string;
  au: string;
}

export const FILTRES_VIDES: FiltresEncaissements = {
  rubrique: 'toutes', frais: 'tous', groupe: 'tous', classe: 'toutes', methode: 'toutes', du: '', au: '',
};

export const cleFrais = (p: Pick<Payment, 'type' | 'monthKey' | 'serviceId'>): string =>
  p.type === 'inscription' ? 'inscription' : p.type === 'tuition' ? `tuition:${p.monthKey ?? ''}` : `service:${p.serviceId ?? ''}`;

/** Les paiements encaissés (non annulés), avec la classe et le cycle actuels de l'élève. */
export const lignesEncaissement = (
  payments: Payment[],
  classeDe: (eleveId: string) => string | undefined,
  groupeDe: (classId: string) => string | undefined,
): LigneEncaissement[] => payments
  .filter(p => p.status !== 'cancelled')
  .map(p => {
    const classId = classeDe(p.studentId);
    return {
      id: p.id, eleveId: p.studentId, rubrique: p.type, frais: cleFrais(p), montant: p.amount, methode: p.method,
      jour: p.paidAt.slice(0, 10), classId, groupe: classId ? groupeDe(classId) : undefined,
    };
  });

export const filtrerEncaissements = (lignes: LigneEncaissement[], f: FiltresEncaissements): LigneEncaissement[] =>
  lignes.filter(l =>
    (f.rubrique === 'toutes' || l.rubrique === f.rubrique)
    && (f.frais === 'tous' || l.frais === f.frais)
    && (f.groupe === 'tous' || l.groupe === f.groupe)
    && (f.classe === 'toutes' || l.classId === f.classe)
    && (f.methode === 'toutes' || l.methode === f.methode)
    && (!f.du || l.jour >= f.du)
    && (!f.au || l.jour <= f.au));

export type Repartition = Record<Rubrique, number> & { total: number };
const vide = (): Repartition => ({ inscription: 0, tuition: 0, service: 0, total: 0 });
const ajouter = (r: Repartition, l: LigneEncaissement) => { r[l.rubrique] += l.montant; r.total += l.montant; };

export const repartition = (lignes: LigneEncaissement[]): Repartition => {
  const r = vide();
  for (const l of lignes) ajouter(r, l);
  return r;
};

/** Par mois d'encaissement (AAAA-MM), dans l'ordre. */
export const parMois = (lignes: LigneEncaissement[]): ({ mois: string } & Repartition)[] => {
  const m = new Map<string, Repartition>();
  for (const l of lignes) {
    const cle = l.jour.slice(0, 7);
    if (!m.has(cle)) m.set(cle, vide());
    ajouter(m.get(cle)!, l);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mois, r]) => ({ mois, ...r }));
};

/** Par classe : combien chaque classe a payé, rubrique par rubrique (sans classe : '' ). */
export const parClasse = (lignes: LigneEncaissement[]): Map<string, Repartition & { eleves: number }> => {
  const m = new Map<string, Repartition & { eleves: Set<string> }>();
  for (const l of lignes) {
    const cle = l.classId ?? '';
    if (!m.has(cle)) m.set(cle, { ...vide(), eleves: new Set() });
    const r = m.get(cle)!;
    ajouter(r, l);
    r.eleves.add(l.eleveId);
  }
  return new Map([...m.entries()].map(([k, r]) => [k, { ...r, eleves: r.eleves.size }]));
};

/** Par frais précis, du plus gros au plus petit. */
export const parFrais = (lignes: LigneEncaissement[]): { frais: string; rubrique: Rubrique; total: number; paiements: number }[] => {
  const m = new Map<string, { frais: string; rubrique: Rubrique; total: number; paiements: number }>();
  for (const l of lignes) {
    const x = m.get(l.frais) ?? { frais: l.frais, rubrique: l.rubrique, total: 0, paiements: 0 };
    x.total += l.montant;
    x.paiements += 1;
    m.set(l.frais, x);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
};
