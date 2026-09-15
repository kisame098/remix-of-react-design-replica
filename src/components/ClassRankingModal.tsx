import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Medal, Award, FileText, Printer, Upload, Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import { useClassRanking, RankingCalculationMode } from '@/hooks/useClassRanking';
import { useBulletinDataList } from '@/hooks/useBulletinData';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';
import { publishBulletins, unpublishBulletins, getBulletinPublishStatus, BulletinPublishStatus } from '@/lib/bulletinPublishing';
import { toast } from '@/hooks/use-toast';
import BulletinModal from '@/components/BulletinModal';
import ExportRankingDialog from '@/components/ExportRankingDialog';

type CalculationMode = RankingCalculationMode;

interface ClassRankingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;  // UUID → grade_periods.id
  classId: string;   // UUID → classes.id
}

const ClassRankingModal = ({ open, onOpenChange, periodId, classId }: ClassRankingModalProps) => {
  const { gradePeriods } = useSchool();
  // Un examen interne n'a qu'une seule note par matière — pas de devoirs/
  // composition, donc aucun "mode de calcul" à choisir : on saute directement
  // aux résultats, sans jamais passer par l'étape de sélection top2/top3/tout.
  const isExam = gradePeriods.find(p => p.id === periodId)?.type === 'exam';

  const [mode, setMode] = useState<CalculationMode>('all');
  const [showResults, setShowResults] = useState(false);
  const effectiveShowResults = isExam || showResults;
  const [bulletinStudentId, setBulletinStudentId] = useState<string | null>(null);
  const [bulletinAllClass, setBulletinAllClass] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const rankings = useClassRanking(periodId, classId, mode, effectiveShowResults);
  const bulletinDataList = useBulletinDataList(periodId, classId, mode, effectiveShowResults);

  const { accountRole, staffPermissions, school } = useAuth();
  const canPublish = hasPermission(accountRole, staffPermissions, 'bulletins');
  const [publishStatus, setPublishStatus] = useState<BulletinPublishStatus | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  useEffect(() => {
    if (!effectiveShowResults || !periodId || !classId) { setPublishStatus(null); return; }
    let cancelled = false;
    setIsLoadingStatus(true);
    getBulletinPublishStatus(periodId, classId)
      .then(status => { if (!cancelled) setPublishStatus(status); })
      .finally(() => { if (!cancelled) setIsLoadingStatus(false); });
    return () => { cancelled = true; };
  }, [effectiveShowResults, periodId, classId]);

  const handlePublish = async () => {
    if (!school?.id || bulletinDataList.length === 0) return;
    setIsPublishing(true);
    try {
      await publishBulletins(school.id, periodId, classId, bulletinDataList);
      setPublishStatus({ publishedAt: new Date().toISOString(), count: bulletinDataList.length });
      toast({
        title: 'Bulletins publiés',
        description: `${bulletinDataList.length} élève(s) peuvent maintenant voir et télécharger leur bulletin sur le portail.`,
      });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setIsPublishing(true);
    try {
      await unpublishBulletins(periodId, classId);
      setPublishStatus(null);
      toast({ title: 'Publication annulée', description: "Les élèves n'ont plus accès à ce bulletin sur le portail." });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  };

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

        {!effectiveShowResults ? (
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              {isExam ? (
                <p className="text-sm text-muted-foreground">Examen — une seule note par matière</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Mode : <span className="font-medium text-foreground">{getModeLabel(mode)}</span>
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm" className="gap-1.5"
                  disabled={rankings.length === 0}
                  onClick={() => setIsExportOpen(true)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Exporter
                </Button>
                <Button
                  variant="outline" size="sm" className="gap-1.5"
                  disabled={rankings.length === 0}
                  onClick={() => setBulletinAllClass(true)}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Bulletins de la classe
                </Button>
                {canPublish && (
                  publishStatus ? (
                    <Button
                      variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={isPublishing || isLoadingStatus}
                      onClick={handleUnpublish}
                    >
                      {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      Annuler la publication
                    </Button>
                  ) : (
                    <Button
                      variant="outline" size="sm" className="gap-1.5"
                      disabled={isPublishing || isLoadingStatus || bulletinDataList.length === 0}
                      onClick={handlePublish}
                    >
                      {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Publier au portail
                    </Button>
                  )
                )}
                {!isExam && (
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Modifier le mode
                  </Button>
                )}
              </div>
            </div>
            {canPublish && publishStatus && (
              <p className="flex items-center gap-1.5 text-xs text-green-700 -mt-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Publié le {new Date(publishStatus.publishedAt).toLocaleDateString('fr-FR')} — {publishStatus.count} élève(s) peuvent voir leur bulletin sur le portail.
              </p>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px] text-center sticky left-0 bg-background">Rang</TableHead>
                    <TableHead className="min-w-[100px]">Code</TableHead>
                    <TableHead className="min-w-[120px]">Nom</TableHead>
                    <TableHead className="min-w-[120px]">Prénom</TableHead>
                    <TableHead className="text-center min-w-[100px]">Moyenne</TableHead>
                    <TableHead className="text-center min-w-[80px]">Coef. Total</TableHead>
                    <TableHead className="w-[110px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                          <TableCell>
                            <Button
                              variant="ghost" size="sm" className="gap-1.5 h-7 text-xs"
                              onClick={() => setBulletinStudentId(student.studentId)}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Bulletin
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {(bulletinStudentId || bulletinAllClass) && (
        <BulletinModal
          open
          onOpenChange={(o) => { if (!o) { setBulletinStudentId(null); setBulletinAllClass(false); } }}
          periodId={periodId}
          classId={classId}
          mode={mode}
          studentId={bulletinAllClass ? undefined : bulletinStudentId ?? undefined}
        />
      )}

      <ExportRankingDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        periodId={periodId}
        classId={classId}
        rankings={rankings}
      />
    </Dialog>
  );
};

export default ClassRankingModal;
