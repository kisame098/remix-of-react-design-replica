import jsPDF from 'jspdf';
import { couleurDominanteDuLogo, paletteDepuis, PALETTE_ECONOMIQUE, type Palette } from '@/lib/couleurLogo';
import { dateDakar, type InfosEcole } from '@/lib/documentsEcole';
import {
  ENCRE, FILET, GRIS, blocFort, dessinerBandeau, dessinerTitre, ecrireAjuste, etiquette, filigrane, signatureSenClass,
} from '@/lib/documentsDesign';
import { formaterMontant, montantEnLettres } from '@/lib/montantEnLettres';
import { numeroFacture, numeroRecuFinanceur, type FactureFinanceur, type Versement } from '@/lib/financementsSuivi';

// ═══════════════════════════════════════════════════════════════════════════
// FACTURE À L'ORGANISME FINANCEUR (3FPT…) — A4 portrait, même charte que les
// factures aux familles (bandeau aux couleurs du logo, filigrane, titres à
// empattements). Une ligne par apprenant : sa prise en charge sur l'année et
// la part de la tranche facturée (acompte, solde…). Chargé seulement au clic.
// ═══════════════════════════════════════════════════════════════════════════

const L = 210;
const H = 297;
const M = 16;
const U = L - 2 * M;
const PAS = 7.4;

export interface DonneesFactureFinanceur {
  facture: FactureFinanceur;
  organisme: string;
  /** « BEP Restauration · BEP 1 — Promo 2026 ». */
  formation: string;
}

type Etat = { doc: jsPDF; c: Palette; ecole: InfosEcole; d: DonneesFactureFinanceur };

const fmt = (n: number) => `${formaterMontant(n)} F`;

const colonnes = [
  { titre: 'N°', x: M + 2, align: 'left' as const },
  { titre: 'APPRENANT', x: M + 12, align: 'left' as const },
  { titre: 'MATRICULE', x: M + 92, align: 'left' as const },
  { titre: 'PRISE EN CHARGE', x: M + 148, align: 'right' as const },
  { titre: 'MONTANT', x: L - M - 2, align: 'right' as const },
];

const enteteTableau = ({ doc, c }: Etat, y: number): number => {
  doc.setFillColor(c.pale);
  doc.rect(M, y, U, 7.4, 'F');
  for (const col of colonnes) etiquette(doc, col.titre, col.x, y + 4.9, c.fonce, col.align);
  return y + 7.4;
};

const dessinerPage = (e: Etat) => {
  const { doc, c, ecole, d } = e;
  const f = d.facture;
  filigrane(doc, ecole, L, H, 120, c.fonce);
  dessinerBandeau(doc, ecole, c, { largeurPage: L, marge: M, hauteur: 36 });

  let y = 50;
  dessinerTitre(doc, c, f.annulee ? 'FACTURE ANNULÉE' : 'FACTURE', M, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(ENCRE);
  doc.text(`N° ${numeroFacture(d.organisme, f.annee, f.numero)}`, L - M, y - 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  doc.setTextColor(GRIS);
  doc.text(`Émise le ${dateDakar(`${f.dateEmission}T12:00:00Z`)}`, L - M, y + 1.2, { align: 'right' });

  // Destinataire et objet.
  y += 12;
  const largeurCarte = (U - 6) / 2;
  const carte = (x: number, titre: string, lignes: string[]) => {
    doc.setDrawColor(FILET);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, largeurCarte, 24, 2, 2, 'S');
    etiquette(doc, titre, x + 4, y + 5.6, GRIS);
    doc.setTextColor(ENCRE);
    lignes.forEach((l, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
      ecrireAjuste(doc, l, x + 4, y + 11.6 + i * 4.6, largeurCarte - 8, { taille: i === 0 ? 10.5 : 8.6, tailleMin: 6.5 });
    });
  };
  carte(M, 'DOIT', [d.organisme, 'Organisme financeur']);
  carte(M + largeurCarte + 6, 'OBJET', [
    `${f.trancheLibelle} — ${String(f.tranchePourcentage).replace('.', ',')} % de la prise en charge`,
    d.formation,
    `${f.lignes.length} apprenant${f.lignes.length > 1 ? 's' : ''}${f.portee === 'apprenant' ? '' : ' (cohorte)'}`,
  ]);
  y += 32;

  y = enteteTableau(e, y);
  f.lignes.forEach((l, i) => {
    if (y + PAS > H - 70) {
      signatureSenClass(doc, c, L - M, H - 12);
      doc.addPage('a4', 'portrait');
      filigrane(doc, ecole, L, H, 120, c.fonce);
      y = enteteTableau(e, 20);
    }
    if (i % 2 === 1) { doc.setFillColor('#FAFAFA'); doc.rect(M, y, U, PAS, 'F'); }
    doc.setDrawColor(FILET);
    doc.setLineWidth(0.15);
    doc.line(M, y + PAS, L - M, y + PAS);
    const base = y + 4.9;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(GRIS);
    doc.text(String(i + 1), colonnes[0].x, base);
    doc.setTextColor(ENCRE);
    ecrireAjuste(doc, l.nom, colonnes[1].x, base, 76, { taille: 8.8, tailleMin: 6.8 });
    doc.setTextColor(GRIS);
    doc.text(l.matricule, colonnes[2].x, base);
    doc.text(fmt(l.finance), colonnes[3].x, base, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ENCRE);
    doc.text(fmt(l.montant), colonnes[4].x, base, { align: 'right' });
    y += PAS;
  });

  // Total, en lettres, échéance, signature.
  y += 6;
  const couleurTexte = blocFort(doc, c, L - M - 80, y, 80, 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(couleurTexte);
  doc.text('TOTAL À PAYER', L - M - 76, y + 5.2);
  doc.setFontSize(13);
  doc.text(fmt(f.total), L - M - 4, y + 9.6, { align: 'right' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.6);
  doc.setTextColor(ENCRE);
  ecrireAjuste(doc, `Arrêtée à la somme de ${montantEnLettres(f.total).toLowerCase()}.`, M, y + 6, U - 90, { taille: 8.6, tailleMin: 7, lignesMax: 3, interligne: 4 });
  y += 22;
  if (f.dateEcheance) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`Échéance de paiement : ${dateDakar(`${f.dateEcheance}T12:00:00Z`)}`, M, y);
  }
  if (f.note) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(GRIS);
    ecrireAjuste(doc, f.note, M, y + 6, U - 70, { taille: 8.4, tailleMin: 7, lignesMax: 3, interligne: 3.8 });
  }
  etiquette(doc, 'LA DIRECTION — SIGNATURE ET CACHET', L - M - 30, y + 4, GRIS, 'center');
  doc.setDrawColor(GRIS);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(L - M - 60, y + 28, L - M, y + 28);
  doc.setLineDashPattern([], 0);
  if (ecole.directeurGeneral) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.6);
    doc.setTextColor(ENCRE);
    doc.text(ecole.directeurGeneral, L - M - 30, y + 33, { align: 'center' });
  }
  signatureSenClass(doc, c, L - M, H - 12);
};

export async function genererFacturesFinanceurPdf(
  ecole: InfosEcole, factures: DonneesFactureFinanceur[], options: { economique?: boolean } = {},
): Promise<jsPDF> {
  if (factures.length === 0) throw new Error('Aucune facture à imprimer');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const p = factures[0];
  doc.setProperties({
    title: factures.length === 1 ? `Facture ${numeroFacture(p.organisme, p.facture.annee, p.facture.numero)}` : `${factures.length} factures`,
    subject: p.organisme, author: ecole.nom, creator: 'SenClass',
  });
  const c = options.economique ? PALETTE_ECONOMIQUE : paletteDepuis(await couleurDominanteDuLogo(ecole.logo));
  factures.forEach((d, i) => {
    if (i > 0) doc.addPage('a4', 'portrait');
    dessinerPage({ doc, c, ecole, d });
  });
  return doc;
}

// ─── Reçu remis à l'organisme pour un versement ─────────────────────────────

export interface DonneesRecuFinanceur {
  facture: FactureFinanceur;
  organisme: string;
  formation: string;
  versement: Versement;
  /** Rang du versement sur la facture (1, 2…) : il numérote le reçu. */
  rang: number;
  /** Reçu sur la facture, ce versement compris. */
  recuTotal: number;
}

/** A5 portrait : la preuve que l'école a bien reçu le versement de l'organisme. */
export async function genererRecuFinanceurPdf(
  ecole: InfosEcole, d: DonneesRecuFinanceur, options: { economique?: boolean } = {},
): Promise<jsPDF> {
  const LA = 148;
  const HA = 210;
  const MA = 12;
  const UA = LA - 2 * MA;
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const c = options.economique ? PALETTE_ECONOMIQUE : paletteDepuis(await couleurDominanteDuLogo(ecole.logo));
  const nFacture = numeroFacture(d.organisme, d.facture.annee, d.facture.numero);
  const nRecu = numeroRecuFinanceur(nFacture, d.rang);
  doc.setProperties({ title: `Reçu ${nRecu}`, subject: d.organisme, author: ecole.nom, creator: 'SenClass' });

  filigrane(doc, ecole, LA, HA, 84, c.fonce);
  dessinerBandeau(doc, ecole, c, { largeurPage: LA, marge: MA, hauteur: 30, k: 0.8 });

  let y = 42;
  dessinerTitre(doc, c, 'REÇU', MA, y, 15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(ENCRE);
  doc.text(`N° ${nRecu}`, LA - MA, y - 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(GRIS);
  doc.text(`Reçu le ${dateDakar(`${d.versement.date}T12:00:00Z`)}`, LA - MA, y + 1, { align: 'right' });

  y += 10;
  const ligne = (titre: string, valeur: string) => {
    etiquette(doc, titre, MA, y, GRIS);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(ENCRE);
    ecrireAjuste(doc, valeur, MA + 40, y, UA - 40, { taille: 9.4, tailleMin: 6.8 });
    doc.setDrawColor(FILET);
    doc.setLineWidth(0.2);
    doc.line(MA, y + 3, LA - MA, y + 3);
    y += 9;
  };
  ligne('REÇU DE', d.organisme);
  ligne('POUR', `Facture ${nFacture} — ${d.facture.trancheLibelle}`);
  ligne('FORMATION', d.formation);
  ligne('APPRENANTS', `${d.facture.lignes.length} apprenant${d.facture.lignes.length > 1 ? 's' : ''}`);
  if (d.versement.reference) ligne('RÉFÉRENCE', d.versement.reference);

  y += 2;
  const couleurTexte = blocFort(doc, c, MA, y, UA, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(couleurTexte);
  doc.text('MONTANT REÇU', MA + 4, y + 5.6);
  doc.setFontSize(14);
  doc.text(fmt(d.versement.montant), LA - MA - 4, y + 10, { align: 'right' });
  y += 20;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.2);
  doc.setTextColor(ENCRE);
  ecrireAjuste(doc, `Arrêté à la somme de ${montantEnLettres(d.versement.montant).toLowerCase()}.`, MA, y, UA, { taille: 8.2, tailleMin: 6.8, lignesMax: 3, interligne: 3.8 });

  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  doc.setTextColor(GRIS);
  const reste = Math.max(0, d.facture.total - d.recuTotal);
  doc.text(`Facture : ${fmt(d.facture.total)} · reçu à ce jour : ${fmt(d.recuTotal)} · ${reste > 0 ? `reste ${fmt(reste)}` : 'soldée'}`, MA, y);

  y += 10;
  etiquette(doc, 'LA DIRECTION — SIGNATURE ET CACHET', LA - MA - 26, y, GRIS, 'center');
  doc.setDrawColor(GRIS);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.line(LA - MA - 52, y + 22, LA - MA, y + 22);
  doc.setLineDashPattern([], 0);
  if (ecole.directeurGeneral) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(ENCRE);
    doc.text(ecole.directeurGeneral, LA - MA - 26, y + 26, { align: 'center' });
  }
  signatureSenClass(doc, c, LA - MA, HA - 8);
  return doc;
}
