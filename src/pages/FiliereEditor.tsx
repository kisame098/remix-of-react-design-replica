import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Plus, Trash2, Edit, Loader2, ChevronRight, ChevronDown,
  BookOpen, ListChecks, X, CircleDashed, GraduationCap,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  NIVEAUX_LYCEE, NIVEAU_BASE, mergeFiliereMandatorySubjects, mergeFiliereChoiceGroups, mergeFiliereFacultativeSubjects,
} from '@/contexts/SchoolContext';

// ─── Éditeur d'une filière ──────────────────────────────────────────────────
// Une filière (S, S1, L2…) ne s'applique pas forcément à tous les niveaux —
// la 2nde est un tronc commun (seul "S" ou "L" y existe), les séries précises
// (S1/S2/L2/L'1…) n'existent qu'à partir de la 1ère. Les onglets affichés ici
// reflètent donc les niveaux réellement déclarés sur CE cursus (filiere.niveaux),
// pas une liste fixe. La plupart des matières gardent le MÊME coefficient à
// tous les niveaux déclarés — on les saisit UNE FOIS dans l'onglet "Tous
// niveaux" (visible seulement si plus d'un niveau est déclaré). Seule une
// poignée change ou n'existe qu'à un niveau donné (ex: Philosophie en
// Terminale) — on les ajoute dans l'onglet du niveau concerné, où elles
// remplacent la ligne de base de même nom.

const niveauTabLabel = (n: string) => n === NIVEAU_BASE ? 'Tous niveaux' : n;

const FiliereEditor = () => {
  const { filiereId } = useParams<{ filiereId: string }>();
  const navigate = useNavigate();
  const {
    filieres, filiereMandatorySubjects, filiereFacultativeSubjects, filiereChoiceGroups,
    updateFiliereNiveaux,
    addFiliereMandatorySubject, updateFiliereMandatorySubject, deleteFiliereMandatorySubject,
    addFiliereFacultativeSubject, updateFiliereFacultativeSubject, deleteFiliereFacultativeSubject,
    addFiliereChoiceGroup, updateFiliereChoiceGroup, deleteFiliereChoiceGroup,
    addFiliereChoiceOption, deleteFiliereChoiceOption,
  } = useSchool();

  const filiere = filieres.find(f => f.id === filiereId);
  const allMandatorySubjects = filiereMandatorySubjects.filter(m => m.filiereId === filiereId);
  const allFacultativeSubjects = filiereFacultativeSubjects.filter(m => m.filiereId === filiereId);
  const allChoiceGroups = filiereChoiceGroups.filter(g => g.filiereId === filiereId);

  const declaredNiveaux = filiere?.niveaux ?? [];
  // "Tous niveaux" n'a de sens que s'il y a plus d'un niveau à fusionner —
  // pour un cursus mono-niveau (ex: "S" en 2nde seulement), l'unique onglet
  // EST la base, pas la peine de dupliquer.
  const niveauTabs = declaredNiveaux.length > 1 ? [NIVEAU_BASE, ...declaredNiveaux] : declaredNiveaux;
  const [savingNiveaux, setSavingNiveaux] = useState(false);

  const [activeNiveau, setActiveNiveau] = useState<string>('');
  useEffect(() => {
    if (niveauTabs.length > 0 && !niveauTabs.includes(activeNiveau)) {
      setActiveNiveau(niveauTabs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filiere?.id, niveauTabs.join(',')]);

  const isBaseTab = activeNiveau === NIVEAU_BASE || niveauTabs.length <= 1;

  const toggleNiveau = async (n: string) => {
    if (!filiere) return;
    const next = declaredNiveaux.includes(n) ? declaredNiveaux.filter(x => x !== n) : [...declaredNiveaux, n];
    setSavingNiveaux(true);
    try {
      await updateFiliereNiveaux(filiere.id, next);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setSavingNiveaux(false);
    }
  };
  // Sur l'onglet d'un niveau précis, on édite les ajouts/redéfinitions propres
  // à ce niveau — la base se modifie depuis l'onglet "Tous niveaux".
  const mandatorySubjects = allMandatorySubjects.filter(m => m.niveau === activeNiveau);
  const facultativeSubjects = allFacultativeSubjects.filter(m => m.niveau === activeNiveau);
  const choiceGroups = allChoiceGroups.filter(g => g.niveau === activeNiveau);
  const mergedMandatorySubjects = isBaseTab ? [] : mergeFiliereMandatorySubjects(allMandatorySubjects, filiereId ?? '', activeNiveau);
  const mergedFacultativeSubjects = isBaseTab ? [] : mergeFiliereFacultativeSubjects(allFacultativeSubjects, filiereId ?? '', activeNiveau);
  const mergedChoiceGroups = isBaseTab ? [] : mergeFiliereChoiceGroups(allChoiceGroups, filiereId ?? '', activeNiveau);
  // Un niveau déclaré sans base ET sans ajout propre ne recevra aucune matière.
  const emptyNiveaux = new Set<string>(
    declaredNiveaux.filter(n =>
      mergeFiliereMandatorySubjects(allMandatorySubjects, filiereId ?? '', n).length === 0 &&
      mergeFiliereFacultativeSubjects(allFacultativeSubjects, filiereId ?? '', n).length === 0 &&
      mergeFiliereChoiceGroups(allChoiceGroups, filiereId ?? '', n).length === 0
    )
  );

  // ── Matière obligatoire : dialogue ajout/édition ──
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCoef, setSubjectCoef] = useState('1');
  const [savingSubject, setSavingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);

  // ── Matière facultative : dialogue ajout/édition ──
  const [isFacultativeDialogOpen, setIsFacultativeDialogOpen] = useState(false);
  const [editingFacultativeId, setEditingFacultativeId] = useState<string | null>(null);
  const [facultativeName, setFacultativeName] = useState('');
  const [facultativeCoef, setFacultativeCoef] = useState('1');
  const [savingFacultative, setSavingFacultative] = useState(false);
  const [deletingFacultativeId, setDeletingFacultativeId] = useState<string | null>(null);

  // ── Groupe au choix : dialogue ajout/édition ──
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupLabel, setGroupLabel] = useState('');
  const [groupCoef, setGroupCoef] = useState('1');
  const [savingGroup, setSavingGroup] = useState(false);

  // ── Options d'un groupe (dépliage inline) ──
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [newOptionName, setNewOptionName] = useState('');
  const [addingOption, setAddingOption] = useState(false);

  if (!filiere) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Cursus introuvable</p>
        <Button variant="link" onClick={() => navigate('/filieres')}>Retour aux cursus</Button>
      </div>
    );
  }

  // ── Matières obligatoires ──
  const resetSubjectForm = () => {
    setSubjectName(''); setSubjectCoef('1'); setEditingSubjectId(null); setIsSubjectDialogOpen(false);
  };

  const handleSaveSubject = async () => {
    if (!subjectName.trim()) {
      toast({ title: 'Erreur', description: 'Le nom de la matière est requis', variant: 'destructive' });
      return;
    }
    const coef = parseFloat(subjectCoef);
    if (isNaN(coef) || coef <= 0) {
      toast({ title: 'Erreur', description: 'Le coefficient doit être un nombre positif', variant: 'destructive' });
      return;
    }
    setSavingSubject(true);
    try {
      if (editingSubjectId) {
        await updateFiliereMandatorySubject(editingSubjectId, { name: subjectName.trim(), coefficient: coef });
      } else {
        await addFiliereMandatorySubject(filiere.id, { niveau: activeNiveau, name: subjectName.trim(), coefficient: coef });
      }
      resetSubjectForm();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setSavingSubject(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    setDeletingSubjectId(id);
    try {
      await deleteFiliereMandatorySubject(id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingSubjectId(null);
    }
  };

  // ── Matières facultatives ──
  const resetFacultativeForm = () => {
    setFacultativeName(''); setFacultativeCoef('1'); setEditingFacultativeId(null); setIsFacultativeDialogOpen(false);
  };

  const handleSaveFacultative = async () => {
    if (!facultativeName.trim()) {
      toast({ title: 'Erreur', description: 'Le nom de la matière est requis', variant: 'destructive' });
      return;
    }
    const coef = parseFloat(facultativeCoef);
    if (isNaN(coef) || coef <= 0) {
      toast({ title: 'Erreur', description: 'Le coefficient doit être un nombre positif', variant: 'destructive' });
      return;
    }
    setSavingFacultative(true);
    try {
      if (editingFacultativeId) {
        await updateFiliereFacultativeSubject(editingFacultativeId, { name: facultativeName.trim(), coefficient: coef });
      } else {
        await addFiliereFacultativeSubject(filiere.id, { niveau: activeNiveau, name: facultativeName.trim(), coefficient: coef });
      }
      resetFacultativeForm();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setSavingFacultative(false);
    }
  };

  const handleDeleteFacultative = async (id: string) => {
    setDeletingFacultativeId(id);
    try {
      await deleteFiliereFacultativeSubject(id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingFacultativeId(null);
    }
  };

  // ── Groupes au choix ──
  const resetGroupForm = () => {
    setGroupLabel(''); setGroupCoef('1'); setEditingGroupId(null); setIsGroupDialogOpen(false);
  };

  const handleSaveGroup = async () => {
    if (!groupLabel.trim()) {
      toast({ title: 'Erreur', description: 'Le nom du créneau est requis', variant: 'destructive' });
      return;
    }
    const coef = parseFloat(groupCoef);
    if (isNaN(coef) || coef <= 0) {
      toast({ title: 'Erreur', description: 'Le coefficient doit être un nombre positif', variant: 'destructive' });
      return;
    }
    setSavingGroup(true);
    try {
      if (editingGroupId) {
        await updateFiliereChoiceGroup(editingGroupId, { label: groupLabel.trim(), coefficient: coef });
      } else {
        const group = await addFiliereChoiceGroup(filiere.id, { niveau: activeNiveau, label: groupLabel.trim(), coefficient: coef });
        setExpandedGroupId(group.id);
      }
      resetGroupForm();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await deleteFiliereChoiceGroup(id);
      if (expandedGroupId === id) setExpandedGroupId(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    }
  };

  const handleAddOption = async (groupId: string) => {
    if (!newOptionName.trim()) return;
    setAddingOption(true);
    try {
      await addFiliereChoiceOption(groupId, newOptionName.trim());
      setNewOptionName('');
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setAddingOption(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/filieres')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
            <button onClick={() => navigate('/filieres')} className="hover:text-foreground transition-colors">Cursus</button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{filiere.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground truncate">{filiere.name}</h1>
          {filiere.description && <p className="text-sm text-muted-foreground mt-0.5">{filiere.description}</p>}
        </div>
      </div>

      {/* ── Niveaux applicables ── la 2nde est un tronc commun (seul "S"/"L"
          y existe) ; les séries précises n'existent qu'à partir de la 1ère —
          on ne propose donc jamais bêtement les 3 niveaux pour tout le monde. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            Niveaux où "{filiere.name}" s'applique
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {NIVEAUX_LYCEE.map(n => (
            <button
              key={n}
              disabled={savingNiveaux}
              onClick={() => toggleNiveau(n)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-60',
                declaredNiveaux.includes(n)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-input hover:border-primary/40',
              )}
            >
              {n}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            {declaredNiveaux.length === 0
              ? 'Sélectionnez au moins un niveau — 2nde seule pour un tronc commun (ex: S, L), 1ère+Tle pour une série précise (ex: S1, L2).'
              : 'Cliquez pour ajouter/retirer un niveau.'}
          </span>
        </CardContent>
      </Card>

      {declaredNiveaux.length === 0 ? null : (
      <>
      {/* ── Onglet édité ── "Tous niveaux" = base commune (seulement si plus
          d'un niveau déclaré) ; sinon chaque onglet = un niveau déclaré. ── */}
      <div>
        <Tabs value={activeNiveau} onValueChange={setActiveNiveau}>
          <TabsList>
            {niveauTabs.map(n => (
              <TabsTrigger key={n} value={n} className="gap-1.5">
                {niveauTabLabel(n)}
                {n !== NIVEAU_BASE && emptyNiveaux.has(n) && <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground mt-2">
          {niveauTabs.length <= 1
            ? `Matières de "${filiere.name}" pour ${activeNiveau}.`
            : isBaseTab
            ? `Matières communes à tous les niveaux où "${filiere.name}" est utilisée. Une matière ajoutée dans un onglet de niveau (ex: Tle) remplace celle-ci pour ce niveau uniquement.`
            : `Ajoutez ici uniquement ce qui change pour ${activeNiveau} (une nouvelle matière comme Philosophie, ou une redéfinition — même nom qu'en base, coefficient différent). Le reste vient automatiquement de "Tous niveaux".`}
          {niveauTabs.length > 1 && ' (le point gris = ce niveau ne recevra aucune matière tant qu\'il est vide, ni en base ni en ajout).'}
        </p>
      </div>

      {/* ── Matières obligatoires ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Matières obligatoires
          </CardTitle>
          <Dialog open={isSubjectDialogOpen} onOpenChange={(open) => { if (!open) resetSubjectForm(); setIsSubjectDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Ajouter</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingSubjectId ? 'Modifier' : 'Ajouter'} une matière obligatoire</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nom de la matière</Label>
                  <Input placeholder="Ex: Philosophie" value={subjectName} onChange={(e) => setSubjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveSubject()} />
                </div>
                <div className="space-y-2">
                  <Label>Coefficient</Label>
                  <Input type="number" min="0.5" step="0.5" value={subjectCoef} onChange={(e) => setSubjectCoef(e.target.value)} />
                </div>
                <Button onClick={handleSaveSubject} className="w-full" disabled={savingSubject}>
                  {savingSubject && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingSubjectId ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {mandatorySubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {isBaseTab
                ? 'Aucune matière — ajoutez celles que tous les élèves de ce cursus doivent suivre.'
                : `Aucun ajout/redéfinition pour ${activeNiveau} — ce niveau utilise uniquement la base "Tous niveaux".`}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matière</TableHead>
                  <TableHead className="text-center w-24">Coefficient</TableHead>
                  <TableHead className="text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mandatorySubjects.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                        {m.coefficient}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingSubjectId(m.id); setSubjectName(m.name); setSubjectCoef(String(m.coefficient));
                          setIsSubjectDialogOpen(true);
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          disabled={deletingSubjectId === m.id}
                          onClick={() => handleDeleteSubject(m.id)}
                        >
                          {deletingSubjectId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Aperçu fusionné (lecture seule) : ce que recevra concrètement une classe de ce niveau */}
      {!isBaseTab && (
        <Card className="bg-muted/20 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Aperçu pour {activeNiveau} (base + ajouts fusionnés)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mergedMandatorySubjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune matière — rien ne sera activé pour ce niveau.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {mergedMandatorySubjects.map(m => (
                  <Badge key={m.id} variant="secondary" className="gap-1.5">
                    {m.name}
                    <span className="text-muted-foreground">coef {m.coefficient}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Matières facultatives ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CircleDashed className="h-4 w-4 text-muted-foreground" />
              Matières facultatives
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              L'élève peut l'activer ou non, sans exclusion avec quoi que ce soit d'autre (ex: Latin, Conduite, Informatique).
            </p>
          </div>
          <Dialog open={isFacultativeDialogOpen} onOpenChange={(open) => { if (!open) resetFacultativeForm(); setIsFacultativeDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0"><Plus className="h-3.5 w-3.5" />Ajouter</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingFacultativeId ? 'Modifier' : 'Ajouter'} une matière facultative</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nom de la matière</Label>
                  <Input placeholder="Ex: Latin" value={facultativeName} onChange={(e) => setFacultativeName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveFacultative()} />
                </div>
                <div className="space-y-2">
                  <Label>Coefficient</Label>
                  <Input type="number" min="0.5" step="0.5" value={facultativeCoef} onChange={(e) => setFacultativeCoef(e.target.value)} />
                </div>
                <Button onClick={handleSaveFacultative} className="w-full" disabled={savingFacultative}>
                  {savingFacultative && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingFacultativeId ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {facultativeSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {isBaseTab
                ? 'Aucune matière facultative pour l\'instant.'
                : `Aucun ajout/redéfinition pour ${activeNiveau} — ce niveau utilise uniquement la base "Tous niveaux".`}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matière</TableHead>
                  <TableHead className="text-center w-24">Coefficient</TableHead>
                  <TableHead className="text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facultativeSubjects.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground text-sm font-semibold">
                        {m.coefficient}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingFacultativeId(m.id); setFacultativeName(m.name); setFacultativeCoef(String(m.coefficient));
                          setIsFacultativeDialogOpen(true);
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                          disabled={deletingFacultativeId === m.id}
                          onClick={() => handleDeleteFacultative(m.id)}
                        >
                          {deletingFacultativeId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!isBaseTab && (
        <Card className="bg-muted/20 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Aperçu facultatives pour {activeNiveau} (base + ajouts fusionnés)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mergedFacultativeSubjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune matière facultative pour ce niveau.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {mergedFacultativeSubjects.map(m => (
                  <Badge key={m.id} variant="secondary" className="gap-1.5">
                    {m.name} <span className="text-muted-foreground">coef {m.coefficient}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Créneaux au choix ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-amber-600" />
              Créneaux au choix
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Ex: "LV1" (coef 4) et "LV2" (coef 2), tous deux avec le pool Anglais/Arabe/Espagnol —
              chaque élève choisira sa matière pour chaque créneau depuis son portail.
            </p>
          </div>
          <Dialog open={isGroupDialogOpen} onOpenChange={(open) => { if (!open) resetGroupForm(); setIsGroupDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0"><Plus className="h-3.5 w-3.5" />Créneau</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingGroupId ? 'Modifier' : 'Nouveau'} créneau au choix</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nom du créneau</Label>
                  <Input placeholder="Ex: LV1, LV2, Option…" value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveGroup()} />
                </div>
                <div className="space-y-2">
                  <Label>Coefficient</Label>
                  <Input type="number" min="0.5" step="0.5" value={groupCoef} onChange={(e) => setGroupCoef(e.target.value)} />
                </div>
                <Button onClick={handleSaveGroup} className="w-full" disabled={savingGroup}>
                  {savingGroup && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingGroupId ? 'Modifier' : 'Créer'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-3">
          {choiceGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {isBaseTab
                ? "Aucun créneau au choix pour l'instant."
                : `Aucun ajout/redéfinition de créneau pour ${activeNiveau} — ce niveau utilise uniquement la base "Tous niveaux".`}
            </p>
          ) : (
            choiceGroups.map(group => {
              const isExpanded = expandedGroupId === group.id;
              return (
                <div key={group.id} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                    onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      <span className="font-semibold truncate">{group.label}</span>
                      <Badge variant="secondary" className="flex-shrink-0">coef {group.coefficient}</Badge>
                      <Badge variant="outline" className="flex-shrink-0 text-xs">
                        {group.options.length} option{group.options.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span
                        role="button"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroupId(group.id); setGroupLabel(group.label); setGroupCoef(String(group.coefficient));
                          setIsGroupDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </span>
                      <span
                        role="button"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-destructive/10 text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t bg-muted/10 space-y-2">
                      {group.options.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2">Aucune option — ajoutez les matières possibles pour ce créneau.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {group.options.map(opt => (
                          <Badge key={opt.id} variant="outline" className="gap-1.5 pr-1 py-1.5">
                            {opt.subjectName}
                            <button
                              className="hover:text-destructive transition-colors"
                              onClick={() => deleteFiliereChoiceOption(opt.id)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          className="h-8 text-sm"
                          placeholder="Ex: Anglais"
                          value={newOptionName}
                          onChange={(e) => setNewOptionName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddOption(group.id)}
                        />
                        <Button
                          size="sm" variant="outline" className={cn('gap-1.5 flex-shrink-0', addingOption && 'opacity-70')}
                          disabled={addingOption}
                          onClick={() => handleAddOption(group.id)}
                        >
                          <Plus className="h-3.5 w-3.5" />Ajouter
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {!isBaseTab && (
        <Card className="bg-muted/20 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Aperçu pour {activeNiveau} (base + ajouts fusionnés)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mergedChoiceGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun créneau au choix pour ce niveau.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {mergedChoiceGroups.map(g => (
                  <Badge key={g.id} variant="secondary" className="gap-1.5">
                    {g.label} <span className="text-muted-foreground">coef {g.coefficient} · {g.options.length} option{g.options.length !== 1 ? 's' : ''}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </>
      )}
    </div>
  );
};

export default FiliereEditor;
