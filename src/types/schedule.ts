// Types for Schedule/Timetable Management

export interface ScheduleEvent {
  id: string;
  dayIndex: number; // 0 = Lundi, 1 = Mardi, ..., 5 = Samedi
  startTime: string; // Format "HH:MM"
  endTime: string; // Format "HH:MM"
  subjectId: number | null;
  subjectName: string;
  classId: number;
  className: string;
  teacherId: number | null;
  teacherName: string | null;
  groupId: string; // "all" | "group_a" | "group_b" | etc.
  groupName: string; // "Classe Entière" | "Groupe A" | etc.
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

export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { start: '07:00', end: '08:00', label: '07:00 - 08:00' },
  { start: '08:00', end: '09:00', label: '08:00 - 09:00' },
  { start: '09:00', end: '10:00', label: '09:00 - 10:00' },
  { start: '10:00', end: '11:00', label: '10:00 - 11:00' },
  { start: '11:00', end: '12:00', label: '11:00 - 12:00' },
  { start: '12:00', end: '13:00', label: '12:00 - 13:00' },
  { start: '13:00', end: '14:00', label: '13:00 - 14:00' },
  { start: '14:00', end: '15:00', label: '14:00 - 15:00' },
  { start: '15:00', end: '16:00', label: '15:00 - 16:00' },
  { start: '16:00', end: '17:00', label: '16:00 - 17:00' },
  { start: '17:00', end: '18:00', label: '17:00 - 18:00' },
];

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
