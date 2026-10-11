import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { StudentRanking } from '@/hooks/useClassRanking';
import type { PeriodRecapCell } from '@/lib/cumulativeAverage';

// ─── Bulletin de notes — génération PDF vectorielle ─────────────────────────
// Dessiné directement avec les primitives de jsPDF (texte, lignes, rectangles,
// cercles — l'équivalent JS d'un canvas reportlab), PAS via une capture HTML.
// Ça élimine les problèmes de fidélité qu'on avait avec l'approche
// HTML/CSS + html2canvas (glyphes mal centrés, rendu qui dépend du navigateur) :
// chaque élément est positionné à une coordonnée mm exacte, une fois pour toutes.

export interface BulletinStudentInfo {
  firstName: string;
  lastName: string;
  studentId: string;
  sex?: 'homme' | 'femme';
  dateOfBirth?: string;
  placeOfBirth?: string;
}

export interface BulletinSchoolInfo {
  name: string;
  phone?: string | null;
  email?: string | null;
  /** Logo de l'école (data URL JPEG, voir Paramètres > École) — affiché à la
   *  place de l'emblème générique quand présent. */
  logoUrl?: string | null;
}

export const MENTIONS_TRAVAIL = [
  'Travail excellent',
  'Satisfaisant, doit continuer',
  'Peut mieux faire',
  'Insuffisant',
  'Risque de redoublement',
  "Risque d'exclusion",
];

export const MENTIONS_HONNEUR = [
  'Félicitations',
  'Encouragements',
  "Tableau d'honneur",
  'Passable',
  "Doit redoubler d'efforts",
  'Avertissement',
  'Blâme',
];

export interface BulletinPdfData {
  school: BulletinSchoolInfo;
  yearLabel: string;
  periodName: string;
  niveau?: string;
  className: string;
  filiereName?: string;
  effectif: number;
  student: BulletinStudentInfo;
  ranking: StudentRanking;
  classRankings: StudentRanking[];
  classAverage: number | null;
  /** Période de type examen — une seule note par matière : le tableau du bulletin n'affiche alors qu'une colonne "Note" (pas Devoirs/Compos/Moy, toujours vides ou redondantes dans ce cas). */
  isExam: boolean;
  /** Absences/retards de l'élève, depuis Gestion des présences, scopés aux dates de la période — 0 si la période n'a pas de dates renseignées. */
  absencesCount: number;
  justifiedAbsencesCount: number;
  retardsCount: number;
  /** Moyenne annuelle/cumulée (semestres précédents + celui-ci) — absent pour le 1er semestre de l'année ou une période de type examen. */
  annualAverage?: AnnualAverageInfo;
  /** Décision de passage — absente hors bulletin de fin d'année. */
  decisionPassage?: string;
  observations?: string;
}

export interface AnnualAverageInfo {
  label: string;
  average: number;
  rank: number;
  classSize: number;
  /** Moyenne de chaque période cumulée (S1, S2…), imprimée à côté de la
   *  moyenne annuelle. Absente des bulletins publiés avant son ajout : ceux-là
   *  gardent l'ancienne ligne « Moyenne Annuelle — Rang ». */
  periodes?: PeriodRecapCell[];
}

export const PAGE_W = 210;
export const PAGE_H = 297;
export const MARGIN = 15;
export const GREY_HEADER = '#D9D9D9';
const LINE_GREY = '#999999';

export const formatDate = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
};

const appreciation = (moy: number | null): string => {
  if (moy === null) return '—';
  if (moy >= 18) return 'Excellent';
  if (moy >= 16) return 'Très Bien';
  if (moy >= 14) return 'Bien';
  if (moy >= 12) return 'Assez Bien';
  if (moy >= 10) return 'Passable';
  if (moy >= 8) return 'Insuffisant';
  if (moy >= 5) return 'Très Insuffisant';
  if (moy >= 3) return 'Très Médiocre';
  return 'Mal';
};

// Mentions déterminées automatiquement à partir de la moyenne générale — le
// conseil des professeurs n'a plus à les choisir à la main pour chaque bulletin.
const computeMentionTravail = (moyenne: number): string => {
  if (moyenne >= 16) return MENTIONS_TRAVAIL[0]; // Travail excellent
  if (moyenne >= 12) return MENTIONS_TRAVAIL[1]; // Satisfaisant, doit continuer
  if (moyenne >= 10) return MENTIONS_TRAVAIL[2]; // Peut mieux faire
  if (moyenne >= 8) return MENTIONS_TRAVAIL[3]; // Insuffisant
  if (moyenne >= 5) return MENTIONS_TRAVAIL[4]; // Risque de redoublement
  return MENTIONS_TRAVAIL[5]; // Risque d'exclusion
};

const computeMentionHonneur = (moyenne: number): string => {
  if (moyenne >= 16) return MENTIONS_HONNEUR[0]; // Félicitations
  if (moyenne >= 14) return MENTIONS_HONNEUR[1]; // Encouragements
  if (moyenne >= 12) return MENTIONS_HONNEUR[2]; // Tableau d'honneur
  if (moyenne >= 10) return MENTIONS_HONNEUR[3]; // Passable
  if (moyenne >= 8) return MENTIONS_HONNEUR[4]; // Doit redoubler d'efforts
  if (moyenne >= 6) return MENTIONS_HONNEUR[5]; // Avertissement
  return MENTIONS_HONNEUR[6]; // Blâme
};

// Rang de l'élève DANS CHAQUE MATIÈRE (pas le rang général), avec égalités partagées.
const buildSubjectRanks = (classRankings: StudentRanking[]): Map<string, Map<string, number>> => {
  const bySubject = new Map<string, { studentId: string; muMat: number }[]>();
  for (const r of classRankings) {
    for (const s of r.subjectDetails) {
      if (s.muMat === null) continue;
      if (!bySubject.has(s.subjectName)) bySubject.set(s.subjectName, []);
      bySubject.get(s.subjectName)!.push({ studentId: r.studentId, muMat: s.muMat });
    }
  }
  const result = new Map<string, Map<string, number>>();
  for (const [subjectName, entries] of bySubject) {
    entries.sort((a, b) => b.muMat - a.muMat);
    const ranks = new Map<string, number>();
    entries.forEach((e, i) => {
      const rank = i > 0 && entries[i - 1].muMat === e.muMat ? ranks.get(entries[i - 1].studentId)! : i + 1;
      ranks.set(e.studentId, rank);
    });
    result.set(subjectName, ranks);
  }
  return result;
};

// Points d'une étoile à 5 branches, calculés (pas un glyphe de police —
// jamais parfaitement centré selon le rendu).
const starPoints = (cx: number, cy: number, outerR: number, innerR: number): [number, number][] => {
  const pts: [number, number][] = [];
  for (let k = 0; k < 10; k++) {
    const angle = ((-90 + 36 * k) * Math.PI) / 180;
    const r = k % 2 === 0 ? outerR : innerR;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts;
};

const drawStar = (doc: jsPDF, cx: number, cy: number, outerR: number, color: string) => {
  const pts = starPoints(cx, cy, outerR, outerR * 0.382);
  const deltas: [number, number][] = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.setFillColor(color);
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'F', true);
};

export const drawFlag = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  const band = w / 3;
  doc.setFillColor('#00853F'); doc.rect(x, y, band, h, 'F');
  doc.setFillColor('#FDEF42'); doc.rect(x + band, y, band, h, 'F');
  doc.setFillColor('#E31B23'); doc.rect(x + 2 * band, y, band, h, 'F');
  drawStar(doc, x + 1.5 * band, y + h / 2, h * 0.28, '#00853F');
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h, 'S');
};

// Badge décoratif générique (cercles concentriques) affiché quand l'école n'a
// pas encore mis de logo — volontairement abstrait, pas une reprise d'un
// sceau officiel.
const drawEmblem = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  doc.setDrawColor('#1F5FA9');
  doc.setLineWidth(0.35);
  const cx = x + w / 2;
  const cy = y + h / 2;
  [h * 0.44, h * 0.33, h * 0.22].forEach(r => doc.circle(cx, cy, r, 'S'));
};

// Logo de l'école si défini (Paramètres > École — toujours un JPEG carré ou
// rectangulaire compressé côté client), sinon l'emblème générique. Le logo
// est inscrit dans la boîte en conservant ses proportions (jamais déformé).
export const drawSchoolEmblem = (doc: jsPDF, school: BulletinSchoolInfo, x: number, y: number, w: number, h: number) => {
  if (!school.logoUrl) {
    drawEmblem(doc, x, y, w, h);
    return;
  }
  try {
    // fileType détecté depuis les octets réels du fichier (pas juste le
    // préfixe data:...) — logos PNG à fond transparent conservés tels quels.
    const { width: imgW, height: imgH, fileType } = doc.getImageProperties(school.logoUrl);
    const ratio = Math.min(w / imgW, h / imgH);
    const drawW = imgW * ratio;
    const drawH = imgH * ratio;
    doc.addImage(school.logoUrl, fileType, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
  } catch {
    drawEmblem(doc, x, y, w, h);
  }
};

export const labelValue = (doc: jsPDF, x: number, y: number, label: string, value: string, size = 9) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor('#000000');
  doc.text(`${label} :`, x, y);
  const lw = doc.getTextWidth(`${label} : `);
  doc.setFont('helvetica', 'bold');
  doc.text(value, x + lw, y);
};

// Petits crochets aux coins haut-gauche / bas-droit, comme sur les vrais
// bulletins CIME — pas un cadre fermé.
export const bracketCorners = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  const r = 3;
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.3);
  doc.line(x, y, x, y + r);
  doc.line(x, y, x + r, y);
  doc.line(x + w, y + h, x + w, y + h - r);
  doc.line(x + w, y + h, x + w - r, y + h);
};

// ─── Tout tenir sur une page ────────────────────────────────────────────────
// Le pied de page (QR codes, N.B., bandeau d'édition) est ancré en bas ; la
// signature du chef d'établissement doit rester au-dessus des QR codes. Avec
// beaucoup de matières (lycée : 12-14) plus le récapitulatif annuel, la mise
// en page d'origine débordait sur les QR. On essaie donc des gabarits de plus
// en plus serrés et on garde le premier qui tient.

/** Ligne de base la plus basse admise pour « Le Chef d'établissement » :
 *  les libellés des QR codes sont à 241 mm. */
export const SIGNATURE_MAX_Y = 236;

export interface Gabarit {
  /** Hauteur d'une ligne du tableau des notes. */
  rowH: number;
  /** Espace entre le tableau et la ligne de synthèse. */
  gap: number;
  /** Interligne des lignes de synthèse (Moyenne, Décision…). */
  lineGap: number;
  /** Hauteur du bloc mentions / observations. */
  blocH: number;
}

/**
 * Premier gabarit dont la hauteur totale tient dans `dispo` ; à défaut, le
 * plus serré, avec des lignes de tableau réduites juste assez pour tenir
 * (jamais sous `rowHMin`, en dessous le texte n'est plus lisible).
 */
export const choisirGabarit = (
  gabarits: Gabarit[], nbLignes: number, horsTableau: (g: Gabarit) => number, dispo: number, rowHMin = 3.4,
): Gabarit => {
  for (const g of gabarits) {
    if (nbLignes * g.rowH + horsTableau(g) <= dispo) return g;
  }
  const dernier = gabarits[gabarits.length - 1];
  const rowH = Math.max(rowHMin, (dispo - horsTableau(dernier)) / Math.max(1, nbLignes));
  return { ...dernier, rowH };
};

/** Taille de police du tableau des notes selon la hauteur de ligne. */
export const policeTableau = (rowH: number): number => (rowH >= 5.5 ? 8 : rowH >= 4.5 ? 7.5 : 7);

/** Ligne de base qui centre verticalement un texte de `fontSize` pt dans une ligne de `rowH` mm. */
export const baseLigne = (y: number, rowH: number, fontSize: number): number =>
  y + (rowH + fontSize * 0.3528 * 0.7) / 2;

/** Hauteur d'une ligne du récapitulatif annuel. */
export const recapRowH = (g: Gabarit): number => Math.min(5.5, Math.max(4.5, g.rowH));

/** Hauteur occupée par le récapitulatif annuel (ou l'ancienne ligne), espace après compris. */
export const hauteurRecap = (annual: AnnualAverageInfo | undefined, g: Gabarit): number => {
  if (!annual) return 0;
  if (!annual.periodes?.length) return g.lineGap;
  return 2 * recapRowH(g) + 2.5;
};

/**
 * Récapitulatif de l'année : une colonne par période déjà passée, puis la
 * moyenne annuelle (ou cumulée), chacune avec son rang. Rend la hauteur
 * occupée, espace après compris.
 */
export const drawRecapAnnuel = (
  doc: jsPDF, y: number, annual: AnnualAverageInfo, g: Gabarit, suffixe = '',
): number => {
  if (!annual.periodes?.length) {
    labelValue(doc, MARGIN, y, annual.label, `${annual.average.toFixed(2)}${suffixe}`);
    labelValue(doc, MARGIN + 70, y, 'Rang', `${annual.rank}/${annual.classSize}`);
    return g.lineGap;
  }

  const cellules = [
    ...annual.periodes.map(c => ({
      titre: `Moyenne ${c.periodName}`,
      valeur: c.average !== undefined
        ? `${c.average.toFixed(2)}${suffixe} — Rang ${c.rank}/${c.classSize}`
        : '—',
      gras: false,
    })),
    {
      titre: annual.label,
      valeur: `${annual.average.toFixed(2)}${suffixe} — Rang ${annual.rank}/${annual.classSize}`,
      gras: true,
    },
  ];
  const h = recapRowH(g);
  const w = PAGE_W - 2 * MARGIN;
  const colW = w / cellules.length;
  // Le texte d'en-tête de la ligne de synthèse est à sa ligne de base : on
  // remonte le tableau pour qu'il commence là où le texte aurait commencé.
  const top = y - 3.5;

  // Police unique pour tout le tableau : la plus grande qui fait tenir chaque case.
  const tailleQuiTient = (textes: string[], gras: boolean, max: number): number => {
    doc.setFont('helvetica', gras ? 'bold' : 'normal');
    let size = max;
    while (size > 5.5) {
      doc.setFontSize(size);
      if (textes.every(t => doc.getTextWidth(t) <= colW - 3)) break;
      size -= 0.5;
    }
    return size;
  };
  const tailleTitre = tailleQuiTient(cellules.map(c => c.titre), true, 8);
  const tailleValeur = Math.min(
    tailleQuiTient(cellules.map(c => c.valeur), false, 8.5),
    tailleQuiTient(cellules.filter(c => c.gras).map(c => c.valeur), true, 8.5),
  );

  doc.setFillColor(GREY_HEADER);
  doc.rect(MARGIN, top, w, h, 'F');
  cellules.forEach((c, i) => {
    const cx = MARGIN + i * colW + colW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(tailleTitre);
    doc.text(c.titre, cx, baseLigne(top, h, tailleTitre), { align: 'center' });
    doc.setFont('helvetica', c.gras ? 'bold' : 'normal');
    doc.setFontSize(tailleValeur);
    doc.text(c.valeur, cx, baseLigne(top + h, h, tailleValeur), { align: 'center' });
  });

  doc.setDrawColor(LINE_GREY);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, top + h, MARGIN + w, top + h);
  for (let i = 1; i < cellules.length; i++) doc.line(MARGIN + i * colW, top, MARGIN + i * colW, top + 2 * h);
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, top, w, 2 * h, 'S');

  return 2 * h + 2.5;
};

// Du plus aéré (la mise en page d'origine) au plus serré.
const GABARITS_BULLETIN: Gabarit[] = [
  { rowH: 6, gap: 8, lineGap: 7, blocH: 7 * 5.5 },
  { rowH: 5.5, gap: 6, lineGap: 6.5, blocH: 7 * 5.2 },
  { rowH: 5, gap: 5, lineGap: 6, blocH: 7 * 4.8 },
  { rowH: 4.5, gap: 4, lineGap: 5.5, blocH: 7 * 4.5 },
  { rowH: 4.1, gap: 3.5, lineGap: 5, blocH: 7 * 4.2 },
];

export async function drawBulletinPage(doc: jsPDF, data: BulletinPdfData): Promise<void> {
  const {
    school, yearLabel, periodName, niveau, className, filiereName, effectif,
    student, ranking, classRankings, classAverage, isExam,
    absencesCount, justifiedAbsencesCount, retardsCount, annualAverage, decisionPassage, observations,
  } = data;

  const mentionTravail = computeMentionTravail(ranking.averageGeneral);
  const mentionHonneur = computeMentionHonneur(ranking.averageGeneral);

  doc.setTextColor('#000000');

  // ---------- En-tête ----------
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

  // ---------- Encadré infos (coins d'angle) ----------
  const boxH = 30;
  const colW = (PAGE_W - 2 * MARGIN - 6) / 2;
  const leftX = MARGIN, rightX = MARGIN + colW + 6;
  bracketCorners(doc, leftX, y, colW, boxH);
  bracketCorners(doc, rightX, y, colW, boxH);

  let ly = y + 5;
  labelValue(doc, leftX + 2, ly, 'Tél.', school.phone ?? '—'); ly += 5.5;
  labelValue(doc, leftX + 2, ly, 'Email', school.email ?? '—'); ly += 5.5;
  labelValue(doc, leftX + 2, ly, 'Niveau', niveau ?? '—'); ly += 5.5;
  labelValue(doc, leftX + 2, ly, 'Série', filiereName ?? '—'); ly += 5.5;
  labelValue(doc, leftX + 2, ly, 'Effectif', String(effectif)); ly += 5.5;
  labelValue(doc, leftX + 2, ly, 'Moyenne classe', classAverage != null ? classAverage.toFixed(2) : '—');

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

  // ---------- Tableau des matières ----------
  // Un examen interne n'a qu'une seule note par matière — Devoirs/Compos
  // seraient toujours vides et "Moy" toujours identique à cette note : un
  // tableau à 6 colonnes (Note au lieu des 3) reflète honnêtement ça.
  const subjectRanks = buildSubjectRanks(classRankings);
  const headers = isExam
    ? ['Disciplines', 'Note', 'Coeff', 'Note×Coef', 'Rang', 'Appréciations']
    : ['Disciplines', 'Devoirs', 'Compos', 'Moy', 'Coeff', 'Moy×Coef', 'Rang', 'Appréciations'];
  const colWidths = isExam
    ? [72, 20, 13, 20, 13, 42]
    : [58, 17, 17, 14, 13, 20, 13, 28];
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const tableTop = y;

  // Tout ce qui suit le tableau, signature comprise (voir SIGNATURE_MAX_Y).
  const horsTableau = (g: Gabarit) =>
    g.gap + g.lineGap + hauteurRecap(annualAverage, g) + (decisionPassage ? g.lineGap : 0) + 3 + g.blocH + 12;
  const gabarit = choisirGabarit(
    GABARITS_BULLETIN, ranking.subjectDetails.length + 2, horsTableau, SIGNATURE_MAX_Y - tableTop,
  );
  const { rowH } = gabarit;
  const fontSize = policeTableau(rowH);
  const textY = (yy: number) => baseLigne(yy, rowH, fontSize);

  doc.setFillColor(GREY_HEADER);
  doc.rect(MARGIN, y, tableW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  let cx = MARGIN;
  headers.forEach((h, i) => {
    if (i === 0) doc.text(h, cx + 2, textY(y));
    else doc.text(h, cx + colWidths[i] / 2, textY(y), { align: 'center' });
    cx += colWidths[i];
  });
  y += rowH;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  const lastColIdx = headers.length - 1;
  ranking.subjectDetails.forEach(s => {
    const rank = subjectRanks.get(s.subjectName)?.get(ranking.studentId) ?? null;
    const vals = isExam
      ? [
          s.subjectName,
          s.muMat != null ? s.muMat.toFixed(2) : '—',
          String(s.coef),
          s.pPond != null ? s.pPond.toFixed(2) : '—',
          rank != null ? String(rank) : '—',
          appreciation(s.muMat),
        ]
      : [
          s.subjectName,
          s.muDev != null ? s.muDev.toFixed(2) : '—',
          s.composition != null ? s.composition.toFixed(2) : '—',
          s.muMat != null ? s.muMat.toFixed(2) : '—',
          String(s.coef),
          s.pPond != null ? s.pPond.toFixed(2) : '—',
          rank != null ? String(rank) : '—',
          appreciation(s.muMat),
        ];
    cx = MARGIN;
    vals.forEach((v, i) => {
      if (i === 0 || i === lastColIdx) doc.text(v, cx + 2, textY(y));
      else doc.text(v, cx + colWidths[i] / 2, textY(y), { align: 'center' });
      cx += colWidths[i];
    });
    y += rowH;
  });

  const totalPPond = ranking.subjectDetails.reduce((sum, s) => sum + (s.pPond ?? 0), 0);
  doc.setFillColor(GREY_HEADER);
  doc.rect(MARGIN, y, tableW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  cx = MARGIN;
  doc.text('Totaux', cx + 2, textY(y));
  if (isExam) {
    cx += colWidths[0] + colWidths[1];
    doc.text(String(ranking.totalCoef), cx + colWidths[2] / 2, textY(y), { align: 'center' });
    cx += colWidths[2];
    doc.text(totalPPond.toFixed(2), cx + colWidths[3] / 2, textY(y), { align: 'center' });
  } else {
    cx += colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
    doc.text(String(ranking.totalCoef), cx + colWidths[4] / 2, textY(y), { align: 'center' });
    cx += colWidths[4];
    doc.text(totalPPond.toFixed(2), cx + colWidths[5] / 2, textY(y), { align: 'center' });
  }
  y += rowH;

  const tableBottom = y;
  const totalRows = 2 + ranking.subjectDetails.length;
  doc.setDrawColor(LINE_GREY);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= totalRows; i++) {
    const yy = tableTop + i * rowH;
    doc.line(MARGIN, yy, MARGIN + tableW, yy);
  }
  cx = MARGIN;
  colWidths.forEach(w => { doc.line(cx, tableTop, cx, tableBottom); cx += w; });
  doc.line(MARGIN + tableW, tableTop, MARGIN + tableW, tableBottom);
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, tableTop, tableW, tableBottom - tableTop, 'S');

  y = tableBottom + gabarit.gap;

  // ---------- Ligne de synthèse ----------
  labelValue(doc, MARGIN, y, 'Moyenne', ranking.averageGeneral.toFixed(2));
  labelValue(doc, MARGIN + 45, y, 'Rang', `${ranking.rank}/${effectif}`);
  labelValue(doc, MARGIN + 80, y, 'Retards', String(retardsCount));
  labelValue(doc, MARGIN + 115, y, 'Absences', `${absencesCount} dont ${justifiedAbsencesCount} justifiée(s)`);
  y += gabarit.lineGap;

  // ---------- Récapitulatif : moyenne de chaque semestre + annuelle (absent au 1er semestre) ----------
  if (annualAverage) y += drawRecapAnnuel(doc, y, annualAverage, gabarit);

  // ---------- Décision de passage (bulletin de fin d'année uniquement) ----------
  if (decisionPassage) {
    labelValue(doc, MARGIN, y, 'Décision', decisionPassage);
    y += gabarit.lineGap;
  }

  y += 3;

  // ---------- Mentions + Observations ----------
  const mentionColW = 45, mentionXW = 8, mentionRowH = gabarit.blocH / MENTIONS_HONNEUR.length;
  const mentionsTop = y;

  const drawMentions = (x: number, items: string[], checked?: string): number => {
    let yy = mentionsTop;
    doc.setDrawColor('#000000');
    doc.setLineWidth(0.25);
    items.forEach(item => {
      doc.rect(x, yy, mentionColW, mentionRowH, 'S');
      doc.rect(x + mentionColW, yy, mentionXW, mentionRowH, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(item, x + 1.5, baseLigne(yy, mentionRowH, 7.5));
      if (item === checked) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('×', x + mentionColW + mentionXW / 2, baseLigne(yy, mentionRowH, 8), { align: 'center' });
      }
      yy += mentionRowH;
    });
    return yy;
  };

  const yAfterLeft = drawMentions(MARGIN, MENTIONS_TRAVAIL, mentionTravail);
  const yAfterRight = drawMentions(MARGIN + mentionColW + mentionXW + 4, MENTIONS_HONNEUR, mentionHonneur);
  const mentionsBottom = Math.max(yAfterLeft, yAfterRight);

  const obsX = MARGIN + 2 * (mentionColW + mentionXW) + 8;
  const obsW = PAGE_W - MARGIN - obsX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Observations du conseil des professeurs', obsX, mentionsTop - 1);
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.3);
  doc.rect(obsX, mentionsTop, obsW, mentionsBottom - mentionsTop, 'S');
  if (observations) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(observations, obsW - 4);
    doc.text(lines, obsX + 2, mentionsTop + 5);
  }

  y = mentionsBottom + 12;
  doc.setDrawColor('#000000');
  doc.setLineWidth(0.3);
  doc.line(PAGE_W - MARGIN - 45, y - 4, PAGE_W - MARGIN, y - 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text("Le Chef d'établissement", PAGE_W - MARGIN, y, { align: 'right' });

  // ---------- Pied de page : QR codes + note, ancrés en bas ----------
  const qrSize = 22;
  const bandH = 5;
  const bandY = PAGE_H - MARGIN - bandH;
  const noteY = bandY - 6;
  const qrY = noteY - 6 - qrSize;

  const infoText = `${student.lastName} ${student.firstName} — ${student.studentId} — ${className}`;
  const bulletinText = `Bulletin ${periodName} — Moyenne ${ranking.averageGeneral.toFixed(2)} — Rang ${ranking.rank}/${effectif}`;

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

export async function generateBulletinsPdf(dataList: BulletinPdfData[]): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  for (let i = 0; i < dataList.length; i++) {
    if (i > 0) doc.addPage();
    await drawBulletinPage(doc, dataList[i]);
  }
  return doc;
}
