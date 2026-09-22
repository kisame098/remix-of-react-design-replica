import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, ChevronRight, Users, Check, AlertCircle, Search, Plus, Trash2, Loader2, ClipboardList,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  triEvaluations, resumeEvaluation, titreEvaluationValide, baremeValide, poidsValide,
  TYPES_EVALUATION_SUGGERES, LIBELLES_STATUT_NOTE, type StatutNote,
} from '@/lib/formationPro';

/**
 * Page 3 du module Évaluations : au sein d'une matière (pour une période),
 * un panneau gauche listant ses évaluations (même squelette que la sidebar
 * matières de src/pages/SubjectGrades.tsx) et, à droite, le tableau de
 * saisie des notes avec sauvegarde automatique (même comportement que
 * SubjectGrades — un point vert quand des notes existent déjà).
 */
const EvaluationsMatiere = () => {
  const { promotionId, periodeId, matiereId } = useParams<{ promotionId: string; periodeId: string; matiereId: string }>();
  const navigate = useNavigate();
  const {
    loading, promotions, formations, niveaux, niveauMatieres, baremeCategories, periodes, evaluations, notes,
    addEvaluation, deleteEvaluation, saisirNote,
  } = useFormationPro();
  const { students } = useSchool();

  const promotion = promotions.find(p => p.id === promotionId);
  const niveau = promotion ? niveaux.find(n => n.id === promotion.niveauId) : null;
  const formation = niveau ? formations.find(f => f.id === niveau.formationId) : null;
  const periode = periodes.find(p => p.id === periodeId);
  const matiere = niveauMatieres.find(m => m.id === matiereId);

  const categoriesDeLaFormation = useMemo(
    () => baremeCategories.filter(c => formation && c.formationId === formation.id).sort((a, b) => a.ordering - b.ordering),
    [baremeCategories, formation],
  );
  const evaluationsDeLaMatiere = useMemo(
    () => triEvaluations(evaluations.filter(e => e.promotionId === promotionId && e.periodeId === periodeId && e.niveauMatiereId === matiereId)),
    [evaluations, promotionId, periodeId, matiereId],
  );
  const elevesDeLaPromotion = useMemo(
    () => students.filter(s => promotion && s.classId === promotion.classId),
    [students, promotion],
  );

  const [evaluationId, setEvaluationId] = useState<string | null>(evaluationsDeLaMatiere[0]?.id ?? null);
  useEffect(() => {
    if (!evaluationId && evaluationsDeLaMatiere.length > 0) setEvaluationId(evaluationsDeLaMatiere[0].id);
  }, [evaluationsDeLaMatiere, evaluationId]);
  const evaluationSelectionnee = evaluations.find(e => e.id === evaluationId) ?? null;

  // ── Créer une évaluation (matière/période/promotion déjà fixées par l'URL) ─
  const [dialogEval, setDialogEval] = useState(false);
  const [categorieId, setCategorieId] = useState('');
  const [type, setType] = useState<string>(TYPES_EVALUATION_SUGGERES[0]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bareme, setBareme] = useState('20');
  const [poids, setPoids] = useState('1');
  const [description, setDescription] = useState('');
  const [isSavingEval, setIsSavingEval] = useState(false);

  const resetEvalForm = () => {
    setCategorieId(''); setType(TYPES_EVALUATION_SUGGERES[0] as string); setTitle('');
    setDate(new Date().toISOString().slice(0, 10)); setBareme('20'); setPoids('1'); setDescription('');
  };

  const handleCreateEval = async () => {
    const baremeNum = Number(bareme);
    const poidsNum = Number(poids);
    if (!promotionId || !periodeId || !matiereId || !categorieId || !titreEvaluationValide(title) || !baremeValide(baremeNum) || !poidsValide(poidsNum)) {
      toast({ title: 'Erreur', description: 'Catégorie, titre, barème et poids sont obligatoires.', variant: 'destructive' });
      return;
    }
    setIsSavingEval(true);
    try {
      const ev = await addEvaluation({
        promotionId, niveauMatiereId: matiereId, periodeId, categorieId, type, title: title.trim(),
        date, bareme: baremeNum, poids: poidsNum, description: description.trim() || undefined,
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
  if (!promotion || !periode || !matiere) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/formation/evaluations" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Évaluations</Link>
        <p className="text-destructive text-sm">Données non trouvées.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* ── SIDEBAR NAVIGATION DES ÉVALUATIONS (comme la sidebar matières de Saisie des Notes) ── */}
      <div className="w-56 border-r flex-shrink-0 flex flex-col bg-muted/10 overflow-hidden">
        <div className="p-3 border-b bg-background flex-shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Évaluations</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{matiere.matiereName} · {periode.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {evaluationsDeLaMatiere.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 px-3">Aucune évaluation</p>
          ) : (
            evaluationsDeLaMatiere.map(ev => {
              const isActive = ev.id === evaluationId;
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
                    resume.nbNotes > 0 ? (isActive ? 'bg-primary-foreground' : 'bg-green-500') : (isActive ? 'bg-primary-foreground/40' : 'bg-muted-foreground/30')
                  }`} />
                  <span className="truncate flex-1">{ev.title}</span>
                  <span className={`text-xs flex-shrink-0 ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>/{ev.bareme}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="p-2 border-t flex-shrink-0">
          <Dialog open={dialogEval} onOpenChange={(open) => { setDialogEval(open); if (!open) resetEvalForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full gap-1.5" disabled={categoriesDeLaFormation.length === 0}>
                <Plus className="h-3.5 w-3.5" />Nouvelle évaluation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvelle évaluation — {matiere.matiereName}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
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
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="flex-shrink-0 mt-0.5" onClick={() => navigate(`/formation/evaluations/${promotionId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
                <button onClick={() => navigate('/formation/evaluations')} className="hover:text-foreground transition-colors">Évaluations</button>
                <ChevronRight className="h-3.5 w-3.5" />
                <button onClick={() => navigate(`/formation/evaluations/${promotionId}`)} className="hover:text-foreground transition-colors">{promotion.name}</button>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground truncate">{matiere.matiereName}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">{evaluationSelectionnee ? evaluationSelectionnee.title : 'Évaluations'}</h1>
            </div>
            {evaluationSelectionnee && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm text-muted-foreground min-w-[110px] text-right">
                  {saveState === 'saving' && <span className="animate-pulse">Enregistrement…</span>}
                  {saveState === 'saved' && <span className="flex items-center gap-1 justify-end text-green-600"><Check className="h-3.5 w-3.5" />Enregistré</span>}
                  {saveState === 'error' && <span className="flex items-center gap-1 justify-end text-destructive"><AlertCircle className="h-3.5 w-3.5" />Erreur</span>}
                </span>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Supprimer l'évaluation" onClick={() => setConfirmDeleteEvalId(evaluationSelectionnee.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {!evaluationSelectionnee ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-14">
                <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">Aucune évaluation sélectionnée</p>
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
                  <CardTitle className="text-base">{elevesDeLaPromotion.length} élève{elevesDeLaPromotion.length !== 1 ? 's' : ''} — /{evaluationSelectionnee.bareme}</CardTitle>
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
      </div>

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

export default EvaluationsMatiere;
