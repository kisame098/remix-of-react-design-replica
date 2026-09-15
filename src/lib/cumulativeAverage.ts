// ═══════════════════════════════════════════════════════════════════════════
// MOYENNE CUMULÉE / ANNUELLE — la ligne du bas du bulletin, celle qui décide
// d'un passage en classe supérieure.
//
// Au Sénégal, la quasi-totalité des établissements (6ème → Terminale) travaille
// en 2 semestres ; de rares écoles en font 3. On ne peut donc PAS coder le
// nombre de périodes en dur, ni supposer que la période courante est la
// dernière : au moment de générer un bulletin, on regarde combien de périodes
// existent RÉELLEMENT pour cette classe et cette année.
//
//   • 1re période de l'année      → rien à cumuler ;
//   • dernière période existante  → « Moyenne Annuelle » ;
//   • période intermédiaire       → « Moyenne cumulée », jamais « annuelle ».
//
// Fonctions pures extraites de useClassRanking / useElementaryClassRanking
// (cumulativeAverage.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

import type { GradePeriod } from '@/contexts/SchoolContext';

export interface SemesterSelection {
  /** Périodes à cumuler : de la première de l'année jusqu'à celle demandée, incluse. */
  periodsSoFar: GradePeriod[];
  /** true si aucune période n'existe après celle-ci à ce jour pour cette classe. */
  isFinal: boolean;
  label: string;
}

/**
 * Rend null quand il n'y a rien à cumuler : période inconnue, période d'examen
 * (un examen interne ne se cumule pas), ou 1re période de l'année.
 */
export const selectSemestersSoFar = (
  gradePeriods: GradePeriod[],
  isClassInPeriod: (periodId: string, classId: string) => boolean,
  periodId: string,
  classId: string,
): SemesterSelection | null => {
  const period = gradePeriods.find(p => p.id === periodId);
  if (!period || period.type !== 'semester') return null;

  // Les périodes de CETTE classe — pas toutes celles de l'école : une classe de
  // collège peut être sur 3 trimestres pendant qu'une classe de lycée n'en a
  // que 2, même si les deux périodes existent au niveau de l'établissement.
  const semesters = gradePeriods
    .filter(p =>
      p.type === 'semester' &&
      p.academicYearLabel === period.academicYearLabel &&
      isClassInPeriod(p.id, classId))
    .sort((a, b) => a.ordering - b.ordering);

  const idx = semesters.findIndex(p => p.id === periodId);
  if (idx <= 0) return null; // 1re période de l'année pour cette classe

  const isFinal = idx === semesters.length - 1;
  return {
    periodsSoFar: semesters.slice(0, idx + 1),
    isFinal,
    label: isFinal ? 'Moyenne Annuelle' : 'Moyenne cumulée',
  };
};

export interface PeriodAverage {
  studentId: string;
  average: number;
}

export interface CumulativeStudentAverage {
  studentId: string;
  average: number;
  rank: number;
}

/**
 * Moyenne des moyennes de période, puis classement.
 *
 * Un élève qui n'a de note que sur une seule période est moyenné sur CETTE
 * période uniquement — on ne compte jamais une période manquante comme 0, pas
 * plus qu'on ne le fait pour une matière non notée.
 */
export const averageAcrossPeriods = (
  perPeriodAverages: PeriodAverage[][],
): CumulativeStudentAverage[] => {
  const byStudent = new Map<string, number[]>();
  for (const periodRows of perPeriodAverages) {
    for (const row of periodRows) {
      if (!byStudent.has(row.studentId)) byStudent.set(row.studentId, []);
      byStudent.get(row.studentId)!.push(row.average);
    }
  }

  const list = [...byStudent.entries()].map(([studentId, averages]) => ({
    studentId,
    average: averages.reduce((s, a) => s + a, 0) / averages.length,
    rank: 0,
  }));

  list.sort((a, b) => b.average - a.average);
  for (let i = 0; i < list.length; i++) {
    // Ex æquo : même rang, et le rang suivant saute d'autant.
    list[i].rank = i > 0 && list[i - 1].average === list[i].average ? list[i - 1].rank : i + 1;
  }
  return list;
};
