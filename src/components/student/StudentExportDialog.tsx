import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { Student, SchoolClass } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { buildCsv, sanitizeFilename } from '@/lib/csvExport';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Download, GripVertical } from 'lucide-react';

// ─── Export personnalisé de la liste des élèves ────────────────────────────
// Colonnes cochables + colonnes libres ajoutées par l'utilisateur (ex: une
// colonne "Signature" vide à imprimer et faire remplir à la main) — export en
// PDF (mise en page imprimable, en-tête avec le nom de l'école) ou en CSV
// (s'ouvre nativement dans Excel/Google Sheets, aucune dépendance supplémentaire).

type BuiltinColumnKey =
  | 'numero' | 'studentId' | 'lastName' | 'firstName' | 'sex' | 'dateOfBirth'
  | 'placeOfBirth' | 'className' | 'phone' | 'email' | 'residence'
  | 'tutor1Name' | 'tutor1Phone' | 'tutor2Name' | 'tutor2Phone';

interface BuiltinColumnDef {
  key: BuiltinColumnKey;
  label: string;
  defaultOn: boolean;
  width: number; // poids relatif de largeur pour le PDF
  getValue: (s: Student, classes: SchoolClass[]) => string;
}

const BUILTIN_COLUMNS: BuiltinColumnDef[] = [
  { key: 'numero',       label: 'N°',                  defaultOn: true,  width: 0.5, getValue: () => '' },
  { key: 'studentId',    label: 'Code élève',           defaultOn: true,  width: 1.3, getValue: s => s.studentId },
  { key: 'lastName',     label: 'Nom',                  defaultOn: true,  width: 1.4, getValue: s => s.lastName },
  { key: 'firstName',    label: 'Prénom',               defaultOn: true,  width: 1.4, getValue: s => s.firstName },
  { key: 'sex',          label: 'Sexe',                 defaultOn: false, width: 0.8, getValue: s => s.sex === 'homme' ? 'Masculin' : 'Féminin' },
  { key: 'dateOfBirth',  label: 'Date de naissance',    defaultOn: false, width: 1.2, getValue: s => s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('fr-FR') : '' },
  { key: 'placeOfBirth', label: 'Lieu de naissance',    defaultOn: false, width: 1.3, getValue: s => s.placeOfBirth ?? '' },
  { key: 'className',    label: 'Classe',               defaultOn: false, width: 1.0, getValue: (s, classes) => classes.find(c => c.id === s.classId)?.name ?? '' },
  { key: 'phone',        label: 'Téléphone',            defaultOn: false, width: 1.1, getValue: s => s.phone ?? '' },
  { key: 'email',        label: 'Email',                defaultOn: false, width: 1.5, getValue: s => s.email ?? '' },
  { key: 'residence',    label: 'Résidence',            defaultOn: false, width: 1.3, getValue: s => s.residence ?? '' },
  { key: 'tutor1Name',   label: 'Tuteur 1 — Nom',       defaultOn: false, width: 1.3, getValue: s => s.tutor1?.fullName ?? '' },
  { key: 'tutor1Phone',  label: 'Tuteur 1 — Téléphone', defaultOn: false, width: 1.1, getValue: s => s.tutor1?.phone ?? '' },
  { key: 'tutor2Name',   label: 'Tuteur 2 — Nom',       defaultOn: false, width: 1.3, getValue: s => s.tutor2?.fullName ?? '' },
  { key: 'tutor2Phone',  label: 'Tuteur 2 — Téléphone', defaultOn: false, width: 1.1, getValue: s => s.tutor2?.phone ?? '' },
];

type SortKey = 'lastName' | 'firstName' | 'studentId' | 'createdAt';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'lastName', label: 'Nom (A→Z)' },
  { key: 'firstName', label: 'Prénom (A→Z)' },
  { key: 'studentId', label: 'Code élève' },
  { key: 'createdAt', label: "Ordre d'inscription" },
];

interface CustomColumn { id: string; label: string; }

interface StudentExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  classes: SchoolClass[];
  /** Nom de la classe si le filtre courant cible une classe précise, sinon undefined (= toute l'école). */
  currentClassName?: string;
}

const StudentExportDialog = ({ open, onOpenChange, students, classes, currentClassName }: StudentExportDialogProps) => {
  const { school } = useAuth();
  const { currentYear } = useSchoolYear();

  const defaultTitle = currentClassName
    ? `Liste des élèves de la classe de ${currentClassName}`
    : "Liste des élèves de l'établissement";

  const [title, setTitle] = useState(defaultTitle);
  const [selectedColumns, setSelectedColumns] = useState<Set<BuiltinColumnKey>>(
    new Set(BUILTIN_COLUMNS.filter(c => c.defaultOn).map(c => c.key)),
  );
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastName');
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const toggleColumn = (key: BuiltinColumnKey) => {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const addCustomColumn = () => {
    if (!newCustomLabel.trim()) return;
    setCustomColumns(prev => [...prev, { id: crypto.randomUUID(), label: newCustomLabel.trim() }]);
    setNewCustomLabel('');
  };
  const removeCustomColumn = (id: string) => setCustomColumns(prev => prev.filter(c => c.id !== id));

  const sortedStudents = useMemo(() => {
    const copy = [...students];
    copy.sort((a, b) => {
      if (sortKey === 'createdAt') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortKey === 'studentId') return a.studentId.localeCompare(b.studentId);
      return a[sortKey].localeCompare(b[sortKey]);
    });
    return copy;
  }, [students, sortKey]);

  const activeBuiltinColumns = BUILTIN_COLUMNS.filter(c => selectedColumns.has(c.key));

  const buildRows = (): { headers: string[]; rows: string[][] } => {
    const headers = [
      ...activeBuiltinColumns.map(c => c.label),
      ...customColumns.map(c => c.label),
    ];
    const rows = sortedStudents.map((s, i) => [
      ...activeBuiltinColumns.map(c => c.key === 'numero' ? String(i + 1) : c.getValue(s, classes)),
      ...customColumns.map(() => ''),
    ]);
    return { headers, rows };
  };

  const handleExportCsv = () => {
    const { headers, rows } = buildRows();
    const blob = new Blob([buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(title)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const { headers, rows } = buildRows();
    const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const usableWidth = pageWidth - marginX * 2;

    const weights = [
      ...activeBuiltinColumns.map(c => c.width),
      ...customColumns.map(() => 1.4),
    ];
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
    const colWidths = weights.map(w => (w / totalWeight) * usableWidth);

    let y = 0;
    const drawDocHeader = () => {
      y = 15;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(school?.name ?? 'École', pageWidth / 2, y, { align: 'center' });
      y += 7;
      doc.setFontSize(11);
      doc.text(title, pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(110);
      const meta = [
        currentYear?.name ? `Année scolaire : ${currentYear.name}` : null,
        `${sortedStudents.length} élève${sortedStudents.length !== 1 ? 's' : ''}`,
        `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
      ].filter(Boolean).join('   ·   ');
      doc.text(meta, pageWidth / 2, y, { align: 'center' });
      doc.setTextColor(0);
      y += 6;
    };

    const rowHeight = 8;
    const drawTableHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setFillColor(245, 158, 11);
      doc.setTextColor(255);
      doc.rect(marginX, y, usableWidth, rowHeight, 'F');
      let x = marginX;
      headers.forEach((h, i) => {
        doc.text(h, x + 1.5, y + rowHeight - 2.5, { maxWidth: colWidths[i] - 3 });
        x += colWidths[i];
      });
      doc.setTextColor(0);
      y += rowHeight;
    };

    drawDocHeader();
    drawTableHeader();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    rows.forEach((row, rowIndex) => {
      if (y + rowHeight > pageHeight - 15) {
        doc.addPage();
        y = 15;
        drawTableHeader();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
      }
      if (rowIndex % 2 === 1) {
        doc.setFillColor(248, 249, 250);
        doc.rect(marginX, y, usableWidth, rowHeight, 'F');
      }
      let x = marginX;
      row.forEach((cell, i) => {
        doc.text(cell, x + 1.5, y + rowHeight - 2.5, { maxWidth: colWidths[i] - 3 });
        x += colWidths[i];
      });
      // Ligne de séparation + bordure de cellule vide pour les colonnes libres à remplir à la main
      doc.setDrawColor(220);
      doc.line(marginX, y + rowHeight, marginX + usableWidth, y + rowHeight);
      y += rowHeight;
    });

    doc.save(`${sanitizeFilename(title)}.pdf`);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (format === 'csv') handleExportCsv();
      else handleExportPdf();
      onOpenChange(false);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exporter la liste des élèves</DialogTitle>
          <DialogDescription>
            {students.length} élève{students.length !== 1 ? 's' : ''} seront inclus — choisissez les colonnes, l'ordre et le format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>Titre du document</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Colonnes</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg max-h-48 overflow-y-auto">
              {BUILTIN_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedColumns.has(col.key)} onCheckedChange={() => toggleColumn(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Colonnes personnalisées (vides, à remplir à la main — ex: Signature)</Label>
            {customColumns.length > 0 && (
              <ul className="space-y-1.5">
                {customColumns.map(c => (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1">{c.label}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCustomColumn(c.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Ex: Signature"
                value={newCustomLabel}
                onChange={(e) => setNewCustomLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomColumn())}
              />
              <Button type="button" variant="outline" size="sm" className="gap-1.5 flex-shrink-0" onClick={addCustomColumn}>
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Trier par</Label>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'pdf' | 'csv')} className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="pdf" /> PDF
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="csv" /> Excel (CSV)
                </label>
              </RadioGroup>
            </div>
          </div>

          <Button onClick={handleExport} className="w-full gap-2" disabled={isExporting || (selectedColumns.size === 0 && customColumns.length === 0)}>
            <Download className="h-4 w-4" />
            Exporter {students.length} élève{students.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentExportDialog;
