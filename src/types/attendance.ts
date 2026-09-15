// Types pour la gestion des présences

// === ÉLÈVES : Logique Optimiste (Défaut = PRESENT) ===
export type StudentAttendanceStatus = 'present' | 'absent' | 'late' | 'expelled';

export interface StudentAttendance {
  id: string;
  sessionId: string;  // Lié au ScheduleEvent
  studentId: string;  // UUID → student_enrollments.id  (était number — CORRIGÉ)
  status: StudentAttendanceStatus; // Défaut: 'present'
  justification?: string;
  isJustified: boolean;
  recordedAt: Date;
  recordedBy?: string;
}

// === PROFESSEURS : Logique Pessimiste (Défaut = UNDEFINED) ===
export type TeacherAttendanceStatus = 'undefined' | 'present' | 'absent' | 'late' | 'incomplete';

export interface TeacherAttendance {
  id: string;
  sessionId: string; // Lié au ScheduleEvent
  teacherId: string; // UUID → teacher_enrollments.id (Teacher.id)
  status: TeacherAttendanceStatus; // Défaut: 'undefined' (sécurité financière)
  effectiveMinutes: number; // Durée effective pour la paie
  theoreticalMinutes: number; // Durée théorique du créneau
  justification?: string;
  recordedAt: Date;
  recordedBy?: string;
  isLocked: boolean; // Verrouillé après clôture de paie
}

// === SESSION DE COURS (Extension du ScheduleEvent) ===
export interface AttendanceSession {
  id: string;
  scheduleEventId: string;
  date: string; // Format YYYY-MM-DD
  dayIndex: number;
  startTime: string;
  endTime: string;
  classId: string;   // UUID → classes.id  (était number — CORRIGÉ)
  className: string;
  teacherId: string | null; // UUID → teacher_enrollments.id (Teacher.id)
  teacherName: string | null;
  subjectName: string;
  groupId: string;
  groupName: string;
  // État de saisie
  studentAttendanceComplete: boolean;
  teacherAttendanceComplete: boolean;
}

// === RÉSUMÉ MENSUEL PROF ===
export interface TeacherMonthlyHours {
  teacherId: string; // UUID → teacher_enrollments.id (Teacher.id)
  teacherName: string;
  month: number; // 1-12
  year: number;
  totalTheoreticalMinutes: number;
  totalEffectiveMinutes: number;
  totalSessions: number;
  validatedSessions: number;
  undefinedSessions: number; // Sessions non saisies (alerte)
  absentSessions: number;
}

// === CONSTANTES ===
export const STUDENT_STATUS_LABELS: Record<StudentAttendanceStatus, string> = {
  present: 'Présent',
  absent: 'Absent',
  late: 'Retard',
  expelled: 'Renvoyé',
};

export const TEACHER_STATUS_LABELS: Record<TeacherAttendanceStatus, string> = {
  undefined: 'Non saisi',
  present: 'Présent',
  absent: 'Absent',
  late: 'Retard',
  incomplete: 'Cours incomplet',
};

export const STUDENT_STATUS_COLORS: Record<StudentAttendanceStatus, string> = {
  present: 'bg-green-100 text-green-800 border-green-200',
  absent: 'bg-red-100 text-red-800 border-red-200',
  late: 'bg-amber-100 text-amber-800 border-amber-200',
  expelled: 'bg-purple-100 text-purple-800 border-purple-200',
};

export const TEACHER_STATUS_COLORS: Record<TeacherAttendanceStatus, string> = {
  undefined: 'bg-gray-100 text-gray-600 border-gray-200',
  present: 'bg-green-100 text-green-800 border-green-200',
  absent: 'bg-red-100 text-red-800 border-red-200',
  late: 'bg-amber-100 text-amber-800 border-amber-200',
  incomplete: 'bg-orange-100 text-orange-800 border-orange-200',
};

// Couleurs pour la vue calendrier
export const SESSION_ENTRY_STATUS = {
  not_entered: { label: 'Non saisi', color: 'bg-gray-300', textColor: 'text-gray-600' },
  complete: { label: 'Complet', color: 'bg-green-500', textColor: 'text-white' },
  incident: { label: 'Incident', color: 'bg-red-500', textColor: 'text-white' },
  partial: { label: 'Partiel', color: 'bg-amber-500', textColor: 'text-white' },
};
