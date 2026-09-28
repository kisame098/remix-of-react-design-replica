// ═══════════════════════════════════════════════════════════════════════════
// RETIRER UN ÉLÈVE OU UN PROFESSEUR — sans rien effacer.
//
// Effacer une inscription effacerait en cascade ses paiements (donc les reçus
// et la caisse). « Retirer » marque seulement l'inscription de l'année
// `withdrawn` et désactive le compte de connexion ; « Réintégrer » l'annule.
// Voir docs/sql/retrait_eleves_profs.sql.
// ═══════════════════════════════════════════════════════════════════════════

export const STATUT_ACTIF = 'active';
export const STATUT_RETIRE = 'withdrawn';

/** Une inscription sans statut connu (ancien instantané hors ligne) est active. */
export const estRetire = (statut: string | undefined | null): boolean => statut === STATUT_RETIRE;

/** Sépare les inscriptions de l'année entre présents et retirés. */
export const separerRetires = <T extends { status?: string }>(inscriptions: T[]): { actifs: T[]; retires: T[] } => ({
  actifs: inscriptions.filter(i => !estRetire(i.status)),
  retires: inscriptions.filter(i => estRetire(i.status)),
});
