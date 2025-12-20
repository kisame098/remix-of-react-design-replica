import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, BookOpen, Trash2, Edit, ChevronRight, Trophy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ClassRankingModal from '@/components/ClassRankingModal';

const ClassSubjects = () => {
  const { periodId, classId } = useParams();
  const navigate = useNavigate();
  const { gradePeriods, classes, subjects, addSubject, updateSubject, deleteSubject } = useSchool();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<number | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [coefficient, setCoefficient] = useState('1');

  const period = gradePeriods.find(p => p.id === Number(periodId));
  const schoolClass = classes.find(c => c.id === Number(classId));

  const classSubjects = subjects.filter(
    s => s.periodId === Number(periodId) && s.classId === Number(classId)
  );

  if (!period || !schoolClass) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Période ou classe non trouvée</p>
        <Button variant="link" onClick={() => navigate('/notes')}>
          Retour à la gestion des notes
        </Button>
      </div>
    );
  }

  const handleSaveSubject = () => {
    if (!subjectName.trim()) {
      toast({ title: "Erreur", description: "Le nom de la matière est requis", variant: "destructive" });
      return;
    }

    const coef = parseFloat(coefficient);
    if (isNaN(coef) || coef <= 0) {
      toast({ title: "Erreur", description: "Le coefficient doit être un nombre positif", variant: "destructive" });
      return;
    }

    if (editingSubject) {
      updateSubject(editingSubject, { name: subjectName, coefficient: coef });
      toast({ title: "Succès", description: "Matière modifiée" });
    } else {
      addSubject({
        name: subjectName,
        coefficient: coef,
        classId: Number(classId),
        periodId: Number(periodId)
      });
      toast({ title: "Succès", description: "Matière ajoutée" });
    }

    resetForm();
  };

  const resetForm = () => {
    setSubjectName('');
    setCoefficient('1');
    setEditingSubject(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (subject: typeof subjects[0]) => {
    setEditingSubject(subject.id);
    setSubjectName(subject.name);
    setCoefficient(subject.coefficient.toString());
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    deleteSubject(id);
    toast({ title: "Succès", description: "Matière supprimée" });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/notes/${periodId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>{period.name}</span>
            <ChevronRight className="h-4 w-4" />
            <span>{schoolClass.name}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des Matières</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setIsRankingOpen(true)}>
            <Trophy className="h-4 w-4" />
            Classement Général
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter Matière
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSubject ? 'Modifier' : 'Ajouter'} une Matière</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nom de la matière</Label>
                <Input
                  placeholder="Ex: Mathématiques"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Coefficient</Label>
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="Ex: 2"
                  value={coefficient}
                  onChange={(e) => setCoefficient(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveSubject} className="w-full">
                {editingSubject ? 'Modifier' : 'Ajouter'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      {classSubjects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">Aucune matière ajoutée</p>
            <p className="text-sm text-muted-foreground/70">Ajoutez des matières pour commencer la saisie des notes</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Matières ({classSubjects.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matière</TableHead>
                  <TableHead className="text-center">Coefficient</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classSubjects.map((subject) => (
                  <TableRow key={subject.id} className="group">
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                        {subject.coefficient}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/notes/${periodId}/${classId}/${subject.id}`)}
                        >
                          Saisir Notes
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(subject)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(subject.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ClassRankingModal
        open={isRankingOpen}
        onOpenChange={setIsRankingOpen}
        periodId={Number(periodId)}
        classId={Number(classId)}
      />
    </div>
  );
};

export default ClassSubjects;
