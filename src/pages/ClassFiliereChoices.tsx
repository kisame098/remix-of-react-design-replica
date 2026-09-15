import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchool, mergeFiliereChoiceGroups } from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ChevronRight, Loader2, Shuffle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// ─── Vue admin des choix des élèves pour une filière assignée ──────────────
// Permet de voir qui a déjà choisi quoi pour chaque créneau, et de
// corriger/forcer un choix — passe par la même RPC que le choix élève.

const ClassFiliereChoices = () => {
  const { periodId, classId } = useParams<{ periodId: string; classId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { currentYear } = useSchoolYear();
  const {
    gradePeriods, classes, students,
    filieres, filiereChoiceGroups, getClassFiliereAssignment,
    getStudentFiliereChoice, resolveFiliereChoice,
  } = useSchool();

  const [savingKey, setSavingKey] = useState<string | null>(null);

  const period = gradePeriods.find(p => p.id === periodId);
  const schoolClass = classes.find(c => c.id === classId);
  const classStudents = students.filter(s => s.classId === classId);

  const assignment = classId && currentYear ? getClassFiliereAssignment(classId, currentYear.id) : undefined;
  const filiere = assignment ? filieres.find(f => f.id === assignment.filiereId) : undefined;
  // Une filière peut redéfinir ses groupes par niveau (ex: "S1" en 1ère vs en
  // Tle) — fusionner la base ('tous niveaux') avec les éventuels ajouts du
  // niveau de CETTE classe.
  const groups = (filiere && schoolClass?.niveau) ? mergeFiliereChoiceGroups(filiereChoiceGroups, filiere.id, schoolClass.niveau) : [];

  if (!period || !schoolClass) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Période ou classe non trouvée</p>
        <Button variant="link" onClick={() => navigate('/notes')}>Retour à la gestion des notes</Button>
      </div>
    );
  }

  if (!filiere || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <Shuffle className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">Aucun créneau au choix pour cette classe</p>
        <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
          Assignez un cursus avec au moins un créneau au choix depuis l'onglet Matières.
        </p>
        <Button variant="link" onClick={() => navigate(`/notes/${periodId}/${classId}`)}>Retour aux matières</Button>
      </div>
    );
  }

  const actor = profile?.full_name || profile?.email || 'Administrateur';

  const handleChange = async (studentId: string, choiceGroupId: string, subjectName: string) => {
    const key = `${studentId}-${choiceGroupId}`;
    setSavingKey(key);
    try {
      await resolveFiliereChoice(choiceGroupId, studentId, subjectName, actor);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/notes/${periodId}/${classId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
            <button onClick={() => navigate('/notes')} className="hover:text-foreground transition-colors">Notes</button>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium text-foreground">{schoolClass.name}</span>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium text-foreground">Choix de cursus</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground truncate">
            Choix des élèves — {filiere.name}
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {classStudents.length} élève{classStudents.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left p-3 font-semibold text-muted-foreground">Élève</th>
                  {groups.map(g => (
                    <th key={g.id} className="text-left p-3 font-semibold text-muted-foreground min-w-48">
                      {g.label} <span className="text-xs font-normal">(coef {g.coefficient})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classStudents.map(student => (
                  <tr key={student.id} className="border-b border-border last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={student.photoUrl} className="object-cover" />
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {`${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{student.firstName} {student.lastName}</span>
                      </div>
                    </td>
                    {groups.map(group => {
                      const choice = getStudentFiliereChoice(student.id, group.id);
                      const key = `${student.id}-${group.id}`;
                      const isSaving = savingKey === key;
                      return (
                        <td key={group.id} className="p-3">
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : choice ? (
                            <div className="flex items-center gap-2">
                              <Select value={choice.chosenSubjectName} onValueChange={(v) => handleChange(student.id, group.id, v)}>
                                <SelectTrigger className="h-8 text-sm w-40"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {group.options.map(o => (
                                    <SelectItem key={o.id} value={o.subjectName}>{o.subjectName}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {choice.chosenBy === 'student' ? (
                                <Badge variant="outline" className="text-[10px] flex-shrink-0">élève</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] flex-shrink-0">forcé</Badge>
                              )}
                            </div>
                          ) : (
                            <Select onValueChange={(v) => handleChange(student.id, group.id, v)}>
                              <SelectTrigger className="h-8 text-sm w-48">
                                <SelectValue placeholder="En attente du choix…" />
                              </SelectTrigger>
                              <SelectContent>
                                {group.options.map(o => (
                                  <SelectItem key={o.id} value={o.subjectName}>{o.subjectName}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassFiliereChoices;
