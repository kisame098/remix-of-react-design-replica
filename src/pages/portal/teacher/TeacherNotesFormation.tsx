import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Loader2, ChevronRight, CalendarDays, BookOpen, Check, AlertCircle, Users, Plus, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  type BaremeCategorie, type Evaluation, type Note, type Periode, type StatutNote,
  analyserSaisieNote, texteDeLaNote, categoriesSaisies, titreNouvelleEvaluation, triPeriodes, triEvaluationsChronologique,
  baremeValide, titreEvaluationValide,
} from '@/lib/formationPro';
import { elevesDeLaPromotion, periodeEnCours, type InscriptionPromotion } from '@/lib/portailNotesFormation';

// ─── Portail professeur — formation professionnelle ─────────────────────────
// Le formateur affecté à une matière d'une promotion (Évaluations → la
// matière → « Formateur ») y crée ses évaluations et saisit les notes de ses
// élèves. La base n'ouvre que SES matières (docs/sql/formation_pro_formateurs.sql) ;
// chaque correction d'une note déjà saisie est tracée, comme côté administration.

// Tables fp_* absentes du Database type généré.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ligne = any;

interface MaMatiere {
  promotionId: string;
  promotionName: string;
  classId: string;
  niveauMatiereId: string;
  matiereName: string;
  coefficient: number;
  estStage: boolean;
  categories: BaremeCategorie[];
  periodes: Periode[];
}

type EtatSauvegarde = 'idle' | 'saving' | 'saved' | 'error';

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const dateCourte = (iso: string) => { const [a, m, j] = iso.split('-'); return a && m && j ? `${j}/${m}/${a}` : iso; };
const mapEvaluation = (r: Ligne): Evaluation => ({
  id: r.id, promotionId: r.promotion_id, niveauMatiereId: r.niveau_matiere_id, periodeId: r.periode_id,
  categorieId: r.categorie_id, type: r.type, title: r.title, date: r.date, bareme: Number(r.bareme),
  poids: Number(r.poids), createdAt: r.created_at,
});
const mapNote = (r: Ligne): Note => ({
  id: r.id, evaluationId: r.evaluation_id, studentEnrollmentId: r.student_enrollment_id,
  valeur: r.valeur == null ? undefined : Number(r.valeur), statut: r.statut as StatutNote,
});

const chargerMesMatieres = async (teacherId: string): Promise<MaMatiere[]> => {
  const { data: aff } = await sb.from('fp_affectations').select('promotion_id,niveau_matiere_id').eq('teacher_enrollment_id', teacherId);
  if (!aff?.length) return [];
  const promoIds = [...new Set<string>(aff.map((a: Ligne) => a.promotion_id))];
  const nmIds = [...new Set<string>(aff.map((a: Ligne) => a.niveau_matiere_id))];
  const [pR, nmR, perR] = await Promise.all([
    sb.from('fp_promotions').select('id,class_id,niveau_id').in('id', promoIds),
    sb.from('fp_niveau_matieres').select('id,coefficient,nature, fp_matieres(name)').in('id', nmIds),
    sb.from('fp_periodes').select('*').in('promotion_id', promoIds),
  ]);
  const promos: Ligne[] = pR.data ?? [];
  const [cR, nR] = await Promise.all([
    supabase.from('classes').select('id,name').in('id', promos.map(p => p.class_id)),
    sb.from('fp_niveaux').select('id,formation_id').in('id', promos.map(p => p.niveau_id)),
  ]);
  const formationParNiveau = new Map<string, string>((nR.data ?? []).map((n: Ligne) => [n.id, n.formation_id]));
  const { data: cats } = await sb.from('fp_bareme_categories').select('*')
    .in('formation_id', [...new Set(formationParNiveau.values())]).order('ordering');
  const nomClasse = new Map((cR.data ?? []).map(c => [c.id, c.name]));

  return aff.map((a: Ligne): MaMatiere | null => {
    const p = promos.find(x => x.id === a.promotion_id);
    const nm = (nmR.data ?? []).find((x: Ligne) => x.id === a.niveau_matiere_id);
    if (!p || !nm) return null;
    const formationId = formationParNiveau.get(p.niveau_id);
    return {
      promotionId: p.id, promotionName: nomClasse.get(p.class_id) ?? 'Promotion', classId: p.class_id,
      niveauMatiereId: nm.id, matiereName: nm.fp_matieres?.name ?? 'Matière', coefficient: Number(nm.coefficient),
      estStage: nm.nature === 'stage',
      categories: (cats ?? []).filter((c: Ligne) => c.formation_id === formationId).map((c: Ligne) => ({
        id: c.id, formationId: c.formation_id, name: c.name, pourcentage: Number(c.pourcentage),
        ordering: c.ordering ?? 0, sourceExamen: c.source_examen ?? undefined,
      })),
      periodes: triPeriodes((perR.data ?? []).filter((x: Ligne) => x.promotion_id === p.id).map((x: Ligne) => ({
        id: x.id, promotionId: x.promotion_id, name: x.name,
        startDate: x.start_date ?? undefined, endDate: x.end_date ?? undefined, ordering: x.ordering ?? 0,
      }))),
    };
  }).filter((m: MaMatiere | null): m is MaMatiere => m !== null)
    .sort((a: MaMatiere, b: MaMatiere) => a.promotionName.localeCompare(b.promotionName, 'fr') || a.matiereName.localeCompare(b.matiereName, 'fr'));
};

export default function TeacherNotesFormation() {
  const { schoolAccount } = useAuth();
  const teacherId = schoolAccount?.teacherEnrollmentId ?? null;
  const schoolId = schoolAccount?.schoolId ?? null;

  const [loading, setLoading] = useState(true);
  const [matieres, setMatieres] = useState<MaMatiere[]>([]);
  const [active, setActive] = useState<MaMatiere | null>(null);
  const [periodeId, setPeriodeId] = useState<string | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [eleves, setEleves] = useState<InscriptionPromotion[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const notesRef = useRef<Note[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  const [evalOuverte, setEvalOuverte] = useState<Evaluation | null>(null);
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [etat, setEtat] = useState<EtatSauvegarde>('idle');

  const [creation, setCreation] = useState<{ categorieId: string; title: string; date: string; bareme: string } | null>(null);
  const [creationEnCours, setCreationEnCours] = useState(false);

  useEffect(() => {
    if (!teacherId) { setLoading(false); return; }
    let annule = false;
    chargerMesMatieres(teacherId).then(m => { if (!annule) setMatieres(m); }).finally(() => { if (!annule) setLoading(false); });
    return () => { annule = true; };
  }, [teacherId]);

  const ouvrirMatiere = useCallback(async (m: MaMatiere) => {
    setActive(m);
    setPeriodeId(periodeEnCours(m.periodes, aujourdhui())?.id ?? null);
    setDetailLoading(true);
    try {
      const [eR, evR] = await Promise.all([
        supabase.from('student_enrollments')
          .select('id, academic_year_label, status, student_profiles(first_name,last_name)')
          .eq('class_id', m.classId),
        sb.from('fp_evaluations').select('*').eq('promotion_id', m.promotionId).eq('niveau_matiere_id', m.niveauMatiereId),
      ]);
      setEleves(elevesDeLaPromotion((eR.data ?? []).filter(e => e.student_profiles).map(e => {
        const p = e.student_profiles as { first_name: string; last_name: string };
        return { id: e.id, academicYearLabel: e.academic_year_label, status: (e as Ligne).status, firstName: p.first_name, lastName: p.last_name };
      })));
      const evs: Evaluation[] = (evR.data ?? []).map(mapEvaluation);
      setEvaluations(evs);
      const { data: nR } = evs.length
        ? await sb.from('fp_notes').select('*').in('evaluation_id', evs.map(e => e.id))
        : { data: [] };
      notesRef.current = (nR ?? []).map(mapNote);
      setNotes(notesRef.current);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const periode = active?.periodes.find(p => p.id === periodeId) ?? null;
  const categoriesSaisie = useMemo(() => (active ? categoriesSaisies(active.categories) : []), [active]);
  const evaluationsPeriode = useMemo(
    () => triEvaluationsChronologique(evaluations.filter(e => e.periodeId === periodeId)),
    [evaluations, periodeId],
  );

  // ── Saisie d'une note : enregistrée quand on quitte la case ──────────────
  const enregistrer = useCallback(async (ev: Evaluation, eleveId: string, texte: string) => {
    if (!schoolId) return;
    const saisie = analyserSaisieNote(texte, ev.bareme);
    if (saisie.kind === 'invalide') { setErreurs(e => ({ ...e, [eleveId]: saisie.raison })); return; }
    setErreurs(e => { const { [eleveId]: _, ...reste } = e; return reste; });
    const existante = notesRef.current.find(n => n.evaluationId === ev.id && n.studentEnrollmentId === eleveId);
    setEtat('saving');
    try {
      if (saisie.kind === 'vide') {
        if (existante) {
          const { error } = await sb.from('fp_notes').delete().eq('id', existante.id);
          if (error) throw error;
          notesRef.current = notesRef.current.filter(n => n.id !== existante.id);
        }
      } else {
        const statut: StatutNote = saisie.kind === 'note' ? 'note' : saisie.statut;
        const valeur = saisie.kind === 'note' ? saisie.valeur : null;
        if (existante) {
          if (existante.statut === statut && (existante.valeur ?? null) === valeur) { setEtat('saved'); return; }
          const { error } = await sb.from('fp_notes').update({ valeur, statut, updated_at: new Date().toISOString() }).eq('id', existante.id);
          if (error) throw error;
          await sb.from('fp_notes_historique').insert({
            school_id: schoolId, note_id: existante.id, ancienne_valeur: existante.valeur ?? null, ancien_statut: existante.statut,
            nouvelle_valeur: valeur, nouveau_statut: statut,
          });
          notesRef.current = notesRef.current.map(n => n.id === existante.id ? { ...n, statut, valeur: valeur ?? undefined } : n);
        } else {
          const { data: row, error } = await sb.from('fp_notes').insert({
            school_id: schoolId, evaluation_id: ev.id, student_enrollment_id: eleveId, valeur, statut,
          }).select().single();
          if (error) throw error;
          await sb.from('fp_notes_historique').insert({
            school_id: schoolId, note_id: row.id, ancienne_valeur: null, ancien_statut: null, nouvelle_valeur: valeur, nouveau_statut: statut,
          });
          notesRef.current = [...notesRef.current, mapNote(row)];
        }
      }
      setNotes(notesRef.current);
      setEtat('saved');
    } catch {
      setEtat('error');
    }
  }, [schoolId]);

  const ouvrirEvaluation = (ev: Evaluation) => {
    setEvalOuverte(ev);
    setErreurs({});
    setEtat('idle');
    setSaisies(Object.fromEntries(eleves.map(s => [
      s.id, texteDeLaNote(notesRef.current.find(n => n.evaluationId === ev.id && n.studentEnrollmentId === s.id)),
    ])));
  };

  const preparerCreation = () => {
    const cat = categoriesSaisie[0];
    if (!cat) return;
    setCreation({
      categorieId: cat.id, date: aujourdhui(), bareme: '20',
      title: titreNouvelleEvaluation(cat.name, evaluations.filter(e => e.categorieId === cat.id).map(e => e.title)),
    });
  };

  const creer = async () => {
    if (!creation || !active || !periode || !schoolId) return;
    const bareme = Number(creation.bareme.replace(',', '.'));
    if (!titreEvaluationValide(creation.title) || !baremeValide(bareme)) return;
    const cat = active.categories.find(c => c.id === creation.categorieId);
    setCreationEnCours(true);
    try {
      const { data: row, error } = await sb.from('fp_evaluations').insert({
        school_id: schoolId, promotion_id: active.promotionId, niveau_matiere_id: active.niveauMatiereId,
        periode_id: periode.id, categorie_id: creation.categorieId, type: cat?.name ?? 'Contrôle continu',
        title: creation.title.trim(), date: creation.date, bareme, poids: 1,
      }).select().single();
      if (error) throw error;
      const ev = mapEvaluation(row);
      setEvaluations(prev => [...prev, ev]);
      setCreation(null);
      ouvrirEvaluation(ev);
    } catch {
      setEtat('error');
    } finally {
      setCreationEnCours(false);
    }
  };

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
  );

  // ── Une matière ouverte : périodes, évaluations ───────────────────────────
  if (active) {
    const nomCategorie = new Map(active.categories.map(c => [c.id, c.name]));
    return (
      <div className="min-h-screen bg-[#f0f4f8] pb-10">
        <div className="px-4 pt-5 flex items-center gap-3">
          <button onClick={() => { setActive(null); setCreation(null); }} className="w-9 h-9 rounded-xl bg-white flex items-center justify-center" aria-label="Retour à mes matières">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 truncate">{active.matiereName}</p>
            <p className="text-xs text-slate-400 truncate">{active.promotionName} · Coef. {active.coefficient}</p>
          </div>
        </div>

        {active.periodes.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-4">
            {active.periodes.map(p => {
              const actif = p.id === periodeId;
              return (
                <button key={p.id} onClick={() => setPeriodeId(p.id)} className={cn(
                  'flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all',
                  actif ? 'bg-[#4361ee] text-white shadow-md shadow-blue-200' : 'bg-white text-slate-500 border border-slate-200',
                )}>
                  <CalendarDays className={cn('h-4 w-4', actif ? 'text-white' : 'text-slate-400')} />{p.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="px-4 space-y-3">
          {detailLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : active.estStage ? (
            <p className="bg-white rounded-2xl p-4 text-sm text-slate-500">
              La note de cette matière vient du stage : elle est saisie par l'administration dans la rubrique Stages.
            </p>
          ) : !periode ? (
            <p className="bg-white rounded-2xl p-4 text-sm text-slate-500">
              Aucune période n'est encore créée pour cette promotion : l'administration doit en ajouter une dans Évaluations.
            </p>
          ) : (
            <>
              {evaluationsPeriode.length === 0 && !creation && (
                <p className="bg-white rounded-2xl p-4 text-sm text-slate-500">Aucune évaluation pour {periode.name}.</p>
              )}
              {evaluationsPeriode.map(ev => {
                const nb = notes.filter(n => n.evaluationId === ev.id).length;
                return (
                  <button key={ev.id} onClick={() => ouvrirEvaluation(ev)}
                    className="w-full bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left active:scale-[.98] transition-transform"
                    style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{ev.title}</p>
                      <p className="text-[12px] text-slate-400">{nomCategorie.get(ev.categorieId)} · {dateCourte(ev.date)} · sur {ev.bareme}</p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{nb}/{eleves.length} notés</span>
                    <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                  </button>
                );
              })}

              {creation ? (
                <div className="bg-white rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                  <p className="font-semibold text-slate-800">Nouvelle évaluation — {periode.name}</p>
                  <div className="space-y-1.5">
                    <Label>Catégorie</Label>
                    <Select value={creation.categorieId} onValueChange={v => {
                      const cat = active.categories.find(c => c.id === v);
                      setCreation(c => c && ({ ...c, categorieId: v,
                        title: titreNouvelleEvaluation(cat?.name ?? '', evaluations.filter(e => e.categorieId === v).map(e => e.title)) }));
                    }}>
                      <SelectTrigger aria-label="Catégorie"><SelectValue /></SelectTrigger>
                      <SelectContent>{categoriesSaisie.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="titre-eval">Titre</Label>
                    <Input id="titre-eval" value={creation.title} onChange={e => setCreation(c => c && ({ ...c, title: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="date-eval">Date</Label>
                      <Input id="date-eval" type="date" value={creation.date} onChange={e => setCreation(c => c && ({ ...c, date: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bareme-eval">Noté sur</Label>
                      <Input id="bareme-eval" inputMode="decimal" value={creation.bareme} onChange={e => setCreation(c => c && ({ ...c, bareme: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setCreation(null)}>Annuler</Button>
                    <Button onClick={creer} disabled={creationEnCours || !creation.date}>
                      {creationEnCours && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Créer
                    </Button>
                  </div>
                  {etat === 'error' && <p className="text-xs text-red-600">Impossible de créer l'évaluation. Vérifiez votre connexion.</p>}
                </div>
              ) : categoriesSaisie.length > 0 && (
                <Button className="w-full gap-2" onClick={preparerCreation}><Plus className="h-4 w-4" />Nouvelle évaluation</Button>
              )}
            </>
          )}
        </div>

        <Dialog open={!!evalOuverte} onOpenChange={o => !o && setEvalOuverte(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{evalOuverte?.title}</DialogTitle>
              <DialogDescription className="flex items-center justify-between gap-2">
                <span>Noté sur {evalOuverte?.bareme} · A = absent, AJ = absent justifié, NE = non évalué</span>
                <span className="text-xs flex-shrink-0">
                  {etat === 'saving' && <span className="animate-pulse">Enregistrement…</span>}
                  {etat === 'saved' && <span className="flex items-center gap-1 text-green-600"><Check className="h-3.5 w-3.5" />Enregistré</span>}
                  {etat === 'error' && <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3.5 w-3.5" />Erreur</span>}
                </span>
              </DialogDescription>
            </DialogHeader>
            {eleves.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Users className="h-8 w-8 text-muted-foreground/40" />Aucun élève dans cette promotion
              </div>
            ) : (
              <div className="divide-y">
                {eleves.map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1 min-w-0 text-sm truncate"><span className="font-semibold">{s.lastName}</span> {s.firstName}</span>
                    <div className="flex flex-col items-end">
                      <Input
                        className={cn('w-20 h-9 text-center', erreurs[s.id] && 'border-destructive')}
                        aria-label={`Note de ${s.lastName} ${s.firstName}`}
                        value={saisies[s.id] ?? ''}
                        onChange={e => setSaisies(prev => ({ ...prev, [s.id]: e.target.value }))}
                        onBlur={e => evalOuverte && enregistrer(evalOuverte, s.id, e.target.value)}
                      />
                      {erreurs[s.id] && <span className="text-[11px] text-destructive mt-0.5">{erreurs[s.id]}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Mes matières ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f0f4f8] pb-10">
      <div className="px-4 pt-5 pb-3">
        <p className="font-bold text-slate-800 text-base">Mes matières</p>
        <p className="text-xs text-slate-400 mt-0.5">Choisissez une matière pour créer vos évaluations et saisir les notes.</p>
      </div>
      <div className="px-4">
        {matieres.length === 0 ? (
          <div className="bg-white rounded-3xl py-16 flex flex-col items-center gap-3 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center"><BookOpen className="h-8 w-8 text-slate-300" /></div>
            <p className="font-bold text-slate-600">Aucune matière assignée</p>
            <p className="text-sm text-slate-400 max-w-[260px] leading-relaxed">
              L'administration doit vous désigner comme formateur d'une matière (Évaluations → la promotion → la matière → Formateur).
            </p>
          </div>
        ) : matieres.map((m, i) => (
          <button key={`${m.promotionId}-${m.niveauMatiereId}`} onClick={() => ouvrirMatiere(m)}
            className={cn('w-full bg-white rounded-2xl text-left active:scale-[.98] transition-transform px-4 py-4 flex items-center gap-4', i > 0 && 'mt-3')}
            style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center bg-blue-500">
              <span className="text-white font-black text-lg leading-none">{m.matiereName.trim().charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-[15px] truncate">{m.matiereName}</p>
              <p className="text-[12px] text-slate-400 mt-0.5 truncate">{m.promotionName} · Coef. {m.coefficient}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
