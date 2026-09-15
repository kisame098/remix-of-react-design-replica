import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Plus, GraduationCap, FileText, Trash2, Users,
  BookOpen, ChevronRight, ClipboardList, Loader2, Pencil, Settings2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { GradePeriod } from '@/contexts/SchoolContext';
import { NIVEAUX_ELEMENTAIRE } from '@/lib/elementaryDefaults';

const formatShortDate = (iso?: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const GradeManagement = () => {
  const navigate = useNavigate();
  const {
    gradePeriods, addGradePeriod, updateGradePeriod, deleteGradePeriod,
    isClassInPeriod, setClassInPeriod,
    classes, subjects, grades, getStudentCountByClass,
    elementaryClassLines, elementaryGrades,
    gradesLoading,
  } = useSchool();

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(
    gradePeriods.length > 0 ? gradePeriods[0].id : null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [periodType, setPeriodType] = useState<'semester' | 'exam'>('semester');
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isEditPeriodOpen, setIsEditPeriodOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [isSavingPeriod, setIsSavingPeriod] = useState(false);
  const [isManageClassesOpen, setIsManageClassesOpen] = useState(false);
  const [togglingClassId, setTogglingClassId] = useState<string | null>(null);

  const semesters = gradePeriods.filter(p => p.type === 'semester');
  const exams = gradePeriods.filter(p => p.type === 'exam');
  const selectedPeriod = gradePeriods.find(p => p.id === selectedPeriodId);
  const includedClasses = selectedPeriodId
    ? classes.filter(c => isClassInPeriod(selectedPeriodId, c.id))
    : [];

  // Stats par classe pour la période sélectionnée — l'élémentaire (CI-CM2) a
  // ses propres disciplines à barème (table elementary_class_lines), pas des
  // matières à coefficient ; la complétion se base sur la proportion de
  // disciplines ayant au moins une note saisie (miroir de la logique matière
  // du collège/lycée).
  const classStats = useMemo(() => {
    if (!selectedPeriodId) return {} as Record<string, { subjectCount: number; studentCount: number; completion: number }>;
    return classes.reduce((acc, cls) => {
      const isElementary = !!cls.niveau && (NIVEAUX_ELEMENTAIRE as readonly string[]).includes(cls.niveau);
      const studentCount = getStudentCountByClass(cls.id);
      if (isElementary) {
        const clsLines = elementaryClassLines.filter(l => l.periodId === selectedPeriodId && l.classId === cls.id);
        const linesWithNotes = clsLines.filter(line =>
          elementaryGrades.some(g => g.lineId === line.id && g.pointsObtenus !== undefined)
        ).length;
        acc[cls.id] = {
          subjectCount: clsLines.length,
          studentCount,
          completion: clsLines.length > 0 ? Math.round((linesWithNotes / clsLines.length) * 100) : 0,
        };
        return acc;
      }
      const clsSubjects = subjects.filter(s => s.periodId === selectedPeriodId && s.classId === cls.id);
      const subjectsWithNotes = clsSubjects.filter(subj =>
        grades.some(g => g.subjectId === subj.id)
      ).length;
      acc[cls.id] = {
        subjectCount: clsSubjects.length,
        studentCount,
        completion: clsSubjects.length > 0 ? Math.round((subjectsWithNotes / clsSubjects.length) * 100) : 0,
      };
      return acc;
    }, {} as Record<string, { subjectCount: number; studentCount: number; completion: number }>);
  }, [selectedPeriodId, classes, subjects, grades, elementaryClassLines, elementaryGrades, getStudentCountByClass]);

  const handleCreatePeriod = async () => {
    if (!periodName.trim()) {
      toast({ title: 'Erreur', description: 'Le nom de la période est requis', variant: 'destructive' });
      return;
    }
    if (periodStartDate && periodEndDate && periodEndDate < periodStartDate) {
      toast({ title: 'Erreur', description: 'La date de fin doit être après la date de début', variant: 'destructive' });
      return;
    }
    setIsCreating(true);
    try {
      const newPeriod = await addGradePeriod({
        name: periodName,
        type: periodType,
        startDate: periodStartDate || undefined,
        endDate: periodEndDate || undefined,
      });
      setSelectedPeriodId(newPeriod.id);
      setPeriodName('');
      setPeriodType('semester');
      setPeriodStartDate('');
      setPeriodEndDate('');
      setIsDialogOpen(false);
      toast({ title: 'Succès', description: 'Période créée avec succès' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePeriod = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteGradePeriod(id);
      if (selectedPeriodId === id) {
        const remaining = gradePeriods.filter(p => p.id !== id);
        setSelectedPeriodId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast({ title: 'Succès', description: 'Période supprimée' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const openEditPeriod = (period: GradePeriod) => {
    setEditName(period.name);
    setEditStartDate(period.startDate ?? '');
    setEditEndDate(period.endDate ?? '');
    setIsEditPeriodOpen(true);
  };

  const handleSavePeriod = async () => {
    if (!selectedPeriod) return;
    if (!editName.trim()) {
      toast({ title: 'Erreur', description: 'Le nom de la période est requis', variant: 'destructive' });
      return;
    }
    if (editStartDate && editEndDate && editEndDate < editStartDate) {
      toast({ title: 'Erreur', description: 'La date de fin doit être après la date de début', variant: 'destructive' });
      return;
    }
    setIsSavingPeriod(true);
    try {
      await updateGradePeriod(selectedPeriod.id, {
        name: editName.trim(),
        startDate: editStartDate || null,
        endDate: editEndDate || null,
      });
      setIsEditPeriodOpen(false);
      toast({ title: 'Succès', description: 'Période mise à jour' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingPeriod(false);
    }
  };

  const handleToggleClass = async (classId: string, included: boolean) => {
    if (!selectedPeriodId) return;
    setTogglingClassId(classId);
    try {
      await setClassInPeriod(selectedPeriodId, classId, included);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setTogglingClassId(null);
    }
  };

  const PeriodItem = ({ period }: { period: GradePeriod }) => {
    const isSelected = selectedPeriodId === period.id;
    const isSemester = period.type === 'semester';
    const isDeleting = deletingId === period.id;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelectedPeriodId(period.id)}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedPeriodId(period.id)}
        className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg transition-all group cursor-pointer ${
          isSelected
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'hover:bg-muted text-foreground'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isSemester
            ? <GraduationCap className="h-4 w-4 flex-shrink-0" />
            : <FileText className="h-4 w-4 flex-shrink-0" />}
          <span className="text-sm font-medium truncate">{period.name}</span>
        </div>
        <button
          onClick={(e) => handleDeletePeriod(period.id, e)}
          disabled={isDeleting}
          className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${
            isSelected
              ? 'hover:bg-primary-foreground/20 text-primary-foreground'
              : 'hover:bg-destructive/10 text-destructive'
          }`}
        >
          {isDeleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des Notes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sélectionnez une période puis une classe</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={gradesLoading}>
              <Plus className="h-4 w-4" />
              Nouvelle Période
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une Période</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Type de période</Label>
                <Select value={periodType} onValueChange={(v: 'semester' | 'exam') => setPeriodType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semester">Semestre / Trimestre</SelectItem>
                    <SelectItem value="exam">Examen Interne</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nom de la période</Label>
                <Input
                  placeholder={periodType === 'semester' ? 'Ex: 1er Trimestre' : 'Ex: Examen Février'}
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreatePeriod()}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date de début (optionnel)</Label>
                  <Input type="date" value={periodStartDate} onChange={(e) => setPeriodStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin (optionnel)</Label>
                  <Input type="date" value={periodEndDate} onChange={(e) => setPeriodEndDate(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Ces dates permettent de scoper les absences et retards à cette période sur les bulletins de notes.
              </p>
              <Button onClick={handleCreatePeriod} className="w-full" disabled={isCreating}>
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer la période
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Body: two-panel */}
      <div className="flex-1 min-h-0 flex">

        {/* LEFT PANEL — Periods list */}
        <div className="w-60 border-r flex-shrink-0 flex flex-col bg-muted/10">
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {gradesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : gradePeriods.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm px-4">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Aucune période</p>
                <p className="text-xs mt-1">Créez une période pour commencer</p>
              </div>
            ) : (
              <>
                {semesters.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                      Semestres / Trimestres
                    </p>
                    <div className="space-y-0.5">
                      {semesters.map(p => <PeriodItem key={p.id} period={p} />)}
                    </div>
                  </div>
                )}
                {exams.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                      Examens Internes
                    </p>
                    <div className="space-y-0.5">
                      {exams.map(p => <PeriodItem key={p.id} period={p} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Classes */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          {!selectedPeriod ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <GraduationCap className="h-14 w-14 mb-4 opacity-30" />
              <p className="font-medium">Sélectionnez une période</p>
              <p className="text-sm mt-1 opacity-70">Choisissez une période dans le panneau gauche</p>
            </div>
          ) : (
            <>
              {/* Period header */}
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${selectedPeriod.type === 'semester' ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-500'}`}>
                    {selectedPeriod.type === 'semester'
                      ? <GraduationCap className="h-5 w-5" />
                      : <FileText className="h-5 w-5" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedPeriod.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedPeriod.type === 'semester' ? 'Semestre / Trimestre' : 'Examen Interne'} — Choisissez une classe
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedPeriod.startDate || selectedPeriod.endDate
                        ? `${formatShortDate(selectedPeriod.startDate)} → ${formatShortDate(selectedPeriod.endDate)}`
                        : 'Dates non définies'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsManageClassesOpen(true)}>
                    <Settings2 className="h-3.5 w-3.5" />
                    Classes ({includedClasses.length}/{classes.length})
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditPeriod(selectedPeriod)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </Button>
                </div>
              </div>

              <Dialog open={isManageClassesOpen} onOpenChange={setIsManageClassesOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Classes concernées par "{selectedPeriod.name}"</DialogTitle>
                  </DialogHeader>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Par défaut, toutes les classes sont incluses. Utile par exemple pour un examen interne réservé à certaines classes.
                  </p>
                  <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                    {classes.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Aucune classe créée</p>
                    ) : (
                      classes.map(cls => {
                        const included = isClassInPeriod(selectedPeriod.id, cls.id);
                        return (
                          <div key={cls.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50">
                            <span className="text-sm font-medium">{cls.name}</span>
                            <Switch
                              checked={included}
                              disabled={togglingClassId === cls.id}
                              onCheckedChange={(checked) => handleToggleClass(cls.id, checked)}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isEditPeriodOpen} onOpenChange={setIsEditPeriodOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modifier la période</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Nom de la période</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSavePeriod()}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Date de début</Label>
                        <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Date de fin</Label>
                        <Input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Les dates servent à scoper les absences et retards à cette période sur les bulletins de notes.
                    </p>
                    <Button onClick={handleSavePeriod} className="w-full" disabled={isSavingPeriod}>
                      {isSavingPeriod && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Enregistrer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {classes.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                    <Users className="h-12 w-12 mb-3 opacity-40" />
                    <p>Aucune classe disponible</p>
                    <Button variant="link" onClick={() => navigate('/classes')}>
                      Créer une classe
                    </Button>
                  </CardContent>
                </Card>
              ) : includedClasses.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                    <Settings2 className="h-12 w-12 mb-3 opacity-40" />
                    <p>Aucune classe concernée par cette période</p>
                    <Button variant="link" onClick={() => setIsManageClassesOpen(true)}>
                      Choisir les classes
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {includedClasses.map((cls) => {
                    const stats = classStats[cls.id] || { subjectCount: 0, studentCount: 0, completion: 0 };
                    const isElementary = !!cls.niveau && (NIVEAUX_ELEMENTAIRE as readonly string[]).includes(cls.niveau);
                    const subjectWord = isElementary ? 'discipline' : 'matière';
                    return (
                      <button
                        key={cls.id}
                        onClick={() => navigate(`/notes/${selectedPeriodId}/${cls.id}`)}
                        className="text-left group"
                      >
                        <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full cursor-pointer">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <BookOpen className="h-5 w-5" />
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                            </div>
                            <h3 className="font-semibold text-foreground mb-2">{cls.name}</h3>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {stats.studentCount} élève{stats.studentCount !== 1 ? 's' : ''}
                                </span>
                                <span className="flex items-center gap-1">
                                  <ClipboardList className="h-3 w-3" />
                                  {stats.subjectCount} {subjectWord}{stats.subjectCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {stats.subjectCount > 0 && (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary rounded-full transition-all"
                                      style={{ width: `${stats.completion}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground flex-shrink-0">
                                    {stats.completion}%
                                  </span>
                                </div>
                              )}
                              {stats.subjectCount === 0 && (
                                <Badge variant="outline" className="text-xs font-normal">
                                  Aucune {subjectWord}
                                </Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GradeManagement;
