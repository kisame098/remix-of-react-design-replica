import { useState, useCallback } from 'react';
import { ScheduleEvent, ScheduleConflict, GROUP_OPTIONS } from '@/types/schedule';

// Helper to parse time string to minutes
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Check if two time ranges intersect
const doTimesIntersect = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
};

// Validate that endTime is after startTime
export const validateTimeRange = (startTime: string, endTime: string): boolean => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return end > start;
};

export const useSchedule = () => {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);

  // STRICT CONSTRAINT VALIDATION (V2 Algorithm)
  const checkOverlap = useCallback(
    (
      newEvent: Partial<ScheduleEvent>,
      excludeEventId?: string
    ): ScheduleConflict[] => {
      const conflicts: ScheduleConflict[] = [];

      if (
        newEvent.dayIndex === undefined ||
        !newEvent.startTime ||
        !newEvent.endTime
      ) {
        return conflicts;
      }

      // Time validation: end must be after start
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

      // Get all events on the same day that intersect with the new time slot
      const overlappingEvents = events.filter(
        (e) =>
          e.id !== excludeEventId &&
          e.dayIndex === newEvent.dayIndex &&
          doTimesIntersect(
            e.startTime,
            e.endTime,
            newEvent.startTime!,
            newEvent.endTime!
          )
      );

      for (const existingEvent of overlappingEvents) {
        // RULE A: Teacher constraint (HARD - always blocking)
        // A teacher cannot be in two places at once
        if (
          newEvent.teacherId &&
          existingEvent.teacherId === newEvent.teacherId
        ) {
          conflicts.push({
            type: 'teacher',
            severity: 'hard',
            message: `Le professeur est déjà assigné à un autre cours (${existingEvent.subjectName} - ${existingEvent.className}) à cette heure.`,
            existingEvent,
            newEvent,
          });
        }

        // RULE B: Class constraint (STRICT logic based on Scope/Group)
        if (
          newEvent.classId &&
          existingEvent.classId === newEvent.classId
        ) {
          const newScope = newEvent.groupId;
          const existingScope = existingEvent.groupId;

          // Case 1: New event is "Classe Entière" (universal)
          // Cannot overlap with ANY existing event (universal or group-specific)
          if (newScope === 'all') {
            conflicts.push({
              type: 'class',
              severity: 'hard',
              message: `Un cours "Classe Entière" ne peut pas chevaucher un cours existant (${existingEvent.subjectName} - ${existingEvent.groupName}).`,
              existingEvent,
              newEvent,
            });
          }
          // Case 2: New event is for a specific group
          else {
            // Cannot overlap with universal events
            if (existingScope === 'all') {
              conflicts.push({
                type: 'class',
                severity: 'hard',
                message: `Le Groupe "${GROUP_OPTIONS.find(g => g.id === newScope)?.name}" ne peut pas avoir cours pendant un cours "Classe Entière" (${existingEvent.subjectName}).`,
                existingEvent,
                newEvent,
              });
            }
            // Cannot overlap with the SAME group's events
            else if (existingScope === newScope) {
              conflicts.push({
                type: 'class',
                severity: 'hard',
                message: `Le ${GROUP_OPTIONS.find(g => g.id === newScope)?.name} a déjà un cours (${existingEvent.subjectName}) sur ce créneau.`,
                existingEvent,
                newEvent,
              });
            }
            // ALLOWED: Different groups can overlap (Group A and Group B simultaneously)
            // No conflict added here
          }
        }
      }

      return conflicts;
    },
    [events]
  );

  // Add a new event
  const addEvent = useCallback(
    (event: Omit<ScheduleEvent, 'id'>): { success: boolean; conflicts: ScheduleConflict[]; event?: ScheduleEvent } => {
      const newId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newEvent: ScheduleEvent = { ...event, id: newId };

      const conflicts = checkOverlap(newEvent);
      
      // ALL conflicts are now blocking (hard)
      if (conflicts.length > 0) {
        return { success: false, conflicts };
      }

      setEvents((prev) => [...prev, newEvent]);
      return { success: true, conflicts: [], event: newEvent };
    },
    [checkOverlap]
  );

  // Update an existing event
  const updateEvent = useCallback(
    (eventId: string, updates: Partial<ScheduleEvent>): { success: boolean; conflicts: ScheduleConflict[] } => {
      const existingEvent = events.find((e) => e.id === eventId);
      if (!existingEvent) {
        return { success: false, conflicts: [] };
      }

      const updatedEvent = { ...existingEvent, ...updates };
      const conflicts = checkOverlap(updatedEvent, eventId);

      // ALL conflicts are now blocking (hard)
      if (conflicts.length > 0) {
        return { success: false, conflicts };
      }

      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? updatedEvent : e))
      );
      return { success: true, conflicts: [] };
    },
    [events, checkOverlap]
  );

  // Delete an event
  const deleteEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  }, []);

  // Get events for a specific class with STRICT group filtering
  const getEventsByClass = useCallback(
    (classId: number, groupFilter?: string): ScheduleEvent[] => {
      return events.filter((e) => {
        if (e.classId !== classId) return false;
        
        // No filter or undefined: show all events for this class
        if (groupFilter === undefined) {
          return true;
        }
        
        // "Classe Entière" filter: show ONLY universal events (scope = 'all')
        if (groupFilter === 'all') {
          return e.groupId === 'all';
        }
        
        // Specific group filter: show universal events + that group's events
        // EDT_A = E_univ ∪ E_GA
        return e.groupId === 'all' || e.groupId === groupFilter;
      });
    },
    [events]
  );

  // Get events for a specific teacher
  const getEventsByTeacher = useCallback(
    (teacherId: number): ScheduleEvent[] => {
      return events.filter((e) => e.teacherId === teacherId);
    },
    [events]
  );

  return {
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    checkOverlap,
    getEventsByClass,
    getEventsByTeacher,
  };
};
