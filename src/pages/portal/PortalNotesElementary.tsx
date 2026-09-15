import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Loader2, CalendarDays, FileDown, ChevronRight } from 'lucide-react';
import { generateElementaryBulletinsPdf, type ElementaryBulletinPdfData } from '@/lib/elementaryBulletinPdf';
import { DOMAINE_LABELS, REGISTRE_LABELS, ElementaryDomaine, ElementaryRegistre } from '@/lib/elementaryDefaults';
import { periodesDeLEleve, periodeParDefaut } from '@/lib/studentPeriods';

// Tables élémentaire pas encore dans le Database type généré — même accès non
// typé que SchoolContext.tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ─── Portail élève — élémentaire (CI-CM2) ────────────────────────────────────
// Système à barème de points, sans coefficients : rien à voir avec l'écran
// collège/lycée (devoirs + composition + coefficients). Une discipline vaut un
// nombre de points fixe ; la moyenne ramène le total obtenu sur 10 en ne
// comptant QUE les disciplines réellement notées (voir useElementaryClassRanking,
// même formule côté administration pour donner exactement les mêmes chiffres).

interface Period { id: string; name: string; ordering: number }

interface DisciplineRow {
  id: string;
  name: string;
  domaine: ElementaryDomaine;
  registre: ElementaryRegistre;
  pointMax: number;
  periodId: string;
  points?: number;     // undefined = pas encore noté
  exempted: boolean;   // dispensé (ex: inapte EPS) → hors calcul
}

const mention = (moy: number | null) => {
  if (moy == null) return { label: '—', color: '#94a3b8' };
  if (moy >= 8)   return { label: 'Excellent',   color: '#10b981' };
  if (moy >= 7)   return { label: 'Très bien',   color: '#22c55e' };
  if (moy >= 6)   return { label: 'Bien',        color: '#3b82f6' };
  if (moy >= 5)   return { label: 'Assez bien',  color: '#f59e0b' };
  return            { label: 'Insuffisant', color: '#ef4444' };
};

const REGISTRE_ORDER: ElementaryRegistre[] = ['COMPETENCE', 'RESSOURCES'];

export default function PortalNotesElementary() {
  const { schoolAccount } = useAuth();

  const [periods, setPeriods]   = useState<Period[]>([]);
  const [rows, setRows]         = useState<DisciplineRow[]>([]);
  const [selId, setSelId]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  // Bulletins publiés par l'administration — instantanés figés. La RLS ne
  // laisse jamais un élève lire ceux des autres.
  const [bulletins, setBulletins] = useState<{ periodId: string; data: ElementaryBulletinPdfData }[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const eId = schoolAccount?.studentEnrollmentId;
    const sId = schoolAccount?.schoolId;
    if (!eId || !sId) { setLoading(false); return; }

    (async () => {
      setLoading(true);
      try {
        const [pR, lR, gR, xR, pcR, seR, bR] = await Promise.all([
          supabase.from('grade_periods').select('id,name,ordering').eq('school_id', sId).order('ordering'),
          // RLS : l'élève ne voit que les disciplines de SA classe.
          sb.from('elementary_class_lines').select('id,name,domaine,registre,point_max,period_id,ordering').order('ordering'),
          sb.from('elementary_grades').select('line_id,points_obtenus').eq('student_enrollment_id', eId),
          sb.from('elementary_student_line_settings').select('line_id,active').eq('student_enrollment_id', eId),
          // Quelles périodes concernent SA classe : une école peut faire
          // travailler le CI sur 2 trimestres et le CM2 sur 3.
          supabase.from('grade_period_classes').select('period_id,class_id').eq('school_id', sId),
          supabase.from('student_enrollments').select('class_id').eq('id', eId).maybeSingle(),
          supabase.from('published_bulletins').select('period_id,data')
            .eq('student_enrollment_id', eId),
        ]);

        if (pR.data) {
          // Ne garder que les périodes où sa classe est inscrite : lui montrer
          // les autres n'afficherait que des écrans vides.
          const siennes = periodesDeLEleve(
            pR.data.map(p => ({ id: p.id, name: p.name, ordering: p.ordering })),
            (pcR.data ?? []).map(l => ({ periodId: l.period_id, classId: l.class_id })),
            seR.data?.class_id ?? null,
          );
          setPeriods(siennes);
          setSelId(periodeParDefaut(siennes)?.id ?? null);
        }

        const pointsByLine = new Map<string, number>(
          (gR.data ?? [])
            .filter((g: { points_obtenus: number | null }) => g.points_obtenus != null)
            .map((g: { line_id: string; points_obtenus: number }) => [g.line_id, Number(g.points_obtenus)]),
        );
        const exemptedLines = new Set<string>(
          (xR.data ?? [])
            .filter((s: { active: boolean }) => s.active === false)
            .map((s: { line_id: string }) => s.line_id),
        );

        setBulletins((bR.data ?? []).map(row => ({
          periodId: row.period_id,
          data: row.data as unknown as ElementaryBulletinPdfData,
        })));

        setRows((lR.data ?? []).map((l: Record<string, unknown>) => ({
          id:       l.id as string,
          name:     l.name as string,
          domaine:  l.domaine as ElementaryDomaine,
          registre: l.registre as ElementaryRegistre,
          pointMax: Number(l.point_max),
          periodId: l.period_id as string,
          points:   pointsByLine.get(l.id as string),
          exempted: exemptedLines.has(l.id as string),
        })));
      } catch { /**/ }
      finally { setLoading(false); }
    })();
  }, [schoolAccount?.studentEnrollmentId, schoolAccount?.schoolId]);

  const telechargerBulletin = async (bulletin: { data: ElementaryBulletinPdfData }) => {
    setDownloading(true);
    try {
      const doc = await generateElementaryBulletinsPdf([bulletin.data]);
      const nom = `Bulletin_${bulletin.data.student.lastName}_${bulletin.data.student.firstName}_${bulletin.data.periodName}`
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
      doc.save(`${nom}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  // ── Dérivé ────────────────────────────────────────────────────────────────
  const periodRows = useMemo(() => rows.filter(r => r.periodId === selId), [rows, selId]);

  const { moyenne, obtenus, maximum, notedCount } = useMemo(() => {
    let o = 0, m = 0, n = 0;
    for (const r of periodRows) {
      if (r.exempted || r.points === undefined) continue;  // non noté ou dispensé → exclu des DEUX sommes
      o += r.points; m += r.pointMax; n++;
    }
    return {
      obtenus: o, maximum: m, notedCount: n,
      moyenne: m > 0 ? Math.min(10, Math.max(0, (o * 10) / m)) : null,
    };
  }, [periodRows]);

  const mt = mention(moyenne);
  const selectedPeriod = periods.find(p => p.id === selId);

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f0f4f8] pb-10">

      {/* ── Moyenne générale ─────────────────────────────────────── */}
      <div className="px-4 pt-5">
        <div
          className="rounded-3xl p-5 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #4361ee 0%, #4895ef 100%)' }}
        >
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10 bg-white" />
          <div className="absolute -right-4 -bottom-10 w-28 h-28 rounded-full opacity-10 bg-white" />

          <div className="relative z-10">
            <p className="text-white/80 text-sm font-medium">Moyenne générale</p>
            {selectedPeriod && <p className="text-white/60 text-xs mt-0.5">{selectedPeriod.name}</p>}
          </div>

          <div className="flex items-end gap-2 relative z-10 mt-4">
            <p className="text-white font-black leading-none" style={{ fontSize: 52 }}>
              {moyenne != null ? moyenne.toFixed(2) : '—'}
            </p>
            {moyenne != null && <p className="text-white/60 text-lg font-medium mb-2">/10</p>}
          </div>

          {moyenne != null && (
            <div className="flex items-center gap-3 mt-3 relative z-10 flex-wrap">
              <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{mt.label}</span>
              <span className="text-white/70 text-xs">{obtenus} / {maximum} points</span>
              <span className="text-white/70 text-xs">
                {notedCount} discipline{notedCount > 1 ? 's' : ''} notée{notedCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Sélecteur de période ─────────────────────────────────── */}
      {periods.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-4">
          {periods.map(p => {
            const active = selId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelId(p.id)}
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

      {/* ── Bulletin publié — visible seulement si l'école l'a publié ── */}
      {(() => {
        const bulletin = bulletins.find(b => b.periodId === selId);
        if (!bulletin) return null;
        return (
          <div className="px-4 pb-4">
            <button
              onClick={() => telechargerBulletin(bulletin)}
              disabled={downloading}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[.98] transition-transform disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                {downloading
                  ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                  : <FileDown className="h-5 w-5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Télécharger mon bulletin</p>
                <p className="text-xs text-white/80 mt-0.5">{bulletin.data.periodName} — PDF officiel</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/80 flex-shrink-0" />
            </button>
          </div>
        );
      })()}

      {/* ── Disciplines, groupées par registre ───────────────────── */}
      <div className="px-4 space-y-4">
        {periodRows.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <p className="text-sm text-slate-500">Aucune discipline pour cette période.</p>
          </div>
        ) : REGISTRE_ORDER.map(registre => {
          const group = periodRows.filter(r => r.registre === registre);
          if (group.length === 0) return null;
          const gObtenus = group.reduce((s, r) => s + (r.exempted ? 0 : r.points ?? 0), 0);
          const gMax     = group.reduce((s, r) => s + (r.exempted ? 0 : r.pointMax), 0);

          return (
            <div key={registre}>
              <div className="flex items-center justify-between px-1 mb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {REGISTRE_LABELS[registre]}
                </p>
                <p className="text-xs font-semibold text-slate-400">{gObtenus} / {gMax} pts</p>
              </div>

              <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                {group.map((r, i) => {
                  const pct = r.points !== undefined && r.pointMax > 0 ? (r.points / r.pointMax) * 100 : 0;
                  return (
                    <div key={r.id} className={cn('px-4 py-3', i !== group.length - 1 && 'border-b border-slate-100')}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={cn('text-sm font-semibold truncate', r.exempted ? 'text-slate-400' : 'text-slate-800')}>
                            {r.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">{DOMAINE_LABELS[r.domaine]}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {r.exempted ? (
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              Dispensé
                            </span>
                          ) : r.points === undefined ? (
                            <span className="text-xs text-slate-400">Pas encore noté</span>
                          ) : (
                            <p className="text-sm font-black text-slate-800">
                              {r.points}<span className="text-slate-400 font-medium"> / {r.pointMax}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {!r.exempted && r.points !== undefined && (
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: pct >= 50 ? '#22c55e' : '#f59e0b' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
