import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { PIECES_A_FOURNIR, type FicheInscriptionData } from '@/lib/ficheInscription';
import { COULEURS, dateDakar, dessinerEnTeteEcole } from '@/lib/documentsEcole';
import { formaterMontant } from '@/lib/montantEnLettres';

// ═══════════════════════════════════════════════════════════════════════════
// FICHE D'INSCRIPTION — PDF vectoriel, A4 portrait.
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

const LARGEUR = 210;
const HAUTEUR = 297;
const MARGE = 14;
const UTILE = LARGEUR - 2 * MARGE;
const BAS = HAUTEUR - 16;
const COL = UTILE / 2;

const petitTexte = (doc: jsPDF, t: string, x: number, y: number, align: 'left' | 'right' | 'center' = 'left') => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(COULEURS.discret);
  doc.text(t, x, y, { align });
};

/** Titre de section : texte de la marque et filet fin. Renvoie l'ordonnée sous le titre. */
const titreSection = (doc: jsPDF, titre: string, y: number): number => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COULEURS.marque);
  doc.text(titre, MARGE, y + 3.5);
  doc.setDrawColor(COULEURS.trait);
  doc.setLineWidth(0.25);
  doc.line(MARGE, y + 5.2, LARGEUR - MARGE, y + 5.2);
  return y + 8;
};

/** Un champ : petite étiquette grise, valeur en gras, souligné. */
const champ = (
  doc: jsPDF, etiquette: string, valeur: string | undefined, x: number, y: number, largeur: number,
) => {
  petitTexte(doc, etiquette, x, y + 2.6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(COULEURS.encre);
  const texte = valeur && valeur.trim() ? valeur : '—';
  const [ligne] = doc.splitTextToSize(texte, largeur - 3) as string[];
  doc.text(ligne, x, y + 7.4);
  doc.setDrawColor('#D1D5DB');
  doc.setLineWidth(0.2);
  doc.line(x, y + 8.8, x + largeur - 3, y + 8.8);
};

const caseACocher = (doc: jsPDF, x: number, y: number, cochee: boolean) => {
  doc.setDrawColor(COULEURS.encre);
  doc.setLineWidth(0.3);
  doc.rect(x, y, 3.6, 3.6, 'S');
  if (cochee) {
    doc.setLineWidth(0.5);
    doc.line(x + 0.7, y + 1.9, x + 1.6, y + 2.9);
    doc.line(x + 1.6, y + 2.9, x + 3.0, y + 0.7);
  }
};

const suite = (doc: jsPDF, data: FicheInscriptionData): number => {
  doc.addPage('a4', 'portrait');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COULEURS.marque);
  doc.text(`${data.ecole.nom.toUpperCase()} — Fiche d'inscription ${data.eleve.matricule} (suite)`, MARGE, MARGE + 3);
  doc.setDrawColor(COULEURS.marque);
  doc.setLineWidth(0.4);
  doc.line(MARGE, MARGE + 5.5, LARGEUR - MARGE, MARGE + 5.5);
  return MARGE + 11;
};


/**
 * Page des identifiants — la seule de tout le document qui porte le mot de passe.
 * Pensée pour être détachée et remise à la famille.
 */
const pageIdentifiants = async (
  doc: jsPDF, data: FicheInscriptionData,
  compte: NonNullable<FicheInscriptionData['compte']>,
): Promise<void> => {
  doc.addPage('a4', 'portrait');
  let y = dessinerEnTeteEcole(doc, data.ecole, MARGE, MARGE, UTILE, 24);

  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(COULEURS.encre);
  doc.text("ACCÈS À L'ESPACE ÉLÈVE", MARGE, y + 7);
  doc.setFontSize(10.5);
  doc.setTextColor(COULEURS.alerte);
  doc.text('Exemplaire de la famille — document confidentiel', MARGE, y + 14);

  // Élève concerné
  y += 20;
  doc.setFillColor(COULEURS.fond);
  doc.roundedRect(MARGE, y, UTILE, 18, 1.5, 1.5, 'F');
  petitTexte(doc, 'Élève', MARGE + 4, y + 6);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(COULEURS.encre);
  doc.text(`${data.eleve.nom} ${data.eleve.prenoms}`, MARGE + 22, y + 6);
  petitTexte(doc, 'Matricule', MARGE + 4, y + 13);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(COULEURS.encre);
  doc.text(data.eleve.matricule, MARGE + 22, y + 13);
  if (data.scolarite.classe) {
    petitTexte(doc, 'Classe', MARGE + COL, y + 13);
    doc.text(data.scolarite.classe, MARGE + COL + 16, y + 13);
  }
  y += 26;

  // Le cadre des identifiants
  const hauteur = 62;
  doc.setFillColor('#F8FAFC');
  doc.setDrawColor(COULEURS.marque);
  doc.setLineWidth(0.7);
  doc.roundedRect(MARGE, y, UTILE, hauteur, 2, 2, 'FD');

  petitTexte(doc, 'Site', MARGE + 6, y + 9);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(COULEURS.marque);
  doc.text(compte.adresseSite.replace(/^https?:\/\//, ''), MARGE + 6, y + 16);

  petitTexte(doc, 'Identifiant', MARGE + 6, y + 26);
  doc.setFont('courier', 'bold'); doc.setFontSize(12); doc.setTextColor(COULEURS.encre);
  doc.text(compte.identifiant, MARGE + 6, y + 33);

  petitTexte(doc, 'Mot de passe', MARGE + 6, y + 43);
  doc.setFont('courier', 'bold'); doc.setFontSize(22);
  doc.text(compte.motDePasse, MARGE + 6, y + 53);

  try {
    const qr = await QRCode.toDataURL(compte.adresseSite, { margin: 0, width: 320, color: { dark: '#111827', light: '#F8FAFC' } });
    doc.addImage(qr, 'PNG', LARGEUR - MARGE - 6 - 40, y + 8, 40, 40);
    petitTexte(doc, 'Scannez pour ouvrir le site', LARGEUR - MARGE - 6 - 20, y + 53, 'center');
  } catch { /* pas de QR : les identifiants restent lisibles */ }
  y += hauteur + 10;

  // Mode d'emploi
  y = titreSection(doc, 'COMMENT SE CONNECTER', y);
  const etapes = [
    ["Ouvrez le site", "Tapez l'adresse ci-dessus dans le navigateur de votre téléphone, ou scannez le QR code."],
    ['Connectez-vous', "Saisissez l'identifiant et le mot de passe tels qu'ils sont écrits. Le mot de passe distingue majuscules et minuscules."],
    ["Installez l'application", "Dans le menu du navigateur, choisissez « Ajouter à l'écran d'accueil » : SenClass s'ouvre ensuite comme une application, même sans connexion internet."],
    ['Activez les notifications', "Dans « Profil », touchez « Activer les notifications » : vous serez prévenu des nouvelles notes, des bulletins, des paiements et des absences."],
  ];
  etapes.forEach(([titre, texte], i) => {
    const yy = y + i * 17;
    doc.setFillColor(COULEURS.marque);
    doc.circle(MARGE + 3.5, yy + 3.5, 3.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor('#FFFFFF');
    doc.text(String(i + 1), MARGE + 3.5, yy + 4.8, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(COULEURS.encre);
    doc.text(titre, MARGE + 11, yy + 3.2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    (doc.splitTextToSize(texte, UTILE - 12) as string[]).slice(0, 2)
      .forEach((l, k) => doc.text(l, MARGE + 11, yy + 8 + k * 4.2));
  });
  y += etapes.length * 17 + 4;

  doc.setFillColor('#FEF2F2');
  doc.setDrawColor(COULEURS.alerte);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGE, y, UTILE, 20, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(COULEURS.alerte);
  doc.text('Identifiants personnels et confidentiels', MARGE + 4, y + 6.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(COULEURS.encre);
  const avertissement = doc.splitTextToSize(
    "Ne les communiquez à personne et conservez cette page en lieu sûr. En cas de perte, ou si vous pensez qu'une autre personne les connaît, adressez-vous à l'administration de l'école" +
    (data.ecole.telephone ? ` (${data.ecole.telephone}).` : '.'),
    UTILE - 8,
  ) as string[];
  avertissement.slice(0, 3).forEach((l, i) => doc.text(l, MARGE + 4, y + 11.5 + i * 4.2));
};

export async function genererFicheInscriptionPdf(data: FicheInscriptionData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setProperties({
    title: `Fiche d'inscription — ${data.eleve.nom} ${data.eleve.prenoms}`,
    subject: `Année scolaire ${data.anneeScolaire}`,
    author: data.ecole.nom,
    creator: 'SenClass',
  });

  /** S'assure d'avoir `h` mm de place ; sinon page suivante. */
  const place = (y: number, h: number): number => (y + h > BAS ? suite(doc, data) : y);

  // ── En-tête ──────────────────────────────────────────────────────────────
  let y = dessinerEnTeteEcole(doc, data.ecole, MARGE, MARGE, UTILE, 20);

  // ── Titre, matricule, photo ──────────────────────────────────────────────
  const yTitre = y + 1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(COULEURS.encre);
  doc.text("FICHE D'INSCRIPTION", MARGE, yTitre + 7);

  doc.setFontSize(10.5);
  doc.setTextColor(COULEURS.marque);
  doc.text(
    `Année scolaire ${data.anneeScolaire}  ·  ${data.reinscription ? 'Réinscription' : 'Nouvelle inscription'}`,
    MARGE, yTitre + 14,
  );

  doc.setDrawColor(COULEURS.marque);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGE, yTitre + 19, 78, 12, 1.5, 1.5, 'S');
  petitTexte(doc, "N° d'inscription (matricule)", MARGE + 3, yTitre + 23.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(COULEURS.encre);
  doc.text(data.eleve.matricule, MARGE + 3, yTitre + 29);

  petitTexte(doc, `Inscrit le ${dateDakar(data.dateInscription)}`, MARGE + 84, yTitre + 29);

  // Photo : dans son cadre ; sans photo, le cadre vide sert à en coller une.
  const xPhoto = LARGEUR - MARGE - 26;
  doc.setDrawColor(COULEURS.trait);
  doc.setLineWidth(0.3);
  doc.rect(xPhoto, yTitre, 26, 33, 'S');
  let photoPosee = false;
  if (data.eleve.photo) {
    try {
      const { fileType } = doc.getImageProperties(data.eleve.photo);
      doc.addImage(data.eleve.photo, fileType, xPhoto + 0.4, yTitre + 0.4, 25.2, 32.2);
      photoPosee = true;
    } catch { /* photo illisible : cadre vide */ }
  }
  if (!photoPosee) petitTexte(doc, 'Photo', xPhoto + 13, yTitre + 17, 'center');

  y = yTitre + 36;

  // ── Identité et scolarité ────────────────────────────────────────────────
  y = titreSection(doc, "IDENTITÉ ET SCOLARITÉ", y);
  const rang = 10.6;
  champ(doc, 'Nom', data.eleve.nom, MARGE, y, COL);
  champ(doc, 'Prénom(s)', data.eleve.prenoms, MARGE + COL, y, COL);
  y += rang;
  champ(doc, 'Sexe', data.eleve.sexe, MARGE, y, COL);
  champ(doc, 'Date de naissance', data.eleve.dateNaissance, MARGE + COL, y, COL);
  y += rang;
  champ(doc, 'Lieu de naissance', data.eleve.lieuNaissance, MARGE, y, COL);
  champ(doc, 'Lieu de résidence', data.eleve.residence, MARGE + COL, y, COL);
  y += rang;
  champ(doc, 'Téléphone', data.eleve.telephone, MARGE, y, COL);
  champ(doc, 'E-mail', data.eleve.email, MARGE + COL, y, COL);
  y += rang;
  champ(doc, 'Classe', data.scolarite.classe, MARGE, y, COL);
  champ(doc, data.scolarite.filiere ? 'Niveau · Filière' : 'Niveau',
    [data.scolarite.niveau, data.scolarite.filiere].filter(Boolean).join(' · ') || undefined, MARGE + COL, y, COL);
  y += rang + 2;

  // ── Parents / tuteurs ────────────────────────────────────────────────────
  y = place(y, 8 + data.tuteurs.length * 13);
  y = titreSection(doc, 'PARENTS / TUTEURS', y);
  const colTuteur = [30, 62, 34, UTILE - 126];
  for (const t of data.tuteurs) {
    let x = MARGE;
    champ(doc, 'Qualité', t.qualite, x, y, colTuteur[0]); x += colTuteur[0];
    champ(doc, 'Nom complet', t.nom, x, y, colTuteur[1]); x += colTuteur[1];
    champ(doc, 'Téléphone', t.telephone, x, y, colTuteur[2]); x += colTuteur[2];
    champ(doc, 'E-mail', t.email, x, y, colTuteur[3]);
    y += 12;
  }
  y += 2;

  // ── Frais : une ligne ────────────────────────────────────────────────────
  if (data.frais) {
    y = place(y, 12);
    doc.setFillColor(COULEURS.fond);
    doc.roundedRect(MARGE, y, UTILE, 9, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.2); doc.setTextColor(COULEURS.encre);
    doc.text("Frais d'inscription :", MARGE + 3, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`${formaterMontant(data.frais.inscription ?? 0)} FCFA`, MARGE + 36, y + 6);
    caseACocher(doc, MARGE + 66, y + 2.6, data.frais.inscriptionPayee);
    doc.setFont('helvetica', 'normal');
    doc.text('payés', MARGE + 71, y + 6);
    doc.text('Scolarité mensuelle :', MARGE + 100, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`${formaterMontant(data.frais.mensualite ?? 0)} FCFA`, MARGE + 133, y + 6);
    y += 13;
  }

  // ── Pièces à fournir ─────────────────────────────────────────────────────
  y = place(y, 24);
  y = titreSection(doc, 'PIÈCES À FOURNIR', y);
  const colPiece = UTILE / 3;
  PIECES_A_FOURNIR.forEach((piece, i) => {
    const x = MARGE + (i % 3) * colPiece;
    const yy = y + Math.floor(i / 3) * 6;
    caseACocher(doc, x, yy, false);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2); doc.setTextColor(COULEURS.encre);
    const [ligne] = doc.splitTextToSize(piece, colPiece - 7) as string[];
    doc.text(ligne, x + 5.2, yy + 2.9);
  });
  y += Math.ceil(PIECES_A_FOURNIR.length / 3) * 6 + 3;

  // ── Engagement et signatures ─────────────────────────────────────────────
  y = place(y, 44);
  y = titreSection(doc, 'ENGAGEMENT', y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(COULEURS.encre);
  const engagement = doc.splitTextToSize(
    "Le parent / tuteur soussigné certifie l'exactitude des renseignements ci-dessus, s'engage à respecter le règlement " +
    "intérieur de l'établissement et à s'acquitter des frais de scolarité aux échéances fixées.",
    UTILE,
  ) as string[];
  engagement.forEach((l, i) => doc.text(l, MARGE, y + 3 + i * 4.2));
  y += engagement.length * 4.2 + 4;

  const lieu = data.ecole.ville ?? '';
  petitTexte(doc, `Fait à ${lieu || '____________'}, le ${dateDakar(data.dateInscription)}`, MARGE, y);
  y += 3;
  doc.setDrawColor(COULEURS.trait);
  doc.setLineWidth(0.3);
  const largeurBoite = UTILE / 2 - 3;
  const hauteurBoite = Math.max(20, Math.min(26, BAS - y - 2));
  doc.roundedRect(MARGE, y, largeurBoite, hauteurBoite, 1.5, 1.5, 'S');
  doc.roundedRect(MARGE + UTILE / 2 + 3, y, largeurBoite, hauteurBoite, 1.5, 1.5, 'S');
  petitTexte(doc, 'Le parent / tuteur — « Lu et approuvé »', MARGE + 3, y + 4.5);
  petitTexte(doc, "La direction — signature et cachet de l'école", MARGE + UTILE / 2 + 6, y + 4.5);

  // ── Page 2 : identifiants, exemplaire de la famille ──────────────────────
  if (data.compte) await pageIdentifiants(doc, data, data.compte);

  // ── Pied (sur chaque page) ───────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    petitTexte(doc,
      p > 1 && data.compte
        ? "Document confidentiel : il contient des identifiants d'accès. Conservez-le en lieu sûr."
        : data.compte
          ? "Fiche d'inscription — exemplaire de l'école. Identifiants de connexion : page 2, remise à la famille."
          : "Fiche d'inscription — exemplaire de l'école. Identifiants de connexion : à retirer auprès de l'administration.",
      LARGEUR / 2, HAUTEUR - 10, 'center');
    petitTexte(doc, `Page ${p} / ${pages}  ·  Édité avec SenClass`, LARGEUR / 2, HAUTEUR - 6.5, 'center');
  }

  return doc;
}
