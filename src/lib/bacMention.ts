// ─── Mentions du Baccalauréat sénégalais ────────────────────────────────────
// Seuils vérifiés (source : samabac.sn + statistiques officielles du Bac
// sénégalais) : Passable dès 10/20, Assez Bien dès 12/20, Bien dès 14/20,
// Très Bien dès 16/20. En dessous de 10 : pas de mention (ajourné). La
// "Félicitations du jury" (>18 avec dossier exceptionnel) est une distinction
// discrétionnaire du jury, jamais calculée automatiquement ici.
export const computeBacMention = (moyenne: number): string => {
  if (moyenne >= 16) return 'Très Bien';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez Bien';
  if (moyenne >= 10) return 'Passable';
  return 'Ajourné';
};
