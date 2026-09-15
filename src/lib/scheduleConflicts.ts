// ═══════════════════════════════════════════════════════════════════════════
// CONFLITS D'EMPLOI DU TEMPS — un prof placé sur deux cours simultanés, ou une
// classe qui a cours deux fois à la même heure, désorganise une journée réelle
// et fausse ensuite les présences et la paie horaire.
//
// Règles (toutes bloquantes) :
//   A. Un professeur ne peut pas être sur deux cours qui se chevauchent.
//   B. Dans une même classe : « Classe Entière » exclut tout autre cours ; deux
//      groupes DIFFÉRENTS peuvent en revanche travailler en parallèle (c'est
//      exactement l'intérêt des groupes).
//
// Fonction pure extraite de ScheduleContext pour être testable
// (scheduleConflicts.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

import { ScheduleEvent, ScheduleConflict, GROUP_OPTIONS } from '@/types/schedule';

export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = (time ?? '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
};

/** Deux créneaux se touchent-ils ? Bout à bout (10h-11h / 11h-12h) = non. */
export const doTimesIntersect = (s1: string, e1: string, s2: string, e2: string): boolean => {
  const a = timeToMinutes(s1), b = timeToMinutes(e1);
  const c = timeToMinutes(s2), d = timeToMinutes(e2);
  return a < d && c < b;
};

export const validateTimeRange = (startTime: string, endTime: string): boolean =>
  timeToMinutes(endTime) > timeToMinutes(startTime);

export const findScheduleConflicts = (
  events: ScheduleEvent[],
  newEvent: Partial<ScheduleEvent>,
  excludeEventId?: string,
): ScheduleConflict[] => {
  const conflicts: ScheduleConflict[] = [];

  if (newEvent.dayIndex === undefined || !newEvent.startTime || !newEvent.endTime) {
    return conflicts;
  }

  if (!validateTimeRange(newEvent.startTime, newEvent.endTime)) {
    conflicts.push({
      type: 'class',
      severity: 'hard',
      message: `L'heure de fin (${newEvent.endTime}) doit être après l'heure de début (${newEvent.startTime}).`,
      existingEvent: {} as ScheduleEvent,
      newEvent,
    });
    return conflicts;
  }

  const overlapping = events.filter(
    e =>
      e.id !== excludeEventId &&
      e.dayIndex === newEvent.dayIndex &&
      doTimesIntersect(e.startTime, e.endTime, newEvent.startTime!, newEvent.endTime!)
  );

  for (const existing of overlapping) {
    // RÈGLE A : conflit professeur (toujours bloquant)
    if (newEvent.teacherId && existing.teacherId === newEvent.teacherId) {
      conflicts.push({
        type: 'teacher',
        severity: 'hard',
        message: `Le professeur est déjà assigné à un autre cours (${existing.subjectName} — ${existing.className}) à cette heure.`,
        existingEvent: existing,
        newEvent,
      });
    }

    // RÈGLE B : conflit classe (logique scope/groupe stricte)
    if (newEvent.classId && existing.classId === newEvent.classId) {
      const newScope      = newEvent.groupId;
      const existingScope = existing.groupId;

      if (newScope === 'all') {
        conflicts.push({
          type: 'class',
          severity: 'hard',
          message: `Un cours "Classe Entière" ne peut pas chevaucher un cours existant (${existing.subjectName} — ${existing.groupName}).`,
          existingEvent: existing,
          newEvent,
        });
      } else if (existingScope === 'all') {
        conflicts.push({
          type: 'class',
          severity: 'hard',
          message: `Le Groupe "${GROUP_OPTIONS.find(g => g.id === newScope)?.name}" ne peut pas avoir cours pendant un cours "Classe Entière" (${existing.subjectName}).`,
          existingEvent: existing,
          newEvent,
        });
      } else if (existingScope === newScope) {
        conflicts.push({
          type: 'class',
          severity: 'hard',
          message: `Le ${GROUP_OPTIONS.find(g => g.id === newScope)?.name} a déjà un cours (${existing.subjectName}) sur ce créneau.`,
          existingEvent: existing,
          newEvent,
        });
      }
    }
  }

  return conflicts;
};
