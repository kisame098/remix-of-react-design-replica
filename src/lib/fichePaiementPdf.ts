import jsPDF from 'jspdf';
import type { InfosEcole } from '@/lib/documentsEcole';
import { dateLongueDakar } from '@/lib/documentsEcole';
import {
  ENCRE, FILET, GRIS, VERT_TAMPON, alerte, blocFort, dessinerBandeau, dessinerTitre, ecrireAjuste, espace, etiquette,
  filigrane, guilloche, opacite, polygone, signatureSenClass, texteTourne, tourne,
} from '@/lib/documentsDesign';
import { couleurDominanteDuLogo, paletteDepuis, PALETTE_ECONOMIQUE, type Palette } from '@/lib/couleurLogo';
import { formaterMontant } from '@/lib/montantEnLettres';
import { bilanFiche, LIBELLES_ETAT_FICHE, type LigneFiche } from '@/lib/fichePaiement';

// ═══════════════════════════════════════════════════════════════════════════
// FICHE DE PAIEMENT — relevé de l'année d'un élève, PDF A4 portrait.
//
// Ce qu'une famille doit lire d'un coup d'œil : SOLDÉ, ou combien il reste.
// Puis le détail frais par frais, avec les reçus qui en font foi — pour
// qu'une contestation se règle en sortant le bon reçu.
//
// Une photographie à la date d'impression : écrite en tête et en pied.
// Plusieurs élèves = un seul PDF, une fiche par page (fin d'année).
// ═══════════════════════════════════════════════════════════════════════════

const L = 210;
const H = 297;
const M = 16;
const U = L - 2 * M;

export interface FichePaiementDoc {
  anneeScolaire: string;
  /** Date de la situation (ISO). */
  situationAu: string;
  eleve: { nom: string; matricule: string; classe?: string };
  tuteur?: { nom?: string; telephone?: string };
  lignes: LigneFiche[];
}

type Etat = { doc: jsPDF; c: Palette; ecole: InfosEcole; f: FichePaiementDoc };

const jourDe = (iso: string) => dateLongueDakar(iso).split(' à ')[0];

const titre = ({ doc, c, f }: Etat, y: number): number => {
  dessinerTitre(doc, c, 'FICHE DE PAIEMENT', M, y + 7, 21, 0.36);
  const w = 54;
  const x = L - M - w;
  doc.setFillColor(c.pale);
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.45);
  doc.roundedRect(x, y - 1, w, 14, 2, 2, 'FD');
  etiquette(doc, 'Année scolaire', x + w / 2, y + 3.4, c.accent, 'center');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(c.fonce);
  doc.text(f.anneeScolaire, x + w / 2, y + 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.4);
  doc.setTextColor(GRIS);
  doc.text(`Situation au ${jourDe(f.situationAu)}`, M, y + 17);
  return y + 24;
};

const carteEleve = ({ doc, c, f }: Etat, y: number): number => {
  const h = 24;
  doc.setFillColor(c.pale);
  doc.roundedRect(M, y, U, h, 2, 2, 'F');
  doc.setFillColor(c.accent);
  doc.roundedRect(M, y, 2, h, 1, 1, 'F');
  etiquette(doc, 'Élève', M + 7, y + 6, c.accent);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(ENCRE);
  ecrireAjuste(doc, f.eleve.nom, M + 7, y + 13, U * 0.42, { taille: 13, tailleMin: 9 });
  const colonnes: [string, string][] = [
    ['Matricule', f.eleve.matricule],
    ['Classe', f.eleve.classe ?? '—'],
    ['Parent / tuteur', [f.tuteur?.nom?.trim(), f.tuteur?.telephone?.trim()].filter(Boolean).join(' · ') || '—'],
  ];
  const parts = [0.22, 0.2, 0.58];
  let x = M + 7;
  colonnes.forEach(([nom, valeur], i) => {
    const largeur = (U - 12) * parts[i];
    etiquette(doc, nom, x, y + 18, GRIS);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.4);
    doc.setTextColor(ENCRE);
    ecrireAjuste(doc, valeur, x, y + 22.4, largeur - 3, { taille: 9.4, tailleMin: 7 });
    x += largeur;
  });
  return y + h + 7;
};

// Colonnes : frais, dû, payé, reste, état, reçus.
const X_RECUS = L - M - 2;
const X_ETAT = L - M - 50;
const X_RESTE = X_ETAT - 6;
const X_PAYE = X_RESTE - 24;
const X_DU = X_PAYE - 24;
const LARGEUR_FRAIS = X_DU - 22 - M;
const PAS = 7.2;

const enteteTableau = ({ doc, c }: Etat, y: number): number => {
  etiquette(doc, 'Frais', M + 2, y + 3.6, c.accent);
  etiquette(doc, 'Dû', X_DU, y + 3.6, c.accent, 'right');
  etiquette(doc, 'Payé', X_PAYE, y + 3.6, c.accent, 'right');
  etiquette(doc, 'Reste', X_RESTE, y + 3.6, c.accent, 'right');
  etiquette(doc, 'État', X_ETAT, y + 3.6, c.accent);
  etiquette(doc, 'Reçu(s)', X_RECUS, y + 3.6, c.accent, 'right');
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.5);
  doc.line(M, y + 5.6, L - M, y + 5.6);
  return y + 5.6;
};

const ligne = ({ doc, c }: Etat, l: LigneFiche, y: number, rang: number) => {
  if (rang % 2 === 1) { doc.setFillColor(c.pale); doc.rect(M, y, U, PAS, 'F'); }
  const base = y + 4.9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(l.etat === 'a_venir' ? GRIS : ENCRE);
  ecrireAjuste(doc, l.designation, M + 2, base, LARGEUR_FRAIS, { taille: 9.2, tailleMin: 7.2 });
  doc.setTextColor(GRIS);
  doc.text(formaterMontant(l.du), X_DU, base, { align: 'right' });
  doc.text(l.paye > 0 ? formaterMontant(l.paye) : '—', X_PAYE, base, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(l.reste > 0 && l.etat !== 'a_venir' ? ENCRE : GRIS);
  doc.text(l.reste > 0 ? formaterMontant(l.reste) : '—', X_RESTE, base, { align: 'right' });

  // L'état est toujours écrit : la couleur ne fait que le souligner.
  const couleurEtat = l.etat === 'solde' ? (c.economique ? ENCRE : VERT_TAMPON)
    : l.etat === 'impaye' ? alerte(c)
    : l.etat === 'partiel' ? ENCRE : GRIS;
  doc.setFont('helvetica', l.etat === 'a_venir' ? 'normal' : 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(couleurEtat);
  doc.text(LIBELLES_ETAT_FICHE[l.etat], X_ETAT, base);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(GRIS);
  const recus = l.recus.length === 0 ? '—' : l.recus.length === 1 ? l.recus[0] : `${l.recus[0]} +${l.recus.length - 1}`;
  doc.text(recus, X_RECUS, base, { align: 'right' });

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
  doc.text(`Fiche de paiement ${f.anneeScolaire} — ${f.eleve.nom} — suite`, L - M, 9.4, { align: 'right' });
  return 24;
};

/** Largeur laissée au tampon, à gauche du bilan. */
const LARGEUR_TAMPON = 66;

/** Trois cases à droite du tampon : dû, payé, reste — la dernière mise en avant. */
const bilan = ({ doc, c, f }: Etat, y: number): number => {
  const b = bilanFiche(f.lignes);
  const h = 19;
  const largeurs = [31, 31, U - LARGEUR_TAMPON - 62 - 8];
  const case_ = (x: number, w: number, nom: string, montant: number, forte: boolean) => {
    let texte: string = ENCRE;
    if (forte) {
      texte = blocFort(doc, c, x, y, w, h, b.solde ? c.fonce : alerte(c), !b.solde && !!c.economique);
    } else {
      doc.setDrawColor(FILET);
      doc.setLineWidth(0.4);
      doc.roundedRect(x, y, w, h, 2, 2, 'S');
    }
    doc.setTextColor(forte ? texte : GRIS);
    doc.saveGraphicsState();
    if (forte) opacite(doc, 0.85);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    espace(doc, nom.toUpperCase(), x + 4, y + 6.4, 0.2);
    doc.restoreGraphicsState();
    doc.setTextColor(forte ? texte : ENCRE);
    doc.setFont('helvetica', 'bold');
    // Aligné à droite : on réduit la taille plutôt que de couper le montant.
    const montantTexte = `${formaterMontant(montant)} F`;
    let taille = forte ? 15 : 11.5;
    doc.setFontSize(taille);
    while (doc.getTextWidth(montantTexte) > w - 8 && taille > 8) { taille -= 0.5; doc.setFontSize(taille); }
    doc.text(montantTexte, x + w - 4, y + 14.6, { align: 'right' });
  };
  let x = M + LARGEUR_TAMPON;
  [['Total dû', b.du, false], ['Total payé', b.paye, false], ['Reste à payer', b.reste, true]].forEach(([nom, montant, forte], i) => {
    case_(x, largeurs[i], nom as string, montant as number, forte as boolean);
    x += largeurs[i] + 4;
  });
  let yy = y + h + 5;
  if (b.reste > 0 && b.resteEchu !== b.reste) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.6);
    doc.setTextColor(GRIS);
    doc.text(
      `Dont ${formaterMontant(b.resteEchu)} F déjà exigibles ; ${formaterMontant(b.reste - b.resteEchu)} F pour des mois à venir.`,
      L - M, yy, { align: 'right' },
    );
    yy += 4;
  }
  return yy;
};

/** Le tampon : SOLDÉ, ou RESTE À PAYER — il se lit avant tout le reste. */
const tampon = ({ doc, c, f }: Etat, cx: number, cy: number) => {
  const b = bilanFiche(f.lignes);
  const couleur = b.solde ? (c.economique ? ENCRE : VERT_TAMPON) : alerte(c);
  const w = b.solde ? 44 : 62;
  const h = 18;
  const angle = 8;
  doc.saveGraphicsState();
  opacite(doc, 0.9);
  doc.setDrawColor(couleur);
  doc.setLineWidth(1);
  polygone(doc, [tourne(cx, cy, -w / 2, -h / 2, angle), tourne(cx, cy, w / 2, -h / 2, angle),
    tourne(cx, cy, w / 2, h / 2, angle), tourne(cx, cy, -w / 2, h / 2, angle)], 'S');
  doc.setLineWidth(0.3);
  const d = 1.4;
  polygone(doc, [tourne(cx, cy, -w / 2 + d, -h / 2 + d, angle), tourne(cx, cy, w / 2 - d, -h / 2 + d, angle),
    tourne(cx, cy, w / 2 - d, h / 2 - d, angle), tourne(cx, cy, -w / 2 + d, h / 2 - d, angle)], 'S');
  doc.setTextColor(couleur);
  doc.setFont('helvetica', 'bold');
  if (b.solde) {
    doc.setFontSize(17);
    texteTourne(doc, 'SOLDÉ', cx, cy + 1.6, angle, 0.6);
  } else {
    doc.setFontSize(10.5);
    texteTourne(doc, 'RESTE À PAYER', cx, cy - 1.6, angle, 0.3);
    doc.setFontSize(12.5);
    texteTourne(doc, `${formaterMontant(b.reste)} FCFA`, cx, cy + 5, angle, 0.1);
  }
  doc.restoreGraphicsState();
};

const basDePage = ({ doc, c, f }: Etat, y: number) => {
  doc.setDrawColor(FILET);
  doc.setLineWidth(0.3);
  doc.line(M, y, L - M, y);
  etiquette(doc, 'À savoir', M, y + 6, c.accent);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(ENCRE);
  const textes = [
    `Situation arrêtée au ${jourDe(f.situationAu)} : un paiement enregistré après cette date n'y figure pas.`,
    'Chaque paiement est justifié par un reçu numéroté, dont le numéro figure dans la colonne « Reçu(s) ».',
    'Les mois « À venir » ne sont pas encore exigibles.',
  ];
  const largeur = U - 66;
  let yy = y + 11.4;
  for (const t of textes) {
    const lignes = doc.splitTextToSize(t, largeur - 4) as string[];
    doc.text('•', M, yy);
    lignes.forEach((l, i) => doc.text(l, M + 3.5, yy + i * 4.2));
    yy += lignes.length * 4.2 + 1;
  }
  // Signature et cachet, à droite.
  const w = 58;
  const x = L - M - w;
  etiquette(doc, 'La direction', x + w / 2, y + 6, GRIS, 'center');
  doc.setDrawColor(c.accent);
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
  signatureSenClass(doc, c, L - M, H - 14);
};

const dessinerFiche = (e: Etat) => {
  const { doc, c, ecole, f } = e;
  filigrane(doc, ecole, L, H, 120, c.fonce);
  dessinerBandeau(doc, ecole, c, { largeurPage: L, marge: M, hauteur: 36 });
  let y = titre(e, 36 + 12);
  y = carteEleve(e, y);

  if (f.lignes.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(GRIS);
    doc.text('Aucun frais configuré pour cet élève cette année.', M, y + 6);
    y += 12;
  } else {
    y = enteteTableau(e, y);
    let rang = 0;
    for (const l of f.lignes) {
      if (y + PAS > H - 40) {
        pied(e);
        doc.addPage('a4', 'portrait');
        filigrane(doc, ecole, L, H, 120, c.fonce);
        y = enteteTableau(e, enTeteDeSuite(e));
        rang = 0;
      }
      ligne(e, l, y, rang++);
      y += PAS;
    }
  }

  // Bilan, tampon, bas de page : ensemble sur la même page.
  if (y + 7 + 28 + 40 > H - 22) {
    pied(e);
    doc.addPage('a4', 'portrait');
    filigrane(doc, ecole, L, H, 120, c.fonce);
    y = enTeteDeSuite(e);
  }
  const yBilan = y + 7;
  tampon(e, M + LARGEUR_TAMPON / 2 - 2, yBilan + 10);
  y = bilan(e, yBilan);
  basDePage(e, Math.max(y + 4, yBilan + 26));
  pied(e);
};

/** Une ou plusieurs fiches dans UN seul PDF, chacune commençant sur une nouvelle page. */
export async function genererFichesPaiementPdf(
  ecole: InfosEcole, fiches: FichePaiementDoc[],
  options: { economique?: boolean; couleur?: string | null } = {},
): Promise<jsPDF> {
  if (fiches.length === 0) throw new Error('Aucune fiche à imprimer');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setProperties({
    title: fiches.length === 1 ? `Fiche de paiement — ${fiches[0].eleve.nom}` : `${fiches.length} fiches de paiement`,
    subject: `Année scolaire ${fiches[0].anneeScolaire}`,
    author: ecole.nom,
    creator: 'SenClass',
  });
  const c = options.economique
    ? PALETTE_ECONOMIQUE
    : paletteDepuis(options.couleur !== undefined ? options.couleur : await couleurDominanteDuLogo(ecole.logo));
  fiches.forEach((f, i) => {
    if (i > 0) doc.addPage('a4', 'portrait');
    dessinerFiche({ doc, c, ecole, f });
  });
  return doc;
}
