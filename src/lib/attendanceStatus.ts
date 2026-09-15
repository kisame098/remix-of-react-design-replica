// ═══════════════════════════════════════════════════════════════════════════
// ÉTAT DE SAISIE D'UNE SÉANCE — la pastille de couleur du calendrier des
// présences. Elle dit au surveillant ce qu'il lui reste à faire :
//
//   not_entered → rien saisi (gris)
//   partial     → saisie commencée mais pas validée des deux côtés (orange)
//   incident    → une absence, un retard ou un renvoi à traiter (rouge)
//   complete    → tout le monde présent et tout validé (vert)
//
// « incident » l'emporte sur « partial » : un problème à traiter doit se voir,
// même si la saisie n'est pas terminée. Et une séance non pointée côté prof ne
// peut jamais être « complete » — c'est elle qui conditionne sa paie.
//
// Fonction pure extraite d'AttendanceContext (attendanceStatus.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

import type { AttendanceSession, StudentAttendance, TeacherAttendance } from '@/types/attendance';

export type SessionEntryStatus = 'not_entered' | 'complete' | 'incident' | 'partial';

export const getSessionEntryStatus = (
  session: AttendanceSession | undefined,
  studentAttendances: StudentAttendance[],
  teacherAttendance: TeacherAttendance | undefined,
): SessionEntryStatus => {
  if (!session) return 'not_entered';

  const teacherUnset = !teacherAttendance || teacherAttendance.status === 'undefined';
  if (studentAttendances.length === 0 && teacherUnset) return 'not_entered';

  const hasStudentIncident = studentAttendances.some(a => a.status !== 'present');
  const hasTeacherIncident = !!teacherAttendance
    && teacherAttendance.status !== 'present'
    && teacherAttendance.status !== 'undefined';

  if (hasStudentIncident || hasTeacherIncident) return 'incident';
  if (!session.studentAttendanceComplete || !session.teacherAttendanceComplete) return 'partial';
  return 'complete';
};
