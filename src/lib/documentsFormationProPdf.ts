import jsPDF from 'jspdf';
import type { InfosEcole } from '@/lib/documentsEcole';
import { dateDakar } from '@/lib/documentsEcole';
import { couleurDominanteDuLogo, paletteDepuis, type Palette } from '@/lib/couleurLogo';
import {
  ENCRE, GRIS, dessinerBandeau, dessinerTitre, ecrireAjuste, etiquette, filigrane, guilloche, signatureSenClass,
} from '@/lib/documentsDesign';
import { dessinerLogoEcole } from '@/lib/documentsEcole';
import {
  type DonneesBulletins, type BulletinEleve, type LigneConvocation, type DocumentOfficiel, type TypeDocumentOfficiel,
  numeroDocument, accord, rangOrdinal, titreDiplome, libelleMention, libelleTypeExamen,
} from '@/lib/documentsFormationPro';

// ═══════════════════════════════════════════════════════════════════════════
// PDF DES DOCUMENTS DE LA FORMATION PROFESSIONNELLE
//
// Même identité visuelle que le reçu et la fiche d'inscription : bandeau aux
// couleurs du logo, titre à empattements, filigrane, motif guilloché en pied.
// Mises en page écrites une fois pour toutes (pas de moteur de modèles).
// Chargé à la demande (import dynamique) : listé dans FICHIERS_D_ACTION.
// ═══════════════════════════════════════════════════════════════════════════

const L = 210;
const H = 297;
const M = 16;
const U = L - 2 * M;
const HAUT_BANDEAU = 32;

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 2026-09-01 » → « 1er septembre 2026 » (date sans heure : aucun fuseau en jeu). */
export const dateEnLettres = (iso?: string): string => {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  const j = Number(m[3]);
  return `${j === 1 ? '1er' : j} ${MOIS[Number(m[2]) - 1] ?? ''} ${m[1]}`;
};
const dateCourte = (iso?: string): string => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
const aujourdhuiIso = () => new Date().toISOString();
const note = (n: number | null | undefined) => (n == null ? '—' : (Math.round(n * 100) / 100).toFixed(2).replace('.', ','));

const civilite = (sexe?: string) => (sexe === 'femme' ? 'Mme' : 'M.');

const palette = async (ecole: InfosEcole): Promise<Palette> => paletteDepuis(await couleurDominanteDuLogo(ecole.logo));

// ─── Briques communes ─────────────────────────────────────────────────────────

const enTete = (doc: jsPDF, ecole: InfosEcole, c: Palette) => {
  filigrane(doc, ecole, L, H, 110, c.fonce);
  dessinerBandeau(doc, ecole, c, { largeurPage: L, marge: M, hauteur: HAUT_BANDEAU });
};

/** Pied : références légales de l'école (documents officiels), motif, « Édité avec SenClass ». */
const piedDePage = (doc: jsPDF, ecole: Omit<InfosEcole, 'logo'>, c: Palette, mention?: string) => {
  guilloche(doc, c, L, H - 9.4, 9.4);
  const refs = [
    ecole.autorisation && `Autorisation d'ouverture n° ${ecole.autorisation}`,
    ecole.rc && `RC ${ecole.rc}`,
    ecole.ninea && `NINEA ${ecole.ninea}`,
  ].filter(Boolean).join('  ·  ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(GRIS);
  if (refs) doc.text(refs, M, H - 15.6);
  if (mention) { doc.setFont('helvetica', 'italic'); doc.text(mention, M, H - 12.2); }
  signatureSenClass(doc, c, L - M, H - 12.2);
};

/** « Fait à Dakar, le 24 septembre 2026 » puis la signature du directeur et le cachet. */
const signatureDirection = (doc: jsPDF, ecole: Omit<InfosEcole, 'logo'>, c: Palette, y: number, dateIso = aujourdhuiIso()) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(ENCRE);
  doc.text(`Fait${ecole.ville ? ` à ${ecole.ville}` : ''}, le ${dateEnLettres(dateDakar(dateIso).split('/').reverse().join('-'))}`, L - M, y, { align: 'right' });
  const largeur = 62;
  const x = L - M - largeur;
  etiquette(doc, 'La direction', x + largeur / 2, y + 7, GRIS, 'center');
  doc.setDrawColor(GRIS);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(x, y + 26, x + largeur, y + 26);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(c.accent);
  doc.setLineDashPattern([1.2, 1.4], 0);
  doc.circle(x - 16, y + 17, 11, 'S');
  doc.setLineDashPattern([], 0);
  etiquette(doc, 'Cachet', x - 16, y + 18, c.accent, 'center');
};

/** Paragraphe justifié à gauche ; renvoie le y suivant. */
const paragraphe = (doc: jsPDF, texte: string, y: number, taille = 11, interligne = 6.2): number => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(taille);
  doc.setTextColor(ENCRE);
  const lignes = doc.splitTextToSize(texte, U) as string[];
  lignes.forEach(l => { doc.text(l, M, y); y += interligne; });
  return y;
};

/** Encadré pâle « étiquette : valeur » sur deux colonnes. */
const encadre = (doc: jsPDF, c: Palette, y: number, champs: [string, string | undefined][]): number => {
  const lignes = Math.ceil(champs.length / 2);
  const h = 6 + lignes * 10;
  doc.setFillColor(c.pale);
  doc.roundedRect(M, y, U, h, 1.8, 1.8, 'F');
  champs.forEach(([nom, valeur], i) => {
    const x = M + 5 + (i % 2) * (U / 2);
    const yy = y + 6 + Math.floor(i / 2) * 10;
    etiquette(doc, nom, x, yy, GRIS);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(ENCRE);
    ecrireAjuste(doc, valeur && valeur.trim() ? valeur : '—', x, yy + 5, U / 2 - 10, { taille: 10, tailleMin: 7 });
  });
  return y + h + 6;
};

// ─── En-tête et pied « à la manière de l'école » (bulletin, relevé) ──────────
// Calqués sur les documents d'IFHO : logo centré, nom de l'école, autorisation
// et adresse en petit, cadre autour de la page, pied de page libre.

const TRAIT = '#374151';

const cadrePage = (doc: jsPDF, c: Palette) => {
  doc.setDrawColor(c.fonce);
  doc.setLineWidth(0.8);
  doc.rect(6, 6, L - 12, H - 12, 'S');
};

/** Logo centré, nom de l'école, références ; renvoie le y suivant. */
const enTeteCentre = (doc: jsPDF, ecole: InfosEcole, c: Palette): number => {
  filigrane(doc, ecole, L, H, 110, c.fonce);
  dessinerLogoEcole(doc, ecole, L / 2 - 22, 10, 44, 16, c.fonce);
  let y = 31;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(ENCRE);
  doc.text(ecole.nom, L / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  for (const ligne of [
    ecole.autorisation && `N° Aut : ${ecole.autorisation}`,
    ecole.adresse && `Adresse : ${ecole.adresse}`,
    [ecole.ninea && `NINEA : ${ecole.ninea}`, ecole.rc && `RC : ${ecole.rc}`].filter(Boolean).join('  ·  '),
  ].filter((l): l is string => !!l)) {
    y += 3.9;
    doc.text(ligne, L / 2, y, { align: 'center' });
  }
  return y + 7;
};

/** Pied de page : le texte libre de l'école (Paramètres), sinon e-mail et téléphone. */
const piedEcole = (doc: jsPDF, ecole: InfosEcole, c: Palette) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(ENCRE);
  const lignes = ecole.piedDePage
    ? ecole.piedDePage.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 4)
    : [[ecole.email && `Email : ${ecole.email}`, ecole.telephone && `Tél. : ${ecole.telephone}`].filter(Boolean).join('    ·    ')].filter(Boolean);
  let y = H - 10 - (lignes.length - 1) * 3.4;
  for (const l of lignes) { doc.text(l, L / 2, y, { align: 'center' }); y += 3.4; }
  doc.setFontSize(6);
  signatureSenClass(doc, c, L - 9, H - 7.4);
};

/** Texte centré, rétréci plutôt que coupé s'il est trop long. */
const centreAjuste = (doc: jsPDF, texte: string, y: number, largeur: number, taille: number) => {
  let t = taille;
  doc.setFontSize(t);
  while (doc.getTextWidth(texte) > largeur && t > 7) { t -= 0.25; doc.setFontSize(t); }
  doc.text(texte, L / 2, y, { align: 'center' });
};

/** Titre souligné, centré. */
const titreSouligne = (doc: jsPDF, texte: string, y: number, taille = 12.5) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(taille);
  doc.setTextColor(ENCRE);
  doc.text(texte, L / 2, y, { align: 'center' });
  const w = doc.getTextWidth(texte);
  doc.setDrawColor(ENCRE);
  doc.setLineWidth(0.35);
  doc.line(L / 2 - w / 2, y + 1.1, L / 2 + w / 2, y + 1.1);
};

/** Une cellule de tableau : cadre fin, fond éventuel, texte centré (ou à gauche). */
const cellule = (
  doc: jsPDF, x: number, y: number, w: number, h: number, texte: string,
  o: { fond?: string; gras?: boolean; taille?: number; gauche?: boolean; couleur?: string } = {},
) => {
  if (o.fond) { doc.setFillColor(o.fond); doc.rect(x, y, w, h, 'F'); }
  doc.setDrawColor(TRAIT);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'S');
  if (!texte) return;
  doc.setFont('helvetica', o.gras ? 'bold' : 'normal');
  // Le texte entier, jamais coupé : on rétrécit la police jusqu'à ce qu'il tienne dans la case.
  let taille = o.taille ?? 8.6;
  doc.setFontSize(taille);
  let lignes = doc.splitTextToSize(texte, w - 2) as string[];
  while (taille > 5 && (lignes.length * taille * 0.37 > h - 0.6 || lignes.length > 3)) {
    taille -= 0.4;
    doc.setFontSize(taille);
    lignes = doc.splitTextToSize(texte, w - 2) as string[];
  }
  doc.setTextColor(o.couleur ?? ENCRE);
  const hauteurTexte = lignes.length * taille * 0.36;
  let yy = y + h / 2 - hauteurTexte / 2 + taille * 0.3;
  for (const l of lignes) {
    if (o.gauche) doc.text(l, x + 1.6, yy);
    else doc.text(l, x + w / 2, yy, { align: 'center' });
    yy += taille * 0.37;
  }
};

// ─── Bulletin de période (format IFHO) ───────────────────────────────────────

const pageBulletin = (doc: jsPDF, d: DonneesBulletins, b: BulletinEleve, c: Palette) => {
  cadrePage(doc, c);
  let y = enTeteCentre(doc, d.ecole, c);
  titreSouligne(doc, 'BULLETIN DE COMPOSITION', y);
  y += 8;
  titreSouligne(doc, `${d.periode.nom.toUpperCase()}${d.anneeScolaire ? ` ${d.anneeScolaire.replace('-', ' - ')}` : ''}`, y, 11);
  y += 6;

  // ── Identité ──
  const MX = 12;
  const UX = L - 2 * MX;
  doc.setDrawColor(ENCRE);
  doc.setLineWidth(0.4);
  doc.roundedRect(MX + 2, y, UX - 4, 17, 3, 3, 'S');
  const champ = (nom: string, valeur: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(ENCRE);
    doc.text(`${nom} : `, x, yy);
    const w = doc.getTextWidth(`${nom} : `);
    doc.setFont('helvetica', 'normal');
    ecrireAjuste(doc, valeur || '—', x + w, yy, 92 - w, { taille: 10, tailleMin: 7 });
  };
  const e = b.eleve;
  champ('Prénom(s)', e.prenoms, MX + 7, y + 7);
  champ('Nom', e.nom.toUpperCase(), MX + 7, y + 13.2);
  const naissance = e.dateNaissance ? `${dateCourte(e.dateNaissance)}${e.lieuNaissance ? ` à ${e.lieuNaissance}` : ''}` : '';
  champ('Né(e) le', naissance, MX + 98, y + 7);
  champ('Classe', `${d.niveau}  ·  Matricule ${e.matricule}`, MX + 98, y + 13.2);
  y += 21;

  // ── Tableau ──
  const fixe = { moy: 16, coef: 11, pts: 17, appr: 24 };
  const nbColonnesNotes = d.colonnes.reduce((t, col) => t + (col.nbNotes > 1 ? col.nbNotes + 1 : 1), 0);
  const wNote = Math.min(15, (UX - 42 - fixe.moy - fixe.coef - fixe.pts - fixe.appr) / Math.max(1, nbColonnesNotes));
  const wMat = UX - nbColonnesNotes * wNote - fixe.moy - fixe.coef - fixe.pts - fixe.appr;
  const fondEntete = c.pale;
  const hEntete = 12;
  let x = MX;
  cellule(doc, x, y, wMat, hEntete, 'MATIÈRES', { fond: fondEntete, gras: true }); x += wMat;
  for (const col of d.colonnes) {
    if (col.nbNotes > 1) {
      const wGroupe = (col.nbNotes + 1) * wNote;
      // Comme IFHO : « NOTES » au-dessus des devoirs quand une seule catégorie a plusieurs notes.
      const groupes = d.colonnes.filter(k => k.nbNotes > 1).length;
      cellule(doc, x, y, wGroupe, hEntete / 2, groupes === 1 ? 'NOTES' : col.nom.toUpperCase(), { fond: fondEntete, gras: true, taille: 7.6 });
      for (let i = 1; i <= col.nbNotes; i++) cellule(doc, x + (i - 1) * wNote, y + hEntete / 2, wNote, hEntete / 2, `${col.abrege} ${i}`, { fond: fondEntete, gras: true, taille: 7.4 });
      cellule(doc, x + col.nbNotes * wNote, y + hEntete / 2, wNote, hEntete / 2, `MOY ${col.abrege}`, { fond: fondEntete, gras: true, taille: 6.8 });
      x += wGroupe;
    } else {
      cellule(doc, x, y, wNote, hEntete, col.abrege, { fond: fondEntete, gras: true, taille: 7.8 });
      x += wNote;
    }
  }
  cellule(doc, x, y, fixe.moy, hEntete, 'MOY GEN', { fond: fondEntete, gras: true, taille: 7.8 }); x += fixe.moy;
  cellule(doc, x, y, fixe.coef, hEntete, 'COEF', { fond: fondEntete, gras: true, taille: 7.8 }); x += fixe.coef;
  cellule(doc, x, y, fixe.pts, hEntete, 'MOY × COEF', { fond: fondEntete, gras: true, taille: 7.4 }); x += fixe.pts;
  cellule(doc, x, y, fixe.appr, hEntete, 'APPRÉCIATIONS', { fond: fondEntete, gras: true, taille: 7.4 });
  y += hEntete;

  // Un programme long resserre ses lignes : le bulletin tient sur UNE page.
  const hLigne = Math.min(7.2, 118 / Math.max(1, b.lignes.length + 1));
  const taille = Math.min(8.6, hLigne * 1.25);
  b.lignes.forEach((l, i) => {
    const fond = i % 2 === 1 ? c.pale : undefined;
    x = MX;
    cellule(doc, x, y, wMat, hLigne, l.matiere.toUpperCase(), { fond, taille: Math.min(taille, 8) }); x += wMat;
    if (l.stage) {
      const w = nbColonnesNotes * wNote;
      cellule(doc, x, y, w, hLigne, l.moyenne === null ? '' : 'note du stage', { fond, taille: taille - 1, couleur: GRIS });
      x += w;
    } else {
      l.cellules.forEach((cel, k) => {
        const col = d.colonnes[k];
        const n = col.nbNotes;
        for (let j = 0; j < n; j++) cellule(doc, x + j * wNote, y, wNote, hLigne, cel.notes[j] ?? '', { fond, taille });
        if (n > 1) cellule(doc, x + n * wNote, y, wNote, hLigne, cel.moyenne === null ? '' : note(cel.moyenne), { fond, taille });
        x += (n > 1 ? n + 1 : 1) * wNote;
      });
    }
    cellule(doc, x, y, fixe.moy, hLigne, l.moyenne === null ? '' : note(l.moyenne), { fond, gras: true, taille }); x += fixe.moy;
    cellule(doc, x, y, fixe.coef, hLigne, String(l.coefficient).replace('.', ','), { fond, gras: true, taille }); x += fixe.coef;
    cellule(doc, x, y, fixe.pts, hLigne, l.moyenne === null ? '' : note(l.moyenne * l.coefficient), { fond, taille }); x += fixe.pts;
    cellule(doc, x, y, fixe.appr, hLigne, l.appreciation, { fond, taille });
    y += hLigne;
  });
  // Total
  x = MX;
  cellule(doc, x, y, wMat, hLigne, 'TOTAL', { gras: true, taille }); x += wMat;
  cellule(doc, x, y, nbColonnesNotes * wNote + fixe.moy, hLigne, '', {}); x += nbColonnesNotes * wNote + fixe.moy;
  cellule(doc, x, y, fixe.coef, hLigne, String(b.totalCoefficients).replace('.', ','), { gras: true, taille }); x += fixe.coef;
  cellule(doc, x, y, fixe.pts, hLigne, note(b.totalPoints), { gras: true, taille }); x += fixe.pts;
  cellule(doc, x, y, fixe.appr, hLigne, '', {});
  y += hLigne;

  // Moyenne de la période + appréciations du conseil de classe (à la main)
  const hBloc = 16;
  cellule(doc, MX, y, wMat, hBloc, `Moyenne ${d.periode.nom}`, { gras: true, taille: 9 });
  cellule(doc, MX + wMat, y, 26, hBloc, b.moyenneGenerale === null ? '—' : note(b.moyenneGenerale), { gras: true, taille: 11 });
  cellule(doc, MX + wMat + 26, y, 34, hBloc, 'Appréciations du conseil de classe', { gras: true, taille: 8.2 });
  cellule(doc, MX + wMat + 60, y, UX - wMat - 60, hBloc, '', {});
  y += hBloc + 5;

  // Rappel des périodes et moyenne générale (dès la 2e période)
  if (b.recapitulatif.length > 1) {
    for (const r of b.recapitulatif) {
      cellule(doc, MX, y, 46, 5.6, `Moyenne ${r.periode}`, { gras: true, taille: 8.6 });
      cellule(doc, MX + 46, y, 28, 5.6, r.moyenne === null ? '—' : note(r.moyenne), { gras: true, taille: 8.6 });
      y += 5.6;
    }
    cellule(doc, MX, y, 46, 5.6, 'Moyenne Générale', { gras: true, taille: 8.6 });
    cellule(doc, MX + 46, y, 28, 5.6, b.moyenneAnnuelle === null ? '—' : note(b.moyenneAnnuelle), { gras: true, taille: 8.6 });
    y += 5.6;
  }

  // Signatures
  const ySign = Math.min(Math.max(y + 6, 228), 250);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(ENCRE);
  doc.text('LE DIRECTEUR DES ÉTUDES', MX + 30, ySign, { align: 'center' });
  doc.text('LE DIRECTEUR GÉNÉRAL', L - MX - 30, ySign, { align: 'center' });
  if (d.ecole.directeurEtudes) doc.text(d.ecole.directeurEtudes, MX + 30, ySign + 24, { align: 'center' });
  if (d.ecole.directeurGeneral) doc.text(d.ecole.directeurGeneral, L - MX - 30, ySign + 24, { align: 'center' });

  piedEcole(doc, d.ecole, c);
};

/** Un bulletin par élève, chacun sur sa page, dans un seul PDF. */
export async function genererBulletinsPdf(d: DonneesBulletins): Promise<jsPDF> {
  const c = await palette(d.ecole);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  d.eleves.forEach((b, i) => {
    if (i > 0) doc.addPage('a4', 'portrait');
    pageBulletin(doc, d, b, c);
  });
  return doc;
}

// ─── Relevé de notes d'examen (format des relevés CAP / examen blanc) ────────

export interface TourReleve {
  nom: string;
  lignes: { discipline: string; coefficient: number; note: string; points: string; ne?: string }[];
  total: number;
  totalMax: number;
  totalDemande: number;
  moyenne: number | null;
  /** Avant le dernier tour : ADMISSIBLE / NON ADMISSIBLE ; `undefined` pour le dernier. */
  decision?: string;
}

export interface CandidatReleve {
  nom: string; prenoms: string; matricule: string; dateNaissance?: string; lieuNaissance?: string;
  tours: TourReleve[];
  totalGeneral: number;
  totalGeneralMax: number;
  totalGeneralDemande: number;
  moyenneGenerale: number | null;
  decision: string;
  mention?: string;
}

export interface DonneesReleves {
  ecole: InfosEcole;
  /** « EXAMEN BLANC » ou « EXAMEN ». */
  typeLibelle: string;
  diplome: string;
  option?: string;
  session?: string;
  date?: string;
  centre: string;
  presidentJury?: string;
  /** Une colonne NE si au moins une épreuve a une note éliminatoire. */
  avecNE: boolean;
  candidats: CandidatReleve[];
}

const titreTour = (nom: string) => (/tour/i.test(nom) ? `ÉPREUVES DU ${nom.toUpperCase()}` : `ÉPREUVES : ${nom.toUpperCase()}`);
const nombre = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');

/** Un tableau de tour ; renvoie le y du bas. */
const tableauTour = (doc: jsPDF, c: Palette, t: TourReleve, x: number, y: number, w: number, avecNE: boolean, hLigne: number): number => {
  const wCoef = 11, wNote = 12, wPts = 13, wNE = avecNE ? 10 : 0;
  const wDisc = w - wCoef - wNote - wPts - wNE;
  cellule(doc, x, y, w, 7, titreTour(t.nom), { fond: c.pale, gras: true, taille: 8.6 });
  y += 7;
  let xx = x;
  const entete = [['DISCIPLINE', wDisc], ['COEF', wCoef], ['NOTE', wNote], ['POINTS', wPts], ...(avecNE ? [['NE', wNE]] : [])] as [string, number][];
  for (const [lib, lw] of entete) { cellule(doc, xx, y, lw, 6, lib, { gras: true, taille: 7.4 }); xx += lw; }
  y += 6;
  for (const l of t.lignes) {
    xx = x;
    const valeurs: [string, number, boolean][] = [[l.discipline, wDisc, true], [String(l.coefficient).replace('.', ','), wCoef, false], [l.note, wNote, false], [l.points, wPts, false], ...(avecNE ? [[l.ne ?? '', wNE, false] as [string, number, boolean]] : [])];
    for (const [v, lw, gauche] of valeurs) { cellule(doc, xx, y, lw, hLigne, v, { taille: 8.2, gauche }); xx += lw; }
    y += hLigne;
  }
  return y;
};

const lignesSynthese = (doc: jsPDF, x: number, y: number, w: number, lignes: [string, string][]): number => {
  for (const [lib, val] of lignes) {
    cellule(doc, x, y, w * 0.58, 6.2, lib, { gras: true, taille: 8.2 });
    cellule(doc, x + w * 0.58, y, w * 0.42, 6.2, val, { gras: true, taille: 8.6 });
    y += 6.2;
  }
  return y;
};

const pageReleve = (doc: jsPDF, d: DonneesReleves, k: CandidatReleve, c: Palette) => {
  cadrePage(doc, c);
  let y = enTeteCentre(doc, d.ecole, c);
  const MX = 12;
  const UX = L - 2 * MX;

  // Titre encadré
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.5);
  doc.roundedRect(MX + 14, y, UX - 28, 23, 4, 4, 'S');
  titreSouligne(doc, 'RELEVÉ DE NOTES', y + 7, 12.5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(ENCRE);
  centreAjuste(doc, `${d.typeLibelle} : ${d.diplome}`, y + 14, UX - 36, 10.5);
  const ligne2 = [d.option && `Option ${d.option}`, d.session].filter(Boolean).join(' ');
  if (ligne2) centreAjuste(doc, ligne2, y + 19.5, UX - 36, 10);
  y += 31;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(ENCRE);
  doc.text('IDENTIFICATION DU CANDIDAT :', MX + 2, y);
  if (d.date) doc.text(`DATE : ${dateCourte(d.date)}`, L - MX - 2, y, { align: 'right' });
  y += 4;

  // Identité
  const champs: [string, string][] = [
    ['Matricule', k.matricule], ['Prénom(s)', k.prenoms], ['Nom', k.nom.toUpperCase()],
    ['Date et lieu de naissance', k.dateNaissance ? `${dateCourte(k.dateNaissance)}${k.lieuNaissance ? ` à ${k.lieuNaissance}` : ''}` : '—'],
    ["Centre d'examen", d.centre],
  ];
  doc.setFillColor(c.pale);
  doc.setDrawColor(TRAIT); doc.setLineWidth(0.2);
  doc.rect(MX + 2, y, UX - 4, champs.length * 6.4 + 3, 'FD');
  champs.forEach(([lib, val], i) => {
    const yy = y + 6 + i * 6.4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.4); doc.setTextColor(ENCRE);
    doc.text(lib, MX + 7, yy);
    doc.setFont('helvetica', 'normal');
    ecrireAjuste(doc, val || '—', MX + 70, yy, UX - 76, { taille: 9.4, tailleMin: 7 });
  });
  y += champs.length * 6.4 + 9;

  // Tours : deux côte à côte (comme les relevés d'IFHO), sinon l'un sous l'autre.
  const lignesMax = Math.max(...k.tours.map(t => t.lignes.length));
  const hLigne = Math.min(6, 70 / Math.max(1, lignesMax));
  const syntheseTour = (t: TourReleve): [string, string][] => [
    [`Total ${t.nom}`, `${nombre(t.total)} / ${nombre(t.totalMax)}`],
    ['Total demandé', nombre(t.totalDemande)],
    [`Moyenne ${t.nom}`, t.moyenne === null ? '—' : note(t.moyenne)],
    ...(t.decision ? [['Décision du jury', t.decision] as [string, string]] : []),
  ];
  const syntheseFinale: [string, string][] = [
    ...(k.tours.length > 1 ? [['Total général', `${nombre(k.totalGeneral)} / ${nombre(k.totalGeneralMax)}`] as [string, string], ['Total général demandé', nombre(k.totalGeneralDemande)] as [string, string]] : []),
    [k.tours.length > 1 ? 'Moyenne générale' : 'Moyenne', k.moyenneGenerale === null ? '—' : note(k.moyenneGenerale)],
    ['Décision du jury', k.decision],
    ['Mention', k.mention ?? ''],
  ];

  if (k.tours.length === 2) {
    const w = (UX - 6) / 2;
    const [t1, t2] = k.tours;
    const yBas1 = tableauTour(doc, c, t1, MX, y, w, d.avecNE, hLigne);
    const yBas2 = tableauTour(doc, c, t2, MX + w + 6, y, w, d.avecNE, hLigne);
    let yb = Math.max(yBas1, yBas2) + 3;
    lignesSynthese(doc, MX, yb, w, syntheseTour(t1));
    yb = lignesSynthese(doc, MX + w + 6, yb, w, [...syntheseTour(t2).slice(0, 1), ...syntheseFinale]);
    y = yb;
  } else {
    for (const [i, t] of k.tours.entries()) {
      y = tableauTour(doc, c, t, MX, y, UX, d.avecNE, hLigne) + 2;
      if (i < k.tours.length - 1) y = lignesSynthese(doc, MX + UX / 2, y, UX / 2, syntheseTour(t)) + 4;
    }
    y = lignesSynthese(doc, MX + UX / 2, y, UX / 2, k.tours.length > 1 ? [...syntheseTour(k.tours[k.tours.length - 1]).slice(0, 1), ...syntheseFinale] : syntheseFinale);
  }

  // Président du jury
  const ySign = Math.min(y + 12, 250);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(ENCRE);
  doc.text('Le Président du Jury', L - MX - 34, ySign, { align: 'center' });
  const w = doc.getTextWidth('Le Président du Jury');
  doc.setLineWidth(0.3); doc.line(L - MX - 34 - w / 2, ySign + 1, L - MX - 34 + w / 2, ySign + 1);
  if (d.presidentJury) { doc.setFont('helvetica', 'normal'); doc.text(d.presidentJury, L - MX - 34, ySign + 22, { align: 'center' }); }

  piedEcole(doc, d.ecole, c);
};

/** Un relevé par candidat, chacun sur sa page, dans un seul PDF. */
export async function genererRelevesPdf(d: DonneesReleves): Promise<jsPDF> {
  const c = await palette(d.ecole);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  d.candidats.forEach((k, i) => {
    if (i > 0) doc.addPage('a4', 'portrait');
    pageReleve(doc, d, k, c);
  });
  return doc;
}

// ─── Convocation d'examen ────────────────────────────────────────────────────

export interface DonneesConvocations {
  ecole: InfosEcole;
  examen: { nom: string; typeLibelle: string; reference?: string; dateDebut?: string; dateFin?: string };
  formation: string;
  niveau: string;
  promotion: string;
  planning: LigneConvocation[];
  candidats: { nom: string; prenoms: string; matricule: string; sexe?: string }[];
}

/** Une convocation par candidat, avec le planning de ses épreuves. */
export async function genererConvocationsPdf(d: DonneesConvocations): Promise<jsPDF> {
  const c = await palette(d.ecole);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  d.candidats.forEach((cand, i) => {
    if (i > 0) doc.addPage('a4', 'portrait');
    enTete(doc, d.ecole, c);
    let y = HAUT_BANDEAU + 14;
    dessinerTitre(doc, c, 'CONVOCATION', M, y, 19, 0.4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(c.accent);
    doc.text(`${d.examen.typeLibelle} — ${d.examen.nom}${d.examen.reference ? ` (${d.examen.reference})` : ''}`, M, y + 10);
    y += 17;
    y = encadre(doc, c, y, [
      ['Candidat', `${cand.nom} ${cand.prenoms}`],
      ['Matricule', cand.matricule],
      ['Formation', `${d.formation} — ${d.niveau}`],
      ['Promotion', d.promotion],
    ]);
    y = paragraphe(doc, `${cand.sexe === 'femme' ? 'La candidate' : 'Le candidat'} ci-dessus est ${accord(cand.sexe, 'convoqué')} aux épreuves suivantes :`, y + 2);
    y += 2;

    const cols = [30, U - 30 - 34 - 20 - 32, 34, 20, 32];
    const titres = ['TOUR', 'ÉPREUVE', 'DATE', 'HEURE', 'SALLE'];
    let x = M;
    doc.setFillColor(c.fonce);
    doc.rect(M, y, U, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor('#FFFFFF');
    titres.forEach((t, j) => { doc.text(t, x + 3, y + 5.4); x += cols[j]; });
    y += 8;
    d.planning.forEach((l, j) => {
      if (j % 2 === 1) { doc.setFillColor(c.pale); doc.rect(M, y, U, 7.4, 'F'); }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.4);
      doc.setTextColor(ENCRE);
      const valeurs = [l.tour, l.epreuve, l.date ? dateCourte(l.date) : 'à préciser', l.heure ?? '—', l.salle ?? '—'];
      let xx = M;
      valeurs.forEach((v, k) => { ecrireAjuste(doc, v, xx + 3, y + 5, cols[k] - 5, { taille: 9.4, tailleMin: 7 }); xx += cols[k]; });
      y += 7.4;
    });
    signatureDirection(doc, d.ecole, c, Math.max(y + 14, 200));
    piedDePage(doc, d.ecole, c, 'Convocation à présenter le jour des épreuves.');
  });
  return doc;
}

// ─── Attestation de stage ────────────────────────────────────────────────────

export interface DonneesAttestationStage {
  ecole: InfosEcole;
  eleve: { nom: string; prenoms: string; matricule: string; sexe?: string };
  formation: string;
  niveau: string;
  promotion: string;
  entreprise: string;
  poste?: string;
  dateDebut?: string;
  dateFin?: string;
  duree?: string;
}

export async function genererAttestationStagePdf(d: DonneesAttestationStage): Promise<jsPDF> {
  const c = await palette(d.ecole);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  enTete(doc, d.ecole, c);
  let y = HAUT_BANDEAU + 22;
  dessinerTitre(doc, c, 'ATTESTATION DE STAGE', M, y, 20, 0.4);
  y += 18;
  const periode = d.dateDebut && d.dateFin
    ? ` du ${dateEnLettres(d.dateDebut)} au ${dateEnLettres(d.dateFin)}${d.duree ? ` (${d.duree})` : ''}`
    : '';
  y = paragraphe(doc,
    `Nous soussignés, ${d.ecole.nom}, attestons que ${civilite(d.eleve.sexe)} ${d.eleve.nom} ${d.eleve.prenoms} `
    + `(matricule ${d.eleve.matricule}), ${accord(d.eleve.sexe, 'inscrit')} en ${d.formation} — ${d.niveau} (promotion ${d.promotion}), `
    + `a effectué un stage${d.poste ? ` au poste « ${d.poste} »` : ''} au sein de ${d.entreprise}${periode}.`, y);
  y = paragraphe(doc, 'En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.', y + 4);
  signatureDirection(doc, d.ecole, c, y + 16);
  piedDePage(doc, d.ecole, c);
  return doc;
}

// ─── Documents officiels numérotés ───────────────────────────────────────────

const cartoucheNumero = (doc: jsPDF, c: Palette, numero: string, x: number, y: number) => {
  doc.setFillColor(c.pale);
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.4);
  doc.roundedRect(x - 54, y, 54, 11, 1.6, 1.6, 'FD');
  etiquette(doc, 'N°', x - 51, y + 7, c.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.4);
  doc.setTextColor(c.fonce);
  doc.text(numero, x - 3, y + 7.2, { align: 'right' });
};

const pageAttestation = (doc: jsPDF, d: DocumentOfficiel, ecole: InfosEcole, c: Palette) => {
  const { contenu: k } = d;
  const numero = numeroDocument(d.type, d.annee, d.numero);
  enTete(doc, ecole, c);
  let y = HAUT_BANDEAU + 14;
  cartoucheNumero(doc, c, numero, L - M, y - 4);
  y += 10;
  dessinerTitre(doc, c, d.type === 'attestation_inscription' ? "ATTESTATION D'INSCRIPTION" : 'ATTESTATION DE RÉUSSITE', M, y, 19, 0.4);
  y += 18;
  const e = k.eleve;
  const naissance = e.dateNaissance ? `, ${accord(e.sexe, 'né')} le ${dateEnLettres(e.dateNaissance)}${e.lieuNaissance ? ` à ${e.lieuNaissance}` : ''}` : '';
  const qui = `${civilite(e.sexe)} ${e.nom} ${e.prenoms}${naissance} (matricule ${e.matricule})`;
  if (d.type === 'attestation_inscription') {
    const periode = k.formation.dateDebut || k.formation.dateFin
      ? ` pour la période du ${dateEnLettres(k.formation.dateDebut) || '…'} au ${dateEnLettres(k.formation.dateFin) || '…'}` : '';
    y = paragraphe(doc,
      `La direction de ${k.ecole.nom} atteste que ${qui} est ${accord(e.sexe, 'régulièrement inscrit')} en `
      + `${k.formation.nom} — ${k.formation.niveau}, promotion « ${k.formation.promotion} »`
      + `${k.formation.rythme ? `, cours du ${k.formation.rythme.toLowerCase()}` : ''}${periode}.`, y);
  } else {
    const x = k.examen;
    const session = x ? [x.reference, x.dateDebut && `du ${dateEnLettres(x.dateDebut)}${x.dateFin ? ` au ${dateEnLettres(x.dateFin)}` : ''}`].filter(Boolean).join(', ') : '';
    y = paragraphe(doc,
      `La direction de ${k.ecole.nom} atteste que ${qui}, ${accord(e.sexe, 'inscrit')} en ${k.formation.nom} — ${k.formation.niveau} `
      + `(promotion « ${k.formation.promotion} »), a été ${accord(e.sexe, 'déclaré')} ${e.sexe === 'femme' ? 'ADMISE' : 'ADMIS'} `
      + `à l'${x ? `${libelleTypeExamen(x.type).toLowerCase()} « ${x.nom} »` : 'examen'}${session ? ` (${session})` : ''}`
      + `${x?.mention ? `, avec la mention ${libelleMention(x.mention)}` : ''}`
      + `${x?.moyenne != null ? ` (moyenne ${note(x.moyenne)}/20)` : ''}.`, y);
  }
  y = paragraphe(doc, 'En foi de quoi, la présente attestation est délivrée pour servir et valoir ce que de droit.', y + 4);
  signatureDirection(doc, k.ecole, c, y + 16, d.emisLe);
  piedDePage(doc, k.ecole, c, `${numero} — document émis le ${dateDakar(d.emisLe)}, réimpression à l'identique.`);
};

/** Diplôme : A4 paysage, cadre double, le nom en grand. */
const pageDiplome = (doc: jsPDF, d: DocumentOfficiel, ecole: InfosEcole, c: Palette) => {
  const { contenu: k } = d;
  const LP = 297; const HP = 210;
  const numero = numeroDocument(d.type, d.annee, d.numero);
  filigrane(doc, ecole, LP, HP, 120, c.fonce);
  doc.setDrawColor(c.fonce); doc.setLineWidth(1.4); doc.rect(8, 8, LP - 16, HP - 16, 'S');
  doc.setDrawColor(c.accent); doc.setLineWidth(0.4); doc.rect(11, 11, LP - 22, HP - 22, 'S');
  guilloche(doc, c, LP, HP - 22, 8);

  doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(c.fonce);
  doc.text(k.ecole.nom.toUpperCase(), LP / 2, 30, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(GRIS);
  const refs = [k.ecole.autorisation && `Autorisation d'ouverture n° ${k.ecole.autorisation}`, k.ecole.rc && `RC ${k.ecole.rc}`, k.ecole.ninea && `NINEA ${k.ecole.ninea}`]
    .filter(Boolean).join('  ·  ');
  if (refs) doc.text(refs, LP / 2, 36, { align: 'center' });

  doc.setFont('times', 'bold'); doc.setFontSize(36); doc.setTextColor(c.fonce);
  doc.text(titreDiplome(k.formation.typeDiplome).toUpperCase(), LP / 2, 62, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(ENCRE);
  doc.text(`de ${k.formation.nom}`, LP / 2, 72, { align: 'center' });

  doc.setFontSize(11);
  doc.text(`décerné à`, LP / 2, 90, { align: 'center' });
  doc.setFont('times', 'bold'); doc.setFontSize(26); doc.setTextColor(c.fonce);
  doc.text(`${k.eleve.nom.toUpperCase()} ${k.eleve.prenoms}`, LP / 2, 103, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(ENCRE);
  const e = k.eleve;
  if (e.dateNaissance) doc.text(`${accord(e.sexe, 'né')} le ${dateEnLettres(e.dateNaissance)}${e.lieuNaissance ? ` à ${e.lieuNaissance}` : ''}`, LP / 2, 112, { align: 'center' });
  const x = k.examen;
  doc.text(
    `pour avoir satisfait aux épreuves de l'${x ? `${libelleTypeExamen(x.type).toLowerCase()} « ${x.nom} »` : 'examen'}${x?.reference ? ` — ${x.reference}` : ''}`,
    LP / 2, 124, { align: 'center' },
  );
  if (x?.mention) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(c.accent);
    doc.text(`Mention ${libelleMention(x.mention)}`, LP / 2, 133, { align: 'center' });
  }

  cartoucheNumero(doc, c, numero, 90, 150);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(ENCRE);
  doc.text(`Fait${k.ecole.ville ? ` à ${k.ecole.ville}` : ''}, le ${dateEnLettres(dateDakar(d.emisLe).split('/').reverse().join('-'))}`, LP - 30, 152, { align: 'right' });
  etiquette(doc, 'La direction', LP - 60, 160, GRIS, 'center');
  doc.setDrawColor(GRIS); doc.setLineWidth(0.3); doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(LP - 90, 180, LP - 30, 180);
  doc.setLineDashPattern([], 0);
  signatureSenClass(doc, c, LP - 14, HP - 13);
};

/** Un document officiel déjà émis (ou qui vient de l'être) : il s'imprime depuis son contenu figé. */
export async function genererDocumentOfficielPdf(d: DocumentOfficiel, logo: string | null | undefined): Promise<jsPDF> {
  const ecole: InfosEcole = { ...d.contenu.ecole, logo: logo ?? null };
  const c = await palette(ecole);
  const orientation = d.type === 'diplome' ? 'landscape' : 'portrait';
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation });
  if (d.type === 'diplome') pageDiplome(doc, d, ecole, c);
  else pageAttestation(doc, d, ecole, c);
  return doc;
}

export const TITRES_PDF: Record<TypeDocumentOfficiel, string> = {
  attestation_inscription: 'Attestation_inscription',
  attestation_reussite: 'Attestation_reussite',
  diplome: 'Diplome',
};
