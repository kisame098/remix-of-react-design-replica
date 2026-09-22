import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, Loader2, ClipboardList, GraduationCap, Users, TrendingUp, BookOpen, ArrowLeft, ChevronRight,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { nomPeriodeValide, triPeriodes } from '@/lib/formationPro';

/**
 * Page 2 du module Évaluations : au sein d'une promotion, un panneau gauche
 * de périodes (même squelette que Gestion des Notes — src/pages/GradeManagement.tsx)
 * et, à droite, le tableau des matières avec leurs stats de saisie
 * (même contenu que src/pages/ClassSubjects.tsx : cartes de stats + tableau
 * matière/coefficient/progression/action).
 */
const EvaluationsPromotion = () => {
  const { promotionId } = useParams<{ promotionId: string }>();
  const navigate = useNavigate();
  const {
    loading, promotions, formations, niveaux, niveauMatieres, baremeCategories,
    periodes, evaluations, notes, addPeriode, deletePeriode,
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
    () => baremeCategories.filter(c => formation && c.formationId === formation.id),
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

  const [periodeId, setPeriodeId] = useState<string | null>(null);
  const periodeSelectionnee = periodesDeLaPromotion.find(p => p.id === periodeId) ?? periodesDeLaPromotion[0] ?? null;

  // Stats par matière, pour la période sélectionnée : combien d'évaluations
  // créées, combien ont au moins une note saisie — même logique que
  // ClassSubjects::subjectCompletion, adaptée aux évaluations dynamiques.
  const statsParMatiere = useMemo(() => {
    if (!periodeSelectionnee) return {} as Record<string, { nbEvaluations: number; nbAvecNotes: number; pct: number }>;
    return matieresDuNiveau.reduce((acc, m) => {
      const evalsMatiere = evaluations.filter(e => e.promotionId === promotionId && e.periodeId === periodeSelectionnee.id && e.niveauMatiereId === m.id);
      const avecNotes = evalsMatiere.filter(e => notes.some(n => n.evaluationId === e.id && n.statut !== 'non_evalue')).length;
      acc[m.id] = {
        nbEvaluations: evalsMatiere.length, nbAvecNotes: avecNotes,
        pct: evalsMatiere.length > 0 ? Math.round((avecNotes / evalsMatiere.length) * 100) : 0,
      };
      return acc;
    }, {} as Record<string, { nbEvaluations: number; nbAvecNotes: number; pct: number }>);
  }, [matieresDuNiveau, evaluations, notes, periodeSelectionnee, promotionId]);

  const stats = useMemo(() => {
    const totalEvaluations = Object.values(statsParMatiere).reduce((s, v) => s + v.nbEvaluations, 0);
    const matieresAvecEval = Object.values(statsParMatiere).filter(v => v.nbEvaluations > 0).length;
    return {
      totalStudents: elevesDeLaPromotion.length,
      totalEvaluations,
      completion: matieresDuNiveau.length > 0 ? Math.round((matieresAvecEval / matieresDuNiveau.length) * 100) : 0,
    };
  }, [statsParMatiere, elevesDeLaPromotion, matieresDuNiveau]);

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
      <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
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

      {categoriesDeLaFormation.length === 0 && (
        <div className="mx-6 mt-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground flex-shrink-0">
          Aucune formule d'évaluation définie pour « {formation?.name} ». Le directeur doit d'abord définir les
          catégories (contrôle continu, TP, examen…) sur la{' '}
          <Link to={`/formation/formations/${formation?.id}`} className="text-primary hover:underline">page de la formation</Link>.
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* LEFT PANEL — Périodes (même squelette que Gestion des Notes) */}
        <div className="w-60 border-r flex-shrink-0 flex flex-col bg-muted/10">
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Périodes</p>
              <Dialog open={dialogPeriode} onOpenChange={setDialogPeriode}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Nouvelle période"><Plus className="h-3.5 w-3.5" /></Button>
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
            {periodesDeLaPromotion.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm px-4">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Aucune période</p>
                <p className="text-xs mt-1">Créez une période pour commencer</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {periodesDeLaPromotion.map(per => {
                  const isSelected = (periodeSelectionnee?.id ?? null) === per.id;
                  return (
                    <div
                      key={per.id} role="button" tabIndex={0}
                      onClick={() => setPeriodeId(per.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setPeriodeId(per.id)}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg transition-all group cursor-pointer ${
                        isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="text-sm font-medium truncate">{per.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeletePeriodeId(per.id); }}
                        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${
                          isSelected ? 'hover:bg-primary-foreground/20 text-primary-foreground' : 'hover:bg-destructive/10 text-destructive'
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Matières et leurs statistiques (comme ClassSubjects) */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          {!periodeSelectionnee ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <GraduationCap className="h-14 w-14 mb-4 opacity-30" />
              <p className="font-medium">Sélectionnez une période</p>
              <p className="text-sm mt-1 opacity-70">Choisissez une période dans le panneau gauche</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600"><Users className="h-5 w-5" /></div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalStudents}</p>
                      <p className="text-xs text-muted-foreground">Élèves dans la promotion</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" /></div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalEvaluations}</p>
                      <p className="text-xs text-muted-foreground">Évaluation{stats.totalEvaluations !== 1 ? 's' : ''} créée{stats.totalEvaluations !== 1 ? 's' : ''}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10 text-green-600"><TrendingUp className="h-5 w-5" /></div>
                    <div>
                      <p className="text-2xl font-bold">{stats.completion}%</p>
                      <p className="text-xs text-muted-foreground">Matières avec évaluations</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {matieresDuNiveau.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-14">
                    <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground font-medium">Aucune matière au programme</p>
                    <Button variant="link" onClick={() => niveau && navigate(`/formation/formations/${formation?.id}/niveaux/${niveau.id}`)}>
                      Gérer le programme
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matière</TableHead>
                          <TableHead className="text-center w-24">Coefficient</TableHead>
                          <TableHead className="text-center w-44">Évaluations notées</TableHead>
                          <TableHead className="text-right w-48">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matieresDuNiveau.map(m => {
                          const comp = statsParMatiere[m.id] ?? { nbEvaluations: 0, nbAvecNotes: 0, pct: 0 };
                          const isComplete = comp.nbEvaluations > 0 && comp.pct === 100;
                          const hasStarted = comp.nbAvecNotes > 0;
                          return (
                            <TableRow key={m.id} className="group">
                              <TableCell className="font-medium">{m.matiereName}</TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                                  {m.coefficient}
                                </span>
                              </TableCell>
                              <TableCell>
                                {comp.nbEvaluations === 0 ? (
                                  <span className="text-xs text-muted-foreground">Aucune évaluation</span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${comp.pct}%` }} />
                                    </div>
                                    <Badge variant={isComplete ? 'default' : hasStarted ? 'secondary' : 'outline'} className={`text-xs flex-shrink-0 ${isComplete ? 'bg-green-500 hover:bg-green-500' : ''}`}>
                                      {comp.nbAvecNotes}/{comp.nbEvaluations}
                                    </Badge>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline" size="sm"
                                  onClick={() => navigate(`/formation/evaluations/${promotionId}/${periodeSelectionnee.id}/${m.id}`)}
                                >
                                  Voir les évaluations
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
};

export default EvaluationsPromotion;
