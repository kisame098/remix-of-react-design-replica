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
// Ils n'utilisent que des champs du catalogue (un test le vérifie) ; ce qui
// est propre à chaque école sans exister dans SenClass (dénomination, 2e
// téléphone…) n'y figure pas — l'école l'ajoute en clair dans sa copie.
// ═══════════════════════════════════════════════════════════════════════════

export interface ModeleParDefaut {
  /** Identifiant stable, préfixé pour ne jamais croiser un id de la base. */
  id: string;
  nom: string;
  contenu: DocumentVisuel;
}

let compteur = 0;
const id = (prefixe: string) => `${prefixe}-${++compteur}`;

const texte = (
  prefixe: string, x: number, y: number, l: number, h: number, html: string, style: Partial<StyleTexte> = {},
): ElementVisuel => ({
  id: id(prefixe), type: 'texte', x, y, l, h, rotation: 0, html,
  style: { ...STYLE_TEXTE_PAR_DEFAUT, ...style }, fond: null, bordure: null,
});

/** En-tête, titre encadré et signature : communs aux deux modèles. */
const gabarit = (prefixe: string, titre: string, corps: string): DocumentVisuel => ({
  version: 1,
  orientation: 'portrait',
  fond: '#ffffff',
  elements: [
    { id: id(prefixe), type: 'image', x: 15, y: 12, l: 24, h: 24, rotation: 0, source: 'logo' },
    texte(prefixe, 42, 12, 95, 28,
      "<b>{NOM DE L'ÉTABLISSEMENT}</b><br>{ADRESSE DE L'ÉTABLISSEMENT}<br>Aut. {NUMÉRO D'AUTORISATION}<br>Tél. : {TÉLÉPHONE DE L'ÉTABLISSEMENT}",
      { taille: 10.5, interligne: 1.35 }),
    texte(prefixe, 138, 12, 57, 8, '{VILLE}, le {DATE}', { taille: 11, alignement: 'right' }),
    texte(prefixe, 138, 26, 57, 8, 'N° ............................', { taille: 11, alignement: 'right' }),
    { id: id(prefixe), type: 'ligne', x: 15, y: 40, l: 180, h: 2, rotation: 0, bordure: { couleur: '#222222', epaisseur: 0.4, style: 'solid' } },
    {
      id: id(prefixe), type: 'forme', forme: 'rectangle', x: 35, y: 55, l: 140, h: 17, rotation: 0,
      fond: null, bordure: { couleur: '#222222', epaisseur: 0.5, style: 'solid' }, arrondi: 0,
    },
    texte(prefixe, 35, 58, 140, 12, titre, { police: 'Arial', taille: 22, gras: true, italique: true, alignement: 'center', interligne: 1 }),
    texte(prefixe, 20, 85, 170, 95, corps, { taille: 13, interligne: 1.8 }),
    texte(prefixe, 120, 195, 70, 8, 'LE DIRECTEUR', { taille: 13, gras: true, souligne: true, alignement: 'center' }),
    texte(prefixe, 120, 220, 70, 8, '{NOM DU DIRECTEUR}', { taille: 13, gras: true, alignement: 'center' }),
  ],
});

const identiteEleve =
  "Nom et prénom : <b>{NOM ET PRÉNOM DE L'ÉLÈVE}</b><br>"
  + 'Date et lieu de naissance : {DATE DE NAISSANCE} à {LIEU DE NAISSANCE}<br>'
  + 'Matricule : {MATRICULE}<br>';

export const MODELES_PAR_DEFAUT: readonly ModeleParDefaut[] = [
  {
    id: 'senclass:certificat-scolarite',
    nom: 'Certificat de scolarité',
    contenu: gabarit('cs', 'Certificat de scolarité',
      "<div style=\"text-align:center\">Le Directeur de l'établissement <b>{NOM DE L'ÉTABLISSEMENT}</b> certifie que l'élève :</div>"
      + identiteEleve
      + 'fréquente régulièrement l\'établissement en classe de <b>{CLASSE}</b> pour l\'année scolaire <b>{ANNÉE SCOLAIRE}</b>.<br><br>'
      + 'En foi de quoi le présent certificat lui est délivré pour servir et valoir ce que de droit.'),
  },
  {
    id: 'senclass:attestation-inscription',
    nom: "Attestation d'inscription",
    contenu: gabarit('ai', "Attestation d'inscription",
      "<div style=\"text-align:center\">Le Directeur de l'établissement <b>{NOM DE L'ÉTABLISSEMENT}</b> atteste que l'élève :</div>"
      + identiteEleve
      + 'est inscrit(e) dans l\'établissement en classe de <b>{CLASSE}</b> pour l\'année scolaire <b>{ANNÉE SCOLAIRE}</b>, '
      + 'depuis le {DATE D\'INSCRIPTION}.<br><br>'
      + 'En foi de quoi la présente attestation lui est délivrée pour servir et valoir ce que de droit.'),
  },
];

export const estModeleParDefaut = (idModele: string): boolean => idModele.startsWith('senclass:');
