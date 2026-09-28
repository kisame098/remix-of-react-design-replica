// ═══════════════════════════════════════════════════════════════════════════
// PAIEMENTS PARTIELS (ACOMPTES)
//
// Une famille peut régler un élément (inscription, mois, service) en plusieurs
// fois. Chaque versement inférieur au reste dû est un ACOMPTE (partiel = true) ;
// le versement qui complète le reste SOLDE l'élément (partiel = false).
//
//   • L'élément n'est « payé » que soldé : la chaîne des mois reste bloquée
//     tant qu'un mois n'est pas soldé, comme avant.
//   • Tout paiement antérieur aux acomptes compte comme soldé : aucun mois
//     payé ne redevient dû, même si le tarif a changé depuis.
//   • La base garde sa protection contre le double encaissement : un seul
//     paiement soldant par élément (index uniques « … and not partiel »).
// Fonctions pures, testées dans paiementPartiel.test.ts.
// ═══════════════════════════════════════════════════════════════════════════

/** Ce qu'il reste à payer sur un élément, compte tenu des acomptes. */
export const resteAPayer = (du: number, dejaVerse: number): number => Math.max(0, du - dejaVerse);

/** `ok` : montant accepté (`partiel` = acompte) ; sinon `erreur` dit pourquoi. */
export interface DecisionVersement { ok: boolean; montant: number; partiel: boolean; erreur?: string }

const refus = (erreur: string): DecisionVersement => ({ ok: false, montant: 0, partiel: false, erreur });

/**
 * Le montant saisi à la caisse pour un élément dont il reste `reste` à payer :
 * moins que le reste = acompte, exactement le reste = solde, plus = refusé.
 */
export const deciderVersement = (saisie: string | number, reste: number): DecisionVersement => {
  const montant = typeof saisie === 'number' ? saisie : Number(String(saisie).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  if (!Number.isFinite(montant) || montant <= 0) return refus('Montant invalide');
  if (!Number.isInteger(montant)) return refus('Montant en francs entiers');
  if (reste <= 0) return refus('Rien à payer sur cet élément');
  if (montant > reste) return refus(`Plus que le reste à payer (${reste.toLocaleString('fr-FR')} F)`);
  return { ok: true, montant, partiel: montant < reste };
};
