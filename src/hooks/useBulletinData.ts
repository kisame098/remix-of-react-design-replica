import { useMemo } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAttendance } from '@/contexts/AttendanceContext';
import { useClassRanking, useCumulativeAverage, RankingCalculationMode } from '@/hooks/useClassRanking';
import { decisionDePassage } from '@/lib/decisionPassage';
import { BulletinPdfData } from '@/lib/bulletinPdf';

/**
 * Assemble les données de bulletin (BulletinPdfData) pour une classe/période —
 * logique partagée entre BulletinModal (aperçu/téléchargement admin) et la
 * publication au portail élève (voir ClassRankingModal "Publier au portail").
 * Une seule source de vérité pour le calcul : classement, moyenne annuelle,
 * absences/retards sur la période — jamais dupliquée ailleurs.
 */
export function useBulletinDataList(
  periodId: string | undefined,
  classId: string | undefined,
  mode: RankingCalculationMode,
  enabled = true,
  studentId?: string,
  observations?: string,
  /** Coché à la main dans BulletinModal — jamais déduit. Sans lui, aucune
   *  décision de passage n'est imprimée : le bulletin du 1er semestre ne doit
   *  pas annoncer un passage définitif. */
  isLastPeriodOfYear = false,
): BulletinPdfData[] {
  const { classes, gradePeriods, students, filieres, getClassFiliereAssignment } = useSchool();
  const { currentYear } = useSchoolYear();
  const { school } = useAuth();
  const { studentAttendances, sessions } = useAttendance();
  const rankings = useClassRanking(periodId, classId, mode, enabled);
  const cumulativeAverage = useCumulativeAverage(periodId, classId, mode);

  const sessionDateById = useMemo(() => new Map(sessions.map(s => [s.id, s.date])), [sessions]);

  const schoolClass = classes.find(c => c.id === classId);
  const period = gradePeriods.find(p => p.id === periodId);
  const assignment = classId && currentYear ? getClassFiliereAssignment(classId, currentYear.id) : undefined;
  const filiereName = assignment ? filieres.find(f => f.id === assignment.filiereId)?.name : undefined;

  const classAverage = useMemo(() => {
    if (rankings.length === 0) return null;
    return rankings.reduce((sum, r) => sum + r.averageGeneral, 0) / rankings.length;
  }, [rankings]);

  const targetRankings = useMemo(
    () => (studentId ? rankings.filter(r => r.studentId === studentId) : rankings),
    [rankings, studentId],
  );
  const isBulk = !studentId;
  const yearLabel = currentYear?.name.match(/\d{4}\s*-\s*\d{4}/)?.[0] ?? currentYear?.name ?? '';

  return useMemo((): BulletinPdfData[] => {
    if (!enabled || !schoolClass || !period || !currentYear) return [];
    return targetRankings.flatMap((ranking): BulletinPdfData[] => {
      const student = students.find(s => s.id === ranking.studentId);
      if (!student) return [];
      // Pas de dates sur la période → pas de comptage possible, on affiche 0
      // partout plutôt que d'approximer sur l'année entière.
      const attendances = (!period.startDate && !period.endDate) ? [] : studentAttendances.filter(a => {
        if (a.studentId !== ranking.studentId) return false;
        const sessionDate = sessionDateById.get(a.sessionId);
        if (!sessionDate) return false;
        if (period.startDate && sessionDate < period.startDate) return false;
        if (period.endDate && sessionDate > period.endDate) return false;
        return true;
      });
      const absences = attendances.filter(a => a.status === 'absent');
      const cumulativeRow = cumulativeAverage?.rankings.find(r => r.studentId === ranking.studentId);
      const annualAverage = cumulativeAverage && cumulativeRow
        ? { label: cumulativeAverage.label, average: cumulativeRow.average, rank: cumulativeRow.rank, classSize: cumulativeAverage.rankings.length }
        : undefined;
      return [{
        school: { name: school?.name ?? 'École', phone: school?.phone, email: school?.email, logoUrl: school?.logo_url },
        yearLabel,
        periodName: period.name,
        niveau: schoolClass.niveau,
        className: schoolClass.name,
        filiereName,
        effectif: rankings.length,
        student: {
          firstName: student.firstName, lastName: student.lastName, studentId: student.studentId,
          sex: student.sex, dateOfBirth: student.dateOfBirth, placeOfBirth: student.placeOfBirth,
        },
        ranking,
        classRankings: rankings,
        classAverage,
        isExam: period.type === 'exam',
        absencesCount: absences.length,
        justifiedAbsencesCount: absences.filter(a => a.isJustified).length,
        retardsCount: attendances.filter(a => a.status === 'late').length,
        annualAverage,
        // Décision de passage : même règle qu'en élémentaire, au barème /20.
        // Elle n'est constatée QUE si elle est acquise — voir decisionPassage.ts.
        decisionPassage: decisionDePassage({
          niveau: schoolClass.niveau,
          estDernierePeriode: isLastPeriodOfYear && period.type === 'semester',
          moyenneAnnuelle: annualAverage?.average,
        }),
        observations: isBulk ? undefined : observations || undefined,
      }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, targetRankings, students, schoolClass, period, currentYear, filiereName, rankings.length, classAverage, isBulk, observations, school, yearLabel, studentAttendances, sessionDateById, cumulativeAverage, isLastPeriodOfYear]);
}
