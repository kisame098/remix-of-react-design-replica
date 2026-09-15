import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { ScheduleEvent, ScheduleConflict } from '@/types/schedule';
import { findScheduleConflicts, validateTimeRange } from '@/lib/scheduleConflicts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { fetchAllRows } from '@/lib/fetchAllRows';

// ─── Helpers horaires ──────────────────────────────────────────────────────────
// Réexporté : la détection de conflits vit dans src/lib/scheduleConflicts.ts
// (fonction pure couverte par scheduleConflicts.test.ts).
export { validateTimeRange };

// ─── Mapper ligne DB → ScheduleEvent ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapRow = (r: any): ScheduleEvent => ({
  id:          r.id,
  dayIndex:    r.day_index,
  startTime:   r.start_time,
  endTime:     r.end_time,
  subjectId:   null,           // non utilisé côté schedule (subjectName suffit)
  subjectName: r.subject_name,
  classId:     r.class_id,    // UUID string
  className:   r.class_name,
  teacherId:   r.teacher_id   ?? null,
  teacherName: r.teacher_name ?? null,
  groupId:     r.group_id,
  groupName:   r.group_name,
  color:       r.color,
});

// ─── Interface du contexte ────────────────────────────────────────────────────

interface ScheduleContextType {
  events: ScheduleEvent[];
  scheduleLoading: boolean;

  addEvent:    (event: Omit<ScheduleEvent, 'id'>) => Promise<{ success: boolean; conflicts: ScheduleConflict[]; event?: ScheduleEvent }>;
  updateEvent: (eventId: string, updates: Omit<ScheduleEvent, 'id'>) => Promise<{ success: boolean; conflicts: ScheduleConflict[] }>;
  deleteEvent: (eventId: string) => Promise<void>;

  checkOverlap: (newEvent: Partial<ScheduleEvent>, excludeEventId?: string) => ScheduleConflict[];
  getEventsByClass:   (classId: string, groupFilter?: string) => ScheduleEvent[];
  getEventsByTeacher: (teacherId: string) => ScheduleEvent[];
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ScheduleProvider = ({ children }: { children: ReactNode }) => {
  const { school } = useAuth();
  const { currentYear } = useSchoolYear();

  const schoolId: string | null = school?.id ?? null;

  const [events, setEvents]               = useState<ScheduleEvent[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // ── Chargement Supabase ────────────────────────────────────────────────────
  // Recharge quand l'école ou l'année scolaire change.
  useEffect(() => {
    if (!schoolId || !currentYear) {
      setEvents([]);
      return;
    }

    let cancelled = false;
    setScheduleLoading(true);

    // fetchAllRows : un emploi du temps complet (toutes classes confondues)
    // dépasse vite 1000 lignes pour une grande école (limite PostgREST par
    // défaut, tronquée sans erreur avec un .select('*') direct).
    fetchAllRows('schedule_events', q => q
      .eq('school_id', schoolId)
      .eq('academic_year_label', currentYear.id)
      .order('day_index', { ascending: true })
      .order('start_time', { ascending: true }))
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setEvents(data.map(mapRow));
        setScheduleLoading(false);
      });

    return () => { cancelled = true; };
  }, [schoolId, currentYear?.id]);

  // ── Détection de conflits (V2 — logique groupe-aware) ────────────────────
  const checkOverlap = useCallback(
    (newEvent: Partial<ScheduleEvent>, excludeEventId?: string): ScheduleConflict[] =>
      findScheduleConflicts(events, newEvent, excludeEventId),
    [events]
  );

  // ── Ajout d'un créneau ────────────────────────────────────────────────────
  const addEvent = useCallback(async (
    eventData: Omit<ScheduleEvent, 'id'>
  ): Promise<{ success: boolean; conflicts: ScheduleConflict[]; event?: ScheduleEvent }> => {
    if (!schoolId || !currentYear) {
      return { success: false, conflicts: [] };
    }

    // Vérification locale des conflits avant l'INSERT
    const conflicts = checkOverlap(eventData);
    if (conflicts.length > 0) return { success: false, conflicts };

    const { data: row, error } = await supabase
      .from('schedule_events')
      .insert({
        school_id:           schoolId,
        academic_year_label: currentYear.id,
        day_index:    eventData.dayIndex,
        start_time:   eventData.startTime,
        end_time:     eventData.endTime,
        subject_name: eventData.subjectName,
        class_id:     eventData.classId,
        class_name:   eventData.className,
        teacher_id:   eventData.teacherId   ?? null,
        teacher_name: eventData.teacherName ?? null,
        group_id:     eventData.groupId,
        group_name:   eventData.groupName,
        color:        eventData.color,
      })
      .select()
      .single();

    if (error) return { success: false, conflicts: [] };

    const newEvent = mapRow(row);
    setEvents(prev => [...prev, newEvent]);
    return { success: true, conflicts: [], event: newEvent };
  }, [schoolId, currentYear, checkOverlap]);

  // ── Mise à jour d'un créneau ──────────────────────────────────────────────
  const updateEvent = useCallback(async (
    eventId: string,
    updates: Omit<ScheduleEvent, 'id'>
  ): Promise<{ success: boolean; conflicts: ScheduleConflict[] }> => {
    if (!schoolId) return { success: false, conflicts: [] };

    const conflicts = checkOverlap({ ...updates, id: eventId }, eventId);
    if (conflicts.length > 0) return { success: false, conflicts };

    const { data: row, error } = await supabase
      .from('schedule_events')
      .update({
        day_index:    updates.dayIndex,
        start_time:   updates.startTime,
        end_time:     updates.endTime,
        subject_name: updates.subjectName,
        class_id:     updates.classId,
        class_name:   updates.className,
        teacher_id:   updates.teacherId   ?? null,
        teacher_name: updates.teacherName ?? null,
        group_id:     updates.groupId,
        group_name:   updates.groupName,
        color:        updates.color,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', eventId)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error) return { success: false, conflicts: [] };

    const updated = mapRow(row);
    setEvents(prev => prev.map(e => e.id === eventId ? updated : e));
    return { success: true, conflicts: [] };
  }, [schoolId, checkOverlap]);

  // ── Suppression d'un créneau ──────────────────────────────────────────────
  const deleteEvent = useCallback(async (eventId: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase
      .from('schedule_events')
      .delete()
      .eq('id', eventId)
      .eq('school_id', schoolId);
    if (!error) setEvents(prev => prev.filter(e => e.id !== eventId));
  }, [schoolId]);

  // ── Filtres ────────────────────────────────────────────────────────────────

  /** Retourne les créneaux d'une classe avec filtrage groupe-aware. */
  const getEventsByClass = useCallback(
    (classId: string, groupFilter?: string): ScheduleEvent[] => {
      return events.filter(e => {
        if (e.classId !== classId) return false;
        if (groupFilter === undefined) return true;
        if (groupFilter === 'all') return e.groupId === 'all';
        return e.groupId === 'all' || e.groupId === groupFilter;
      });
    },
    [events]
  );

  /** Retourne tous les créneaux d'un professeur. */
  const getEventsByTeacher = useCallback(
    (teacherId: string): ScheduleEvent[] =>
      events.filter(e => e.teacherId === teacherId),
    [events]
  );

  return (
    <ScheduleContext.Provider value={{
      events,
      scheduleLoading,
      addEvent,
      updateEvent,
      deleteEvent,
      checkOverlap,
      getEventsByClass,
      getEventsByTeacher,
    }}>
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error('useSchedule must be used within a ScheduleProvider');
  return ctx;
};
