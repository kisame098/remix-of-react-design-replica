import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { GradeUpsertEntry } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ChevronRight, Users, Check, Settings, ArrowUpDown, Search, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';

type SortOption = 'default' | 'name-asc' | 'name-desc' | 'average-asc' | 'average-desc';

/** Entrée locale d'une note (strings pour les inputs) */
interface GradeEntry {
  studentEnrollmentId: string; // UUID → student_enrollments.id
  devoir1: string;
  devoir2: string;
  devoir3: string;
  devoir4: string;
  devoir5: string;
  composition: string;
  note: string;
}

const SubjectGrades = () => {
  const { periodId, classId, subjectId } = useParams<{ periodId: string; classId: string; subjectId: string }>();
  const navigate = useNavigate();
  const { gradePeriods, classes, subjects, students, grades, upsertGrades, getSubjectSettings } = useSchool();

  // subjectId is UUID string — use directly
  const settings = getSubjectSettings(subjectId!);
  const [gradeEntries, setGradeEntries] = useState<GradeEntry[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [search, setSearch] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const period = gradePeriods.find(p => p.id === periodId);
  const schoolClass = classes.find(c => c.id === classId);
  const subject = subjects.find(s => s.id === subjectId);
  const isExam = period?.type === 'exam';

  // Pour une matière au choix/facultative, le coefficient réellement appliqué
  // vient du choix résolu (custom_coefficient), pas du coefficient de base —
  // on affiche celui-ci dès qu'au moins un élève actif en a un.
  const resolvedCoefficient = (() => {
    if (!subject || subject.subjectType === 'obligatoire') return subject?.coefficient;
    const activeCustom = Object.values(settings?.studentSettings ?? {}).find(s => s.active && s.customCoef);
    return activeCustom?.customCoef ? Number(activeCustom.customCoef) : subject.coefficient;
  })();

  // Toutes les matières de cette période/classe pour la sidebar
  const classSubjects = useMemo(
    () => subjects.filter(s => s.periodId === periodId && s.classId === classId),
    [subjects, periodId, classId]
  );

  // Filtre élèves de la classe + respect du flag active per-student
  const classStudents = useMemo(
    () => students.filter(s => {
      if (s.classId !== classId) return false;
      if (settings?.studentSettings?.[s.id]?.active === false) return false;
      return true;
    }),
    [students, classId, settings]
  );

  const devoir1Active = settings?.devoir1Active ?? true;
  const devoir2Active = settings?.devoir2Active ?? true;
  const devoir3Active = settings?.devoir3Active ?? true;
  const devoir4Active = settings?.devoir4Active ?? false;
  const devoir5Active = settings?.devoir5Active ?? false;

  // Initialiser les entrées depuis les grades Supabase en cache
  useEffect(() => {
    const entries = classStudents.map(student => {
      const existingGrade = grades.find(
        g => g.studentEnrollmentId === student.id && g.subjectId === subjectId
      );
      return {
        studentEnrollmentId: student.id,
        devoir1:      existingGrade?.devoir1     !== undefined ? String(existingGrade.devoir1)     : '',
        devoir2:      existingGrade?.devoir2     !== undefined ? String(existingGrade.devoir2)     : '',
        devoir3:      existingGrade?.devoir3     !== undefined ? String(existingGrade.devoir3)     : '',
        devoir4:      existingGrade?.devoir4     !== undefined ? String(existingGrade.devoir4)     : '',
        devoir5:      existingGrade?.devoir5     !== undefined ? String(existingGrade.devoir5)     : '',
        composition:  existingGrade?.composition !== undefined ? String(existingGrade.composition) : '',
        note:         existingGrade?.note        !== undefined ? String(existingGrade.note)        : '',
      } as GradeEntry;
    });
    setGradeEntries(entries);
    setSaveState('idle');
  }, [classStudents.length, grades, subjectId]);

  // Sauvegarde vers Supabase (debounced 800ms)
  const saveGrades = useCallback(async (entries: GradeEntry[]) => {
    setSaveState('saving');
    try {
      const upsertEntries: GradeUpsertEntry[] = entries.map(entry => ({
        studentEnrollmentId: entry.studentEnrollmentId,
        devoir1:     entry.devoir1     ? Number(entry.devoir1)     : null,
        devoir2:     entry.devoir2     ? Number(entry.devoir2)     : null,
        devoir3:     entry.devoir3     ? Number(entry.devoir3)     : null,
        devoir4:     entry.devoir4     ? Number(entry.devoir4)     : null,
        devoir5:     entry.devoir5     ? Number(entry.devoir5)     : null,
        composition: entry.composition ? Number(entry.composition) : null,
        note:        entry.note        ? Number(entry.note)        : null,
      }));
      await upsertGrades(subjectId!, upsertEntries);
      setSaveState('saved');
    } catch {
      setSaveState('error');
      toast({ title: 'Erreur de sauvegarde', description: 'Les notes n\'ont pas pu être enregistrées', variant: 'destructive' });
    }
  }, [upsertGrades, subjectId]);

  const updateGrade = (enrollmentId: string, field: keyof GradeEntry, value: string) => {
    if (field !== 'studentEnrollmentId' && value !== '' &&
        (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 20)) return;
    const newEntries = gradeEntries.map(entry =>
      entry.studentEnrollmentId === enrollmentId ? { ...entry, [field]: value } : entry
    );
    setGradeEntries(newEntries);
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveGrades(newEntries), 800);
  };

  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  const calculateAverage = useCallback((entry: GradeEntry): string => {
    if (isExam) return entry.note || '-';
    const allNotes: number[] = [];
    if (devoir1Active && entry.devoir1 !== '') allNotes.push(Number(entry.devoir1));
    if (devoir2Active && entry.devoir2 !== '') allNotes.push(Number(entry.devoir2));
    if (devoir3Active && entry.devoir3 !== '') allNotes.push(Number(entry.devoir3));
    if (devoir4Active && entry.devoir4 !== '') allNotes.push(Number(entry.devoir4));
    if (devoir5Active && entry.devoir5 !== '') allNotes.push(Number(entry.devoir5));
    if (entry.composition !== '') allNotes.push(Number(entry.composition));
    if (allNotes.length === 0) return '-';
    const total = allNotes.reduce((sum, n) => sum + n, 0);
    return (total / allNotes.length).toFixed(2);
  }, [isExam, devoir1Active, devoir2Active, devoir3Active, devoir4Active, devoir5Active]);

  // Grades for sidebar completion indicator
  const subjectCompletionMap = useMemo(() => {
    return classSubjects.reduce((acc, subj) => {
      const hasNotes = classStudents.some(student => {
        const g = grades.find(g =>
          g.studentEnrollmentId === student.id && g.subjectId === subj.id
        );
        return g && (g.devoir1 !== undefined || g.composition !== undefined || g.note !== undefined);
      });
      acc[subj.id] = hasNotes;
      return acc;
    }, {} as Record<string, boolean>);
  }, [classSubjects, classStudents, grades]);

  const sortedStudentsWithRank = useMemo(() => {
    const studentsWithAvg = classStudents.map(student => {
      const entry = gradeEntries.find(e => e.studentEnrollmentId === student.id);
      const avg = entry ? calculateAverage(entry) : '-';
      return { student, avgNum: avg === '-' ? -Infinity : parseFloat(avg) };
    });
    const sorted = [...studentsWithAvg];
    switch (sortOption) {
      case 'name-asc': sorted.sort((a, b) => a.student.lastName.localeCompare(b.student.lastName)); break;
      case 'name-desc': sorted.sort((a, b) => b.student.lastName.localeCompare(a.student.lastName)); break;
      case 'average-asc': sorted.sort((a, b) => a.avgNum - b.avgNum); break;
      case 'average-desc': sorted.sort((a, b) => b.avgNum - a.avgNum); break;
    }
    return sorted.map((item, index) => {
      let rank = index + 1;
      if (sortOption === 'average-desc' || sortOption === 'average-asc') {
        for (let i = index - 1; i >= 0; i--) {
          if (sorted[i].avgNum === item.avgNum && item.avgNum !== -Infinity) { rank = i + 1; break; }
        }
      }
      return { ...item, rank };
    });
  }, [classStudents, gradeEntries, sortOption, calculateAverage]);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return sortedStudentsWithRank;
    const q = search.toLowerCase();
    return sortedStudentsWithRank.filter(({ student }) =>
      student.firstName.toLowerCase().includes(q) ||
      student.lastName.toLowerCase().includes(q)
    );
  }, [sortedStudentsWithRank, search]);

  const showRankColumn = sortOption === 'average-asc' || sortOption === 'average-desc';

  if (!period || !schoolClass || !subject) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Données non trouvées</p>
        <Button variant="link" onClick={() => navigate('/notes')}>Retour à la gestion des notes</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* ── SIDEBAR NAVIGATION DES MATIÈRES ── */}
      <div className="w-52 border-r flex-shrink-0 flex flex-col bg-muted/10 overflow-hidden">
        <div className="p-3 border-b bg-background flex-shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Matières
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{schoolClass.name} · {period.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {classSubjects.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 px-3">Aucune matière</p>
          ) : (
            classSubjects.map(subj => {
              const isActive = subj.id === subjectId;
              const hasNotes = subjectCompletionMap[subj.id];
              return (
                <button
                  key={subj.id}
                  onClick={() => navigate(`/notes/${periodId}/${classId}/${subj.id}`)}
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-sm ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    hasNotes
                      ? isActive ? 'bg-primary-foreground' : 'bg-green-500'
                      : isActive ? 'bg-primary-foreground/40' : 'bg-muted-foreground/30'
                  }`} />
                  <span className="truncate">{subj.name}</span>
                  <span className={`text-xs ml-auto flex-shrink-0 ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    ×{subj.coefficient}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="flex-shrink-0 mt-0.5"
              onClick={() => navigate(`/notes/${periodId}/${classId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1 flex-wrap">
                <button onClick={() => navigate('/notes')} className="hover:text-foreground transition-colors">Notes</button>
                <ChevronRight className="h-3.5 w-3.5" />
                <button onClick={() => navigate(`/notes/${periodId}/${classId}`)} className="hover:text-foreground transition-colors">
                  {schoolClass.name}
                </button>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground truncate">{subject.name}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Saisie des Notes</h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-muted-foreground min-w-[120px] text-right">
                {saveState === 'saving' && (
                  <span className="animate-pulse">Enregistrement...</span>
                )}
                {saveState === 'saved' && (
                  <span className="flex items-center gap-1 justify-end text-green-600">
                    <Check className="h-3.5 w-3.5" />
                    Enregistré
                  </span>
                )}
                {saveState === 'error' && (
                  <span className="flex items-center gap-1 justify-end text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Erreur
                  </span>
                )}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon"
                    onClick={() => navigate(`/notes/${periodId}/${classId}/${subjectId}/settings`)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Paramètres de la matière</p></TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Grade table */}
          {classStudents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-14">
                <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Aucun élève dans cette classe</p>
                <Button variant="link" onClick={() => navigate('/eleves')}>Gérer les élèves</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base">
                    {classStudents.length} élève{classStudents.length !== 1 ? 's' : ''} — Coefficient {resolvedCoefficient}
                    {subject.subjectType !== 'obligatoire' && resolvedCoefficient !== subject.coefficient && (
                      <span className="text-muted-foreground font-normal"> (base {subject.coefficient})</span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Recherche */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher un élève..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 w-48 h-8 text-sm"
                      />
                    </div>
                    {/* Tri */}
                    <div className="flex items-center gap-1.5">
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                        <SelectTrigger className="w-40 h-8 text-sm">
                          <SelectValue placeholder="Trier..." />
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
                    <span className="text-xs text-muted-foreground">Notes / 20</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {showRankColumn && <TableHead className="w-12 text-center bg-primary/10">Rang</TableHead>}
                        <TableHead className="min-w-[160px]">Élève</TableHead>
                        {isExam ? (
                          <TableHead className="min-w-[100px] text-center">Note</TableHead>
                        ) : (
                          <>
                            {devoir1Active && <TableHead className="min-w-[90px] text-center">Devoir 1</TableHead>}
                            {devoir2Active && <TableHead className="min-w-[90px] text-center">Devoir 2</TableHead>}
                            {devoir3Active && <TableHead className="min-w-[90px] text-center">Devoir 3</TableHead>}
                            {devoir4Active && <TableHead className="min-w-[90px] text-center">Devoir 4</TableHead>}
                            {devoir5Active && <TableHead className="min-w-[90px] text-center">Devoir 5</TableHead>}
                            <TableHead className="min-w-[100px] text-center">Composition</TableHead>
                          </>
                        )}
                        <TableHead className="min-w-[90px] text-center bg-muted/50">Moyenne</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                            Aucun élève trouvé pour « {search} »
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStudents.map(({ student, rank }) => {
                          const entry = gradeEntries.find(e => e.studentEnrollmentId === student.id);
                          if (!entry) return null;
                          const average = calculateAverage(entry);
                          const avgNum = parseFloat(average);
                          const avgColor = !isNaN(avgNum) ? (avgNum >= 10 ? 'text-green-600' : 'text-red-500') : '';

                          return (
                            <TableRow key={student.id}>
                              {showRankColumn && (
                                <TableCell className="text-center font-bold bg-primary/10 text-sm">
                                  {average !== '-' ? rank : '-'}
                                </TableCell>
                              )}
                              <TableCell>
                                <div className="font-medium text-sm leading-tight">{student.lastName}</div>
                                <div className="text-xs text-muted-foreground">{student.firstName}</div>
                              </TableCell>
                              {isExam ? (
                                <TableCell>
                                  <Input type="number" min="0" max="20" step="0.25"
                                    className="w-20 text-center mx-auto h-8"
                                    value={entry.note}
                                    onChange={(e) => updateGrade(student.id, 'note', e.target.value)}
                                    placeholder="-" />
                                </TableCell>
                              ) : (
                                <>
                                  {devoir1Active && (
                                    <TableCell>
                                      <Input type="number" min="0" max="20" step="0.25"
                                        className="w-20 text-center mx-auto h-8"
                                        value={entry.devoir1}
                                        onChange={(e) => updateGrade(student.id, 'devoir1', e.target.value)}
                                        placeholder="-" />
                                    </TableCell>
                                  )}
                                  {devoir2Active && (
                                    <TableCell>
                                      <Input type="number" min="0" max="20" step="0.25"
                                        className="w-20 text-center mx-auto h-8"
                                        value={entry.devoir2}
                                        onChange={(e) => updateGrade(student.id, 'devoir2', e.target.value)}
                                        placeholder="-" />
                                    </TableCell>
                                  )}
                                  {devoir3Active && (
                                    <TableCell>
                                      <Input type="number" min="0" max="20" step="0.25"
                                        className="w-20 text-center mx-auto h-8"
                                        value={entry.devoir3}
                                        onChange={(e) => updateGrade(student.id, 'devoir3', e.target.value)}
                                        placeholder="-" />
                                    </TableCell>
                                  )}
                                  {devoir4Active && (
                                    <TableCell>
                                      <Input type="number" min="0" max="20" step="0.25"
                                        className="w-20 text-center mx-auto h-8"
                                        value={entry.devoir4}
                                        onChange={(e) => updateGrade(student.id, 'devoir4', e.target.value)}
                                        placeholder="-" />
                                    </TableCell>
                                  )}
                                  {devoir5Active && (
                                    <TableCell>
                                      <Input type="number" min="0" max="20" step="0.25"
                                        className="w-20 text-center mx-auto h-8"
                                        value={entry.devoir5}
                                        onChange={(e) => updateGrade(student.id, 'devoir5', e.target.value)}
                                        placeholder="-" />
                                    </TableCell>
                                  )}
                                  <TableCell>
                                    <Input type="number" min="0" max="20" step="0.25"
                                      className="w-20 text-center mx-auto h-8"
                                      value={entry.composition}
                                      onChange={(e) => updateGrade(student.id, 'composition', e.target.value)}
                                      placeholder="-" />
                                  </TableCell>
                                </>
                              )}
                              <TableCell className={`text-center font-semibold bg-muted/50 ${avgColor}`}>
                                {average}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {search && filteredStudents.length < sortedStudentsWithRank.length && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    {filteredStudents.length} résultat{filteredStudents.length !== 1 ? 's' : ''} sur {sortedStudentsWithRank.length} élèves
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubjectGrades;
