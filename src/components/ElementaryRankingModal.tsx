import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Medal, Award, FileText, Printer, Upload, XCircle, Loader2 } from 'lucide-react';
import { useElementaryClassRanking } from '@/hooks/useElementaryClassRanking';
import { useElementaryBulletinDataList } from '@/hooks/useElementaryBulletinData';
import ElementaryBulletinModal from '@/components/ElementaryBulletinModal';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permissions';
import {
  getBulletinPublishStatus, publishBulletins, unpublishBulletins,
  type BulletinPublishStatus,
} from '@/lib/bulletinPublishing';
import { toast } from '@/hooks/use-toast';

interface ElementaryRankingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  classId: string;
}

const ElementaryRankingModal = ({ open, onOpenChange, periodId, classId }: ElementaryRankingModalProps) => {
  const rankings = useElementaryClassRanking(classId, periodId, open);
  const [bulletinStudentId, setBulletinStudentId] = useState<string | null>(null);
  const [bulletinAllClass, setBulletinAllClass] = useState(false);

  // ── Publication au portail élève ──────────────────────────────────────────
  // Même geste qu'au collège (ClassRankingModal) : on fige un instantané des
  // bulletins pour que chaque élève puisse voir et télécharger le sien.
  //
  // `isLastPeriodOfYear` est false ici : la décision de passage est un choix
  // explicite qui se coche au moment de générer le bulletin (voir
  // ElementaryBulletinModal). Publier ne doit jamais l'inventer.
  const bulletinDataList = useElementaryBulletinDataList(periodId, classId, false, open);
  const { accountRole, staffPermissions, school } = useAuth();
  const canPublish = hasPermission(accountRole, staffPermissions, 'bulletins');
  const [publishStatus, setPublishStatus] = useState<BulletinPublishStatus | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  useEffect(() => {
    if (!open || !periodId || !classId) { setPublishStatus(null); return; }
    let cancelled = false;
    setIsLoadingStatus(true);
    getBulletinPublishStatus(periodId, classId)
      .then(status => { if (!cancelled) setPublishStatus(status); })
      .finally(() => { if (!cancelled) setIsLoadingStatus(false); });
    return () => { cancelled = true; };
  }, [open, periodId, classId]);

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

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2: return <Medal className="h-5 w-5 text-gray-400" />;
      case 3: return <Award className="h-5 w-5 text-amber-600" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Classement de la classe</DialogTitle>
          <DialogDescription>
            Moyenne sur 10 = (Σ points obtenus × 10) / (Σ points max des disciplines saisies)
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end gap-2 flex-wrap">
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
        </div>
        {publishStatus && (
          <p className="text-xs text-muted-foreground text-right -mt-2">
            Publié le {new Date(publishStatus.publishedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
            {' · '}{publishStatus.count} élève(s)
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
                <TableHead className="text-center min-w-[100px]">Points</TableHead>
                <TableHead className="text-center min-w-[100px]">Moyenne /10</TableHead>
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
                  const avgColor = student.average === undefined
                    ? 'text-muted-foreground'
                    : student.average >= 5 ? 'text-green-600' : 'text-red-600';
                  return (
                    <TableRow key={student.studentId}>
                      <TableCell className="text-center sticky left-0 bg-background">
                        {student.average !== undefined && (
                          <div className="flex items-center justify-center gap-1">
                            {getRankIcon(student.rank)}
                            <span className="font-bold">{student.rank}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{student.studentCode}</TableCell>
                      <TableCell className="font-medium">{student.lastName}</TableCell>
                      <TableCell>{student.firstName}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {student.average !== undefined ? `${student.pointsObtenus} / ${student.pointsMax}` : '—'}
                      </TableCell>
                      <TableCell className={`text-center font-bold ${avgColor}`}>
                        {student.average !== undefined ? student.average.toFixed(2) : '—'}
                      </TableCell>
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
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
        </div>
      </DialogContent>

      {(bulletinStudentId || bulletinAllClass) && (
        <ElementaryBulletinModal
          open
          onOpenChange={(o) => { if (!o) { setBulletinStudentId(null); setBulletinAllClass(false); } }}
          periodId={periodId}
          classId={classId}
          studentId={bulletinAllClass ? undefined : bulletinStudentId ?? undefined}
        />
      )}
    </Dialog>
  );
};

export default ElementaryRankingModal;
