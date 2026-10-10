import {
  STYLE_TEXTE_PAR_DEFAUT, type DocumentVisuel, type ElementVisuel, type StyleTexte,
} from '@/lib/documentVisuel';

// ═══════════════════════════════════════════════════════════════════════════
// MODÈLES FOURNIS PAR SENCLASS
//
// Livrés avec le logiciel (pas en base) : toutes les écoles les ont. Ce sont
// des pages de l'éditeur visuel : une école qui veut les retoucher en fait une
// COPIE, qu'elle modifie à la souris comme n'importe quel document.
//
// Style administratif sénégalais : NOIR ET BLANC uniquement, Times New Roman.
// Logo et identité de l'école en tête, titre en capitales, les informations
// de l'élève (ou du professeur) dans un cadre à filet noir, des pointillés pour
// ce qui s'écrit à la main (date, heure, motif…), signature, pied de page.
//
// Ils n'utilisent que des champs du catalogue (un test le vérifie).
// ═══════════════════════════════════════════════════════════════════════════

export interface ModeleParDefaut {
  /** Identifiant stable, préfixé pour ne jamais croiser un id de la base. */
  id: string;
  nom: string;
  contenu: DocumentVisuel;
}

const NOIR = '#000000';
const POLICE = 'Times New Roman';

let compteur = 0;
const id = () => `senclass-el-${++compteur}`;

const texte = (x: number, y: number, l: number, h: number, html: string, style: Partial<StyleTexte> = {}): ElementVisuel => ({
  id: id(), type: 'texte', x, y, l, h, rotation: 0, html,
  style: { ...STYLE_TEXTE_PAR_DEFAUT, police: POLICE, taille: 12, couleur: NOIR, interligne: 1.7, ...style },
  fond: null, bordure: null,
});

const trait = (x: number, y: number, l: number, epaisseur = 0.5): ElementVisuel =>
  ({ id: id(), type: 'ligne', x, y, l, h: 1, rotation: 0, bordure: { couleur: NOIR, epaisseur, style: 'solid' } });

/** Un cadre à filet noir, sans fond : rien de gris à l'impression. */
const cadre = (x: number, y: number, l: number, h: number): ElementVisuel => ({
  id: id(), type: 'forme', forme: 'rectangle', x, y, l, h, rotation: 0,
  fond: null, bordure: { couleur: NOIR, epaisseur: 0.3, style: 'solid' }, arrondi: 0,
});

/** Des pointillés à remplir à la main. */
const blanc = (mm: number) =>
  `<span style="display:inline-block;width:${mm}mm;border-bottom:1px dotted #000">&nbsp;</span>`;

/** Une case à cocher à la main. */
const caseACocher = '<span style="display:inline-block;width:3.4mm;height:3.4mm;border:1px solid #000;vertical-align:-0.5mm;margin-right:2.5mm"></span>';

/** « Libellé : valeur » dans un cadre. */
const ligne = (libelle: string, valeur: string) => `${libelle} :&nbsp;&nbsp;${valeur}`;

// ─── Les briques communes ─────────────────────────────────────────────────

const entete = (avecNumero = false): ElementVisuel[] => [
  { id: id(), type: 'image', x: 18, y: 14, l: 22, h: 22, rotation: 0, source: 'logo' },
  texte(44, 15, 84, 22,
    `<span style="font-size:13pt;font-weight:bold;text-transform:uppercase">{NOM DE L'ÉTABLISSEMENT}</span><br>`
    + "{ADRESSE DE L'ÉTABLISSEMENT}<br>Tél. : {TÉLÉPHONE DE L'ÉTABLISSEMENT} — {E-MAIL DE L'ÉTABLISSEMENT}",
    { taille: 10, interligne: 1.4 }),
  texte(130, 16, 62, 6, '{VILLE}, le {DATE EN LETTRES}', { taille: 10, alignement: 'right', interligne: 1.3 }),
  ...(avecNumero ? [texte(130, 24, 62, 6, 'N° {NUMÉRO DU DOCUMENT}', { taille: 10, alignement: 'right', interligne: 1.3 })] : []),
  trait(18, 40, 174),
];

const titre = (y: number, intitule: string, sousTitre: string): ElementVisuel[] => [
  texte(18, y, 174, 10, intitule.toUpperCase(), { taille: 17, gras: true, souligne: true, alignement: 'center', interligne: 1.2 }),
  texte(18, y + 13, 174, 7, sousTitre, { taille: 11, italique: true, alignement: 'center', interligne: 1.3 }),
];

const corps = (y: number, h: number, html: string, style: Partial<StyleTexte> = {}): ElementVisuel =>
  texte(22, y, 166, h, html, { alignement: 'justify', ...style });

/** Les informations clés dans un cadre gris clair. */
const encadre = (y: number, lignes: string[]): ElementVisuel[] => {
  const h = Math.round(lignes.length * 8.4 + 7);
  return [cadre(22, y, 166, h), texte(28, y + 3, 156, h - 6, lignes.join('<br>'), { taille: 11.5, interligne: 2 })];
};

const destinataire = (y: number, html: string): ElementVisuel =>
  texte(108, y, 84, 19, html, { taille: 11.5, interligne: 1.5 });

const signature = (x: number, y: number, qui: string, mention: string, nom: string): ElementVisuel[] => [
  texte(x, y, 72, 7, `<b>${qui}</b>`, { taille: 11.5, alignement: 'center', interligne: 1.3 }),
  texte(x, y + 6, 72, 6, mention, { taille: 9.5, italique: true, alignement: 'center', interligne: 1.3 }),
  texte(x, y + 30, 72, 7, nom, { taille: 11.5, alignement: 'center', interligne: 1.3 }),
];

/** Cadre « Décision de la direction », pour les demandes. */
const decision = (x: number, y: number): ElementVisuel[] => [
  cadre(x, y, 74, 44),
  texte(x + 4, y + 3, 66, 38,
    '<b>DÉCISION DE LA DIRECTION</b><br>'
    + `${caseACocher}Accordée&nbsp;&nbsp;&nbsp;&nbsp;${caseACocher}Refusée<br>`
    + 'Date et signature :',
    { taille: 11, interligne: 2.1 }),
];

const pied = (): ElementVisuel[] => [
  trait(18, 281, 174, 0.3),
  texte(18, 283, 174, 6, "{NOM DE L'ÉTABLISSEMENT} — {ADRESSE DE L'ÉTABLISSEMENT} — Tél. : {TÉLÉPHONE DE L'ÉTABLISSEMENT}",
    { taille: 8, alignement: 'center', interligne: 1.2 }),
];

const page = (elements: ElementVisuel[]): DocumentVisuel => ({ version: 1, orientation: 'portrait', fond: '#ffffff', elements });

const identiteEleve = [
  ligne('Nom et prénom', "<b>{NOM ET PRÉNOM DE L'ÉLÈVE}</b>"),
  ligne('Né(e) le', '{DATE DE NAISSANCE} à {LIEU DE NAISSANCE}'),
  ligne('Matricule', '{MATRICULE}'),
];

const DIRECTEUR = (y: number) => signature(118, y, 'Le Directeur', 'Cachet et signature', '{NOM DU DIRECTEUR}');

// ─── Les modèles ───────────────────────────────────────────────────────────

export const MODELES_PAR_DEFAUT: readonly ModeleParDefaut[] = [
  {
    id: 'senclass:certificat-scolarite',
    nom: 'Certificat de scolarité',
    contenu: page([
      ...entete(true),
      ...titre(56, 'Certificat de scolarité', 'Année scolaire {ANNÉE SCOLAIRE}'),
      corps(88, 9, "Le Directeur de l'établissement <b>{NOM DE L'ÉTABLISSEMENT}</b> certifie que l'élève :"),
      ...encadre(101, [...identiteEleve, ligne('Classe', '<b>{CLASSE}</b>')]),
      corps(146, 40,
        "est régulièrement inscrit(e) et fréquente l'établissement au titre de l'année scolaire <b>{ANNÉE SCOLAIRE}</b>.<br><br>"
        + 'En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.'),
      ...DIRECTEUR(200),
      ...pied(),
    ]),
  },
  {
    id: 'senclass:certificat-inscription',
    nom: "Certificat d'inscription",
    contenu: page([
      ...entete(true),
      ...titre(56, "Certificat d'inscription", 'Année scolaire {ANNÉE SCOLAIRE}'),
      corps(88, 9, "Le Directeur de l'établissement <b>{NOM DE L'ÉTABLISSEMENT}</b> certifie que l'élève :"),
      ...encadre(101, identiteEleve),
      corps(138, 44,
        "est inscrit(e) dans l'établissement en classe de <b>{CLASSE}</b> pour l'année scolaire <b>{ANNÉE SCOLAIRE}</b>, "
        + "depuis le {DATE D'INSCRIPTION}.<br><br>"
        + 'En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.'),
      ...DIRECTEUR(200),
      ...pied(),
    ]),
  },
  {
    id: 'senclass:convocation-eleve',
    nom: "Convocation de l'élève",
    contenu: page([
      ...entete(),
      ...titre(56, 'Convocation', 'Élève'),
      corps(88, 9, "L'élève <b>{NOM ET PRÉNOM DE L'ÉLÈVE}</b>, en classe de <b>{CLASSE}</b>, est convoqué(e) :"),
      ...encadre(101, [
        ligne('Date', blanc(60)), ligne('Heure', blanc(35)), ligne('Lieu', blanc(80)), ligne('Motif', blanc(120)),
      ]),
      corps(146, 24,
        "La présence de l'élève est obligatoire. Il ou elle voudra bien se présenter à l'heure indiquée, muni(e) de la présente convocation."),
      ...signature(22, 200, 'Le parent / tuteur', 'Vu et pris connaissance', '{NOM DU TUTEUR}'),
      ...DIRECTEUR(200),
      ...pied(),
    ]),
  },
  {
    id: 'senclass:convocation-parent',
    nom: "Convocation d'un parent",
    contenu: page([
      ...entete(),
      ...titre(56, 'Convocation', 'Parent ou tuteur'),
      destinataire(84, "À l'attention de<br><b>{NOM DU TUTEUR}</b><br><span style=\"font-size:10pt\">Parent / tuteur de {PRÉNOM ET NOM DE L'ÉLÈVE}</span>"),
      corps(110, 26,
        'Madame, Monsieur,<br>'
        + "Nous vous prions de bien vouloir vous présenter à l'établissement au sujet de votre enfant <b>{PRÉNOM ET NOM DE L'ÉLÈVE}</b>, "
        + 'élève en classe de <b>{CLASSE}</b>.'),
      ...encadre(141, [ligne('Date', blanc(60)), ligne('Heure', blanc(35)), ligne('Objet', blanc(120))]),
      corps(178, 26,
        "Votre présence est vivement souhaitée. En cas d'empêchement, merci de contacter l'administration au {TÉLÉPHONE DE L'ÉTABLISSEMENT}.<br>"
        + "Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées."),
      ...DIRECTEUR(214),
      ...pied(),
    ]),
  },
  {
    id: 'senclass:absence-eleve',
    nom: "Demande de permission d'absence — élève",
    contenu: page([
      ...entete(),
      ...titre(56, "Demande de permission d'absence", 'Élève'),
      destinataire(84, "À Monsieur / Madame le Directeur<br><b>{NOM DE L'ÉTABLISSEMENT}</b>"),
      corps(106, 26,
        "Je soussigné(e), <b>{NOM DU TUTEUR}</b>, parent / tuteur de l'élève <b>{NOM ET PRÉNOM DE L'ÉLÈVE}</b>, "
        + 'en classe de <b>{CLASSE}</b>, sollicite une permission d\'absence pour mon enfant :'),
      ...encadre(134, [
        `${ligne('Du', blanc(40))}&nbsp;&nbsp;&nbsp;${ligne('au', blanc(40))}`,
        ligne('Nombre de jours', blanc(25)),
        ligne('Motif', blanc(120)),
      ]),
      corps(170, 10, "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations respectueuses."),
      ...signature(22, 192, 'Le parent / tuteur', 'Signature', '{NOM DU TUTEUR}'),
      ...decision(116, 190),
      ...pied(),
    ]),
  },
  {
    id: 'senclass:absence-professeur',
    nom: "Demande de permission d'absence — professeur",
    contenu: page([
      ...entete(),
      ...titre(56, "Demande de permission d'absence", 'Personnel enseignant'),
      destinataire(84, "À Monsieur / Madame le Directeur<br><b>{NOM DE L'ÉTABLISSEMENT}</b>"),
      corps(106, 26,
        'Je soussigné(e), <b>{CIVILITÉ DU PROFESSEUR} {PRÉNOM ET NOM DU PROFESSEUR}</b>, professeur de {MATIÈRES ENSEIGNÉES} '
        + '(matricule {MATRICULE DU PROFESSEUR}), sollicite une permission d\'absence :'),
      ...encadre(134, [
        `${ligne('Du', blanc(40))}&nbsp;&nbsp;&nbsp;${ligne('au', blanc(40))}`,
        ligne('Nombre de jours', blanc(25)),
        ligne('Motif', blanc(120)),
        ligne('Classes concernées', '{CLASSES DU PROFESSEUR}'),
      ]),
      corps(178, 17, `Dispositions prises pour les cours : ${blanc(90)}<br>${blanc(160)}`, { alignement: 'left' }),
      ...signature(22, 200, "L'enseignant(e)", 'Signature', '{PRÉNOM ET NOM DU PROFESSEUR}'),
      ...decision(116, 198),
      ...pied(),
    ]),
  },
  {
    id: 'senclass:sortie-scolaire',
    nom: 'Autorisation parentale de sortie scolaire',
    contenu: page([
      ...entete(),
      ...titre(56, 'Autorisation parentale', 'Sortie scolaire'),
      corps(86, 16,
        "Je soussigné(e), <b>{NOM DU TUTEUR}</b>, parent / tuteur de l'élève <b>{NOM ET PRÉNOM DE L'ÉLÈVE}</b>, "
        + 'en classe de <b>{CLASSE}</b> :'),
      corps(106, 18,
        `${caseACocher}autorise mon enfant à participer à la sortie scolaire décrite ci-dessous ;<br>`
        + `${caseACocher}n'autorise pas mon enfant à y participer.`, { alignement: 'left' }),
      ...encadre(128, [
        ligne('Destination', blanc(110)),
        ligne('Date', blanc(50)),
        `${ligne('Départ', blanc(30))}&nbsp;&nbsp;&nbsp;${ligne('Retour', blanc(30))}`,
        ligne('Encadrement', blanc(105)),
      ]),
      corps(172, 22, "En cas d'urgence, je peux être joint(e) au <b>{TÉLÉPHONE DU TUTEUR}</b>."),
      texte(22, 196, 90, 7, `Fait à ${blanc(30)}, le ${blanc(30)}`, { taille: 11 }),
      ...signature(118, 196, 'Le parent / tuteur', 'Signature précédée de « Lu et approuvé »', '{NOM DU TUTEUR}'),
      ...pied(),
    ]),
  },
];

export const estModeleParDefaut = (idModele: string): boolean => idModele.startsWith('senclass:');

// ─── Modèle de REÇU (A5) ───────────────────────────────────────────────────
// Le reçu SenClass (src/lib/recuPdf.ts, version noir et blanc) refait en page
// de l'éditeur, aux mêmes mesures : en-tête à double filet et logo dans un
// cercle, titre à empattements, numéro en pastille, carte de l'élève, tableau,
// total encadré, tampon ACQUITTÉ, somme en lettres, mode / référence /
// encaissé par, signatures et cachet, pied de page. L'école en fait une copie
// et la modifie à son goût (Documents → Reçus).
//
// Le tableau, le total, la somme en lettres, les informations et les
// signatures sont dans UN bloc qui s'allonge avec le nombre de lignes, comme
// sur le reçu SenClass (et se resserre un peu s'il manque de place).

const R_FONCE = '#111827';
const R_ACCENT = '#374151';
const R_PALE = '#F6F6F6';
const R_GRIS = '#6B7280';
const R_ENCRE = '#1F2937';
const R_FILET = '#E5E7EB';

/** Le motif de sécurité du pied de page (mêmes ondes que le reçu SenClass), en image. */
const MOTIF_GUILLOCHE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNDgwIiBoZWlnaHQ9IjkyIiB2aWV3Qm94PSIwIDAgMTQ4IDkuMiIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjQkRCREJEIiBzdHJva2Utd2lkdGg9IjAuMTgiPjxwYXRoIGQ9Ik0wLjAgNC42MCBMMC43IDUuNjEgTDEuNCA2LjU1IEwyLjEgNy4zMyBMMi44IDcuOTEgTDMuNSA4LjI0IEw0LjIgOC4yOSBMNC45IDguMDggTDUuNiA3LjYzIEw2LjMgNi45NyBMNy4wIDYuMTYgTDcuNyA1LjI3IEw4LjQgNC4zOCBMOS4xIDMuNTQgTDkuOCAyLjg0IEwxMC41IDIuMzAgTDExLjIgMS45NyBMMTEuOSAxLjg1IEwxMi42IDEuOTUgTDEzLjMgMi4yMyBMMTQuMCAyLjY2IEwxNC43IDMuMTkgTDE1LjQgMy43NyBMMTYuMSA0LjM0IEwxNi44IDQuODUgTDE3LjUgNS4yNiBMMTguMiA1LjU1IEwxOC45IDUuNzEgTDE5LjYgNS43NCBMMjAuMyA1LjY1IEwyMS4wIDUuNDcgTDIxLjcgNS4yNSBMMjIuNCA1LjAyIEwyMy4xIDQuODIgTDIzLjggNC42NyBMMjQuNSA0LjYwIEwyNS4yIDQuNjMgTDI1LjkgNC43NCBMMjYuNiA0LjkyIEwyNy4zIDUuMTQgTDI4LjAgNS4zNyBMMjguNyA1LjU3IEwyOS40IDUuNzEgTDMwLjEgNS43NCBMMzAuOCA1LjY1IEwzMS41IDUuNDIgTDMyLjIgNS4wNiBMMzIuOSA0LjU5IEwzMy42IDQuMDUgTDM0LjMgMy40NyBMMzUuMCAyLjkxIEwzNS43IDIuNDIgTDM2LjQgMi4wNiBMMzcuMSAxLjg3IEwzNy44IDEuODkgTDM4LjUgMi4xMiBMMzkuMiAyLjU2IEwzOS45IDMuMTkgTDQwLjYgMy45NyBMNDEuMyA0Ljg0IEw0Mi4wIDUuNzQgTDQyLjcgNi41OSBMNDMuNCA3LjMzIEw0NC4xIDcuODkgTDQ0LjggOC4yMyBMNDUuNSA4LjMwIEw0Ni4yIDguMTAgTDQ2LjkgNy42NCBMNDcuNiA2Ljk0IEw0OC4zIDYuMDcgTDQ5LjAgNS4wOSBMNDkuNyA0LjA2IEw1MC40IDMuMDggTDUxLjEgMi4yMiBMNTEuOCAxLjU0IEw1Mi41IDEuMDkgTDUzLjIgMC45MCBMNTMuOSAwLjk4IEw1NC42IDEuMzMgTDU1LjMgMS45MCBMNTYuMCAyLjY0IEw1Ni43IDMuNTAgTDU3LjQgNC40MCBMNTguMSA1LjI3IEw1OC44IDYuMDUgTDU5LjUgNi42NyBMNjAuMiA3LjEwIEw2MC45IDcuMzIgTDYxLjYgNy4zMiBMNjIuMyA3LjEyIEw2My4wIDYuNzYgTDYzLjcgNi4yNyBMNjQuNCA1LjcxIEw2NS4xIDUuMTMgTDY1LjggNC41OCBMNjYuNSA0LjEyIEw2Ny4yIDMuNzcgTDY3LjkgMy41NSBMNjguNiAzLjQ2IEw2OS4zIDMuNTAgTDcwLjAgMy42MyBMNzAuNyAzLjg0IEw3MS40IDQuMDcgTDcyLjEgNC4yOSBMNzIuOCA0LjQ3IEw3My41IDQuNTggTDc0LjIgNC42MCBMNzQuOSA0LjUzIEw3NS42IDQuMzggTDc2LjMgNC4xNyBMNzcuMCAzLjk0IEw3Ny43IDMuNzIgTDc4LjQgMy41NSBMNzkuMSAzLjQ2IEw3OS44IDMuNDkgTDgwLjUgMy42NiBMODEuMiAzLjk1IEw4MS45IDQuMzcgTDgyLjYgNC44OSBMODMuMyA1LjQ2IEw4NC4wIDYuMDMgTDg0LjcgNi41NiBMODUuNCA2Ljk4IEw4Ni4xIDcuMjYgTDg2LjggNy4zNSBMODcuNSA3LjIyIEw4OC4yIDYuODggTDg4LjkgNi4zMyBMODkuNiA1LjYyIEw5MC4zIDQuNzggTDkxLjAgMy44OSBMOTEuNyAzLjAwIEw5Mi40IDIuMjAgTDkzLjEgMS41NSBMOTMuOCAxLjEwIEw5NC41IDAuOTAgTDk1LjIgMC45NyBMOTUuOSAxLjMxIEw5Ni42IDEuOTAgTDk3LjMgMi43MCBMOTguMCAzLjYzIEw5OC43IDQuNjUgTDk5LjQgNS42NiBMMTAwLjEgNi41OSBMMTAwLjggNy4zNiBMMTAxLjUgNy45MyBMMTAyLjIgOC4yNSBMMTAyLjkgOC4yOSBMMTAzLjYgOC4wNyBMMTA0LjMgNy42MCBMMTA1LjAgNi45MyBMMTA1LjcgNi4xMiBMMTA2LjQgNS4yMyBMMTA3LjEgNC4zMyBMMTA3LjggMy41MSBMMTA4LjUgMi44MSBMMTA5LjIgMi4yOCBMMTA5LjkgMS45NiBMMTEwLjYgMS44NSBMMTExLjMgMS45NiBMMTEyLjAgMi4yNSBMMTEyLjcgMi42OSBMMTEzLjQgMy4yMiBMMTE0LjEgMy44MCBMMTE0LjggNC4zNiBMMTE1LjUgNC44NyBMMTE2LjIgNS4yOCBMMTE2LjkgNS41NiBMMTE3LjYgNS43MSBMMTE4LjMgNS43MyBMMTE5LjAgNS42NCBMMTE5LjcgNS40NiBMMTIwLjQgNS4yNCBMMTIxLjEgNS4wMSBMMTIxLjggNC44MSBMMTIyLjUgNC42NiBMMTIzLjIgNC42MCBMMTIzLjkgNC42MyBMMTI0LjYgNC43NCBMMTI1LjMgNC45MyBMMTI2LjAgNS4xNSBMMTI2LjcgNS4zOCBMMTI3LjQgNS41OCBMMTI4LjEgNS43MSBMMTI4LjggNS43NCBMMTI5LjUgNS42NCBMMTMwLjIgNS40MCBMMTMwLjkgNS4wNCBMMTMxLjYgNC41NyBMMTMyLjMgNC4wMiBMMTMzLjAgMy40NCBMMTMzLjcgMi44OCBMMTM0LjQgMi40MCBMMTM1LjEgMi4wNSBMMTM1LjggMS44NyBMMTM2LjUgMS44OSBMMTM3LjIgMi4xMyBMMTM3LjkgMi41OCBMMTM4LjYgMy4yMiBMMTM5LjMgNC4wMSBMMTQwLjAgNC44OCBMMTQwLjcgNS43OCBMMTQxLjQgNi42MyBMMTQyLjEgNy4zNiBMMTQyLjggNy45MiBMMTQzLjUgOC4yNCBMMTQ0LjIgOC4zMCBMMTQ0LjkgOC4wOCBMMTQ1LjYgNy42MSBMMTQ2LjMgNi45MCBMMTQ3LjAgNi4wMyBMMTQ3LjcgNS4wNCIvPjxwYXRoIGQ9Ik0wLjAgNy4zNyBMMC43IDcuNzggTDEuNCA3Ljk1IEwyLjEgNy44NyBMMi44IDcuNTYgTDMuNSA3LjA1IEw0LjIgNi4zOSBMNC45IDUuNjUgTDUuNiA0Ljg4IEw2LjMgNC4xNiBMNy4wIDMuNTMgTDcuNyAzLjA1IEw4LjQgMi43MiBMOS4xIDIuNTggTDkuOCAyLjYxIEwxMC41IDIuNzkgTDExLjIgMy4wOSBMMTEuOSAzLjQ2IEwxMi42IDMuODYgTDEzLjMgNC4yNCBMMTQuMCA0LjU2IEwxNC43IDQuODEgTDE1LjQgNC45NSBMMTYuMSA0Ljk5IEwxNi44IDQuOTMgTDE3LjUgNC44MSBMMTguMiA0LjY1IEwxOC45IDQuNDggTDE5LjYgNC4zNSBMMjAuMyA0LjI4IEwyMS4wIDQuMjkgTDIxLjcgNC40MSBMMjIuNCA0LjYzIEwyMy4xIDQuOTQgTDIzLjggNS4zMCBMMjQuNSA1LjY4IEwyNS4yIDYuMDQgTDI1LjkgNi4zMyBMMjYuNiA2LjUxIEwyNy4zIDYuNTUgTDI4LjAgNi40MSBMMjguNyA2LjExIEwyOS40IDUuNjQgTDMwLjEgNS4wMyBMMzAuOCA0LjMyIEwzMS41IDMuNTcgTDMyLjIgMi44NCBMMzIuOSAyLjIwIEwzMy42IDEuNjkgTDM0LjMgMS4zNyBMMzUuMCAxLjI5IEwzNS43IDEuNDUgTDM2LjQgMS44NiBMMzcuMSAyLjQ5IEwzNy44IDMuMzEgTDM4LjUgNC4yNCBMMzkuMiA1LjIzIEwzOS45IDYuMTkgTDQwLjYgNy4wNSBMNDEuMyA3Ljc1IEw0Mi4wIDguMjIgTDQyLjcgOC40MiBMNDMuNCA4LjM1IEw0NC4xIDguMDEgTDQ0LjggNy40MiBMNDUuNSA2LjYzIEw0Ni4yIDUuNzAgTDQ2LjkgNC43MSBMNDcuNiAzLjczIEw0OC4zIDIuODUgTDQ5LjAgMi4xMSBMNDkuNyAxLjU5IEw1MC40IDEuMzAgTDUxLjEgMS4yNiBMNTEuOCAxLjQ3IEw1Mi41IDEuODkgTDUzLjIgMi40OCBMNTMuOSAzLjE5IEw1NC42IDMuOTUgTDU1LjMgNC43MCBMNTYuMCA1LjM4IEw1Ni43IDUuOTQgTDU3LjQgNi4zNCBMNTguMSA2LjU3IEw1OC44IDYuNjIgTDU5LjUgNi41MSBMNjAuMiA2LjI3IEw2MC45IDUuOTIgTDYxLjYgNS41MyBMNjIuMyA1LjE0IEw2My4wIDQuNzggTDYzLjcgNC41MCBMNjQuNCA0LjMxIEw2NS4xIDQuMjIgTDY1LjggNC4yMyBMNjYuNSA0LjMzIEw2Ny4yIDQuNDcgTDY3LjkgNC42NCBMNjguNiA0LjgwIEw2OS4zIDQuOTAgTDcwLjAgNC45MyBMNzAuNyA0Ljg2IEw3MS40IDQuNjggTDcyLjEgNC40MiBMNzIuOCA0LjA4IEw3My41IDMuNzAgTDc0LjIgMy4zMyBMNzQuOSAzLjAwIEw3NS42IDIuNzYgTDc2LjMgMi42NSBMNzcuMCAyLjcwIEw3Ny43IDIuOTIgTDc4LjQgMy4zMiBMNzkuMSAzLjg3IEw3OS44IDQuNTMgTDgwLjUgNS4yNyBMODEuMiA2LjAxIEw4MS45IDYuNzEgTDgyLjYgNy4yOSBMODMuMyA3LjcwIEw4NC4wIDcuOTAgTDg0LjcgNy44NiBMODUuNCA3LjU2IEw4Ni4xIDcuMDMgTDg2LjggNi4zMCBMODcuNSA1LjQxIEw4OC4yIDQuNDQgTDg4LjkgMy40NiBMODkuNiAyLjU0IEw5MC4zIDEuNzYgTDkxLjAgMS4xOCBMOTEuNyAwLjg0IEw5Mi40IDAuNzggTDkzLjEgMC45OSBMOTMuOCAxLjQ3IEw5NC41IDIuMTggTDk1LjIgMy4wNSBMOTUuOSA0LjAyIEw5Ni42IDUuMDEgTDk3LjMgNS45NSBMOTguMCA2Ljc2IEw5OC43IDcuMzkgTDk5LjQgNy44MCBMMTAwLjEgNy45NSBMMTAwLjggNy44NiBMMTAxLjUgNy41NCBMMTAyLjIgNy4wMiBMMTAyLjkgNi4zNiBMMTAzLjYgNS42MSBMMTA0LjMgNC44NSBMMTA1LjAgNC4xMyBMMTA1LjcgMy41MSBMMTA2LjQgMy4wMyBMMTA3LjEgMi43MSBMMTA3LjggMi41OCBMMTA4LjUgMi42MiBMMTA5LjIgMi44MCBMMTA5LjkgMy4xMCBMMTEwLjYgMy40OCBMMTExLjMgMy44OCBMMTEyLjAgNC4yNSBMMTEyLjcgNC41OCBMMTEzLjQgNC44MiBMMTE0LjEgNC45NSBMMTE0LjggNC45OSBMMTE1LjUgNC45MyBMMTE2LjIgNC44MCBMMTE2LjkgNC42NCBMMTE3LjYgNC40NyBMMTE4LjMgNC4zNCBMMTE5LjAgNC4yNyBMMTE5LjcgNC4zMCBMMTIwLjQgNC40MiBMMTIxLjEgNC42NSBMMTIxLjggNC45NSBMMTIyLjUgNS4zMiBMMTIzLjIgNS43MCBMMTIzLjkgNi4wNSBMMTI0LjYgNi4zNCBMMTI1LjMgNi41MiBMMTI2LjAgNi41NCBMMTI2LjcgNi40MCBMMTI3LjQgNi4wOSBMMTI4LjEgNS42MSBMMTI4LjggNS4wMCBMMTI5LjUgNC4yOSBMMTMwLjIgMy41NCBMMTMwLjkgMi44MSBMMTMxLjYgMi4xNyBMMTMyLjMgMS42NyBMMTMzLjAgMS4zNyBMMTMzLjcgMS4yOSBMMTM0LjQgMS40NyBMMTM1LjEgMS44OSBMMTM1LjggMi41MyBMMTM2LjUgMy4zNSBMMTM3LjIgNC4yOSBMMTM3LjkgNS4yOCBMMTM4LjYgNi4yMyBMMTM5LjMgNy4wOSBMMTQwLjAgNy43NyBMMTQwLjcgOC4yMyBMMTQxLjQgOC40MyBMMTQyLjEgOC4zNCBMMTQyLjggNy45OSBMMTQzLjUgNy4zOCBMMTQ0LjIgNi41OCBMMTQ0LjkgNS42NSBMMTQ1LjYgNC42NiBMMTQ2LjMgMy42OSBMMTQ3LjAgMi44MSBMMTQ3LjcgMi4wOCIvPjxwYXRoIGQ9Ik0wLjAgNy4yMCBMMC43IDYuODQgTDEuNCA2LjM0IEwyLjEgNS43NyBMMi44IDUuMTcgTDMuNSA0LjYxIEw0LjIgNC4xMiBMNC45IDMuNzQgTDUuNiAzLjUwIEw2LjMgMy4zOSBMNy4wIDMuNDEgTDcuNyAzLjU0IEw4LjQgMy43NCBMOS4xIDMuOTggTDkuOCA0LjIyIEwxMC41IDQuNDIgTDExLjIgNC41NiBMMTEuOSA0LjYwIEwxMi42IDQuNTYgTDEzLjMgNC40NCBMMTQuMCA0LjI1IEwxNC43IDQuMDMgTDE1LjQgMy44MSBMMTYuMSAzLjY0IEwxNi44IDMuNTUgTDE3LjUgMy41NiBMMTguMiAzLjcwIEwxOC45IDMuOTcgTDE5LjYgNC4zNiBMMjAuMyA0Ljg1IEwyMS4wIDUuNDAgTDIxLjcgNS45NiBMMjIuNCA2LjQ4IEwyMy4xIDYuOTAgTDIzLjggNy4xOCBMMjQuNSA3LjI4IEwyNS4yIDcuMTggTDI1LjkgNi44NiBMMjYuNiA2LjMzIEwyNy4zIDUuNjQgTDI4LjAgNC44MiBMMjguNyAzLjk0IEwyOS40IDMuMDYgTDMwLjEgMi4yNiBMMzAuOCAxLjYwIEwzMS41IDEuMTQgTDMyLjIgMC45MyBMMzIuOSAwLjk4IEwzMy42IDEuMzEgTDM0LjMgMS44OCBMMzUuMCAyLjY2IEwzNS43IDMuNTkgTDM2LjQgNC42MCBMMzcuMSA1LjYxIEwzNy44IDYuNTUgTDM4LjUgNy4zNCBMMzkuMiA3LjkyIEwzOS45IDguMjYgTDQwLjYgOC4zMiBMNDEuMyA4LjExIEw0Mi4wIDcuNjUgTDQyLjcgNi45OSBMNDMuNCA2LjE3IEw0NC4xIDUuMjggTDQ0LjggNC4zNyBMNDUuNSAzLjUzIEw0Ni4yIDIuODEgTDQ2LjkgMi4yNiBMNDcuNiAxLjkyIEw0OC4zIDEuNzkgTDQ5LjAgMS44OSBMNDkuNyAyLjE3IEw1MC40IDIuNjEgTDUxLjEgMy4xNSBMNTEuOCAzLjc0IEw1Mi41IDQuMzMgTDUzLjIgNC44NiBMNTMuOSA1LjI5IEw1NC42IDUuNjAgTDU1LjMgNS43OCBMNTYuMCA1LjgyIEw1Ni43IDUuNzMgTDU3LjQgNS41NiBMNTguMSA1LjMzIEw1OC44IDUuMDkgTDU5LjUgNC44NyBMNjAuMiA0LjcwIEw2MC45IDQuNjEgTDYxLjYgNC42MSBMNjIuMyA0LjcwIEw2My4wIDQuODYgTDYzLjcgNS4wNiBMNjQuNCA1LjI5IEw2NS4xIDUuNDkgTDY1LjggNS42MiBMNjYuNSA1LjY2IEw2Ny4yIDUuNTggTDY3LjkgNS4zOCBMNjguNiA1LjA0IEw2OS4zIDQuNTkgTDcwLjAgNC4wNyBMNzAuNyAzLjUxIEw3MS40IDIuOTYgTDcyLjEgMi40OCBMNzIuOCAyLjEzIEw3My41IDEuOTQgTDc0LjIgMS45NSBMNzQuOSAyLjE2IEw3NS42IDIuNTkgTDc2LjMgMy4yMSBMNzcuMCAzLjk4IEw3Ny43IDQuODQgTDc4LjQgNS43MyBMNzkuMSA2LjU3IEw3OS44IDcuMzEgTDgwLjUgNy44NyBMODEuMiA4LjIwIEw4MS45IDguMjggTDgyLjYgOC4wOCBMODMuMyA3LjYyIEw4NC4wIDYuOTQgTDg0LjcgNi4wNyBMODUuNCA1LjA5IEw4Ni4xIDQuMDYgTDg2LjggMy4wOCBMODcuNSAyLjIxIEw4OC4yIDEuNTMgTDg4LjkgMS4wNyBMODkuNiAwLjg4IEw5MC4zIDAuOTYgTDkxLjAgMS4zMCBMOTEuNyAxLjg3IEw5Mi40IDIuNjIgTDkzLjEgMy40OSBMOTMuOCA0LjQwIEw5NC41IDUuMjggTDk1LjIgNi4wNyBMOTUuOSA2LjcwIEw5Ni42IDcuMTUgTDk3LjMgNy4zOCBMOTguMCA3LjM4IEw5OC43IDcuMTkgTDk5LjQgNi44MiBMMTAwLjEgNi4zMiBMMTAwLjggNS43NCBMMTAxLjUgNS4xNSBMMTAyLjIgNC41OCBMMTAyLjkgNC4xMCBMMTAzLjYgMy43MyBMMTA0LjMgMy40OSBMMTA1LjAgMy4zOSBMMTA1LjcgMy40MSBMMTA2LjQgMy41NSBMMTA3LjEgMy43NSBMMTA3LjggNC4wMCBMMTA4LjUgNC4yMyBMMTA5LjIgNC40MyBMMTA5LjkgNC41NiBMMTEwLjYgNC42MCBMMTExLjMgNC41NiBMMTEyLjAgNC40MyBMMTEyLjcgNC4yNCBMMTEzLjQgNC4wMiBMMTE0LjEgMy44MCBMMTE0LjggMy42MyBMMTE1LjUgMy41NCBMMTE2LjIgMy41NiBMMTE2LjkgMy43MSBMMTE3LjYgMy45OSBMMTE4LjMgNC4zOCBMMTE5LjAgNC44OCBMMTE5LjcgNS40MyBMMTIwLjQgNS45OSBMMTIxLjEgNi41MCBMMTIxLjggNi45MiBMMTIyLjUgNy4xOSBMMTIzLjIgNy4yOCBMMTIzLjkgNy4xNyBMMTI0LjYgNi44NCBMMTI1LjMgNi4zMCBMMTI2LjAgNS42MCBMMTI2LjcgNC43OCBMMTI3LjQgMy45MCBMMTI4LjEgMy4wMiBMMTI4LjggMi4yMiBMMTI5LjUgMS41NyBMMTMwLjIgMS4xMyBMMTMwLjkgMC45MyBMMTMxLjYgMC45OSBMMTMyLjMgMS4zMyBMMTMzLjAgMS45MSBMMTMzLjcgMi43MCBMMTM0LjQgMy42NCBMMTM1LjEgNC42NSBMMTM1LjggNS42NiBMMTM2LjUgNi41OSBMMTM3LjIgNy4zNyBMMTM3LjkgNy45NCBMMTM4LjYgOC4yNiBMMTM5LjMgOC4zMSBMMTQwLjAgOC4wOSBMMTQwLjcgNy42MiBMMTQxLjQgNi45NSBMMTQyLjEgNi4xMyBMMTQyLjggNS4yNCBMMTQzLjUgNC4zMyBMMTQ0LjIgMy40OSBMMTQ0LjkgMi43OCBMMTQ1LjYgMi4yNCBMMTQ2LjMgMS45MCBMMTQ3LjAgMS43OSBMMTQ3LjcgMS45MCIvPjxwYXRoIGQ9Ik0wLjAgNS4xOSBMMC43IDQuODEgTDEuNCA0LjUwIEwyLjEgNC4yOCBMMi44IDQuMTcgTDMuNSA0LjE2IEw0LjIgNC4yNCBMNC45IDQuMzggTDUuNiA0LjU1IEw2LjMgNC43MSBMNy4wIDQuODMgTDcuNyA0Ljg3IEw4LjQgNC44MyBMOS4xIDQuNjggTDkuOCA0LjQ1IEwxMC41IDQuMTMgTDExLjIgMy43NyBMMTEuOSAzLjQxIEwxMi42IDMuMDkgTDEzLjMgMi44NSBMMTQuMCAyLjczIEwxNC43IDIuNzYgTDE1LjQgMi45NiBMMTYuMSAzLjMzIEwxNi44IDMuODYgTDE3LjUgNC41MCBMMTguMiA1LjIyIEwxOC45IDUuOTUgTDE5LjYgNi42NCBMMjAuMyA3LjIyIEwyMS4wIDcuNjQgTDIxLjcgNy44NSBMMjIuNCA3LjgyIEwyMy4xIDcuNTUgTDIzLjggNy4wNCBMMjQuNSA2LjMyIEwyNS4yIDUuNDUgTDI1LjkgNC40OSBMMjYuNiAzLjUxIEwyNy4zIDIuNTkgTDI4LjAgMS44MCBMMjguNyAxLjIxIEwyOS40IDAuODYgTDMwLjEgMC43OCBMMzAuOCAwLjk4IEwzMS41IDEuNDQgTDMyLjIgMi4xMyBMMzIuOSAzLjAwIEwzMy42IDMuOTYgTDM0LjMgNC45NiBMMzUuMCA1LjkxIEwzNS43IDYuNzQgTDM2LjQgNy4zOSBMMzcuMSA3LjgyIEwzNy44IDcuOTkgTDM4LjUgNy45MiBMMzkuMiA3LjYwIEwzOS45IDcuMDkgTDQwLjYgNi40MiBMNDEuMyA1LjY3IEw0Mi4wIDQuODkgTDQyLjcgNC4xNSBMNDMuNCAzLjUxIEw0NC4xIDMuMDAgTDQ0LjggMi42NyBMNDUuNSAyLjUxIEw0Ni4yIDIuNTQgTDQ2LjkgMi43MSBMNDcuNiAzLjAyIEw0OC4zIDMuNDAgTDQ5LjAgMy44MSBMNDkuNyA0LjIxIEw1MC40IDQuNTYgTDUxLjEgNC44MyBMNTEuOCA0Ljk5IEw1Mi41IDUuMDUgTDUzLjIgNS4wMSBMNTMuOSA0LjkwIEw1NC42IDQuNzQgTDU1LjMgNC41NyBMNTYuMCA0LjQyIEw1Ni43IDQuMzQgTDU3LjQgNC4zNCBMNTguMSA0LjQzIEw1OC44IDQuNjMgTDU5LjUgNC45MSBMNjAuMiA1LjI1IEw2MC45IDUuNjIgTDYxLjYgNS45NyBMNjIuMyA2LjI1IEw2My4wIDYuNDMgTDYzLjcgNi40NyBMNjQuNCA2LjM1IEw2NS4xIDYuMDYgTDY1LjggNS42MSBMNjYuNSA1LjAyIEw2Ny4yIDQuMzMgTDY3LjkgMy42MCBMNjguNiAyLjg4IEw2OS4zIDIuMjQgTDcwLjAgMS43NCBMNzAuNyAxLjQyIEw3MS40IDEuMzQgTDcyLjEgMS40OSBMNzIuOCAxLjg5IEw3My41IDIuNTEgTDc0LjIgMy4zMiBMNzQuOSA0LjI0IEw3NS42IDUuMjIgTDc2LjMgNi4xOCBMNzcuMCA3LjA0IEw3Ny43IDcuNzQgTDc4LjQgOC4yMSBMNzkuMSA4LjQyIEw3OS44IDguMzUgTDgwLjUgOC4wMSBMODEuMiA3LjQyIEw4MS45IDYuNjMgTDgyLjYgNS43MSBMODMuMyA0LjcxIEw4NC4wIDMuNzMgTDg0LjcgMi44MyBMODUuNCAyLjA5IEw4Ni4xIDEuNTUgTDg2LjggMS4yNiBMODcuNSAxLjIyIEw4OC4yIDEuNDIgTDg4LjkgMS44NCBMODkuNiAyLjQ1IEw5MC4zIDMuMTYgTDkxLjAgMy45NCBMOTEuNyA0LjcxIEw5Mi40IDUuNDAgTDkzLjEgNS45OCBMOTMuOCA2LjQwIEw5NC41IDYuNjQgTDk1LjIgNi43MCBMOTUuOSA2LjU5IEw5Ni42IDYuMzQgTDk3LjMgNS45OSBMOTguMCA1LjU5IEw5OC43IDUuMTcgTDk5LjQgNC44MCBMMTAwLjEgNC40OSBMMTAwLjggNC4yNyBMMTAxLjUgNC4xNyBMMTAyLjIgNC4xNiBMMTAyLjkgNC4yNCBMMTAzLjYgNC4zOCBMMTA0LjMgNC41NSBMMTA1LjAgNC43MSBMMTA1LjcgNC44MyBMMTA2LjQgNC44NyBMMTA3LjEgNC44MiBMMTA3LjggNC42NyBMMTA4LjUgNC40MyBMMTA5LjIgNC4xMiBMMTA5LjkgMy43NiBMMTEwLjYgMy40MCBMMTExLjMgMy4wNyBMMTEyLjAgMi44NCBMMTEyLjcgMi43MyBMMTEzLjQgMi43NyBMMTE0LjEgMi45OCBMMTE0LjggMy4zNiBMMTE1LjUgMy44OSBMMTE2LjIgNC41MyBMMTE2LjkgNS4yNSBMMTE3LjYgNS45OSBMMTE4LjMgNi42NyBMMTE5LjAgNy4yNCBMMTE5LjcgNy42NSBMMTIwLjQgNy44NSBMMTIxLjEgNy44MSBMMTIxLjggNy41MyBMMTIyLjUgNy4wMSBMMTIzLjIgNi4yOCBMMTIzLjkgNS40MSBMMTI0LjYgNC40NCBMMTI1LjMgMy40NyBMMTI2LjAgMi41NSBMMTI2LjcgMS43NyBMMTI3LjQgMS4xOCBMMTI4LjEgMC44NCBMMTI4LjggMC43OCBMMTI5LjUgMC45OSBMMTMwLjIgMS40NyBMMTMwLjkgMi4xNyBMMTMxLjYgMy4wNCBMMTMyLjMgNC4wMSBMMTMzLjAgNS4wMSBMMTMzLjcgNS45NiBMMTM0LjQgNi43OCBMMTM1LjEgNy40MiBMMTM1LjggNy44MyBMMTM2LjUgOC4wMCBMMTM3LjIgNy45MSBMMTM3LjkgNy41OCBMMTM4LjYgNy4wNiBMMTM5LjMgNi4zOSBMMTQwLjAgNS42MyBMMTQwLjcgNC44NSBMMTQxLjQgNC4xMiBMMTQyLjEgMy40OCBMMTQyLjggMi45OCBMMTQzLjUgMi42NSBMMTQ0LjIgMi41MSBMMTQ0LjkgMi41NCBMMTQ1LjYgMi43MyBMMTQ2LjMgMy4wMyBMMTQ3LjAgMy40MiBMMTQ3LjcgMy44MyIvPjwvZz48L3N2Zz4=';

/** Les petites étiquettes du reçu : capitales espacées, gras, 6,6 pt. */
const etiquetteRecu = (t: string, couleur = R_ACCENT) =>
  `<span style="font-family:Arial,Helvetica,sans-serif;font-size:6.6pt;font-weight:bold;letter-spacing:0.2mm;text-transform:uppercase;color:${couleur}">${t}</span>`;

const recuTexte = (x: number, y: number, l: number, h: number, html: string, style: Partial<StyleTexte> = {}): ElementVisuel =>
  texte(x, y, l, h, html, { police: 'Arial', taille: 9.4, couleur: R_ENCRE, interligne: 1.25, ...style });

const forme = (x: number, y: number, l: number, h: number, o: { fond?: string | null; bord?: string | null; epaisseur?: number; arrondi?: number; ellipse?: boolean; rotation?: number; style?: 'solid' | 'dashed' | 'dotted' | 'double' } = {}): ElementVisuel => ({
  id: id(), type: 'forme', forme: o.ellipse ? 'ellipse' : 'rectangle', x, y, l, h, rotation: o.rotation ?? 0,
  fond: o.fond ?? null,
  bordure: o.bord ? { couleur: o.bord, epaisseur: o.epaisseur ?? 0.3, style: o.style ?? 'solid' } : null,
  arrondi: o.arrondi ?? 0,
});

/** Le bloc qui suit le tableau et s'allonge avec lui. */
const BLOC_PAIEMENT =
  '{TABLEAU DES PAIEMENTS}'
  // Tampon et total, côte à côte.
  + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4.5mm">'
  + `<div style="margin-left:7mm;transform:rotate(-11deg);border:0.9mm double ${R_ENCRE};padding:0.8mm 3.2mm 1.4mm;text-align:center;opacity:0.88;color:${R_ENCRE}">`
  + '<div style="font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:13.5pt;letter-spacing:0.4mm;line-height:1.1">{ÉTAT DU PAIEMENT}</div>'
  + '<div style="font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:6.6pt;letter-spacing:0.12mm">{JOUR DU PAIEMENT}</div></div>'
  + `<div style="width:84mm;height:13.6mm;box-sizing:border-box;border:0.8mm solid ${R_FONCE};border-radius:2mm;display:flex;align-items:center;justify-content:space-between;padding:0 5mm;color:${R_FONCE};font-family:Arial,Helvetica,sans-serif;font-weight:bold">`
  + '<span style="font-size:7.4pt;letter-spacing:0.22mm">TOTAL PAYÉ</span>'
  + '<span><span style="font-size:17pt">{TOTAL EN CHIFFRES}</span>&nbsp;&nbsp;<span style="font-size:8.4pt">FCFA</span></span></div></div>'
  // Somme en lettres.
  + `<div style="margin-top:8mm">${etiquetteRecu('Arrêté le présent reçu à la somme de', R_GRIS)}</div>`
  + `<div style="margin-top:2mm;border-left:0.9mm solid ${R_ACCENT};padding:0.8mm 0 0.6mm 3.1mm;font-family:'Times New Roman',Times,serif;font-style:italic;font-weight:bold;font-size:11.6pt;color:${R_FONCE}">{MONTANT EN LETTRES}.</div>`
  // Mode de paiement, référence, encaissé par.
  + `<div style="display:flex;margin-top:2.4mm;border-top:0.3mm solid ${R_FILET};padding-top:2mm">`
  + `<div style="width:27%">${etiquetteRecu('Mode de paiement')}<br><b style="font-size:9pt">{MODE DE PAIEMENT}</b></div>`
  + `<div style="width:23%">${etiquetteRecu('Référence')}<br><b style="font-size:9pt">{RÉFÉRENCE DU PAIEMENT}</b></div>`
  + `<div style="width:50%">${etiquetteRecu('Encaissé par')}<br><b style="font-size:9pt">{ENCAISSÉ PAR}</b></div>`
  + '</div>'
  // Signatures et cachet : ils suivent le bloc, comme sur le reçu SenClass
  // (un reçu de douze lignes les pousse vers le bas).
  + '<div style="display:flex;justify-content:space-between;align-items:flex-end;height:21mm;margin-top:2mm">'
  + `<div style="width:48mm;text-align:center"><div style="border-top:0.3mm dashed ${R_GRIS};margin-bottom:1.6mm"></div>${etiquetteRecu('Le parent / tuteur', R_GRIS)}</div>`
  + `<div style="align-self:flex-start;width:21mm;height:21mm;box-sizing:border-box;border:0.3mm dashed ${R_ACCENT};border-radius:50%;display:flex;align-items:center;justify-content:center">${etiquetteRecu('Cachet')}</div>`
  + `<div style="width:48mm;text-align:center"><div style="border-top:0.3mm dashed ${R_GRIS};margin-bottom:1.6mm"></div>${etiquetteRecu('Le caissier', R_GRIS)}</div>`
  + '</div>';

export const MODELES_RECUS_PAR_DEFAUT: readonly ModeleParDefaut[] = [
  {
    id: 'senclass:recu',
    nom: 'Reçu de paiement',
    contenu: {
      version: 1,
      orientation: 'portrait',
      format: 'A5',
      fond: '#ffffff',
      elements: [
        // ── Filigrane : le logo, très pâle, au centre de la page ──
        { id: id(), type: 'image', x: 32, y: 67, l: 84, h: 84, rotation: 0, source: 'logo', opacite: 0.05 },
        // ── En-tête : logo dans un cercle, nom de l'école, coordonnées, double filet ──
        forme(10.4, 4.4, 23.2, 23.2, { ellipse: true, bord: R_ACCENT, epaisseur: 0.5, fond: '#ffffff' }),
        { id: id(), type: 'image', x: 13.4, y: 7.4, l: 17.2, h: 17.2, rotation: 0, source: 'logo' },
        recuTexte(38.5, 5.2, 98.5, 7, '<span style="letter-spacing:0.1mm">{NOM DE L\'ÉTABLISSEMENT}</span>',
          { police: 'Times New Roman', taille: 14.5, gras: true, couleur: R_FONCE, interligne: 1.1 }),
        recuTexte(38.5, 13.2, 98.5, 12,
          "{ADRESSE DE L'ÉTABLISSEMENT} — {VILLE}, {PAYS}<br>Tél. {TÉLÉPHONE DE L'ÉTABLISSEMENT}  ·  {E-MAIL DE L'ÉTABLISSEMENT}",
          { taille: 7.6, couleur: R_GRIS, interligne: 1.4 }),
        forme(11, 32, 126, 0.9, { fond: R_FONCE }),
        forme(11, 33.6, 126, 0.25, { fond: R_FONCE }),
        // ── Titre et numéro ──
        recuTexte(11, 41.2, 84, 8, '<span style="letter-spacing:0.32mm">REÇU DE PAIEMENT</span>',
          { police: 'Times New Roman', taille: 17.5, gras: true, couleur: R_FONCE, interligne: 1 }),
        forme(11, 50.2, 20, 0.9, { fond: R_ACCENT }),
        forme(97, 40.5, 40, 12.4, { fond: R_PALE, bord: R_ACCENT, epaisseur: 0.4, arrondi: 1.8 }),
        recuTexte(97, 41.9, 40, 4, etiquetteRecu('Reçu n°'), { alignement: 'center', interligne: 1 }),
        recuTexte(97, 46, 40, 5.5, '<b>{NUMÉRO DU REÇU}</b>', { taille: 10.6, couleur: R_FONCE, alignement: 'center', interligne: 1 }),
        recuTexte(97, 53.6, 40, 4.5, '<b>{MENTION DU REÇU}</b>', { taille: 7, couleur: R_GRIS, alignement: 'right', interligne: 1 }),
        recuTexte(11, 53.3, 84, 4.5, 'Émis le {DATE DU PAIEMENT}', { taille: 8.6, couleur: R_GRIS, interligne: 1 }),
        // ── Carte de l'élève ──
        forme(11, 61.5, 126, 22.5, { fond: R_PALE, arrondi: 1.8 }),
        forme(11, 61.5, 2, 22.5, { fond: R_ACCENT, arrondi: 1 }),
        recuTexte(18, 63.6, 112, 4, etiquetteRecu('Reçu de'), { interligne: 1 }),
        recuTexte(18, 67.4, 112, 6.5, "<b>{NOM ET PRÉNOM DE L'ÉLÈVE}</b>", { taille: 13, interligne: 1 }),
        recuTexte(18, 74.4, 37, 9, `${etiquetteRecu('Matricule', R_GRIS)}<br><b>{MATRICULE}</b>`, { interligne: 1.35 }),
        recuTexte(57, 74.4, 37, 9, `${etiquetteRecu('Classe', R_GRIS)}<br><b>{CLASSE}</b>`, { interligne: 1.35 }),
        recuTexte(96, 74.4, 37, 9, `${etiquetteRecu('Année scolaire', R_GRIS)}<br><b>{ANNÉE SCOLAIRE}</b>`, { interligne: 1.35 }),
        // ── Tableau, total, tampon, somme en lettres, informations, signatures (un bloc qui s'allonge) ──
        recuTexte(11, 89, 126, 105, BLOC_PAIEMENT, { taille: 9.6, interligne: 1.25 }),
        // ── Pied de page : mention, signature SenClass, motif de sécurité ──
        recuTexte(11, 195, 80, 4, '<i>Ce reçu fait foi de paiement : conservez-le précieusement.</i>', { taille: 7.2, couleur: R_GRIS, interligne: 1 }),
        recuTexte(91, 195, 46, 4, `Édité avec <b style="color:${R_ACCENT}">SenClass</b>`, { taille: 7.2, couleur: R_GRIS, alignement: 'right', interligne: 1 }),
        { id: id(), type: 'image', x: 0, y: 200.8, l: 148, h: 9.2, rotation: 0, source: MOTIF_GUILLOCHE },
      ],
    },
  },
];
