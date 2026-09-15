import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { StudentRanking } from '@/hooks/useClassRanking';
import {
  RANKING_EXPORT_COLUMNS, RankingExportColumnKey, RankingExportRow, generateRankingExportPdf,
} from '@/lib/rankingExportPdf';

interface ExportRankingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  classId: string;
  rankings: StudentRanking[];
}

const sanitize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');

const ExportRankingDialog = ({ open, onOpenChange, periodId, classId, rankings }: ExportRankingDialogProps) => {
  const { classes, gradePeriods, students } = useSchool();
  const { currentYear } = useSchoolYear();
  const { school } = useAuth();

  const [selected, setSelected] = useState<Set<RankingExportColumnKey>>(
    () => new Set(RANKING_EXPORT_COLUMNS.filter(c => c.defaultChecked).map(c => c.key))
  );

  const schoolClass = classes.find(c => c.id === classId);
  const period = gradePeriods.find(p => p.id === periodId);
  const yearLabel = currentYear?.name.match(/\d{4}\s*-\s*\d{4}/)?.[0] ?? currentYear?.name ?? '';

  const toggleColumn = (key: RankingExportColumnKey, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  };

  const rows: RankingExportRow[] = useMemo(() => rankings.map(r => {
    const student = students.find(s => s.id === r.studentId);
    return {
      rank: r.rank,
      studentCode: r.studentCode,
      lastName: r.lastName,
      firstName: r.firstName,
      dateOfBirth: student?.dateOfBirth,
      placeOfBirth: student?.placeOfBirth,
      average: r.averageGeneral,
    };
  }), [rankings, students]);

  const handleDownload = () => {
    if (!schoolClass || !period || selected.size === 0) return;
    const columnKeys = RANKING_EXPORT_COLUMNS.map(c => c.key).filter(k => selected.has(k));
    const doc = generateRankingExportPdf({
      schoolName: school?.name ?? 'École',
      className: schoolClass.name,
      periodName: period.name,
      yearLabel,
      rows,
      columnKeys,
    });
    doc.save(`${sanitize(`Classement_${schoolClass.name}_${period.name}`)}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exporter le classement</DialogTitle>
          <DialogDescription>
            Choisissez les colonnes à inclure — utile pour un classement affiché à l'école (ex: Bac Blanc en Terminale).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 py-2">
          {RANKING_EXPORT_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border hover:bg-muted/50 transition-colors">
              <Checkbox
                checked={selected.has(col.key)}
                onCheckedChange={(v) => toggleColumn(col.key, v === true)}
              />
              <span className="text-sm">{col.label}</span>
            </label>
          ))}
        </div>

        {selected.has('mention') && (
          <p className="text-xs text-muted-foreground -mt-1">
            Mentions selon le barème officiel du Bac sénégalais : Passable (10-11.99), Assez Bien (12-13.99),
            Bien (14-15.99), Très Bien (≥16).
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="gap-2" onClick={handleDownload} disabled={selected.size === 0 || rows.length === 0}>
            <Download className="h-4 w-4" />
            Télécharger le PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportRankingDialog;
