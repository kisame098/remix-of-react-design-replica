import { useState, useCallback, useMemo } from 'react';
import {
  StudentAttendance,
  TeacherAttendance,
  AttendanceSession,
  StudentAttendanceStatus,
  TeacherAttendanceStatus,
  TeacherMonthlyHours,
} from '@/types/attendance';
import { ScheduleEvent } from '@/types/schedule';

// Helper: convertit time string en minutes
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper: calcule la durée en minutes
const calculateDuration = (startTime: string, endTime: string): number => {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
};

// Helper: génère un ID unique
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useAttendance = () => {
  const [studentAttendances, setStudentAttendances] = useState<StudentAttendance[]>([]);
  const [teacherAttendances, setTeacherAttendances] = useState<TeacherAttendance[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [lockedMonths, setLockedMonths] = useState<string[]>([]); // Format: "YYYY-MM"

  // === GESTION DES SESSIONS ===

  // Créer une session à partir d'un événement de l'emploi du temps + date
  const createSession = useCallback(
    (event: ScheduleEvent, date: string): AttendanceSession => {
      const sessionId = `${event.id}-${date}`;
      
      const existingSession = sessions.find(s => s.id === sessionId);
      if (existingSession) {
        return existingSession;
      }

      const newSession: AttendanceSession = {
        id: sessionId,
        scheduleEventId: event.id,
        date,
        dayIndex: event.dayIndex,
        startTime: event.startTime,
        endTime: event.endTime,
        classId: event.classId,
        className: event.className,
        teacherId: event.teacherId,
        teacherName: event.teacherName,
        subjectName: event.subjectName,
        groupId: event.groupId,
        groupName: event.groupName,
        studentAttendanceComplete: false,
        teacherAttendanceComplete: false,
      };

      setSessions(prev => [...prev, newSession]);
      return newSession;
    },
    [sessions]
  );

  // Obtenir ou créer une session
  const getOrCreateSession = useCallback(
    (event: ScheduleEvent, date: string): AttendanceSession => {
      const sessionId = `${event.id}-${date}`;
      const existing = sessions.find(s => s.id === sessionId);
      if (existing) return existing;
      return createSession(event, date);
    },
    [sessions, createSession]
  );

  // === PRÉSENCE ÉLÈVES (Logique Optimiste) ===

  // Initialiser les présences élèves pour une session (tous présents par défaut)
  const initializeStudentAttendances = useCallback(
    (sessionId: string, studentIds: number[]): StudentAttendance[] => {
      const existingForSession = studentAttendances.filter(a => a.sessionId === sessionId);
      
      const newAttendances: StudentAttendance[] = [];
      
      studentIds.forEach(studentId => {
        const existing = existingForSession.find(a => a.studentId === studentId);
        if (!existing) {
          newAttendances.push({
            id: generateId(),
            sessionId,
            studentId,
            status: 'present', // LOGIQUE OPTIMISTE: défaut présent
            isJustified: false,
            recordedAt: new Date(),
          });
        }
      });

      if (newAttendances.length > 0) {
        setStudentAttendances(prev => [...prev, ...newAttendances]);
      }

      return [...existingForSession, ...newAttendances];
    },
    [studentAttendances]
  );

  // Mettre à jour le statut d'un élève
  const updateStudentAttendance = useCallback(
    (
      sessionId: string,
      studentId: number,
      status: StudentAttendanceStatus,
      justification?: string,
      isJustified?: boolean
    ) => {
      setStudentAttendances(prev =>
        prev.map(a =>
          a.sessionId === sessionId && a.studentId === studentId
            ? {
                ...a,
                status,
                justification: justification ?? a.justification,
                isJustified: isJustified ?? a.isJustified,
                recordedAt: new Date(),
              }
            : a
        )
      );
    },
    []
  );

  // Obtenir les présences d'une session
  const getStudentAttendancesBySession = useCallback(
    (sessionId: string): StudentAttendance[] => {
      return studentAttendances.filter(a => a.sessionId === sessionId);
    },
    [studentAttendances]
  );

  // Marquer la saisie élèves comme complète
  const markStudentAttendanceComplete = useCallback(
    (sessionId: string) => {
      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId ? { ...s, studentAttendanceComplete: true } : s
        )
      );
    },
    []
  );

  // === PRÉSENCE PROFESSEURS (Logique Pessimiste) ===

  // Vérifier si un mois est verrouillé
  const isMonthLocked = useCallback(
    (date: string): boolean => {
      const monthKey = date.substring(0, 7); // "YYYY-MM"
      return lockedMonths.includes(monthKey);
    },
    [lockedMonths]
  );

  // Obtenir ou initialiser la présence prof (undefined par défaut)
  const getOrInitTeacherAttendance = useCallback(
    (sessionId: string, teacherId: number, theoreticalMinutes: number): TeacherAttendance => {
      const existing = teacherAttendances.find(
        a => a.sessionId === sessionId && a.teacherId === teacherId
      );
      
      if (existing) return existing;

      const newAttendance: TeacherAttendance = {
        id: generateId(),
        sessionId,
        teacherId,
        status: 'undefined', // LOGIQUE PESSIMISTE: défaut undefined
        effectiveMinutes: 0, // 0 par défaut (sécurité financière)
        theoreticalMinutes,
        recordedAt: new Date(),
        isLocked: false,
      };

      setTeacherAttendances(prev => [...prev, newAttendance]);
      return newAttendance;
    },
    [teacherAttendances]
  );

  // Mettre à jour la présence prof
  const updateTeacherAttendance = useCallback(
    (
      sessionId: string,
      teacherId: number,
      status: TeacherAttendanceStatus,
      effectiveMinutes: number,
      justification?: string
    ) => {
      setTeacherAttendances(prev =>
        prev.map(a => {
          if (a.sessionId === sessionId && a.teacherId === teacherId) {
            if (a.isLocked) return a; // Ne pas modifier si verrouillé
            return {
              ...a,
              status,
              effectiveMinutes,
              justification,
              recordedAt: new Date(),
            };
          }
          return a;
        })
      );

      // Marquer la session comme complète pour le prof
      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId ? { ...s, teacherAttendanceComplete: status !== 'undefined' } : s
        )
      );
    },
    []
  );

  // Obtenir la présence prof pour une session
  const getTeacherAttendance = useCallback(
    (sessionId: string, teacherId: number): TeacherAttendance | undefined => {
      return teacherAttendances.find(
        a => a.sessionId === sessionId && a.teacherId === teacherId
      );
    },
    [teacherAttendances]
  );

  // === CALCUL MENSUEL PAIE PROF ===

  // Fonction GetEffectiveDuration(c) selon les spécifications
  const getEffectiveDuration = useCallback(
    (attendance: TeacherAttendance | undefined): number => {
      if (!attendance) return 0;
      if (attendance.status === 'undefined') return 0; // Sécurité: on ne paie pas ce qu'on ne sait pas
      if (attendance.status === 'absent') return 0;
      // present, late, incomplete: utiliser effectiveMinutes
      return attendance.effectiveMinutes;
    },
    []
  );

  // Calculer le total mensuel pour un prof
  const calculateMonthlyHours = useCallback(
    (teacherId: number, month: number, year: number, teacherName: string): TeacherMonthlyHours => {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      
      // Filtrer les sessions du mois pour ce prof
      const monthSessions = sessions.filter(
        s => s.teacherId === teacherId && s.date.startsWith(monthStr)
      );

      // Récupérer les présences correspondantes
      const monthAttendances = monthSessions.map(session => ({
        session,
        attendance: teacherAttendances.find(
          a => a.sessionId === session.id && a.teacherId === teacherId
        ),
      }));

      let totalTheoreticalMinutes = 0;
      let totalEffectiveMinutes = 0;
      let validatedSessions = 0;
      let undefinedSessions = 0;
      let absentSessions = 0;

      monthAttendances.forEach(({ session, attendance }) => {
        const theoretical = calculateDuration(session.startTime, session.endTime);
        totalTheoreticalMinutes += theoretical;

        const effective = getEffectiveDuration(attendance);
        totalEffectiveMinutes += effective;

        if (!attendance || attendance.status === 'undefined') {
          undefinedSessions++;
        } else if (attendance.status === 'absent') {
          absentSessions++;
        } else {
          validatedSessions++;
        }
      });

      return {
        teacherId,
        teacherName,
        month,
        year,
        totalTheoreticalMinutes,
        totalEffectiveMinutes,
        totalSessions: monthSessions.length,
        validatedSessions,
        undefinedSessions,
        absentSessions,
      };
    },
    [sessions, teacherAttendances, getEffectiveDuration]
  );

  // === VERROUILLAGE DE PÉRIODE ===

  const lockMonth = useCallback((year: number, month: number) => {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    
    setLockedMonths(prev => {
      if (prev.includes(monthKey)) return prev;
      return [...prev, monthKey];
    });

    // Verrouiller toutes les présences profs de ce mois
    setTeacherAttendances(prev =>
      prev.map(a => {
        const session = sessions.find(s => s.id === a.sessionId);
        if (session && session.date.startsWith(monthKey)) {
          return { ...a, isLocked: true };
        }
        return a;
      })
    );
  }, [sessions]);

  const unlockMonth = useCallback((year: number, month: number) => {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    
    setLockedMonths(prev => prev.filter(m => m !== monthKey));

    // Déverrouiller toutes les présences profs de ce mois
    setTeacherAttendances(prev =>
      prev.map(a => {
        const session = sessions.find(s => s.id === a.sessionId);
        if (session && session.date.startsWith(monthKey)) {
          return { ...a, isLocked: false };
        }
        return a;
      })
    );
  }, [sessions]);

  // === STATISTIQUES ===

  // Sessions avec statut undefined (alertes)
  const getUndefinedTeacherSessions = useMemo(() => {
    return sessions.filter(session => {
      if (!session.teacherId) return false;
      const attendance = teacherAttendances.find(
        a => a.sessionId === session.id && a.teacherId === session.teacherId
      );
      return !attendance || attendance.status === 'undefined';
    });
  }, [sessions, teacherAttendances]);

  // Statut de saisie d'une session
  const getSessionEntryStatus = useCallback(
    (sessionId: string): 'not_entered' | 'complete' | 'incident' | 'partial' => {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return 'not_entered';

      const studentAtts = studentAttendances.filter(a => a.sessionId === sessionId);
      const teacherAtt = teacherAttendances.find(a => a.sessionId === sessionId);

      // Pas de saisie
      if (studentAtts.length === 0 && (!teacherAtt || teacherAtt.status === 'undefined')) {
        return 'not_entered';
      }

      // Vérifier incidents
      const hasStudentIncident = studentAtts.some(a => a.status !== 'present');
      const hasTeacherIncident = teacherAtt && teacherAtt.status !== 'present' && teacherAtt.status !== 'undefined';

      if (hasStudentIncident || hasTeacherIncident) {
        return 'incident';
      }

      // Saisie partielle
      if (!session.studentAttendanceComplete || !session.teacherAttendanceComplete) {
        return 'partial';
      }

      return 'complete';
    },
    [sessions, studentAttendances, teacherAttendances]
  );

  return {
    // Sessions
    sessions,
    createSession,
    getOrCreateSession,
    
    // Élèves
    studentAttendances,
    initializeStudentAttendances,
    updateStudentAttendance,
    getStudentAttendancesBySession,
    markStudentAttendanceComplete,
    
    // Professeurs
    teacherAttendances,
    getOrInitTeacherAttendance,
    updateTeacherAttendance,
    getTeacherAttendance,
    getEffectiveDuration,
    
    // Calcul paie
    calculateMonthlyHours,
    
    // Verrouillage
    lockedMonths,
    lockMonth,
    unlockMonth,
    isMonthLocked,
    
    // Statistiques
    getUndefinedTeacherSessions,
    getSessionEntryStatus,
  };
};
