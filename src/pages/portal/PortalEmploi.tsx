import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDonneesHorsLigne } from '@/hooks/useDonneesHorsLigne';
import { BandeauDonneesEnregistrees } from '@/components/BandeauDonneesEnregistrees';
import { cn } from '@/lib/utils';
import { CalendarDays, Loader2, Clock } from 'lucide-react';
import {
  SlotEvent,
  DAYS_LONG, DAYS_SHORT,
  TODAY_I, fmtTime, slotDuration, initials,
} from './portalHelpers';

// ─── Emploi du temps ──────────────────────────────────────────────────────────

export default function PortalEmploi() {
  const { schoolAccount, accountRole } = useAuth();

  const [selDay, setSelDay] = useState(TODAY_I >= 0 ? TODAY_I : 0);

  // Emploi du temps enregistré sur l'appareil : consultable sans réseau.
  const ecoleId = schoolAccount?.schoolId ?? '';
  const { donnees, chargement: loading, enregistreLe } = useDonneesHorsLigne<SlotEvent[]>(
    'portail-emploi',
    async () => {
      const { data } = await supabase
        .from('schedule_events')
        .select('id,day_index,start_time,end_time,subject_name,teacher_name,class_name,color,group_id,group_name')
        .eq('school_id', ecoleId);

      return (data ?? []).map(e => ({
        id: e.id, dayIndex: e.day_index, startTime: e.start_time, endTime: e.end_time,
        subjectName: e.subject_name, teacherName: e.teacher_name ?? '', className: e.class_name ?? undefined,
        color: e.color ?? '#3b82f6',
        // 'all' = toute la classe : pas d'étiquette, le cours concerne tout
        // le monde. Sinon on affiche le groupe pour que l'élève sache si le
        // cours le concerne (ex: « Groupe A »).
        groupId: e.group_id ?? 'all',
        groupName: e.group_name ?? '',
      }));
    },
    [ecoleId],
    !!ecoleId,
  );

  const schedule = donnees ?? [];

  const slots = useMemo(() =>
    schedule.filter(e => e.dayIndex === selDay).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [schedule, selDay],
  );

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
        <h1 className="text-xl font-black text-gray-900">Emploi du temps</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {accountRole === 'teacher' ? 'Vos cours' : 'Cours de votre classe'}
        </p>
      </div>

      {/* ── Day selector ──────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {DAYS_SHORT.map((d, i) => (
          <button
            key={i}
            onClick={() => setSelDay(i)}
            className={cn(
              'flex-shrink-0 flex flex-col items-center gap-0.5 min-w-[54px] px-3 py-2.5 rounded-2xl font-semibold text-sm transition-all',
              selDay === i
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : i === TODAY_I
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700',
            )}
          >
            <span>{d}</span>
            {i === TODAY_I && (
              <span className={cn(
                'text-[9px] font-bold px-1.5 rounded-full',
                selDay === i ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-600',
              )}>
                auj.
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Day header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-gray-900">{DAYS_LONG[selDay]}</h2>
        <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {slots.length} cours
        </span>
      </div>

      {/* ── Course list ───────────────────────────────────────────────── */}
      {slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
            <CalendarDays className="h-8 w-8 text-gray-300" />
          </div>
          <div>
            <p className="font-bold text-gray-600">Pas de cours ce jour</p>
            <p className="text-sm text-gray-400 mt-1">Profitez de votre journée libre 🎉</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {slots.map(ev => {
            const dur = slotDuration(ev.startTime, ev.endTime);
            const ini = ev.teacherName ? initials(ev.teacherName) : '';

            return (
              <div
                key={ev.id}
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
                style={{ borderLeftWidth: 4, borderLeftColor: ev.color }}
              >
                <div className="px-4 py-4 flex items-start gap-4">

                  {/* Time column */}
                  <div className="flex-shrink-0 flex flex-col items-center text-center w-14">
                    <span className="text-sm font-black text-gray-800">{fmtTime(ev.startTime)}</span>
                    <div className="w-px flex-1 min-h-[16px] bg-gray-100 my-1.5" />
                    {dur && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                        {dur}
                      </span>
                    )}
                    <div className="w-px flex-1 min-h-[16px] bg-gray-100 my-1.5" />
                    <span className="text-xs text-gray-400">{fmtTime(ev.endTime)}</span>
                  </div>

                  <div className="w-px self-stretch bg-gray-100 flex-shrink-0" />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-base text-gray-900 truncate">{ev.subjectName}</p>
                      {/* Cours réservé à un groupe : l'élève doit voir tout de
                          suite s'il n'est pas concerné, sinon il croit avoir
                          cours alors que non. */}
                      {ev.groupId && ev.groupId !== 'all' && ev.groupName && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">
                          {ev.groupName}
                        </span>
                      )}
                    </div>

                    {accountRole === 'teacher' ? (
                      ev.className && (
                        <div className="flex items-center gap-2 mt-2.5">
                          <span
                            className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: ev.color + '22', color: ev.color }}
                          >
                            {ev.className}
                          </span>
                        </div>
                      )
                    ) : ev.teacherName && (
                      <div className="flex items-center gap-2 mt-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: ev.color + '22' }}
                        >
                          <span className="text-[10px] font-bold" style={{ color: ev.color }}>{ini}</span>
                        </div>
                        <span className="text-sm text-gray-500 truncate">{ev.teacherName}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                      <span className="text-xs text-gray-400">
                        {fmtTime(ev.startTime)} – {fmtTime(ev.endTime)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
