import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ChevronRight, Users, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface GradeEntry {
  studentId: number;
  devoir1: string;
  devoir2: string;
  devoir3: string;
  composition: string;
  note: string; // For exams
}

const SubjectGrades = () => {
  const { periodId, classId, subjectId } = useParams();
  const navigate = useNavigate();
  const { gradePeriods, classes, subjects, students, grades, setGrades } = useSchool();

  const [gradeEntries, setGradeEntries] = useState<GradeEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const period = gradePeriods.find(p => p.id === Number(periodId));
  const schoolClass = classes.find(c => c.id === Number(classId));
  const subject = subjects.find(s => s.id === Number(subjectId));

  const classStudents = students.filter(s => s.classId === Number(classId));
  const isExam = period?.type === 'exam';

  useEffect(() => {
    // Initialize grade entries from existing grades or empty
    const entries = classStudents.map(student => {
      const existingGrade = grades.find(
        g => g.studentId === student.id && 
             g.subjectId === Number(subjectId) && 
             g.periodId === Number(periodId)
      );
      
      return {
        studentId: student.id,
        devoir1: existingGrade?.devoir1?.toString() || '',
        devoir2: existingGrade?.devoir2?.toString() || '',
        devoir3: existingGrade?.devoir3?.toString() || '',
        composition: existingGrade?.composition?.toString() || '',
        note: existingGrade?.note?.toString() || ''
      };
    });
    setGradeEntries(entries);
  }, [classStudents.length, grades, subjectId, periodId]);

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

  // Auto-save function
  const saveGrades = useCallback((entries: GradeEntry[]) => {
    const newGrades = entries.map(entry => ({
      studentId: entry.studentId,
      subjectId: Number(subjectId),
      periodId: Number(periodId),
      devoir1: entry.devoir1 ? Number(entry.devoir1) : undefined,
      devoir2: entry.devoir2 ? Number(entry.devoir2) : undefined,
      devoir3: entry.devoir3 ? Number(entry.devoir3) : undefined,
      composition: entry.composition ? Number(entry.composition) : undefined,
      note: entry.note ? Number(entry.note) : undefined
    }));

    const filteredGrades = grades.filter(
      g => !(g.subjectId === Number(subjectId) && g.periodId === Number(periodId))
    );
    setGrades([...filteredGrades, ...newGrades]);
    setLastSaved(new Date());
    setIsSaving(false);
  }, [grades, setGrades, subjectId, periodId]);

  const updateGrade = (studentId: number, field: keyof GradeEntry, value: string) => {
    // Allow empty or valid numbers 0-20
    if (value !== '' && (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 20)) {
      return;
    }
    
    const newEntries = gradeEntries.map(entry => 
      entry.studentId === studentId ? { ...entry, [field]: value } : entry
    );
    setGradeEntries(newEntries);
    
    // Auto-save with debounce
    setIsSaving(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveGrades(newEntries);
    }, 800);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const calculateAverage = (entry: GradeEntry): string => {
    if (isExam) {
      return entry.note || '-';
    }

    const values = [entry.devoir1, entry.devoir2, entry.devoir3, entry.composition]
      .filter(v => v !== '')
      .map(v => Number(v));

    if (values.length === 0) return '-';

    // Composition counts double
    const hasComposition = entry.composition !== '';
    const devoirSum = [entry.devoir1, entry.devoir2, entry.devoir3]
      .filter(v => v !== '')
      .reduce((sum, v) => sum + Number(v), 0);
    const devoirCount = [entry.devoir1, entry.devoir2, entry.devoir3].filter(v => v !== '').length;
    
    if (hasComposition) {
      const total = devoirSum + (Number(entry.composition) * 2);
      const count = devoirCount + 2;
      return (total / count).toFixed(2);
    } else if (devoirCount > 0) {
      return (devoirSum / devoirCount).toFixed(2);
    }
    
    return '-';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/notes/${periodId}/${classId}`)}>
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
          <h1 className="text-3xl font-bold text-foreground">Saisie des Notes</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSaving ? (
            <span className="animate-pulse">Enregistrement...</span>
          ) : lastSaved ? (
            <span className="flex items-center gap-1">
              <Check className="h-4 w-4 text-green-600" />
              Enregistré
            </span>
          ) : null}
        </div>
      </div>

      {classStudents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">Aucun élève dans cette classe</p>
            <Button variant="link" onClick={() => navigate('/eleves')}>
              Gérer les élèves
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {classStudents.length} Élève{classStudents.length !== 1 ? 's' : ''} - Coefficient {subject.coefficient}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                Notes sur 20
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">ID</TableHead>
                    <TableHead className="min-w-[150px]">Nom</TableHead>
                    <TableHead className="min-w-[150px]">Prénom</TableHead>
                    <TableHead className="min-w-[120px]">Date Naiss.</TableHead>
                    {isExam ? (
                      <TableHead className="min-w-[100px] text-center">Note</TableHead>
                    ) : (
                      <>
                        <TableHead className="min-w-[100px] text-center">Devoir 1</TableHead>
                        <TableHead className="min-w-[100px] text-center">Devoir 2</TableHead>
                        <TableHead className="min-w-[100px] text-center">Devoir 3</TableHead>
                        <TableHead className="min-w-[100px] text-center">Composition</TableHead>
                      </>
                    )}
                    <TableHead className="min-w-[100px] text-center bg-muted/50">Moyenne</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStudents.map((student) => {
                    const entry = gradeEntries.find(e => e.studentId === student.id);
                    if (!entry) return null;
                    
                    const average = calculateAverage(entry);
                    const avgNum = parseFloat(average);
                    const avgColor = !isNaN(avgNum) 
                      ? avgNum >= 10 ? 'text-green-600' : 'text-red-600'
                      : '';

                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono text-sm whitespace-nowrap">{student.studentId}</TableCell>
                        <TableCell className="font-medium">{student.lastName}</TableCell>
                        <TableCell>{student.firstName}</TableCell>
                        <TableCell>{new Date(student.dateOfBirth).toLocaleDateString('fr-FR')}</TableCell>
                        {isExam ? (
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              className="w-20 text-center mx-auto"
                              value={entry.note}
                              onChange={(e) => updateGrade(student.id, 'note', e.target.value)}
                              placeholder="-"
                            />
                          </TableCell>
                        ) : (
                          <>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="20"
                                step="0.25"
                                className="w-20 text-center mx-auto"
                                value={entry.devoir1}
                                onChange={(e) => updateGrade(student.id, 'devoir1', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="20"
                                step="0.25"
                                className="w-20 text-center mx-auto"
                                value={entry.devoir2}
                                onChange={(e) => updateGrade(student.id, 'devoir2', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="20"
                                step="0.25"
                                className="w-20 text-center mx-auto"
                                value={entry.devoir3}
                                onChange={(e) => updateGrade(student.id, 'devoir3', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="20"
                                step="0.25"
                                className="w-20 text-center mx-auto"
                                value={entry.composition}
                                onChange={(e) => updateGrade(student.id, 'composition', e.target.value)}
                                placeholder="-"
                              />
                            </TableCell>
                          </>
                        )}
                        <TableCell className={`text-center font-semibold bg-muted/50 ${avgColor}`}>
                          {average}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SubjectGrades;
