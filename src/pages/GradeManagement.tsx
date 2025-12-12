import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, GraduationCap, FileText, Trash2, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const GradeManagement = () => {
  const navigate = useNavigate();
  const { gradePeriods, addGradePeriod, deleteGradePeriod } = useSchool();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [periodType, setPeriodType] = useState<'semester' | 'exam'>('semester');

  const handleCreatePeriod = () => {
    if (!periodName.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom de la période est requis",
        variant: "destructive"
      });
      return;
    }

    addGradePeriod({ name: periodName, type: periodType });
    setPeriodName('');
    setPeriodType('semester');
    setIsDialogOpen(false);
    toast({
      title: "Succès",
      description: "Période créée avec succès"
    });
  };

  const handleDeletePeriod = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteGradePeriod(id);
    toast({
      title: "Succès",
      description: "Période supprimée"
    });
  };

  const semesters = gradePeriods.filter(p => p.type === 'semester');
  const exams = gradePeriods.filter(p => p.type === 'exam');

  return (
    <div className="p-8 lg:p-12 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des Notes</h1>
          <p className="text-muted-foreground mt-1">Gérez les notes par semestre, examen et matière</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semester">Semestre</SelectItem>
                    <SelectItem value="exam">Examen Interne</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nom de la période</Label>
                <Input
                  placeholder={periodType === 'semester' ? "Ex: Semestre 1" : "Ex: Examen Février"}
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                />
              </div>
              <Button onClick={handleCreatePeriod} className="w-full">
                Créer la période
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Semestres */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Semestres</h2>
        </div>
        {semesters.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-center">Aucun semestre créé</p>
              <p className="text-sm text-muted-foreground/70">Créez un semestre pour commencer</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {semesters.map((period) => (
              <Card
                key={period.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group relative"
                onClick={() => navigate(`/notes/${period.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => handleDeletePeriod(period.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-lg">{period.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Créé le {period.createdAt.toLocaleDateString('fr-FR')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Examens */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-orange-500" />
          <h2 className="text-xl font-semibold">Examens Internes</h2>
        </div>
        {exams.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-center">Aucun examen interne créé</p>
              <p className="text-sm text-muted-foreground/70">Créez un examen pour évaluer vos élèves</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {exams.map((period) => (
              <Card
                key={period.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:border-orange-500/50 group relative"
                onClick={() => navigate(`/notes/${period.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="p-3 rounded-lg bg-orange-500/10 text-orange-500">
                      <FileText className="h-6 w-6" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => handleDeletePeriod(period.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-lg">{period.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Créé le {period.createdAt.toLocaleDateString('fr-FR')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default GradeManagement;
