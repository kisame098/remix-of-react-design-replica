import jsPDF from 'jspdf';
import { drawFlag } from '@/lib/bulletinPdf';
import { computeBacMention } from '@/lib/bacMention';

// ─── Export du classement — colonnes au choix ───────────────────────────────
// Pour les écoles qui affichent/impriment leur classement (ex: après un Bac
// Blanc en Terminale) : une seule feuille A4 paysage, colonnes choisies par
// l'utilisateur (Rang, Code, Nom, Prénom, Date/Lieu de naissance, Moyenne,
// Mention). Paginé automatiquement si la classe est grande.

export type RankingExportColumnKey =
  | 'rang' | 'code' | 'nom' | 'prenom' | 'dateNaissance' | 'lieuNaissance' | 'moyenne' | 'mention';

export interface RankingExportColumnDef {
  key: RankingExportColumnKey;
  label: string;
  defaultChecked: boolean;
  /** Largeur de base (mm) — mise à l'échelle pour occuper toute la largeur disponible. */
  baseWidth: number;
}

export const RANKING_EXPORT_COLUMNS: RankingExportColumnDef[] = [
  { key: 'rang',          label: 'Rang',                 defaultChecked: true,  baseWidth: 18 },
  { key: 'code',          label: 'Code élève',           defaultChecked: true,  baseWidth: 30 },
  { key: 'nom',           label: 'Nom',                  defaultChecked: true,  baseWidth: 40 },
  { key: 'prenom',        label: 'Prénom',                defaultChecked: true,  baseWidth: 40 },
  { key: 'dateNaissance', label: 'Date de naissance',    defaultChecked: false, baseWidth: 30 },
  { key: 'lieuNaissance', label: 'Lieu de naissance',    defaultChecked: false, baseWidth: 45 },
  { key: 'moyenne',       label: 'Moyenne',               defaultChecked: true,  baseWidth: 24 },
  { key: 'mention',       label: 'Mention',               defaultChecked: false, baseWidth: 40 },
];

export interface RankingExportRow {
  rank: number;
  studentCode: string;
  lastName: string;
  firstName: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  average: number;
}

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return iso; }
};

const cellValue = (col: RankingExportColumnKey, row: RankingExportRow): string => {
  switch (col) {
    case 'rang': return String(row.rank);
    case 'code': return row.studentCode;
    case 'nom': return row.lastName;
    case 'prenom': return row.firstName;
    case 'dateNaissance': return formatDate(row.dateOfBirth);
    case 'lieuNaissance': return row.placeOfBirth || '—';
    case 'moyenne': return row.average.toFixed(2);
    case 'mention': return computeBacMention(row.average);
  }
};

const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 15;
const GREY_HEADER = '#D9D9D9';

export function generateRankingExportPdf(params: {
  schoolName: string;
  className: string;
  periodName: string;
  yearLabel: string;
  rows: RankingExportRow[];
  columnKeys: RankingExportColumnKey[];
}): jsPDF {
  const { schoolName, className, periodName, yearLabel, rows, columnKeys } = params;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });

  const columns = RANKING_EXPORT_COLUMNS.filter(c => columnKeys.includes(c.key));
  const availableW = PAGE_W - 2 * MARGIN;
  const baseTotal = columns.reduce((s, c) => s + c.baseWidth, 0) || 1;
  const scale = availableW / baseTotal;
  const colWidths = columns.map(c => c.baseWidth * scale);
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const rowH = 7;

  const drawHeader = () => {
    const flagW = 22, flagH = 14;
    drawFlag(doc, MARGIN, MARGIN, flagW, flagH);
    doc.setTextColor('#000000');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('République du Sénégal', PAGE_W / 2, MARGIN + 3, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(schoolName.toUpperCase(), PAGE_W / 2, MARGIN + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Classement — ${className} — ${periodName} — Année ${yearLabel}`, PAGE_W / 2, MARGIN + 13, { align: 'center' });

    let y = MARGIN + flagH + 6;
    doc.setFillColor(GREY_HEADER);
    doc.rect(MARGIN, y, tableW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    let cx = MARGIN;
    columns.forEach((c, i) => {
      doc.text(c.label, cx + colWidths[i] / 2, y + 4.8, { align: 'center' });
      cx += colWidths[i];
    });
    y += rowH;
    return y;
  };

  let y = drawHeader();
  const bottomLimit = PAGE_H - MARGIN - 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  rows.forEach((row, idx) => {
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = drawHeader();
    }
    if (idx % 2 === 1) {
      doc.setFillColor('#F5F5F5');
      doc.rect(MARGIN, y, tableW, rowH, 'F');
    }
    let cx = MARGIN;
    columns.forEach((c, i) => {
      doc.setFont('helvetica', c.key === 'rang' ? 'bold' : 'normal');
      const text = cellValue(c.key, row);
      doc.text(text, cx + colWidths[i] / 2, y + 4.8, { align: 'center' });
      cx += colWidths[i];
    });
    y += rowH;
  });

  doc.setDrawColor('#000000');
  doc.setLineWidth(0.3);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  const editedAt = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.text(`Édité le ${editedAt}`, MARGIN, PAGE_H - MARGIN + 4);
    doc.text(`Page ${p}/${pageCount}`, PAGE_W - MARGIN, PAGE_H - MARGIN + 4, { align: 'right' });
  }

  return doc;
}
