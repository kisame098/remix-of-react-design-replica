// ═══════════════════════════════════════════════════════════════════════════
// FACTURATION — ce qu'une facture contient, son numéro, et où elle en est.
//
// Règle de contenu : une facture réclame TOUT ce qui reste dû jusqu'au mois de
// sa date limite — inscription, mois en retard, mois en cours, services, et le
// reste des paiements partiels. Jamais les mois suivants : une famille n'a pas
// à recevoir en octobre une facture pour juin.
//
// Le calcul part de buildPayableItems (src/lib/dueItems.ts), la vue caisse :
// une facture ne peut donc jamais réclamer autre chose que ce que la caisse
// encaisserait. Fonctions pures, couvertes par facture.test.ts.
// ═══════════════════════════════════════════════════════════════════════════

import type { PayableItem } from '@/lib/dueItems';
import type { AcademicMonth } from '@/types/payment';

export type TypeFacture = 'facture' | 'rappel';

/** Une ligne figée au moment de l'émission (colonne `lignes` de la table factures). */
export interface LigneFacture {
  /** Identifiant de l'élément à payer (PayableItem.id) : sert au suivi. */
  cle: string;
  designation: string;
  /** Ce que l'élève doit pour cet élément (tarif personnalisé compris). */
  montant: number;
  deja_verse: number;
  /** Reste à payer au moment de l'émission. */
  reste: number;
  en_retard: boolean;
}

export interface FactureEnregistree {
  id: string;
  type: TypeFacture;
  number: number;
  academicYearLabel: string;
  studentEnrollmentId: string;
  factureOrigineId: string | null;
  /** « 2026-10-31 » */
  dateLimite: string;
  lignes: LigneFacture[];
  total: number;
  createdAt: string;
}

/** « FAC-2026-00042 » / « RAP-2026-00007 » : année de début + numéro sur 5 chiffres. */
export const numeroDeFacture = (type: TypeFacture, anneeScolaire: string, numero: number): string => {
  const annee = /^\d{4}/.exec(anneeScolaire)?.[0] ?? anneeScolaire;
  return `${type === 'facture' ? 'FAC' : 'RAP'}-${annee}-${String(numero).padStart(5, '0')}`;
};

/**
 * Rang du dernier mois facturé : celui qui contient la date limite. Avant le
 * premier mois de l'année → -1 (aucun mois, seulement l'inscription et les
 * frais uniques) ; après le dernier → toute l'année.
 */
export const rangDuMoisLimite = (mois: AcademicMonth[], dateLimite: string): number => {
  if (mois.length === 0) return -1;
  const cle = dateLimite.slice(0, 7);
  const trouve = mois.find(m => m.key === cle);
  if (trouve) return trouve.index;
  return cle < mois[0].key ? -1 : mois[mois.length - 1].index;
};

/** Ce que la facture réclame : tout le non-payé exigible au mois de la date limite. */
export const lignesAFacturer = (
  elements: PayableItem[], mois: AcademicMonth[], dateLimite: string,
): LigneFacture[] => {
  const limite = rangDuMoisLimite(mois, dateLimite);
  const rang = new Map(mois.map(m => [m.key, m.index]));
  return elements
    .filter(e => !e.paid && e.amount > 0)
    .filter(e => !e.monthKey || (rang.get(e.monthKey) ?? Infinity) <= limite)
    .map(e => ({
      cle: e.id,
      designation: e.label,
      montant: e.amount + e.dejaVerse,
      deja_verse: e.dejaVerse,
      reste: e.amount,
      en_retard: !!e.overdue,
    }));
};

export const totalDesLignes = (lignes: LigneFacture[]): number =>
  lignes.reduce((s, l) => s + l.reste, 0);

/**
 * Reste à payer AUJOURD'HUI sur chaque ligne d'une facture, d'après les
 * éléments à payer actuels de l'élève. Un élément soldé (ou disparu) ne doit
 * plus rien ; un acompte versé depuis l'émission réduit le reste. Jamais plus
 * que ce que la facture réclamait : un tarif relevé après coup ne gonfle pas
 * une facture déjà remise.
 */
export const restesActuels = (lignes: LigneFacture[], elements: PayableItem[]): LigneFacture[] => {
  const parCle = new Map(elements.map(e => [e.id, e]));
  return lignes.map(l => {
    const e = parCle.get(l.cle);
    const reste = !e || e.paid ? 0 : Math.min(e.amount, l.reste);
    return { ...l, reste, deja_verse: l.montant - reste };
  });
};

export type StatutFacture = 'payee' | 'partielle' | 'en_attente' | 'en_retard';

export interface EtatFacture {
  resteActuel: number;
  statut: StatutFacture;
  /** Jours écoulés depuis la date limite (0 si elle n'est pas dépassée). */
  joursDeRetard: number;
}

/** « 2026-10-31 » → nombre de jours entiers entre deux dates (sans heure). */
const joursEntre = (de: string, a: string): number =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

export const etatFacture = (
  f: Pick<FactureEnregistree, 'lignes' | 'total' | 'dateLimite'>, elements: PayableItem[], aujourdhui: string,
): EtatFacture => {
  const resteActuel = totalDesLignes(restesActuels(f.lignes, elements));
  const retard = Math.max(0, joursEntre(f.dateLimite, aujourdhui));
  const statut: StatutFacture = resteActuel === 0 ? 'payee'
    : retard > 0 ? 'en_retard'
    : resteActuel < f.total ? 'partielle'
    : 'en_attente';
  return { resteActuel, statut, joursDeRetard: resteActuel === 0 ? 0 : retard };
};

export const LIBELLES_STATUT: Record<StatutFacture, string> = {
  payee: 'Payée',
  partielle: 'Payée en partie',
  en_attente: 'En attente',
  en_retard: 'En retard',
};

/** Le rappel réclame ce qui reste de la facture d'origine — et rien d'autre. */
export const lignesDeRappel = (origine: Pick<FactureEnregistree, 'lignes'>, elements: PayableItem[]): LigneFacture[] =>
  restesActuels(origine.lignes, elements)
    .filter(l => l.reste > 0)
    .map(l => ({ ...l, en_retard: true }));

const MOIS_LONGS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 2026-10-31 » → « 31 octobre 2026 » ; « 2026-10-01 » → « 1er octobre 2026 ». */
export const jourEnLettres = (jour: string): string => {
  const [a, m, j] = jour.slice(0, 10).split('-').map(Number);
  if (!a || !m || !j) return jour;
  return `${j}${j === 1 ? 'er' : ''} ${MOIS_LONGS[m - 1]} ${a}`;
};

/** Date du jour à Dakar, « 2026-10-04 » (Dakar = UTC toute l'année). */
export const aujourdhuiDakar = (maintenant: Date = new Date()): string => maintenant.toISOString().slice(0, 10);

/** Ligne venue de la base (types Supabase non générés pour cette table). */
export const lireFacture = (r: Record<string, unknown>): FactureEnregistree => ({
  id: String(r.id),
  type: r.type === 'rappel' ? 'rappel' : 'facture',
  number: Number(r.number),
  academicYearLabel: String(r.academic_year_label),
  studentEnrollmentId: String(r.student_enrollment_id),
  factureOrigineId: (r.facture_origine_id as string | null) ?? null,
  dateLimite: String(r.date_limite),
  lignes: Array.isArray(r.lignes) ? (r.lignes as LigneFacture[]) : [],
  total: Number(r.total),
  createdAt: String(r.created_at),
});

/** Ce que le PDF affiche de l'élève — tiré de la fiche au moment de l'impression. */
export interface EleveFacture {
  nom: string;
  matricule: string;
  classe?: string;
  tuteur?: { nom?: string; telephone?: string };
}

/** Le document à imprimer, à partir d'une facture enregistrée. */
export const documentDeFacture = (
  f: FactureEnregistree, eleve: EleveFacture, origine?: FactureEnregistree, duplicata = false,
) => ({
  type: f.type,
  numero: numeroDeFacture(f.type, f.academicYearLabel, f.number),
  emiseLe: f.createdAt,
  dateLimite: f.dateLimite,
  anneeScolaire: f.academicYearLabel,
  eleve: { nom: eleve.nom, matricule: eleve.matricule, classe: eleve.classe },
  tuteur: eleve.tuteur,
  lignes: f.lignes,
  total: f.total,
  origine: origine
    ? { numero: numeroDeFacture(origine.type, origine.academicYearLabel, origine.number), emiseLe: origine.createdAt, dateLimite: origine.dateLimite }
    : undefined,
  duplicata,
});

/** Dernier jour du mois en cours, « 2026-10-31 » — date limite proposée par défaut. */
export const finDuMois = (jour: string): string => {
  const [a, m] = jour.split('-').map(Number);
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${jour.slice(0, 7)}-${String(dernier).padStart(2, '0')}`;
};
