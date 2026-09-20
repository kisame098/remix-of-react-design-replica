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

// ─── Écriture d'un réglage par élève ─────────────────────────────────────────

/** Ligne de `student_subject_settings` : un réglage manuel, pour UNE occurrence de la matière. */
export interface LigneReglageManuel {
  school_id: string;
  subject_id: string;
  student_enrollment_id: string;
  active: boolean;
  override_reason: 'manual';
  updated_at: string;
  custom_coefficient?: number | null;
}

/**
 * Les lignes à écrire pour désactiver / réactiver une matière (ou changer son
 * coefficient) pour un élève : UNE PAR OCCURRENCE — donc à toutes les périodes.
 *
 * `customCoef` :
 *   • `undefined` → la colonne n'est PAS envoyée, donc pas touchée : désactiver puis
 *     réactiver une matière ne doit pas effacer un coefficient personnalisé ;
 *   • `''`        → coefficient personnalisé retiré (retour à celui de la matière) ;
 *   • `'1.5'`     → coefficient personnalisé posé.
 */
export const lignesReglageManuel = (o: {
  schoolId: string; studentEnrollmentId: string; occurrenceIds: string[];
  active: boolean; customCoef?: string; maintenant: string;
}): LigneReglageManuel[] =>
  o.occurrenceIds.map(id => ({
    school_id: o.schoolId, subject_id: id, student_enrollment_id: o.studentEnrollmentId,
    active: o.active, override_reason: 'manual' as const, updated_at: o.maintenant,
    ...(o.customCoef !== undefined
      ? { custom_coefficient: o.customCoef !== '' ? Number(o.customCoef) : null }
      : {}),
  }));

/**
 * L'état local après l'écriture : le même réglage sur chaque occurrence, sans
 * toucher aux réglages des AUTRES élèves ni au coefficient personnalisé quand on
 * n'en fournit pas.
 */
export const appliquerReglageLocal = (
  precedent: SubjectSettingsData[], occurrenceIds: string[], studentEnrollmentId: string,
  active: boolean, customCoef?: string,
): SubjectSettingsData[] => {
  const parMatiere = new Map(precedent.map(ss => [ss.subjectId, ss]));
  for (const id of occurrenceIds) {
    const existant = parMatiere.get(id);
    const ancien = existant?.studentSettings?.[studentEnrollmentId];
    const entree = {
      active,
      customCoef: customCoef !== undefined ? customCoef : ancien?.customCoef,
      overrideReason: 'manual',
    };
    parMatiere.set(id, existant
      ? { ...existant, studentSettings: { ...existant.studentSettings, [studentEnrollmentId]: entree } }
      : {
          id: '', subjectId: id,
          devoir1Active: true, devoir2Active: true, devoir3Active: true, devoir4Active: false, devoir5Active: false,
          studentSettings: { [studentEnrollmentId]: entree },
        });
  }
  // Ordre d'origine conservé ; les entrées nouvelles s'ajoutent à la fin.
  const dejaLa = new Set(precedent.map(ss => ss.subjectId));
  return [
    ...precedent.map(ss => parMatiere.get(ss.subjectId)!),
    ...occurrenceIds.filter(id => !dejaLa.has(id)).map(id => parMatiere.get(id)!),
  ];
};

export type AcademicProfileSource =
  | 'Exception manuelle' | 'Choix résolu' | 'Facultative' | 'Hérité du cursus';

export interface AcademicProfileRow {
  /** Première occurrence de la matière dans l'année (celle qu'on présente). */
  subject: Subject;
  /** Toutes les occurrences — une par période — que tout réglage doit atteindre. */
  occurrenceIds: string[];
  /** Active dans TOUTES les périodes. */
  active: boolean;
  /** Réglée différemment selon les périodes : à corriger, l'école doit le voir. */
  partielle: boolean;
  /**
   * Éteinte volontairement (dispense, exception manuelle) : c'est ce qui la garde
   * dans la liste pour qu'on puisse la RÉACTIVER. Une matière jamais souscrite
   * (facultative, choix) n'est pas « désactivée » : elle n'a simplement jamais été activée.
   */
  desactivee: boolean;
  coefficient: number;
  source: AcademicProfileSource;
}

/**
 * Toutes les occurrences d'une matière : une par période de l'année, pour LA MÊME
 * classe. Un réglage par élève (dispense, coefficient) doit les atteindre toutes —
 * sinon la matière éteinte au premier trimestre reste comptée aux suivants.
 */
export const occurrencesDeLaMatiere = (
  subjects: Subject[], gradePeriods: GradePeriod[], subjectId: string,
): Subject[] => {
  const cible = subjects.find(s => s.id === subjectId);
  if (!cible) return [];
  const annee = gradePeriods.find(p => p.id === cible.periodId)?.academicYearLabel;
  if (!annee) return [cible];
  const periodesDeLAnnee = new Set(gradePeriods.filter(p => p.academicYearLabel === annee).map(p => p.id));
  return subjects.filter(s => s.classId === cible.classId && s.name === cible.name && periodesDeLAnnee.has(s.periodId));
};

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
  { activeOnly = true, inclureDesactivees = false }: {
    activeOnly?: boolean;
    /**
     * Garde aussi les matières ÉTEINTES volontairement (dispense…), pour l'écran
     * du profil : une matière qu'on vient de désactiver doit y rester, avec son
     * interrupteur, sinon on ne peut plus la réactiver.
     */
    inclureDesactivees?: boolean;
  } = {},
): AcademicProfileRow[] => {
  if (!classId || !academicYearLabel) return [];

  const periodIds = gradePeriods
    .filter(p => p.academicYearLabel === academicYearLabel)
    .map(p => p.id);

  const classSubjects = subjects.filter(s => s.classId === classId && periodIds.includes(s.periodId));

  // Regroupées par nom : une matière par période, présentée une seule fois.
  const parNom = new Map<string, Subject[]>();
  for (const s of classSubjects) parNom.set(s.name, [...(parNom.get(s.name) ?? []), s]);

  const rows = [...parNom.values()].map((occurrences): AcademicProfileRow => {
    const s = occurrences[0];
    const reglages = occurrences.map(o => getSubjectSettings(o.id)?.studentSettings?.[studentEnrollmentId]);

    // Une obligatoire est active SAUF dispense ; un choix / une facultative
    // n'existe qu'une fois explicitement activé.
    const actives = occurrences.map((o, i) => o.subjectType === 'obligatoire'
      ? (reglages[i]?.active ?? true)
      : (reglages[i]?.active ?? false));
    const active = actives.every(Boolean);
    const partielle = actives.some(Boolean) && !active;

    const reglage = reglages.find(r => r?.customCoef && r.customCoef !== '') ?? reglages[0];
    const coefficient = reglage?.customCoef && reglage.customCoef !== ''
      ? Number(reglage.customCoef)
      : s.coefficient;

    const manuel = reglages.some(r => r?.overrideReason === 'manual');
    let source: AcademicProfileSource;
    if (manuel) source = 'Exception manuelle';
    else if (s.subjectType === 'choix') source = 'Choix résolu';
    else if (s.subjectType === 'facultative') source = 'Facultative';
    else source = 'Hérité du cursus';

    // Éteinte volontairement : une obligatoire inactive est forcément dispensée ;
    // une matière à option ne l'est que si quelqu'un l'a éteinte à la main.
    const desactivee = !active && !partielle && (s.subjectType === 'obligatoire' || manuel);

    return {
      subject: s, occurrenceIds: occurrences.map(o => o.id),
      active, partielle, desactivee, coefficient, source,
    };
  });

  const gardees = inclureDesactivees
    ? rows.filter(r => r.active || r.desactivee || r.partielle)
    : activeOnly ? rows.filter(r => r.active) : rows;

  return gardees.sort((a, b) => a.subject.name.localeCompare(b.subject.name));
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
