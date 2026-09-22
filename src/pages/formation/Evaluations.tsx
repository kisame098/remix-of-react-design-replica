import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ClipboardList, Plus, Loader2, Trash2, Pencil, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  triPromotions, grouperPromotions, triPeriodes, triEvaluations, resumeEvaluation,
  titreEvaluationValide, baremeValide, poidsValide, nomPeriodeValide,
  TYPES_EVALUATION_SUGGERES, LIBELLES_STATUT_NOTE,
  type StatutNote,
} from '@/lib/formationPro';

/**
 * Page Évaluations : liste des évaluations d'une promotion (filtrée dans le
 * sélecteur), création d'une évaluation (matière → période → catégorie du
 * barème → titre/date/barème/poids), et saisie des notes élève par élève.
 * Les moyennes ne sont pas encore affichées ici — cette page couvre la
 * saisie ; les moyennes viendront avec les bulletins (Examens + Évaluations).
 */
const Evaluations = () => {
  const {
    loading, promotions, formations, niveaux, niveauMatieres, baremeCategories,
    periodes, evaluations, notes,
    addPeriode, addEvaluation, deleteEvaluation, saisirNote,
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

  // ── Créer une période à la volée (pas de calendrier partagé) ─────────────
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

  const resetEvalForm = () => {
    setNiveauMatiereId(''); setPeriodeId(''); setCategorieId(''); setType(TYPES_EVALUATION_SUGGERES[0] as string);
    setTitle(''); setDate(new Date().toISOString().slice(0, 10)); setBareme('20'); setPoids('1'); setDescription('');
    setDialogEval(false);
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
      await addEvaluation({
        promotionId: promotion.id, niveauMatiereId, periodeId, categorieId, type, title: title.trim(),
        date, bareme: baremeNum, poids: poidsNum, description: description.trim() || undefined,
      });
      toast({ title: 'Évaluation créée', description: title });
      resetEvalForm();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingEval(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const handleDeleteEval = async (id: string) => {
    try {
      await deleteEvaluation(id);
      toast({ title: 'Évaluation supprimée' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // ── Saisie des notes d'une évaluation ─────────────────────────────────────
  const [saisieEvalId, setSaisieEvalId] = useState<string | null>(null);
  const evaluationEnSaisie = evaluations.find(e => e.id === saisieEvalId) ?? null;
  const notesEnSaisie = useMemo(
    () => notes.filter(n => saisieEvalId && n.evaluationId === saisieEvalId),
    [notes, saisieEvalId],
  );
  const [brouillon, setBrouillon] = useState<Record<string, { valeur: string; statut: StatutNote }>>({});

  const ouvrirSaisie = (evalId: string) => {
    const initial: Record<string, { valeur: string; statut: StatutNote }> = {};
    for (const s of elevesDeLaPromotion) {
      const n = notes.find(x => x.evaluationId === evalId && x.studentEnrollmentId === s.id);
      initial[s.id] = { valeur: n?.valeur != null ? String(n.valeur) : '', statut: n?.statut ?? 'note' };
    }
    setBrouillon(initial);
    setSaisieEvalId(evalId);
  };

  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const handleSaveNotes = async () => {
    if (!evaluationEnSaisie) return;
    setIsSavingNotes(true);
    try {
      for (const s of elevesDeLaPromotion) {
        const b = brouillon[s.id];
        if (!b) continue;
        const valeur = b.statut === 'note' ? Number(b.valeur) : undefined;
        if (b.statut === 'note' && (!Number.isFinite(valeur) || valeur === undefined)) continue;
        await saisirNote(evaluationEnSaisie.id, s.id, { valeur, statut: b.statut });
      }
      toast({ title: 'Notes enregistrées' });
      setSaisieEvalId(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingNotes(false);
    }
  };

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Évaluations</h1>
      </div>

      <div className="max-w-md space-y-2">
        <Label htmlFor="promo-select">Promotion</Label>
        <Select value={promotionId ?? undefined} onValueChange={setPromotionId}>
          <SelectTrigger id="promo-select"><SelectValue placeholder="Choisir une promotion…" /></SelectTrigger>
          <SelectContent>
            {groupes.map(gf => gf.niveaux.map(gn => gn.promotions.map(p => (
              <SelectItem key={p.id} value={p.id}>{gf.formation.name} — {gn.niveau.name} — {p.name}</SelectItem>
            ))))}
          </SelectContent>
        </Select>
      </div>

      {promotion && (
        <>
          {categoriesDeLaFormation.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-6 text-sm text-muted-foreground flex items-center gap-2">
                Aucune formule d'évaluation définie pour « {formation?.name} ». Le directeur doit d'abord créer les
                catégories (contrôle continu, TP, examen…) sur la page{' '}
                <Link to={`/formation/formations/${formation?.id}`} className="text-primary hover:underline">de la formation</Link>.
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Périodes :</span>
              {periodesDeLaPromotion.length === 0 && <span className="text-sm text-muted-foreground italic">aucune</span>}
              {periodesDeLaPromotion.map(p => <Badge key={p.id} variant="secondary">{p.name}</Badge>)}
              <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => setDialogPeriode(true)}>
                <Plus className="h-3 w-3" />Période
              </Button>
            </div>
            <Button
              size="sm" className="gap-2" disabled={categoriesDeLaFormation.length === 0 || matieresDuNiveau.length === 0}
              onClick={() => setDialogEval(true)}
            >
              <Plus className="h-3.5 w-3.5" />Nouvelle évaluation
            </Button>
          </div>

          {evaluationsDeLaPromotion.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <ClipboardList className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Aucune évaluation créée</h3>
                <p className="text-muted-foreground">Ajoutez une évaluation pour commencer la saisie des notes.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {evaluationsDeLaPromotion.map(ev => {
                const matiere = niveauMatieres.find(m => m.id === ev.niveauMatiereId);
                const categorie = baremeCategories.find(c => c.id === ev.categorieId);
                const periode = periodes.find(p => p.id === ev.periodeId);
                const resume = resumeEvaluation(ev, notes.filter(n => n.evaluationId === ev.id), elevesDeLaPromotion.length);
                return (
                  <Card key={ev.id} className="group">
                    <CardContent className="py-3 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="text-sm font-medium">{ev.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {matiere?.matiereName ?? '—'} · {categorie?.name ?? '—'} · {periode?.name ?? '—'} · {ev.type} · {ev.date} · /{ev.bareme}
                          {ev.poids !== 1 && ` · poids ${ev.poids}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />{resume.nbNotes}/{resume.nbAttendus}
                          {resume.moyenne !== null && ` · moy. ${resume.moyenne.toFixed(1)}/20`}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => ouvrirSaisie(ev.id)}>Saisir les notes</Button>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
                          title="Supprimer" onClick={() => setConfirmDeleteId(ev.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Nouvelle période ── */}
      <Dialog open={dialogPeriode} onOpenChange={setDialogPeriode}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle période</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="periode-name">Nom *</Label>
              <Input id="periode-name" placeholder="Ex : Semestre 1, Trimestre 1…" value={periodeName} onChange={e => setPeriodeName(e.target.value)} />
            </div>
            <Button onClick={handleCreatePeriode} className="w-full" disabled={isSavingPeriode}>
              {isSavingPeriode && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Nouvelle évaluation ── */}
      <Dialog open={dialogEval} onOpenChange={(open) => !open && resetEvalForm()}>
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

      {/* ── Suppression d'une évaluation ── */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette évaluation ?</AlertDialogTitle>
            <AlertDialogDescription>Toutes les notes saisies pour cette évaluation seront supprimées. Cette action ne peut pas être défaite.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDeleteId && void handleDeleteEval(confirmDeleteId)}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Saisie des notes ── */}
      <Dialog open={!!evaluationEnSaisie} onOpenChange={(open) => !open && setSaisieEvalId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{evaluationEnSaisie?.title} — saisie des notes (/{evaluationEnSaisie?.bareme})</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {elevesDeLaPromotion.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun élève inscrit dans cette promotion.</p>
            ) : elevesDeLaPromotion.map(s => {
              const b = brouillon[s.id] ?? { valeur: '', statut: 'note' as StatutNote };
              return (
                <div key={s.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                  <span className="text-sm flex-1 truncate">{s.firstName} {s.lastName}</span>
                  <Select value={b.statut} onValueChange={(v) => setBrouillon(prev => ({ ...prev, [s.id]: { ...b, statut: v as StatutNote } }))}>
                    <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LIBELLES_STATUT_NOTE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" min={0} className="w-20 h-8" disabled={b.statut !== 'note'}
                    value={b.valeur} onChange={(e) => setBrouillon(prev => ({ ...prev, [s.id]: { ...b, valeur: e.target.value } }))}
                  />
                </div>
              );
            })}
            <Button onClick={handleSaveNotes} className="w-full" disabled={isSavingNotes || elevesDeLaPromotion.length === 0}>
              {isSavingNotes && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer les notes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Evaluations;
