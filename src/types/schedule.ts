// Types for Schedule/Timetable Management

export interface ScheduleEvent {
  id: string;          // UUID → schedule_events.id
  dayIndex: number;    // 0 = Lundi, 1 = Mardi, ..., 5 = Samedi
  startTime: string;   // Format "HH:MM"
  endTime: string;     // Format "HH:MM"
  subjectId: string | null;  // UUID → subjects.id (optionnel)
  subjectName: string;
  classId: string;     // UUID → classes.id  (était number — CORRIGÉ)
  className: string;
  teacherId: string | null;  // UUID → teacher_enrollments.id
  teacherName: string | null;
  groupId: string;     // "all" | "group_a" | "group_b" | "group_c"
  groupName: string;   // "Classe Entière" | "Groupe A" | etc.
  color: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

export interface ScheduleConflict {
  type: 'teacher' | 'class';
  severity: 'hard' | 'soft';
  message: string;
  existingEvent: ScheduleEvent;
  newEvent: Partial<ScheduleEvent>;
}

export type ViewMode = 'class' | 'teacher';

export const DAYS = [
  { index: 0, name: 'Lundi', short: 'Lun' },
  { index: 1, name: 'Mardi', short: 'Mar' },
  { index: 2, name: 'Mercredi', short: 'Mer' },
  { index: 3, name: 'Jeudi', short: 'Jeu' },
  { index: 4, name: 'Vendredi', short: 'Ven' },
  { index: 5, name: 'Samedi', short: 'Sam' },
];

export const DEFAULT_MIN_HOUR = '07:00';
export const DEFAULT_MAX_HOUR = '18:00';

/** Génère les créneaux d'une heure entre minHour et maxHour (Paramètres > Emploi du temps). */
export const generateTimeSlots = (
  minHour: string = DEFAULT_MIN_HOUR,
  maxHour: string = DEFAULT_MAX_HOUR,
): TimeSlot[] => {
  const [minH] = minHour.split(':').map(Number);
  const [maxH] = maxHour.split(':').map(Number);
  if (Number.isNaN(minH) || Number.isNaN(maxH) || maxH <= minH) {
    return generateTimeSlots(DEFAULT_MIN_HOUR, DEFAULT_MAX_HOUR);
  }
  const slots: TimeSlot[] = [];
  for (let h = minH; h < maxH; h++) {
    const start = `${String(h).padStart(2, '0')}:00`;
    const end   = `${String(h + 1).padStart(2, '0')}:00`;
    slots.push({ start, end, label: `${start} - ${end}` });
  }
  return slots;
};

export const GROUP_OPTIONS = [
  { id: 'all', name: 'Classe Entière' },
  { id: 'group_a', name: 'Groupe A' },
  { id: 'group_b', name: 'Groupe B' },
  { id: 'group_c', name: 'Groupe C' },
];

export const EVENT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];
