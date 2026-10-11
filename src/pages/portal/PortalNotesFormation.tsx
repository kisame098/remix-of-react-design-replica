import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDonneesHorsLigne } from '@/hooks/useDonneesHorsLigne';
import { BandeauDonneesEnregistrees } from '@/components/BandeauDonneesEnregistrees';
import { cn } from '@/lib/utils';
import { Loader2, CalendarDays, ChevronDown, Star, Briefcase } from 'lucide-react';
import { LIBELLES_STATUT_NOTE, type NiveauMatiereNature, type StatutNote } from '@/lib/formationPro';
import {
  notesDeLaPeriode, periodeEnCours, type DonneesNotesFormation, type MatiereEleve,
} from '@/lib/portailNotesFormation';

// ─── Portail élève — formation professionnelle ───────────────────────────────
// Évaluations rangées par matière et par période (semestre, module…), avec la
// moyenne calculée comme dans la rubrique Évaluations de l'école. Les tables
// fp_* ne laissent lire à l'élève que SES notes et le programme de SA
// promotion (docs/sql/formation_pro_portail_notes.sql).

// Tables fp_* absentes du Database type généré — même accès non typé que
// FormationProContext.tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ligne = any;

const mention = (n: number | null) => {
  if (n == null) return { label: '—',          color: '#94a3b8' };
  if (n >= 16)   return { label: 'Excellent',   color: '#10b981' };
  if (n >= 14)   return { label: 'Très bien',   color: '#22c55e' };
  if (n >= 12)   return { label: 'Bien',        color: '#3b82f6' };
  if (n >= 10)   return { label: 'Assez bien',  color: '#f59e0b' };
  return           { label: 'Insuffisant',  color: '#ef4444' };
};

const nombre = (n: number, decimales = 2) => n.toFixed(decimales).replace('.', ',');
const valeur = (n: number) => (Number.isInteger(n) ? String(n) : nombre(n)).replace('.', ',');
const dateCourte = (iso: string) => {
  const [a, m, j] = iso.split('-');
  return a && m && j ? `${j}/${m}/${a}` : iso;
};

const chargerNotesFormation = async (promotionId: string, eleveId: string): Promise<DonneesNotesFormation> => {
  const { data: promo } = await sb.from('fp_promotions').select('niveau_id').eq('id', promotionId).maybeSingle();
  const niveauId: string | null = promo?.niveau_id ?? null;
  const { data: niveau } = niveauId
    ? await sb.from('fp_niveaux').select('formation_id').eq('id', niveauId).maybeSingle()
    : { data: null };

  const [nmR, catR, perR, evR, noR, exR, stR] = await Promise.all([
    sb.from('fp_niveau_matieres').select('id,matiere_id,coefficient,nature,ordering, fp_matieres(name)').eq('niveau_id', niveauId ?? ''),
    sb.from('fp_bareme_categories').select('*').eq('formation_id', niveau?.formation_id ?? '').order('ordering'),
    sb.from('fp_periodes').select('*').eq('promotion_id', promotionId).order('ordering'),
    sb.from('fp_evaluations').select('*').eq('promotion_id', promotionId),
    sb.from('fp_notes').select('*').eq('student_enrollment_id', eleveId),
    // Seuls les examens verrouillés sont lisibles par l'élève (policy).
    sb.from('fp_examens').select('*').eq('promotion_id', promotionId),
    sb.from('fp_stages').select('*').eq('student_enrollment_id', eleveId),
  ]);
  const examenIds: string[] = (exR.data ?? []).map((r: Ligne) => r.id);
  const { data: tours } = examenIds.length
    ? await sb.from('fp_examen_tours').select('*').in('examen_id', examenIds)
    : { data: [] };
  const tourIds: string[] = (tours ?? []).map((r: Ligne) => r.id);
  const { data: epreuves } = tourIds.length
    ? await sb.from('fp_examen_epreuves').select('*').in('tour_id', tourIds)
    : { data: [] };
  const { data: notesExamen } = (epreuves ?? []).length
    ? await sb.from('fp_examen_notes').select('*').eq('student_enrollment_id', eleveId)
    : { data: [] };

  return {
    promotionId, eleveId,
    periodes: (perR.data ?? []).map((r: Ligne) => ({
      id: r.id, promotionId: r.promotion_id, name: r.name,
      startDate: r.start_date ?? undefined, endDate: r.end_date ?? undefined, ordering: r.ordering ?? 0,
    })),
    matieres: (nmR.data ?? []).map((r: Ligne) => ({
      id: r.id, matiereName: r.fp_matieres?.name ?? 'Matière', coefficient: Number(r.coefficient),
      nature: r.nature as NiveauMatiereNature, ordering: r.ordering ?? 0,
    })),
    categories: (catR.data ?? []).map((r: Ligne) => ({
      id: r.id, formationId: r.formation_id, name: r.name, pourcentage: Number(r.pourcentage),
      ordering: r.ordering ?? 0, sourceExamen: r.source_examen ?? undefined,
    })),
    evaluations: (evR.data ?? []).map((r: Ligne) => ({
      id: r.id, promotionId: r.promotion_id, niveauMatiereId: r.niveau_matiere_id, periodeId: r.periode_id,
      categorieId: r.categorie_id, type: r.type, title: r.title, date: r.date, bareme: Number(r.bareme),
      poids: Number(r.poids), description: r.description ?? undefined, createdAt: r.created_at,
    })),
    notes: (noR.data ?? []).map((r: Ligne) => ({
      id: r.id, evaluationId: r.evaluation_id, studentEnrollmentId: r.student_enrollment_id,
      valeur: r.valeur == null ? undefined : Number(r.valeur), statut: r.statut as StatutNote,
      observation: r.observation ?? undefined,
    })),
    examens: (exR.data ?? []).map((r: Ligne) => ({
      id: r.id, promotionId: r.promotion_id, name: r.name, type: r.type, periodeId: r.periode_id ?? undefined,
      seuilAdmission: Number(r.seuil_admission), dateDebut: r.date_debut ?? undefined, dateFin: r.date_fin ?? undefined,
      verrouille: !!r.verrouille, createdAt: r.created_at,
    })),
    tours: (tours ?? []).map((r: Ligne) => ({ id: r.id, examenId: r.examen_id, name: r.name, ordering: r.ordering ?? 0 })),
    epreuves: (epreuves ?? []).map((r: Ligne) => ({
      id: r.id, tourId: r.tour_id, niveauMatiereId: r.niveau_matiere_id ?? undefined, nom: r.nom,
      coefficient: Number(r.coefficient), bareme: Number(r.bareme), date: r.date ?? undefined, ordering: r.ordering ?? 0,
    })),
    notesExamen: (notesExamen ?? []).map((r: Ligne) => ({
      id: r.id, epreuveId: r.epreuve_id, studentEnrollmentId: r.student_enrollment_id,
      valeur: r.valeur == null ? undefined : Number(r.valeur), statut: r.statut,
    })),
    stages: (stR.data ?? []).map((r: Ligne) => ({
      id: r.id, promotionId: r.promotion_id, studentEnrollmentId: r.student_enrollment_id,
      conventionSignee: !!r.convention_signee, abandonne: !!r.abandonne,
      niveauMatiereId: r.niveau_matiere_id ?? undefined, periodeId: r.periode_id ?? undefined,
      note: r.note == null ? undefined : Number(r.note), createdAt: r.created_at,
    })),
  };
};

function CarteMatiere({ m }: { m: MatiereEleve }) {
  const [ouverte, setOuverte] = useState(false);
  const men = mention(m.moyenne);
  const nbNotes = m.evaluations.filter(e => e.note).length;
  return (
    <div className="bg-white rounded-2xl overflow-hidden mb-3" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setOuverte(o => !o)}
        disabled={m.noteDuStage}
        className="w-full flex items-center gap-4 px-4 pt-4 pb-3 text-left"
      >
        <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: men.color }}>
          {m.noteDuStage
            ? <Briefcase className="h-5 w-5 text-white" />
            : <span className="text-white font-black text-lg leading-none">{m.name.trim().charAt(0).toUpperCase()}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-[15px] truncate">{m.name}</p>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Coef. {valeur(m.coefficient)}
            <span className="ml-2 text-slate-300">
              · {m.noteDuStage ? 'note du stage' : `${nbNotes} note${nbNotes > 1 ? 's' : ''}`}
            </span>
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          <div className="text-right">
            <p className="text-[20px] font-black leading-none" style={{ color: men.color }}>
              {m.moyenne != null ? nombre(m.moyenne) : '—'}
              <span className="text-[11px] text-slate-400 font-normal"> /20</span>
            </p>
            <p className="text-[11px] font-semibold mt-0.5" style={{ color: men.color }}>{men.label}</p>
          </div>
          {!m.noteDuStage && (
            <ChevronDown className={cn('h-4 w-4 text-slate-300 transition-transform', ouverte && 'rotate-180')} />
          )}
        </div>
      </button>

      {ouverte && !m.noteDuStage && (
        <div className="border-t border-slate-100 px-4 py-2">
          {m.evaluations.length === 0 ? (
            <p className="py-3 text-sm text-slate-400">Aucune évaluation pour cette période.</p>
          ) : m.evaluations.map(({ evaluation: e, categorieName, note }) => (
            <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{e.title}</p>
                <p className="text-[11px] text-slate-400">{categorieName} · {dateCourte(e.date)}</p>
              </div>
              <p className="text-sm font-bold text-slate-800 flex-shrink-0">
                {!note ? <span className="text-slate-300 font-normal">Pas encore notée</span>
                  : note.statut === 'note' && note.valeur != null
                    ? <>{valeur(note.valeur)}<span className="text-[11px] text-slate-400 font-normal"> /{valeur(e.bareme)}</span></>
                    : <span className="text-amber-600 font-semibold">{LIBELLES_STATUT_NOTE[note.statut]}</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortalNotesFormation({ promotionId, eleveId }: { promotionId: string; eleveId: string }) {
  const { donnees, chargement, enregistreLe } = useDonneesHorsLigne<DonneesNotesFormation>(
    'portail-notes-formation',
    () => chargerNotesFormation(promotionId, eleveId),
    [promotionId, eleveId],
  );

  const periodes = useMemo(
    () => [...(donnees?.periodes ?? [])].sort((a, b) => a.ordering - b.ordering),
    [donnees],
  );
  const [selId, setSelId] = useState<string | null>(null);
  useEffect(() => {
    if (!donnees) return;
    setSelId(actuel => actuel && donnees.periodes.some(p => p.id === actuel)
      ? actuel
      : periodeEnCours(donnees.periodes, new Date().toISOString().slice(0, 10))?.id ?? null);
  }, [donnees]);

  const vue = useMemo(() => (donnees && selId ? notesDeLaPeriode(donnees, selId) : null), [donnees, selId]);

  if (chargement && !donnees) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  const generale = vue?.generale ?? null;
  const men = mention(generale);
  const nbNotees = vue?.matieres.filter(m => m.moyenne != null).length ?? 0;
  const periode = periodes.find(p => p.id === selId);

  return (
    <div className="min-h-screen bg-[#f0f4f8] pb-10">
      <div className="px-4 pt-4">
        <BandeauDonneesEnregistrees enregistreLe={enregistreLe} />
      </div>

      <div className="px-4 pt-5">
        <div className="rounded-3xl p-5 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #4361ee 0%, #4895ef 100%)' }}>
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10" style={{ background: 'white' }} />
          <div className="relative z-10">
            <p className="text-white/80 text-sm font-medium">Moyenne générale</p>
            {periode && <p className="text-white/60 text-xs mt-0.5">{periode.name}</p>}
          </div>
          <div className="flex items-end gap-2 relative z-10 mt-4">
            <p className="text-white font-black leading-none" style={{ fontSize: 52 }}>
              {generale != null ? nombre(generale) : '—'}
            </p>
            {generale != null && <p className="text-white/60 text-lg font-medium mb-2">/20</p>}
          </div>
          {generale != null && (
            <div className="flex items-center gap-3 mt-3 relative z-10">
              <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">{men.label}</span>
              <span className="text-white/70 text-xs">
                {nbNotees} matière{nbNotees > 1 ? 's' : ''} notée{nbNotees > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {periodes.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-4">
          {periodes.map(p => {
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

      <div className={cn('px-4', periodes.length === 0 && 'pt-5')}>
        {!vue || vue.matieres.length === 0 ? (
          <div className="bg-white rounded-3xl py-16 flex flex-col items-center gap-3 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Star className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-bold text-slate-600">Aucune note disponible</p>
            <p className="text-sm text-slate-400 max-w-[220px] leading-relaxed">
              Les notes apparaîtront ici dès que vos formateurs les auront saisies.
            </p>
          </div>
        ) : (
          <>
            <p className="font-bold text-slate-800 text-base mb-3">Mes notes par matière</p>
            {vue.matieres.map(m => <CarteMatiere key={m.id} m={m} />)}
            <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
              Touchez une matière pour voir le détail de vos évaluations. Les notes d'examen apparaissent
              une fois les résultats arrêtés par l'école.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
