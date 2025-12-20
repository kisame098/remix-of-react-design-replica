import { useState, useCallback } from 'react';
import { ScheduleEvent, ScheduleConflict } from '@/types/schedule';

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

export const useSchedule = () => {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);

  // Check for overlaps with a new/modified event
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

      const relevantEvents = events.filter(
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

      for (const existingEvent of relevantEvents) {
        // Hard constraint: Teacher cannot be in two places at once
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

        // Soft constraint: Class already has a course (need groups)
        if (
          newEvent.classId &&
          existingEvent.classId === newEvent.classId &&
          existingEvent.groupId === 'all' &&
          newEvent.groupId === 'all'
        ) {
          conflicts.push({
            type: 'class',
            severity: 'soft',
            message: `La classe a déjà un cours (${existingEvent.subjectName}) sur ce créneau. Voulez-vous diviser en groupes?`,
            existingEvent,
            newEvent,
          });
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
      const hardConflicts = conflicts.filter((c) => c.severity === 'hard');

      if (hardConflicts.length > 0) {
        return { success: false, conflicts: hardConflicts };
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
      const hardConflicts = conflicts.filter((c) => c.severity === 'hard');

      if (hardConflicts.length > 0) {
        return { success: false, conflicts: hardConflicts };
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

  // Get events for a specific class
  const getEventsByClass = useCallback(
    (classId: number, groupFilter?: string): ScheduleEvent[] => {
      return events.filter(
        (e) =>
          e.classId === classId &&
          (groupFilter === undefined ||
            groupFilter === 'all' ||
            e.groupId === groupFilter ||
            e.groupId === 'all')
      );
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

  // Apply group partition to overlapping class events
  const applyGroupPartition = useCallback(
    (existingEventId: string, newEventId: string, existingGroup: string, newGroup: string) => {
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id === existingEventId) {
            const group = GROUP_OPTIONS.find((g) => g.id === existingGroup);
            return { ...e, groupId: existingGroup, groupName: group?.name || existingGroup };
          }
          if (e.id === newEventId) {
            const group = GROUP_OPTIONS.find((g) => g.id === newGroup);
            return { ...e, groupId: newGroup, groupName: group?.name || newGroup };
          }
          return e;
        })
      );
    },
    []
  );

  return {
    events,
    addEvent,
    updateEvent,
    deleteEvent,
    checkOverlap,
    getEventsByClass,
    getEventsByTeacher,
    applyGroupPartition,
  };
};

const GROUP_OPTIONS = [
  { id: 'all', name: 'Classe Entière' },
  { id: 'group_a', name: 'Groupe A' },
  { id: 'group_b', name: 'Groupe B' },
  { id: 'group_c', name: 'Groupe C' },
];
