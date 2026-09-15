import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubjectInfo { name: string; coefficient: number }

interface GradeData {
  devoir1: number | null; devoir2: number | null; devoir3: number | null;
  devoir4: number | null; devoir5: number | null;
  composition: number | null; note: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mention = (n: number | null) => {
  if (n == null) return { label: '—', color: '#94a3b8' };
  if (n >= 16)   return { label: 'Excellent',  color: '#10b981' };
  if (n >= 14)   return { label: 'Très bien',  color: '#22c55e' };
  if (n >= 12)   return { label: 'Bien',       color: '#3b82f6' };
  if (n >= 10)   return { label: 'Assez bien', color: '#f59e0b' };
  return           { label: 'Insuffisant', color: '#ef4444' };
};

const COLORS = ['#3b82f6','#8b5cf6','#f97316','#10b981','#ef4444','#06b6d4','#f59e0b','#ec4899','#14b8a6','#6366f1'];
const subjectColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

const calcMoyenne = (g: GradeData): number | null => {
  const vals = [g.devoir1, g.devoir2, g.devoir3, g.devoir4, g.devoir5, g.composition]
    .filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
};

// ─── Evaluation row ───────────────────────────────────────────────────────────

function EvalRow({ label, value, isCompo, isLast }: {
  label: string; value: number; isCompo?: boolean; isLast: boolean;
}) {
  const m   = mention(value);
  const pct = (value / 20) * 100;
  return (
    <div className={cn('px-4 py-4', !isLast && 'border-b border-slate-100')}>
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center text-xs font-black',
          isCompo ? 'bg-violet-100 text-violet-600' : 'bg-blue-50 text-blue-500',
        )}>
          {isCompo ? 'C' : label.replace('Devoir ', 'D')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{label}</p>
          <div className="mt-1.5 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: m.color }} />
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-black text-base leading-none" style={{ color: m.color }}>
            {value.toFixed(2)}<span className="text-xs text-slate-400 font-normal"> /20</span>
          </p>
          <p className="text-[11px] font-semibold mt-0.5" style={{ color: m.color }}>{m.label}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalSubjectDetail() {
  const { subjectId }              = useParams<{ subjectId: string }>();
  const navigate                   = useNavigate();
  const { schoolAccount, accountRole } = useAuth();

  const [subject,   setSubject]   = useState<SubjectInfo | null>(null);
  const [gradeData, setGradeData] = useState<GradeData | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!subjectId || accountRole !== 'student' || !schoolAccount?.studentEnrollmentId) {
      setLoading(false); return;
    }
    const eId = schoolAccount.studentEnrollmentId;

    (async () => {
      setLoading(true);
      try {
        const [sRes, gRes] = await Promise.all([
          supabase.from('subjects').select('name,coefficient').eq('id', subjectId).single(),
          supabase.from('grades')
            .select('devoir1,devoir2,devoir3,devoir4,devoir5,composition,note')
            .eq('subject_id', subjectId)
            .eq('student_enrollment_id', eId)
            .single(),
        ]);

        if (sRes.data) setSubject({
          name:        sRes.data.name,
          coefficient: sRes.data.coefficient ?? 1,
        });

        if (gRes.data) setGradeData({
          devoir1:     gRes.data.devoir1,
          devoir2:     gRes.data.devoir2,
          devoir3:     gRes.data.devoir3,
          devoir4:     gRes.data.devoir4,
          devoir5:     gRes.data.devoir5,
          composition: gRes.data.composition,
          note:        gRes.data.note,
        });
      } catch { /**/ }
      finally { setLoading(false); }
    })();
  }, [subjectId, schoolAccount?.studentEnrollmentId, accountRole]);

  if (loading) return (
    <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#4361ee]" />
    </div>
  );

  if (!subject) return (
    <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center">
      <p className="text-slate-400">Matière introuvable</p>
    </div>
  );

  const color   = subjectColor(subject.name);
  const moyenne = gradeData ? calcMoyenne(gradeData) : null;
  const display = gradeData?.note ?? moyenne;   // officielle sinon calculée
  const m       = mention(display);

  const evals = gradeData ? [
    { label: 'Devoir 1',    value: gradeData.devoir1,     isCompo: false },
    { label: 'Devoir 2',    value: gradeData.devoir2,     isCompo: false },
    { label: 'Devoir 3',    value: gradeData.devoir3,     isCompo: false },
    { label: 'Devoir 4',    value: gradeData.devoir4,     isCompo: false },
    { label: 'Devoir 5',    value: gradeData.devoir5,     isCompo: false },
    { label: 'Composition', value: gradeData.composition, isCompo: true  },
  ].filter((e): e is { label: string; value: number; isCompo: boolean } => e.value !== null) : [];

  const best  = evals.length ? Math.max(...evals.map(e => e.value)) : null;
  const worst = evals.length ? Math.min(...evals.map(e => e.value)) : null;

  return (
    <div className="min-h-screen bg-[#f0f4f8]">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto flex items-center gap-4 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
              <span className="text-white font-black text-sm">{subject.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate">{subject.name}</p>
              <p className="text-xs text-slate-400">Coef. {subject.coefficient}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto px-4 py-5 space-y-4">

        {/* ── Moyenne card ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 font-medium mb-3">Moyenne générale</p>
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black leading-none" style={{ fontSize: 48, color: m.color }}>
                  {display != null ? display.toFixed(2) : '—'}
                </span>
                <span className="text-slate-400 text-lg font-medium">/20</span>
              </div>
              <p className="text-sm font-bold mt-1" style={{ color: m.color }}>{m.label}</p>
            </div>
            {/* Mini circular indicator */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 border-4"
              style={{
                borderColor: display != null ? m.color : '#e2e8f0',
                backgroundColor: display != null ? m.color + '15' : '#f8fafc',
              }}
            >
              <span className="text-xs font-black" style={{ color: m.color }}>
                {display != null ? Math.round((display / 20) * 100) + '%' : '—'}
              </span>
            </div>
          </div>
          {/* Progress bar */}
          {display != null && (
            <div className="mt-4 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{ width: `${(display / 20) * 100}%`, backgroundColor: m.color }}
              />
            </div>
          )}
        </div>

        {/* ── Évaluations ──────────────────────────────────── */}
        {evals.length > 0 && (
          <div>
            <p className="font-bold text-slate-800 text-base mb-3">
              Notes par évaluation
              <span className="text-sm font-normal text-slate-400 ml-2">{evals.length} éval.</span>
            </p>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
              {evals.map((e, i) => (
                <EvalRow
                  key={e.label}
                  label={e.label}
                  value={e.value}
                  isCompo={e.isCompo}
                  isLast={i === evals.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Résumé (seulement si données disponibles) ────── */}
        {(best != null || worst != null) && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
            <div className="flex divide-x divide-slate-100">
              <div className="flex-1 p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Résumé</p>
                <p className="text-xs text-slate-500 mb-2">{evals.length} évaluation{evals.length > 1 ? 's' : ''}</p>
                <p className="font-black text-2xl" style={{ color: m.color }}>
                  {display != null ? display.toFixed(2) : '—'}
                  <span className="text-xs text-slate-400 font-normal"> /20</span>
                </p>
                <p className="text-xs font-bold mt-0.5" style={{ color: m.color }}>{m.label}</p>
              </div>
              <div className="flex-1 p-4 space-y-3">
                {best != null && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Meilleure note</p>
                    <p className="font-black text-xl mt-0.5" style={{ color: mention(best).color }}>
                      {best.toFixed(2)}<span className="text-xs text-slate-400 font-normal"> /20</span>
                    </p>
                  </div>
                )}
                {worst != null && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Plus basse note</p>
                    <p className="font-black text-xl mt-0.5" style={{ color: mention(worst).color }}>
                      {worst.toFixed(2)}<span className="text-xs text-slate-400 font-normal"> /20</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
