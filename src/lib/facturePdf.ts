import jsPDF from 'jspdf';
import type { InfosEcole } from '@/lib/documentsEcole';
import { dateLongueDakar } from '@/lib/documentsEcole';
import {
  ENCRE, FILET, GRIS, alerte, blocFort, dessinerBandeau, dessinerTitre, ecrireAjuste, espace, etiquette,
  filigrane, guilloche, opacite, signatureSenClass,
} from '@/lib/documentsDesign';
import { couleurDominanteDuLogo, paletteDepuis, PALETTE_ECONOMIQUE, type Palette } from '@/lib/couleurLogo';
import { formaterMontant, montantEnLettres } from '@/lib/montantEnLettres';
import { jourEnLettres, type LigneFacture, type TypeFacture } from '@/lib/facture';

// ═══════════════════════════════════════════════════════════════════════════
// FACTURE ET RAPPEL — PDF vectoriel, A4 portrait.
//
// Même maison que le reçu et la fiche d'inscription : bandeau aux couleurs du
// logo, titres à empattements, filigrane, motif guilloché. Ce qu'une famille
// doit lire d'un coup d'œil, dans cet ordre :
//   1. combien (le total, encadré, en chiffres ET en lettres) ;
//   2. avant quand (la date limite, dans un bandeau à part) ;
//   3. pour quoi (le détail, mois par mois, avec ce qui est déjà versé).
//
// Le rappel reprend la même page, avec un bandeau rouge qui cite la facture
// d'origine et le nombre de jours de retard : impossible de le prendre pour
// une première facture. Le sens ne repose jamais sur la seule couleur.
//
// Plusieurs factures (une classe, toute l'école) = un seul PDF, une facture
// par page — on imprime le tout d'un coup.
// ═══════════════════════════════════════════════════════════════════════════

const L = 210;
const H = 297;
const M = 16;
const U = L - 2 * M;

export interface FactureDoc {
  type: TypeFacture;
  numero: string;
  /** Date d'émission (ISO). */
  emiseLe: string;
  /** « 2026-10-31 » */
  dateLimite: string;
  anneeScolaire: string;
  eleve: { nom: string; matricule: string; classe?: string };
  /** Le tuteur principal : c'est à lui que la facture est adressée. */
  tuteur?: { nom?: string; telephone?: string };
  lignes: LigneFacture[];
  total: number;
  /** Rappel : la facture qu'il relance. */
  origine?: { numero: string; emiseLe: string; dateLimite: string };
  duplicata?: boolean;
}

type Etat = { doc: jsPDF; c: Palette; ecole: InfosEcole; f: FactureDoc };

export { jourEnLettres };

/** Jours entre deux « AAAA-MM-JJ ». */
const ecartJours = (de: string, a: string): number =>
  Math.round((Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${de.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

const emiseLe = (iso: string): string => dateLongueDakar(iso).split(' à ')[0];

// ─── Blocs ────────────────────────────────────────────────────────────────────

const titre = ({ doc, c, f }: Etat, y: number): number => {
  const rappel = f.type === 'rappel';
  dessinerTitre(doc, c, rappel ? 'RAPPEL DE PAIEMENT' : 'FACTURE', M, y + 7, 21, 0.36);

  const w = 54;
  const x = L - M - w;
  doc.setFillColor(c.pale);
  doc.setDrawColor(rappel ? alerte(c) : c.accent);
  doc.setLineWidth(0.45);
  doc.roundedRect(x, y - 1, w, 14, 2, 2, 'FD');
  etiquette(doc, rappel ? 'Rappel n°' : 'Facture n°', x + w / 2, y + 3.4, rappel ? alerte(c) : c.accent, 'center');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(c.fonce);
  doc.text(f.numero, x + w / 2, y + 10, { align: 'center' });

  if (f.duplicata) {
    doc.setFontSize(7.4);
    doc.setTextColor(GRIS);
    doc.setDrawColor(GRIS);
    doc.setLineWidth(0.3);
    doc.roundedRect(x + w - 23, y + 15, 23, 5.2, 1, 1, 'S');
    espace(doc, 'DUPLICATA', x + w - 11.5, y + 18.7, 0.2, 'center');
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.4);
  doc.setTextColor(GRIS);
  doc.text(`Émise le ${emiseLe(f.emiseLe)}  ·  Année scolaire ${f.anneeScolaire}`, M, y + 17);
  return y + 25;
};

/** Deux cartes côte à côte : l'élève concerné, et à qui la facture est adressée. */
const cartes = ({ doc, c, f }: Etat, y: number): number => {
  const h = 31;
  const w = (U - 6) / 2;
  const carte = (x: number, titreCarte: string) => {
    doc.setFillColor(c.pale);
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
    doc.setFillColor(c.accent);
    doc.roundedRect(x, y, 2, h, 1, 1, 'F');
    etiquette(doc, titreCarte, x + 7, y + 6, c.accent);
  };

  carte(M, 'Élève');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ENCRE);
  ecrireAjuste(doc, f.eleve.nom, M + 7, y + 13, w - 11, { taille: 13, tailleMin: 9 });
  const sous: [string, string][] = [['Matricule', f.eleve.matricule], ['Classe', f.eleve.classe ?? '—']];
  sous.forEach(([nom, valeur], i) => {
    const x = M + 7 + i * ((w - 9) / 2);
    etiquette(doc, nom, x, y + 20, GRIS);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(ENCRE);
    ecrireAjuste(doc, valeur, x, y + 25.6, (w - 9) / 2 - 3, { taille: 9.6, tailleMin: 7 });
  });

  const x2 = M + w + 6;
  carte(x2, 'Adressée à');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ENCRE);
  ecrireAjuste(doc, f.tuteur?.nom?.trim() || 'Parent / tuteur de l\'élève', x2 + 7, y + 13, w - 11, { taille: 12, tailleMin: 9 });
  etiquette(doc, 'Téléphone', x2 + 7, y + 20, GRIS);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.6);
  doc.setTextColor(ENCRE);
  doc.text(f.tuteur?.telephone?.trim() || '—', x2 + 7, y + 25.6);
  return y + h + 6;
};

/** La date limite, à part — c'est la deuxième chose qu'on cherche. */
const echeance = ({ doc, c, f }: Etat, y: number): number => {
  if (f.type === 'rappel' && f.origine) {
    const retard = Math.max(0, ecartJours(f.origine.dateLimite, f.emiseLe));
    const h = 21;
    const rouge = alerte(c);
    if (c.economique) {
      // Sans couleur, le double cadre dit « attention ».
      blocFort(doc, c, M, y, U, h, rouge, true);
    } else {
      doc.setFillColor('#FEF2F2');
      doc.setDrawColor(rouge);
      doc.setLineWidth(0.5);
      doc.roundedRect(M, y, U, h, 2, 2, 'FD');
      doc.setFillColor(rouge);
      doc.roundedRect(M, y, 2.2, h, 1, 1, 'F');
    }
    etiquette(doc, 'Échéance dépassée', M + 7, y + 6, rouge);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.4);
    doc.setTextColor(ENCRE);
    const texte = `La facture ${f.origine.numero} du ${emiseLe(f.origine.emiseLe)} devait être réglée au plus tard le `
      + `${jourEnLettres(f.origine.dateLimite)}${retard > 0 ? `, soit ${retard} jour${retard > 1 ? 's' : ''} de retard` : ''}.`;
    ecrireAjuste(doc, texte, M + 7, y + 11.6, U - 70, { taille: 9.4, tailleMin: 7.6, lignesMax: 2, interligne: 4 });

    etiquette(doc, 'Nouvelle date limite', L - M - 5, y + 6, rouge, 'right');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(rouge);
    doc.text(jourEnLettres(f.dateLimite), L - M - 5, y + 14, { align: 'right' });
    return y + h + 7;
  }

  const h = 16;
  const texte = blocFort(doc, c, M, y, U, h);
  doc.setTextColor(texte);
  doc.saveGraphicsState();
  opacite(doc, 0.85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  espace(doc, 'À RÉGLER AU PLUS TARD LE', M + 7, y + 6.4, 0.22);
  doc.restoreGraphicsState();
  doc.setTextColor(texte);
  doc.setFont('times', 'bold');
  doc.setFontSize(15);
  doc.text(jourEnLettres(f.dateLimite), M + 7, y + 12.8);

  doc.saveGraphicsState();
  opacite(doc, 0.85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  espace(doc, 'MONTANT À PAYER', L - M - 7, y + 6.4, 0.22, 'right');
  doc.restoreGraphicsState();
  doc.setTextColor(texte);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`${formaterMontant(f.total)} FCFA`, L - M - 7, y + 12.8, { align: 'right' });
  return y + h + 7;
};

// Colonnes du tableau : désignation, montant, déjà versé, reste.
const COL_RESTE = L - M - 2;
const COL_VERSE = COL_RESTE - 32;
const COL_MONTANT = COL_VERSE - 30;
const LARGEUR_DESIGNATION = COL_MONTANT - 26 - M;
const PAS = 8.2;

const enteteTableau = ({ doc, c }: Etat, y: number): number => {
  etiquette(doc, 'Désignation', M + 2, y + 3.6, c.accent);
  etiquette(doc, 'Montant', COL_MONTANT, y + 3.6, c.accent, 'right');
  etiquette(doc, 'Déjà versé', COL_VERSE, y + 3.6, c.accent, 'right');
  etiquette(doc, 'Reste à payer', COL_RESTE, y + 3.6, c.accent, 'right');
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.5);
  doc.line(M, y + 5.6, L - M, y + 5.6);
  return y + 5.6;
};

const ligneTableau = ({ doc, c }: Etat, l: LigneFacture, y: number, rang: number) => {
  if (rang % 2 === 1) { doc.setFillColor(c.pale); doc.rect(M, y, U, PAS, 'F'); }
  const base = y + 5.4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.8);
  doc.setTextColor(ENCRE);
  const largeurPastille = l.en_retard ? 18 : 0;
  ecrireAjuste(doc, l.designation, M + 2, base, LARGEUR_DESIGNATION - largeurPastille, { taille: 9.8, tailleMin: 7.6 });
  if (l.en_retard) {
    // « En retard » : une pastille avec son texte — lisible en noir et blanc.
    const x = M + 2 + Math.min(doc.getTextWidth(l.designation), LARGEUR_DESIGNATION - largeurPastille) + 2.5;
    doc.setDrawColor(alerte(c));
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y + 2.2, 15.5, 4, 1, 1, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(alerte(c));
    espace(doc, 'EN RETARD', x + 7.75, y + 5, 0.15, 'center');
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.8);
  doc.setTextColor(GRIS);
  doc.text(formaterMontant(l.montant), COL_MONTANT, base, { align: 'right' });
  doc.text(l.deja_verse > 0 ? formaterMontant(l.deja_verse) : '—', COL_VERSE, base, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ENCRE);
  doc.text(formaterMontant(l.reste), COL_RESTE, base, { align: 'right' });
  doc.setDrawColor(FILET);
  doc.setLineWidth(0.15);
  doc.line(M, y + PAS, L - M, y + PAS);
};

const enTeteDeSuite = ({ doc, c, ecole, f }: Etat): number => {
  if (c.economique) {
    doc.setDrawColor(c.fonce);
    doc.setLineWidth(0.6);
    doc.line(M, 15, L - M, 15);
  } else {
    doc.setFillColor(c.fonce);
    doc.rect(0, 0, L, 15, 'F');
  }
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(c.economique ? c.fonce : '#FFFFFF');
  doc.text(ecole.nom.toUpperCase(), M, 9.4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  doc.text(`${f.type === 'rappel' ? 'Rappel' : 'Facture'} ${f.numero} — ${f.eleve.nom} — suite`, L - M, 9.4, { align: 'right' });
  return 24;
};

const blocTotal = ({ doc, c, f }: Etat, y: number): number => {
  const w = 96;
  const h = 17;
  const x = L - M - w;
  const rappel = f.type === 'rappel';
  const texte = blocFort(doc, c, x, y, w, h, rappel ? alerte(c) : c.fonce, rappel);
  doc.setTextColor(texte);
  doc.saveGraphicsState();
  opacite(doc, 0.85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  espace(doc, 'TOTAL À PAYER', x + 6, y + 10.4, 0.22);
  doc.restoreGraphicsState();
  doc.setTextColor(texte);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(formaterMontant(f.total), x + w - 17, y + 11.6, { align: 'right' });
  doc.setFontSize(8.6);
  doc.text('FCFA', x + w - 5.5, y + 11.4, { align: 'right' });

  // À gauche : le compte des éléments et ce qui est déjà versé, pour situer le total.
  const verse = f.lignes.reduce((s, l) => s + l.deja_verse, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(GRIS);
  doc.text(`${f.lignes.length} élément${f.lignes.length > 1 ? 's' : ''} à régler`, M, y + 7);
  if (verse > 0) doc.text(`Acomptes déjà déduits : ${formaterMontant(verse)} FCFA`, M, y + 12);
  return y + h;
};

const lettres = ({ doc, c, f }: Etat, y: number): number => {
  etiquette(doc, `Arrêté${f.type === 'rappel' ? ' le présent rappel' : 'e la présente facture'} à la somme de`, M, y + 2.6, GRIS);
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(12);
  doc.setTextColor(c.fonce);
  // Toute la somme, sur autant de lignes qu'il faut : la couper changerait le montant.
  const lignes = doc.splitTextToSize(`${montantEnLettres(f.total)}.`, U - 6) as string[];
  const h = 3.4 + lignes.length * 5.4;
  doc.setFillColor(c.accent);
  doc.rect(M, y + 5, 0.9, h, 'F');
  lignes.forEach((l, i) => doc.text(l, M + 4, y + 9.6 + i * 5.4));
  return y + 5 + h + 4;
};

/** Bas de facture : les modalités à gauche, la signature et le cachet à droite. */
const LARGEUR_SIGNATURE = 58;

const modalites = ({ doc, c, f }: Etat, y: number): number => {
  const textes = [
    'Règlement à la caisse de l\'école, en présentant cette facture.',
    `Les paiements enregistrés jusqu'au ${emiseLe(f.emiseLe)} sont déjà déduits.`,
    f.type === 'rappel'
      ? 'Si vous avez réglé entre-temps, merci de ne pas tenir compte de ce rappel.'
      : 'Un reçu numéroté vous sera remis à chaque paiement.',
  ];
  const largeur = U - LARGEUR_SIGNATURE - 8;
  doc.setDrawColor(FILET);
  doc.setLineWidth(0.3);
  doc.line(M, y, L - M, y);
  etiquette(doc, 'Modalités de paiement', M, y + 6, c.accent);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(ENCRE);
  let yy = y + 11.4;
  for (const t of textes) {
    const lignes = doc.splitTextToSize(t, largeur - 4) as string[];
    doc.text('•', M, yy);
    lignes.forEach((l, i) => doc.text(l, M + 3.5, yy + i * 4.2));
    yy += lignes.length * 4.2 + 1;
  }
  return yy;
};

const signature = ({ doc, c }: Etat, y: number) => {
  const w = LARGEUR_SIGNATURE;
  const x = L - M - w;
  etiquette(doc, 'La direction', x + w / 2, y + 6, GRIS, 'center');
  // Emplacement du cachet, au-dessus du trait de signature.
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.2, 1.4], 0);
  doc.circle(x + w / 2, y + 17, 9, 'S');
  doc.setLineDashPattern([], 0);
  etiquette(doc, 'Cachet', x + w / 2, y + 17.9, c.accent, 'center');
  doc.setDrawColor(GRIS);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(x + 4, y + 30, x + w - 4, y + 30);
  doc.setLineDashPattern([], 0);
};

const pied = ({ doc, c, ecole }: Etat) => {
  guilloche(doc, c, L, H - 10, 10);
  const lignes = (ecole.piedDePage ?? '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(GRIS);
  lignes.forEach((l, i) => ecrireAjuste(doc, l, M, H - 20.5 + i * 3.6, U - 50, { taille: 7.4, tailleMin: 6 }));
  if (lignes.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.text('Document à conserver jusqu\'au règlement complet.', M, H - 14);
  }
  signatureSenClass(doc, c, L - M, H - 14);
};

// ─── Assemblage ───────────────────────────────────────────────────────────────

const dessinerFacture = (e: Etat) => {
  const { doc, ecole, c, f } = e;
  filigrane(doc, ecole, L, H, 120, c.fonce);
  dessinerBandeau(doc, ecole, c, { largeurPage: L, marge: M, hauteur: 36 });
  let y = titre(e, 36 + 12);
  y = cartes(e, y);
  y = echeance(e, y);

  y = enteteTableau(e, y);
  let rang = 0;
  for (const ligne of f.lignes) {
    if (y + PAS > H - 40) {
      pied(e);
      doc.addPage('a4', 'portrait');
      filigrane(doc, ecole, L, H, 120, c.fonce);
      y = enteteTableau(e, enTeteDeSuite(e));
      rang = 0;
    }
    ligneTableau(e, ligne, y, rang++);
    y += PAS;
  }

  // Total, lettres, modalités et signature : ensemble, sur la même page.
  const besoin = 6 + 17 + 31 + 34;
  if (y + besoin > H - 22) {
    pied(e);
    doc.addPage('a4', 'portrait');
    filigrane(doc, ecole, L, H, 120, c.fonce);
    y = enTeteDeSuite(e);
  }
  y = blocTotal(e, y + 6);
  y = lettres(e, y + 6);
  modalites(e, y + 2);
  signature(e, y + 2);
  pied(e);
};

/** Une ou plusieurs factures dans UN seul PDF, chacune commençant sur une nouvelle page. */
export async function genererFacturesPdf(
  ecole: InfosEcole, factures: FactureDoc[], couleur?: string | null,
  /** Imprimante noir et blanc : aucun grand aplat (Paramètres → École). */
  options: { economique?: boolean } = {},
): Promise<jsPDF> {
  if (factures.length === 0) throw new Error('Aucune facture à imprimer');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const premiere = factures[0];
  doc.setProperties({
    title: factures.length === 1
      ? `${premiere.type === 'rappel' ? 'Rappel' : 'Facture'} ${premiere.numero}`
      : `${factures.length} ${premiere.type === 'rappel' ? 'rappels' : 'factures'}`,
    subject: factures.length === 1 ? `${premiere.eleve.nom}` : ecole.nom,
    author: ecole.nom,
    creator: 'SenClass',
  });
  const c = options.economique
    ? PALETTE_ECONOMIQUE
    : paletteDepuis(couleur !== undefined ? couleur : await couleurDominanteDuLogo(ecole.logo));
  factures.forEach((f, i) => {
    if (i > 0) doc.addPage('a4', 'portrait');
    dessinerFacture({ doc, c, ecole, f });
  });
  return doc;
}
