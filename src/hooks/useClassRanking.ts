import { useMemo } from 'react';
import { useSchool, Student, Subject, Grade, SubjectSettingsData } from '@/contexts/SchoolContext';
import { selectSemestersSoFar, averageAcrossPeriods } from '@/lib/cumulativeAverage';

export type RankingCalculationMode = 'top2' | 'top3' | 'all';

export interface RankingSubjectDetail {
  subjectName: string;
  muDev: number | null;
  composition: number | null;
  muMat: number | null;
  coef: number;
  pPond: number | null;
}

export interface StudentRanking {
  studentId: string;
  studentCode: string;
  firstName: string;
  lastName: string;
  averageGeneral: number;
  totalCoef: number;
  rank: number;
  subjectDetails: RankingSubjectDetail[];
}

// Formule canonique de la moyenne générale — utilisée par le classement de
// classe ET par le bulletin, pour produire EXACTEMENT les mêmes chiffres :
// μ_dev (moyenne des devoirs actifs, top2/top3/toutes) → μ_mat = (μ_dev + Composition)/2
// → P_pond = μ_mat × coefficient résolu de l'élève → Moyenne = ΣP_pond / ΣCoef.
//
// Une période de type "examen" (examen interne) n'a PAS de devoirs ni de
// composition — une seule note par matière (grades.note), déjà saisie comme
// telle dans SubjectGrades.tsx. Dans ce cas μ_mat = la note directement, sans
// passer par μ_dev/composition/mode de calcul (qui n'ont aucun sens ici).
//
// Fonction pure (pas un hook) : prend les données déjà chargées en paramètres
// plutôt que de les lire via useSchool(), pour pouvoir être appelée plusieurs
// fois (une par période) à l'intérieur d'un seul useMemo — nécessaire pour la
// moyenne annuelle/cumulée, qui combine plusieurs périodes à la fois.
export function computeClassRanking(
  periodId: string,
  classId: string,
  mode: RankingCalculationMode,
  students: Student[],
  subjects: Subject[],
  grades: Grade[],
  getSubjectSettings: (subjectId: string) => SubjectSettingsData | undefined,
  isExam: boolean,
): StudentRanking[] {
  const classStudents = students.filter(s => s.classId === classId);
  const classSubjects = subjects.filter(s => s.periodId === periodId && s.classId === classId);

  const studentRankings: StudentRanking[] = [];

  for (const student of classStudents) {
    const settings = classSubjects.map(subj => getSubjectSettings(subj.id));

    const activeSubjects = classSubjects.filter((_subj, idx) => {
      const setting = settings[idx];
      if (setting?.studentSettings?.[student.id]?.active === false) return false;
      return true;
    });

    if (activeSubjects.length === 0) continue;

    let totalPPond = 0;
    let totalCoef = 0;
    const subjectDetails: StudentRanking['subjectDetails'] = [];

    for (const subject of classSubjects) {
      const setting = getSubjectSettings(subject.id);

      if (setting?.studentSettings?.[student.id]?.active === false) continue;

      const customCoefStr = setting?.studentSettings?.[student.id]?.customCoef;
      const studentCoef = customCoefStr && customCoefStr !== ''
        ? parseFloat(customCoefStr)
        : subject.coefficient;

      const grade = grades.find(
        g => g.studentEnrollmentId === student.id && g.subjectId === subject.id
      );

      if (!grade) {
        subjectDetails.push({ subjectName: subject.name, muDev: null, composition: null, muMat: null, coef: studentCoef, pPond: null });
        continue;
      }

      let muDev: number | null = null;
      let composition: number | undefined;
      let muMat: number | null = null;

      if (isExam) {
        // Une seule note, pas de devoirs/composition/mode de calcul.
        muMat = grade.note ?? null;
      } else {
        const devoir1Active = setting?.devoir1Active ?? true;
        const devoir2Active = setting?.devoir2Active ?? true;
        const devoir3Active = setting?.devoir3Active ?? true;
        const devoir4Active = setting?.devoir4Active ?? false;
        const devoir5Active = setting?.devoir5Active ?? false;

        const devoirNotes: number[] = [];
        if (devoir1Active && grade.devoir1 !== undefined) devoirNotes.push(grade.devoir1);
        if (devoir2Active && grade.devoir2 !== undefined) devoirNotes.push(grade.devoir2);
        if (devoir3Active && grade.devoir3 !== undefined) devoirNotes.push(grade.devoir3);
        if (devoir4Active && grade.devoir4 !== undefined) devoirNotes.push(grade.devoir4);
        if (devoir5Active && grade.devoir5 !== undefined) devoirNotes.push(grade.devoir5);

        let selectedNotes: number[] = [];
        const k = devoirNotes.length;

        if (mode === 'top2') {
          const n = 2;
          selectedNotes = k <= n ? [...devoirNotes] : [...devoirNotes].sort((a, b) => b - a).slice(0, n);
        } else if (mode === 'top3') {
          const n = 3;
          selectedNotes = k <= n ? [...devoirNotes] : [...devoirNotes].sort((a, b) => b - a).slice(0, n);
        } else {
          selectedNotes = [...devoirNotes];
        }

        if (selectedNotes.length > 0) {
          muDev = selectedNotes.reduce((sum, n) => sum + n, 0) / selectedNotes.length;
        }

        composition = grade.composition;
        if (muDev !== null && composition !== undefined) {
          muMat = (muDev + composition) / 2;
        } else if (muDev !== null && composition === undefined) {
          muMat = muDev;
        } else if (muDev === null && composition !== undefined) {
          muMat = composition;
        }
      }

      let pPond: number | null = null;
      if (muMat !== null) {
        pPond = muMat * studentCoef;
        totalPPond += pPond;
        totalCoef += studentCoef;
      }

      subjectDetails.push({ subjectName: subject.name, muDev, composition: composition ?? null, muMat, coef: studentCoef, pPond });
    }

    const averageGeneral = totalCoef > 0 ? totalPPond / totalCoef : 0;

    studentRankings.push({
      studentId: student.id,
      studentCode: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      averageGeneral,
      totalCoef,
      rank: 0,
      subjectDetails,
    });
  }

  studentRankings.sort((a, b) => b.averageGeneral - a.averageGeneral);

  for (let i = 0; i < studentRankings.length; i++) {
    if (i === 0) {
      studentRankings[i].rank = 1;
    } else if (studentRankings[i].averageGeneral === studentRankings[i - 1].averageGeneral) {
      studentRankings[i].rank = studentRankings[i - 1].rank;
    } else {
      studentRankings[i].rank = i + 1;
    }
  }

  return studentRankings;
}

export function useClassRanking(
  periodId: string | undefined,
  classId: string | undefined,
  mode: RankingCalculationMode,
  enabled = true,
): StudentRanking[] {
  const { students, subjects, grades, getSubjectSettings, gradePeriods } = useSchool();
  const isExam = gradePeriods.find(p => p.id === periodId)?.type === 'exam';

  return useMemo((): StudentRanking[] => {
    if (!enabled || !periodId || !classId) return [];
    return computeClassRanking(periodId, classId, mode, students, subjects, grades, getSubjectSettings, isExam);
  }, [enabled, periodId, classId, mode, students, subjects, grades, getSubjectSettings, isExam]);
}

export interface CumulativeStudentAverage {
  studentId: string;
  average: number;
  rank: number;
}

export interface CumulativeAverageInfo {
  /** true si aucun semestre créé après celui-ci à ce jour pour cette année — recalculé à chaque génération, donc s'auto-corrige si un semestre suivant est créé plus tard. */
  isFinal: boolean;
  label: string;
  periodNames: string[];
  rankings: CumulativeStudentAverage[];
}

// Moyenne annuelle / cumulée : au Sénégal, l'immense majorité des établissements
// (6ème à Terminale) fonctionnent en 2 semestres — de rares écoles en font 3.
// On ne peut pas savoir à l'avance si un semestre suivant sera créé, donc on ne
// fige jamais l'étiquette : on regarde, au moment de générer le bulletin,
// combien de semestres existent RÉELLEMENT pour cette année scolaire.
// - 1er semestre de l'année → pas de moyenne cumulée (rien à combiner).
// - Semestre qui est actuellement le DERNIER semestre existant → "Moyenne Annuelle"
//   (couvre le cas à 2 semestres, le plus courant, et le cas à 3 une fois le 3e créé).
// - Semestre intermédiaire (ex: le 2e sur 3 déjà créés) → "Moyenne cumulée",
//   jamais "annuelle" tant qu'on ne sait pas que c'est le dernier.
// Le bulletin n'étant jamais mis en cache, régénérer un ancien bulletin après
// la création d'un semestre suivant recalcule et corrige l'étiquette tout seul.
export function useCumulativeAverage(
  periodId: string | undefined,
  classId: string | undefined,
  mode: RankingCalculationMode,
): CumulativeAverageInfo | null {
  const { gradePeriods, isClassInPeriod, students, subjects, grades, getSubjectSettings } = useSchool();

  return useMemo((): CumulativeAverageInfo | null => {
    if (!periodId || !classId) return null;

    // Sélection des périodes et calcul du cumul : fonctions pures de
    // src/lib/cumulativeAverage.ts (couvertes par cumulativeAverage.test.ts).
    const selection = selectSemestersSoFar(gradePeriods, isClassInPeriod, periodId, classId);
    if (!selection) return null;

    const perPeriod = selection.periodsSoFar.map(p =>
      // periodsSoFar ne contient que des semestres (filtré) — jamais d'examen.
      computeClassRanking(p.id, classId, mode, students, subjects, grades, getSubjectSettings, false)
        .map(r => ({ studentId: r.studentId, average: r.averageGeneral })),
    );

    return {
      isFinal: selection.isFinal,
      label: selection.label,
      periodNames: selection.periodsSoFar.map(p => p.name),
      rankings: averageAcrossPeriods(perPeriod),
    };
  }, [periodId, classId, mode, gradePeriods, isClassInPeriod, students, subjects, grades, getSubjectSettings]);
}
