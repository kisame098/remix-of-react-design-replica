// ═══════════════════════════════════════════════════════════════════════════
// BORNES DE L'ANNÉE SCOLAIRE — tout ce qui est daté dans l'app (présences en
// tête) n'existe qu'entre l'ouverture et la fermeture de l'école, définies dans
// Paramètres > Année scolaire.
//
// Sans cette borne, une séance créée un jour de vacances serait quand même
// estampillée du label de l'année courante : elle polluerait les heures du prof
// (donc sa paie) et les statistiques d'assiduité, sans être visible nulle part.
//
// Les dates ISO "AAAA-MM-JJ" étant zéro-paddées, la comparaison de chaînes
// suffit et évite les pièges de fuseau horaire de `new Date()`.
// ═══════════════════════════════════════════════════════════════════════════

export interface YearBounds {
  startDate: string; // "2025-10-01"
  endDate: string;   // "2026-06-30"
}

export const isDateInSchoolYear = (
  date: string,
  bounds: YearBounds | null | undefined,
): boolean => {
  if (!bounds?.startDate || !bounds?.endDate) return true; // année non configurée : on ne bloque rien
  return date >= bounds.startDate && date <= bounds.endDate;
};

/** Ramène une date hors année sur la borne la plus proche (utile quand « aujourd'hui »
 *  tombe pendant les vacances : on ouvre l'écran sur un jour valide). */
export const clampDateToSchoolYear = (
  date: string,
  bounds: YearBounds | null | undefined,
): string => {
  if (!bounds?.startDate || !bounds?.endDate) return date;
  if (date < bounds.startDate) return bounds.startDate;
  if (date > bounds.endDate) return bounds.endDate;
  return date;
};

/** Variante objet Date, pour les composants calendrier (react-day-picker). */
export const clampDateObjToSchoolYear = (
  date: Date,
  bounds: { start: Date; end: Date } | null,
): Date => {
  if (!bounds) return date;
  if (date < bounds.start) return bounds.start;
  if (date > bounds.end) return bounds.end;
  return date;
};
