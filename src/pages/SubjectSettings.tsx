import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronRight, ClipboardList, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// ─── Paramètres d'une matière ───────────────────────────────────────────────
// Ne gère plus que l'activation des devoirs — les réglages par élève (actif,
// coefficient personnalisé) vivent désormais dans le "Profil académique" de
// chaque élève (Gestion Élèves), seul point d'écriture pour éviter qu'un
// réglage manuel n'écrase silencieusement un choix résolu automatiquement.

const SubjectSettings = () => {
  const { periodId, classId, subjectId } = useParams<{ periodId: string; classId: string; subjectId: string }>();
  const navigate = useNavigate();
  const {
    gradePeriods,
    classes,
    subjects,
    students,
    subjectSettings,
    updateSubjectSettings,
    getSubjectSettings,
  } = useSchool();

  const period    = gradePeriods.find(p => p.id === periodId);
  const schoolClass = classes.find(c => c.id === classId);
  const subject   = subjects.find(s => s.id === subjectId);
  const classStudents = students.filter(s => s.classId === classId);
  // Un examen interne n'a qu'une seule note par matière (grades.note) — pas de
  // devoirs ni de composition à configurer, contrairement à un semestre/trimestre.
  const isExam = period?.type === 'exam';

  const existingSettings = getSubjectSettings(subjectId!);

  const [devoir1Active, setDevoir1Active] = useState(existingSettings?.devoir1Active ?? true);
  const [devoir2Active, setDevoir2Active] = useState(existingSettings?.devoir2Active ?? true);
  const [devoir3Active, setDevoir3Active] = useState(existingSettings?.devoir3Active ?? true);
  const [devoir4Active, setDevoir4Active] = useState(existingSettings?.devoir4Active ?? false);
  const [devoir5Active, setDevoir5Active] = useState(existingSettings?.devoir5Active ?? false);

  useEffect(() => {
    if (existingSettings) {
      setDevoir1Active(existingSettings.devoir1Active);
      setDevoir2Active(existingSettings.devoir2Active);
      setDevoir3Active(existingSettings.devoir3Active);
      setDevoir4Active(existingSettings.devoir4Active);
      setDevoir5Active(existingSettings.devoir5Active);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, subjectSettings.length]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const autoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateSubjectSettings(subjectId!, {
          devoir1Active, devoir2Active, devoir3Active, devoir4Active, devoir5Active,
        });
      } catch {
        toast({ title: 'Erreur de sauvegarde', variant: 'destructive' });
      }
    }, 500);
  }, [devoir1Active, devoir2Active, devoir3Active, devoir4Active, devoir5Active, subjectId, updateSubjectSettings]);

  useEffect(() => {
    if (isExam) return; // rien à sauvegarder — pas de devoirs pour un examen
    autoSave();
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [autoSave, isExam]);

  if (!period || !schoolClass || !subject) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Données non trouvées</p>
        <Button variant="link" onClick={() => navigate('/notes')}>
          Retour à la gestion des notes
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/notes/${periodId}/${classId}/${subjectId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>{period.name}</span>
            <ChevronRight className="h-4 w-4" />
            <span>{schoolClass.name}</span>
            <ChevronRight className="h-4 w-4" />
            <span>{subject.name}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Paramètres de la Matière</h1>
        </div>
      </div>

      {isExam ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Examen
            </CardTitle>
            <CardDescription>
              Un examen interne n'a qu'une seule note par matière — pas de devoirs, pas de composition,
              rien à configurer ici.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Configuration des Devoirs
            </CardTitle>
            <CardDescription>
              Activez ou désactivez les devoirs pour cette matière. La composition est toujours active.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className={`flex items-center justify-between p-4 rounded-lg border bg-card ${devoir2Active ? 'opacity-70' : ''}`}>
                <div className="space-y-1">
                  <Label className="text-base font-medium">Devoir 1</Label>
                  <p className="text-sm text-muted-foreground">
                    {devoir2Active ? 'Désactivez D2 d\'abord' : 'Première évaluation'}
                  </p>
                </div>
                <Switch checked={devoir1Active} onCheckedChange={setDevoir1Active} disabled={devoir2Active} />
              </div>

              <div className={`flex items-center justify-between p-4 rounded-lg border bg-card ${devoir3Active ? 'opacity-70' : ''}`}>
                <div className="space-y-1">
                  <Label className="text-base font-medium">Devoir 2</Label>
                  <p className="text-sm text-muted-foreground">
                    {devoir3Active ? 'Désactivez D3 d\'abord' : 'Deuxième évaluation'}
                  </p>
                </div>
                <Switch checked={devoir2Active} onCheckedChange={setDevoir2Active} disabled={devoir3Active} />
              </div>

              <div className={`flex items-center justify-between p-4 rounded-lg border bg-card ${devoir4Active ? 'opacity-70' : ''}`}>
                <div className="space-y-1">
                  <Label className="text-base font-medium">Devoir 3</Label>
                  <p className="text-sm text-muted-foreground">
                    {devoir4Active ? 'Désactivez D4 d\'abord' : 'Troisième évaluation'}
                  </p>
                </div>
                <Switch checked={devoir3Active} onCheckedChange={setDevoir3Active} disabled={devoir4Active} />
              </div>

              <div className={`flex items-center justify-between p-4 rounded-lg border bg-accent/30 ${devoir5Active ? 'opacity-70' : ''}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Devoir 4</Label>
                    <Badge variant="secondary" className="text-xs">Optionnel</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {devoir5Active ? 'Désactivez D5 d\'abord' : 'Évaluation supplémentaire'}
                  </p>
                </div>
                <Switch checked={devoir4Active} onCheckedChange={setDevoir4Active} disabled={devoir5Active} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-accent/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Devoir 5</Label>
                    <Badge variant="secondary" className="text-xs">Optionnel</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Évaluation supplémentaire</p>
                </div>
                <Switch checked={devoir5Active} onCheckedChange={setDevoir5Active} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-primary/10 border-primary/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Composition</Label>
                    <Badge className="text-xs bg-primary text-primary-foreground">Obligatoire</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Toujours actif</p>
                </div>
                <Switch checked={true} disabled className="opacity-50" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed bg-muted/20">
        <CardContent className="py-4 flex items-center gap-3 text-sm text-muted-foreground">
          <Users className="h-4 w-4 flex-shrink-0" />
          <p>
            Pour activer/désactiver cette matière pour un élève précis ou ajuster son coefficient,
            ouvrez le <strong>profil académique</strong> de l'élève depuis Gestion Élèves — {classStudents.length} élève{classStudents.length !== 1 ? 's' : ''} dans cette classe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubjectSettings;
