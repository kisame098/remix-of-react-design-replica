import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ClipboardList, Plus, Loader2, Trash2, Users, ChevronRight, ArrowLeft, Check, AlertCircle, Search, GraduationCap,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  triPromotions, grouperPromotions, triPeriodes, triEvaluations, resumeEvaluation,
  titreEvaluationValide, baremeValide, poidsValide, nomPeriodeValide,
  TYPES_EVALUATION_SUGGERES, LIBELLES_STATUT_NOTE,
  type StatutNote,
} from '@/lib/formationPro';

/**
 * Page Évaluations : même langage visuel que Gestion des Notes (classique) —
 * panneau gauche (périodes → évaluations), panneau droit (tableau de saisie
 * avec sauvegarde automatique), plutôt qu'une suite de formulaires modaux.
 */
const Evaluations = () => {
  const {
    loading, promotions, formations, niveaux, niveauMatieres, baremeCategories,
    periodes, evaluations, notes,
    addPeriode, deletePeriode, addEvaluation, deleteEvaluation, saisirNote,
  } = useFormationPro();
  const { students } = useSchool();

  const groupes = useMemo(() => grouperPromotions(triPromotions(promotions), niveaux, formations), [promotions, niveaux, formations]);

  const [promotionId, setPromotionId] = useState<string | null>(null);
  const promotion = promotions.find(p => p.id === promotionId) ?? null;
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
  const evaluationsDeLaPromotion = useMemo(
    () => triEvaluations(evaluations.filter(e => promotion && e.promotionId === promotion.id)),
    [evaluations, promotion],
  );
  const elevesDeLaPromotion = useMemo(
    () => students.filter(s => promotion && s.classId === promotion.classId),
    [students, promotion],
  );

  const [evaluationId, setEvaluationId] = useState<string | null>(null);
  useEffect(() => { setEvaluationId(null); }, [promotionId]);
  const evaluationSelectionnee = evaluations.find(e => e.id === evaluationId) ?? null;

  // ── Créer une période ──────────────────────────────────────────────────
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
      await addPeriode(promotion.id, { name: periodeName.trim() });
      toast({ title: 'Période créée', description: periodeName });
      setPeriodeName(''); setDialogPeriode(false);
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
      if (evaluationsDeLaPromotion.some(e => e.periodeId === id && e.id === evaluationId)) setEvaluationId(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setConfirmDeletePeriodeId(null);
    }
  };

  // ── Créer une évaluation ──────────────────────────────────────────────────
  const [dialogEval, setDialogEval] = useState(false);
  const [niveauMatiereId, setNiveauMatiereId] = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [type, setType] = useState<string>(TYPES_EVALUATION_SUGGERES[0]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bareme, setBareme] = useState('20');
  const [poids, setPoids] = useState('1');
  const [description, setDescription] = useState('');
  const [isSavingEval, setIsSavingEval] = useState(false);

  const ouvrirDialogEval = (periodeIdPreselectionnee?: string) => {
    setNiveauMatiereId(''); setPeriodeId(periodeIdPreselectionnee ?? ''); setCategorieId('');
    setType(TYPES_EVALUATION_SUGGERES[0] as string); setTitle(''); setDate(new Date().toISOString().slice(0, 10));
    setBareme('20'); setPoids('1'); setDescription(''); setDialogEval(true);
  };

  const handleCreateEval = async () => {
    const baremeNum = Number(bareme);
    const poidsNum = Number(poids);
    if (!promotion || !niveauMatiereId || !periodeId || !categorieId || !titreEvaluationValide(title) || !baremeValide(baremeNum) || !poidsValide(poidsNum)) {
      toast({ title: 'Erreur', description: 'Matière, période, catégorie, titre, barème et poids sont obligatoires.', variant: 'destructive' });
      return;
    }
    setIsSavingEval(true);
    try {
      const ev = await addEvaluation({
        promotionId: promotion.id, niveauMatiereId, periodeId, categorieId, type, title: title.trim(),
        date, bareme: baremeNum, poids: poidsNum, description: description.trim() || undefined,
      });
      toast({ title: 'Évaluation créée', description: title });
      setDialogEval(false);
      setEvaluationId(ev.id);
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

  useEffect(() => {
    const initial: Record<string, Brouillon> = {};
    for (const s of elevesDeLaPromotion) {
      const n = notes.find(x => evaluationId && x.evaluationId === evaluationId && x.studentEnrollmentId === s.id);
      initial[s.id] = { valeur: n?.valeur != null ? String(n.valeur) : '', statut: n?.statut ?? 'note' };
    }
    setEntries(initial);
    setSaveState('idle');
    dirtyRef.current = new Set();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId]);

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
    if (!evaluationId) return;
    const nextEntries = { ...entries, [studentId]: { ...entries[studentId], ...patch } };
    setEntries(nextEntries);
    dirtyRef.current.add(studentId);
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const dirtyIds = dirtyRef.current;
      dirtyRef.current = new Set();
      void flushSave(evaluationId, nextEntries, dirtyIds);
    }, 800);
  };

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); }, []);

  const elevesFiltres = useMemo(() => {
    if (!search.trim()) return elevesDeLaPromotion;
    const q = search.toLowerCase();
    return elevesDeLaPromotion.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q));
  }, [elevesDeLaPromotion, search]);

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }

  if (promotions.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Évaluations</h1>
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <ClipboardList className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucune promotion créée</h3>
            <p className="text-muted-foreground mb-6">Créez d'abord une promotion pour pouvoir y saisir des notes.</p>
            <Button asChild><Link to="/formation/promotions">Promotions</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Étape 1 : choisir une promotion (même grille que Gestion des Notes) ──
  if (!promotion) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b flex-shrink-0">
          <h1 className="text-2xl font-bold text-foreground">Évaluations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Choisissez une promotion</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {groupes.map(gf => (
            <div key={gf.formation.id} className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{gf.formation.name}</h2>
              {gf.niveaux.map(gn => (
                <div key={gn.niveau.id} className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">{gn.niveau.name}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {gn.promotions.map(p => {
                      const nbEval = evaluations.filter(e => e.promotionId === p.id).length;
                      return (
                        <button key={p.id} onClick={() => setPromotionId(p.id)} className="text-left group">
                          <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full cursor-pointer">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                  <GraduationCap className="h-5 w-5" />
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                              </div>
                              <h3 className="font-semibold text-foreground mb-2">{p.name}</h3>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.studentLimit} places max</span>
                                <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" />{nbEval} évaluation{nbEval !== 1 ? 's' : ''}</span>
                              </div>
                            </CardContent>
                          </Card>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Étape 2 : périodes/évaluations (gauche) + saisie (droite) ────────────
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0 gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="flex-shrink-0 mt-0.5" onClick={() => setPromotionId(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
              <button onClick={() => setPromotionId(null)} className="hover:text-foreground transition-colors">Évaluations</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{promotion.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{promotion.name}</h1>
          </div>
        </div>
      </div>

      {categoriesDeLaFormation.length === 0 && (
        <div className="mx-6 mt-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground flex-shrink-0">
          Aucune formule d'évaluation définie pour « {formation?.name} ». Le directeur doit d'abord définir les
          catégories (contrôle continu, TP, examen…) sur la{' '}
          <Link to={`/formation/formations/${formation?.id}`} className="text-primary hover:underline">page de la formation</Link>.
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* LEFT PANEL — Périodes et évaluations */}
        <div className="w-64 border-r flex-shrink-0 flex flex-col bg-muted/10">
          <div className="p-3 border-b bg-background flex-shrink-0 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Périodes</p>
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Nouvelle période" onClick={() => setDialogPeriode(true)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {periodesDeLaPromotion.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm px-3">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Aucune période</p>
                <p className="text-xs mt-1">Une CAP de 3 ans et une formation de 6 mois n'ont pas le même rythme.</p>
              </div>
            ) : (
              periodesDeLaPromotion.map(per => {
                const evalsDePeriode = evaluationsDeLaPromotion.filter(e => e.periodeId === per.id);
                return (
                  <div key={per.id}>
                    <div className="group flex items-center justify-between px-2 py-1">
                      <p className="text-xs font-medium text-foreground truncate">{per.name}</p>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <button
                          className="p-1 rounded hover:bg-muted text-muted-foreground" title="Nouvelle évaluation"
                          onClick={() => ouvrirDialogEval(per.id)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Supprimer la période"
                          onClick={() => setConfirmDeletePeriodeId(per.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {evalsDePeriode.length === 0 ? (
                        <p className="text-xs text-muted-foreground/70 px-3 py-1 italic">Aucune évaluation</p>
                      ) : evalsDePeriode.map(ev => {
                        const isActive = ev.id === evaluationId;
                        const matiere = niveauMatieres.find(m => m.id === ev.niveauMatiereId);
                        const resume = resumeEvaluation(ev, notes.filter(n => n.evaluationId === ev.id), elevesDeLaPromotion.length);
                        return (
                          <button
                            key={ev.id}
                            onClick={() => setEvaluationId(ev.id)}
                            className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-sm ${
                              isActive ? 'bg-primary text-primary-foreground font-medium shadow-sm' : 'hover:bg-muted text-foreground'
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              resume.nbNotes > 0
                                ? isActive ? 'bg-primary-foreground' : 'bg-green-500'
                                : isActive ? 'bg-primary-foreground/40' : 'bg-muted-foreground/30'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate">{ev.title}</p>
                              <p className={`text-xs truncate ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {matiere?.matiereName ?? '—'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Saisie des notes */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          {!evaluationSelectionnee ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ClipboardList className="h-14 w-14 mb-4 opacity-30" />
              <p className="font-medium">Sélectionnez une évaluation</p>
              <p className="text-sm mt-1 opacity-70 mb-4">Ou créez-en une nouvelle pour commencer la saisie</p>
              <Button
                size="sm" className="gap-2" disabled={categoriesDeLaFormation.length === 0 || matieresDuNiveau.length === 0 || periodesDeLaPromotion.length === 0}
                onClick={() => ouvrirDialogEval()}
              >
                <Plus className="h-3.5 w-3.5" />Nouvelle évaluation
              </Button>
            </div>
          ) : (() => {
            const ev = evaluationSelectionnee;
            const matiere = niveauMatieres.find(m => m.id === ev.niveauMatiereId);
            const categorie = baremeCategories.find(c => c.id === ev.categorieId);
            const periode = periodes.find(p => p.id === ev.periodeId);
            return (
              <>
                <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
                  <div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
                      <span>{matiere?.matiereName ?? '—'}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                      <span>{periode?.name ?? '—'}</span>
                    </div>
                    <h2 className="text-xl font-bold">{ev.title}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {categorie?.name ?? '—'} · {ev.type} · {ev.date} · /{ev.bareme}{ev.poids !== 1 && ` · poids ${ev.poids}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm text-muted-foreground min-w-[110px] text-right">
                      {saveState === 'saving' && <span className="animate-pulse">Enregistrement…</span>}
                      {saveState === 'saved' && <span className="flex items-center gap-1 justify-end text-green-600"><Check className="h-3.5 w-3.5" />Enregistré</span>}
                      {saveState === 'error' && <span className="flex items-center gap-1 justify-end text-destructive"><AlertCircle className="h-3.5 w-3.5" />Erreur</span>}
                    </span>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Supprimer l'évaluation"
                      onClick={() => setConfirmDeleteEvalId(ev.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {elevesDeLaPromotion.length === 0 ? (
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
                        <CardTitle className="text-base">{elevesDeLaPromotion.length} élève{elevesDeLaPromotion.length !== 1 ? 's' : ''}</CardTitle>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input placeholder="Rechercher un élève…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 w-48 h-8 text-sm" />
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
                              <TableHead className="min-w-[100px] text-center">Note /{ev.bareme}</TableHead>
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
                                      type="number" min={0} max={ev.bareme} step="0.25" className="w-20 text-center mx-auto h-8"
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
              </>
            );
          })()}
        </div>
      </div>

      {/* ── Nouvelle période ── */}
      <Dialog open={dialogPeriode} onOpenChange={setDialogPeriode}>
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

      {/* ── Nouvelle évaluation ── */}
      <Dialog open={dialogEval} onOpenChange={setDialogEval}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle évaluation</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Matière *</Label>
                <Select value={niveauMatiereId} onValueChange={setNiveauMatiereId}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {matieresDuNiveau.map(m => <SelectItem key={m.id} value={m.id}>{m.matiereName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Période *</Label>
                <Select value={periodeId} onValueChange={setPeriodeId}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {periodesDeLaPromotion.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Catégorie (barème) *</Label>
                <Select value={categorieId} onValueChange={setCategorieId}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {categoriesDeLaFormation.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.pourcentage} %)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES_EVALUATION_SUGGERES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            <div className="space-y-2">
              <Label htmlFor="eval-description">Description (optionnel)</Label>
              <Textarea id="eval-description" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <Button onClick={handleCreateEval} className="w-full" disabled={isSavingEval}>
              {isSavingEval && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

export default Evaluations;
