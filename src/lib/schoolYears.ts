// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION ENTRE ANNÉES SCOLAIRES.
//
// Les classes, les élèves et les tarifs survivent d'une année à l'autre, mais
// chaque année a ses propres inscriptions. Deux questions reviennent :
//
//   • « quelle est l'année d'AVANT ? » — pour reporter la grille tarifaire
//     (une école garde presque toujours les mêmes frais) ;
//   • « cette personne est-elle inscrite CETTE année ? » — pour que les élèves
//     et les profs des années passées ne traînent pas dans les écrans courants.
//
// Fonctions pures (schoolYears.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

export interface YearLike {
  id: string;        // label "2025-2026"
  startDate: string; // ISO
}

/**
 * Année IMMÉDIATEMENT précédente — la plus récente parmi celles qui commencent
 * avant l'année courante. Prendre la plus ancienne reporterait des tarifs
 * vieux de cinq ans.
 */
export const findPreviousSchoolYear = <T extends YearLike>(
  schoolYears: T[],
  currentYear: YearLike | null | undefined,
): T | undefined => {
  if (!currentYear) return undefined;
  return schoolYears
    .filter(y => y.startDate < currentYear.startDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
};

/**
 * Ne garde que les comptes rattachés à une inscription de l'ANNÉE COURANTE.
 *
 * Sans ce filtre, l'écran Identifiants affiche les élèves et professeurs des
 * années passées : des comptes fantômes qu'on ne peut ni gérer ni supprimer,
 * et qui laissent croire qu'ils ont encore accès. Une personne réinscrite a une
 * nouvelle inscription : elle réapparaît naturellement.
 */
export const filterAccountsToCurrentYear = <
  T extends { role: string; studentEnrollmentId?: string | null; teacherEnrollmentId?: string | null }
>(
  accounts: T[],
  currentStudentEnrollmentIds: Iterable<string>,
  currentTeacherEnrollmentIds: Iterable<string>,
): T[] => {
  const students = new Set(currentStudentEnrollmentIds);
  const teachers = new Set(currentTeacherEnrollmentIds);
  return accounts.filter(a =>
    a.role === 'student'
      ? !!a.studentEnrollmentId && students.has(a.studentEnrollmentId)
      : !!a.teacherEnrollmentId && teachers.has(a.teacherEnrollmentId));
};
