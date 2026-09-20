import jsPDF from 'jspdf';
import type { RecuData } from '@/lib/recu';
import { dateDakar, dateLongueDakar } from '@/lib/documentsEcole';
import {
  ENCRE, FILET, GRIS, ROUGE, VERT_TAMPON, dessinerBandeau, dessinerTitre, ecrireAjuste, espace, etiquette,
  filigrane, guilloche, opacite, polygone, signatureSenClass, texteTourne, tourne,
} from '@/lib/documentsDesign';
import { couleurDominanteDuLogo, paletteDepuis, type Palette } from '@/lib/couleurLogo';
import { formaterMontant, montantEnLettres } from '@/lib/montantEnLettres';

// ═══════════════════════════════════════════════════════════════════════════
// REÇU DE PAIEMENT — PDF vectoriel, A5 portrait.
//
// Un document officiel, pas un formulaire : bandeau aux couleurs de l'école
// (tirées de son logo), typographie à empattements pour les titres, filigrane du
// logo, motif de sécurité, tampon « ACQUITTÉ », emplacement de cachet.
//
// Tout est dessiné avec les primitives de jsPDF : net à toute taille, léger, et
// toujours lisible sur une imprimante noir et blanc (le sens ne repose jamais
// sur la seule couleur : le total est encadré, le tampon a un texte).
//
// Le montant est écrit en chiffres ET en lettres : en chiffres seul, 25 000 se
// falsifie en 125 000 d'un coup de stylo.
// ═══════════════════════════════════════════════════════════════════════════

const L = 148;                     // largeur de la page
const H = 210;                     // hauteur de la page
const M = 11;                      // marge
const U = L - 2 * M;               // largeur utile

/**
 * Deux densités. Un reçu ordinaire (jusqu'à 4 lignes) respire ; au-delà, on
 * resserre pour qu'un encaissement de six mois + inscription + service tienne
 * encore sur UNE page — c'est la page que l'on agrafe, pas deux.
 */
interface Dims {
  bandeau: number;      // hauteur du bandeau
  k: number;            // facteur appliqué aux positions internes du bandeau
  titre: number;        // hauteur du bloc titre
  carte: number;        // hauteur de la carte élève
  pas: number;          // hauteur d'une ligne du tableau
  basTableau: number;   // ordonnée au-delà de laquelle le tableau passe à la page suivante
  hTotal: number;       // hauteur du bloc total
  signatures: number;   // ordonnée minimale du haut des signatures, depuis le bas
  cachet: number;       // rayon du cachet
}

const NORMALE: Dims = { bandeau: 32, k: 1, titre: 20.5, carte: 22.5, pas: 6.8, basTableau: H - 84, hTotal: 13.6, signatures: 46, cachet: 10.5 };
const COMPACTE: Dims = { bandeau: 27, k: 0.85, titre: 17.5, carte: 19.5, pas: 5.6, basTableau: H - 76, hTotal: 12.4, signatures: 40, cachet: 8.5 };

/** Au-delà de ce nombre de lignes, le reçu passe en mode compact. */
export const LIGNES_MODE_NORMAL = 4;

type Etat = { doc: jsPDF; c: Palette; data: RecuData; d: Dims };

// ─── Petits outils ────────────────────────────────────────────────────────────

/** Un rectangle tourné, à double filet : la marque d'un tampon. */
const cadreTampon = (doc: jsPDF, cx: number, cy: number, w: number, h: number, angle: number, couleur: string) => {
  doc.setDrawColor(couleur);
  doc.setLineWidth(0.9);
  polygone(doc, [tourne(cx, cy, -w / 2, -h / 2, angle), tourne(cx, cy, w / 2, -h / 2, angle),
                 tourne(cx, cy, w / 2, h / 2, angle), tourne(cx, cy, -w / 2, h / 2, angle)], 'S');
  doc.setLineWidth(0.3);
  const d = 1.3;
  polygone(doc, [tourne(cx, cy, -w / 2 + d, -h / 2 + d, angle), tourne(cx, cy, w / 2 - d, -h / 2 + d, angle),
                 tourne(cx, cy, w / 2 - d, h / 2 - d, angle), tourne(cx, cy, -w / 2 + d, h / 2 - d, angle)], 'S');
};

// ─── Blocs ────────────────────────────────────────────────────────────────────

const titre = ({ doc, c, data, d }: Etat, y: number): number => {
  dessinerTitre(doc, c, 'REÇU DE PAIEMENT', M, y + 6.4);

  // Le numéro, en pastille : c'est ce que l'on cite au téléphone.
  const w = 40;
  const x = L - M - w;
  doc.setFillColor(c.pale);
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y - 0.5, w, 12.4, 1.8, 1.8, 'FD');
  etiquette(doc, 'Reçu n°', x + w / 2, y + 3.4, c.accent, 'center');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.6);
  doc.setTextColor(c.fonce);
  doc.text(data.numero, x + w / 2, y + 9, { align: 'center' });

  if (data.duplicata) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(GRIS);
    doc.setDrawColor(GRIS);
    doc.setLineWidth(0.3);
    doc.roundedRect(x + w - 21, y + 13.4, 21, 4.8, 1, 1, 'S');
    espace(doc, 'DUPLICATA', x + w - 10.5, y + 16.8, 0.2, 'center');
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  doc.setTextColor(GRIS);
  doc.text(`Émis le ${dateLongueDakar(data.date)}`, M, y + 15.6);
  return y + d.titre;
};

const carteEleve = ({ doc, c, data, d }: Etat, y: number): number => {
  const h = d.carte;
  const k = h / 22.5;
  doc.setFillColor(c.pale);
  doc.roundedRect(M, y, U, h, 1.8, 1.8, 'F');
  doc.setFillColor(c.accent);
  doc.roundedRect(M, y, 2, h, 1, 1, 'F');

  etiquette(doc, 'Reçu de', M + 7, y + 5.4 * k, c.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(ENCRE);
  ecrireAjuste(doc, data.eleve.nom, M + 7, y + 11 * k, U - 12, { taille: 13, tailleMin: 9.5 });

  const colonnes: [string, string][] = [
    ['Matricule', data.eleve.matricule],
    ['Classe', data.eleve.classe ?? '—'],
    ['Année scolaire', data.anneeScolaire],
  ];
  const largeur = (U - 9) / 3;
  colonnes.forEach(([nom, valeur], i) => {
    const x = M + 7 + i * largeur;
    etiquette(doc, nom, x, y + 15.6 * k, GRIS);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.4);
    doc.setTextColor(ENCRE);
    ecrireAjuste(doc, valeur, x, y + 20 * k, largeur - 3, { taille: 9.4, tailleMin: 7 });
  });
  return y + h + (d.k < 1 ? 3.5 : 5);
};

const enteteTableau = ({ doc, c }: Etat, y: number): number => {
  etiquette(doc, 'Désignation', M + 1, y + 3.4, c.accent);
  etiquette(doc, 'Montant (FCFA)', L - M - 1, y + 3.4, c.accent, 'right');
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.5);
  doc.line(M, y + 5.2, L - M, y + 5.2);
  return y + 5.2;
};

const enTeteDeSuite = ({ doc, c, data }: Etat): number => {
  doc.setFillColor(c.fonce);
  doc.rect(0, 0, L, 14, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor('#FFFFFF');
  doc.text(`${data.ecole.nom.toUpperCase()}`, M, 8.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Reçu ${data.numero} — suite`, L - M, 8.6, { align: 'right' });
  return 22;
};

const ligneTableau = ({ doc, c, d }: Etat, l: RecuData['lignes'][number], y: number, rang: number) => {
  const pas = d.pas;
  const h = pas / 6.8;
  if (rang % 2 === 1) { doc.setFillColor(c.pale); doc.rect(M, y, U, pas, 'F'); }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.6);
  doc.setTextColor(l.annulee ? GRIS : ENCRE);
  const designation = l.annulee ? `${l.designation} (annulé)` : l.designation;
  const ligneY = y + 4.6 * (0.55 + 0.45 * h);
  // Désignation entière : on rétrécit un peu avant de tronquer (« … » visible).
  ecrireAjuste(doc, designation, M + 1, ligneY, U - 42, { taille: 9.6, tailleMin: 7.6 });
  const coupe = designation;
  doc.setFont('helvetica', 'bold');
  doc.text(formaterMontant(l.montant), L - M - 1, y + 4.6 * (0.55 + 0.45 * h), { align: 'right' });
  if (l.annulee) {
    doc.setDrawColor(GRIS);
    doc.setLineWidth(0.25);
    doc.line(M + 1, y + 3.6 * (0.55 + 0.45 * h), M + 1 + Math.min(doc.getTextWidth(coupe), U - 42), y + 3.6 * (0.55 + 0.45 * h));
  }
  doc.setDrawColor(FILET);
  doc.setLineWidth(0.15);
  doc.line(M, y + pas, L - M, y + pas);
};

/** Le total : un bloc plein, encadré — lisible même sans couleur à l'impression. */
const blocTotal = ({ doc, c, data, d }: Etat, y: number, annule: boolean): number => {
  const montant = annule ? data.lignes.reduce((s, l) => s + l.montant, 0) : data.total;
  const w = 84;
  const x = L - M - w;
  doc.setFillColor(annule ? GRIS : c.fonce);
  doc.roundedRect(x, y, w, d.hTotal, 1.8, 1.8, 'F');
  const dy = d.hTotal - 13.6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor('#FFFFFF');
  opacite(doc, 0.85);
  espace(doc, annule ? 'TOTAL ANNULÉ' : 'TOTAL PAYÉ', x + 5, y + 5.6 + dy / 2, 0.22);
  opacite(doc, 1);
  doc.setFontSize(17);
  doc.text(`${formaterMontant(montant)}`, x + w - 15.5, y + 10.6 + dy, { align: 'right' });
  doc.setFontSize(8.4);
  doc.text('FCFA', x + w - 5, y + 10.4 + dy, { align: 'right' });
  return y + d.hTotal;
};

const tamponAcquitte = ({ doc, data }: Etat, cx: number, cy: number) => {
  doc.saveGraphicsState();
  opacite(doc, 0.88);
  cadreTampon(doc, cx, cy, 34, 15.5, 11, VERT_TAMPON);
  doc.setTextColor(VERT_TAMPON);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  texteTourne(doc, 'ACQUITTÉ', cx, cy - 1.4, 11, 0.4);
  doc.setFontSize(6.6);
  texteTourne(doc, dateDakar(data.date), cx, cy + 4.2, 11, 0.12);
  doc.restoreGraphicsState();
};

const lettres = ({ doc, c, data }: Etat, y: number): number => {
  etiquette(doc, 'Arrêté le présent reçu à la somme de', M, y + 2.6, GRIS);
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(11.6);
  doc.setTextColor(c.fonce);
  // TOUTES les lignes nécessaires : la somme en lettres est ce qui protège le
  // reçu d'une falsification. La couper, c'est écrire un autre montant.
  const lignes = doc.splitTextToSize(`${montantEnLettres(data.total)}.`, U - 6) as string[];
  const h = 3.4 + lignes.length * 5.2;
  doc.setFillColor(c.accent);
  doc.rect(M, y + 5, 0.9, h, 'F');
  lignes.forEach((l, i) => doc.text(l, M + 4, y + 9.4 + i * 5.2));
  return y + 5 + h + 2.4;
};

const infosPaiement = ({ doc, c, data }: Etat, y: number): number => {
  doc.setDrawColor(FILET);
  doc.setLineWidth(0.3);
  doc.line(M, y, L - M, y);
  // « Encaissé par » est souvent une adresse e-mail (le caissier n'a pas de nom
  // renseigné) : c'est la colonne la plus large. Les trois valeurs sont écrites en
  // entier — rétrécies, puis sur deux lignes, jamais coupées en silence.
  const parts = [0.27, 0.23, 0.5];
  const infos: [string, string | undefined][] = [
    ['Mode de paiement', data.mode || '—'],
    ['Référence', data.reference],
    ['Encaissé par', data.encaissePar],
  ];
  let x = M;
  let lignesMax = 1;
  infos.forEach(([nom, valeur], i) => {
    const largeur = U * parts[i];
    etiquette(doc, nom, x, y + 4.6, c.accent);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ENCRE);
    lignesMax = Math.max(lignesMax, ecrireAjuste(doc, valeur && valeur.trim() ? valeur : '—', x, y + 9.4, largeur - 3, {
      taille: 9, tailleMin: 7.4, lignesMax: 2, interligne: 3.4,
    }));
    x += largeur;
  });
  return y + 12 + (lignesMax - 1) * 3.4;
};

const signatures = ({ doc, c, d }: Etat, y: number) => {
  const colonne = (U - 30) / 2;
  const trait = (x: number, legende: string) => {
    doc.setDrawColor(GRIS);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(x, y + d.cachet * 2 - 5.5, x + colonne, y + d.cachet * 2 - 5.5);
    doc.setLineDashPattern([], 0);
    etiquette(doc, legende, x + colonne / 2, y + d.cachet * 2 - 1.6, GRIS, 'center');
  };
  trait(M, 'Le parent / tuteur');
  trait(L - M - colonne, 'Le caissier');

  // Emplacement du cachet : un cercle en pointillés, pour qu'on sache où frapper.
  const cx = L / 2;
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.2, 1.4], 0);
  doc.circle(cx, y + d.cachet, d.cachet, 'S');
  doc.setLineDashPattern([], 0);
  etiquette(doc, 'Cachet', cx, y + d.cachet + 0.9, c.accent, 'center');
};

const pied = ({ doc, c }: Etat, y: number) => {
  guilloche(doc, c, L, H - 9.2, 9.2);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(GRIS);
  doc.text('Ce reçu fait foi de paiement : conservez-le précieusement.', M, y);
  signatureSenClass(doc, c, L - M, y);
};

/** Reçu annulé : impossible de le confondre avec un reçu valable. */
const marqueAnnule = ({ doc, data }: Etat, yLegende: number) => {
  doc.saveGraphicsState();
  opacite(doc, 0.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(58);
  doc.setTextColor(ROUGE);
  texteTourne(doc, 'ANNULÉ', L / 2, H / 2 + 6, 33, 0.9);
  doc.restoreGraphicsState();

  const detail = [
    data.annule?.le && `le ${dateDakar(data.annule.le)}`,
    data.annule?.par && `par ${data.annule.par}`,
  ].filter(Boolean).join(' ');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(ROUGE);
  doc.text(`REÇU ANNULÉ${detail ? ` ${detail}` : ''} — sans valeur.`, L / 2, yLegende, { align: 'center' });
};

// ─── Assemblage ───────────────────────────────────────────────────────────────

export async function genererRecuPdf(data: RecuData & { couleur?: string | null }): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  doc.setProperties({
    title: `Reçu ${data.numero}`,
    subject: `Reçu de paiement — ${data.eleve.nom}`,
    author: data.ecole.nom,
    creator: 'SenClass',
  });

  // La teinte du document : celle du logo de l'école (ou la couleur passée).
  const couleur = data.couleur !== undefined ? data.couleur : await couleurDominanteDuLogo(data.ecole.logo);
  const d = data.lignes.length > LIGNES_MODE_NORMAL ? COMPACTE : NORMALE;
  const e: Etat = { doc, c: paletteDepuis(couleur), data, d };
  const annule = data.annule !== null;

  filigrane(doc, data.ecole, L, H, 84, e.c.fonce);
  dessinerBandeau(doc, data.ecole, e.c, { largeurPage: L, marge: M, hauteur: d.bandeau, k: d.k });
  let y = titre(e, d.bandeau + (d.k < 1 ? 7.5 : 9));
  y = carteEleve(e, y);

  // ── Tableau ──
  y = enteteTableau(e, y);
  let rang = 0;
  for (const ligne of data.lignes) {
    if (y + d.pas > d.basTableau) {
      doc.addPage('a5', 'portrait');
      filigrane(doc, data.ecole, L, H, 84, e.c.fonce);
      y = enteteTableau(e, enTeteDeSuite(e));
      rang = 0;
    }
    ligneTableau(e, ligne, y, rang++);
    y += d.pas;
  }

  // ── Total, tampon, somme en lettres ──
  y += d.k < 1 ? 3.5 : 4.5;
  const yTotal = y;
  y = blocTotal(e, y, annule);
  if (!annule) tamponAcquitte(e, M + 24, yTotal + d.hTotal / 2 + 0.6);
  y += d.k < 1 ? 6.5 : 8;
  if (!annule) y = lettres(e, y);
  y = infosPaiement(e, y);

  // ── Signatures et pied, calés en bas de page ──
  const ySign = Math.max(y + 2, H - d.signatures);
  signatures(e, ySign);
  pied(e, H - 12.4);
  if (annule) marqueAnnule(e, ySign - 2);

  return doc;
}
