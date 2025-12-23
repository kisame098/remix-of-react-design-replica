import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ChevronRight, Users, Check, Settings, ArrowUpDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';

type SortOption = 'default' | 'name-asc' | 'name-desc' | 'average-asc' | 'average-desc';

interface GradeEntry {
  studentId: number;
  devoir1: string;
  devoir2: string;
  devoir3: string;
  devoir4: string;
  devoir5: string;
  composition: string;
  note: string; // For exams
}

const SubjectGrades = () => {
  const { periodId, classId, subjectId } = useParams();
  const navigate = useNavigate();
  const { gradePeriods, classes, subjects, students, grades, setGrades, getSubjectSettings } = useSchool();

  // Get subject settings
  const settings = getSubjectSettings(Number(subjectId), Number(periodId));

  const [gradeEntries, setGradeEntries] = useState<GradeEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const period = gradePeriods.find(p => p.id === Number(periodId));
  const schoolClass = classes.find(c => c.id === Number(classId));
  const subject = subjects.find(s => s.id === Number(subjectId));

  // Filter students based on settings (only active students for this subject)
  const classStudents = students.filter(s => {
    if (s.classId !== Number(classId)) return false;
    if (settings?.studentSettings?.[s.id]?.active === false) return false;
    return true;
  });
  const isExam = period?.type === 'exam';

  // Active devoirs based on settings
  const devoir1Active = settings?.devoir1Active ?? true;
  const devoir2Active = settings?.devoir2Active ?? true;
  const devoir3Active = settings?.devoir3Active ?? true;
  const devoir4Active = settings?.devoir4Active ?? false;
  const devoir5Active = settings?.devoir5Active ?? false;

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
        devoir4: existingGrade?.devoir4?.toString() || '',
        devoir5: existingGrade?.devoir5?.toString() || '',
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
      classId: Number(classId),
      devoir1: entry.devoir1 ? Number(entry.devoir1) : undefined,
      devoir2: entry.devoir2 ? Number(entry.devoir2) : undefined,
      devoir3: entry.devoir3 ? Number(entry.devoir3) : undefined,
      devoir4: entry.devoir4 ? Number(entry.devoir4) : undefined,
      devoir5: entry.devoir5 ? Number(entry.devoir5) : undefined,
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

  const calculateAverage = useCallback((entry: GradeEntry): string => {
    if (isExam) {
      return entry.note || '-';
    }

    // Build array of all notes (devoirs + composition)
    const allNotes: number[] = [];
    if (devoir1Active && entry.devoir1 !== '') allNotes.push(Number(entry.devoir1));
    if (devoir2Active && entry.devoir2 !== '') allNotes.push(Number(entry.devoir2));
    if (devoir3Active && entry.devoir3 !== '') allNotes.push(Number(entry.devoir3));
    if (devoir4Active && entry.devoir4 !== '') allNotes.push(Number(entry.devoir4));
    if (devoir5Active && entry.devoir5 !== '') allNotes.push(Number(entry.devoir5));
    if (entry.composition !== '') allNotes.push(Number(entry.composition));

    if (allNotes.length === 0) return '-';

    // Simple average: sum of all notes / number of notes
    const total = allNotes.reduce((sum, note) => sum + note, 0);
    return (total / allNotes.length).toFixed(2);
  }, [isExam, devoir1Active, devoir2Active, devoir3Active, devoir4Active, devoir5Active]);

  // Sorted students with ranking
  const sortedStudentsWithRank = useMemo(() => {
    const studentsWithAvg = classStudents.map(student => {
      const entry = gradeEntries.find(e => e.studentId === student.id);
      const avg = entry ? calculateAverage(entry) : '-';
      return { student, avgNum: avg === '-' ? -Infinity : parseFloat(avg) };
    });

    let sorted = [...studentsWithAvg];
    
    switch (sortOption) {
      case 'name-asc':
        sorted.sort((a, b) => a.student.lastName.localeCompare(b.student.lastName));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.student.lastName.localeCompare(a.student.lastName));
        break;
      case 'average-asc':
        sorted.sort((a, b) => a.avgNum - b.avgNum);
        break;
      case 'average-desc':
        sorted.sort((a, b) => b.avgNum - a.avgNum);
        break;
      default:
        // Keep original order
        break;
    }

    // Calculate ranks (only relevant for average sorting)
    const withRanks = sorted.map((item, index) => {
      let rank = index + 1;
      // Handle ties - same average = same rank
      if (sortOption === 'average-desc' || sortOption === 'average-asc') {
        for (let i = index - 1; i >= 0; i--) {
          if (sorted[i].avgNum === item.avgNum && item.avgNum !== -Infinity) {
            rank = i + 1;
            break;
          }
        }
      }
      return { ...item, rank };
    });

    return withRanks;
  }, [classStudents, gradeEntries, sortOption, calculateAverage]);

  const showRankColumn = sortOption === 'average-asc' || sortOption === 'average-desc';

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
        <div className="flex items-center gap-3">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate(`/notes/${periodId}/${classId}/${subjectId}/settings`)}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Paramètres de la matière</p>
            </TooltipContent>
          </Tooltip>
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
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle>
                {classStudents.length} Élève{classStudents.length !== 1 ? 's' : ''} - Coefficient {subject.coefficient}
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Trier par..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Ordre par défaut</SelectItem>
                      <SelectItem value="name-asc">Nom (A → Z)</SelectItem>
                      <SelectItem value="name-desc">Nom (Z → A)</SelectItem>
                      <SelectItem value="average-desc">Moyenne (↓)</SelectItem>
                      <SelectItem value="average-asc">Moyenne (↑)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                  Notes sur 20
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {showRankColumn && <TableHead className="min-w-[60px] text-center bg-primary/10">Rang</TableHead>}
                    <TableHead className="min-w-[100px]">ID</TableHead>
                    <TableHead className="min-w-[150px]">Nom</TableHead>
                    <TableHead className="min-w-[150px]">Prénom</TableHead>
                    <TableHead className="min-w-[120px]">Date Naiss.</TableHead>
                    {isExam ? (
                      <TableHead className="min-w-[100px] text-center">Note</TableHead>
                    ) : (
                      <>
                        {devoir1Active && <TableHead className="min-w-[100px] text-center">Devoir 1</TableHead>}
                        {devoir2Active && <TableHead className="min-w-[100px] text-center">Devoir 2</TableHead>}
                        {devoir3Active && <TableHead className="min-w-[100px] text-center">Devoir 3</TableHead>}
                        {devoir4Active && <TableHead className="min-w-[100px] text-center">Devoir 4</TableHead>}
                        {devoir5Active && <TableHead className="min-w-[100px] text-center">Devoir 5</TableHead>}
                        <TableHead className="min-w-[100px] text-center">Composition</TableHead>
                      </>
                    )}
                    <TableHead className="min-w-[100px] text-center bg-muted/50">Moyenne</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStudentsWithRank.map(({ student, rank }) => {
                    const entry = gradeEntries.find(e => e.studentId === student.id);
                    if (!entry) return null;
                    
                    const average = calculateAverage(entry);
                    const avgNum = parseFloat(average);
                    const avgColor = !isNaN(avgNum) 
                      ? avgNum >= 10 ? 'text-green-600' : 'text-red-600'
                      : '';

                    return (
                      <TableRow key={student.id}>
                        {showRankColumn && (
                          <TableCell className="text-center font-bold bg-primary/10">
                            {average !== '-' ? rank : '-'}
                          </TableCell>
                        )}
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
                            {devoir1Active && (
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
                            )}
                            {devoir2Active && (
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
                            )}
                            {devoir3Active && (
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
                            )}
                            {devoir4Active && (
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max="20"
                                  step="0.25"
                                  className="w-20 text-center mx-auto"
                                  value={entry.devoir4}
                                  onChange={(e) => updateGrade(student.id, 'devoir4', e.target.value)}
                                  placeholder="-"
                                />
                              </TableCell>
                            )}
                            {devoir5Active && (
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max="20"
                                  step="0.25"
                                  className="w-20 text-center mx-auto"
                                  value={entry.devoir5}
                                  onChange={(e) => updateGrade(student.id, 'devoir5', e.target.value)}
                                  placeholder="-"
                                />
                              </TableCell>
                            )}
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
