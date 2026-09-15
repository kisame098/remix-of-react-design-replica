import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, addDays, addMonths, startOfMonth, endOfMonth, isToday, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Loader2, ChevronLeft, ChevronRight, ClipboardCheck, Users, Clock, RotateCcw,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { fmtTime, fmtDateFull } from '../portalHelpers';

// ─── Présences — vue professeur ─────────────────────────────────────────────
// Deux volets : (1) sa propre présence, en lecture seule — c'est l'admin qui
// la définit, jamais le prof lui-même ; (2) faire l'appel pour ses propres
// créneaux (via son emploi du temps), classe par classe.

type StudentStatus = 'present' | 'absent' | 'late' | 'expelled';

interface TeacherSlot {
  id: string;           // schedule_events.id
  dayIndex: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  classId: string;
  className: string;
  color: string;
  academicYearLabel: string;
}

interface OwnAttendanceRow {
  id: string;
  status: string;
  date: string;
  subjectName: string;
  className: string;
  startTime: string;
  endTime: string;
}

interface RosterRow {
  studentEnrollmentId: string;
  firstName: string;
  lastName: string;
  attendanceId: string | null;
  status: StudentStatus;
  justification: string;
  saving: boolean;
}

const STATUS_META: Record<StudentStatus, { label: string; short: string; activeCls: string }> = {
  present:  { label: 'Présent', short: 'P', activeCls: 'bg-emerald-500 text-white border-emerald-500' },
  absent:   { label: 'Absent',  short: 'A', activeCls: 'bg-red-500 text-white border-red-500' },
  late:     { label: 'Retard',  short: 'R', activeCls: 'bg-amber-500 text-white border-amber-500' },
  expelled: { label: 'Renvoyé', short: 'E', activeCls: 'bg-slate-600 text-white border-slate-600' },
};
const STATUS_ORDER: StudentStatus[] = ['present', 'absent', 'late', 'expelled'];

const dayIndexOf = (d: Date) => { const j = d.getDay(); return j === 0 ? -1 : j - 1; };

const OWN_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  present:    { label: 'Présent',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  absent:     { label: 'Absent',    cls: 'bg-red-50 text-red-700 border-red-200' },
  late:       { label: 'En retard', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  incomplete: { label: 'Incomplet', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  undefined:  { label: 'Non renseigné', cls: 'bg-slate-50 text-slate-400 border-slate-200' },
};

export default function TeacherPresences() {
  const { schoolAccount } = useAuth();
  const teacherEnrollmentId = schoolAccount?.teacherEnrollmentId;

  const [tab, setTab] = useState<'appel' | 'moi'>('appel');

  // ── Ma présence (lecture seule) ────────────────────────────────────────
  const [ownMonth, setOwnMonth] = useState(() => startOfMonth(new Date()));
  const [ownLoading, setOwnLoading] = useState(true);
  const [ownRows, setOwnRows] = useState<OwnAttendanceRow[]>([]);

  useEffect(() => {
    if (!teacherEnrollmentId) { setOwnLoading(false); return; }
    (async () => {
      setOwnLoading(true);
      try {
        // On part de attendance_sessions (pas teacher_attendances) et on filtre
        // sur un mois complet, pour voir TOUTES ses séances du mois — y compris
        // celles que l'admin n'a pas encore renseignées (affichées "Non
        // renseigné") plutôt que de les faire disparaître silencieusement.
        const monthStart = format(ownMonth, 'yyyy-MM-dd');
        const monthEnd   = format(endOfMonth(ownMonth), 'yyyy-MM-dd');

        const { data: sessions } = await supabase
          .from('attendance_sessions')
          .select('id,date,subject_name,class_name,start_time,end_time')
          .eq('teacher_id', teacherEnrollmentId)
          .gte('date', monthStart)
          .lte('date', monthEnd)
          .order('date', { ascending: false });

        const sessionIds = (sessions ?? []).map(s => s.id);
        let attsBySession = new Map<string, { id: string; status: string }>();
        if (sessionIds.length > 0) {
          const { data: atts } = await supabase
            .from('teacher_attendances')
            .select('id,status,session_id')
            .in('session_id', sessionIds);
          attsBySession = new Map((atts ?? []).map(a => [a.session_id, a]));
        }

        setOwnRows((sessions ?? []).map(s => {
          const att = attsBySession.get(s.id);
          return {
            id: att?.id ?? s.id,
            status: att?.status ?? 'undefined',
            date: s.date, subjectName: s.subject_name, className: s.class_name,
            startTime: s.start_time, endTime: s.end_time,
          };
        }));
      } catch { /**/ }
      finally { setOwnLoading(false); }
    })();
  }, [teacherEnrollmentId, ownMonth]);

  // ── Faire l'appel ───────────────────────────────────────────────────────
  const [date, setDate] = useState(new Date());
  const [slots, setSlots] = useState<TeacherSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    if (!schoolAccount?.schoolId) { setSlotsLoading(false); return; }
    (async () => {
      setSlotsLoading(true);
      try {
        const { data } = await supabase
          .from('schedule_events')
          .select('id,day_index,start_time,end_time,subject_name,class_id,class_name,color,academic_year_label')
          .eq('school_id', schoolAccount.schoolId);
        if (data) setSlots(data.map(e => ({
          id: e.id, dayIndex: e.day_index, startTime: e.start_time, endTime: e.end_time,
          subjectName: e.subject_name, classId: e.class_id, className: e.class_name,
          color: e.color ?? '#3b82f6', academicYearLabel: e.academic_year_label,
        })));
      } catch { /**/ }
      finally { setSlotsLoading(false); }
    })();
  }, [schoolAccount?.schoolId]);

  const dayIndex = dayIndexOf(date);
  const daySlots = useMemo(() =>
    slots.filter(s => s.dayIndex === dayIndex).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, dayIndex],
  );

  // ── Modale d'appel pour un créneau ───────────────────────────────────────
  const [activeSlot, setActiveSlot] = useState<TeacherSlot | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const closeSlot = () => { setActiveSlot(null); setSessionId(null); setRoster([]); };

  const openSlot = useCallback(async (slot: TeacherSlot) => {
    if (!schoolAccount?.schoolId || !teacherEnrollmentId) return;
    setActiveSlot(slot);
    setRosterLoading(true);
    setRoster([]);
    setSessionId(null);

    try {
      const dateStr = format(date, 'yyyy-MM-dd');

      // 1. Retrouver ou créer la session pour ce créneau + cette date
      let sid: string | null = null;
      const { data: existingSession } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('school_id', schoolAccount.schoolId)
        .eq('schedule_event_id', slot.id)
        .eq('date', dateStr)
        .maybeSingle();

      if (existingSession) {
        sid = existingSession.id;
      } else {
        const { data: created, error } = await supabase
          .from('attendance_sessions')
          .insert({
            school_id:           schoolAccount.schoolId,
            academic_year_label: slot.academicYearLabel,
            schedule_event_id:   slot.id,
            date:                dateStr,
            day_index:           slot.dayIndex,
            start_time:          slot.startTime,
            end_time:            slot.endTime,
            class_id:            slot.classId,
            class_name:          slot.className,
            teacher_id:          teacherEnrollmentId,
            teacher_name:        schoolAccount.displayName,
            subject_name:        slot.subjectName,
            group_id:            slot.classId,
            group_name:          slot.className,
          })
          .select('id')
          .single();
        if (error) {
          // Conflit (double-clic) : la session existe déjà, on la relit.
          const { data: raced } = await supabase
            .from('attendance_sessions')
            .select('id')
            .eq('school_id', schoolAccount.schoolId)
            .eq('schedule_event_id', slot.id)
            .eq('date', dateStr)
            .maybeSingle();
          sid = raced?.id ?? null;
        } else {
          sid = created.id;
        }
      }

      if (!sid) { setRosterLoading(false); return; }
      setSessionId(sid);

      // 2. Charger la liste des élèves de la classe — l'année de ce créneau
      // (schedule_events.academic_year_label), pas l'année sélectionnée dans le
      // navigateur (qui peut être obsolète sur un appareil partagé et ne
      // correspondre à aucun élève inscrit).
      const { data: enrollments } = await supabase
        .from('student_enrollments')
        .select('id, student_profiles(first_name,last_name)')
        .eq('class_id', slot.classId)
        .eq('academic_year_label', slot.academicYearLabel);

      const students = (enrollments ?? [])
        .filter(e => e.student_profiles)
        .map(e => {
          const p = e.student_profiles as { first_name: string; last_name: string };
          return { id: e.id, firstName: p.first_name, lastName: p.last_name };
        })
        .sort((a, b) => a.lastName.localeCompare(b.lastName));

      // 3. Charger les présences déjà enregistrées pour cette session
      const { data: existingAtts } = await supabase
        .from('student_attendances')
        .select('id,student_enrollment_id,status,justification')
        .eq('session_id', sid);

      const byStudent = new Map((existingAtts ?? []).map(a => [a.student_enrollment_id, a]));

      setRoster(students.map(s => {
        const existing = byStudent.get(s.id);
        return {
          studentEnrollmentId: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          attendanceId: existing?.id ?? null,
          status: (existing?.status as StudentStatus) ?? 'present',
          justification: existing?.justification ?? '',
          saving: false,
        };
      }));
    } finally {
      setRosterLoading(false);
    }
  }, [schoolAccount, teacherEnrollmentId, date]);

  const setStudentStatus = useCallback(async (studentEnrollmentId: string, status: StudentStatus) => {
    if (!sessionId || !schoolAccount?.schoolId) return;

    // Revenir à "présent" efface le motif — cohérent avec la saisie admin.
    const clearedJustification = status === 'present' ? '' : undefined;

    setRoster(prev => prev.map(r => r.studentEnrollmentId === studentEnrollmentId
      ? { ...r, status, saving: true, justification: clearedJustification ?? r.justification }
      : r));

    const row = roster.find(r => r.studentEnrollmentId === studentEnrollmentId);
    try {
      if (row?.attendanceId) {
        await supabase
          .from('student_attendances')
          .update({
            status,
            recorded_at: new Date().toISOString(),
            ...(clearedJustification !== undefined ? { justification: null, is_justified: false } : {}),
          })
          .eq('id', row.attendanceId);
      } else {
        const { data } = await supabase
          .from('student_attendances')
          .insert({
            school_id:             schoolAccount.schoolId,
            session_id:            sessionId,
            student_enrollment_id: studentEnrollmentId,
            status,
            is_justified:          false,
          })
          .select('id')
          .single();
        if (data) {
          setRoster(prev => prev.map(r => r.studentEnrollmentId === studentEnrollmentId ? { ...r, attendanceId: data.id } : r));
        }
      }
    } finally {
      setRoster(prev => prev.map(r => r.studentEnrollmentId === studentEnrollmentId ? { ...r, saving: false } : r));
    }
  }, [sessionId, schoolAccount, roster]);

  const justificationTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const setStudentJustificationLocal = (studentEnrollmentId: string, justification: string) => {
    setRoster(prev => prev.map(r => r.studentEnrollmentId === studentEnrollmentId ? { ...r, justification } : r));

    if (justificationTimeouts.current[studentEnrollmentId]) clearTimeout(justificationTimeouts.current[studentEnrollmentId]);
    justificationTimeouts.current[studentEnrollmentId] = setTimeout(async () => {
      if (!sessionId || !schoolAccount?.schoolId) return;
      const row = roster.find(r => r.studentEnrollmentId === studentEnrollmentId);
      const isJustified = justification.trim().length > 0;
      if (row?.attendanceId) {
        await supabase
          .from('student_attendances')
          .update({ justification: justification || null, is_justified: isJustified })
          .eq('id', row.attendanceId);
      } else {
        const { data } = await supabase
          .from('student_attendances')
          .insert({
            school_id:             schoolAccount.schoolId,
            session_id:            sessionId,
            student_enrollment_id: studentEnrollmentId,
            status:                row?.status ?? 'present',
            justification:         justification || null,
            is_justified:          isJustified,
          })
          .select('id')
          .single();
        if (data) {
          setRoster(prev => prev.map(r => r.studentEnrollmentId === studentEnrollmentId ? { ...r, attendanceId: data.id } : r));
        }
      }
    }, 600);
  };

  return (
    <div className="px-4 pt-5 pb-6 space-y-5">

      {/* ── Page title ────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-black text-gray-900">Présences</h1>
        <p className="text-sm text-gray-400 mt-0.5">Votre assiduité et l'appel de vos classes</p>
      </div>

      {/* ── Segmented control ────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([['appel', 'Faire l’appel'], ['moi', 'Ma présence']] as [typeof tab, string][]).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === k ? 'bg-white shadow text-gray-800' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === 'appel' ? (
        <>
          {/* ── Date nav ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-3 py-2.5 shadow-sm">
            <button onClick={() => setDate(d => addDays(d, -1))} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-50">
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <div className="text-center">
              <p className="font-bold text-gray-900 text-sm capitalize">{format(date, 'EEEE d MMMM', { locale: fr })}</p>
              {!isToday(date) && (
                <button onClick={() => setDate(new Date())} className="text-xs text-blue-600 font-semibold flex items-center gap-1 justify-center mt-0.5">
                  <RotateCcw className="h-3 w-3" /> Aujourd'hui
                </button>
              )}
            </div>
            <button onClick={() => setDate(d => addDays(d, 1))} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-50">
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* ── Slot list ─────────────────────────────────────────────── */}
          {slotsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : dayIndex < 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center text-sm text-gray-400">
              Pas de cours le dimanche 🎉
            </div>
          ) : daySlots.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center text-sm text-gray-400">
              Aucun cours à votre emploi du temps ce jour-là
            </div>
          ) : (
            <div className="space-y-2.5">
              {daySlots.map(slot => (
                <button
                  key={slot.id}
                  onClick={() => openSlot(slot)}
                  className="w-full bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 text-left shadow-sm active:scale-[.98] transition-transform"
                  style={{ borderLeftWidth: 4, borderLeftColor: slot.color }}
                >
                  <div className="flex-shrink-0 text-center w-14">
                    <p className="text-sm font-black text-gray-800">{fmtTime(slot.startTime)}</p>
                    <p className="text-[10px] text-gray-400">{fmtTime(slot.endTime)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{slot.subjectName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{slot.className}</p>
                  </div>
                  <ClipboardCheck className="h-5 w-5 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* ── Month nav ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-3 py-2.5 shadow-sm">
            <button onClick={() => setOwnMonth(m => addMonths(m, -1))} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-50">
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <div className="text-center">
              <p className="font-bold text-gray-900 text-sm capitalize">{format(ownMonth, 'MMMM yyyy', { locale: fr })}</p>
              {!isSameMonth(ownMonth, new Date()) && (
                <button onClick={() => setOwnMonth(startOfMonth(new Date()))} className="text-xs text-blue-600 font-semibold flex items-center gap-1 justify-center mt-0.5">
                  <RotateCcw className="h-3 w-3" /> Ce mois-ci
                </button>
              )}
            </div>
            <button onClick={() => setOwnMonth(m => addMonths(m, 1))} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-50">
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* ── Ma présence (lecture seule) ───────────────────────────── */}
          {ownLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : ownRows.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center text-sm text-gray-400">
              Aucune séance enregistrée pour {format(ownMonth, 'MMMM yyyy', { locale: fr })}.
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              {ownRows.map((r, i) => {
                const meta = OWN_STATUS_LABEL[r.status] ?? OWN_STATUS_LABEL.undefined;
                return (
                  <div key={r.id} className={cn('px-4 py-3.5', i > 0 && 'border-t border-gray-50')}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-sm text-gray-900 flex-1 truncate">
                        {r.subjectName} · {r.className}
                      </p>
                      <span className={cn('flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border', meta.cls)}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                      <span>{fmtDateFull(r.date)}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-200 flex-shrink-0" />
                      <span>{fmtTime(r.startTime)} – {fmtTime(r.endTime)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modale d'appel ───────────────────────────────────────────────── */}
      <Dialog open={!!activeSlot} onOpenChange={(open) => !open && closeSlot()}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeSlot?.subjectName}</DialogTitle>
            <DialogDescription>
              {activeSlot?.className} · {format(date, 'EEEE d MMMM', { locale: fr })}
            </DialogDescription>
          </DialogHeader>

          {rosterLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : roster.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              Aucun élève dans cette classe
            </div>
          ) : (
            <div className="space-y-1 pt-1">
              {roster.map(r => (
                <div key={r.studentEnrollmentId} className="py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.lastName} {r.firstName}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {STATUS_ORDER.map(s => (
                        <button
                          key={s}
                          disabled={r.saving}
                          onClick={() => setStudentStatus(r.studentEnrollmentId, s)}
                          className={cn(
                            'w-8 h-8 rounded-lg border text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-50',
                            r.status === s ? STATUS_META[s].activeCls : 'bg-white border-gray-200 text-gray-400',
                          )}
                          title={STATUS_META[s].label}
                        >
                          {STATUS_META[s].short}
                        </button>
                      ))}
                    </div>
                  </div>
                  {r.status !== 'present' && (
                    <Input
                      placeholder={`Motif (${STATUS_META[r.status].label.toLowerCase()})...`}
                      value={r.justification}
                      onChange={(e) => setStudentJustificationLocal(r.studentEnrollmentId, e.target.value)}
                      className="h-8 text-xs mt-1.5"
                    />
                  )}
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground pt-2 flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Enregistré automatiquement à chaque changement.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
