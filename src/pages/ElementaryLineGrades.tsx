import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ChevronRight, Users, Check, ArrowUpDown, Search, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { REGISTRE_LABELS } from '@/lib/elementaryDefaults';

type SortOption = 'default' | 'name-asc' | 'name-desc' | 'points-asc' | 'points-desc';

interface PointsEntry {
  studentEnrollmentId: string;
  points: string; // string pour l'input
}

const ElementaryLineGrades = () => {
  const { periodId, classId, lineId } = useParams<{ periodId: string; classId: string; lineId: string }>();
  const navigate = useNavigate();
  const { gradePeriods, classes, students, elementaryClassLines, elementaryGrades, elementaryLineSettings, upsertElementaryGrades } = useSchool();

  const [entries, setEntries] = useState<PointsEntry[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [search, setSearch] = useState('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const period = gradePeriods.find(p => p.id === periodId);
  const schoolClass = classes.find(c => c.id === classId);
  const line = elementaryClassLines.find(l => l.id === lineId);

  // Toutes les disciplines de cette classe/période pour la sidebar, groupées par registre
  const classLines = useMemo(
    () => elementaryClassLines
      .filter(l => l.periodId === periodId && l.classId === classId)
      .sort((a, b) => a.ordering - b.ordering),
    [elementaryClassLines, periodId, classId]
  );
  const competenceLines = classLines.filter(l => l.registre === 'COMPETENCE');
  const ressourcesLines = classLines.filter(l => l.registre === 'RESSOURCES');

  const classStudents = useMemo(
    () => students.filter(s => s.classId === classId),
    [students, classId]
  );

  // Élèves dispensés de CETTE discipline (Profil académique de l'élève) : leur
  // saisie est verrouillée, la note serait de toute façon ignorée par la moyenne.
  const exemptedStudentIds = useMemo(
    () => new Set(
      elementaryLineSettings
        .filter(s => s.lineId === lineId && !s.active)
        .map(s => s.studentEnrollmentId)
    ),
    [elementaryLineSettings, lineId]
  );

  useEffect(() => {
    const next = classStudents.map(student => {
      const existing = elementaryGrades.find(g => g.studentEnrollmentId === student.id && g.lineId === lineId);
      return {
        studentEnrollmentId: student.id,
        points: existing?.pointsObtenus !== undefined ? String(existing.pointsObtenus) : '',
      };
    });
    setEntries(next);
    setSaveState('idle');
  }, [classStudents.length, elementaryGrades, lineId]);

  const saveEntries = useCallback(async (list: PointsEntry[]) => {
    setSaveState('saving');
    try {
      await upsertElementaryGrades(lineId!, list.map(e => ({
        studentEnrollmentId: e.studentEnrollmentId,
        pointsObtenus: e.points !== '' ? Number(e.points) : null,
      })));
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      toast({ title: 'Erreur de sauvegarde', description: String(err), variant: 'destructive' });
    }
  }, [upsertElementaryGrades, lineId]);

  const updatePoints = (enrollmentId: string, value: string) => {
    if (value !== '' && (isNaN(Number(value)) || Number(value) < 0 || (line && Number(value) > line.pointMax))) return;
    const next = entries.map(e => e.studentEnrollmentId === enrollmentId ? { ...e, points: value } : e);
    setEntries(next);
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveEntries(next), 800);
  };

  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, []);

  // Indicateur "des notes existent" pour la sidebar
  const lineCompletionMap = useMemo(() => {
    return classLines.reduce((acc, l) => {
      const hasNotes = classStudents.some(student =>
        elementaryGrades.some(g => g.studentEnrollmentId === student.id && g.lineId === l.id && g.pointsObtenus !== undefined)
      );
      acc[l.id] = hasNotes;
      return acc;
    }, {} as Record<string, boolean>);
  }, [classLines, classStudents, elementaryGrades]);

  const sortedStudents = useMemo(() => {
    const withPoints = classStudents.map(student => {
      const entry = entries.find(e => e.studentEnrollmentId === student.id);
      const pts = entry?.points !== '' && entry?.points !== undefined ? Number(entry.points) : -Infinity;
      return { student, pts };
    });
    const sorted = [...withPoints];
    switch (sortOption) {
      case 'name-asc': sorted.sort((a, b) => a.student.lastName.localeCompare(b.student.lastName)); break;
      case 'name-desc': sorted.sort((a, b) => b.student.lastName.localeCompare(a.student.lastName)); break;
      case 'points-asc': sorted.sort((a, b) => a.pts - b.pts); break;
      case 'points-desc': sorted.sort((a, b) => b.pts - a.pts); break;
    }
    return sorted.map(({ student }) => student);
  }, [classStudents, entries, sortOption]);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return sortedStudents;
    const q = search.toLowerCase();
    return sortedStudents.filter(student =>
      student.firstName.toLowerCase().includes(q) || student.lastName.toLowerCase().includes(q)
    );
  }, [sortedStudents, search]);

  if (!period || !schoolClass || !line) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Données non trouvées</p>
        <Button variant="link" onClick={() => navigate('/notes')}>Retour à la gestion des notes</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* ── SIDEBAR NAVIGATION DES DISCIPLINES ── */}
      <div className="w-60 border-r flex-shrink-0 flex flex-col bg-muted/10 overflow-hidden">
        <div className="p-3 border-b bg-background flex-shrink-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Disciplines du barème</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{schoolClass.name} · {period.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {([['Compétence', competenceLines], ['Ressources', ressourcesLines]] as const).map(([label, rows]) => (
            rows.length === 0 ? null : (
              <div key={label}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold px-2.5 mb-1">{label}</p>
                <div className="space-y-0.5">
                  {rows.map(l => {
                    const isActive = l.id === lineId;
                    const hasNotes = lineCompletionMap[l.id];
                    return (
                      <button
                        key={l.id}
                        onClick={() => navigate(`/notes/${periodId}/${classId}/elementaire/${l.id}`)}
                        className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-sm ${
                          isActive ? 'bg-primary text-primary-foreground font-medium shadow-sm' : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          hasNotes ? (isActive ? 'bg-primary-foreground' : 'bg-green-500') : (isActive ? 'bg-primary-foreground/40' : 'bg-muted-foreground/30')
                        }`} />
                        <span className="truncate">{l.name}</span>
                        <span className={`text-xs ml-auto flex-shrink-0 ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          /{l.pointMax}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 space-y-5">
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
                <span className="font-medium text-foreground truncate">{line.name}</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Saisie des Notes</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {REGISTRE_LABELS[line.registre]} · Barème {line.pointMax} pts
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-muted-foreground min-w-[120px] text-right">
                {saveState === 'saving' && <span className="animate-pulse">Enregistrement...</span>}
                {saveState === 'saved' && (
                  <span className="flex items-center gap-1 justify-end text-green-600">
                    <Check className="h-3.5 w-3.5" />Enregistré
                  </span>
                )}
                {saveState === 'error' && (
                  <span className="flex items-center gap-1 justify-end text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />Erreur
                  </span>
                )}
              </span>
            </div>
          </div>

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
                    {classStudents.length} élève{classStudents.length !== 1 ? 's' : ''} — Barème /{line.pointMax}
                  </CardTitle>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher un élève..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 w-48 h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                        <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Trier..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Ordre par défaut</SelectItem>
                          <SelectItem value="name-asc">Nom (A → Z)</SelectItem>
                          <SelectItem value="name-desc">Nom (Z → A)</SelectItem>
                          <SelectItem value="points-desc">Points (↓)</SelectItem>
                          <SelectItem value="points-asc">Points (↑)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-xs text-muted-foreground">Points / {line.pointMax}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">Élève</TableHead>
                        <TableHead className="min-w-[120px] text-center">Points obtenus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-8 text-muted-foreground text-sm">
                            Aucun élève trouvé pour « {search} »
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStudents.map(student => {
                          const entry = entries.find(e => e.studentEnrollmentId === student.id);
                          if (!entry) return null;
                          const isExempted = exemptedStudentIds.has(student.id);
                          return (
                            <TableRow key={student.id} className={isExempted ? 'opacity-60' : undefined}>
                              <TableCell>
                                <div className="font-medium text-sm leading-tight">{student.lastName}</div>
                                <div className="text-xs text-muted-foreground">{student.firstName}</div>
                              </TableCell>
                              <TableCell>
                                {isExempted ? (
                                  <div className="text-center text-xs text-muted-foreground">Dispensé</div>
                                ) : (
                                  <Input type="number" min="0" max={line.pointMax} step="0.5"
                                    className="w-24 text-center mx-auto h-8"
                                    value={entry.points}
                                    onChange={(e) => updatePoints(student.id, e.target.value)}
                                    placeholder="-" />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {search && filteredStudents.length < sortedStudents.length && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    {filteredStudents.length} résultat{filteredStudents.length !== 1 ? 's' : ''} sur {sortedStudents.length} élèves
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

export default ElementaryLineGrades;
