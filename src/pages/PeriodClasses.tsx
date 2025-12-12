import { useParams, useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Users, BookOpen } from 'lucide-react';

const PeriodClasses = () => {
  const { periodId } = useParams();
  const navigate = useNavigate();
  const { gradePeriods, classes, periodClasses, togglePeriodClass, getStudentCountByClass } = useSchool();

  const period = gradePeriods.find(p => p.id === Number(periodId));

  if (!period) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Période non trouvée</p>
        <Button variant="link" onClick={() => navigate('/notes')}>
          Retour à la gestion des notes
        </Button>
      </div>
    );
  }

  const isClassActive = (classId: number) => {
    const pc = periodClasses.find(pc => pc.periodId === period.id && pc.classId === classId);
    return pc ? pc.isActive : true; // Default to active
  };

  const handleToggle = (classId: number) => {
    togglePeriodClass(period.id, classId);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/notes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{period.name}</h1>
          <p className="text-muted-foreground">
            {period.type === 'semester' ? 'Semestre' : 'Examen Interne'} - Sélectionnez les classes
          </p>
        </div>
      </div>

      {classes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">Aucune classe créée</p>
            <Button variant="link" onClick={() => navigate('/classes')}>
              Créer une classe
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => {
            const active = isClassActive(cls.id);
            const studentCount = getStudentCountByClass(cls.id);
            
            return (
              <Card
                key={cls.id}
                className={`transition-all ${active ? 'hover:shadow-lg hover:border-primary/50' : 'opacity-60'}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-lg ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {active ? 'Actif' : 'Inactif'}
                      </span>
                      <Switch
                        checked={active}
                        onCheckedChange={() => handleToggle(cls.id)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-lg mb-2">{cls.name}</CardTitle>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {studentCount} élève{studentCount !== 1 ? 's' : ''}
                    </p>
                    {active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/notes/${periodId}/${cls.id}`)}
                      >
                        Gérer les matières
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PeriodClasses;
