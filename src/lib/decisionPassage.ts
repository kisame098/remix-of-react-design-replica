// ═══════════════════════════════════════════════════════════════════════════
// DÉCISION DE PASSAGE EN CLASSE SUPÉRIEURE
//
// Le système TRANCHE, pour tous les niveaux, du CI à la Terminale :
//
//   moyenne annuelle ≥ seuil  →  Admis en classe supérieure
//   moyenne annuelle < seuil  →  Redouble
//
// Deux barèmes, parce que les deux systèmes de notation coexistent :
//   • élémentaire (CI → CM2) : moyenne sur 10, seuil à 5
//   • collège et lycée       : moyenne sur 20, seuil à 10
//
// La décision porte sur la MOYENNE ANNUELLE — celle qui cumule l'année — et
// n'apparaît que sur le bulletin de fin d'année, coché à la main au moment de
// le générer. Le bulletin du premier semestre n'annonce jamais un passage.
//
// Historique : le système annonçait « Passage de droit » aux niveaux
// intermédiaires (CI, CE1, CM1) SANS REGARDER LES NOTES. Un élève aux
// résultats catastrophiques recevait un bulletin l'autorisant à passer.
// ═══════════════════════════════════════════════════════════════════════════

/** Moyenne minimale pour passer, par système de notation. */
export const SEUIL_ELEMENTAIRE = 5;   // sur 10
export const SEUIL_SECONDAIRE  = 10;  // sur 20

export const NIVEAUX_ELEMENTAIRE_DECISION = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'] as const;

export const ADMIS    = 'Admis en classe supérieure';
export const REDOUBLE = 'Redouble';

export interface ContexteDecision {
  niveau: string | undefined;
  /** Coché à la main au moment de générer le bulletin — jamais déduit. */
  estDernierePeriode: boolean;
  /** Moyenne ANNUELLE (cumulée sur l'année), pas celle du trimestre. */
  moyenneAnnuelle: number | undefined;
}

const estElementaire = (niveau: string): boolean =>
  (NIVEAUX_ELEMENTAIRE_DECISION as readonly string[]).includes(niveau);

/** Seuil applicable au niveau — utile pour l'afficher à côté de la décision. */
export const seuilDePassage = (niveau: string | undefined): number | undefined => {
  if (!niveau) return undefined;
  return estElementaire(niveau) ? SEUIL_ELEMENTAIRE : SEUIL_SECONDAIRE;
};

/** Barème du niveau : 10 en élémentaire, 20 ensuite. */
export const baremeDuNiveau = (niveau: string | undefined): number | undefined => {
  if (!niveau) return undefined;
  return estElementaire(niveau) ? 10 : 20;
};

/**
 * Décision à imprimer sur le bulletin.
 *
 * `undefined` dans deux cas seulement, et jamais par indécision :
 *   • ce n'est pas le bulletin de fin d'année ;
 *   • aucune moyenne annuelle n'a pu être calculée — sans note, on ne fait pas
 *     redoubler un élève sur du vide.
 */
export const decisionDePassage = (c: ContexteDecision): string | undefined => {
  if (!c.estDernierePeriode || !c.niveau) return undefined;
  if (c.moyenneAnnuelle === undefined || Number.isNaN(c.moyenneAnnuelle)) return undefined;

  const seuil = seuilDePassage(c.niveau)!;
  return c.moyenneAnnuelle >= seuil ? ADMIS : REDOUBLE;
};
