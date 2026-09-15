import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchool, NIVEAUX_COLLEGE, NIVEAUX_ELEMENTAIRE, mergeFiliereMandatorySubjects, mergeFiliereChoiceGroups } from '@/contexts/SchoolContext';
import ElementaryClassLines from '@/components/ElementaryClassLines';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, Plus, BookOpen, Trash2, Edit, ChevronRight,
  Trophy, Users, ClipboardList, TrendingUp, Loader2, Shuffle, ListChecks, RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ClassRankingModal from '@/components/ClassRankingModal';

const NO_FILIERE = '__none__';

const ClassSubjects = () => {
  const { periodId, classId } = useParams<{ periodId: string; classId: string }>();
  const navigate = useNavigate();
  const { currentYear } = useSchoolYear();
  const {
    gradePeriods, classes, subjects, grades, students, teachers,
    addSubject, updateSubject, deleteSubject,
    filieres, filiereMandatorySubjects, filiereChoiceGroups, getClassFiliereAssignment, assignClassFiliere,
    resyncPeriodSubjects,
  } = useSchool();

  const [assigningFiliere, setAssigningFiliere] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);

  const NO_TEACHER = '__none__';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [coefficient, setCoefficient] = useState('1');
  const [teacherId, setTeacherId] = useState(NO_TEACHER);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // UUID strings — no Number() conversion needed
  const period = gradePeriods.find(p => p.id === periodId);
  const schoolClass = classes.find(c => c.id === classId);
  const classStudents = students.filter(s => s.classId === classId);
  const classSubjects = subjects.filter(
    s => s.periodId === periodId && s.classId === classId
  );

  // Grades for this period's subjects
  const periodSubjectIds = new Set(classSubjects.map(s => s.id));
  const periodGrades = grades.filter(g => periodSubjectIds.has(g.subjectId));

  // Le collège (6e-3e) n'a pas de notion de filière — ses matières viennent
  // automatiquement du niveau (voir ClassManagement / niveau_default_subjects).
  const isCollegeClass = !!schoolClass?.niveau && (NIVEAUX_COLLEGE as readonly string[]).includes(schoolClass.niveau);
  // L'élémentaire (CI-CM2) a son propre système de notation (barème de points,
  // pas de coefficients) — voir ElementaryClassLines.tsx.
  const isElementaryClass = !!schoolClass?.niveau && (NIVEAUX_ELEMENTAIRE as readonly string[]).includes(schoolClass.niveau);
  const programmeMode: 'college' | 'lycee' | 'elementaire' =
    isElementaryClass ? 'elementaire' : isCollegeClass ? 'college' : 'lycee';

  // Filière assignée à cette classe pour l'année de cette période (optionnel)
  const assignment = classId && currentYear ? getClassFiliereAssignment(classId, currentYear.id) : undefined;
  const assignedFiliere = assignment ? filieres.find(f => f.id === assignment.filiereId) : undefined;
  const hasChoiceGroups = assignedFiliere && schoolClass?.niveau
    ? mergeFiliereChoiceGroups(filiereChoiceGroups, assignedFiliere.id, schoolClass.niveau).length > 0
    : false;
  // Ne proposer que les filières explicitement déclarées pour le niveau de
  // cette classe (si la classe n'a pas de niveau défini, on ne peut pas
  // filtrer — tout afficher) et déjà configurées avec du contenu pour ce niveau.
  const selectableFilieres = schoolClass?.niveau
    ? filieres.filter(f =>
        f.niveaux.includes(schoolClass.niveau) && (
          mergeFiliereMandatorySubjects(filiereMandatorySubjects, f.id, schoolClass.niveau).length > 0 ||
          mergeFiliereChoiceGroups(filiereChoiceGroups, f.id, schoolClass.niveau).length > 0
        )
      )
    : filieres;

  const handleFiliereChange = async (value: string) => {
    if (!classId || !currentYear || value === NO_FILIERE) return;
    setAssigningFiliere(true);
    try {
      await assignClassFiliere(classId, currentYear.id, value);
      toast({ title: 'Cursus assigné', description: 'Les matières obligatoires ont été ajoutées automatiquement.' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setAssigningFiliere(false);
    }
  };

  // Rattrape les matières ajoutées au programme/cursus après la matérialisation
  // initiale — n'ajoute que ce qui manque, ne touche jamais aux matières (et
  // notes) déjà présentes.
  const handleResync = async () => {
    if (!classId || !periodId) return;
    setIsResyncing(true);
    try {
      const added = await resyncPeriodSubjects(classId, periodId, programmeMode);
      toast({
        title: added > 0 ? 'Synchronisé' : 'Déjà à jour',
        description: added > 0
          ? `${added} matière${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''} depuis le programme/cursus.`
          : 'Aucune nouvelle matière trouvée dans le programme/cursus.',
      });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsResyncing(false);
    }
  };

  // Stats globales
  const stats = useMemo(() => {
    const totalStudents = classStudents.length;
    const subjectsWithAnyNote = classSubjects.filter(subj =>
      periodGrades.some(g =>
        g.subjectId === subj.id &&
        (g.devoir1 !== undefined || g.composition !== undefined || g.note !== undefined)
      )
    ).length;
    const completion = classSubjects.length > 0
      ? Math.round((subjectsWithAnyNote / classSubjects.length) * 100)
      : 0;
    return { totalStudents, subjectsWithAnyNote, completion };
  }, [classStudents, classSubjects, periodGrades]);

  // Completion par matière
  const subjectCompletion = useMemo(() => {
    return classSubjects.reduce((acc, subj) => {
      const studentsWithNotes = classStudents.filter(student => {
        const g = periodGrades.find(g =>
          g.studentEnrollmentId === student.id && g.subjectId === subj.id
        );
        return g && (g.devoir1 !== undefined || g.composition !== undefined || g.note !== undefined);
      }).length;
      acc[subj.id] = {
        count: studentsWithNotes,
        total: classStudents.length,
        pct: classStudents.length > 0 ? Math.round((studentsWithNotes / classStudents.length) * 100) : 0,
      };
      return acc;
    }, {} as Record<string, { count: number; total: number; pct: number }>);
  }, [classSubjects, classStudents, periodGrades]);

  if (!period || !schoolClass) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Période ou classe non trouvée</p>
        <Button variant="link" onClick={() => navigate('/notes')}>Retour à la gestion des notes</Button>
      </div>
    );
  }

  // L'élémentaire a un système de notation entièrement différent (barème de
  // points, pas de coefficients) — page dédiée plutôt que de faire cohabiter
  // les deux modèles dans le même tableau/dialogue.
  if (programmeMode === 'elementaire') {
    return (
      <ElementaryClassLines
        classId={classId!}
        periodId={periodId!}
        schoolClass={schoolClass}
        period={period}
        onBack={() => navigate('/notes')}
      />
    );
  }

  const handleSaveSubject = async () => {
    if (!subjectName.trim()) {
      toast({ title: 'Erreur', description: 'Le nom de la matière est requis', variant: 'destructive' });
      return;
    }
    const coef = parseFloat(coefficient);
    if (isNaN(coef) || coef <= 0) {
      toast({ title: 'Erreur', description: 'Le coefficient doit être un nombre positif', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const resolvedTeacherId = teacherId === NO_TEACHER ? null : teacherId;
      if (editingSubjectId) {
        await updateSubject(editingSubjectId, { name: subjectName, coefficient: coef, teacherId: resolvedTeacherId });
        toast({ title: 'Succès', description: 'Matière modifiée' });
      } else {
        await addSubject({ name: subjectName, coefficient: coef, classId: classId!, periodId: periodId!, teacherId: resolvedTeacherId ?? undefined });
        toast({ title: 'Succès', description: 'Matière ajoutée' });
      }
      resetForm();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSubjectName(''); setCoefficient('1'); setTeacherId(NO_TEACHER);
    setEditingSubjectId(null); setIsDialogOpen(false);
  };

  const handleEdit = (subject: typeof subjects[0]) => {
    setEditingSubjectId(subject.id);
    setSubjectName(subject.name);
    setCoefficient(subject.coefficient.toString());
    setTeacherId(subject.teacherId ?? NO_TEACHER);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteSubject(id);
      toast({ title: 'Succès', description: 'Matière supprimée' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/notes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
            <button onClick={() => navigate('/notes')} className="hover:text-foreground transition-colors">
              Notes
            </button>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium text-foreground">{period.name}</span>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium text-foreground">{schoolClass.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground truncate">Matières</h1>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {(isCollegeClass || assignedFiliere) && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleResync}
              disabled={isResyncing}
              title="Ajoute les matières récemment ajoutées au programme/cursus, sans toucher aux notes déjà saisies"
            >
              {isResyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Resynchroniser
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsRankingOpen(true)}
            disabled={classSubjects.length === 0 || classStudents.length === 0}
          >
            <Trophy className="h-4 w-4" />
            Classement
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Ajouter Matière</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSubjectId ? 'Modifier' : 'Ajouter'} une Matière</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Nom de la matière</Label>
                  <Input
                    placeholder="Ex: Mathématiques"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveSubject()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Coefficient</Label>
                  <Input
                    type="number" min="0.5" step="0.5" placeholder="Ex: 2"
                    value={coefficient}
                    onChange={(e) => setCoefficient(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Professeur (optionnel)</Label>
                  <Select value={teacherId} onValueChange={setTeacherId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Non assigné" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TEACHER}>Non assigné</SelectItem>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Le prof assigné pourra saisir les notes de cette matière, pour cette classe, depuis son portail.
                  </p>
                </div>
                <Button onClick={handleSaveSubject} className="w-full" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingSubjectId ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalStudents}</p>
              <p className="text-xs text-muted-foreground">Élèves dans la classe</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{classSubjects.length}</p>
              <p className="text-xs text-muted-foreground">
                Matière{classSubjects.length !== 1 ? 's' : ''} configurée{classSubjects.length !== 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completion}%</p>
              <p className="text-xs text-muted-foreground">
                Saisie des notes ({stats.subjectsWithAnyNote}/{classSubjects.length} matières)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cursus (pas pour le collège, qui n'a pas de série/choix). Une fois
          assigné, le cursus n'est PLUS modifiable depuis cet écran — changer
          de série après coup casserait les choix déjà résolus par les élèves
          et pourrait invalider les notes déjà saisies. Seule l'assignation
          INITIALE (aucun cursus encore choisi) reste possible ici. */}
      {!isCollegeClass && (
      <Card>
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium flex-shrink-0">
            <Shuffle className="h-4 w-4 text-primary" />
            Cursus
          </div>
          {assignedFiliere ? (
            <>
              <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">{assignedFiliere.name}</Badge>
              <p className="text-xs text-muted-foreground">
                Non modifiable ici une fois assigné (choix des élèves et notes déjà en jeu).
              </p>
            </>
          ) : (
            <>
              <Select
                value={NO_FILIERE}
                onValueChange={handleFiliereChange}
                disabled={assigningFiliere || selectableFilieres.length === 0}
              >
                <SelectTrigger className="w-56 h-8 text-sm">
                  <SelectValue placeholder="Aucun (liste simple)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FILIERE} disabled>Aucun (liste simple)</SelectItem>
                  {selectableFilieres.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assigningFiliere && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {selectableFilieres.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {schoolClass?.niveau
                    ? `Aucun cursus configuré pour le niveau ${schoolClass.niveau} — `
                    : 'Aucun cursus créé — '}
                  <button className="underline hover:text-foreground" onClick={() => navigate('/filieres')}>en créer un</button>
                </p>
              )}
            </>
          )}
          {assignedFiliere && hasChoiceGroups && (
            <Button
              variant="outline" size="sm" className="gap-1.5 ml-auto"
              onClick={() => navigate(`/notes/${periodId}/${classId}/filiere-choices`)}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Voir les choix des élèves
            </Button>
          )}
        </CardContent>
      </Card>
      )}

      {/* Subjects table */}
      {classSubjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucune matière ajoutée</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Ajoutez des matières pour commencer la saisie des notes
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {classSubjects.length} matière{classSubjects.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matière</TableHead>
                  <TableHead className="text-center w-24">Coefficient</TableHead>
                  <TableHead className="text-center w-36">Saisie notes</TableHead>
                  <TableHead className="text-right w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classSubjects.map((subject) => {
                  const comp = subjectCompletion[subject.id];
                  const isComplete = comp && comp.pct === 100;
                  const hasStarted = comp && comp.count > 0;
                  const isDeleting = deletingId === subject.id;
                  const assignedTeacher = teachers.find(t => t.id === subject.teacherId);
                  return (
                    <TableRow key={subject.id} className="group">
                      <TableCell className="font-medium">
                        {subject.name}
                        <div className="text-xs text-muted-foreground font-normal mt-0.5">
                          {assignedTeacher ? `${assignedTeacher.firstName} ${assignedTeacher.lastName}` : 'Aucun prof assigné'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                          {subject.coefficient}
                        </span>
                      </TableCell>
                      <TableCell>
                        {stats.totalStudents === 0 ? (
                          <span className="text-xs text-muted-foreground">Aucun élève</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-primary'}`}
                                style={{ width: `${comp?.pct || 0}%` }}
                              />
                            </div>
                            <Badge
                              variant={isComplete ? 'default' : hasStarted ? 'secondary' : 'outline'}
                              className={`text-xs flex-shrink-0 ${isComplete ? 'bg-green-500 hover:bg-green-500' : ''}`}
                            >
                              {comp?.count || 0}/{comp?.total || 0}
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline" size="sm"
                            onClick={() => navigate(`/notes/${periodId}/${classId}/${subject.id}`)}
                          >
                            Saisir Notes
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(subject)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="text-destructive hover:text-destructive"
                            disabled={isDeleting}
                            onClick={() => handleDelete(subject.id)}
                          >
                            {isDeleting
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ClassRankingModal
        open={isRankingOpen}
        onOpenChange={setIsRankingOpen}
        periodId={periodId!}
        classId={classId!}
      />
    </div>
  );
};

export default ClassSubjects;
