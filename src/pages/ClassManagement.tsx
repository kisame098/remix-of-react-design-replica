import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, GraduationCap, Users, Trash2, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSchool, NIVEAUX, NIVEAUX_ELEMENTAIRE, SchoolClass } from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { buildProgrammeCards, programmeCardLabel, programmeCardKey, getNiveauLabels, getNiveauxSupprimes, type ProgrammeCard } from '@/lib/programmeCards';

const NO_BLOC = '__none__';

const ClassManagement = () => {
  const {
    classes, addClass, updateClass, deleteClass, getStudentCountByClass, classesLoading,
    filieres, niveauDefaultSubjects, elementaryDefaultLines, assignClassFiliere,
    applyNiveauDefaultsToClass, applyElementaryDefaultsToClass,
  } = useSchool();
  const { currentYear } = useSchoolYear();
  const { school } = useAuth();
  const { toast } = useToast();

  // Choisir directement un bloc existant dans Cursus (niveau seul pour le
  // collège/élémentaire, niveau+série pour le lycée) — plutôt que choisir un
  // niveau puis, séparément, un cursus. Ça évite qu'une classe se retrouve
  // avec un niveau qui n'a aucun bloc défini dans Cursus (donc aucune matière
  // préremplie).
  const programmeCards = buildProgrammeCards(filieres, niveauDefaultSubjects, elementaryDefaultLines, getNiveauxSupprimes(school?.settings));
  const niveauLabels = getNiveauLabels(school?.settings);

  const [isDialogOpen, setIsDialogOpen]   = useState(false);
  const [newClassName, setNewClassName]   = useState('');
  const [newClassLimit, setNewClassLimit] = useState('30');
  const [newClassCardKey, setNewClassCardKey] = useState(NO_BLOC);
  const [isSaving, setIsSaving]           = useState(false);
  const [deletingId, setDeletingId]       = useState<string | null>(null);

  const [editingClass, setEditingClass]   = useState<SchoolClass | null>(null);
  const [editName, setEditName]           = useState('');
  const [editLimit, setEditLimit]         = useState('30');
  const [editNiveau, setEditNiveau]       = useState(NO_BLOC);
  const [isEditSaving, setIsEditSaving]   = useState(false);

  const selectedCard: ProgrammeCard | undefined = programmeCards.find(c => programmeCardKey(c) === newClassCardKey);

  // ── Créer une classe ───────────────────────────────────────────────────────
  const handleAddClass = async () => {
    if (!newClassName.trim()) {
      toast({ title: 'Erreur', description: 'Le nom de la classe est obligatoire', variant: 'destructive' });
      return;
    }
    const limit = parseInt(newClassLimit);
    if (isNaN(limit) || limit < 1) {
      toast({ title: 'Erreur', description: 'La limite doit être un nombre positif', variant: 'destructive' });
      return;
    }
    if (classes.some(c => c.name.toLowerCase() === newClassName.trim().toLowerCase())) {
      toast({ title: 'Erreur', description: 'Une classe avec ce nom existe déjà', variant: 'destructive' });
      return;
    }
    if (!currentYear) {
      toast({ title: 'Erreur', description: 'Aucune année scolaire sélectionnée', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const niveau = selectedCard?.niveau;
      const newClass = await addClass({ name: newClassName.trim(), studentLimit: limit, niveau });
      try {
        if (selectedCard?.type === 'niveau') {
          if ((NIVEAUX_ELEMENTAIRE as readonly string[]).includes(selectedCard.niveau)) {
            await applyElementaryDefaultsToClass(newClass.id, currentYear.id);
          } else {
            await applyNiveauDefaultsToClass(newClass.id, currentYear.id);
          }
        } else if (selectedCard?.type === 'filiere') {
          await assignClassFiliere(newClass.id, currentYear.id, selectedCard.filiereId);
        }
      } catch (err) {
        toast({ title: 'Classe créée, mais...', description: `Les matières n'ont pas pu être activées automatiquement : ${String(err)}. Vous pouvez réessayer depuis Gestion Notes.`, variant: 'destructive' });
      }
      toast({
        title: 'Classe créée !',
        description: `La classe "${newClassName.trim()}" a été créée avec une limite de ${limit} élèves.`,
      });
      setNewClassName('');
      setNewClassLimit('30');
      setNewClassCardKey(NO_BLOC);
      setIsDialogOpen(false);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Modifier une classe ─────────────────────────────────────────────────────
  const openEditDialog = (cls: SchoolClass) => {
    setEditingClass(cls);
    setEditName(cls.name);
    setEditLimit(String(cls.studentLimit));
    setEditNiveau(cls.niveau ?? NO_BLOC);
  };

  const handleUpdateClass = async () => {
    if (!editingClass) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast({ title: 'Erreur', description: 'Le nom de la classe est obligatoire', variant: 'destructive' });
      return;
    }
    const limit = parseInt(editLimit);
    if (isNaN(limit) || limit < 1) {
      toast({ title: 'Erreur', description: 'La limite doit être un nombre positif', variant: 'destructive' });
      return;
    }
    if (classes.some(c => c.id !== editingClass.id && c.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast({ title: 'Erreur', description: 'Une classe avec ce nom existe déjà', variant: 'destructive' });
      return;
    }

    setIsEditSaving(true);
    try {
      const niveau = editNiveau === NO_BLOC ? undefined : editNiveau;
      await updateClass(editingClass.id, { name: trimmedName, studentLimit: limit, niveau });
      toast({ title: 'Classe modifiée', description: `La classe "${trimmedName}" a été mise à jour.` });
      setEditingClass(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsEditSaving(false);
    }
  };

  // ── Supprimer une classe ───────────────────────────────────────────────────
  const handleDeleteClass = async (classId: string, className: string) => {
    const studentCount = getStudentCountByClass(classId);
    if (studentCount > 0) {
      toast({
        title: 'Impossible de supprimer',
        description: `La classe "${className}" contient ${studentCount} élève(s). Veuillez d'abord réassigner les élèves.`,
        variant: 'destructive',
      });
      return;
    }

    setDeletingId(classId);
    try {
      await deleteClass(classId);
      toast({ title: 'Classe supprimée', description: `La classe "${className}" a été supprimée.` });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-primary';
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gestion des Classes</h1>
              <p className="text-muted-foreground">
                {currentYear
                  ? `Classes de ${currentYear.name}`
                  : "Créez et gérez les classes de l'établissement"}
              </p>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={!currentYear}>
                <Plus className="w-4 h-4" />
                Nouvelle Classe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une nouvelle classe</DialogTitle>
                <DialogDescription>
                  Définissez le nom et la capacité maximale de la classe.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="className">Nom de la classe *</Label>
                  <Input
                    id="className"
                    placeholder="Ex: 6ème A, Terminale S1…"
                    value={newClassName}
                    onChange={e => setNewClassName(e.target.value)}
                    disabled={isSaving}
                    onKeyDown={e => e.key === 'Enter' && handleAddClass()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classLimit">Limite d'élèves *</Label>
                  <Input
                    id="classLimit"
                    type="number"
                    min="1"
                    placeholder="30"
                    value={newClassLimit}
                    onChange={e => setNewClassLimit(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classBloc">Programme / Cursus (optionnel)</Label>
                  <Select value={newClassCardKey} onValueChange={setNewClassCardKey} disabled={isSaving}>
                    <SelectTrigger id="classBloc">
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_BLOC}>Aucun</SelectItem>
                      {programmeCards.map(card => (
                        <SelectItem key={programmeCardKey(card)} value={programmeCardKey(card)}>
                          {programmeCardLabel(card, niveauLabels)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {selectedCard
                      ? `Active automatiquement les matières et coefficients de ce bloc. Modifiable ensuite depuis Gestion Notes.`
                      : 'Choisissez parmi les blocs déjà définis dans Cursus — vous ne trouvez pas le vôtre ? Créez-le d\'abord dans Cursus, ou laissez "Aucun" et assignez-le plus tard depuis Gestion Notes.'}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                  Annuler
                </Button>
                <Button onClick={handleAddClass} disabled={isSaving} className="gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Créer la classe
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!editingClass} onOpenChange={(open) => !open && setEditingClass(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier la classe</DialogTitle>
                <DialogDescription>
                  Corrigez le nom, la capacité ou le niveau de la classe.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="editClassName">Nom de la classe *</Label>
                  <Input
                    id="editClassName"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    disabled={isEditSaving}
                    onKeyDown={e => e.key === 'Enter' && handleUpdateClass()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editClassLimit">Limite d'élèves *</Label>
                  <Input
                    id="editClassLimit"
                    type="number"
                    min="1"
                    value={editLimit}
                    onChange={e => setEditLimit(e.target.value)}
                    disabled={isEditSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editClassNiveau">Niveau (optionnel)</Label>
                  <Select value={editNiveau} onValueChange={setEditNiveau} disabled={isEditSaving}>
                    <SelectTrigger id="editClassNiveau">
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_BLOC}>Aucun</SelectItem>
                      {NIVEAUX.map(n => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Changer le niveau ne modifie pas les matières déjà activées pour cette classe — ajustez-les si besoin depuis Gestion Notes.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingClass(null)} disabled={isEditSaving}>
                  Annuler
                </Button>
                <Button onClick={handleUpdateClass} disabled={isEditSaving} className="gap-2">
                  {isEditSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Message si aucune année sélectionnée */}
        {!currentYear && (
          <Card className="mb-6 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="py-4 text-center text-sm text-amber-700 dark:text-amber-400">
              Veuillez sélectionner ou créer une année scolaire pour gérer les classes.
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Classes</p>
                  <p className="text-3xl font-bold text-foreground">
                    {classesLoading ? '—' : classes.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Capacité Totale</p>
                  <p className="text-3xl font-bold text-foreground">
                    {classesLoading ? '—' : classes.reduce((acc, c) => acc + c.studentLimit, 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-secondary/50 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-secondary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Places Disponibles</p>
                  <p className="text-3xl font-bold text-foreground">
                    {classesLoading
                      ? '—'
                      : classes.reduce((acc, c) => acc + (c.studentLimit - getStudentCountByClass(c.id)), 0)
                    }
                  </p>
                </div>
                <div className="w-12 h-12 bg-accent/50 rounded-full flex items-center justify-center">
                  <Plus className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Skeleton de chargement */}
        {classesLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-2 bg-muted rounded mb-3" />
                  <div className="h-2 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Grille des classes */}
        {!classesLoading && classes.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <GraduationCap className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Aucune classe créée</h3>
              <p className="text-muted-foreground mb-6">
                Commencez par créer votre première classe pour pouvoir inscrire des élèves.
              </p>
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2" disabled={!currentYear}>
                <Plus className="w-4 h-4" />
                Créer ma première classe
              </Button>
            </CardContent>
          </Card>
        )}

        {!classesLoading && classes.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {classes.map((cls, index) => {
                const studentCount = getStudentCountByClass(cls.id);
                const percentage   = cls.studentLimit > 0 ? (studentCount / cls.studentLimit) * 100 : 0;
                const isFull       = studentCount >= cls.studentLimit;
                const isDeleting   = deletingId === cls.id;

                return (
                  <motion.div
                    key={cls.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className={`relative overflow-hidden ${isFull ? 'border-destructive/50' : ''} ${isDeleting ? 'opacity-50' : ''}`}>
                      {isFull && (
                        <div className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-bl-lg font-medium">
                          COMPLET
                        </div>
                      )}
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{cls.name}</CardTitle>
                            <CardDescription>
                              Créée le {cls.createdAt.toLocaleDateString('fr-FR')}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            disabled={isDeleting}
                            onClick={() => openEditDialog(cls)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                disabled={isDeleting}
                              >
                                {isDeleting
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />
                                }
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer la classe ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Êtes-vous sûr de vouloir supprimer la classe "{cls.name}" ?
                                  {studentCount > 0 && (
                                    <span className="block mt-2 text-destructive font-medium">
                                      Attention : cette classe contient {studentCount} élève(s).
                                    </span>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteClass(cls.id, cls.name)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Élèves inscrits</span>
                            <span className="font-semibold">
                              {studentCount} / {cls.studentLimit}
                            </span>
                          </div>
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${getProgressColor(percentage)}`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{Math.round(percentage)}% occupé</span>
                            <span>{cls.studentLimit - studentCount} places restantes</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ClassManagement;
