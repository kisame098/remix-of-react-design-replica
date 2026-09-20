import jsPDF from 'jspdf';
import type { RecuData } from '@/lib/recu';
import {
  COULEURS, dateDakar, dateHeureDakar, dessinerEnTeteEcole,
} from '@/lib/documentsEcole';
import { formaterMontant, montantEnLettres } from '@/lib/montantEnLettres';

// ═══════════════════════════════════════════════════════════════════════════
// REÇU DE PAIEMENT — PDF vectoriel, format A5 portrait.
//
// Dessiné avec les primitives de jsPDF (comme les bulletins), donc net à toute
// taille et léger. Sobre exprès : il s'imprime aussi bien sur une imprimante
// noir et blanc que sur un téléphone.
//
// Le montant est écrit en chiffres ET en lettres : en chiffres seul, 25 000 se
// falsifie en 125 000 d'un coup de stylo.
// ═══════════════════════════════════════════════════════════════════════════

const LARGEUR = 148;
const HAUTEUR = 210;
const MARGE = 10;
const UTILE = LARGEUR - 2 * MARGE;
/** Au-delà, le tableau passe à la page suivante. Réserve le pied (total, lettres, signatures). */
const BAS_TABLEAU = HAUTEUR - 78;
const PAS_LIGNE = 6.4;

const label = (doc: jsPDF, texte: string, x: number, y: number) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(COULEURS.discret);
  doc.text(texte, x, y);
};

const valeur = (doc: jsPDF, texte: string, x: number, y: number, taille = 10, gras = true) => {
  doc.setFont('helvetica', gras ? 'bold' : 'normal');
  doc.setFontSize(taille);
  doc.setTextColor(COULEURS.encre);
  doc.text(texte, x, y);
};

/** Tampon en diagonale (ANNULÉ). Rotation autour du centre, texte centré sur ce point. */
const tamponDiagonal = (doc: jsPDF, texte: string, couleur: string, opacite: number) => {
  const angle = 35;
  const rad = (angle * Math.PI) / 180;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(54);
  const w = doc.getTextWidth(texte);
  const cx = LARGEUR / 2;
  const cy = HAUTEUR / 2;
  doc.saveGraphicsState();
  doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: opacite }));
  doc.setTextColor(couleur);
  doc.text(texte, cx - (w / 2) * Math.cos(rad), cy + (w / 2) * Math.sin(rad), { angle });
  doc.restoreGraphicsState();
};

const enTeteDeSuite = (doc: jsPDF, data: RecuData): number => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COULEURS.marque);
  doc.text(`${data.ecole.nom.toUpperCase()} — Reçu ${data.numero} (suite)`, MARGE, MARGE + 4);
  doc.setDrawColor(COULEURS.marque);
  doc.setLineWidth(0.4);
  doc.line(MARGE, MARGE + 6.5, LARGEUR - MARGE, MARGE + 6.5);
  return MARGE + 12;
};

export async function genererRecuPdf(data: RecuData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  doc.setProperties({
    title: `Reçu ${data.numero}`,
    subject: `Reçu de paiement — ${data.eleve.nom}`,
    author: data.ecole.nom,
    creator: 'SenClass',
  });

  // ── En-tête de l'école ───────────────────────────────────────────────────
  let y = dessinerEnTeteEcole(doc, data.ecole, MARGE, MARGE, UTILE, 20);

  // ── Titre ────────────────────────────────────────────────────────────────
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(COULEURS.encre);
  doc.text('REÇU DE PAIEMENT', MARGE, y + 5);

  doc.setFontSize(11);
  doc.setTextColor(COULEURS.marque);
  doc.text(`N° ${data.numero}`, LARGEUR - MARGE, y + 4.4, { align: 'right' });

  y += 9;
  label(doc, 'Date du paiement', MARGE, y + 3.5);
  valeur(doc, dateHeureDakar(data.date), MARGE + 32, y + 3.5, 9.5);
  if (data.duplicata) {
    doc.setDrawColor(COULEURS.discret);
    doc.setLineWidth(0.5);
    doc.roundedRect(LARGEUR - MARGE - 30, y - 0.5, 30, 6.5, 1, 1, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(COULEURS.discret);
    doc.text('DUPLICATA', LARGEUR - MARGE - 15, y + 4, { align: 'center' });
  }

  // ── Élève ────────────────────────────────────────────────────────────────
  y += 9;
  doc.setFillColor(COULEURS.fond);
  doc.roundedRect(MARGE, y, UTILE, 21, 1.5, 1.5, 'F');
  label(doc, 'Élève', MARGE + 4, y + 6);
  valeur(doc, data.eleve.nom, MARGE + 22, y + 6, 11);
  label(doc, 'Matricule', MARGE + 4, y + 12.5);
  valeur(doc, data.eleve.matricule, MARGE + 22, y + 12.5, 9.5);
  label(doc, 'Classe', MARGE + 4, y + 18);
  valeur(doc, data.eleve.classe ?? '—', MARGE + 22, y + 18, 9.5);
  label(doc, 'Année scolaire', MARGE + UTILE / 2 + 2, y + 18);
  valeur(doc, data.anneeScolaire, MARGE + UTILE / 2 + 30, y + 18, 9.5);

  // ── Tableau ──────────────────────────────────────────────────────────────
  y += 27;
  const enteteTableau = (yy: number) => {
    doc.setFillColor(COULEURS.marque);
    doc.rect(MARGE, yy, UTILE, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor('#FFFFFF');
    doc.text('DÉSIGNATION', MARGE + 3, yy + 4.5);
    doc.text('MONTANT (FCFA)', LARGEUR - MARGE - 3, yy + 4.5, { align: 'right' });
    return yy + 6.5;
  };
  y = enteteTableau(y);

  let rangee = 0;
  for (const ligne of data.lignes) {
    if (y + PAS_LIGNE > BAS_TABLEAU) {
      doc.addPage('a5', 'portrait');
      y = enteteTableau(enTeteDeSuite(doc, data));
      rangee = 0;
    }
    if (rangee % 2 === 1) {
      doc.setFillColor('#F9FAFB');
      doc.rect(MARGE, y, UTILE, PAS_LIGNE, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(ligne.annulee ? COULEURS.discret : COULEURS.encre);
    const designation = ligne.annulee ? `${ligne.designation} (annulé)` : ligne.designation;
    const coupe = doc.splitTextToSize(designation, UTILE - 40) as string[];
    doc.text(coupe[0], MARGE + 3, y + 4.4);
    doc.text(formaterMontant(ligne.montant), LARGEUR - MARGE - 3, y + 4.4, { align: 'right' });
    if (ligne.annulee) {
      // Ligne barrée, à la main : jsPDF n'a pas de style « barré ».
      doc.setDrawColor(COULEURS.discret);
      doc.setLineWidth(0.25);
      doc.line(MARGE + 3, y + 3.4, MARGE + 3 + doc.getTextWidth(coupe[0]), y + 3.4);
    }
    y += PAS_LIGNE;
    rangee++;
  }

  doc.setDrawColor(COULEURS.trait);
  doc.setLineWidth(0.3);
  doc.line(MARGE, y, LARGEUR - MARGE, y);

  // ── Total ────────────────────────────────────────────────────────────────
  y += 1.5;
  // Un reçu annulé montre le montant qui a été annulé, pas « 0 FCFA » : et il
  // n'énonce pas de somme « arrêtée », qui ressemblerait à un reçu valable.
  const annule = data.annule !== null;
  const montantAffiche = annule ? data.lignes.reduce((s, l) => s + l.montant, 0) : data.total;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(annule ? COULEURS.discret : COULEURS.encre);
  doc.text(annule ? 'TOTAL ANNULÉ' : 'TOTAL PAYÉ', MARGE + 3, y + 5.5);
  doc.setFontSize(13);
  doc.text(`${formaterMontant(montantAffiche)} FCFA`, LARGEUR - MARGE - 3, y + 5.6, { align: 'right' });

  // ── Montant en lettres ───────────────────────────────────────────────────
  y += 11;
  if (!annule) {
    label(doc, 'Arrêté la présente somme à :', MARGE, y + 3);
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(10);
    doc.setTextColor(COULEURS.encre);
    const lettres = doc.splitTextToSize(`${montantEnLettres(data.total)}.`, UTILE) as string[];
    lettres.slice(0, 3).forEach((l, i) => doc.text(l, MARGE, y + 8.5 + i * 4.8));
    y += 8.5 + Math.min(lettres.length, 3) * 4.8 + 2;
  } else {
    y += 2;
  }

  // ── Mode de paiement ─────────────────────────────────────────────────────
  label(doc, 'Mode de paiement', MARGE, y + 3.5);
  valeur(doc, data.mode || '—', MARGE + 32, y + 3.5, 9.5);
  if (data.reference) {
    label(doc, 'Référence', MARGE + UTILE / 2 + 4, y + 3.5);
    valeur(doc, data.reference, MARGE + UTILE / 2 + 24, y + 3.5, 9.5);
  }
  if (data.encaissePar) {
    label(doc, 'Encaissé par', MARGE, y + 9);
    valeur(doc, data.encaissePar, MARGE + 32, y + 9, 9.5);
  }

  // ── Signatures ───────────────────────────────────────────────────────────
  const ySign = HAUTEUR - 44;
  doc.setDrawColor(COULEURS.trait);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGE, ySign, UTILE / 2 - 3, 24, 1.5, 1.5, 'S');
  doc.roundedRect(MARGE + UTILE / 2 + 3, ySign, UTILE / 2 - 3, 24, 1.5, 1.5, 'S');
  label(doc, 'Le parent / tuteur', MARGE + 3, ySign + 4.5);
  label(doc, "Le caissier — cachet de l'école", MARGE + UTILE / 2 + 6, ySign + 4.5);

  // ── Pied ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(COULEURS.discret);
  doc.text('Ce reçu fait foi de paiement : conservez-le précieusement.', LARGEUR / 2, HAUTEUR - 14, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Document édité avec SenClass', LARGEUR / 2, HAUTEUR - 10, { align: 'center' });

  // ── Reçu annulé : impossible de le confondre avec un reçu valable ────────
  if (data.annule) {
    tamponDiagonal(doc, 'ANNULÉ', COULEURS.alerte, 0.22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(COULEURS.alerte);
    const detail = [
      data.annule.le && `le ${dateDakar(data.annule.le)}`,
      data.annule.par && `par ${data.annule.par}`,
    ].filter(Boolean).join(' ');
    doc.text(`REÇU ANNULÉ${detail ? ` ${detail}` : ''} — sans valeur.`, LARGEUR / 2, ySign - 3.5, { align: 'center' });
  }

  return doc;
}
