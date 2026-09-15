import { useMemo } from 'react';
import { useSchool, Student, ElementaryClassLine, ElementaryGrade, ElementaryLineSetting } from '@/contexts/SchoolContext';
import { selectSemestersSoFar, averageAcrossPeriods } from '@/lib/cumulativeAverage';

export interface ElementaryStudentRanking {
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  /** Moyenne sur 10 — undefined si aucune discipline saisie pour cet élève. */
  average: number | undefined;
  pointsObtenus: number;
  pointsMax: number;
  rank: number;
}

// Formule canonique élémentaire (voir docs/plan) : on additionne les points
// obtenus sur TOUTES les disciplines actives SAISIES (une discipline non
// renseignée est EXCLUE des deux sommes, jamais comptée comme 0), puis on
// ramène sur 10 : MOYENNE = (Σ points_obtenus) × 10 / (Σ points_max des disciplines saisies).
export function computeElementaryClassRanking(
  classId: string,
  periodId: string,
  students: Student[],
  elementaryClassLines: ElementaryClassLine[],
  elementaryGrades: ElementaryGrade[],
  elementaryLineSettings: ElementaryLineSetting[] = [],
): ElementaryStudentRanking[] {
  const classStudents = students.filter(s => s.classId === classId);
  const lines = elementaryClassLines.filter(l => l.classId === classId && l.periodId === periodId);
  const lineIds = new Set(lines.map(l => l.id));

  // Dispenses (ex: inapte EPS) — la discipline sort du calcul de CET élève.
  const exempted = new Set(
    elementaryLineSettings.filter(s => !s.active).map(s => `${s.studentEnrollmentId}:${s.lineId}`)
  );

  const rankings: ElementaryStudentRanking[] = classStudents.map(student => {
    let pointsObtenus = 0;
    let pointsMax = 0;
    let hasEntry = false;

    for (const grade of elementaryGrades) {
      if (grade.studentEnrollmentId !== student.id || !lineIds.has(grade.lineId)) continue;
      if (grade.pointsObtenus === undefined) continue;
      if (exempted.has(`${student.id}:${grade.lineId}`)) continue;
      const line = lines.find(l => l.id === grade.lineId);
      if (!line) continue;
      hasEntry = true;
      pointsObtenus += grade.pointsObtenus;
      pointsMax += line.pointMax;
    }

    const average = hasEntry && pointsMax > 0
      ? Math.min(10, Math.max(0, (pointsObtenus * 10) / pointsMax))
      : undefined;

    return {
      studentId: student.id,
      studentCode: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      average,
      pointsObtenus,
      pointsMax,
      rank: 0,
    };
  });

  const ranked = [...rankings].sort((a, b) => (b.average ?? -Infinity) - (a.average ?? -Infinity));
  for (let i = 0; i < ranked.length; i++) {
    if (ranked[i].average === undefined) { ranked[i].rank = 0; continue; }
    ranked[i].rank = i > 0 && ranked[i - 1].average === ranked[i].average ? ranked[i - 1].rank : i + 1;
  }

  return rankings.map(r => ranked.find(x => x.studentId === r.studentId)!);
}

export function useElementaryClassRanking(
  classId: string | undefined,
  periodId: string | undefined,
  enabled = true,
): ElementaryStudentRanking[] {
  const { students, elementaryClassLines, elementaryGrades, elementaryLineSettings } = useSchool();

  return useMemo((): ElementaryStudentRanking[] => {
    if (!enabled || !classId || !periodId) return [];
    return computeElementaryClassRanking(
      classId, periodId, students, elementaryClassLines, elementaryGrades, elementaryLineSettings,
    );
  }, [enabled, classId, periodId, students, elementaryClassLines, elementaryGrades, elementaryLineSettings]);
}

export interface ElementaryCumulativeStudentAverage {
  studentId: string;
  average: number;
  rank: number;
}

export interface ElementaryCumulativeAverageInfo {
  /** true si aucun trimestre créé après celui-ci à ce jour pour cette année. */
  isFinal: boolean;
  label: string;
  periodNames: string[];
  rankings: ElementaryCumulativeStudentAverage[];
}

// Moyenne annuelle/cumulée élémentaire — même logique de détection dynamique
// "dernier trimestre existant" que useCumulativeAverage (pas de nombre de
// trimestres codé en dur, l'école étant libre d'en créer 2 ou 3).
export function useElementaryCumulativeAverage(
  periodId: string | undefined,
  classId: string | undefined,
): ElementaryCumulativeAverageInfo | null {
  const { gradePeriods, isClassInPeriod, students, elementaryClassLines, elementaryGrades, elementaryLineSettings } = useSchool();

  return useMemo((): ElementaryCumulativeAverageInfo | null => {
    if (!periodId || !classId) return null;

    const selection = selectSemestersSoFar(gradePeriods, isClassInPeriod, periodId, classId);
    if (!selection) return null;

    // Un élève sans aucune note sur une période n'y a pas de moyenne : cette
    // période est simplement absente de son cumul, jamais comptée comme 0.
    const perPeriod = selection.periodsSoFar.map(p =>
      computeElementaryClassRanking(classId, p.id, students, elementaryClassLines, elementaryGrades, elementaryLineSettings)
        .filter(r => r.average !== undefined)
        .map(r => ({ studentId: r.studentId, average: r.average! })),
    );

    return {
      isFinal: selection.isFinal,
      label: selection.label,
      periodNames: selection.periodsSoFar.map(p => p.name),
      rankings: averageAcrossPeriods(perPeriod),
    };
  }, [periodId, classId, gradePeriods, isClassInPeriod, students, elementaryClassLines, elementaryGrades, elementaryLineSettings]);
}
