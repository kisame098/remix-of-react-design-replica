import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { ElementaryStudentRanking } from '@/hooks/useElementaryClassRanking';
import {
  BulletinStudentInfo, BulletinSchoolInfo,
  PAGE_W, PAGE_H, MARGIN, GREY_HEADER,
  formatDate, drawFlag, drawSchoolEmblem, labelValue, bracketCorners,
} from '@/lib/bulletinPdf';
import { ElementaryDomaine, ElementaryRegistre, DOMAINE_LABELS, REGISTRE_LABELS } from '@/lib/elementaryDefaults';

// ─── Bulletin élémentaire (CI-CM2) — même moteur de dessin jsPDF que le
// bulletin collège/lycée (drapeau, emblème/logo école, encadrés à coins,
// QR codes) mais un tableau adapté au système à barème de points (pas de
// coefficients) : une discipline = Domaine·Libellé·Barème·Points obtenus,
// groupée par registre (Compétence puis Ressources) avec sous-total vs le
// barème attendu, puis MOYENNE/10 globale — voir useElementaryClassRanking
// pour la formule (Σ points obtenus × 10 / Σ points max des disciplines saisies).

export interface ElementaryBulletinLine {
  name: string;
  domaine: ElementaryDomaine;
  registre: ElementaryRegistre;
  pointMax: number;
  pointsObtenus?: number;
}

export interface ElementaryBulletinPdfData {
  school: BulletinSchoolInfo;
  yearLabel: string;
  periodName: string;
  niveau: string;
  className: string;
  effectif: number;
  student: BulletinStudentInfo;
  ranking: ElementaryStudentRanking;
  lines: ElementaryBulletinLine[];
  competenceTotal: { obtenus: number; max: number };
  ressourcesTotal: { obtenus: number; max: number };
  absencesCount: number;
  justifiedAbsencesCount: number;
  retardsCount: number;
  annualAverage?: { label: string; average: number; rank: number; classSize: number };
  /** "Admis en classe supérieure" ou "Redouble" — undefined hors bulletin de fin d'année, ou sans moyenne annuelle. */
  decisionPassage?: string;
  observations?: string;
}

const DOMAINE_CODES: Record<ElementaryDomaine, string> = { LC: 'L&C', MATH: 'MATH', ESVS: 'ESVS', EPSA: 'EPSA' };

// Appréciation calibrée sur un pourcentage (0-100) plutôt que sur une échelle
// fixe : le barème varie d'une discipline à l'autre (10 à 60 pts), donc seul
// le taux de réussite est comparable d'une discipline à l'autre et avec la
// moyenne globale (moyenne/10 × 10 = le même pourcentage).
const appreciationPct = (pct: number | undefined): string => {
  if (pct === undefined) return '—';
  if (pct >= 90) return 'Excellent';
  if (pct >= 80) return 'Très Bien';
  if (pct >= 70) return 'Bien';
  if (pct >= 60) return 'Assez Bien';
  if (pct >= 50) return 'Passable';
  if (pct >= 40) return 'Insuffisant';
  if (pct >= 25) return 'Très Insuffisant';
  return 'Très Médiocre';
};

export async function drawElementaryBulletinPage(doc: jsPDF, data: ElementaryBulletinPdfData): Promise<void> {
  const {
    school, yearLabel, periodName, niveau, className, effectif,
    student, ranking, lines, competenceTotal, ressourcesTotal,
    absencesCount, justifiedAbsencesCount, retardsCount, annualAverage, decisionPassage, observations,
  } = data;

  doc.setTextColor('#000000');

  // ---------- En-tête (identique au bulletin collège/lycée) ----------
  const flagW = 26, flagH = 17;
  drawFlag(doc, MARGIN, MARGIN, flagW, flagH);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('République du Sénégal', PAGE_W / 2, MARGIN + 4, { align: 'center' });
  doc.text("Ministère de l'Education nationale", PAGE_W / 2, MARGIN + 8, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(school.name.toUpperCase(), PAGE_W / 2, MARGIN + 12.5, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`ANNEE SCOLAIRE : ${yearLabel}`, PAGE_W / 2, MARGIN + 16.5, { align: 'center' });

  const emblemW = 20, emblemH = 17;
  drawSchoolEmblem(doc, school, PAGE_W - MARGIN - emblemW, MARGIN, emblemW, emblemH);

  let y = MARGIN + flagH + 6;

  // ---------- Encadré infos ----------
  const boxH = 30;
  const colW = (PAGE_W - 2 * MARGIN - 6) / 2;
  const leftX = MARGIN, rightX = MARGIN + colW + 6;
  bracketCorners(doc, leftX, y, colW, boxH);
  bracketCorners(doc, rightX, y, colW, boxH);

  let ly = y + 5;
  labelValue(doc, leftX + 2, ly, 'Tél.', school.phone ?? '—'); ly += 5.5;
  labelValue(doc, leftX + 2, ly, 'Email', school.email ?? '—'); ly += 5.5;
  labelValue(doc, leftX + 2, ly, 'Niveau', niveau || '—'); ly += 5.5;
  labelValue(doc, leftX + 2, ly, 'Effectif', String(effectif)); ly += 5.5;
  labelValue(doc, leftX + 2, ly, 'Moyenne /10', ranking.average !== undefined ? ranking.average.toFixed(2) : '—');

  let ry = y + 5;
  labelValue(doc, rightX + 2, ry, 'Classe', className);
  labelValue(doc, rightX + 2 + 45, ry, 'Sexe', student.sex === 'femme' ? 'FÉMININ' : student.sex === 'homme' ? 'MASCULIN' : '—'); ry += 5.5;
  labelValue(doc, rightX + 2, ry, 'Code élève', student.studentId); ry += 5.5;
  labelValue(doc, rightX + 2, ry, 'Prénom(s)', student.firstName); ry += 5.5;
  labelValue(doc, rightX + 2, ry, 'Nom', student.lastName); ry += 5.5;
  labelValue(
    doc, rightX + 2, ry, 'Né(e) le',
    student.dateOfBirth ? `${formatDate(student.dateOfBirth)}${student.placeOfBirth ? ` à ${student.placeOfBirth}` : ''}` : '—',
  );

  y = y + boxH + 8;

  // ---------- Titre de période ----------
  doc.setFillColor(GREY_HEADER);
  doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`BULLETIN DU ${periodName.toUpperCase()}`, PAGE_W / 2, y + 5, { align: 'center' });
  y += 7 + 3;

  // ---------- Tableau des disciplines (groupé Compétence puis Ressources) ----------
  const headers = ['Domaine', 'Discipline', 'Barème', 'Points', 'Appréciation'];
  const colWidths = [16, 75, 16, 16, 57];
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const rowH = 5;
  const tableTop = y;

  doc.setFillColor(GREY_HEADER);
  doc.rect(MARGIN, y, tableW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  let cx = MARGIN;
  headers.forEach((h, i) => {
    if (i === 1) doc.text(h, cx + 2, y + 3.6);
    else doc.text(h, cx + colWidths[i] / 2, y + 3.6, { align: 'center' });
    cx += colWidths[i];
  });
  y += rowH;

  // Plages verticales occupées par des lignes de disciplines, pour n'y tracer
  // les séparateurs de colonnes QUE là.
  const plagesDisciplines: [number, number][] = [];

  const drawRegistreBlock = (registre: ElementaryRegistre, total: { obtenus: number; max: number }) => {
    const rows = lines.filter(l => l.registre === registre);
    if (rows.length === 0) return;

    doc.setFillColor('#EFEFEF');
    doc.rect(MARGIN, y, tableW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(REGISTRE_LABELS[registre].toUpperCase(), MARGIN + 2, y + 3.6);
    y += rowH;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    // Début des lignes de disciplines : c'est la SEULE plage où les
    // séparateurs de colonnes ont un sens. Les bandeaux de registre et les
    // lignes de total portent un libellé qui court sur plusieurs colonnes —
    // un trait continu les barrerait en plein milieu du texte.
    const debutDisciplines = y;
    rows.forEach(l => {
      const pct = l.pointsObtenus !== undefined ? (l.pointsObtenus / l.pointMax) * 100 : undefined;
      const vals = [
        DOMAINE_CODES[l.domaine],
        l.name,
        String(l.pointMax),
        l.pointsObtenus !== undefined ? String(l.pointsObtenus) : '—',
        appreciationPct(pct),
      ];
      cx = MARGIN;
      vals.forEach((v, i) => {
        const text = i === 1 ? doc.splitTextToSize(v, colWidths[1] - 3)[0] : v;
        if (i === 1) doc.text(text, cx + 2, y + 3.6);
        else doc.text(v, cx + colWidths[i] / 2, y + 3.6, { align: 'center' });
        cx += colWidths[i];
      });
      y += rowH;
    });
    plagesDisciplines.push([debutDisciplines, y]);

    doc.setFillColor(GREY_HEADER);
    doc.rect(MARGIN, y, tableW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`Sous-total ${REGISTRE_LABELS[registre]}`, MARGIN + 2, y + 3.6);
    cx = MARGIN + colWidths[0] + colWidths[1];
    doc.text(String(total.max), cx + colWidths[2] / 2, y + 3.6, { align: 'center' });
    cx += colWidths[2];
    doc.text(String(total.obtenus), cx + colWidths[3] / 2, y + 3.6, { align: 'center' });
    y += rowH;
  };

  drawRegistreBlock('COMPETENCE', competenceTotal);
  drawRegistreBlock('RESSOURCES', ressourcesTotal);

  const grandMax = competenceTotal.max + ressourcesTotal.max;
  const grandObtenus = competenceTotal.obtenus + ressourcesTotal.obtenus;
  doc.setFillColor('#333333');
  doc.rect(MARGIN, y, tableW, rowH, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('TOTAL GÉNÉRAL', MARGIN + 2, y + 3.6);
  cx = MARGIN + colWidths[0] + colWidths[1];
  doc.text(String(grandMax), cx + colWidths[2] / 2, y + 3.6, { align: 'center' });
  cx += colWidths[2];
  doc.text(String(grandObtenus), cx + colWidths[3] / 2, y + 3.6, { align: 'center' });
  cx += colWidths[3];
  doc.text(ranking.average !== undefined ? `${ranking.average.toFixed(2)} / 10` : '—', cx + colWidths[4] / 2, y + 3.6, { align: 'center' });
  y += rowH;
  doc.setTextColor('#000000');

  const tableBottom = y;
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, tableTop, tableW, tableBottom - tableTop, 'S');
  // Séparateurs de colonnes DISCONTINUS : un segment par bloc de disciplines,
  // interrompu sur les bandeaux de registre, les sous-totaux et le total
  // général — dont les libellés courent sur plusieurs colonnes.
  cx = MARGIN;
  doc.setDrawColor('#999999');
  doc.setLineWidth(0.15);
  colWidths.forEach((w, i) => {
    // On saute le premier bord (i === 0) : c'est celui du cadre extérieur.
    if (i > 0) {
      for (const [haut, bas] of plagesDisciplines) doc.line(cx, haut, cx, bas);
    }
    cx += w;
  });

  y = tableBottom + 8;

  // ---------- Ligne de synthèse ----------
  labelValue(doc, MARGIN, y, 'Moyenne', ranking.average !== undefined ? `${ranking.average.toFixed(2)} / 10` : '—');
  labelValue(doc, MARGIN + 45, y, 'Rang', ranking.average !== undefined ? `${ranking.rank}/${effectif}` : '—');
  labelValue(doc, MARGIN + 80, y, 'Retards', String(retardsCount));
  labelValue(doc, MARGIN + 115, y, 'Absences', `${absencesCount} dont ${justifiedAbsencesCount} justifiée(s)`);
  y += 7;

  if (annualAverage) {
    labelValue(doc, MARGIN, y, annualAverage.label, `${annualAverage.average.toFixed(2)} / 10`);
    labelValue(doc, MARGIN + 70, y, 'Rang', `${annualAverage.rank}/${annualAverage.classSize}`);
    y += 7;
  }

  if (decisionPassage) {
    labelValue(doc, MARGIN, y, 'Décision', decisionPassage);
    y += 7;
  }

  y += 3;

  // ---------- Observations ----------
  const obsH = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Observations du conseil des maîtres', MARGIN, y - 1);
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, obsH, 'S');
  if (observations) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const obsLines = doc.splitTextToSize(observations, PAGE_W - 2 * MARGIN - 4);
    doc.text(obsLines, MARGIN + 2, y + 5);
  }
  y += obsH + 12;

  doc.setDrawColor('#000000');
  doc.setLineWidth(0.3);
  doc.line(PAGE_W - MARGIN - 45, y - 4, PAGE_W - MARGIN, y - 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text("Le Chef d'établissement", PAGE_W - MARGIN, y, { align: 'right' });

  // ---------- Pied de page : QR codes + note ----------
  const qrSize = 22;
  const bandH = 5;
  const bandY = PAGE_H - MARGIN - bandH;
  const noteY = bandY - 6;
  const qrY = noteY - 6 - qrSize;

  const infoText = `${student.lastName} ${student.firstName} — ${student.studentId} — ${className}`;
  const bulletinText = `Bulletin ${periodName} — Moyenne ${ranking.average !== undefined ? ranking.average.toFixed(2) : '—'}/10`;

  try {
    const [qr1, qr2] = await Promise.all([
      QRCode.toDataURL(infoText, { margin: 1, width: 200 }),
      QRCode.toDataURL(bulletinText, { margin: 1, width: 200 }),
    ]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Informations Élève', MARGIN, qrY - 2);
    doc.text('Résumé du bulletin', PAGE_W - MARGIN, qrY - 2, { align: 'right' });
    doc.addImage(qr1, 'PNG', MARGIN, qrY, qrSize, qrSize);
    doc.addImage(qr2, 'PNG', PAGE_W - MARGIN - qrSize, qrY, qrSize, qrSize);
  } catch {
    // Décoratif — la génération du PDF ne doit jamais échouer à cause d'un QR.
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('N.B. :', MARGIN, noteY);
  const nbw = doc.getTextWidth('N.B. : ');
  doc.setFont('helvetica', 'normal');
  doc.text(
    "Ce bulletin n'est délivré qu'une seule fois. Toute demande de duplicata pourrait faire l'objet d'une contrepartie financière.",
    MARGIN + nbw, noteY,
  );

  doc.setFillColor(GREY_HEADER);
  doc.rect(MARGIN, bandY, PAGE_W - 2 * MARGIN, bandH, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor('#000000');
  const editedAt = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text(`Ce bulletin est édité le ${editedAt}`, PAGE_W / 2, bandY + bandH - 1.5, { align: 'center' });
}

export async function generateElementaryBulletinsPdf(dataList: ElementaryBulletinPdfData[]): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  for (let i = 0; i < dataList.length; i++) {
    if (i > 0) doc.addPage();
    await drawElementaryBulletinPage(doc, dataList[i]);
  }
  return doc;
}
