import { useState, useMemo } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, Medal, Award } from 'lucide-react';

type CalculationMode = 'top2' | 'top3' | 'all';

interface ClassRankingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: number;
  classId: number;
}

interface StudentRanking {
  studentId: number;
  studentCode: string;
  firstName: string;
  lastName: string;
  averageGeneral: number;
  totalCoef: number;
  rank: number;
  subjectDetails: {
    subjectName: string;
    muDev: number | null;
    muMat: number | null;
    coef: number;
    pPond: number | null;
  }[];
}

const ClassRankingModal = ({ open, onOpenChange, periodId, classId }: ClassRankingModalProps) => {
  const { students, subjects, grades, getSubjectSettings } = useSchool();
  const [mode, setMode] = useState<CalculationMode>('all');
  const [showResults, setShowResults] = useState(false);

  const classStudents = students.filter(s => s.classId === classId);
  const classSubjects = subjects.filter(s => s.periodId === periodId && s.classId === classId);

  // Algorithme de calcul selon les spécifications
  const rankings = useMemo((): StudentRanking[] => {
    if (!showResults) return [];

    const studentRankings: StudentRanking[] = [];

    for (const student of classStudents) {
      const settings = classSubjects.map(subj => getSubjectSettings(subj.id, periodId));
      
      // Vérifier si l'élève est actif pour au moins une matière
      const activeSubjects = classSubjects.filter((subj, idx) => {
        const setting = settings[idx];
        if (setting?.studentSettings?.[student.id]?.active === false) return false;
        return true;
      });

      if (activeSubjects.length === 0) continue;

      let totalPPond = 0;
      let totalCoef = 0;
      const subjectDetails: StudentRanking['subjectDetails'] = [];

      for (const subject of classSubjects) {
        const setting = getSubjectSettings(subject.id, periodId);
        
        // Vérifier si l'élève est actif pour cette matière
        if (setting?.studentSettings?.[student.id]?.active === false) continue;

        // Récupérer le coefficient personnalisé de l'élève ou le coefficient par défaut
        const customCoefStr = setting?.studentSettings?.[student.id]?.customCoef;
        const studentCoef = customCoefStr && customCoefStr !== '' 
          ? parseFloat(customCoefStr) 
          : subject.coefficient;

        // Récupérer les notes
        const grade = grades.find(
          g => g.studentId === student.id && g.subjectId === subject.id && g.periodId === periodId
        );

        if (!grade) {
          subjectDetails.push({
            subjectName: subject.name,
            muDev: null,
            muMat: null,
            coef: studentCoef,
            pPond: null
          });
          continue;
        }

        // Étape A: Calcul de la moyenne des devoirs (μ_dev)
        const devoir1Active = setting?.devoir1Active ?? true;
        const devoir2Active = setting?.devoir2Active ?? true;
        const devoir3Active = setting?.devoir3Active ?? true;
        const devoir4Active = setting?.devoir4Active ?? false;
        const devoir5Active = setting?.devoir5Active ?? false;

        const devoirNotes: number[] = [];
        if (devoir1Active && grade.devoir1 !== undefined) devoirNotes.push(grade.devoir1);
        if (devoir2Active && grade.devoir2 !== undefined) devoirNotes.push(grade.devoir2);
        if (devoir3Active && grade.devoir3 !== undefined) devoirNotes.push(grade.devoir3);
        if (devoir4Active && grade.devoir4 !== undefined) devoirNotes.push(grade.devoir4);
        if (devoir5Active && grade.devoir5 !== undefined) devoirNotes.push(grade.devoir5);

        // Appliquer le mode de calcul
        let selectedNotes: number[] = [];
        const k = devoirNotes.length;
        
        if (mode === 'top2') {
          const n = 2;
          if (k <= n) {
            selectedNotes = [...devoirNotes];
          } else {
            selectedNotes = [...devoirNotes].sort((a, b) => b - a).slice(0, n);
          }
        } else if (mode === 'top3') {
          const n = 3;
          if (k <= n) {
            selectedNotes = [...devoirNotes];
          } else {
            selectedNotes = [...devoirNotes].sort((a, b) => b - a).slice(0, n);
          }
        } else {
          // mode === 'all'
          selectedNotes = [...devoirNotes];
        }

        // Calculer μ_dev
        let muDev: number | null = null;
        if (selectedNotes.length > 0) {
          muDev = selectedNotes.reduce((sum, n) => sum + n, 0) / selectedNotes.length;
        }

        // Étape B: Calcul de la moyenne matière (μ_mat)
        const composition = grade.composition;
        let muMat: number | null = null;

        if (muDev !== null && composition !== undefined) {
          muMat = (muDev + composition) / 2;
        } else if (muDev !== null && composition === undefined) {
          muMat = muDev;
        } else if (muDev === null && composition !== undefined) {
          muMat = composition;
        }

        // Étape C: Calcul des points pondérés (P_pond)
        let pPond: number | null = null;
        if (muMat !== null) {
          pPond = muMat * studentCoef;
          totalPPond += pPond;
          totalCoef += studentCoef;
        }

        subjectDetails.push({
          subjectName: subject.name,
          muDev,
          muMat,
          coef: studentCoef,
          pPond
        });
      }

      // Étape D: Calcul de la moyenne générale (μ_gen)
      const averageGeneral = totalCoef > 0 ? totalPPond / totalCoef : 0;

      studentRankings.push({
        studentId: student.id,
        studentCode: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        averageGeneral,
        totalCoef,
        rank: 0,
        subjectDetails
      });
    }

    // Trier par moyenne générale décroissante
    studentRankings.sort((a, b) => b.averageGeneral - a.averageGeneral);

    // Calculer les rangs avec gestion des égalités
    for (let i = 0; i < studentRankings.length; i++) {
      if (i === 0) {
        studentRankings[i].rank = 1;
      } else {
        if (studentRankings[i].averageGeneral === studentRankings[i - 1].averageGeneral) {
          studentRankings[i].rank = studentRankings[i - 1].rank;
        } else {
          studentRankings[i].rank = i + 1;
        }
      }
    }

    return studentRankings;
  }, [showResults, mode, classStudents, classSubjects, grades, getSubjectSettings, periodId]);

  const handleCalculate = () => {
    setShowResults(true);
  };

  const handleReset = () => {
    setShowResults(false);
    setMode('all');
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setShowResults(false);
      setMode('all');
    }, 300);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getModeLabel = (m: CalculationMode) => {
    switch (m) {
      case 'top2':
        return 'Top-2 (2 meilleures notes de devoirs)';
      case 'top3':
        return 'Top-3 (3 meilleures notes de devoirs)';
      case 'all':
        return 'Toutes les notes (moyenne de tous les devoirs)';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Générer le Classement Général</DialogTitle>
          <DialogDescription>
            Calculez la moyenne générale et le rang de chaque élève de la classe
          </DialogDescription>
        </DialogHeader>

        {!showResults ? (
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Label className="text-base font-semibold">Mode de calcul de la moyenne des devoirs</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as CalculationMode)}>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="top2" id="top2" className="mt-1" />
                  <div>
                    <Label htmlFor="top2" className="font-medium cursor-pointer">Top-2</Label>
                    <p className="text-sm text-muted-foreground">
                      Considérer les 2 meilleures notes de devoirs pour chaque matière
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="top3" id="top3" className="mt-1" />
                  <div>
                    <Label htmlFor="top3" className="font-medium cursor-pointer">Top-3</Label>
                    <p className="text-sm text-muted-foreground">
                      Considérer les 3 meilleures notes de devoirs pour chaque matière
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="all" id="all" className="mt-1" />
                  <div>
                    <Label htmlFor="all" className="font-medium cursor-pointer">Toutes les notes</Label>
                    <p className="text-sm text-muted-foreground">
                      Considérer toutes les notes de devoirs disponibles
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg text-sm space-y-2">
              <p className="font-medium">Formules de calcul :</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>μ_dev</strong> = Moyenne des devoirs sélectionnés</li>
                <li><strong>μ_mat</strong> = (μ_dev + Composition) / 2</li>
                <li><strong>P_pond</strong> = μ_mat × Coefficient de l'élève</li>
                <li><strong>Moyenne Générale</strong> = Σ P_pond / Σ Coefficients</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handleCalculate}>
                Calculer le Classement
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mode : <span className="font-medium text-foreground">{getModeLabel(mode)}</span>
              </p>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Modifier le mode
              </Button>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px] text-center sticky left-0 bg-background">Rang</TableHead>
                    <TableHead className="min-w-[100px]">Code</TableHead>
                    <TableHead className="min-w-[120px]">Nom</TableHead>
                    <TableHead className="min-w-[120px]">Prénom</TableHead>
                    <TableHead className="text-center min-w-[100px]">Moyenne</TableHead>
                    <TableHead className="text-center min-w-[80px]">Coef. Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Aucun élève avec des notes disponibles
                      </TableCell>
                    </TableRow>
                  ) : (
                    rankings.map((student) => {
                      const avgColor = student.averageGeneral >= 10 
                        ? 'text-green-600' 
                        : 'text-red-600';

                      return (
                        <TableRow key={student.studentId}>
                          <TableCell className="text-center sticky left-0 bg-background">
                            <div className="flex items-center justify-center gap-1">
                              {getRankIcon(student.rank)}
                              <span className="font-bold">{student.rank}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{student.studentCode}</TableCell>
                          <TableCell className="font-medium">{student.lastName}</TableCell>
                          <TableCell>{student.firstName}</TableCell>
                          <TableCell className={`text-center font-bold ${avgColor}`}>
                            {student.averageGeneral.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">{student.totalCoef}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClassRankingModal;
