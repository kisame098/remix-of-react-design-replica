import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Loader2, ChevronRight, CalendarDays, BookOpen, Check, AlertCircle, Users } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// ─── Notes — vue professeur ──────────────────────────────────────────────────
// Un prof ne voit et ne saisit les notes que pour les matières que l'admin lui
// a explicitement assignées (subjects.teacher_id), classe par classe.

interface TeacherPeriod { id: string; name: string; ordering: number; type: string; academicYearLabel: string; }

interface TeacherSubject {
  id: string;
  name: string;
  coefficient: number;
  classId: string;
  className: string;
  periodId: string;
}

interface RosterStudent { id: string; firstName: string; lastName: string; }

interface GradeEntry {
  studentEnrollmentId: string;
  devoir1: string; devoir2: string; devoir3: string; devoir4: string; devoir5: string;
  composition: string; note: string;
}

const calcAverage = (entry: GradeEntry, isExam: boolean, active: boolean[]): string => {
  if (isExam) return entry.note || '-';
  const vals: number[] = [];
  const fields: (keyof GradeEntry)[] = ['devoir1', 'devoir2', 'devoir3', 'devoir4', 'devoir5'];
  fields.forEach((f, i) => { if (active[i] && entry[f] !== '') vals.push(Number(entry[f])); });
  if (entry.composition !== '') vals.push(Number(entry.composition));
  if (vals.length === 0) return '-';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
};

export default function TeacherNotes() {
  const { schoolAccount } = useAuth();
  const teacherEnrollmentId = schoolAccount?.teacherEnrollmentId;

  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<TeacherPeriod[]>([]);
  const [selPeriodId, setSelPeriodId] = useState<string | null>(null);
  const [mySubjects, setMySubjects] = useState<TeacherSubject[]>([]);

  useEffect(() => {
    if (!schoolAccount?.schoolId || !teacherEnrollmentId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const [pR, sR] = await Promise.all([
          supabase.from('grade_periods').select('id,name,ordering,type,academic_year_label').eq('school_id', schoolAccount.schoolId).order('ordering'),
          supabase.from('subjects').select('id,name,coefficient,class_id,period_id,classes(name)').eq('teacher_id', teacherEnrollmentId),
        ]);

        if (pR.data) {
          const mapped = pR.data.map(p => ({ id: p.id, name: p.name, ordering: p.ordering, type: p.type, academicYearLabel: p.academic_year_label }));
          setPeriods(mapped);
          if (mapped.length) setSelPeriodId(mapped[mapped.length - 1].id);
        }

        if (sR.data) setMySubjects(sR.data.filter(s => s.classes).map(s => {
          const c = s.classes as { name: string };
          return {
            id: s.id, name: s.name, coefficient: Number(s.coefficient),
            classId: s.class_id, className: c.name, periodId: s.period_id,
          };
        }));
      } catch { /**/ }
      finally { setLoading(false); }
    })();
  }, [schoolAccount?.schoolId, teacherEnrollmentId]);

  const periodSubjects = useMemo(() =>
    mySubjects.filter(s => s.periodId === selPeriodId)
      .sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name)),
    [mySubjects, selPeriodId],
  );
  const selectedPeriod = periods.find(p => p.id === selPeriodId);

  // ── Modale de saisie ────────────────────────────────────────────────────
  const [activeSubject, setActiveSubject] = useState<TeacherSubject | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [devoirActive, setDevoirActive] = useState<boolean[]>([true, true, true, false, false]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExam = selectedPeriod?.type === 'exam';

  const openSubject = useCallback(async (subject: TeacherSubject) => {
    setActiveSubject(subject);
    setRosterLoading(true);
    setRoster([]);
    setEntries([]);
    try {
      // Année de la période de cette matière — pas l'année sélectionnée dans le
      // navigateur (préférence locale par appareil, potentiellement obsolète).
      const subjectYearLabel = periods.find(p => p.id === subject.periodId)?.academicYearLabel ?? '';
      const [enrollRes, gradesRes, settingsRes] = await Promise.all([
        supabase.from('student_enrollments')
          .select('id, student_profiles(first_name,last_name)')
          .eq('class_id', subject.classId)
          .eq('academic_year_label', subjectYearLabel),
        supabase.from('grades')
          .select('student_enrollment_id,devoir1,devoir2,devoir3,devoir4,devoir5,composition,note')
          .eq('subject_id', subject.id),
        supabase.from('subject_settings')
          .select('devoir1_active,devoir2_active,devoir3_active,devoir4_active,devoir5_active')
          .eq('subject_id', subject.id)
          .maybeSingle(),
      ]);

      const students = (enrollRes.data ?? [])
        .filter(e => e.student_profiles)
        .map(e => {
          const p = e.student_profiles as { first_name: string; last_name: string };
          return { id: e.id, firstName: p.first_name, lastName: p.last_name };
        })
        .sort((a, b) => a.lastName.localeCompare(b.lastName));
      setRoster(students);

      if (settingsRes.data) {
        setDevoirActive([
          settingsRes.data.devoir1_active ?? true,
          settingsRes.data.devoir2_active ?? true,
          settingsRes.data.devoir3_active ?? true,
          settingsRes.data.devoir4_active ?? false,
          settingsRes.data.devoir5_active ?? false,
        ]);
      } else {
        setDevoirActive([true, true, true, false, false]);
      }

      const byStudent = new Map((gradesRes.data ?? []).map(g => [g.student_enrollment_id, g]));
      setEntries(students.map(s => {
        const g = byStudent.get(s.id);
        return {
          studentEnrollmentId: s.id,
          devoir1: g?.devoir1 != null ? String(g.devoir1) : '',
          devoir2: g?.devoir2 != null ? String(g.devoir2) : '',
          devoir3: g?.devoir3 != null ? String(g.devoir3) : '',
          devoir4: g?.devoir4 != null ? String(g.devoir4) : '',
          devoir5: g?.devoir5 != null ? String(g.devoir5) : '',
          composition: g?.composition != null ? String(g.composition) : '',
          note: g?.note != null ? String(g.note) : '',
        };
      }));
      setSaveState('idle');
    } finally {
      setRosterLoading(false);
    }
  }, [periods]);

  const closeSubject = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    setActiveSubject(null);
  };

  const saveEntries = useCallback(async (subjectId: string, list: GradeEntry[]) => {
    if (!schoolAccount?.schoolId) return;
    setSaveState('saving');
    try {
      const rows = list.map(e => ({
        school_id:             schoolAccount.schoolId,
        subject_id:            subjectId,
        student_enrollment_id: e.studentEnrollmentId,
        devoir1:     e.devoir1     ? Number(e.devoir1)     : null,
        devoir2:     e.devoir2     ? Number(e.devoir2)     : null,
        devoir3:     e.devoir3     ? Number(e.devoir3)     : null,
        devoir4:     e.devoir4     ? Number(e.devoir4)     : null,
        devoir5:     e.devoir5     ? Number(e.devoir5)     : null,
        composition: e.composition ? Number(e.composition) : null,
        note:        e.note        ? Number(e.note)        : null,
        updated_at:  new Date().toISOString(),
      }));
      const { error } = await supabase.from('grades').upsert(rows, { onConflict: 'school_id,subject_id,student_enrollment_id' });
      if (error) throw error;
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [schoolAccount?.schoolId]);

  const updateEntry = (studentEnrollmentId: string, field: keyof GradeEntry, value: string) => {
    if (field !== 'studentEnrollmentId' && value !== '' && (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 20)) return;
    const next = entries.map(e => e.studentEnrollmentId === studentEnrollmentId ? { ...e, [field]: value } : e);
    setEntries(next);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    if (!activeSubject) return;
    saveTimeout.current = setTimeout(() => saveEntries(activeSubject.id, next), 700);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] pb-10">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="px-4 pt-5">
        <h1 className="text-xl font-black text-gray-900">Saisie des notes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Vos matières, classe par classe</p>
      </div>

      {/* ── Period selector ───────────────────────────────────────────── */}
      {periods.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-4">
          {periods.map(p => {
            const active = selPeriodId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelPeriodId(p.id)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all',
                  active ? 'bg-[#4361ee] text-white shadow-md shadow-blue-200' : 'bg-white text-slate-500 border border-slate-200',
                )}
              >
                <CalendarDays className={cn('h-4 w-4', active ? 'text-white' : 'text-slate-400')} />
                {p.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Subject list ──────────────────────────────────────────────── */}
      <div className="px-4">
        {periodSubjects.length === 0 ? (
          <div className="bg-white rounded-3xl py-16 flex flex-col items-center gap-3 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-bold text-slate-600">Aucune matière assignée</p>
            <p className="text-sm text-slate-400 max-w-[240px] leading-relaxed">
              L'administration doit vous assigner une matière (dans une classe) pour que vous puissiez saisir des notes.
            </p>
          </div>
        ) : (
          periodSubjects.map((s, i) => (
            <button
              key={s.id}
              onClick={() => openSubject(s)}
              className={cn(
                'w-full bg-white rounded-2xl overflow-hidden text-left active:scale-[.98] transition-transform px-4 py-4 flex items-center gap-4',
                i > 0 && 'mt-3',
              )}
              style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
            >
              <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center bg-blue-500">
                <span className="text-white font-black text-lg leading-none">{s.name.trim().charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-[15px] truncate">{s.name}</p>
                <p className="text-[12px] text-slate-400 mt-0.5">{s.className} · Coef. {s.coefficient}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            </button>
          ))
        )}
      </div>

      {/* ── Modale de saisie ──────────────────────────────────────────── */}
      <Dialog open={!!activeSubject} onOpenChange={(open) => !open && closeSubject()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeSubject?.name}</DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>{activeSubject?.className} · {selectedPeriod?.name}</span>
              <span className="text-xs">
                {saveState === 'saving' && <span className="animate-pulse">Enregistrement...</span>}
                {saveState === 'saved' && <span className="flex items-center gap-1 text-green-600"><Check className="h-3.5 w-3.5" />Enregistré</span>}
                {saveState === 'error' && <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3.5 w-3.5" />Erreur</span>}
              </span>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Élève</th>
                    {isExam ? (
                      <th className="text-center py-2 px-1 font-medium text-muted-foreground">Note</th>
                    ) : (
                      <>
                        {devoirActive[0] && <th className="text-center py-2 px-1 font-medium text-muted-foreground">D1</th>}
                        {devoirActive[1] && <th className="text-center py-2 px-1 font-medium text-muted-foreground">D2</th>}
                        {devoirActive[2] && <th className="text-center py-2 px-1 font-medium text-muted-foreground">D3</th>}
                        {devoirActive[3] && <th className="text-center py-2 px-1 font-medium text-muted-foreground">D4</th>}
                        {devoirActive[4] && <th className="text-center py-2 px-1 font-medium text-muted-foreground">D5</th>}
                        <th className="text-center py-2 px-1 font-medium text-muted-foreground">Comp.</th>
                      </>
                    )}
                    <th className="text-center py-2 pl-1 font-medium text-muted-foreground">Moy.</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(student => {
                    const entry = entries.find(e => e.studentEnrollmentId === student.id);
                    if (!entry) return null;
                    const avg = calcAverage(entry, isExam, devoirActive);
                    const avgNum = parseFloat(avg);
                    const avgColor = !isNaN(avgNum) ? (avgNum >= 10 ? 'text-green-600' : 'text-red-500') : '';
                    const inputCls = 'w-14 text-center mx-auto h-8';

                    return (
                      <tr key={student.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-2">
                          <div className="font-medium leading-tight">{student.lastName}</div>
                          <div className="text-xs text-muted-foreground">{student.firstName}</div>
                        </td>
                        {isExam ? (
                          <td className="py-1.5 px-1">
                            <Input type="number" min="0" max="20" step="0.25" className={inputCls}
                              value={entry.note} onChange={e => updateEntry(student.id, 'note', e.target.value)} placeholder="-" />
                          </td>
                        ) : (
                          <>
                            {devoirActive[0] && <td className="py-1.5 px-1"><Input type="number" min="0" max="20" step="0.25" className={inputCls} value={entry.devoir1} onChange={e => updateEntry(student.id, 'devoir1', e.target.value)} placeholder="-" /></td>}
                            {devoirActive[1] && <td className="py-1.5 px-1"><Input type="number" min="0" max="20" step="0.25" className={inputCls} value={entry.devoir2} onChange={e => updateEntry(student.id, 'devoir2', e.target.value)} placeholder="-" /></td>}
                            {devoirActive[2] && <td className="py-1.5 px-1"><Input type="number" min="0" max="20" step="0.25" className={inputCls} value={entry.devoir3} onChange={e => updateEntry(student.id, 'devoir3', e.target.value)} placeholder="-" /></td>}
                            {devoirActive[3] && <td className="py-1.5 px-1"><Input type="number" min="0" max="20" step="0.25" className={inputCls} value={entry.devoir4} onChange={e => updateEntry(student.id, 'devoir4', e.target.value)} placeholder="-" /></td>}
                            {devoirActive[4] && <td className="py-1.5 px-1"><Input type="number" min="0" max="20" step="0.25" className={inputCls} value={entry.devoir5} onChange={e => updateEntry(student.id, 'devoir5', e.target.value)} placeholder="-" /></td>}
                            <td className="py-1.5 px-1"><Input type="number" min="0" max="20" step="0.25" className={inputCls} value={entry.composition} onChange={e => updateEntry(student.id, 'composition', e.target.value)} placeholder="-" /></td>
                          </>
                        )}
                        <td className={cn('py-1.5 pl-1 text-center font-semibold', avgColor)}>{avg}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
