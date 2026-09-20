import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDonneesHorsLigne } from '@/hooks/useDonneesHorsLigne';
import { BandeauDonneesEnregistrees } from '@/components/BandeauDonneesEnregistrees';
import { cn } from '@/lib/utils';
import {
  GraduationCap, Loader2, Clock, BookOpen, CalendarDays,
  CreditCard, ClipboardList, ChevronRight,
} from 'lucide-react';
import {
  GradePeriod, SubjectGrade, SlotEvent, Attendance,
  DAYS_LONG, MONTHS_FULL, TODAY_I,
  fmtTime, fmtGrade, fmtAmount,
  gradeLevel, GP, initials,
} from './portalHelpers';
import TeacherAccueil from './teacher/TeacherAccueil';
import { moyennePubliee, type BulletinPublieBrut } from '@/lib/moyennePubliee';

// ─── Accueil (Dashboard) ──────────────────────────────────────────────────────

export default function PortalAccueil() {
  const { schoolAccount, accountRole } = useAuth();

  // ── Chargement, avec ou sans réseau ─────────────────────────────────────
  // Chaque chargement réussi est enregistré sur l'appareil, pour ce compte :
  // l'élève retrouve son accueil sans connexion, daté à l'écran.
  // Voir src/hooks/useDonneesHorsLigne.ts et src/lib/cacheHorsLigne.ts.
  const eleveId = schoolAccount?.studentEnrollmentId ?? '';
  const ecoleId = schoolAccount?.schoolId ?? '';

  const { donnees, chargement: loading, enregistreLe } = useDonneesHorsLigne<{
    periods: GradePeriod[];
    grades: SubjectGrade[];
    schedule: SlotEvent[];
    attendances: Attendance[];
    bulletins: BulletinPublieBrut[];
  }>(
    'portail-accueil',
    async () => {
      const [pR, gR, schR, aR, bulR] = await Promise.all([
        supabase.from('grade_periods').select('id,name,ordering').eq('school_id', ecoleId).order('ordering'),
        supabase.from('grades')
          .select('id,subject_id,devoir1,devoir2,devoir3,devoir4,devoir5,composition,note,subjects(id,name,coefficient,period_id)')
          .eq('student_enrollment_id', eleveId),
        supabase.from('schedule_events')
          .select('id,day_index,start_time,end_time,subject_name,teacher_name,color')
          .eq('school_id', ecoleId),
        supabase.from('student_attendances')
          .select('id,status,attendance_sessions(date,subject_name,start_time,end_time)')
          .eq('student_enrollment_id', eleveId),
        // La moyenne de l'accueil vient du bulletin PUBLIÉ, jamais des notes
        // en cours de saisie. RLS : un élève ne lit que son propre bulletin.
        supabase.from('published_bulletins').select('period_id, data').eq('student_enrollment_id', eleveId),
      ]);

      return {
        bulletins: (bulR.data ?? []).map(b => ({ periodId: b.period_id, data: b.data })),
        periods: (pR.data ?? []).map(p => ({ id: p.id, name: p.name, ordering: p.ordering })),

        grades: (gR.data ?? []).filter(g => g.subjects).map(g => {
          const s = g.subjects as { id: string; name: string; coefficient: number; period_id: string };
          return {
            id: g.id, subjectId: g.subject_id, subjectName: s.name,
            coefficient: s.coefficient ?? 1, periodId: s.period_id,
            devoir1:     g.devoir1,
            devoir2:     g.devoir2,
            devoir3:     g.devoir3,
            devoir4:     g.devoir4,
            devoir5:     g.devoir5,
            composition: g.composition,
            note:        g.note,
          };
        }),

        schedule: (schR.data ?? []).map(e => ({
          id: e.id, dayIndex: e.day_index, startTime: e.start_time, endTime: e.end_time,
          subjectName: e.subject_name, teacherName: e.teacher_name ?? '', color: e.color ?? '#3b82f6',
        })),

        attendances: (aR.data ?? []).filter(a => a.attendance_sessions).map(a => {
          const sess = a.attendance_sessions as { date: string; subject_name: string; start_time: string; end_time: string };
          return {
            id: a.id, status: a.status, isJustified: false, justification: null,
            date: sess.date, subjectName: sess.subject_name, startTime: sess.start_time, endTime: sess.end_time,
          };
        }),
      };
    },
    [eleveId, ecoleId],
    accountRole === 'student' && !!eleveId,
  );

  const periods     = donnees?.periods     ?? [];
  const grades      = donnees?.grades      ?? [];
  const schedule    = donnees?.schedule    ?? [];
  const attendances = donnees?.attendances ?? [];
  const bulletins   = donnees?.bulletins   ?? [];

  // ── Computed ──────────────────────────────────────────────────────────────

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const avgInfo = useMemo(() => moyennePubliee(bulletins, periods), [bulletins, periods]);

  const todaySlots = useMemo(() =>
    schedule.filter(e => e.dayIndex === TODAY_I).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [schedule],
  );

  const attTotal   = attendances.length;
  const attPresent = attendances.filter(a => a.status === 'present').length;
  const attRate    = attTotal ? Math.round((attPresent / attTotal) * 100) : null;

  const recentGrades = grades.filter(g => g.note !== null).slice(0, 4);
  const subjectCount = new Set(grades.map(g => g.subjectId)).size;

  if (accountRole === 'teacher') return <TeacherAccueil />;

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
  const pal = GP[gradeLevel(avgInfo ? (avgInfo.moyenne * 20) / avgInfo.sur : null)];

  return (
    <div className="px-4 pt-5 pb-6 space-y-5">

      <BandeauDonneesEnregistrees enregistreLe={enregistreLe} />

      {/* ── Identity hero card ─────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-blue-100">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 pt-5 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30
                            flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-white">{ini}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-blue-100 text-sm">{greeting} 👋</p>
              <p className="text-white font-bold text-xl leading-tight truncate">
                {schoolAccount.displayName}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 px-5 py-2.5 flex items-center gap-3 text-sm border-t border-blue-100">
          {schoolAccount.className && (
            <span className="flex items-center gap-1.5 font-semibold text-blue-700">
              <GraduationCap className="h-3.5 w-3.5" />
              {schoolAccount.className}
            </span>
          )}
          <span className="text-blue-400">•</span>
          <span className="text-blue-600 truncate text-xs">{schoolAccount.schoolName}</span>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Moyenne */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Moyenne</p>
          {avgInfo ? (
            <>
              <p className={cn('text-2xl font-black leading-none mt-1.5', pal.text)}>
                {avgInfo.moyenne.toFixed(2)}
                <span className="text-xs font-semibold text-gray-400">/{avgInfo.sur}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-1 truncate">{avgInfo.periodName}</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-black text-gray-300 mt-1.5">—</p>
              <p className="text-[10px] text-gray-400 mt-1">Bulletin non publié</p>
            </>
          )}
        </div>

        {/* Présence */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Présence</p>
          <p className={cn(
            'text-2xl font-black leading-none mt-1.5',
            attRate == null ? 'text-gray-300' :
            attRate >= 80   ? 'text-emerald-600' :
            attRate >= 60   ? 'text-amber-500' : 'text-red-500',
          )}>
            {attRate != null ? `${attRate}%` : '—'}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">{attTotal} séances</p>
        </div>

        {/* Matières */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Matières</p>
          <p className="text-2xl font-black text-gray-800 leading-none mt-1.5">{subjectCount}</p>
          <p className="text-[10px] text-gray-400 mt-1">inscrits</p>
        </div>
      </div>

      {/* ── Quick links ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { to:'/portail/notes',     label:'Mes notes',          icon:<BookOpen className="h-5 w-5"/>,     color:'from-emerald-500 to-emerald-600' },
          { to:'/portail/emploi',    label:'Emploi du temps',    icon:<CalendarDays className="h-5 w-5"/>, color:'from-violet-500 to-violet-600'   },
          { to:'/portail/paiements', label:'Paiements',          icon:<CreditCard className="h-5 w-5"/>,   color:'from-amber-500 to-amber-600'     },
          { to:'/portail/presences', label:'Présences',          icon:<ClipboardList className="h-5 w-5"/>,color:'from-rose-500 to-rose-600'       },
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'rounded-2xl p-4 text-white bg-gradient-to-br shadow-sm flex items-center gap-3',
              item.color,
            )}
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              {item.icon}
            </div>
            <span className="font-semibold text-sm leading-tight">{item.label}</span>
            <ChevronRight className="h-4 w-4 ml-auto opacity-70" />
          </Link>
        ))}
      </div>

      {/* ── Cours du jour ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800 text-base">
            {TODAY_I < 0
              ? 'Emploi du temps'
              : `Cours du ${DAYS_LONG[TODAY_I]}`}
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
              <div key={ev.id} className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderLeftWidth: 3, borderLeftColor: ev.color }}>
                <div className="flex-shrink-0 text-center w-14">
                  <p className="text-sm font-bold text-gray-800">{fmtTime(ev.startTime)}</p>
                  <p className="text-[10px] text-gray-400">{fmtTime(ev.endTime)}</p>
                </div>
                <div className="w-px h-9 bg-gray-100 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{ev.subjectName}</p>
                  {ev.teacherName && (
                    <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {ev.teacherName}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Dernières notes ────────────────────────────────────────────── */}
      {recentGrades.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 text-base">Dernières notes</h2>
            <Link to="/portail/notes" className="text-xs text-blue-600 font-semibold flex items-center gap-0.5">
              Voir tout <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            {recentGrades.map((g, i) => {
              const lp = GP[gradeLevel(g.note)];
              return (
                <div key={g.id} className={cn('flex items-center gap-4 px-4 py-3.5', i > 0 && 'border-t border-gray-50')}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{g.subjectName}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Coeff. {g.coefficient}</p>
                  </div>
                  <div className={cn('flex items-baseline gap-0.5 px-3 py-1.5 rounded-xl border flex-shrink-0', lp.bg, lp.border)}>
                    <span className={cn('text-base font-black', lp.text)}>{fmtGrade(g.note)}</span>
                    <span className="text-[11px] text-gray-400">/20</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
