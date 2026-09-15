// ═══════════════════════════════════════════════════════════════════════════
// HEURES MENSUELLES D'UN PROFESSEUR — base de calcul du salaire d'un prof payé
// à l'heure (owed = heures effectives × taux horaire, PayrollOverview).
//
// Règle de sécurité financière : une séance dont la présence n'a PAS été
// validée ne rapporte AUCUNE minute. On ne paie que ce qui a été constaté —
// jamais l'horaire théorique par défaut.
//
// Fonction pure, extraite d'AttendanceContext pour être testable
// (teacherHours.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { AttendanceSession, TeacherAttendance, TeacherMonthlyHours } from '@/types/attendance';

/** "08:30" → 510. Une heure illisible vaut 0 minute, jamais NaN. */
export const timeToMinutes = (t: string): number => {
  const [h, m] = (t ?? '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
};

/** Durée d'un créneau en minutes ; jamais négative (fin avant début = 0). */
export const calcDuration = (start: string, end: string): number =>
  Math.max(0, timeToMinutes(end) - timeToMinutes(start));

export const computeMonthlyHours = (
  teacherId: string,
  month: number,          // 1-12
  year: number,
  teacherName: string,
  sessions: AttendanceSession[],
  teacherAttendances: TeacherAttendance[],
): TeacherMonthlyHours => {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const monthSessions = sessions.filter(s => s.teacherId === teacherId && s.date.startsWith(monthStr));

  let totalTheo = 0, totalEff = 0, validated = 0, undef = 0, absent = 0;

  for (const s of monthSessions) {
    totalTheo += calcDuration(s.startTime, s.endTime);
    const att = teacherAttendances.find(a => a.sessionId === s.id && a.teacherId === teacherId);
    if (!att || att.status === 'undefined') {
      undef++;                       // non constaté → 0 minute payée
    } else if (att.status === 'absent') {
      absent++;
    } else {
      validated++;
      totalEff += att.effectiveMinutes;
    }
  }

  return {
    teacherId, teacherName, month, year,
    totalTheoreticalMinutes: totalTheo,
    totalEffectiveMinutes: totalEff,
    totalSessions: monthSessions.length,
    validatedSessions: validated,
    undefinedSessions: undef,
    absentSessions: absent,
  };
};
