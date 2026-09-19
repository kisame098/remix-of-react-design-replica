import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDonneesHorsLigne } from '@/hooks/useDonneesHorsLigne';
import { BandeauDonneesEnregistrees } from '@/components/BandeauDonneesEnregistrees';
import { cn } from '@/lib/utils';
import { ClipboardList, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Attendance, fmtDateFull, fmtTime } from './portalHelpers';
import TeacherPresences from './teacher/TeacherPresences';

// ─── Présences ────────────────────────────────────────────────────────────────

type Filter = 'all' | 'absent' | 'late';

const statusStyle = (status: string, justified: boolean) => {
  if (status === 'late') {
    return justified
      ? { label: 'Retard justifié', cls: 'bg-blue-50 text-blue-700 border-blue-200',   dot: 'bg-blue-500'  }
      : { label: 'Retard',          cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
  }
  return justified
    ? { label: 'Absence justifiée', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' }
    : { label: 'Absent',            cls: 'bg-red-50 text-red-700 border-red-200',           dot: 'bg-red-500'   };
};

export default function PortalPresences() {
  const { schoolAccount, accountRole } = useAuth();

  const [filter, setFilter] = useState<Filter>('all');

  // Présences enregistrées sur l'appareil : consultables sans réseau.
  const eleveId = schoolAccount?.studentEnrollmentId ?? '';
  const { donnees, chargement: loading, enregistreLe } = useDonneesHorsLigne<Attendance[]>(
    'portail-presences',
    async () => {
      const { data } = await supabase
        .from('student_attendances')
        .select('id,status,is_justified,justification,attendance_sessions(date,subject_name,start_time,end_time)')
        .eq('student_enrollment_id', eleveId)
        .order('recorded_at', { ascending: false });

      return (data ?? []).filter(a => a.attendance_sessions).map(a => {
        const sess = a.attendance_sessions as {
          date: string; subject_name: string; start_time: string; end_time: string;
        };
        return {
          id: a.id, status: a.status,
          isJustified:  a.is_justified  ?? false,
          justification: a.justification ?? null,
          date:        sess.date,
          subjectName: sess.subject_name,
          startTime:   sess.start_time,
          endTime:     sess.end_time,
        };
      });
    },
    [eleveId],
    accountRole === 'student' && !!eleveId,
  );

  const attendances = donnees ?? [];

  const total   = attendances.length;
  const present = attendances.filter(a => a.status === 'present').length;
  const absent  = attendances.filter(a => a.status === 'absent').length;
  const late    = attendances.filter(a => a.status === 'late').length;
  const rate    = total ? Math.round((present / total) * 100) : null;

  const displayed = useMemo(() => {
    if (filter === 'absent') return attendances.filter(a => a.status === 'absent');
    if (filter === 'late')   return attendances.filter(a => a.status === 'late');
    return attendances.filter(a => a.status !== 'present');
  }, [attendances, filter]);

  if (accountRole === 'teacher') return <TeacherPresences />;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-5 pb-6 space-y-5">

      <BandeauDonneesEnregistrees enregistreLe={enregistreLe} />

      {/* ── Page title ────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-black text-gray-900">Mes présences</h1>
        <p className="text-sm text-gray-400 mt-0.5">Suivi de votre assiduité</p>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
            <ClipboardList className="h-8 w-8 text-gray-300" />
          </div>
          <div>
            <p className="font-bold text-gray-600">Aucune donnée de présence</p>
            <p className="text-sm text-gray-400 mt-1">Vos présences et absences apparaîtront ici.</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Attendance rate card ───────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                  Taux de présence
                </p>
                {rate !== null ? (
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      'text-5xl font-black',
                      rate >= 80 ? 'text-emerald-600' :
                      rate >= 60 ? 'text-amber-500'   : 'text-red-500',
                    )}>
                      {rate}%
                    </span>
                  </div>
                ) : (
                  <p className="text-5xl font-black text-gray-200">—</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-gray-800">{present}</p>
                <p className="text-sm text-gray-400">/ {total} séances</p>
              </div>
            </div>

            {/* Progress bar */}
            {rate !== null && (
              <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className={cn(
                    'h-3 rounded-full transition-all duration-700',
                    rate >= 80 ? 'bg-emerald-500' :
                    rate >= 60 ? 'bg-amber-400'   : 'bg-red-500',
                  )}
                  style={{ width: `${rate}%` }}
                />
              </div>
            )}
          </div>

          {/* ── Stats row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col items-center gap-1.5 shadow-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span className="text-2xl font-black text-emerald-600">{present}</span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Présences</span>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex flex-col items-center gap-1.5 shadow-sm">
              <XCircle className="h-5 w-5 text-red-400" />
              <span className="text-2xl font-black text-red-600">{absent}</span>
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Absences</span>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col items-center gap-1.5 shadow-sm">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-black text-amber-600">{late}</span>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">Retards</span>
            </div>
          </div>

          {/* ── History ───────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Historique</h2>

              {/* Filter pills */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {([
                  ['all',    'Tout'],
                  ['absent', 'Absences'],
                  ['late',   'Retards'],
                ] as [Filter, string][]).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                      filter === k
                        ? 'bg-white shadow text-gray-800'
                        : 'text-gray-400 hover:text-gray-600',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {displayed.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
                <p className="text-sm text-gray-400">Aucun enregistrement dans cette catégorie</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                {displayed.map((a, i) => {
                  const si = statusStyle(a.status, a.isJustified);
                  return (
                    <div key={a.id} className={cn('px-4 py-4', i > 0 && 'border-t border-gray-50')}>

                      {/* Subject + status badge */}
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-sm text-gray-900 flex-1 truncate">
                          {a.subjectName || 'Cours'}
                        </p>
                        <span className={cn(
                          'flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border',
                          si.cls,
                        )}>
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', si.dot)} />
                          {si.label}
                        </span>
                      </div>

                      {/* Date + time */}
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                        <span>{fmtDateFull(a.date)}</span>
                        {a.startTime && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-gray-200 flex-shrink-0" />
                            <span>
                              {fmtTime(a.startTime)}{a.endTime ? ` – ${fmtTime(a.endTime)}` : ''}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Justification */}
                      {a.justification && (
                        <div className="mt-2.5 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-500">
                            <span className="font-semibold text-gray-700">Motif : </span>
                            {a.justification}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
