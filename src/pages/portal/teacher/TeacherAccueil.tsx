import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  GraduationCap, Loader2, BookOpen, CalendarDays, ClipboardList, ChevronRight, Users,
} from 'lucide-react';
import { DAYS_LONG, TODAY_I, fmtTime, initials } from '../portalHelpers';

interface TodaySlot { id: string; startTime: string; endTime: string; subjectName: string; className: string; color: string; }

export default function TeacherAccueil() {
  const { schoolAccount } = useAuth();
  const teacherEnrollmentId = schoolAccount?.teacherEnrollmentId;

  const [loading, setLoading] = useState(true);
  const [classCount, setClassCount] = useState(0);
  const [subjectCount, setSubjectCount] = useState(0);
  const [todaySlots, setTodaySlots] = useState<TodaySlot[]>([]);

  useEffect(() => {
    if (!schoolAccount?.schoolId || !teacherEnrollmentId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        // Classes/matières = ce que le prof enseigne réellement (son emploi du
        // temps), pas seulement les matières où l'admin l'a explicitement
        // assigné pour la saisie de notes (subjects.teacher_id) — sinon un prof
        // avec un emploi du temps mais pas encore de matière assignée voit "0"
        // partout alors qu'il a bien des cours.
        const { data } = await supabase
          .from('schedule_events')
          .select('id,day_index,start_time,end_time,subject_name,class_id,class_name,color')
          .eq('school_id', schoolAccount.schoolId);

        if (data) {
          setClassCount(new Set(data.map(e => e.class_id)).size);
          setSubjectCount(new Set(data.map(e => e.subject_name)).size);
          setTodaySlots(data
            .filter(e => e.day_index === TODAY_I)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map(e => ({
              id: e.id, startTime: e.start_time, endTime: e.end_time,
              subjectName: e.subject_name, className: e.class_name, color: e.color ?? '#3b82f6',
            })));
        }
      } catch { /**/ }
      finally { setLoading(false); }
    })();
  }, [schoolAccount?.schoolId, teacherEnrollmentId]);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  if (!schoolAccount || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Chargement…</p>
        </div>
      </div>
    );
  }

  const ini = initials(schoolAccount.displayName);

  return (
    <div className="px-4 pt-5 pb-6 space-y-5">

      {/* ── Identity hero card ─────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-violet-100">
        <div className="bg-gradient-to-br from-violet-600 to-violet-700 px-5 pt-5 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30
                            flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-white">{ini}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-violet-100 text-sm">{greeting} 👋</p>
              <p className="text-white font-bold text-xl leading-tight truncate">
                {schoolAccount.displayName}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-violet-50 px-5 py-2.5 flex items-center gap-3 text-sm border-t border-violet-100">
          <span className="flex items-center gap-1.5 font-semibold text-violet-700">
            <GraduationCap className="h-3.5 w-3.5" />
            Professeur
          </span>
          <span className="text-violet-400">•</span>
          <span className="text-violet-600 truncate text-xs">{schoolAccount.schoolName}</span>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Classes</p>
          <p className="text-2xl font-black text-gray-800 leading-none mt-1.5">{classCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">en charge</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Matières</p>
          <p className="text-2xl font-black text-gray-800 leading-none mt-1.5">{subjectCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">enseignées</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Aujourd'hui</p>
          <p className="text-2xl font-black text-gray-800 leading-none mt-1.5">{todaySlots.length}</p>
          <p className="text-[10px] text-gray-400 mt-1">cours</p>
        </div>
      </div>

      {/* ── Quick links ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: '/portail/notes',     label: 'Notes',      icon: <BookOpen className="h-5 w-5" />,      color: 'from-emerald-500 to-emerald-600' },
          { to: '/portail/emploi',    label: 'Emploi',     icon: <CalendarDays className="h-5 w-5" />,  color: 'from-violet-500 to-violet-600' },
          { to: '/portail/presences', label: 'Présences',  icon: <ClipboardList className="h-5 w-5" />, color: 'from-rose-500 to-rose-600' },
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded-2xl p-3.5 text-white bg-gradient-to-br shadow-sm flex flex-col items-center gap-2 text-center ${item.color}`}
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              {item.icon}
            </div>
            <span className="font-semibold text-xs leading-tight">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Cours du jour ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800 text-base">
            {TODAY_I < 0 ? 'Emploi du temps' : `Cours du ${DAYS_LONG[TODAY_I]}`}
          </h2>
          <Link to="/portail/emploi" className="text-xs text-blue-600 font-semibold flex items-center gap-0.5">
            Voir tout <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {TODAY_I < 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center text-sm text-gray-400">
            Pas de cours le dimanche 🎉
          </div>
        ) : todaySlots.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center text-sm text-gray-400">
            Pas de cours planifiés aujourd'hui
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50">
            {todaySlots.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 px-4 py-3.5" style={{ borderLeftWidth: 3, borderLeftColor: ev.color }}>
                <div className="flex-shrink-0 text-center w-14">
                  <p className="text-sm font-bold text-gray-800">{fmtTime(ev.startTime)}</p>
                  <p className="text-[10px] text-gray-400">{fmtTime(ev.endTime)}</p>
                </div>
                <div className="w-px h-9 bg-gray-100 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{ev.subjectName}</p>
                  <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                    <Users className="h-3 w-3" />
                    {ev.className}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
