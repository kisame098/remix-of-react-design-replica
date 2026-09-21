// ═══════════════════════════════════════════════════════════════════════════
// AMORÇAGE DU PROGRAMME (matières du collège, barème de l'élémentaire)
//
// À la première connexion d'une école neuve, SenClass pré-remplit Cursus. Le
// test historique était « la table est vide » : dès qu'une école SUPPRIMAIT tout
// (ce qu'elle a le droit de faire), tout REVENAIT à la connexion suivante.
//
// Désormais l'amorçage n'a lieu qu'une fois : dès que l'école supprime quoi que
// ce soit, elle est marquée « amorcée » (settings.programmeCollegeAmorce /
// programmeElementaireAmorce) et on ne lui remet plus rien.
// ═══════════════════════════════════════════════════════════════════════════

export type TypeProgramme = 'college' | 'elementaire';

export const CLE_AMORCE: Record<TypeProgramme, string> = {
  college: 'programmeCollegeAmorce',
  elementaire: 'programmeElementaireAmorce',
};

export const dejaAmorce = (settings: Record<string, unknown> | undefined | null, type: TypeProgramme): boolean =>
  settings?.[CLE_AMORCE[type]] === true;

export const doitAmorcer = (o: {
  type: TypeProgramme;
  settings: Record<string, unknown> | undefined | null;
  /** La lecture a réussi ET n'a rien renvoyé. */
  tableVide: boolean;
  estAdmin: boolean;
  accesBloque: boolean;
}): boolean => o.tableVide && o.estAdmin && !o.accesBloque && !dejaAmorce(o.settings, o.type);

/** N'amorce pas les niveaux que l'école a supprimés. */
export const sansNiveauxSupprimes = <T extends { niveau: string }>(lignes: T[], supprimes: string[]): T[] => {
  const s = new Set(supprimes);
  return lignes.filter(l => !s.has(l.niveau));
};

/**
 * Niveaux que l'école a SUPPRIMÉS de Cursus (settings.niveauxSupprimes). Un
 * niveau fixe (CI…3ème) apparaît par défaut ; le supprimer le retire de Cursus
 * et du choix de bloc à la création d'une classe, jusqu'à ce qu'on le restaure.
 */
export const getNiveauxSupprimes = (settings: Record<string, unknown> | undefined | null): string[] => {
  const brut = settings?.niveauxSupprimes;
  return Array.isArray(brut) ? brut.filter((n): n is string => typeof n === 'string') : [];
};
