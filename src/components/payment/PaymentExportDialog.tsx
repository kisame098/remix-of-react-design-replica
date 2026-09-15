import { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { Student, SchoolClass } from '@/contexts/SchoolContext';
import { Payment, PAYMENT_METHOD_LABELS } from '@/types/payment';
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

// ─── Export de la liste "qui a payé / qui n'a pas payé" ────────────────────
// Reprend exactement les lignes déjà calculées par PaymentTracking (même
// filtre classe/mois/service, même logique payé/non payé) — jamais recalculé
// séparément, pour ne jamais afficher un statut différent de ce que l'écran
// montre déjà.

export interface PaymentTrackingRow {
  student: Student;
  paid: boolean;
  amount: number;
  overdue: boolean;
  payment?: Payment;
}

type BuiltinColumnKey =
  | 'numero' | 'studentId' | 'lastName' | 'firstName' | 'className' | 'status'
  | 'amount' | 'paidAt' | 'method' | 'reference';

interface BuiltinColumnDef {
  key: BuiltinColumnKey;
  label: string;
  defaultOn: boolean;
  width: number;
  getValue: (r: PaymentTrackingRow, classes: SchoolClass[]) => string;
}

const fmtAmount = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

const BUILTIN_COLUMNS: BuiltinColumnDef[] = [
  { key: 'numero',    label: 'N°',            defaultOn: true,  width: 0.5, getValue: () => '' },
  { key: 'studentId', label: 'Code élève',     defaultOn: true,  width: 1.3, getValue: r => r.student.studentId },
  { key: 'lastName',  label: 'Nom',            defaultOn: true,  width: 1.4, getValue: r => r.student.lastName },
  { key: 'firstName', label: 'Prénom',         defaultOn: true,  width: 1.4, getValue: r => r.student.firstName },
  { key: 'className', label: 'Classe',         defaultOn: true,  width: 1.0, getValue: (r, classes) => classes.find(c => c.id === r.student.classId)?.name ?? '' },
  { key: 'status',    label: 'Statut',         defaultOn: true,  width: 1.0, getValue: r => r.paid ? 'Payé' : (r.overdue ? 'En retard' : 'Non payé') },
  { key: 'amount',    label: 'Montant',        defaultOn: true,  width: 1.0, getValue: r => fmtAmount(r.amount) },
  { key: 'paidAt',    label: 'Date de paiement', defaultOn: false, width: 1.2, getValue: r => r.payment ? new Date(r.payment.paidAt).toLocaleDateString('fr-FR') : '' },
  { key: 'method',    label: 'Méthode',        defaultOn: false, width: 1.0, getValue: r => r.payment ? PAYMENT_METHOD_LABELS[r.payment.method] : '' },
  { key: 'reference', label: 'Référence',      defaultOn: false, width: 1.2, getValue: r => r.payment?.reference ?? '' },
];

type SortKey = 'lastName' | 'firstName' | 'studentId' | 'status';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'lastName', label: 'Nom (A→Z)' },
  { key: 'firstName', label: 'Prénom (A→Z)' },
  { key: 'studentId', label: 'Code élève' },
  { key: 'status', label: 'Statut (payé d\'abord)' },
];

type StatusFilter = 'all' | 'paid' | 'unpaid';

interface CustomColumn { id: string; label: string; }

interface PaymentExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: PaymentTrackingRow[];
  classes: SchoolClass[];
  /** Objet exact de l'export (ex: "Scolarité — Septembre 2026", "Frais d'inscription", "Cantine — Octobre 2026") — toujours affiché en bannière dans l'entête du document, indépendamment du titre personnalisable. */
  itemLabel: string;
  className?: string;
}

const PaymentExportDialog = ({ open, onOpenChange, rows, classes, itemLabel, className }: PaymentExportDialogProps) => {
  const { school } = useAuth();
  const { currentYear } = useSchoolYear();

  const defaultTitle = `Liste des paiements — ${itemLabel}${className ? ` — ${className}` : ''}`;

  const [title, setTitle] = useState(defaultTitle);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

  const filteredRows = useMemo(() => {
    if (statusFilter === 'paid') return rows.filter(r => r.paid);
    if (statusFilter === 'unpaid') return rows.filter(r => !r.paid);
    return rows;
  }, [rows, statusFilter]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      if (sortKey === 'status') return (a.paid === b.paid) ? 0 : (a.paid ? 1 : -1);
      if (sortKey === 'studentId') return a.student.studentId.localeCompare(b.student.studentId);
      return a.student[sortKey].localeCompare(b.student[sortKey]);
    });
    return copy;
  }, [filteredRows, sortKey]);

  const activeBuiltinColumns = BUILTIN_COLUMNS.filter(c => selectedColumns.has(c.key));

  const buildRows = (): { headers: string[]; dataRows: string[][] } => {
    const headers = [
      ...activeBuiltinColumns.map(c => c.label),
      ...customColumns.map(c => c.label),
    ];
    const dataRows = sortedRows.map((r, i) => [
      ...activeBuiltinColumns.map(c => {
        if (c.key === 'numero') return String(i + 1);
        return c.getValue(r, classes);
      }),
      ...customColumns.map(() => ''),
    ]);
    return { headers, dataRows };
  };

  const handleExportCsv = () => {
    const { headers, dataRows } = buildRows();
    const bannerText = `${itemLabel}${className ? ' — ' + className : ''}`;
    const blob = new Blob([buildCsv(headers, dataRows, [bannerText])], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(title)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const { headers, dataRows } = buildRows();
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
    const bannerText = `${itemLabel}${className ? ' · ' + className : ''}`.toUpperCase();
    const drawDocHeader = () => {
      y = 15;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(school?.name ?? 'École', pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(title, pageWidth / 2, y, { align: 'center' });
      doc.setTextColor(0);
      y += 5;

      // Bannière proéminente : l'objet exact de l'export (mois de scolarité, service, ou
      // inscription), toujours affichée en clair — indépendante du titre personnalisable ci-dessus.
      const bannerHeight = 9;
      doc.setFillColor(217, 119, 6);
      doc.rect(marginX, y, usableWidth, bannerHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(255);
      doc.text(bannerText, pageWidth / 2, y + bannerHeight - 3, { align: 'center', maxWidth: usableWidth - 6 });
      doc.setTextColor(0);
      y += bannerHeight + 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(110);
      const paidInView = sortedRows.filter(r => r.paid).length;
      const meta = [
        currentYear?.name ? `Année scolaire : ${currentYear.name}` : null,
        `${sortedRows.length} élève${sortedRows.length !== 1 ? 's' : ''} — ${paidInView} payé(s), ${sortedRows.length - paidInView} non payé(s)`,
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

    dataRows.forEach((row, rowIndex) => {
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
          <DialogTitle>Exporter — {itemLabel}</DialogTitle>
          <DialogDescription>
            {sortedRows.length} élève{sortedRows.length !== 1 ? 's' : ''} dans cette sélection — choisissez qui inclure, les colonnes et le format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>Élèves à inclure</Label>
            <RadioGroup value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)} className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="all" /> Tous ({rows.length})
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="paid" /> Payé seulement ({rows.filter(r => r.paid).length})
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="unpaid" /> Non payé seulement ({rows.filter(r => !r.paid).length})
              </label>
            </RadioGroup>
          </div>

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
            <Label>Colonnes personnalisées (vides, à remplir à la main)</Label>
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
                placeholder="Ex: Émargement"
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

          <Button onClick={handleExport} className="w-full gap-2" disabled={isExporting || sortedRows.length === 0 || (selectedColumns.size === 0 && customColumns.length === 0)}>
            <Download className="h-4 w-4" />
            Exporter {sortedRows.length} élève{sortedRows.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentExportDialog;
