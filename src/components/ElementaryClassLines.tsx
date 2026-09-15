import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchool, SchoolClass, GradePeriod, ElementaryClassLine } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ChevronRight, Plus, Trash2, Pencil, Loader2, RefreshCw, Users, ClipboardList, TrendingUp, Trophy, UserCog, BookOpen } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  ElementaryDomaine, ElementaryRegistre, DOMAINE_LABELS, REGISTRE_LABELS,
  ETAPE_TOTALS, etapeForNiveau, ELEMENTARY_OPTIONAL_CATALOG,
} from '@/lib/elementaryDefaults';
import ElementaryRankingModal from '@/components/ElementaryRankingModal';

interface ElementaryClassLinesProps {
  classId: string;
  periodId: string;
  schoolClass: SchoolClass;
  period: GradePeriod;
  onBack: () => void;
}

const emptyForm = { domaine: 'LC' as ElementaryDomaine, registre: 'COMPETENCE' as ElementaryRegistre, name: '', pointMax: '' };

const ElementaryClassLines = ({ classId, periodId, schoolClass, period, onBack }: ElementaryClassLinesProps) => {
  const navigate = useNavigate();
  const {
    elementaryClassLines, elementaryGrades, elementaryLineSettings, students, teachers,
    addElementaryClassLine, updateElementaryClassLine, deleteElementaryClassLine,
    resyncPeriodSubjects,
  } = useSchool();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [bulkTeacherId, setBulkTeacherId] = useState<string>('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  const NO_TEACHER = '__none__';

  const classStudents = useMemo(() => students.filter(s => s.classId === classId), [students, classId]);

  const lines = useMemo(
    () => elementaryClassLines
      .filter(l => l.classId === classId && l.periodId === periodId)
      .sort((a, b) => (a.registre === b.registre ? a.ordering - b.ordering : a.registre === 'COMPETENCE' ? -1 : 1)),
    [elementaryClassLines, classId, periodId]
  );
  const etape = schoolClass.niveau ? etapeForNiveau(schoolClass.niveau) : undefined;
  const totals = etape ? ETAPE_TOTALS[etape] : undefined;
  const pointsSum = lines.reduce((s, l) => s + l.pointMax, 0);
  const expectedTotal = totals?.total;

  const teacherName = (id?: string) => {
    if (!id) return null;
    const t = teachers.find(t => t.id === id);
    return t ? `${t.firstName} ${t.lastName}` : null;
  };

  // Complétion par discipline — miroir exact de subjectCompletion côté collège
  // (nombre d'élèves ayant une note saisie sur cette discipline / total élèves).
  // Un élève dispensé de la discipline n'est pas attendu : il sort du
  // dénominateur, sinon la discipline resterait bloquée à 24/25 pour toujours.
  const lineCompletion = useMemo(() => {
    return lines.reduce((acc, line) => {
      const expected = classStudents.filter(student =>
        !elementaryLineSettings.some(s => s.lineId === line.id && s.studentEnrollmentId === student.id && !s.active)
      );
      const count = expected.filter(student =>
        elementaryGrades.some(g => g.studentEnrollmentId === student.id && g.lineId === line.id && g.pointsObtenus !== undefined)
      ).length;
      const total = expected.length;
      acc[line.id] = { count, total, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
      return acc;
    }, {} as Record<string, { count: number; total: number; pct: number }>);
  }, [lines, classStudents, elementaryGrades, elementaryLineSettings]);

  const stats = useMemo(() => {
    const linesWithAnyNote = lines.filter(l => (lineCompletion[l.id]?.count ?? 0) > 0).length;
    return {
      totalStudents: classStudents.length,
      completion: lines.length > 0 ? Math.round((linesWithAnyNote / lines.length) * 100) : 0,
    };
  }, [lines, classStudents, lineCompletion]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setIsDialogOpen(true); };
  const openEdit = (line: ElementaryClassLine) => {
    setEditingId(line.id);
    setForm({ domaine: line.domaine, registre: line.registre, name: line.name, pointMax: String(line.pointMax) });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erreur', description: 'Le nom de la discipline est requis', variant: 'destructive' });
      return;
    }
    const pointMax = parseFloat(form.pointMax);
    if (isNaN(pointMax) || pointMax <= 0) {
      toast({ title: 'Erreur', description: 'Le barème doit être un nombre positif', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await updateElementaryClassLine(editingId, { name: form.name.trim(), pointMax });
        toast({ title: 'Succès', description: 'Discipline modifiée' });
      } else {
        await addElementaryClassLine({ classId, periodId, domaine: form.domaine, registre: form.registre, name: form.name.trim(), pointMax });
        toast({ title: 'Succès', description: 'Discipline ajoutée' });
      }
      setIsDialogOpen(false);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteElementaryClassLine(id);
      toast({ title: 'Succès', description: 'Discipline supprimée' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleResync = async () => {
    setIsResyncing(true);
    try {
      const added = await resyncPeriodSubjects(classId, periodId, 'elementaire');
      toast({
        title: added > 0 ? 'Synchronisé' : 'Déjà à jour',
        description: added > 0
          ? `${added} discipline${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''} depuis le barème.`
          : 'Aucune nouvelle discipline trouvée dans le barème.',
      });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsResyncing(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkTeacherId || lines.length === 0) return;
    setIsBulkAssigning(true);
    try {
      const teacherId = bulkTeacherId === NO_TEACHER ? null : bulkTeacherId;
      await Promise.all(lines.map(l => updateElementaryClassLine(l.id, { teacherId })));
      toast({ title: 'Succès', description: `Professeur assigné à ${lines.length} discipline(s).` });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header — même structure que la page Matières du collège/lycée */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
            <button onClick={onBack} className="hover:text-foreground transition-colors">Notes</button>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium text-foreground">{period.name}</span>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium text-foreground">{schoolClass.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground truncate">Barème</h1>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" className="gap-2" onClick={handleResync} disabled={isResyncing}
            title="Ajoute les disciplines récemment ajoutées au barème, sans toucher aux notes déjà saisies">
            {isResyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Resynchroniser
          </Button>
          <Button
            variant="outline" className="gap-2"
            onClick={() => setIsRankingOpen(true)}
            disabled={lines.length === 0 || classStudents.length === 0}
          >
            <Trophy className="h-4 w-4" />
            Classement
          </Button>
          <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />Ajouter une discipline</Button>
        </div>
      </div>

      {/* Stats dashboard — même gabarit que la page Matières */}
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
              <p className="text-2xl font-bold">{lines.length}</p>
              <p className="text-xs text-muted-foreground">
                Discipline{lines.length !== 1 ? 's' : ''} configurée{lines.length !== 1 ? 's' : ''}
                {expectedTotal !== undefined && (
                  <span className={pointsSum !== expectedTotal ? 'text-destructive font-medium' : ''}> · {pointsSum}/{expectedTotal} pts</span>
                )}
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
              <p className="text-xs text-muted-foreground">Saisie des notes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Professeur de la classe — même emplacement/gabarit que la carte "Cursus" du collège/lycée */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium flex-shrink-0">
            <UserCog className="h-4 w-4 text-primary" />
            Professeur de la classe
          </div>
          <Select value={bulkTeacherId} onValueChange={setBulkTeacherId} disabled={lines.length === 0}>
            <SelectTrigger className="w-56 h-8 text-sm"><SelectValue placeholder="Choisir un professeur" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_TEACHER}>Aucun</SelectItem>
              {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleBulkAssign} disabled={!bulkTeacherId || isBulkAssigning}>
            {isBulkAssigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Appliquer à toute la classe'}
          </Button>
          <p className="text-xs text-muted-foreground ml-auto">
            Chaque discipline reste modifiable individuellement (ex: un autre prof pour l'arabe)
          </p>
        </CardContent>
      </Card>

      {/* Tableau des disciplines — un seul tableau plat, même gabarit que la table Matières */}
      {lines.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14">
            <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucune discipline ajoutée</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Ajoutez des disciplines pour commencer la saisie des notes
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {lines.length} discipline{lines.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discipline</TableHead>
                  <TableHead className="w-28">Registre</TableHead>
                  <TableHead className="text-center w-24">Barème</TableHead>
                  <TableHead className="text-center w-36">Saisie notes</TableHead>
                  <TableHead className="text-right w-44">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const comp = lineCompletion[line.id];
                  const isComplete = comp && comp.pct === 100;
                  const hasStarted = comp && comp.count > 0;
                  const isDeleting = deletingId === line.id;
                  const assignedTeacher = teacherName(line.teacherId);
                  return (
                    <TableRow key={line.id} className="group">
                      <TableCell className="font-medium">
                        {line.name}
                        <div className="text-xs text-muted-foreground font-normal mt-0.5">
                          {DOMAINE_LABELS[line.domaine]} · {assignedTeacher ?? 'Aucun prof assigné'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">{REGISTRE_LABELS[line.registre]}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center min-w-8 h-8 px-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                          {line.pointMax}
                        </span>
                      </TableCell>
                      <TableCell>
                        {classStudents.length === 0 ? (
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
                            onClick={() => navigate(`/notes/${periodId}/${classId}/elementaire/${line.id}`)}
                          >
                            Saisir Notes
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(line)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(line.id)} disabled={isDeleting}
                          >
                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier' : 'Ajouter'} une discipline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nom de la discipline</Label>
              <Input
                placeholder="Ex: Lecture — Compréhension / Fluidité"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                list="elementary-optional-catalog"
              />
              <datalist id="elementary-optional-catalog">
                {ELEMENTARY_OPTIONAL_CATALOG
                  .filter(c => c.niveau === schoolClass.niveau)
                  .map(c => <option key={c.name} value={c.name} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Domaine</Label>
                <Select value={form.domaine} onValueChange={v => setForm(f => ({ ...f, domaine: v as ElementaryDomaine }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DOMAINE_LABELS) as ElementaryDomaine[]).map(d => (
                      <SelectItem key={d} value={d}>{DOMAINE_LABELS[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Registre</Label>
                <Select value={form.registre} onValueChange={v => setForm(f => ({ ...f, registre: v as ElementaryRegistre }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REGISTRE_LABELS) as ElementaryRegistre[]).map(r => (
                      <SelectItem key={r} value={r}>{REGISTRE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Barème (points)</Label>
              <Input
                type="number" min="1" placeholder="Ex: 20"
                value={form.pointMax}
                onChange={e => setForm(f => ({ ...f, pointMax: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Enregistrer les modifications' : 'Ajouter la discipline'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ElementaryRankingModal open={isRankingOpen} onOpenChange={setIsRankingOpen} periodId={periodId} classId={classId} />
    </div>
  );
};

export default ElementaryClassLines;
