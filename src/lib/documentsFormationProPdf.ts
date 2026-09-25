import jsPDF from 'jspdf';
import type { InfosEcole } from '@/lib/documentsEcole';
import { dateDakar } from '@/lib/documentsEcole';
import { couleurDominanteDuLogo, paletteDepuis, type Palette } from '@/lib/couleurLogo';
import {
  ENCRE, GRIS, dessinerBandeau, dessinerTitre, ecrireAjuste, etiquette, filigrane, guilloche, signatureSenClass,
} from '@/lib/documentsDesign';
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

// ─── Bulletin de période ─────────────────────────────────────────────────────

const pageBulletin = (doc: jsPDF, d: DonneesBulletins, b: BulletinEleve, c: Palette) => {
  enTete(doc, d.ecole, c);
  let y = HAUT_BANDEAU + 14;
  dessinerTitre(doc, c, 'BULLETIN DE NOTES', M, y, 19, 0.4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(c.accent);
  const dates = d.periode.debut || d.periode.fin ? `  (du ${dateCourte(d.periode.debut) || '…'} au ${dateCourte(d.periode.fin) || '…'})` : '';
  doc.text(`${d.periode.nom}${dates}`, M, y + 10);
  y += 17;

  y = encadre(doc, c, y, [
    ['Élève', `${b.eleve.nom} ${b.eleve.prenoms}`],
    ['Matricule', b.eleve.matricule],
    ['Formation', `${d.formation} — ${d.niveau}`],
    ['Promotion', d.promotion],
  ]);

  // ── Tableau des matières ──
  const cols = [U - 78, 22, 28, 28];
  const xs = [M, M + cols[0], M + cols[0] + cols[1], M + cols[0] + cols[1] + cols[2]];
  doc.setFillColor(c.fonce);
  doc.rect(M, y, U, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor('#FFFFFF');
  doc.text('MATIÈRE', xs[0] + 3, y + 5.4);
  doc.text('COEF.', xs[1] + cols[1] / 2, y + 5.4, { align: 'center' });
  doc.text('MOYENNE /20', xs[2] + cols[2] / 2, y + 5.4, { align: 'center' });
  doc.text('POINTS', xs[3] + cols[3] / 2, y + 5.4, { align: 'center' });
  y += 8;
  // Un programme long resserre ses lignes : le bulletin tient toujours sur UNE page.
  const hLigne = Math.min(7.4, 118 / Math.max(1, b.lignes.length));
  const taille = Math.min(9.6, hLigne * 1.3);
  const base = hLigne * 0.68;
  b.lignes.forEach((l, i) => {
    if (i % 2 === 1) { doc.setFillColor(c.pale); doc.rect(M, y, U, hLigne, 'F'); }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(taille);
    doc.setTextColor(ENCRE);
    ecrireAjuste(doc, l.stage ? `${l.matiere} (stage)` : l.matiere, xs[0] + 3, y + base, cols[0] - 6, { taille, tailleMin: Math.min(7, taille) });
    doc.text(String(l.coefficient).replace('.', ','), xs[1] + cols[1] / 2, y + base, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(l.moyenne == null ? GRIS : l.moyenne >= 10 ? '#15803D' : '#B91C1C');
    doc.text(note(l.moyenne), xs[2] + cols[2] / 2, y + base, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(ENCRE);
    doc.text(l.moyenne == null ? '—' : note(l.moyenne * l.coefficient), xs[3] + cols[3] / 2, y + base, { align: 'center' });
    y += hLigne;
  });
  doc.setDrawColor(c.trait);
  doc.setLineWidth(0.3);
  doc.line(M, y, L - M, y);
  y += 6;

  // ── Résultat ──
  doc.setFillColor(c.pale);
  doc.setDrawColor(c.accent);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y, U, 22, 2, 2, 'FD');
  const quart = U / 4;
  const bloc = (i: number, nom: string, valeur: string, fort = false) => {
    const cx = M + quart * i + quart / 2;
    etiquette(doc, nom, cx, y + 7, GRIS, 'center');
    doc.setFont(fort ? 'times' : 'helvetica', 'bold');
    doc.setFontSize(fort ? 17 : 12);
    doc.setTextColor(fort ? c.fonce : ENCRE);
    doc.text(valeur, cx, y + 16, { align: 'center' });
  };
  bloc(0, 'Moyenne générale', b.moyenneGenerale == null ? '—' : `${note(b.moyenneGenerale)} /20`, true);
  bloc(1, 'Rang', b.rang == null ? '—' : `${rangOrdinal(b.rang)} / ${d.effectifClasse}`);
  bloc(2, 'Moyenne de la promotion', d.moyennePromotion == null ? '—' : note(d.moyennePromotion));
  bloc(3, 'Coefficients notés', String(b.totalCoefficients).replace('.', ','));
  y += 28;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.8);
  doc.setTextColor(GRIS);
  const rappel = doc.splitTextToSize(
    `Moyenne de chaque matière : ${d.formule}. Une matière (stage) prend la note du stage. Une note manquante n'est jamais comptée 0 : elle n'entre pas dans la moyenne.`,
    U,
  ) as string[];
  rappel.forEach(l => { doc.text(l, M, y); y += 3.8; });

  signatureDirection(doc, d.ecole, c, Math.min(Math.max(y + 8, 222), 244));
  piedDePage(doc, d.ecole, c, `Bulletin de ${b.eleve.nom} ${b.eleve.prenoms} — ${d.periode.nom}`);
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
