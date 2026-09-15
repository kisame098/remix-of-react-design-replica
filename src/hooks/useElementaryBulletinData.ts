import { useMemo } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAttendance } from '@/contexts/AttendanceContext';
import { useElementaryClassRanking, useElementaryCumulativeAverage } from '@/hooks/useElementaryClassRanking';
import { ElementaryBulletinPdfData, ElementaryBulletinLine } from '@/lib/elementaryBulletinPdf';
import { decisionDePassage } from '@/lib/decisionPassage';

// La règle vit dans src/lib/decisionPassage.ts, partagée avec le collège et
// couverte par decisionPassage.test.ts : admis à partir de 5/10, redouble en
// dessous. Elle a remplacé un « Passage de droit » qui s'affichait aux niveaux
// intermédiaires SANS REGARDER LES NOTES.
export const computeDecisionPassage = (
  niveau: string | undefined, isFinalPeriod: boolean, annualAverage: number | undefined,
): string | undefined =>
  decisionDePassage({ niveau, estDernierePeriode: isFinalPeriod, moyenneAnnuelle: annualAverage });

/**
 * Assemble les données de bulletin élémentaire — miroir de useBulletinDataList
 * mais pour le système à barème de points (pas de coefficients/matières).
 *
 * `isLastPeriodOfYear` est un choix EXPLICITE de la personne qui génère le
 * bulletin (case à cocher dans ElementaryBulletinModal) — jamais déduit
 * automatiquement de "c'est la dernière période qui existe aujourd'hui dans
 * la base". Déduire automatiquement rendrait une décision de passage
 * définitive ("Admis en classe supérieure" / "Redouble") sur le bulletin du 1er semestre
 * tant que le 2e n'a pas encore été créé, ce qui est faux : la période
 * courante N'EST PAS forcément la dernière de l'année, juste la dernière
 * créée jusqu'ici. La détection "cette classe a-t-elle déjà fait une période
 * précédente" (pour la moyenne cumulée) reste, elle, automatique — voir
 * useElementaryCumulativeAverage — puisqu'elle porte sur des périodes qui
 * existent réellement, pas sur une hypothèse de fin d'année.
 */
export function useElementaryBulletinDataList(
  periodId: string | undefined,
  classId: string | undefined,
  isLastPeriodOfYear: boolean,
  enabled = true,
  studentId?: string,
  observations?: string,
): ElementaryBulletinPdfData[] {
  const { classes, gradePeriods, students, elementaryClassLines, elementaryGrades, elementaryLineSettings } = useSchool();
  const { currentYear } = useSchoolYear();
  const { school } = useAuth();
  const { studentAttendances, sessions } = useAttendance();
  const rankings = useElementaryClassRanking(classId, periodId, enabled);
  const cumulativeAverage = useElementaryCumulativeAverage(periodId, classId);

  const sessionDateById = useMemo(() => new Map(sessions.map(s => [s.id, s.date])), [sessions]);

  const schoolClass = classes.find(c => c.id === classId);
  const period = gradePeriods.find(p => p.id === periodId);

  const lines = useMemo(
    () => elementaryClassLines
      .filter(l => l.classId === classId && l.periodId === periodId)
      .sort((a, b) => (a.registre === b.registre ? a.ordering - b.ordering : a.registre === 'COMPETENCE' ? -1 : 1)),
    [elementaryClassLines, classId, periodId]
  );

  const targetRankings = useMemo(
    () => (studentId ? rankings.filter(r => r.studentId === studentId) : rankings),
    [rankings, studentId],
  );
  const isBulk = !studentId;
  const yearLabel = currentYear?.name.match(/\d{4}\s*-\s*\d{4}/)?.[0] ?? currentYear?.name ?? '';

  return useMemo((): ElementaryBulletinPdfData[] => {
    if (!enabled || !schoolClass || !period || !currentYear) return [];
    return targetRankings.flatMap((ranking): ElementaryBulletinPdfData[] => {
      const student = students.find(s => s.id === ranking.studentId);
      if (!student) return [];

      const attendances = (!period.startDate && !period.endDate) ? [] : studentAttendances.filter(a => {
        if (a.studentId !== ranking.studentId) return false;
        const sessionDate = sessionDateById.get(a.sessionId);
        if (!sessionDate) return false;
        if (period.startDate && sessionDate < period.startDate) return false;
        if (period.endDate && sessionDate > period.endDate) return false;
        return true;
      });
      const absences = attendances.filter(a => a.status === 'absent');

      // cumulativeAverage est null si cette classe n'a AUCUNE période antérieure
      // réelle pour cette période/année — dans ce cas c'est son tout premier
      // bulletin, un bulletin "classique" sans moyenne cumulée ni annuelle, peu
      // importe la case "dernière période" (rien à cumuler). Sinon, le libellé
      // ("Moyenne cumulée" vs "Moyenne Annuelle") suit la case cochée, jamais
      // la détection interne du hook.
      const cumulativeRow = cumulativeAverage?.rankings.find(r => r.studentId === ranking.studentId);
      const annualAverage = cumulativeAverage && cumulativeRow
        ? {
            label: isLastPeriodOfYear ? 'Moyenne Annuelle' : 'Moyenne cumulée',
            average: cumulativeRow.average, rank: cumulativeRow.rank, classSize: cumulativeAverage.rankings.length,
          }
        : undefined;

      // Une discipline dont CET élève est dispensé (ex: inapte EPS) ne figure
      // pas sur son bulletin : sinon ses sous-totaux contrediraient la moyenne,
      // qui l'exclut déjà (voir computeElementaryClassRanking).
      const exemptedLineIds = new Set(
        elementaryLineSettings
          .filter(s => !s.active && s.studentEnrollmentId === student.id)
          .map(s => s.lineId),
      );

      const bulletinLines: ElementaryBulletinLine[] = lines
        .filter(line => !exemptedLineIds.has(line.id))
        .map(line => {
          const grade = elementaryGrades.find(g => g.studentEnrollmentId === student.id && g.lineId === line.id);
          return {
            name: line.name, domaine: line.domaine, registre: line.registre,
            pointMax: line.pointMax, pointsObtenus: grade?.pointsObtenus,
          };
        });
      const sumFor = (registre: 'COMPETENCE' | 'RESSOURCES') => {
        const rows = bulletinLines.filter(l => l.registre === registre);
        return {
          obtenus: rows.reduce((s, l) => s + (l.pointsObtenus ?? 0), 0),
          max: rows.reduce((s, l) => s + l.pointMax, 0),
        };
      };

      const decisionPassage = computeDecisionPassage(schoolClass.niveau, isLastPeriodOfYear, annualAverage?.average);

      return [{
        school: { name: school?.name ?? 'École', phone: school?.phone, email: school?.email, logoUrl: school?.logo_url },
        yearLabel,
        periodName: period.name,
        niveau: schoolClass.niveau ?? '',
        className: schoolClass.name,
        effectif: rankings.length,
        student: {
          firstName: student.firstName, lastName: student.lastName, studentId: student.studentId,
          sex: student.sex, dateOfBirth: student.dateOfBirth, placeOfBirth: student.placeOfBirth,
        },
        ranking,
        lines: bulletinLines,
        competenceTotal: sumFor('COMPETENCE'),
        ressourcesTotal: sumFor('RESSOURCES'),
        absencesCount: absences.length,
        justifiedAbsencesCount: absences.filter(a => a.isJustified).length,
        retardsCount: attendances.filter(a => a.status === 'late').length,
        annualAverage,
        decisionPassage,
        observations: isBulk ? undefined : observations || undefined,
      }];
    });
  }, [enabled, targetRankings, students, schoolClass, period, currentYear, rankings.length, isBulk, observations, school, yearLabel, studentAttendances, sessionDateById, cumulativeAverage, lines, elementaryGrades, elementaryLineSettings, isLastPeriodOfYear]);
}
