import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { useSchool } from '@/contexts/SchoolContext';
import { useElementaryBulletinDataList } from '@/hooks/useElementaryBulletinData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2 } from 'lucide-react';
import { generateElementaryBulletinsPdf } from '@/lib/elementaryBulletinPdf';

interface ElementaryBulletinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  classId: string;
  /** Un seul élève si fourni ; sinon, tous les élèves de la classe (un PDF, une page par élève). */
  studentId?: string;
}

const sanitize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');

const ElementaryBulletinModal = ({ open, onOpenChange, periodId, classId, studentId }: ElementaryBulletinModalProps) => {
  const { classes, gradePeriods } = useSchool();
  const isBulk = !studentId;

  const [observations, setObservations] = useState('');
  // Choix EXPLICITE — jamais déduit de "c'est la dernière période qui existe
  // aujourd'hui" (une classe au 1er semestre où le 2e n'a pas encore été créé
  // n'est PAS en fin d'année). Décoché par défaut : on ne rend une décision de
  // passage définitive que si on l'affirme volontairement.
  const [isLastPeriodOfYear, setIsLastPeriodOfYear] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const schoolClass = classes.find(c => c.id === classId);
  const period = gradePeriods.find(p => p.id === periodId);

  const dataList = useElementaryBulletinDataList(periodId, classId, isLastPeriodOfYear, open, studentId, observations);

  useEffect(() => {
    if (!open || dataList.length === 0) {
      setPdfDoc(null);
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
      return;
    }
    let cancelled = false;
    setIsGenerating(true);
    generateElementaryBulletinsPdf(dataList).then(doc => {
      if (cancelled) return;
      setPdfDoc(doc);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return String(doc.output('bloburl'));
      });
    }).finally(() => { if (!cancelled) setIsGenerating(false); });
    return () => { cancelled = true; };
  }, [open, dataList]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleDownloadPdf = () => {
    if (!pdfDoc) return;
    const filename = isBulk
      ? `${sanitize(`Bulletins_${schoolClass?.name ?? 'classe'}_${period?.name ?? ''}`)}.pdf`
      : `${sanitize(`Bulletin_${dataList[0]?.student.lastName ?? ''}_${dataList[0]?.student.firstName ?? ''}_${period?.name ?? ''}`)}.pdf`;
    pdfDoc.save(filename);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[860px] max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{isBulk ? `Bulletins de la classe (${dataList.length})` : 'Bulletin de notes'}</DialogTitle>
          <DialogDescription>
            {isBulk
              ? 'Un PDF avec une page par élève, prêt à télécharger.'
              : 'Aperçu du bulletin — vous pouvez ajouter une observation avant de télécharger le PDF.'}
          </DialogDescription>
        </DialogHeader>

        {period?.type === 'semester' && (
          <div className="px-6 pb-4">
            <label className="flex items-start gap-2 cursor-pointer p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={isLastPeriodOfYear}
                onCheckedChange={(v) => setIsLastPeriodOfYear(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">C'est le dernier semestre/trimestre de l'année scolaire</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Coché : la décision de passage et la "Moyenne Annuelle" apparaissent sur le bulletin —
                  « Admis en classe supérieure » à partir de 5/10, « Redouble » en dessous.
                  Décoché : seule une moyenne cumulée apparaît, sans décision.
                </span>
              </span>
            </label>
          </div>
        )}

        {!isBulk && (
          <div className="px-6 pb-4 space-y-1.5">
            <Label className="text-xs">Observations du conseil des maîtres (optionnel)</Label>
            <Input
              className="h-9 text-sm"
              placeholder="Ex: Bon trimestre, continuez ainsi"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>
        )}

        <div className="flex-1 bg-slate-200 min-h-0">
          {dataList.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">Aucune note disponible pour cet élève.</p>
          ) : isGenerating || !previewUrl ? (
            <div className="h-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération du PDF…
            </div>
          ) : (
            <iframe title="Aperçu du bulletin" src={previewUrl} className="w-full h-full border-0" />
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button onClick={handleDownloadPdf} className="gap-2" disabled={!pdfDoc || isGenerating}>
            <Download className="h-4 w-4" />
            Télécharger le PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ElementaryBulletinModal;
