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
// Style commun, sobre : logo et identité de l'école en tête, un titre bleu
// nuit, les informations de l'élève (ou du professeur) dans un cadre gris
// clair, des pointillés pour ce qui s'écrit à la main (date, heure, motif…),
// signature et pied de page discrets.
//
// Ils n'utilisent que des champs du catalogue (un test le vérifie).
// ═══════════════════════════════════════════════════════════════════════════

export interface ModeleParDefaut {
  /** Identifiant stable, préfixé pour ne jamais croiser un id de la base. */
  id: string;
  nom: string;
  contenu: DocumentVisuel;
}

const ACCENT = '#1F3A5F';
const GRIS = '#5B6472';
const ENCRE = '#1D1D1D';
const FOND_CADRE = '#F3F5F8';

let compteur = 0;
const id = () => `senclass-el-${++compteur}`;

const texte = (x: number, y: number, l: number, h: number, html: string, style: Partial<StyleTexte> = {}): ElementVisuel => ({
  id: id(), type: 'texte', x, y, l, h, rotation: 0, html,
  style: { ...STYLE_TEXTE_PAR_DEFAUT, police: 'Georgia', taille: 12, couleur: ENCRE, interligne: 1.7, ...style },
  fond: null, bordure: null,
});

const trait = (x: number, y: number, l: number, couleur = ACCENT, epaisseur = 0.5): ElementVisuel =>
  ({ id: id(), type: 'ligne', x, y, l, h: 1, rotation: 0, bordure: { couleur, epaisseur, style: 'solid' } });

const cadre = (x: number, y: number, l: number, h: number, bordure: string | null = null): ElementVisuel => ({
  id: id(), type: 'forme', forme: 'rectangle', x, y, l, h, rotation: 0,
  fond: bordure ? null : FOND_CADRE, bordure: bordure ? { couleur: bordure, epaisseur: 0.35, style: 'solid' } : null, arrondi: 2,
});

/** Des pointillés à remplir à la main. */
const blanc = (mm: number) =>
  `<span style="display:inline-block;width:${mm}mm;border-bottom:1px dotted #8A909A">&nbsp;</span>`;

/** Une case à cocher à la main. */
const caseACocher = '<span style="display:inline-block;width:3.4mm;height:3.4mm;border:1px solid #1D1D1D;vertical-align:-0.5mm;margin-right:2.5mm"></span>';

/** « Libellé : valeur » dans un cadre : libellé gris, valeur en gras. */
const ligne = (libelle: string, valeur: string) =>
  `<span style="color:${GRIS}">${libelle}</span>&nbsp;&nbsp;${valeur}`;

// ─── Les briques communes ─────────────────────────────────────────────────

const entete = (avecNumero = false): ElementVisuel[] => [
  { id: id(), type: 'image', x: 18, y: 14, l: 22, h: 22, rotation: 0, source: 'logo' },
  texte(44, 15, 84, 22,
    `<span style="font-size:12.5pt;color:${ACCENT};font-weight:bold">{NOM DE L'ÉTABLISSEMENT}</span><br>`
    + "{ADRESSE DE L'ÉTABLISSEMENT}<br>Tél. {TÉLÉPHONE DE L'ÉTABLISSEMENT} · {E-MAIL DE L'ÉTABLISSEMENT}",
    { police: 'Arial', taille: 9, couleur: GRIS, interligne: 1.45 }),
  texte(130, 16, 62, 6, '{VILLE}, le {DATE EN LETTRES}', { taille: 10, alignement: 'right', interligne: 1.3 }),
  ...(avecNumero ? [texte(130, 24, 62, 6, `N° ${blanc(30)}`, { police: 'Arial', taille: 9, couleur: GRIS, alignement: 'right', interligne: 1.3 })] : []),
  trait(18, 40, 174),
];

const titre = (y: number, intitule: string, sousTitre: string): ElementVisuel[] => [
  texte(18, y, 174, 10, `<span style="letter-spacing:2.5px">${intitule.toUpperCase()}</span>`,
    { police: 'Arial', taille: 17, gras: true, couleur: ACCENT, alignement: 'center', interligne: 1.2 }),
  trait(97, y + 12, 16, ACCENT, 0.8),
  texte(18, y + 15, 174, 7, sousTitre, { police: 'Arial', taille: 9.5, couleur: GRIS, alignement: 'center', interligne: 1.3 }),
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
  texte(x, y + 6, 72, 6, mention, { police: 'Arial', taille: 8.5, couleur: GRIS, alignement: 'center', interligne: 1.3 }),
  texte(x, y + 30, 72, 7, nom, { taille: 11.5, alignement: 'center', interligne: 1.3 }),
];

/** Cadre « Décision de la direction », pour les demandes. */
const decision = (x: number, y: number): ElementVisuel[] => [
  cadre(x, y, 74, 44, '#C9CFD8'),
  texte(x + 4, y + 3, 66, 38,
    `<span style="font-family:Arial;font-size:8.5pt;color:${GRIS};letter-spacing:1px">DÉCISION DE LA DIRECTION</span><br>`
    + `${caseACocher}Accordée&nbsp;&nbsp;&nbsp;&nbsp;${caseACocher}Refusée<br>`
    + `<span style="font-size:10pt;color:${GRIS}">Date et signature :</span>`,
    { taille: 11, interligne: 2.1 }),
];

const pied = (): ElementVisuel[] => [
  trait(18, 281, 174, '#D3D8DF', 0.3),
  texte(18, 283, 174, 6, "{NOM DE L'ÉTABLISSEMENT} · {ADRESSE DE L'ÉTABLISSEMENT} · Tél. {TÉLÉPHONE DE L'ÉTABLISSEMENT}",
    { police: 'Arial', taille: 7.5, couleur: GRIS, alignement: 'center', interligne: 1.2 }),
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
