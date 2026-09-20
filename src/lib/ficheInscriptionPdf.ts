import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { PIECES_A_FOURNIR, type FicheInscriptionData } from '@/lib/ficheInscription';
import { dateDakar } from '@/lib/documentsEcole';
import { couleurDominanteDuLogo, paletteDepuis, type Palette } from '@/lib/couleurLogo';
import {
  ENCRE, GRIS, ROUGE, dessinerBandeau, dessinerTitre, espace, etiquette, filigrane,
  guilloche, signatureSenClass,
} from '@/lib/documentsDesign';
import { formaterMontant } from '@/lib/montantEnLettres';

// ═══════════════════════════════════════════════════════════════════════════
// FICHE D'INSCRIPTION — PDF vectoriel, A4 portrait, même identité visuelle que
// le reçu : bandeau aux couleurs du logo, titres à empattements, filigrane,
// motif guilloché.
//
// Deux volets, dans un seul PDF :
//
//   • PAGE 1 — la fiche, que l'école signe et ARCHIVE : identité, scolarité,
//     tuteurs, frais, pièces à fournir, engagement, signatures. Elle ne contient
//     AUCUN mot de passe : un dossier d'archive se consulte, se photocopie, se
//     perd, et ne doit pas donner accès au compte d'un enfant.
//
//   • PAGE 2 — les identifiants de connexion, remis à la FAMILLE seule : site,
//     identifiant, mot de passe, QR code, et comment s'y prendre (installer
//     l'application, activer les notifications). Absente si les identifiants ne
//     sont pas lisibles.
// ═══════════════════════════════════════════════════════════════════════════

const L = 210;
const H = 297;
const M = 14;
const U = L - 2 * M;
const BAS = H - 20;
const COL = U / 2;
const HAUT_BANDEAU = 32;

type Etat = { doc: jsPDF; c: Palette; data: FicheInscriptionData };

// ─── Briques ──────────────────────────────────────────────────────────────────

/** Titre de section : petit carré d'accent, capitales espacées, filet fin. */
const titreSection = ({ doc, c }: Etat, titre: string, y: number): number => {
  doc.setFillColor(c.accent);
  doc.rect(M, y + 1.4, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(c.fonce);
  espace(doc, titre, M + 4.2, y + 3.2, 0.3);
  doc.setDrawColor(c.trait);
  doc.setLineWidth(0.25);
  doc.line(M, y + 5.6, L - M, y + 5.6);
  return y + 8.6;
};

/** Un champ : étiquette en capitales grises, valeur en gras, souligné fin. */
const champ = ({ doc, c }: Etat, nom: string, valeur: string | undefined, x: number, y: number, largeur: number) => {
  etiquette(doc, nom, x, y + 2.6, GRIS);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(ENCRE);
  const texte = valeur && valeur.trim() ? valeur : '—';
  doc.text((doc.splitTextToSize(texte, largeur - 3) as string[])[0], x, y + 7.4);
  doc.setDrawColor(c.trait);
  doc.setLineWidth(0.2);
  doc.line(x, y + 8.8, x + largeur - 3, y + 8.8);
};

const caseACocher = (doc: jsPDF, c: Palette, x: number, y: number, cochee: boolean) => {
  doc.setDrawColor(cochee ? c.fonce : GRIS);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, 3.6, 3.6, 0.5, 0.5, 'S');
  if (cochee) {
    doc.setDrawColor(c.fonce);
    doc.setLineWidth(0.55);
    doc.line(x + 0.7, y + 1.9, x + 1.6, y + 2.9);
    doc.line(x + 1.6, y + 2.9, x + 3.0, y + 0.7);
  }
};

const piedDePage = ({ doc, c, data }: Etat, page: number, total: number) => {
  guilloche(doc, c, L, H - 9.4, 9.4);
  const famille = page > 1 && data.compte;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(famille ? ROUGE : GRIS);
  doc.text(
    famille
      ? "Document confidentiel : il contient des identifiants d'accès. Conservez-le en lieu sûr."
      : data.compte
        ? "Fiche d'inscription — exemplaire de l'école. Identifiants de connexion : page 2, remise à la famille."
        : "Fiche d'inscription — exemplaire de l'école. Identifiants de connexion : à retirer auprès de l'administration.",
    M, H - 15.6,
  );
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GRIS);
  doc.text(`Page ${page} / ${total}`, L - M, H - 15.6, { align: 'right' });
  signatureSenClass(doc, c, L - M, H - 12.2);
};

/** Page de suite, si la fiche déborde : bandeau réduit et rappel du matricule. */
const suite = ({ doc, c, data }: Etat): number => {
  doc.addPage('a4', 'portrait');
  filigrane(doc, data.ecole, L, H, 110, c.fonce);
  doc.setFillColor(c.fonce);
  doc.rect(0, 0, L, 13, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor('#FFFFFF');
  doc.text(data.ecole.nom.toUpperCase(), M, 8.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Fiche d'inscription ${data.eleve.matricule} — suite`, L - M, 8.2, { align: 'right' });
  return 22;
};

/** S'assure d'avoir `h` mm de place ; sinon page suivante. */
const place = (e: Etat, y: number, h: number): number => (y + h > BAS ? suite(e) : y);

/** Signatures : deux lignes en pointillés et un cachet, comme sur le reçu. */
const signatures = ({ doc, c }: Etat, y: number) => {
  const colonne = (U - 36) / 2;
  const trait = (x: number, legende: string) => {
    doc.setDrawColor(GRIS);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(x, y + 19, x + colonne, y + 19);
    doc.setLineDashPattern([], 0);
    etiquette(doc, legende, x + colonne / 2, y + 23.4, GRIS, 'center');
  };
  trait(M, 'Le parent / tuteur — « Lu et approuvé »');
  trait(L - M - colonne, 'La direction — signature');

  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.2, 1.4], 0);
  doc.circle(L / 2, y + 11.5, 11.5, 'S');
  doc.setLineDashPattern([], 0);
  etiquette(doc, 'Cachet', L / 2, y + 12.6, c.accent, 'center');
};

// ─── Page 1 : la fiche de l'école ─────────────────────────────────────────────

const pageFiche = (e: Etat): void => {
  const { doc, c, data } = e;
  filigrane(doc, data.ecole, L, H, 110, c.fonce);
  dessinerBandeau(doc, data.ecole, c, { largeurPage: L, marge: M, hauteur: HAUT_BANDEAU });

  // ── Titre, matricule, photo ──
  const yTitre = HAUT_BANDEAU + 9;
  dessinerTitre(doc, c, "FICHE D'INSCRIPTION", M, yTitre + 7, 21, 0.4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(c.accent);
  doc.text(
    `Année scolaire ${data.anneeScolaire}  ·  ${data.reinscription ? 'Réinscription' : 'Nouvelle inscription'}`,
    M, yTitre + 18,
  );

  doc.setFillColor(c.pale);
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, yTitre + 22, 76, 13, 1.8, 1.8, 'FD');
  etiquette(doc, "N° d'inscription (matricule)", M + 4, yTitre + 27, c.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.6);
  doc.setTextColor(c.fonce);
  doc.text(data.eleve.matricule, M + 4, yTitre + 32.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  doc.setTextColor(GRIS);
  doc.text(`Inscrit le ${dateDakar(data.dateInscription)}`, M + 82, yTitre + 30.6);

  // Photo : dans son cadre ; sans photo, le cadre vide sert à en coller une.
  const xPhoto = L - M - 28;
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.5);
  doc.roundedRect(xPhoto, yTitre, 28, 35.5, 1.5, 1.5, 'S');
  let photoPosee = false;
  if (data.eleve.photo) {
    try {
      const { fileType } = doc.getImageProperties(data.eleve.photo);
      doc.addImage(data.eleve.photo, fileType, xPhoto + 0.6, yTitre + 0.6, 26.8, 34.3);
      photoPosee = true;
    } catch { /* photo illisible : cadre vide */ }
  }
  if (!photoPosee) etiquette(doc, 'Photo', xPhoto + 14, yTitre + 18.4, GRIS, 'center');

  let y = yTitre + 41;

  // ── Identité et scolarité ──
  y = titreSection(e, 'IDENTITÉ ET SCOLARITÉ', y);
  const rang = 10.6;
  champ(e, 'Nom', data.eleve.nom, M, y, COL);
  champ(e, 'Prénom(s)', data.eleve.prenoms, M + COL, y, COL);
  y += rang;
  champ(e, 'Sexe', data.eleve.sexe, M, y, COL);
  champ(e, 'Date de naissance', data.eleve.dateNaissance, M + COL, y, COL);
  y += rang;
  champ(e, 'Lieu de naissance', data.eleve.lieuNaissance, M, y, COL);
  champ(e, 'Lieu de résidence', data.eleve.residence, M + COL, y, COL);
  y += rang;
  champ(e, 'Téléphone', data.eleve.telephone, M, y, COL);
  champ(e, 'E-mail', data.eleve.email, M + COL, y, COL);
  y += rang;
  champ(e, 'Classe', data.scolarite.classe, M, y, COL);
  champ(e, data.scolarite.filiere ? 'Niveau · Filière' : 'Niveau',
    [data.scolarite.niveau, data.scolarite.filiere].filter(Boolean).join(' · ') || undefined, M + COL, y, COL);
  y += rang + 3;

  // ── Parents / tuteurs ──
  y = place(e, y, 8.6 + data.tuteurs.length * 12);
  y = titreSection(e, 'PARENTS / TUTEURS', y);
  const cols = [30, 62, 34, U - 126];
  for (const t of data.tuteurs) {
    let x = M;
    champ(e, 'Qualité', t.qualite, x, y, cols[0]); x += cols[0];
    champ(e, 'Nom complet', t.nom, x, y, cols[1]); x += cols[1];
    champ(e, 'Téléphone', t.telephone, x, y, cols[2]); x += cols[2];
    champ(e, 'E-mail', t.email, x, y, cols[3]);
    y += 11.6;
  }
  y += 3;

  // ── Frais : une ligne ──
  if (data.frais) {
    y = place(e, y, 14);
    doc.setFillColor(c.pale);
    doc.roundedRect(M, y, U, 10, 1.8, 1.8, 'F');
    doc.setFillColor(c.accent);
    doc.roundedRect(M, y, 2, 10, 1, 1, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.2); doc.setTextColor(ENCRE);
    doc.text("Frais d'inscription :", M + 6, y + 6.4);
    doc.setFont('helvetica', 'bold');
    doc.text(`${formaterMontant(data.frais.inscription ?? 0)} FCFA`, M + 39, y + 6.4);
    caseACocher(doc, c, M + 69, y + 3.2, data.frais.inscriptionPayee);
    doc.setFont('helvetica', 'normal');
    doc.text('payés', M + 74, y + 6.4);
    doc.text('Scolarité mensuelle :', M + 102, y + 6.4);
    doc.setFont('helvetica', 'bold');
    doc.text(`${formaterMontant(data.frais.mensualite ?? 0)} FCFA`, M + 136, y + 6.4);
    y += 15;
  }

  // ── Pièces à fournir ──
  y = place(e, y, 24);
  y = titreSection(e, 'PIÈCES À FOURNIR', y);
  const colPiece = U / 3;
  PIECES_A_FOURNIR.forEach((piece, i) => {
    const x = M + (i % 3) * colPiece;
    const yy = y + Math.floor(i / 3) * 6.4;
    caseACocher(doc, c, x, yy, false);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.3); doc.setTextColor(ENCRE);
    doc.text((doc.splitTextToSize(piece, colPiece - 7) as string[])[0], x + 5.4, yy + 2.9);
  });
  y += Math.ceil(PIECES_A_FOURNIR.length / 3) * 6.4 + 4;

  // ── Engagement et signatures ──
  y = place(e, y, 50);
  y = titreSection(e, 'ENGAGEMENT', y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(ENCRE);
  const engagement = doc.splitTextToSize(
    "Le parent / tuteur soussigné certifie l'exactitude des renseignements ci-dessus, s'engage à respecter le règlement " +
    "intérieur de l'établissement et à s'acquitter des frais de scolarité aux échéances fixées.",
    U,
  ) as string[];
  engagement.forEach((l, i) => doc.text(l, M, y + 3 + i * 4.2));
  y += engagement.length * 4.2 + 4;

  doc.setFont('helvetica', 'italic'); doc.setFontSize(8.2); doc.setTextColor(GRIS);
  doc.text(`Fait à ${data.ecole.ville ?? '____________'}, le ${dateDakar(data.dateInscription)}`, M, y + 1);
  signatures(e, y + 4);
};

// ─── Page 2 : identifiants, exemplaire de la famille ─────────────────────────

const pageIdentifiants = async (e: Etat, compte: NonNullable<FicheInscriptionData['compte']>): Promise<void> => {
  const { doc, c, data } = e;
  doc.addPage('a4', 'portrait');
  filigrane(doc, data.ecole, L, H, 110, c.fonce);
  dessinerBandeau(doc, data.ecole, c, { largeurPage: L, marge: M, hauteur: HAUT_BANDEAU });

  let y = HAUT_BANDEAU + 9;
  dessinerTitre(doc, c, "ACCÈS À L'ESPACE ÉLÈVE", M, y + 7, 21, 0.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(ROUGE);
  doc.text('Exemplaire de la famille — document confidentiel', M, y + 18);

  // Élève concerné
  y += 24;
  doc.setFillColor(c.pale);
  doc.roundedRect(M, y, U, 19, 1.8, 1.8, 'F');
  doc.setFillColor(c.accent);
  doc.roundedRect(M, y, 2, 19, 1, 1, 'F');
  etiquette(doc, 'Élève', M + 7, y + 6, c.accent);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(ENCRE);
  doc.text(`${data.eleve.nom} ${data.eleve.prenoms}`, M + 26, y + 6.2);
  etiquette(doc, 'Matricule', M + 7, y + 14, GRIS);
  doc.setFontSize(10); doc.setTextColor(ENCRE);
  doc.text(data.eleve.matricule, M + 26, y + 14.2);
  if (data.scolarite.classe) {
    etiquette(doc, 'Classe', M + COL, y + 14, GRIS);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(ENCRE);
    doc.text(data.scolarite.classe, M + COL + 15, y + 14.2);
  }
  y += 27;

  // Le cadre des identifiants
  const h = 62;
  doc.setFillColor(c.pale);
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.8);
  doc.roundedRect(M, y, U, h, 2.5, 2.5, 'FD');

  etiquette(doc, 'Site', M + 7, y + 9.4, c.accent);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(c.fonce);
  doc.text(compte.adresseSite.replace(/^https?:\/\//, ''), M + 7, y + 16.4);

  etiquette(doc, 'Identifiant', M + 7, y + 26, c.accent);
  doc.setFont('courier', 'bold'); doc.setFontSize(12); doc.setTextColor(ENCRE);
  doc.text(compte.identifiant, M + 7, y + 33);

  etiquette(doc, 'Mot de passe', M + 7, y + 43, c.accent);
  doc.setFont('courier', 'bold'); doc.setFontSize(22);
  doc.text(compte.motDePasse, M + 7, y + 53.4);

  try {
    const qr = await QRCode.toDataURL(compte.adresseSite, { margin: 0, width: 320, color: { dark: '#111827', light: '#FFFFFF' } });
    doc.setFillColor('#FFFFFF');
    doc.roundedRect(L - M - 7 - 44, y + 7, 44, 44, 2, 2, 'F');
    doc.addImage(qr, 'PNG', L - M - 7 - 42, y + 9, 40, 40);
    etiquette(doc, 'Scannez pour ouvrir le site', L - M - 7 - 22, y + 55.6, c.accent, 'center');
  } catch { /* pas de QR : les identifiants restent lisibles */ }
  y += h + 10;

  // Mode d'emploi
  y = titreSection(e, 'COMMENT SE CONNECTER', y);
  const etapes: [string, string][] = [
    ['Ouvrez le site', "Tapez l'adresse ci-dessus dans le navigateur de votre téléphone, ou scannez le QR code."],
    ['Connectez-vous', "Saisissez l'identifiant et le mot de passe tels qu'ils sont écrits. Le mot de passe distingue majuscules et minuscules."],
    ["Installez l'application", "Dans le menu du navigateur, choisissez « Ajouter à l'écran d'accueil » : SenClass s'ouvre ensuite comme une application, même sans connexion internet."],
    ['Activez les notifications', "Dans « Profil », touchez « Activer les notifications » : vous serez prévenu des nouvelles notes, des bulletins, des paiements et des absences."],
  ];
  etapes.forEach(([titre, texte], i) => {
    const yy = y + i * 17;
    doc.setFillColor(c.fonce);
    doc.circle(M + 3.6, yy + 3.6, 3.6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor('#FFFFFF');
    doc.text(String(i + 1), M + 3.6, yy + 4.9, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(c.fonce);
    doc.text(titre, M + 11, yy + 3.2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(ENCRE);
    (doc.splitTextToSize(texte, U - 12) as string[]).slice(0, 2)
      .forEach((l, k) => doc.text(l, M + 11, yy + 8 + k * 4.2));
  });
  y += etapes.length * 17 + 3;

  doc.setFillColor('#FEF2F2');
  doc.setDrawColor(ROUGE);
  doc.setLineWidth(0.35);
  doc.roundedRect(M, y, U, 21, 1.8, 1.8, 'FD');
  doc.setFillColor(ROUGE);
  doc.roundedRect(M, y, 2, 21, 1, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(ROUGE);
  doc.text('Identifiants personnels et confidentiels', M + 7, y + 6.6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(ENCRE);
  const avertissement = doc.splitTextToSize(
    "Ne les communiquez à personne et conservez cette page en lieu sûr. En cas de perte, ou si vous pensez qu'une autre personne les connaît, adressez-vous à l'administration de l'école" +
    (data.ecole.telephone ? ` (${data.ecole.telephone}).` : '.'),
    U - 12,
  ) as string[];
  avertissement.slice(0, 3).forEach((l, i) => doc.text(l, M + 7, y + 11.8 + i * 4.2));
};

// ─── Assemblage ───────────────────────────────────────────────────────────────

export async function genererFicheInscriptionPdf(
  data: FicheInscriptionData & { couleur?: string | null },
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setProperties({
    title: `Fiche d'inscription — ${data.eleve.nom} ${data.eleve.prenoms}`,
    subject: `Année scolaire ${data.anneeScolaire}`,
    author: data.ecole.nom,
    creator: 'SenClass',
  });

  // La teinte du document : celle du logo de l'école (ou la couleur passée).
  const couleur = data.couleur !== undefined ? data.couleur : await couleurDominanteDuLogo(data.ecole.logo);
  const e: Etat = { doc, c: paletteDepuis(couleur), data };

  pageFiche(e);
  if (data.compte) await pageIdentifiants(e, data.compte);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    piedDePage(e, p, pages);
  }
  return doc;
}
