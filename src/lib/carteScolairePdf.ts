import jsPDF from 'jspdf';
import { dessinerLogoEcole, type InfosEcole } from '@/lib/documentsEcole';
import { couleurDominanteDuLogo, paletteDepuis, type Palette } from '@/lib/couleurLogo';
import {
  A4, MARGE_FEUILLE, RATIO_PHOTO, dessinerFace, estDebout, planche, positionSurPlanche,
  type EleveCarte, type Face, type Mesure, type ReglagesCarte, type Trace,
} from '@/lib/carteScolaire';

// ═══════════════════════════════════════════════════════════════════════════
// CARTES SCOLAIRES — sortie PDF (vectoriel : texte net, même à 300 ppp)
//
// Chargé seulement au clic (jsPDF pèse lourd) — d'où sa place dans
// FICHIERS_D_ACTION (src/lib/rechargementApresDeploiement.ts).
//
//   • 'carte' : une page = une face, à la taille exacte de la carte. Recto puis
//     verso de chaque élève : une imprimante à cartes recto verso imprime les
//     deux faces d'une même carte à la suite.
//   • 'feuille' : A4 portrait, les rectos d'un groupe d'élèves, puis la page de
//     leurs versos en miroir (retourner la feuille sur le grand côté).
// ═══════════════════════════════════════════════════════════════════════════

export type Sortie = 'carte' | 'feuille';

/** La mesure du texte de jsPDF, partagée par l'aperçu et le PDF : ce qu'on voit est ce qui sort. */
export const creerMesure = (doc: jsPDF = new jsPDF({ unit: 'mm' })): Mesure => (texte, taille, style) => {
  doc.setFont('helvetica', style);
  doc.setFontSize(taille);
  // Espace insécable mesurée comme une espace : c'est ainsi qu'elle s'écrit (voir ajuster).
  return doc.getTextWidth(texte.replace(/\u00A0/g, ' '));
};

/** La palette de la carte : la couleur choisie, sinon celle du logo, sinon le bleu SenClass. */
export const paletteCarte = async (r: ReglagesCarte, logo: string | null | undefined): Promise<Palette> =>
  paletteDepuis(r.couleur ?? await couleurDominanteDuLogo(logo));

/**
 * Recadre une photo aux proportions d'une photo d'identité (centrée, sans
 * déformation), et l'allège : une photo de téléphone de 4 Mo ferait un PDF
 * énorme pour une classe entière. Sans canvas (ou image illisible), la photo
 * reste telle quelle.
 */
export const preparerPhoto = async (src: string): Promise<string> => {
  if (typeof document === 'undefined') return src;
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const { naturalWidth: lI, naturalHeight: hI } = img;
    if (!lI || !hI) return src;
    // Partie gardée : la plus grande zone aux bonnes proportions, centrée (un peu vers le haut : le visage).
    const lGarde = Math.min(lI, hI * RATIO_PHOTO);
    const hGarde = lGarde / RATIO_PHOTO;
    const sx = (lI - lGarde) / 2;
    const sy = Math.max(0, Math.min(hI - hGarde, (hI - hGarde) * 0.3));
    const hSortie = Math.min(600, Math.round(hGarde));
    const lSortie = Math.round(hSortie * RATIO_PHOTO);
    const canvas = document.createElement('canvas');
    canvas.width = lSortie;
    canvas.height = hSortie;
    const ctx = canvas.getContext('2d');
    if (!ctx) return src;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, lSortie, hSortie);
    ctx.drawImage(img, sx, sy, lGarde, hGarde, 0, 0, lSortie, hSortie);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return src;
  }
};

/** Les photos de tous les élèves, recadrées une fois pour toutes. */
export const preparerEleves = (eleves: EleveCarte[]): Promise<EleveCarte[]> =>
  Promise.all(eleves.map(async e => (e.photo ? { ...e, photo: await preparerPhoto(e.photo) } : e)));

/** Pose les tracés d'une face sur la page, décalés de (ox, oy). */
const poser = (doc: jsPDF, traces: Trace[], ox: number, oy: number, ecole: InfosEcole): void => {
  for (const t of traces) {
    if (t.type === 'rect') {
      if (t.pointille) doc.setLineDashPattern([0.8, 0.6], 0);
      if (t.fond) doc.setFillColor(t.fond);
      if (t.trait) { doc.setDrawColor(t.trait); doc.setLineWidth(t.epaisseur ?? 0.2); }
      const mode = t.fond && t.trait ? 'FD' : t.fond ? 'F' : 'S';
      if (t.arrondi) doc.roundedRect(ox + t.x, oy + t.y, t.l, t.h, t.arrondi, t.arrondi, mode);
      else doc.rect(ox + t.x, oy + t.y, t.l, t.h, mode);
      if (t.pointille) doc.setLineDashPattern([], 0);
    } else if (t.type === 'ligne') {
      doc.setDrawColor(t.couleur);
      doc.setLineWidth(t.epaisseur);
      doc.line(ox + t.x1, oy + t.y1, ox + t.x2, oy + t.y2);
    } else if (t.type === 'texte') {
      doc.setFont('helvetica', t.style);
      doc.setFontSize(t.taille);
      doc.setTextColor(t.couleur);
      t.lignes.forEach((l, i) => doc.text(l, ox + t.x, oy + t.y + i * t.interligne, { align: t.align }));
    } else if (t.type === 'courbe') {
      if (t.points.length < 2) continue;
      doc.setDrawColor(t.couleur);
      doc.setLineWidth(t.epaisseur);
      const [x0, y0] = t.points[0];
      const pas = t.points.slice(1).map(([x, y], i) => [x - t.points[i][0], y - t.points[i][1]]);
      doc.lines(pas, ox + x0, oy + y0, [1, 1], 'S', false);
    } else if (t.type === 'photo') {
      try {
        doc.addImage(t.src, doc.getImageProperties(t.src).fileType, ox + t.x, oy + t.y, t.l, t.h);
      } catch { /* photo illisible : le cadre reste */ }
    } else if (t.type === 'logo') {
      dessinerLogoEcole(doc, { ...ecole, logo: t.src }, ox + t.x, oy + t.y, t.l, t.h, t.couleur);
    }
  }
};

export interface DemandeCartes {
  reglages: ReglagesCarte;
  /** Photos déjà préparées (preparerEleves). */
  eleves: EleveCarte[];
  ecole: InfosEcole;
  anneeScolaire?: string;
  palette: Palette;
  sortie: Sortie;
}

/** Trait de coupe autour de chaque carte d'une feuille : gris clair, fin. */
const GRIS_COUPE = '#C8C8C8';

export const fabriquerCartesPdf = (d: DemandeCartes): jsPDF => {
  const { reglages: r } = d;
  const orientation = estDebout(r) ? 'portrait' : 'landscape';
  const format: [number, number] = [Math.min(r.largeur, r.hauteur), Math.max(r.largeur, r.hauteur)];
  const doc = d.sortie === 'carte'
    ? new jsPDF({ unit: 'mm', format, orientation, compress: true })
    : new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const mesure = creerMesure(doc);
  const face = (f: Face, e: EleveCarte) => dessinerFace(f, mesure, { reglages: r, eleve: e, ecole: d.ecole, anneeScolaire: d.anneeScolaire, palette: d.palette });

  let premiere = true;
  const nouvellePage = () => {
    if (premiere) { premiere = false; return; }
    if (d.sortie === 'carte') doc.addPage(format, orientation);
    else doc.addPage('a4', 'portrait');
  };

  if (d.sortie === 'carte') {
    for (const e of d.eleves) {
      for (const f of ['recto', 'verso'] as const) {
        nouvellePage();
        poser(doc, face(f, e), 0, 0, d.ecole);
      }
    }
    return doc;
  }

  const pl = planche(r);
  const parFeuille = pl.colonnes * pl.rangees;
  for (let debut = 0; debut < d.eleves.length; debut += parFeuille) {
    const groupe = d.eleves.slice(debut, debut + parFeuille);
    for (const f of ['recto', 'verso'] as const) {
      nouvellePage();
      groupe.forEach((e, i) => {
        const { x, y } = positionSurPlanche(pl, r, i, f);
        poser(doc, face(f, e), x, y, d.ecole);
        doc.setDrawColor(GRIS_COUPE);
        doc.setLineWidth(0.1);
        doc.rect(x, y, r.largeur, r.hauteur, 'S');
      });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor('#9CA3AF');
      doc.text(
        f === 'recto'
          ? 'Recto — imprimez cette page, puis retournez la feuille sur le grand côté pour imprimer la suivante au dos.'
          : 'Verso — à imprimer au dos de la page précédente. Découpez ensuite le long des traits gris.',
        A4.largeur / 2, A4.hauteur - MARGE_FEUILLE + 2, { align: 'center' },
      );
    }
  }
  return doc;
};
