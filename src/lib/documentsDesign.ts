import type jsPDF from 'jspdf';
import { dessinerLogoEcole, lignesCoordonnees, type InfosEcole } from '@/lib/documentsEcole';
import type { Palette } from '@/lib/couleurLogo';

// ═══════════════════════════════════════════════════════════════════════════
// LANGAGE VISUEL DES DOCUMENTS OFFICIELS DE L'ÉCOLE
//
// Reçu et fiche d'inscription partagent la même identité : bandeau aux couleurs
// du logo, titres à empattements, étiquettes en petites capitales espacées,
// filigrane du logo, motif guilloché en pied de page. Quelqu'un qui reçoit les
// deux doit voir qu'ils viennent de la même maison.
//
// Ces briques ne connaissent pas la taille de la page : chaque document leur
// donne sa largeur (A5, A4…).
// ═══════════════════════════════════════════════════════════════════════════

export const ENCRE = '#1F2937';
export const GRIS = '#6B7280';
export const FILET = '#E5E7EB';
export const VERT_TAMPON = '#15803D';
export const ROUGE = '#B91C1C';

export type Alignement = 'left' | 'right' | 'center';

/** Change l'opacité du dessin qui suit (à entourer de saveGraphicsState/restoreGraphicsState). */
export const opacite = (doc: jsPDF, valeur: number) => {
  const GState = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
  doc.setGState(new GState({ opacity: valeur }));
};

/** Texte espacé (capitales d'étiquette). jsPDF compte `charSpace` en millimètres. */
export const espace = (doc: jsPDF, t: string, x: number, y: number, ecart = 0.2, align: Alignement = 'left') => {
  const largeur = doc.getTextWidth(t) + ecart * Math.max(0, t.length - 1);
  const debut = align === 'right' ? x - largeur : align === 'center' ? x - largeur / 2 : x;
  doc.text(t, debut, y, { charSpace: ecart });
};

/** Petite étiquette en capitales espacées, en gras. */
export const etiquette = (doc: jsPDF, t: string, x: number, y: number, couleur: string, align: Alignement = 'left') => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(couleur);
  espace(doc, t.toUpperCase(), x, y, 0.2, align);
};

/** Point du plan tourné de `angle` degrés (sens antihoraire à l'écran) autour de (cx, cy). */
export const tourne = (cx: number, cy: number, u: number, v: number, angle: number): [number, number] => {
  const a = (angle * Math.PI) / 180;
  return [cx + u * Math.cos(a) + v * Math.sin(a), cy - u * Math.sin(a) + v * Math.cos(a)];
};

export const polygone = (doc: jsPDF, points: [number, number][], style: 'S' | 'F' | 'FD') => {
  const [[x0, y0], ...reste] = points;
  const deltas = reste.map(([x, y], i) => [x - (i === 0 ? x0 : reste[i - 1][0]), y - (i === 0 ? y0 : reste[i - 1][1])] as [number, number]);
  doc.lines(deltas, x0, y0, [1, 1], style, true);
};

export const texteTourne = (doc: jsPDF, t: string, cx: number, cy: number, angle: number, ecart = 0) => {
  const largeur = doc.getTextWidth(t) + ecart * Math.max(0, t.length - 1);
  const [x, y] = tourne(cx, cy, -largeur / 2, 1.2, angle);
  doc.text(t, x, y, { angle, charSpace: ecart });
};

/** Motif de sécurité : ondes fines entrelacées, à la manière d'un guilloché. */
export const guilloche = (doc: jsPDF, c: Palette, largeurPage: number, y: number, hauteur: number) => {
  doc.setDrawColor(c.trait);
  doc.setLineWidth(0.18);
  for (let onde = 0; onde < 4; onde++) {
    const points: [number, number][] = [];
    for (let x = 0; x <= largeurPage; x += 0.7) {
      const t = (x / largeurPage) * Math.PI * 2;
      points.push([x, y + hauteur / 2 + (hauteur / 2.4) * Math.sin(t * 9 + onde * 0.9) * Math.cos(t * 1.5 + onde * 0.4)]);
    }
    const [[x0, y0], ...reste] = points;
    doc.lines(reste.map(([x, yy], i) => [x - (i === 0 ? x0 : reste[i - 1][0]), yy - (i === 0 ? y0 : reste[i - 1][1])] as [number, number]),
      x0, y0, [1, 1], 'S', false);
  }
};

/** Filigrane : le logo (ou le monogramme) très pâle, derrière tout le contenu. */
export const filigrane = (doc: jsPDF, ecole: InfosEcole, largeurPage: number, hauteurPage: number, cote = 84, couleur?: string) => {
  doc.saveGraphicsState();
  opacite(doc, 0.04);
  dessinerLogoEcole(doc, ecole, largeurPage / 2 - cote / 2, hauteurPage / 2 - cote / 2 + 4, cote, cote, couleur);
  doc.restoreGraphicsState();
};

export interface OptionsBandeau {
  largeurPage: number;
  marge: number;
  hauteur: number;
  /** Facteur appliqué aux positions internes (bandeau réduit). */
  k?: number;
}

/**
 * Le bandeau d'en-tête : fond foncé, liseré d'accent, logo sur disque blanc,
 * nom de l'école en capitales à empattements, coordonnées en dessous.
 */
export const dessinerBandeau = (doc: jsPDF, ecole: InfosEcole, c: Palette, o: OptionsBandeau): void => {
  const k = o.k ?? 1;
  doc.setFillColor(c.fonce);
  doc.rect(0, 0, o.largeurPage, o.hauteur, 'F');
  doc.setFillColor(c.accent);
  doc.rect(0, o.hauteur, o.largeurPage, 1.6, 'F');

  // Logo sur un disque blanc : lisible quelle que soit la couleur du logo.
  const r = 11.6 * k;
  const cx = o.marge + r - 0.6;
  const cy = o.hauteur / 2;
  doc.setFillColor('#FFFFFF');
  doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, r, 'S');
  dessinerLogoEcole(doc, ecole, cx - r * 0.74, cy - r * 0.74, r * 1.48, r * 1.48, c.fonce);

  const x = o.marge + 2 * r + 4.3;
  const largeurTexte = o.largeurPage - o.marge - x;
  doc.setTextColor('#FFFFFF');
  doc.setFont('times', 'bold');
  doc.setFontSize(ecole.nom.length > 34 ? 12.5 : 14.5);
  const noms = doc.splitTextToSize(ecole.nom.toUpperCase(), largeurTexte) as string[];
  let y = 10.4 * k;
  noms.slice(0, 2).forEach(ligne => { espace(doc, ligne, x, y, 0.1); y += 5.4 * k; });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.saveGraphicsState();
  opacite(doc, 0.86);
  y += noms.length > 1 ? -0.4 : 0.6;
  for (const ligne of lignesCoordonnees(ecole).slice(0, 3)) {
    doc.text((doc.splitTextToSize(ligne, largeurTexte) as string[])[0], x, y);
    y += 3.7 * k;
  }
  doc.restoreGraphicsState();
};

/** Titre du document : capitales à empattements espacées, barre d'accent dessous. */
export const dessinerTitre = (doc: jsPDF, c: Palette, texte: string, x: number, y: number, taille = 17.5, ecart = 0.32) => {
  doc.setFont('times', 'bold');
  doc.setFontSize(taille);
  doc.setTextColor(c.fonce);
  espace(doc, texte, x, y, ecart);
  doc.setFillColor(c.accent);
  doc.rect(x, y + 2.8, 20, 0.9, 'F');
};

/** « Édité avec SenClass » : la marque en gras et en couleur. Deux polices ne s'alignent qu'en mesurant la première. */
export const signatureSenClass = (doc: jsPDF, c: Palette, xDroite: number, y: number) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  const largeurMarque = doc.getTextWidth('SenClass');
  doc.setTextColor(c.accent);
  doc.text('SenClass', xDroite, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GRIS);
  doc.text('Édité avec', xDroite - largeurMarque - 1.2, y, { align: 'right' });
};
