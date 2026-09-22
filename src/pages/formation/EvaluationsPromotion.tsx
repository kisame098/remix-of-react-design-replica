import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, Loader2, ClipboardList, Users, Check, AlertCircle, Search, ArrowLeft, ChevronRight, X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  nomPeriodeValide, triPeriodes, titreEvaluationValide, baremeValide, poidsValide,
  TYPES_EVALUATION_SUGGERES, LIBELLES_STATUT_NOTE, resumeEvaluation, triEvaluations, type StatutNote,
} from '@/lib/formationPro';

/**
 * Page 2 du module Évaluations : un seul espace de travail par promotion.
 *
 * Périodes en pastilles en haut (comme les périodes de Gestion des Notes),
 * puis catégories du barème en blocs (Contrôle continu, TP, Examen blanc,
 * Examen final…), puis matières en sidebar — sur cette combinaison
 * période/catégorie/matière, on crée et sélectionne des évaluations
 * (« Devoir 1 », « Devoir 2 »…) et on saisit les notes avec sauvegarde
 * automatique, comme la table de src/pages/SubjectGrades.tsx.
 */
const EvaluationsPromotion = () => {
  const { promotionId } = useParams<{ promotionId: string }>();
  const navigate = useNavigate();
  const {
    loading, promotions, formations, niveaux, niveauMatieres, baremeCategories,
    periodes, evaluations, notes,
    addPeriode, deletePeriode, addEvaluation, deleteEvaluation, saisirNote,
  } = useFormationPro();
  const { students } = useSchool();

  const promotion = promotions.find(p => p.id === promotionId);
  const niveau = promotion ? niveaux.find(n => n.id === promotion.niveauId) : null;
  const formation = niveau ? formations.find(f => f.id === niveau.formationId) : null;

  const matieresDuNiveau = useMemo(
    () => niveauMatieres.filter(m => niveau && m.niveauId === niveau.id),
    [niveauMatieres, niveau],
  );
  const categoriesDeLaFormation = useMemo(
    () => baremeCategories.filter(c => formation && c.formationId === formation.id).sort((a, b) => a.ordering - b.ordering),
    [baremeCategories, formation],
  );
  const periodesDeLaPromotion = useMemo(
    () => triPeriodes(periodes.filter(p => promotion && p.promotionId === promotion.id)),
    [periodes, promotion],
  );
  const elevesDeLaPromotion = useMemo(
    () => students.filter(s => promotion && s.classId === promotion.classId),
    [students, promotion],
  );

  // ── Sélection en cascade : période → catégorie → matière → évaluation ────
  const [periodeId, setPeriodeId] = useState<string | null>(null);
  const periode = periodesDeLaPromotion.find(p => p.id === periodeId) ?? periodesDeLaPromotion[0] ?? null;

  const [categorieId, setCategorieId] = useState<string | null>(null);
  const categorie = categoriesDeLaFormation.find(c => c.id === categorieId) ?? categoriesDeLaFormation[0] ?? null;

  const [matiereId, setMatiereId] = useState<string | null>(null);
  const matiere = matieresDuNiveau.find(m => m.id === matiereId) ?? null;

  const evaluationsDeLaSelection = useMemo(
    () => triEvaluations(evaluations.filter(e =>
      e.promotionId === promotionId && periode && e.periodeId === periode.id &&
      categorie && e.categorieId === categorie.id && matiere && e.niveauMatiereId === matiere.id,
    )),
    [evaluations, promotionId, periode, categorie, matiere],
  );
  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  useEffect(() => { setEvaluationId(null); }, [matiereId, categorieId, periodeId]);
  const evaluationSelectionnee = evaluationsDeLaSelection.find(e => e.id === evaluationId) ?? evaluationsDeLaSelection[0] ?? null;

  // ── Créer / supprimer une période ─────────────────────────────────────────
  const [dialogPeriode, setDialogPeriode] = useState(false);
  const [periodeName, setPeriodeName] = useState('');
  const [isSavingPeriode, setIsSavingPeriode] = useState(false);
  const handleCreatePeriode = async () => {
    if (!promotion || !nomPeriodeValide(periodeName)) {
      toast({ title: 'Erreur', description: 'Le nom de la période est obligatoire.', variant: 'destructive' });
      return;
    }
    setIsSavingPeriode(true);
    try {
      const per = await addPeriode(promotion.id, { name: periodeName.trim() });
      toast({ title: 'Période créée', description: periodeName });
      setPeriodeName(''); setDialogPeriode(false); setPeriodeId(per.id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingPeriode(false);
    }
  };

  const [confirmDeletePeriodeId, setConfirmDeletePeriodeId] = useState<string | null>(null);
  const handleDeletePeriode = async (id: string) => {
    try {
      await deletePeriode(id);
      toast({ title: 'Période supprimée' });
      if (periodeId === id) setPeriodeId(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setConfirmDeletePeriodeId(null);
    }
  };

  // ── Créer une évaluation (période/catégorie/matière déjà fixées) ─────────
  const [dialogEval, setDialogEval] = useState(false);
  const [type, setType] = useState<string>(TYPES_EVALUATION_SUGGERES[0]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bareme, setBareme] = useState('20');
  const [poids, setPoids] = useState('1');
  const [isSavingEval, setIsSavingEval] = useState(false);

  const resetEvalForm = () => {
    setType(TYPES_EVALUATION_SUGGERES[0] as string); setTitle('');
    setDate(new Date().toISOString().slice(0, 10)); setBareme('20'); setPoids('1');
  };

  const handleCreateEval = async () => {
    const baremeNum = Number(bareme);
    const poidsNum = Number(poids);
    if (!promotionId || !periode || !categorie || !matiere || !titreEvaluationValide(title) || !baremeValide(baremeNum) || !poidsValide(poidsNum)) {
      toast({ title: 'Erreur', description: 'Titre, barème et poids sont obligatoires.', variant: 'destructive' });
      return;
    }
    setIsSavingEval(true);
    try {
      const ev = await addEvaluation({
        promotionId, niveauMatiereId: matiere.id, periodeId: periode.id, categorieId: categorie.id,
        type, title: title.trim(), date, bareme: baremeNum, poids: poidsNum,
      });
      toast({ title: 'Évaluation créée', description: title });
      resetEvalForm(); setDialogEval(false); setEvaluationId(ev.id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingEval(false);
    }
  };

  const [confirmDeleteEvalId, setConfirmDeleteEvalId] = useState<string | null>(null);
  const handleDeleteEval = async (id: string) => {
    try {
      await deleteEvaluation(id);
      toast({ title: 'Évaluation supprimée' });
      if (evaluationId === id) setEvaluationId(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setConfirmDeleteEvalId(null);
    }
  };

  // ── Saisie des notes : tableau inline, sauvegarde automatique ─────────────
  type Brouillon = { valeur: string; statut: StatutNote };
  const [entries, setEntries] = useState<Record<string, Brouillon>>({});
  const [search, setSearch] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirtyRef = useRef<Set<string>>(new Set());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evaluationEnCoursId = evaluationSelectionnee?.id ?? null;

  useEffect(() => {
    const initial: Record<string, Brouillon> = {};
    for (const s of elevesDeLaPromotion) {
      const n = notes.find(x => evaluationEnCoursId && x.evaluationId === evaluationEnCoursId && x.studentEnrollmentId === s.id);
      initial[s.id] = { valeur: n?.valeur != null ? String(n.valeur) : '', statut: n?.statut ?? 'note' };
    }
    setEntries(initial);
    setSaveState('idle');
    dirtyRef.current = new Set();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationEnCoursId]);

  const flushSave = useCallback(async (evId: string, snapshot: Record<string, Brouillon>, dirtyIds: Set<string>) => {
    setSaveState('saving');
    try {
      for (const studentId of dirtyIds) {
        const b = snapshot[studentId];
        if (!b) continue;
        const valeur = b.statut === 'note' ? Number(b.valeur) : undefined;
        if (b.statut === 'note' && (!Number.isFinite(valeur) || b.valeur === '')) continue;
        await saisirNote(evId, studentId, { valeur, statut: b.statut });
      }
      setSaveState('saved');
    } catch {
      setSaveState('error');
      toast({ title: 'Erreur de sauvegarde', description: 'Une note n\'a pas pu être enregistrée.', variant: 'destructive' });
    }
  }, [saisirNote]);

  const updateEntry = (studentId: string, patch: Partial<Brouillon>) => {
    if (!evaluationEnCoursId) return;
    const nextEntries = { ...entries, [studentId]: { ...entries[studentId], ...patch } };
    setEntries(nextEntries);
    dirtyRef.current.add(studentId);
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const dirtyIds = dirtyRef.current;
      dirtyRef.current = new Set();
      void flushSave(evaluationEnCoursId, nextEntries, dirtyIds);
    }, 800);
  };

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }, []);

  const elevesFiltres = useMemo(() => {
    if (!search.trim()) return elevesDeLaPromotion;
    const q = search.toLowerCase();
    return elevesDeLaPromotion.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q));
  }, [elevesDeLaPromotion, search]);

  // Un point vert par matière : au moins une note saisie pour la période/catégorie sélectionnée.
  const matiereANotes = useCallback((mId: string): boolean => {
    if (!periode || !categorie) return false;
    const evs = evaluations.filter(e => e.promotionId === promotionId && e.periodeId === periode.id && e.categorieId === categorie.id && e.niveauMatiereId === mId);
    return evs.some(e => notes.some(n => n.evaluationId === e.id && n.statut !== 'non_evalue'));
  }, [evaluations, notes, periode, categorie, promotionId]);

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }
  if (!promotion) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/formation/evaluations" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Évaluations</Link>
        <p className="text-destructive text-sm">Promotion introuvable.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0 flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="flex-shrink-0 mt-0.5" onClick={() => navigate('/formation/evaluations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <button onClick={() => navigate('/formation/evaluations')} className="hover:text-foreground transition-colors">Évaluations</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{promotion.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{promotion.name}</h1>
          </div>
        </div>
      </div>

      {/* ── Périodes : pastilles, comme Gestion des Notes ── */}
      <div className="px-6 pt-4 flex-shrink-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Périodes</p>
        {periodesDeLaPromotion.length === 0 ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Aucune période — une CAP de 3 ans et une formation de 6 mois n'ont pas le même rythme.</p>
            <Dialog open={dialogPeriode} onOpenChange={setDialogPeriode}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Créer une période</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouvelle période</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="periode-name">Nom *</Label>
                    <Input id="periode-name" placeholder="Ex : Semestre 1, Trimestre 1…" value={periodeName} onChange={e => setPeriodeName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreatePeriode()} />
                  </div>
                  <Button onClick={handleCreatePeriode} className="w-full" disabled={isSavingPeriode}>
                    {isSavingPeriode && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {periodesDeLaPromotion.map(per => {
              const isSelected = periode?.id === per.id;
              return (
                <div key={per.id} className="group relative">
                  <button
                    onClick={() => setPeriodeId(per.id)}
                    className={`text-sm font-medium px-3.5 py-1.5 rounded-full transition-all pr-7 ${
                      isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70 text-foreground'
                    }`}
                  >
                    {per.name}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeletePeriodeId(per.id); }}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                      isSelected ? 'hover:bg-primary-foreground/20 text-primary-foreground' : 'hover:bg-destructive/10 text-destructive'
                    }`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <Dialog open={dialogPeriode} onOpenChange={setDialogPeriode}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Nouvelle période"><Plus className="h-4 w-4" /></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouvelle période</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="periode-name-2">Nom *</Label>
                    <Input id="periode-name-2" placeholder="Ex : Semestre 1, Trimestre 1…" value={periodeName} onChange={e => setPeriodeName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreatePeriode()} />
                  </div>
                  <Button onClick={handleCreatePeriode} className="w-full" disabled={isSavingPeriode}>
                    {isSavingPeriode && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {!periode ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>Choisissez ou créez une période pour continuer</p>
        </div>
      ) : categoriesDeLaFormation.length === 0 ? (
        <div className="mx-6 mt-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground flex-shrink-0">
          Aucune formule d'évaluation définie pour « {formation?.name} ». Le directeur doit d'abord définir les
          catégories (contrôle continu, TP, examen…) sur la{' '}
          <Link to={`/formation/formations/${formation?.id}`} className="text-primary hover:underline">page de la formation</Link>.
        </div>
      ) : (
        <>
          {/* ── Catégories du barème : blocs ── */}
          <div className="px-6 pt-5 flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Catégorie</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {categoriesDeLaFormation.map(cat => {
                const isSelected = categorie?.id === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategorieId(cat.id)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.pourcentage} % de la moyenne</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Matières (sidebar) + évaluations/notes (contenu) ── */}
          <div className="flex-1 min-h-0 flex mt-5">
            <div className="w-56 border-r flex-shrink-0 flex flex-col bg-muted/10 overflow-hidden">
              <div className="p-3 border-b bg-background flex-shrink-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Matières</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {matieresDuNiveau.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6 px-3">Aucune matière au programme</p>
                ) : matieresDuNiveau.map(m => {
                  const isActive = m.id === matiereId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMatiereId(m.id)}
                      className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-sm ${
                        isActive ? 'bg-primary text-primary-foreground font-medium shadow-sm' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        matiereANotes(m.id) ? (isActive ? 'bg-primary-foreground' : 'bg-green-500') : (isActive ? 'bg-primary-foreground/40' : 'bg-muted-foreground/30')
                      }`} />
                      <span className="truncate flex-1">{m.matiereName}</span>
                      <span className={`text-xs flex-shrink-0 ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>×{m.coefficient}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-w-0 overflow-y-auto p-6">
              {!matiere ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ClipboardList className="h-14 w-14 mb-4 opacity-30" />
                  <p className="font-medium">Sélectionnez une matière</p>
                  <p className="text-sm mt-1 opacity-70">Choisissez une matière dans le panneau gauche</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Évaluations de cette matière/catégorie/période : petites pastilles */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {evaluationsDeLaSelection.map(ev => {
                        const isActive = ev.id === evaluationSelectionnee?.id;
                        const resume = resumeEvaluation(ev, notes.filter(n => n.evaluationId === ev.id), elevesDeLaPromotion.length);
                        return (
                          <button
                            key={ev.id}
                            onClick={() => setEvaluationId(ev.id)}
                            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-all ${
                              isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70 text-foreground'
                            }`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${resume.nbNotes > 0 ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                            {ev.title}
                          </button>
                        );
                      })}
                    </div>
                    <Dialog open={dialogEval} onOpenChange={(open) => { setDialogEval(open); if (!open) resetEvalForm(); }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Nouvelle évaluation</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Nouvelle évaluation — {matiere.matiereName} · {categorie?.name}</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={type} onValueChange={setType}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {TYPES_EVALUATION_SUGGERES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="eval-title">Titre *</Label>
                            <Input id="eval-title" placeholder="Ex : Contrôle pratique n°1" value={title} onChange={e => setTitle(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="eval-date">Date *</Label>
                              <Input id="eval-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="eval-bareme">Barème *</Label>
                              <Input id="eval-bareme" type="number" min={1} value={bareme} onChange={e => setBareme(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="eval-poids">Poids *</Label>
                              <Input id="eval-poids" type="number" min={0.1} step={0.5} value={poids} onChange={e => setPoids(e.target.value)} />
                            </div>
                          </div>
                          <Button onClick={handleCreateEval} className="w-full" disabled={isSavingEval}>
                            {isSavingEval && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {!evaluationSelectionnee ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-14">
                        <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-3" />
                        <p className="text-muted-foreground font-medium">Aucune évaluation pour « {matiere.matiereName} » en « {categorie?.name} »</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Créez-en une pour commencer la saisie des notes</p>
                      </CardContent>
                    </Card>
                  ) : elevesDeLaPromotion.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-14">
                        <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                        <p className="text-muted-foreground">Aucun élève dans cette promotion</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            {evaluationSelectionnee.title}
                            <span className="text-muted-foreground font-normal text-sm">
                              — {evaluationSelectionnee.date} · /{evaluationSelectionnee.bareme}{evaluationSelectionnee.poids !== 1 && ` · poids ${evaluationSelectionnee.poids}`}
                            </span>
                          </CardTitle>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground min-w-[110px] text-right">
                              {saveState === 'saving' && <span className="animate-pulse">Enregistrement…</span>}
                              {saveState === 'saved' && <span className="flex items-center gap-1 justify-end text-green-600"><Check className="h-3.5 w-3.5" />Enregistré</span>}
                              {saveState === 'error' && <span className="flex items-center gap-1 justify-end text-destructive"><AlertCircle className="h-3.5 w-3.5" />Erreur</span>}
                            </span>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input placeholder="Rechercher un élève…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-44 h-8 text-sm" />
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Supprimer l'évaluation" onClick={() => setConfirmDeleteEvalId(evaluationSelectionnee.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="min-w-[160px]">Élève</TableHead>
                                <TableHead className="min-w-[170px]">Statut</TableHead>
                                <TableHead className="min-w-[100px] text-center">Note</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {elevesFiltres.length === 0 ? (
                                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">Aucun élève trouvé pour « {search} »</TableCell></TableRow>
                              ) : elevesFiltres.map(s => {
                                const entry = entries[s.id] ?? { valeur: '', statut: 'note' as StatutNote };
                                return (
                                  <TableRow key={s.id}>
                                    <TableCell>
                                      <div className="font-medium text-sm leading-tight">{s.lastName}</div>
                                      <div className="text-xs text-muted-foreground">{s.firstName}</div>
                                    </TableCell>
                                    <TableCell>
                                      <Select value={entry.statut} onValueChange={(v) => updateEntry(s.id, { statut: v as StatutNote })}>
                                        <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {Object.entries(LIBELLES_STATUT_NOTE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number" min={0} max={evaluationSelectionnee.bareme} step="0.25" className="w-20 text-center mx-auto h-8"
                                        disabled={entry.statut !== 'note'} value={entry.valeur} placeholder="-"
                                        onChange={(e) => updateEntry(s.id, { valeur: e.target.value })}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        {search && elevesFiltres.length < elevesDeLaPromotion.length && (
                          <p className="text-xs text-muted-foreground mt-3 text-center">
                            {elevesFiltres.length} résultat{elevesFiltres.length !== 1 ? 's' : ''} sur {elevesDeLaPromotion.length} élèves
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <AlertDialog open={!!confirmDeletePeriodeId} onOpenChange={(open) => !open && setConfirmDeletePeriodeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette période ?</AlertDialogTitle>
            <AlertDialogDescription>Toutes ses évaluations et les notes saisies seront supprimées. Cette action ne peut pas être défaite.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDeletePeriodeId && void handleDeletePeriode(confirmDeletePeriodeId)}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteEvalId} onOpenChange={(open) => !open && setConfirmDeleteEvalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette évaluation ?</AlertDialogTitle>
            <AlertDialogDescription>Toutes les notes saisies pour cette évaluation seront supprimées. Cette action ne peut pas être défaite.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDeleteEvalId && void handleDeleteEval(confirmDeleteEvalId)}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EvaluationsPromotion;
