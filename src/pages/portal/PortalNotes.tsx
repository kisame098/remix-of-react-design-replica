import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDonneesHorsLigne } from '@/hooks/useDonneesHorsLigne';
import { BandeauDonneesEnregistrees } from '@/components/BandeauDonneesEnregistrees';
import { cn } from '@/lib/utils';
import {
  Loader2, ChevronRight, CalendarDays, TrendingUp, Star, Trophy, ListChecks, FileDown,
} from 'lucide-react';
import { GradePeriod, SubjectGrade, weightedAvg } from './portalHelpers';
import { generateBulletinsPdf, BulletinPdfData } from '@/lib/bulletinPdf';
import TeacherNotes from './teacher/TeacherNotes';
import PortalNotesElementary from './PortalNotesElementary';
import { NIVEAUX_ELEMENTAIRE } from '@/lib/elementaryDefaults';
import { periodesDeLEleve, periodeParDefaut } from '@/lib/studentPeriods';

interface PublishedBulletin {
  periodId: string;
  data: BulletinPdfData;
}

// ─── Mention system ───────────────────────────────────────────────────────────

const mention = (n: number | null) => {
  if (n == null) return { label: '—',          color: '#94a3b8' };
  if (n >= 16)   return { label: 'Excellent',   color: '#10b981' };
  if (n >= 14)   return { label: 'Très bien',   color: '#22c55e' };
  if (n >= 12)   return { label: 'Bien',        color: '#3b82f6' };
  if (n >= 10)   return { label: 'Assez bien',  color: '#f59e0b' };
  return           { label: 'Insuffisant',  color: '#ef4444' };
};

// ─── Calcul moyenne simple des évaluations ────────────────────────────────────

const calcMoyenne = (g: SubjectGrade): number | null => {
  const vals = [g.devoir1, g.devoir2, g.devoir3, g.devoir4, g.devoir5, g.composition]
    .filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
};

// ─── Subject color (deterministic) ───────────────────────────────────────────

const COLORS = [
  '#3b82f6','#8b5cf6','#f97316','#10b981',
  '#ef4444','#06b6d4','#f59e0b','#ec4899',
  '#14b8a6','#6366f1',
];
const subjectColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

// ─── Subject card — clique → page détail ──────────────────────────────────────

function SubjectCard({ g, isLast, onPress }: {
  g: SubjectGrade; isLast: boolean; onPress: () => void;
}) {
  const color   = subjectColor(g.subjectName);
  const moyenne = calcMoyenne(g);
  const display = g.note ?? moyenne;
  const m       = mention(display);
  const pct     = display != null ? (display / 20) * 100 : 0;
  const evalCount = [g.devoir1, g.devoir2, g.devoir3, g.devoir4, g.devoir5, g.composition]
    .filter(v => v !== null).length;

  return (
    <button
      onClick={onPress}
      className={cn(
        'w-full bg-white rounded-2xl overflow-hidden text-left',
        'active:scale-[.98] transition-transform',
        !isLast && 'mb-3',
      )}
      style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
    >
      {/* ── Main row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 pt-4 pb-3">
        <div
          className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center"
          style={{ backgroundColor: color }}
        >
          <span className="text-white font-black text-lg leading-none">
            {g.subjectName.trim().charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-[15px] truncate">{g.subjectName}</p>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Coef. {g.coefficient}
            {evalCount > 0 && (
              <span className="ml-2 text-slate-300">· {evalCount} éval.</span>
            )}
          </p>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          <div className="text-right">
            <p className="text-[20px] font-black leading-none" style={{ color: m.color }}>
              {display != null ? display.toFixed(2) : '—'}
              <span className="text-[11px] text-slate-400 font-normal"> /20</span>
            </p>
            <p className="text-[11px] font-semibold mt-0.5" style={{ color: m.color }}>
              {m.label}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────── */}
      <div className="mx-4 mb-3.5 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: m.color }}
        />
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalNotes() {
  const { schoolAccount, accountRole } = useAuth();
  const navigate = useNavigate();

  const [selId, setSelId] = useState<string | null>(null);
  const [pendingFiliereChoice, setPendingFiliereChoice] = useState(false);
  const [downloadingBulletin, setDownloadingBulletin] = useState(false);

  // ── Notes disponibles hors connexion ────────────────────────────────────
  // Niveau de la classe, périodes, notes et bulletins publiés sont enregistrés
  // sur l'appareil, pour ce compte : l'élève consulte ses notes sans réseau,
  // et peut même retélécharger un bulletin déjà publié.
  const eleveId = schoolAccount?.studentEnrollmentId ?? '';
  const ecoleId = schoolAccount?.schoolId ?? '';
  const estEleve = accountRole === 'student' && !!eleveId;

  const { donnees, chargement: loading, enregistreLe } = useDonneesHorsLigne<{
    isElementary: boolean;
    periods: GradePeriod[];
    grades: SubjectGrade[];
    publishedBulletins: PublishedBulletin[];
  }>(
    'portail-notes',
    async () => {
      const { data: enr } = await supabase
        .from('student_enrollments').select('class_id')
        .eq('id', eleveId).maybeSingle();
      const classeId = enr?.class_id ?? null;

      // maybeSingle : une classe illisible ne doit pas jeter. La policy de
      // `classes` ouvre SA classe à l'élève — sans quoi le niveau restait
      // inconnu et un CI-CM2 recevait l'écran collège, donc aucune note.
      const cls = classeId
        ? (await supabase.from('classes').select('niveau').eq('id', classeId).maybeSingle()).data
        : null;

      const [bulR, pR, gR, pcR] = await Promise.all([
        // Un élève ne voit JAMAIS que son bulletin : filtré côté serveur par
        // RLS sur student_enrollment_id, pas seulement ici.
        supabase.from('published_bulletins').select('period_id, data').eq('student_enrollment_id', eleveId),
        supabase.from('grade_periods').select('id,name,ordering').eq('school_id', ecoleId).order('ordering'),
        supabase.from('grades')
          .select('id,subject_id,devoir1,devoir2,devoir3,devoir4,devoir5,composition,note,subjects(id,name,coefficient,period_id)')
          .eq('student_enrollment_id', eleveId),
        // Quelles périodes concernent SA classe : le collège peut travailler
        // en 3 trimestres pendant que le lycée en fait 2.
        supabase.from('grade_period_classes').select('period_id,class_id').eq('school_id', ecoleId),
      ]);

      // Une période où sa classe n'est pas inscrite n'afficherait qu'un écran
      // vide — il croirait ses notes disparues.
      const periods = periodesDeLEleve(
        (pR.data ?? []).map(p => ({ id: p.id, name: p.name, ordering: p.ordering })),
        (pcR.data ?? []).map(l => ({ periodId: l.period_id, classId: l.class_id })),
        classeId,
      );

      return {
        isElementary: !!cls?.niveau && (NIVEAUX_ELEMENTAIRE as readonly string[]).includes(cls.niveau),
        periods,
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
        publishedBulletins: (bulR.data ?? []).map(row => ({
          periodId: row.period_id, data: row.data as unknown as BulletinPdfData,
        })),
      };
    },
    [eleveId, ecoleId],
    estEleve,
  );

  // null = niveau encore inconnu (écran d'attente) ; false pour un professeur,
  // qui a son propre écran.
  const isElementary = donnees ? donnees.isElementary : (estEleve ? null : false);
  const periods = donnees?.periods ?? [];
  const grades  = donnees?.grades  ?? [];
  const publishedBulletins = donnees?.publishedBulletins ?? [];

  // Période affichée par défaut, sans écraser le choix de l'élève.
  useEffect(() => {
    if (!donnees) return;
    setSelId(actuel => actuel && donnees.periods.some(p => p.id === actuel)
      ? actuel
      : periodeParDefaut(donnees.periods)?.id ?? null);
  }, [donnees]);





  const handleDownloadBulletin = async (bulletin: PublishedBulletin) => {
    setDownloadingBulletin(true);
    try {
      const doc = await generateBulletinsPdf([bulletin.data]);
      const sanitize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');
      doc.save(`${sanitize(`Bulletin_${bulletin.data.student.lastName}_${bulletin.data.student.firstName}_${bulletin.data.periodName}`)}.pdf`);
    } finally {
      setDownloadingBulletin(false);
    }
  };

  // Bannière "choisissez vos matières optionnelles" — visible seulement si la
  // classe de l'élève a une filière assignée avec au moins un créneau non résolu.
  useEffect(() => {
    if (accountRole !== 'student' || !schoolAccount?.studentEnrollmentId) return;

    (async () => {
      const { data: enr } = await supabase
        .from('student_enrollments')
        .select('class_id, academic_year_label')
        .eq('id', schoolAccount.studentEnrollmentId)
        .single();
      if (!enr?.class_id) return;

      const { data: cls } = await supabase.from('classes').select('niveau').eq('id', enr.class_id).single();
      if (!cls?.niveau) return;

      const { data: assignment } = await supabase
        .from('class_filiere_assignments')
        .select('id, filiere_id')
        .eq('class_id', enr.class_id)
        .eq('academic_year_label', enr.academic_year_label)
        .maybeSingle();
      if (!assignment) return;

      // Une filière peut redéfinir ses groupes par niveau — fusionner la base
      // ('' = tous niveaux) avec les ajouts propres au niveau de la classe.
      const { data: rawGroups } = await supabase
        .from('filiere_choice_groups')
        .select('id, label, niveau')
        .eq('filiere_id', assignment.filiere_id)
        .in('niveau', ['', cls.niveau]);
      const byLabel = new Map<string, { id: string; niveau: string }>();
      for (const g of (rawGroups ?? [])) {
        const existing = byLabel.get(g.label);
        if (!existing || (g.niveau !== '' && existing.niveau === '')) byLabel.set(g.label, g);
      }
      const groups = [...byLabel.values()];
      if (groups.length === 0) return;

      const { data: choices } = await supabase
        .from('filiere_student_choices')
        .select('choice_group_id')
        .eq('student_enrollment_id', schoolAccount.studentEnrollmentId);

      const chosenGroupIds = new Set((choices ?? []).map(c => c.choice_group_id));
      setPendingFiliereChoice(groups.some(g => !chosenGroupIds.has(g.id)));
    })();
  }, [schoolAccount?.studentEnrollmentId, accountRole]);



  // ── Derived ──────────────────────────────────────────────────────────────

  const pg = useMemo(() =>
    grades
      .filter(g => g.periodId === selId)
      .sort((a, b) => (calcMoyenne(b) ?? -1) - (calcMoyenne(a) ?? -1)),
    [grades, selId],
  );
  const avg = weightedAvg(pg.map(g => ({ ...g, note: g.note ?? calcMoyenne(g) })));
  const m   = mention(avg);

  const graded         = pg.filter(g => calcMoyenne(g) !== null || g.note !== null);
  const selectedPeriod = periods.find(p => p.id === selId);

  if (accountRole === 'teacher') return <TeacherNotes />;

  if (isElementary === null) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
  if (isElementary) return <PortalNotesElementary />;

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f0f4f8] pb-10">

      <div className="px-4 pt-4">
        <BandeauDonneesEnregistrees enregistreLe={enregistreLe} />
      </div>

      {/* ══════════════════════════════════════════
          BANNIÈRE — choix de matières optionnelles en attente
      ══════════════════════════════════════════ */}
      {pendingFiliereChoice && (
        <div className="px-4 pt-5">
          <button
            onClick={() => navigate('/portail/filiere')}
            className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)' }}
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <ListChecks className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Choisissez vos matières optionnelles</p>
              <p className="text-xs text-white/80 mt-0.5">LV1, LV2, options — à faire une fois</p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/80 flex-shrink-0" />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          HERO CARD — Moyenne générale
      ══════════════════════════════════════════ */}
      <div className="px-4 pt-5">
        <div
          className="rounded-3xl p-5 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #4361ee 0%, #4895ef 100%)' }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10"
            style={{ background: 'white' }}
          />
          <div
            className="absolute -right-4 -bottom-10 w-28 h-28 rounded-full opacity-10"
            style={{ background: 'white' }}
          />

          {/* Top row */}
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div>
              <p className="text-white/80 text-sm font-medium">Moyenne générale</p>
              {selectedPeriod && (
                <p className="text-white/60 text-xs mt-0.5">{selectedPeriod.name}</p>
              )}
            </div>
          </div>

          {/* Average number */}
          <div className="flex items-end gap-2 relative z-10">
            <p className="text-white font-black leading-none" style={{ fontSize: 52 }}>
              {avg != null ? avg.toFixed(2) : '—'}
            </p>
            {avg != null && (
              <p className="text-white/60 text-lg font-medium mb-2">/20</p>
            )}
          </div>

          {/* Mention + stats */}
          {avg != null && (
            <div className="flex items-center gap-3 mt-3 relative z-10">
              <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                {m.label}
              </span>
              <span className="text-white/70 text-xs">
                {graded.length} matière{graded.length > 1 ? 's' : ''} évaluée{graded.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PERIOD SELECTOR — pills with icon
      ══════════════════════════════════════════ */}
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
                  active
                    ? 'bg-[#4361ee] text-white shadow-md shadow-blue-200'
                    : 'bg-white text-slate-500 border border-slate-200',
                )}
              >
                <CalendarDays className={cn('h-4 w-4', active ? 'text-white' : 'text-slate-400')} />
                {p.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════
          BULLETIN PUBLIÉ — visible seulement si l'école l'a publié
      ══════════════════════════════════════════ */}
      {(() => {
        const bulletin = publishedBulletins.find(b => b.periodId === selId);
        if (!bulletin) return null;
        return (
          <div className="px-4 pb-1">
            <button
              onClick={() => handleDownloadBulletin(bulletin)}
              disabled={downloadingBulletin}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[.98] transition-transform disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            >
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                {downloadingBulletin ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <FileDown className="h-5 w-5 text-white" />}
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

      {/* ══════════════════════════════════════════
          SUBJECT LIST
      ══════════════════════════════════════════ */}
      <div className="px-4">
        {pg.length === 0 ? (
          <div className="bg-white rounded-3xl py-16 flex flex-col items-center gap-3 text-center"
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Star className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-bold text-slate-600">Aucune note disponible</p>
            <p className="text-sm text-slate-400 max-w-[200px] leading-relaxed">
              Les notes apparaîtront ici dès que vos enseignants les auront saisies.
            </p>
          </div>
        ) : (
          <>
            <p className="font-bold text-slate-800 text-base mb-3">
              Mes notes par matière
            </p>

            {pg.map((g, i) => (
              <SubjectCard
                key={g.id}
                g={g}
                isLast={i === pg.length - 1}
                onPress={() => navigate(`/portail/notes/${g.subjectId}`)}
              />
            ))}

            {/* ── Encouragement banner ─────────────────── */}
            {avg != null && avg >= 10 && (
              <div
                className="mt-3 rounded-2xl px-4 py-4 flex items-center gap-3"
                style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)' }}
              >
                <div className="w-10 h-10 rounded-xl bg-[#4361ee] flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#4361ee]">
                    {avg >= 16 ? 'Excellent travail !' : avg >= 14 ? 'Continue comme ça !' : 'Bon courage !'}
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5 leading-relaxed">
                    {`Tu as ${graded.length} matière${graded.length > 1 ? 's' : ''} notée${graded.length > 1 ? 's' : ''} ce trimestre.`}
                  </p>
                </div>
                <Trophy className="h-8 w-8 text-amber-400 flex-shrink-0" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
