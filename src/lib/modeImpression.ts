// ═══════════════════════════════════════════════════════════════════════════
// MODE D'IMPRESSION — couleur ou noir et blanc, retenu PAR TYPE DE DOCUMENT.
//
// Beaucoup d'écoles n'ont qu'une imprimante noir et blanc : les grands aplats
// sombres (bandeau, total) y coûtent cher en encre et sortent striés. On choisit
// une fois pour les reçus, une fois pour les factures, etc. ; le choix reste
// ensuite par défaut, et se change à tout moment dans la fenêtre d'aperçu.
//
// Retenu sur CET ordinateur (stockage du navigateur) : c'est l'imprimante
// branchée ici qui décide. Si le stockage est indisponible (navigation privée),
// on retombe sur la couleur, sans erreur.
// ═══════════════════════════════════════════════════════════════════════════

export type ModeImpression = 'couleur' | 'economique';

export type TypeDocument = 'recu' | 'facture' | 'fiche' | 'fiche_paiement' | 'formation';

export const LIBELLES_TYPE_DOCUMENT: Record<TypeDocument, string> = {
  recu: 'les reçus',
  facture: 'les factures et rappels',
  fiche: 'les fiches d\'inscription',
  fiche_paiement: 'les fiches de paiement',
  formation: 'les documents de formation',
};

const cle = (type: TypeDocument) => `senclass:impression:${type}`;

/** Le mode retenu, ou null si on ne l'a jamais choisi pour ce type de document. */
export const lireModeImpression = (type: TypeDocument): ModeImpression | null => {
  try {
    const v = localStorage.getItem(cle(type));
    return v === 'couleur' || v === 'economique' ? v : null;
  } catch {
    return null;
  }
};

export const retenirModeImpression = (type: TypeDocument, mode: ModeImpression): void => {
  try {
    localStorage.setItem(cle(type), mode);
  } catch {
    // Stockage indisponible : le choix vaut pour cette fois seulement.
  }
};
