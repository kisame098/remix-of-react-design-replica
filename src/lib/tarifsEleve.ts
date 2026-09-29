// ═══════════════════════════════════════════════════════════════════════════
// TARIF PERSONNALISÉ D'UN ÉLÈVE (réductions, bourses, cas particuliers)
//
// Pour un élève, l'école peut changer ce qu'il paie sur un frais précis :
// l'inscription, un mois de scolarité, un service annexe (un mois ou l'année).
// Trois formules :
//   • 'pourcentage' : réduction en %      (−50 % → paie la moitié) ;
//   • 'reduction'   : réduction en francs (−5 000 F, jamais sous 0) ;
//   • 'montant'     : montant fixe        (« il paie 10 000 F »).
//
// Ordre du calcul : tarif de la classe → montant propre au mois
// (mensualites.ts) → tarif personnalisé de l'élève (ici). Une réduction en %
// suit donc un changement de tarif ; un montant fixe, non.
//
// Règles d'argent :
//   • un élément DÉJÀ SOLDÉ ne change jamais (appliqué par les appelants) ;
//   • un élément ramené à 0 F n'est plus rien à payer et ne bloque rien ;
//   • chaque personnalisation porte un motif et qui l'a accordée.
// Fonctions pures, testées dans tarifsEleve.test.ts (plus de 1 000 cas).
// ═══════════════════════════════════════════════════════════════════════════

import type { PaymentType } from '@/types/payment';
import { mensualiteDuMois, type MontantsParMois } from '@/lib/mensualites';

export type ModeAjustement = 'pourcentage' | 'reduction' | 'montant';

export const LIBELLES_MODE: Record<ModeAjustement, string> = {
  pourcentage: 'Réduction en %',
  reduction: 'Réduction en francs',
  montant: 'Montant fixe',
};

/** Un frais précis : inscription, un mois de scolarité, un service (un mois ou l'année). */
export interface ElementFrais { type: PaymentType; monthKey?: string; serviceId?: string }

export interface AjustementTarif extends ElementFrais {
  id?: string;
  studentId: string;
  mode: ModeAjustement;
  valeur: number;
  motif: string;
  accordePar?: string;
  accordeLe?: string;
}

/** Clé stable d'un frais : « inscription », « tuition:2026-10 », « service:<id> », « service:<id>:2026-10 ». */
export const cleElement = (e: ElementFrais): string => {
  if (e.type === 'inscription') return 'inscription';
  if (e.type === 'tuition') return `tuition:${e.monthKey ?? ''}`;
  return e.monthKey ? `service:${e.serviceId ?? ''}:${e.monthKey}` : `service:${e.serviceId ?? ''}`;
};

/** Ce que l'élève paie pour un frais de tarif `base`, selon la formule. Toujours un entier ≥ 0. */
export const appliquerAjustement = (base: number, a: Pick<AjustementTarif, 'mode' | 'valeur'>): number => {
  const b = Math.max(0, Math.round(base));
  switch (a.mode) {
    case 'pourcentage': {
      const p = Math.min(100, Math.max(0, a.valeur));
      return Math.min(b, Math.max(0, Math.round((b * (100 - p)) / 100)));
    }
    case 'reduction':
      return Math.max(0, b - Math.max(0, Math.round(a.valeur)));
    case 'montant':
      return Math.max(0, Math.round(a.valeur));
    default:
      return b;
  }
};

/** Erreur de saisie d'une personnalisation (undefined si elle est valable). */
export const verifierAjustement = (a: { mode: ModeAjustement; valeur: number; motif: string }): string | undefined => {
  if (!a.motif || a.motif.trim().length < 3) return 'Indiquez le motif (au moins 3 caractères)';
  if (!Number.isFinite(a.valeur)) return 'Valeur invalide';
  if (!Number.isInteger(a.valeur)) return 'Valeur en nombre entier';
  if (a.mode === 'pourcentage') {
    if (a.valeur <= 0 || a.valeur > 100) return 'Le pourcentage doit être entre 1 et 100';
  } else if (a.mode === 'reduction') {
    if (a.valeur <= 0) return 'La réduction doit être supérieure à 0 F';
  } else if (a.mode === 'montant') {
    if (a.valeur < 0) return 'Le montant ne peut pas être négatif';
  } else {
    return 'Formule inconnue';
  }
  return undefined;
};

/** Personnalisations d'UN élève, rangées par frais : la plus récente l'emporte en cas de doublon. */
export const indexerAjustements = (ajustements: AjustementTarif[]): Map<string, AjustementTarif> => {
  const idx = new Map<string, AjustementTarif>();
  for (const a of ajustements) {
    const cle = cleElement(a);
    const prec = idx.get(cle);
    if (!prec || (a.accordeLe ?? '') >= (prec.accordeLe ?? '')) idx.set(cle, a);
  }
  return idx;
};

export interface MontantEleve {
  /** Ce que l'élève doit pour ce frais. */
  du: number;
  /** Le tarif normal (classe / mois) avant personnalisation. */
  tarifNormal: number;
  /** La personnalisation appliquée, s'il y en a une. */
  ajustement?: AjustementTarif;
}

/** Montant dû par l'élève pour un frais, compte tenu de sa personnalisation éventuelle. */
export const montantEleve = (
  base: number, element: ElementFrais, index: Map<string, AjustementTarif>,
): MontantEleve => {
  const tarifNormal = Math.max(0, Math.round(base));
  const ajustement = index.get(cleElement(element));
  return ajustement
    ? { du: appliquerAjustement(tarifNormal, ajustement), tarifNormal, ajustement }
    : { du: tarifNormal, tarifNormal };
};

/**
 * Une même formule appliquée à plusieurs frais d'un coup (tous les mois, les
 * mois cochés, l'inscription…) : une personnalisation par frais, sans doublon.
 */
export const developperAjustement = (
  modele: { studentId: string; mode: ModeAjustement; valeur: number; motif: string },
  cibles: ElementFrais[],
): AjustementTarif[] => {
  const vus = new Set<string>();
  const out: AjustementTarif[] = [];
  for (const c of cibles) {
    const cle = cleElement(c);
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({
      studentId: modele.studentId, type: c.type,
      ...(c.monthKey ? { monthKey: c.monthKey } : {}),
      ...(c.serviceId ? { serviceId: c.serviceId } : {}),
      mode: modele.mode, valeur: modele.valeur, motif: modele.motif.trim(),
    });
  }
  return out;
};

/** Argent en moins pour l'école : somme des (tarif normal − dû), jamais négative ligne à ligne. */
export const manqueAGagner = (lignes: { tarifNormal: number; du: number }[]): number =>
  lignes.reduce((s, l) => s + Math.max(0, l.tarifNormal - l.du), 0);

/** « −50 % », « −5 000 F », « 10 000 F » : la formule, lisible. */
export const decrireAjustement = (a: Pick<AjustementTarif, 'mode' | 'valeur'>): string => {
  const f = (n: number) => `${new Intl.NumberFormat('fr-FR').format(n)} F`;
  if (a.mode === 'pourcentage') return `−${a.valeur} %`;
  if (a.mode === 'reduction') return `−${f(a.valeur)}`;
  return `Montant fixe ${f(a.valeur)}`;
};

/** Tarif normal d'un frais (avant personnalisation) : classe, mois, ou service. */
export const tarifNormalDe = (
  e: ElementFrais,
  cfg: { inscriptionFee: number; monthlyFee: number; montantsParMois?: MontantsParMois } | undefined,
  services: { id: string; amount: number }[],
): number => {
  if (e.type === 'inscription') return cfg?.inscriptionFee ?? 0;
  if (e.type === 'tuition') return cfg ? mensualiteDuMois(cfg, e.monthKey) : 0;
  return services.find(s => s.id === e.serviceId)?.amount ?? 0;
};
