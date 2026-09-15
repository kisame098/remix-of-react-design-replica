// ═══════════════════════════════════════════════════════════════════════════
// PROFIL ACADÉMIQUE D'UN ÉLÈVE — « quelles matières suit-il, avec quel
// coefficient ? ». C'est le geste central du produit : l'élève porte un profil
// individuel, la classe n'est qu'un point de départ.
//
// Trois façons pour une matière d'être active :
//   • obligatoire  → active par défaut, sauf dispense explicite ;
//   • choix        → inactive tant que l'élève n'a pas choisi (LV2, série…) ;
//   • facultative  → inactive tant qu'elle n'est pas souscrite (Latin…).
//
// Se tromper ici fausse directement la moyenne : une matière active en trop
// pèse de son coefficient, une matière manquante disparaît du bulletin.
//
// Fonctions pures extraites de StudentManagement / SchoolContext pour être
// testables (academicProfile.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

import type {
  Subject, SubjectSettingsData, SchoolClass, GradePeriod,
  FiliereChoiceGroup, ClassFiliereAssignment, FiliereStudentChoice,
} from '@/contexts/SchoolContext';
import { mergeFiliereChoiceGroups } from '@/contexts/SchoolContext';

export type AcademicProfileSource =
  | 'Exception manuelle' | 'Choix résolu' | 'Facultative' | 'Hérité du cursus';

export interface AcademicProfileRow {
  subject: Subject;
  active: boolean;
  coefficient: number;
  source: AcademicProfileSource;
}

/**
 * Une matière existe une fois PAR PÉRIODE (matérialisée à la création de
 * chaque semestre) : on la présente une seule fois, sur sa première occurrence
 * de l'année — sinon le profil afficherait trois fois « Maths ».
 */
export const resolveAcademicProfile = (
  subjects: Subject[],
  gradePeriods: GradePeriod[],
  getSubjectSettings: (subjectId: string) => SubjectSettingsData | undefined,
  studentEnrollmentId: string,
  classId: string | null,
  academicYearLabel: string | null,
  { activeOnly = true }: { activeOnly?: boolean } = {},
): AcademicProfileRow[] => {
  if (!classId || !academicYearLabel) return [];

  const periodIds = gradePeriods
    .filter(p => p.academicYearLabel === academicYearLabel)
    .map(p => p.id);

  const classSubjects = subjects.filter(s => s.classId === classId && periodIds.includes(s.periodId));

  const byName = new Map<string, Subject>();
  for (const s of classSubjects) if (!byName.has(s.name)) byName.set(s.name, s);

  const rows = [...byName.values()].map((s): AcademicProfileRow => {
    const setting = getSubjectSettings(s.id)?.studentSettings?.[studentEnrollmentId];
    // Une obligatoire est active SAUF dispense ; un choix / une facultative
    // n'existe qu'une fois explicitement activé.
    const active = s.subjectType === 'obligatoire'
      ? (setting?.active ?? true)
      : (setting?.active ?? false);
    const coefficient = setting?.customCoef && setting.customCoef !== ''
      ? Number(setting.customCoef)
      : s.coefficient;

    let source: AcademicProfileSource;
    if (setting?.overrideReason === 'manual') source = 'Exception manuelle';
    else if (s.subjectType === 'choix') source = 'Choix résolu';
    else if (s.subjectType === 'facultative') source = 'Facultative';
    else source = 'Hérité du cursus';

    return { subject: s, active, coefficient, source };
  });

  return (activeOnly ? rows.filter(r => r.active) : rows)
    .sort((a, b) => a.subject.name.localeCompare(b.subject.name));
};

/**
 * Créneaux de choix (LV2, série…) que l'élève n'a PAS encore tranchés.
 * Tant qu'il en reste un, son profil est incomplet : le bulletin manquerait
 * une matière et sa moyenne serait calculée sur un dénominateur trop court.
 */
export const getUnresolvedChoiceGroups = (
  classes: SchoolClass[],
  classFiliereAssignments: ClassFiliereAssignment[],
  filiereChoiceGroups: FiliereChoiceGroup[],
  filiereStudentChoices: FiliereStudentChoice[],
  studentEnrollmentId: string,
  classId: string,
  academicYearLabel: string,
): FiliereChoiceGroup[] => {
  const cls = classes.find(c => c.id === classId);
  if (!cls?.niveau) return [];

  const assignment = classFiliereAssignments.find(
    a => a.classId === classId && a.academicYearLabel === academicYearLabel
  );
  if (!assignment) return [];

  const groups = mergeFiliereChoiceGroups(filiereChoiceGroups, assignment.filiereId, cls.niveau);
  return groups.filter(g => !filiereStudentChoices.some(
    c => c.studentEnrollmentId === studentEnrollmentId && c.choiceGroupId === g.id
  ));
};
