import {
  createContext, useContext, useState, useCallback, useMemo,
  useEffect, useRef, ReactNode,
} from 'react';
import {
  StudentAttendance, TeacherAttendance, AttendanceSession,
  StudentAttendanceStatus, TeacherAttendanceStatus, TeacherMonthlyHours,
} from '@/types/attendance';
import { ScheduleEvent } from '@/types/schedule';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { computeMonthlyHours } from '@/lib/teacherHours';
import { isDateInSchoolYear } from '@/lib/schoolYearBounds';
import { getSessionEntryStatus as computeSessionEntryStatus, type SessionEntryStatus } from '@/lib/attendanceStatus';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useEnLigne } from '@/hooks/useEnLigne';
import { useInstantaneHorsLigne } from '@/hooks/useInstantaneHorsLigne';

// ─── Mappers DB → Types ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapSession = (r: any): AttendanceSession => ({
  id:                        r.id,
  scheduleEventId:           r.schedule_event_id ?? '',
  date:                      r.date,
  dayIndex:                  r.day_index,
  startTime:                 r.start_time,
  endTime:                   r.end_time,
  classId:                   r.class_id   ?? '',
  className:                 r.class_name,
  teacherId:                 r.teacher_id  ?? null,
  teacherName:               r.teacher_name ?? null,
  subjectName:               r.subject_name,
  groupId:                   r.group_id,
  groupName:                 r.group_name,
  studentAttendanceComplete: r.student_attendance_complete,
  teacherAttendanceComplete: r.teacher_attendance_complete,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapStudentAtt = (r: any): StudentAttendance => ({
  id:            r.id,
  sessionId:     r.session_id,
  studentId:     r.student_enrollment_id,
  status:        r.status as StudentAttendanceStatus,
  justification: r.justification ?? undefined,
  isJustified:   r.is_justified,
  recordedAt:    new Date(r.recorded_at),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapTeacherAtt = (r: any): TeacherAttendance => ({
  id:                 r.id,
  sessionId:          r.session_id,
  teacherId:          r.teacher_enrollment_id,
  status:             r.status as TeacherAttendanceStatus,
  effectiveMinutes:   r.effective_minutes,
  theoreticalMinutes: r.theoretical_minutes,
  justification:      r.justification ?? undefined,
  recordedAt:         new Date(r.recorded_at),
  isLocked:           r.is_locked,
});

// ─── Interface du contexte ────────────────────────────────────────────────────

interface AttendanceContextType {
  sessions:           AttendanceSession[];
  studentAttendances: StudentAttendance[];
  teacherAttendances: TeacherAttendance[];
  lockedMonths:       string[];
  attendanceLoading:  boolean;

  /** Date ISO des données réinstallées depuis l'appareil, hors connexion. */
  instantaneLe: string | null;

  // Sessions
  ensureSession: (event: ScheduleEvent, date: string) => Promise<string>;

  // Élèves (optimiste)
  ensureStudentAttendances:      (sessionId: string, studentIds: string[]) => Promise<void>;
  updateStudentAttendance:       (sessionId: string, studentId: string, status: StudentAttendanceStatus, justification?: string, isJustified?: boolean) => void;
  markAllStudentsPresent:        (sessionId: string, studentIds: string[]) => void;
  markStudentAttendanceComplete: (sessionId: string) => void;
  getStudentAttendancesBySession:(sessionId: string) => StudentAttendance[];

  // Professeurs (pessimiste)
  getOrInitTeacherAttendance: (sessionId: string, teacherId: string, theoreticalMinutes: number) => Promise<void>;
  updateTeacherAttendance:    (sessionId: string, teacherId: string, status: TeacherAttendanceStatus, effectiveMinutes: number, justification?: string) => void;
  getTeacherAttendance:       (sessionId: string, teacherId: string) => TeacherAttendance | undefined;

  // Bilan
  calculateMonthlyHours: (teacherId: string, month: number, year: number, teacherName: string) => TeacherMonthlyHours;

  // Verrouillage
  lockMonth:     (year: number, month: number) => Promise<void>;
  unlockMonth:   (year: number, month: number) => Promise<void>;
  isMonthLocked: (date: string) => boolean;

  // Statistiques
  getSessionEntryStatus:        (sessionId: string) => 'not_entered' | 'complete' | 'incident' | 'partial';
  undefinedTeacherSessionsCount: number;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AttendanceProvider = ({ children }: { children: ReactNode }) => {
  const { school } = useAuth();
  const { currentYear } = useSchoolYear();
  const enLigne = useEnLigne();
  const schoolId: string | null = school?.id ?? null;

  const [sessions,          setSessions]          = useState<AttendanceSession[]>([]);
  const [studentAtts,       setStudentAtts]       = useState<StudentAttendance[]>([]);
  const [teacherAtts,       setTeacherAtts]       = useState<TeacherAttendance[]>([]);
  const [lockedMonths,      setLockedMonths]      = useState<string[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  /**
   * Ref : sessions dont on a déjà chargé les student_attendances depuis Supabase.
   * Permet le chargement lazy sans double-fetch même si le composant se re-rend.
   */
  const loadedStudentSessions = useRef<Set<string>>(new Set());

  // ── Chargement initial : sessions + teacher_attendances + locked_months ───

  useEffect(() => {
    if (!schoolId || !currentYear) {
      setSessions([]);
      setStudentAtts([]);
      setTeacherAtts([]);
      setLockedMonths([]);
      loadedStudentSessions.current = new Set();
      return;
    }

    // Hors connexion, la requête n'aboutirait pas et le voyant resterait
    // allumé : l'instantané enregistré prend le relais.
    if (!enLigne) { setAttendanceLoading(false); return; }

    let cancelled = false;
    setAttendanceLoading(true);
    loadedStudentSessions.current = new Set();
    const yearLabel = currentYear.id;

    (async () => {
      // Les 3 chargements sont indépendants (teacher_attendances est filtré
      // côté client sur les ids de sessions une fois les deux réponses là,
      // pas besoin d'attendre la réponse des sessions pour lancer sa requête)
      // — on les lance donc en parallèle plutôt qu'en cascade.
      //
      // fetchAllRows sur sessions/teacher_attendances : sur une année complète,
      // une grande école dépasse largement les 1000 lignes (limite PostgREST
      // par défaut, tronquée sans erreur avec un .select('*') direct).
      // teacher_attendances filtré par school_id seul (déjà suffisant pour
      // l'isolation, session_id référence forcément une session de la même
      // école) plutôt que d'ajouter `.in('session_id', sessionIds)` : avec
      // 400+ sessions, cette liste IN génère une requête qui ne revient jamais
      // (même symptôme que le bug équivalent sur `grades`, voir SchoolContext.tsx).
      // On filtre ensuite côté client sur les sessions de l'année courante.
      const [sessRes, teacherRes, lockedRes] = await Promise.all([
        fetchAllRows('attendance_sessions', q => q
          .eq('school_id', schoolId)
          .eq('academic_year_label', yearLabel)
          .order('date', { ascending: true })),
        fetchAllRows('teacher_attendances', q => q.eq('school_id', schoolId)),
        supabase.from('locked_months').select('month_key').eq('school_id', schoolId),
      ]);

      if (cancelled) return;

      const mappedSessions = (sessRes.data ?? []).map(mapSession);
      setSessions(mappedSessions);

      const sessionIdSet = new Set(mappedSessions.map(s => s.id));
      if (teacherRes.data) {
        setTeacherAtts(
          teacherRes.data
            .filter((r: { session_id: string }) => sessionIdSet.has(r.session_id))
            .map(mapTeacherAtt)
        );
      }

      if (lockedRes.data) {
        setLockedMonths(lockedRes.data.map(r => r.month_key));
      }

      setAttendanceLoading(false);
    })();

    return () => { cancelled = true; };
  }, [schoolId, currentYear?.id, enLigne]);

  // ── Sessions ──────────────────────────────────────────────────────────────

  /**
   * Crée la session en DB si elle n'existe pas encore, puis retourne son UUID.
   * Utilise INSERT + gestion de conflit (code 23505) pour la robustesse.
   */
  const ensureSession = useCallback(async (
    event: ScheduleEvent,
    date: string
  ): Promise<string> => {
    if (!schoolId || !currentYear) return `${event.id}-${date}`;

    // Vérification rapide dans l'état local (évite un aller-retour DB inutile)
    const local = sessions.find(
      s => s.scheduleEventId === event.id && s.date === date
    );
    if (local) return local.id;

    // Garde-fou : ne jamais créer une séance hors de l'année scolaire — elle
    // serait estampillée du label de l'année courante alors qu'elle n'en fait
    // pas partie (l'UI borne déjà le sélecteur, ceci couvre les autres appels).
    if (!isDateInSchoolYear(date, currentYear)) {
      throw new Error(
        `Date hors année scolaire (${currentYear.startDate} → ${currentYear.endDate}) : aucune séance ne peut y être créée.`
      );
    }

    // Tentative d'insertion
    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert({
        school_id:            schoolId,
        academic_year_label:  currentYear.id,
        schedule_event_id:    event.id,
        date,
        day_index:    event.dayIndex,
        start_time:   event.startTime,
        end_time:     event.endTime,
        class_id:     event.classId,
        class_name:   event.className,
        teacher_id:   event.teacherId   ?? null,
        teacher_name: event.teacherName ?? null,
        subject_name: event.subjectName,
        group_id:     event.groupId,
        group_name:   event.groupName,
      })
      .select()
      .single();

    if (data) {
      const session = mapSession(data);
      setSessions(prev =>
        prev.some(s => s.id === session.id) ? prev : [...prev, session]
      );
      return session.id;
    }

    // Conflit de clé unique (deux clics simultanés) → récupérer l'existante
    if (error?.code === '23505') {
      const { data: existing } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('school_id', schoolId)
        .eq('schedule_event_id', event.id)
        .eq('date', date)
        .single();

      if (existing) {
        const session = mapSession(existing);
        setSessions(prev =>
          prev.some(s => s.id === session.id) ? prev : [...prev, session]
        );
        return session.id;
      }
    }

    // Fallback (ne devrait pas arriver)
    return `${event.id}-${date}`;
  }, [schoolId, currentYear, sessions]);

  // ── Présences élèves ──────────────────────────────────────────────────────

  /**
   * Charge les student_attendances depuis DB (1 seul fetch par session grâce au ref),
   * puis crée les enregistrements manquants (statut par défaut = 'present').
   */
  const ensureStudentAttendances = useCallback(async (
    sessionId: string,
    studentIds: string[]
  ): Promise<void> => {
    if (!schoolId || studentIds.length === 0) return;

    // Déjà chargé pour cette session → ne rien refaire
    if (loadedStudentSessions.current.has(sessionId)) return;
    loadedStudentSessions.current.add(sessionId);

    // Charger les enregistrements existants
    const { data: existing, error } = await supabase
      .from('student_attendances')
      .select('*')
      .eq('school_id', schoolId)
      .eq('session_id', sessionId);

    if (error) {
      // En cas d'erreur, retirer du cache pour permettre une nouvelle tentative
      loadedStudentSessions.current.delete(sessionId);
      return;
    }

    const existingAtts = (existing ?? []).map(mapStudentAtt);
    const existingIds  = new Set(existingAtts.map(a => a.studentId));

    // Intégrer les enregistrements existants dans l'état local
    if (existingAtts.length > 0) {
      setStudentAtts(prev => {
        const withoutSession = prev.filter(a => a.sessionId !== sessionId);
        return [...withoutSession, ...existingAtts];
      });
    }

    // Créer les enregistrements manquants (élèves non encore initialisés)
    const toAdd = studentIds.filter(id => !existingIds.has(id));
    if (toAdd.length === 0) return;

    const now  = new Date().toISOString();
    const rows = toAdd.map(sid => ({
      school_id:             schoolId,
      session_id:            sessionId,
      student_enrollment_id: sid,
      status:                'present',
      is_justified:          false,
      recorded_at:           now,
    }));

    const { data: inserted } = await supabase
      .from('student_attendances')
      .insert(rows)
      .select();

    if (inserted) {
      setStudentAtts(prev => [...prev, ...inserted.map(mapStudentAtt)]);
    }
  }, [schoolId]);

  /**
   * Mise à jour optimiste : état local immédiat + persist DB en arrière-plan.
   */
  const updateStudentAttendance = useCallback((
    sessionId:     string,
    studentId:     string,
    status:        StudentAttendanceStatus,
    justification?: string,
    isJustified?:   boolean
  ) => {
    // Mise à jour optimiste
    setStudentAtts(prev =>
      prev.map(a =>
        a.sessionId === sessionId && a.studentId === studentId
          ? {
              ...a,
              status,
              justification: justification !== undefined ? justification : a.justification,
              isJustified:   isJustified   !== undefined ? isJustified   : a.isJustified,
              recordedAt:    new Date(),
            }
          : a
      )
    );

    if (!schoolId) return;
    supabase
      .from('student_attendances')
      .update({
        status,
        justification:  justification ?? null,
        is_justified:   isJustified   ?? false,
        recorded_at:    new Date().toISOString(),
      })
      .eq('school_id', schoolId)
      .eq('session_id', sessionId)
      .eq('student_enrollment_id', studentId)
      .then(({ error }) => {
        if (error) console.error('[updateStudentAttendance]', error.message);
      });
  }, [schoolId]);

  /**
   * Marque tous les élèves comme présents (optimiste + persist).
   */
  const markAllStudentsPresent = useCallback((
    sessionId:  string,
    studentIds: string[]
  ) => {
    const now = new Date();

    setStudentAtts(prev => {
      const withoutSession = prev.filter(a => a.sessionId !== sessionId);
      const updated: StudentAttendance[] = studentIds.map(sid => {
        const existing = prev.find(
          a => a.sessionId === sessionId && a.studentId === sid
        );
        return existing
          ? { ...existing, status: 'present' as StudentAttendanceStatus, justification: '', isJustified: false, recordedAt: now }
          : { id: crypto.randomUUID(), sessionId, studentId: sid, status: 'present', isJustified: false, recordedAt: now };
      });
      return [...withoutSession, ...updated];
    });

    if (!schoolId) return;
    supabase
      .from('student_attendances')
      .update({
        status:        'present',
        justification: null,
        is_justified:  false,
        recorded_at:   now.toISOString(),
      })
      .eq('school_id', schoolId)
      .eq('session_id', sessionId)
      .in('student_enrollment_id', studentIds)
      .then(({ error }) => {
        if (error) console.error('[markAllStudentsPresent]', error.message);
      });
  }, [schoolId]);

  /**
   * Marque la saisie élèves comme complète pour une session.
   */
  const markStudentAttendanceComplete = useCallback((sessionId: string) => {
    setSessions(prev =>
      prev.map(s => s.id === sessionId ? { ...s, studentAttendanceComplete: true } : s)
    );
    if (!schoolId) return;
    supabase
      .from('attendance_sessions')
      .update({ student_attendance_complete: true, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('school_id', schoolId)
      .then(({ error }) => {
        if (error) console.error('[markStudentAttendanceComplete]', error.message);
      });
  }, [schoolId]);

  const getStudentAttendancesBySession = useCallback(
    (sessionId: string): StudentAttendance[] =>
      studentAtts.filter(a => a.sessionId === sessionId),
    [studentAtts]
  );

  // ── Présences professeurs ─────────────────────────────────────────────────

  /**
   * Initialise l'enregistrement de présence prof si inexistant (upsert DB).
   * Logique pessimiste : statut par défaut = 'undefined'.
   */
  const getOrInitTeacherAttendance = useCallback(async (
    sessionId:          string,
    teacherId:          string,
    theoreticalMinutes: number
  ): Promise<void> => {
    if (!schoolId) return;

    // Déjà dans l'état local → rien à faire
    if (teacherAtts.some(a => a.sessionId === sessionId && a.teacherId === teacherId)) return;

    // Upsert DB : crée si absent, ignore si déjà présent
    const { data, error } = await supabase
      .from('teacher_attendances')
      .upsert(
        {
          school_id:             schoolId,
          session_id:            sessionId,
          teacher_enrollment_id: teacherId,
          status:                'undefined',
          effective_minutes:     0,
          theoretical_minutes:   theoreticalMinutes,
          recorded_at:           new Date().toISOString(),
        },
        { onConflict: 'school_id,session_id,teacher_enrollment_id' }
      )
      .select()
      .single();

    if (!error && data) {
      const att = mapTeacherAtt(data);
      setTeacherAtts(prev => {
        const filtered = prev.filter(
          a => !(a.sessionId === sessionId && a.teacherId === teacherId)
        );
        return [...filtered, att];
      });
    }
  }, [schoolId, teacherAtts]);

  /**
   * Sauvegarde la présence prof (optimiste + persist).
   * Met aussi à jour le drapeau teacher_attendance_complete de la session.
   */
  const updateTeacherAttendance = useCallback((
    sessionId:      string,
    teacherId:      string,
    status:         TeacherAttendanceStatus,
    effectiveMinutes: number,
    justification?: string
  ) => {
    const now       = new Date();
    const isComplete = status !== 'undefined';

    // Mise à jour optimiste
    setTeacherAtts(prev =>
      prev.map(a =>
        a.sessionId === sessionId && a.teacherId === teacherId && !a.isLocked
          ? { ...a, status, effectiveMinutes, justification, recordedAt: now }
          : a
      )
    );
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId ? { ...s, teacherAttendanceComplete: isComplete } : s
      )
    );

    if (!schoolId) return;

    // Persist teacher_attendance
    supabase
      .from('teacher_attendances')
      .update({
        status,
        effective_minutes: effectiveMinutes,
        justification:     justification ?? null,
        recorded_at:       now.toISOString(),
      })
      .eq('school_id', schoolId)
      .eq('session_id', sessionId)
      .eq('teacher_enrollment_id', teacherId)
      .eq('is_locked', false)
      .then(({ error }) => {
        if (error) console.error('[updateTeacherAttendance]', error.message);
      });

    // Persist drapeau sur la session
    supabase
      .from('attendance_sessions')
      .update({
        teacher_attendance_complete: isComplete,
        updated_at: now.toISOString(),
      })
      .eq('id', sessionId)
      .eq('school_id', schoolId)
      .then(({ error }) => {
        if (error) console.error('[updateTeacherAttendance session flag]', error.message);
      });
  }, [schoolId]);

  const getTeacherAttendance = useCallback(
    (sessionId: string, teacherId: string): TeacherAttendance | undefined =>
      teacherAtts.find(a => a.sessionId === sessionId && a.teacherId === teacherId),
    [teacherAtts]
  );

  // ── Bilan mensuel ─────────────────────────────────────────────────────────

  /**
   * Calcule les heures théoriques / effectives d'un prof pour un mois donné.
   * Utilise les données en mémoire (sessions + teacher_attendances chargés à
   * l'init). Le calcul lui-même vit dans src/lib/teacherHours.ts — fonction
   * pure couverte par teacherHours.test.ts, puisqu'elle décide d'un salaire.
   */
  const calculateMonthlyHours = useCallback((
    teacherId:   string,
    month:       number,
    year:        number,
    teacherName: string
  ): TeacherMonthlyHours =>
    computeMonthlyHours(teacherId, month, year, teacherName, sessions, teacherAtts),
  [sessions, teacherAtts]);

  // ── Verrouillage ──────────────────────────────────────────────────────────

  const lockMonth = useCallback(async (year: number, month: number): Promise<void> => {
    if (!schoolId) return;
    const key = `${year}-${String(month).padStart(2, '0')}`;

    // Optimiste
    setLockedMonths(prev => prev.includes(key) ? prev : [...prev, key]);
    setTeacherAtts(prev => prev.map(a => {
      const s = sessions.find(x => x.id === a.sessionId);
      return s && s.date.startsWith(key) ? { ...a, isLocked: true } : a;
    }));

    // Persist locked_month
    await supabase
      .from('locked_months')
      .upsert({ school_id: schoolId, month_key: key }, { onConflict: 'school_id,month_key' });

    // Verrouiller toutes les teacher_attendances du mois
    const sessionIds = sessions
      .filter(s => s.date.startsWith(key))
      .map(s => s.id);

    if (sessionIds.length > 0) {
      await supabase
        .from('teacher_attendances')
        .update({ is_locked: true })
        .eq('school_id', schoolId)
        .in('session_id', sessionIds);
    }
  }, [schoolId, sessions]);

  const unlockMonth = useCallback(async (year: number, month: number): Promise<void> => {
    if (!schoolId) return;
    const key = `${year}-${String(month).padStart(2, '0')}`;

    // Optimiste
    setLockedMonths(prev => prev.filter(m => m !== key));
    setTeacherAtts(prev => prev.map(a => {
      const s = sessions.find(x => x.id === a.sessionId);
      return s && s.date.startsWith(key) ? { ...a, isLocked: false } : a;
    }));

    // Supprimer le verrou
    await supabase
      .from('locked_months')
      .delete()
      .eq('school_id', schoolId)
      .eq('month_key', key);

    // Déverrouiller les teacher_attendances
    const sessionIds = sessions
      .filter(s => s.date.startsWith(key))
      .map(s => s.id);

    if (sessionIds.length > 0) {
      await supabase
        .from('teacher_attendances')
        .update({ is_locked: false })
        .eq('school_id', schoolId)
        .in('session_id', sessionIds);
    }
  }, [schoolId, sessions]);

  const isMonthLocked = useCallback(
    (date: string): boolean => lockedMonths.includes(date.substring(0, 7)),
    [lockedMonths]
  );

  // ── Statistiques ──────────────────────────────────────────────────────────

  /**
   * Nombre de sessions avec un prof assigné mais présence non saisie.
   * Alerte financière : ces sessions = 0h comptabilisé.
   */
  const undefinedTeacherSessionsCount = useMemo(() => {
    return sessions.filter(session => {
      if (!session.teacherId) return false;
      const att = teacherAtts.find(
        a => a.sessionId === session.id && a.teacherId === session.teacherId
      );
      return !att || att.status === 'undefined';
    }).length;
  }, [sessions, teacherAtts]);

  /**
   * Statut visuel d'une session (point coloré dans le panneau gauche).
   * Prend le UUID réel de la session (pas le composite key).
   */
  // Règle pure dans src/lib/attendanceStatus.ts (attendanceStatus.test.ts).
  const getSessionEntryStatus = useCallback((sessionId: string): SessionEntryStatus =>
    computeSessionEntryStatus(
      sessions.find(s => s.id === sessionId),
      studentAtts.filter(a => a.sessionId === sessionId),
      teacherAtts.find(a => a.sessionId === sessionId),
    ),
  [sessions, studentAtts, teacherAtts]);

  // ─────────────────────────────────────────────────────────────────────────

  // ── Instantané hors connexion ──────────────────────────────────────────────
  // Les écrans lisent ce contexte, jamais Supabase : garder ces tranches rend
  // l'écran consultable sans réseau. On n'enregistre qu'une fois le chargement
  // terminé, sinon l'état vide du démarrage effacerait l'instantané.
  const tranchesHorsLigne = useMemo(() => ({ sessions, studentAtts, teacherAtts, lockedMonths }), [sessions, studentAtts, teacherAtts, lockedMonths]);

  const appliquerInstantane = useCallback((t: typeof tranchesHorsLigne) => {
    setSessions(t.sessions);
    setStudentAtts(t.studentAtts);
    setTeacherAtts(t.teacherAtts);
    setLockedMonths(t.lockedMonths);
  }, []);

  const instantaneLe = useInstantaneHorsLigne(
    'presences-instantane', tranchesHorsLigne, appliquerInstantane, !!schoolId && !!currentYear && !attendanceLoading,
  );

  return (
    <AttendanceContext.Provider value={{
      sessions,
      studentAttendances: studentAtts,
      teacherAttendances: teacherAtts,
      lockedMonths,
      attendanceLoading,
      instantaneLe,
      ensureSession,
      ensureStudentAttendances,
      updateStudentAttendance,
      markAllStudentsPresent,
      markStudentAttendanceComplete,
      getStudentAttendancesBySession,
      getOrInitTeacherAttendance,
      updateTeacherAttendance,
      getTeacherAttendance,
      calculateMonthlyHours,
      lockMonth,
      unlockMonth,
      isMonthLocked,
      getSessionEntryStatus,
      undefinedTeacherSessionsCount,
    }}>
      {children}
    </AttendanceContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAttendance = () => {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error('useAttendance must be used within AttendanceProvider');
  return ctx;
};
