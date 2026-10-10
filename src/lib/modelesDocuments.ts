import DOMPurify from 'dompurify';
import { dateDakar, dateLongueDakar, type InfosEcole } from '@/lib/documentsEcole';
import { formaterMontant, montantEnLettres } from '@/lib/montantEnLettres';

// ═══════════════════════════════════════════════════════════════════════════
// MODÈLES DE DOCUMENTS (écoles en mode classique)
//
// Une école écrit — ou envoie — un modèle en HTML : certificat de scolarité,
// attestation d'inscription… Les informations qui changent d'un élève à
// l'autre s'écrivent entre accolades : {NOM ET PRÉNOM DE L'ÉLÈVE}.
//
// RÈGLE : tout texte entre accolades est un CHAMP, et un champ que SenClass ne
// connaît pas est REFUSÉ — à l'enregistrement comme à l'impression. Ce qui ne
// change jamais (dénomination, 2e téléphone…) s'écrit en clair dans le modèle.
//
// SÉCURITÉ : le HTML vient de l'école, il peut être piégé. Il est NETTOYÉ
// avant tout affichage (pas de script, pas d'attribut onclick, aucune
// ressource chargée depuis Internet) et affiché dans un cadre isolé.
// ═══════════════════════════════════════════════════════════════════════════

export type GroupeChamp = 'ecole' | 'document' | 'eleve' | 'scolarite' | 'professeur' | 'recu';

export const LIBELLES_GROUPE_CHAMP: Record<GroupeChamp, string> = {
  ecole: "L'établissement",
  document: 'Le document',
  eleve: "L'élève",
  scolarite: 'La scolarité',
  professeur: 'Le professeur',
  recu: 'Le reçu',
};

/** Ce qu'il faut pour remplir un modèle de REÇU (src/lib/recu.ts → RecuData). */
export interface RecuDocument {
  numero: string;
  /** ISO — moment du paiement. */
  date: string;
  lignes: { designation: string; montant: number; annulee: boolean }[];
  total: number;
  mode: string;
  reference?: string;
  encaissePar?: string;
  annule: boolean;
  duplicata: boolean;
}

/** Ce qu'il faut pour remplir un modèle pour un professeur. */
export interface ProfesseurDocument {
  matricule: string;
  prenom: string;
  nom: string;
  sexe?: 'homme' | 'femme' | string;
  dateNaissance?: string;
  lieuNaissance?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  diplome?: string;
  contrat?: string;
  /** Tirées de l'emploi du temps. */
  matieres: string[];
  classes: string[];
}

/** Ce qu'il faut pour remplir un modèle pour un élève. */
export interface EleveDocument {
  matricule: string;
  prenom: string;
  nom: string;
  sexe?: 'homme' | 'femme' | string;
  dateNaissance?: string;
  lieuNaissance?: string;
  adresse?: string;
  telephone?: string;
  /** Date d'inscription pour l'année (ISO). */
  dateInscription?: string;
  tuteurs: { nom?: string; telephone?: string; qualite?: string }[];
  classe?: string;
}

export interface ContexteDocument {
  ecole: InfosEcole;
  /** Pour un document de professeur : un élève vide (ses champs sont interdits dans ce cas). */
  eleve: EleveDocument;
  professeur?: ProfesseurDocument;
  /** Numéro attribué par SenClass (CS-2026-00001) ; à l'aperçu, un numéro provisoire. */
  numero?: string;
  /** Pour un modèle de reçu : le paiement. */
  recu?: RecuDocument;
  anneeScolaire?: string;
  /** Date du document (ISO) — aujourd'hui, à l'heure de Dakar. */
  date: string;
}

export interface ChampModele {
  /** Tel qu'il s'écrit dans le modèle, entre accolades. */
  nom: string;
  groupe: GroupeChamp;
  /** D'où vient la valeur dans SenClass. */
  source: string;
  /** Une image : ne s'écrit que dans un attribut, ex. <img src="{LOGO DE L'ÉTABLISSEMENT}">. */
  image?: true;
  /**
   * Un bloc (le tableau des paiements) : inséré comme élément, pas comme
   * texte. `valeur` donne alors sa version texte (Word, champ dans un attribut).
   */
  bloc?: (doc: Document, c: ContexteDocument) => HTMLElement;
  valeur: (c: ContexteDocument) => string;
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 2012-03-05 » ou ISO complet → « 05/03/2012 » ; une date déjà écrite à la main reste telle quelle. */
const dateCourte = (v?: string): string => {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return dateDakar(v) || v;
};

/** « 10/10/2026 » → « 10 octobre 2026 » (1er pour le premier du mois). */
const dateEnLettres = (iso: string): string => {
  const courte = dateCourte(iso);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(courte);
  if (!m) return courte;
  const jour = Number(m[1]);
  return `${jour === 1 ? '1er' : jour} ${MOIS[Number(m[2]) - 1]} ${m[3]}`;
};

/**
 * Le tableau des paiements d'un reçu : deux colonnes, noir et blanc, il prend
 * la police et la taille du texte qui l'entoure. Les valeurs sont posées
 * comme TEXTE (jamais interprétées comme du HTML).
 */
const tableauPaiements = (doc: Document, lignes: RecuDocument['lignes']): HTMLElement => {
  // En-têtes à la même taille et dans la même police que les lignes (en gras),
  // filet sous l'en-tête, un trait fin entre les lignes, montant en gras.
  // Les lignes se resserrent quand elles sont nombreuses ; au-delà de huit, le
  // tableau passe sur deux colonnes (une année entière payée d'un coup).
  const deuxColonnes = lignes.length > 8;
  const hauteur = lignes.length <= 4 ? 6.8 : deuxColonnes ? 4.4 : 5;
  const entete = `${deuxColonnes ? 'font-size:8.2pt;' : ''}line-height:1.3;font-weight:bold;padding:0 1mm 2mm;border-bottom:0.5mm solid #374151`;
  const cellule = (balise: 'th' | 'td', texte: string, style: string) => {
    const c = doc.createElement(balise);
    c.textContent = texte;
    c.setAttribute('style', style);
    return c;
  };
  const table = (liste: RecuDocument['lignes']) => {
    const t = doc.createElement('table');
    t.setAttribute('style', `width:${deuxColonnes ? '48%' : '100%'};border-collapse:collapse;font-family:inherit;font-size:inherit;line-height:1.3;white-space:normal;color:#1F2937`);
    const tete = doc.createElement('tr');
    tete.append(
      cellule('th', 'Désignation', `${entete};text-align:left`),
      cellule('th', deuxColonnes ? 'FCFA' : 'Montant (FCFA)', `${entete};text-align:right;white-space:nowrap`),
    );
    t.appendChild(tete);
    liste.forEach((l) => {
      const tr = doc.createElement('tr');
      // Pas de bandes grises alternées : le moteur du PDF place le texte un peu
      // plus bas que le navigateur, et le fond de la ligne suivante recouvrait
      // le bas des lettres (une ligne sur deux coupée). Un trait fin suffit.
      // Interligne PROPRE au tableau (celui de la zone de texte peut être serré)
      // et hauteur MINIMALE : avec une grande police, la ligne s'agrandit.
      // Beaucoup de lignes : interligne et marges resserrés ; sur deux colonnes,
      // police un peu plus petite (comme le reçu SenClass, 8 pt environ).
      const serre = lignes.length > 4;
      const police = deuxColonnes ? 'font-size:8.2pt;' : '';
      const marges = deuxColonnes ? '0.2mm 1mm 0.5mm' : serre ? '0.3mm 1mm 0.7mm' : '0.5mm 1mm 1mm';
      const ligne = `${police}height:${hauteur}mm;line-height:${serre ? 1.15 : 1.3};padding:${marges};vertical-align:top;border-bottom:0.2mm solid #D1D5DB;${l.annulee ? 'color:#6B7280;' : ''}`;
      tr.append(
        cellule('td', l.annulee ? `${l.designation} (annulé)` : l.designation, `${ligne}text-align:left;${l.annulee ? 'text-decoration:line-through;' : ''}`),
        cellule('td', formaterMontant(l.montant), `${ligne}text-align:right;font-weight:bold;white-space:nowrap`),
      );
      t.appendChild(tr);
    });
    return t;
  };
  if (!deuxColonnes) return table(lignes);
  // Lecture en colonnes, comme un relevé : la première de haut en bas, puis la seconde.
  const moitie = Math.ceil(lignes.length / 2);
  const deux = doc.createElement('div');
  deux.setAttribute('style', 'display:flex;justify-content:space-between;align-items:flex-start');
  deux.append(table(lignes.slice(0, moitie)), table(lignes.slice(moitie)));
  return deux;
};

const PROF_VIDE: ProfesseurDocument = { matricule: '', prenom: '', nom: '', matieres: [], classes: [] };
const prof = (c: ContexteDocument): ProfesseurDocument => c.professeur ?? PROF_VIDE;
const LIBELLES_CONTRAT: Record<string, string> = { cdi: 'CDI', cdd: 'CDD', vacataire: 'Vacataire', stagiaire: 'Stagiaire' };

/** L'élève d'un document de professeur : aucun de ses champs n'y est permis. */
export const ELEVE_VIDE: EleveDocument = { matricule: '', prenom: '', nom: '', tuteurs: [] };

const tuteurDeQualite = (e: EleveDocument, qualite: string) =>
  e.tuteurs.find(t => t.qualite === qualite && t.nom?.trim());

export const CHAMPS: readonly ChampModele[] = [
  // ── L'établissement ──
  { nom: "NOM DE L'ÉTABLISSEMENT", groupe: 'ecole', source: "Nom de l'école", valeur: c => c.ecole.nom },
  { nom: "ADRESSE DE L'ÉTABLISSEMENT", groupe: 'ecole', source: 'Paramètres → École → Adresse', valeur: c => c.ecole.adresse ?? '' },
  { nom: 'VILLE', groupe: 'ecole', source: "Ville de l'école", valeur: c => c.ecole.ville ?? '' },
  { nom: 'PAYS', groupe: 'ecole', source: "Pays de l'école", valeur: c => c.ecole.pays ?? '' },
  { nom: "TÉLÉPHONE DE L'ÉTABLISSEMENT", groupe: 'ecole', source: "Téléphone de l'école", valeur: c => c.ecole.telephone ?? '' },
  { nom: "E-MAIL DE L'ÉTABLISSEMENT", groupe: 'ecole', source: "E-mail de l'école", valeur: c => c.ecole.email ?? '' },
  { nom: "NUMÉRO D'AUTORISATION", groupe: 'ecole', source: "Paramètres → École → N° d'autorisation d'ouverture", valeur: c => c.ecole.autorisation ?? '' },
  { nom: 'NINEA', groupe: 'ecole', source: "Paramètres → École → N° d'agrément / NINEA", valeur: c => c.ecole.ninea ?? '' },
  { nom: 'REGISTRE DE COMMERCE', groupe: 'ecole', source: 'Paramètres → École → N° RC', valeur: c => c.ecole.rc ?? '' },
  { nom: 'NOM DU DIRECTEUR', groupe: 'ecole', source: 'Paramètres → École → Directeur général', valeur: c => c.ecole.directeurGeneral ?? '' },
  { nom: 'NOM DU DIRECTEUR DES ÉTUDES', groupe: 'ecole', source: 'Paramètres → École → Directeur des études', valeur: c => c.ecole.directeurEtudes ?? '' },
  { nom: "LOGO DE L'ÉTABLISSEMENT", groupe: 'ecole', source: 'Paramètres → École → Logo (à placer dans <img src="…">)', image: true, valeur: c => c.ecole.logo ?? '' },
  // ── Le document ──
  { nom: 'DATE', groupe: 'document', source: 'Date du jour : 10/10/2026', valeur: c => dateCourte(c.date) },
  { nom: 'NUMÉRO DU DOCUMENT', groupe: 'document', source: "Attribué par SenClass à l'impression : CS-2026-00001", valeur: c => c.numero ?? '' },
  { nom: 'DATE EN LETTRES', groupe: 'document', source: 'Date du jour : 10 octobre 2026', valeur: c => dateEnLettres(c.date) },
  // ── L'élève ──
  { nom: "NOM ET PRÉNOM DE L'ÉLÈVE", groupe: 'eleve', source: 'Fiche élève : DIOP Awa', valeur: c => `${c.eleve.nom} ${c.eleve.prenom}`.trim() },
  { nom: "PRÉNOM ET NOM DE L'ÉLÈVE", groupe: 'eleve', source: 'Fiche élève : Awa DIOP', valeur: c => `${c.eleve.prenom} ${c.eleve.nom}`.trim() },
  { nom: "NOM DE L'ÉLÈVE", groupe: 'eleve', source: 'Fiche élève', valeur: c => c.eleve.nom },
  { nom: "PRÉNOM DE L'ÉLÈVE", groupe: 'eleve', source: 'Fiche élève', valeur: c => c.eleve.prenom },
  { nom: 'MATRICULE', groupe: 'eleve', source: 'Identifiant unique de l\'élève', valeur: c => c.eleve.matricule },
  { nom: 'SEXE', groupe: 'eleve', source: 'Fiche élève : Masculin / Féminin', valeur: c => c.eleve.sexe === 'homme' ? 'Masculin' : c.eleve.sexe === 'femme' ? 'Féminin' : '' },
  { nom: 'NÉ OU NÉE', groupe: 'eleve', source: 'Accord selon le sexe : né / née (né(e) si inconnu)', valeur: c => c.eleve.sexe === 'homme' ? 'né' : c.eleve.sexe === 'femme' ? 'née' : 'né(e)' },
  { nom: 'DATE DE NAISSANCE', groupe: 'eleve', source: 'Fiche élève', valeur: c => dateCourte(c.eleve.dateNaissance) },
  { nom: 'LIEU DE NAISSANCE', groupe: 'eleve', source: 'Fiche élève', valeur: c => c.eleve.lieuNaissance ?? '' },
  { nom: "ADRESSE DE L'ÉLÈVE", groupe: 'eleve', source: 'Fiche élève → Résidence', valeur: c => c.eleve.adresse ?? '' },
  { nom: "TÉLÉPHONE DE L'ÉLÈVE", groupe: 'eleve', source: 'Fiche élève', valeur: c => c.eleve.telephone ?? '' },
  { nom: 'NOM DU PÈRE', groupe: 'eleve', source: 'Tuteur dont la qualité est « Père » (vide sinon)', valeur: c => tuteurDeQualite(c.eleve, 'pere')?.nom?.trim() ?? '' },
  { nom: 'NOM DE LA MÈRE', groupe: 'eleve', source: 'Tuteur dont la qualité est « Mère » (vide sinon)', valeur: c => tuteurDeQualite(c.eleve, 'mere')?.nom?.trim() ?? '' },
  { nom: 'NOM DU TUTEUR', groupe: 'eleve', source: 'Tuteur 1', valeur: c => c.eleve.tuteurs[0]?.nom?.trim() ?? '' },
  { nom: 'TÉLÉPHONE DU TUTEUR', groupe: 'eleve', source: 'Tuteur 1', valeur: c => c.eleve.tuteurs[0]?.telephone?.trim() ?? '' },
  // ── La scolarité ──
  { nom: 'CLASSE', groupe: 'scolarite', source: "Classe de l'élève cette année", valeur: c => c.eleve.classe ?? '' },
  { nom: 'ANNÉE SCOLAIRE', groupe: 'scolarite', source: 'Année choisie en haut de l\'écran : 2026-2027', valeur: c => c.anneeScolaire ?? '' },
  { nom: "DATE D'INSCRIPTION", groupe: 'scolarite', source: "Inscription de l'élève pour l'année", valeur: c => dateCourte(c.eleve.dateInscription) },
  // ── Le reçu ──
  { nom: 'NUMÉRO DU REÇU', groupe: 'recu', source: 'REC-2026-00042', valeur: c => c.recu?.numero ?? '' },
  { nom: 'DATE DU PAIEMENT', groupe: 'recu', source: 'Date et heure du paiement : 10 octobre 2026 à 14:32', valeur: c => (c.recu ? dateLongueDakar(c.recu.date) : '') },
  { nom: 'JOUR DU PAIEMENT', groupe: 'recu', source: 'Date courte du paiement : 10/10/2026', valeur: c => (c.recu ? dateDakar(c.recu.date) : '') },
  { nom: 'MONTANT TOTAL', groupe: 'recu', source: 'Total payé : 75 000 FCFA', valeur: c => (c.recu ? `${formaterMontant(c.recu.total)} FCFA` : '') },
  { nom: 'TOTAL EN CHIFFRES', groupe: 'recu', source: 'Total payé, sans « FCFA » : 75 000', valeur: c => (c.recu ? formaterMontant(c.recu.total) : '') },
  { nom: 'ÉTAT DU PAIEMENT', groupe: 'recu', source: 'ACQUITTÉ, ou ANNULÉ si le paiement a été annulé', valeur: c => (c.recu ? (c.recu.annule ? 'ANNULÉ' : 'ACQUITTÉ') : '') },
  { nom: 'MONTANT EN LETTRES', groupe: 'recu', source: 'Soixante-quinze mille francs CFA', valeur: c => (c.recu ? montantEnLettres(c.recu.total) : '') },
  { nom: 'MODE DE PAIEMENT', groupe: 'recu', source: 'Espèces, Wave, Orange Money…', valeur: c => c.recu?.mode ?? '' },
  { nom: 'RÉFÉRENCE DU PAIEMENT', groupe: 'recu', source: 'Référence de la transaction (— si aucune)', valeur: c => (c.recu ? (c.recu.reference?.trim() || '—') : '') },
  { nom: 'ENCAISSÉ PAR', groupe: 'recu', source: 'Nom de la personne qui a encaissé', valeur: c => (c.recu ? (c.recu.encaissePar?.trim() || '—') : '') },
  { nom: 'MENTION DU REÇU', groupe: 'recu', source: 'ANNULÉ ou DUPLICATA (vide sinon)', valeur: c => (c.recu?.annule ? 'ANNULÉ' : c.recu?.duplicata ? 'DUPLICATA' : '') },
  {
    nom: 'TABLEAU DES PAIEMENTS', groupe: 'recu', source: 'La liste des paiements du reçu (désignation, montant)',
    valeur: c => (c.recu?.lignes ?? []).map(l => `${l.designation} : ${formaterMontant(l.montant)} FCFA${l.annulee ? ' (annulé)' : ''}`).join('\n'),
    bloc: (doc, c) => tableauPaiements(doc, c.recu?.lignes ?? []),
  },
  // ── Le professeur ──
  { nom: 'NOM ET PRÉNOM DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur : SARR Mamadou', valeur: c => [prof(c).nom, prof(c).prenom].filter(Boolean).join(' ') },
  { nom: 'PRÉNOM ET NOM DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur : Mamadou SARR', valeur: c => [prof(c).prenom, prof(c).nom].filter(Boolean).join(' ') },
  { nom: 'NOM DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur', valeur: c => prof(c).nom },
  { nom: 'PRÉNOM DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur', valeur: c => prof(c).prenom },
  { nom: 'CIVILITÉ DU PROFESSEUR', groupe: 'professeur', source: 'Monsieur / Madame, selon le sexe (vide si inconnu)', valeur: c => prof(c).sexe === 'homme' ? 'Monsieur' : prof(c).sexe === 'femme' ? 'Madame' : '' },
  { nom: 'MATRICULE DU PROFESSEUR', groupe: 'professeur', source: 'Identifiant unique du professeur', valeur: c => prof(c).matricule },
  { nom: 'MATIÈRES ENSEIGNÉES', groupe: 'professeur', source: 'Emploi du temps : matières de ses cours', valeur: c => prof(c).matieres.join(', ') },
  { nom: 'CLASSES DU PROFESSEUR', groupe: 'professeur', source: 'Emploi du temps : classes de ses cours', valeur: c => prof(c).classes.join(', ') },
  { nom: 'TÉLÉPHONE DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur', valeur: c => prof(c).telephone ?? '' },
  { nom: 'E-MAIL DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur', valeur: c => prof(c).email ?? '' },
  { nom: 'ADRESSE DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur → Résidence', valeur: c => prof(c).adresse ?? '' },
  { nom: 'DATE DE NAISSANCE DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur', valeur: c => dateCourte(prof(c).dateNaissance) },
  { nom: 'LIEU DE NAISSANCE DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur', valeur: c => prof(c).lieuNaissance ?? '' },
  { nom: 'DIPLÔME DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur', valeur: c => prof(c).diplome ?? '' },
  { nom: 'CONTRAT DU PROFESSEUR', groupe: 'professeur', source: 'Fiche professeur : CDI, CDD, vacataire, stagiaire', valeur: c => LIBELLES_CONTRAT[prof(c).contrat ?? ''] ?? '' },
];

/**
 * Forme comparable d'un nom de champ : majuscules, sans accents, espaces
 * simples, apostrophe droite. [nom de l'etablissement] = {NOM DE L’ÉTABLISSEMENT}.
 */
export const normaliserNomChamp = (brut: string): string =>
  brut.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ').trim().toUpperCase();

const CHAMPS_PAR_NOM = new Map(CHAMPS.map(ch => [normaliserNomChamp(ch.nom), ch]));

export const champConnu = (brut: string): ChampModele | undefined => CHAMPS_PAR_NOM.get(normaliserNomChamp(brut));

// ─── Lecture du HTML ───────────────────────────────────────────────────────

/** Un champ entre accolades : pas d'accolade ni de chevron dedans, 80 caractères au plus. */
const MOTIF_CHAMP = /\{([^{}<>]{1,80})\}/g;

/** Les balises dont le texte n'est pas du contenu (CSS, code) : leurs accolades ne sont pas des champs. */
const BALISES_HORS_CONTENU = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE']);

const lireDocument = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

const serialiser = (doc: Document): string => `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;

const noeudsTexte = (doc: Document): Text[] => {
  const textes: Text[] = [];
  const parcours = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let n = parcours.nextNode(); n; n = parcours.nextNode()) {
    const parent = n.parentElement;
    if (parent && BALISES_HORS_CONTENU.has(parent.tagName)) continue;
    textes.push(n as Text);
  }
  return textes;
};

interface Occurrence { brut: string; dansAttribut: boolean }

const occurrences = (doc: Document): Occurrence[] => {
  const trouvees: Occurrence[] = [];
  for (const t of noeudsTexte(doc)) {
    for (const m of (t.data ?? '').matchAll(MOTIF_CHAMP)) trouvees.push({ brut: m[1], dansAttribut: false });
  }
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      for (const m of attr.value.matchAll(MOTIF_CHAMP)) trouvees.push({ brut: m[1], dansAttribut: true });
    }
  }
  return trouvees;
};

// ─── Vérification ──────────────────────────────────────────────────────────

/** Au-delà, le modèle est refusé : une image de cachet en base64 tient largement dedans. */
export const TAILLE_MAX_MODELE = 1_000_000;

export interface VerificationModele {
  ok: boolean;
  /** Champs entre accolades que SenClass ne connaît pas, tels qu'écrits. */
  inconnus: string[];
  /** Champs image écrits dans le texte au lieu d'un attribut src. */
  imagesMalPlacees: string[];
  /** Noms officiels des champs utilisés, sans doublon, dans l'ordre d'apparition. */
  utilises: string[];
  /** Ce que le nettoyage retirera (scripts, ressources Internet…), pour le dire à l'école. */
  retraits: string[];
  /** Problème qui empêche tout le reste : vide, trop lourd… */
  erreur?: string;
  /** Pour qui le document se produit : des élèves, des professeurs, ou personne en particulier. */
  cible?: Cible;
}

export const verifierModele = (html: string, tailleMax = TAILLE_MAX_MODELE): VerificationModele => {
  const vide: VerificationModele = { ok: false, inconnus: [], imagesMalPlacees: [], utilises: [], retraits: [] };
  if (!html.trim()) return { ...vide, erreur: 'Le modèle est vide.' };
  if (html.length > tailleMax) return { ...vide, erreur: `Le modèle dépasse ${Math.round(tailleMax / 1_000_000)} Mo : allégez les images qu'il contient.` };
  const doc = lireDocument(html);
  // Vide = ni texte, ni élément (une page faite seulement de cadres et de formes compte).
  if (!doc.body || !doc.body.textContent?.trim() && doc.body.childElementCount === 0) {
    return { ...vide, erreur: "Le modèle n'a aucun contenu à imprimer." };
  }
  const inconnus = new Set<string>();
  const imagesMalPlacees = new Set<string>();
  const utilises: string[] = [];
  for (const o of occurrences(doc)) {
    const ch = champConnu(o.brut);
    if (!ch) { inconnus.add(o.brut.trim()); continue; }
    if (ch.image && !o.dansAttribut) imagesMalPlacees.add(ch.nom);
    if (!utilises.includes(ch.nom)) utilises.push(ch.nom);
  }
  const { retraits } = nettoyer(html);
  const cible = cibleDesChamps(utilises);
  return {
    ok: inconnus.size === 0 && imagesMalPlacees.size === 0 && cible !== 'mixte',
    inconnus: [...inconnus], imagesMalPlacees: [...imagesMalPlacees], utilises, retraits,
    cible: cible === 'mixte' ? 'aucune' : cible,
    ...(cible === 'mixte' ? { erreur: ERREUR_MIXTE } : {}),
  };
};

/** Pour qui le document est produit, d'après ses champs. */
export type Cible = 'eleve' | 'professeur' | 'aucune' | 'recu';

export const ERREUR_MIXTE = "Un document concerne soit un élève, soit un professeur : n'utilisez pas les champs des deux (un reçu concerne toujours un élève).";

export const cibleDesChamps = (utilises: string[]): Cible | 'mixte' => {
  const groupes = new Set(utilises.map(nom => champConnu(nom)?.groupe));
  const eleve = groupes.has('eleve') || groupes.has('scolarite');
  const professeur = groupes.has('professeur');
  // Un reçu concerne un élève : ses champs y sont permis, pas ceux d'un professeur.
  if (groupes.has('recu')) return professeur ? 'mixte' : 'recu';
  if (eleve && professeur) return 'mixte';
  return eleve ? 'eleve' : professeur ? 'professeur' : 'aucune';
};

// ─── Nettoyage ─────────────────────────────────────────────────────────────

/** Une adresse est acceptée si elle ne charge rien depuis Internet. */
const adresseSure = (v: string): boolean => {
  const s = v.trim();
  return s === '' || s.startsWith('#') || /^data:image\//i.test(s) || /^\{[^{}]+\}$/.test(s);
};

const ATTRIBUTS_ADRESSE = ['src', 'href', 'srcset', 'xlink:href', 'background', 'poster', 'action', 'formaction'];

/** Dans du CSS : @import et url(...) vers l'extérieur sont neutralisés ; data: reste permis. */
const nettoyerCss = (css: string): string =>
  css.replace(/@import[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)(?!data:(?:image|font)\/|data:application\/(?:x-)?font)[^)]*\1\s*\)/gi, 'none')
    .replace(/expression\s*\(/gi, '(');

/**
 * Retire tout ce qui pourrait agir ou appeler Internet. Renvoie le document
 * complet (avec ses styles) et la liste de ce qui a été retiré.
 */
export const nettoyer = (html: string): { html: string; retraits: string[] } => {
  const retraits = new Set<string>();
  const purif = DOMPurify();
  purif.addHook('uponSanitizeElement', (noeud, data) => {
    if (data.tagName === 'script') retraits.add('scripts');
    if (data.tagName === 'link') retraits.add('feuilles de style ou polices chargées depuis Internet');
    if (data.tagName === 'iframe' || data.tagName === 'object' || data.tagName === 'embed') retraits.add('contenus intégrés (iframe, object…)');
    if (data.tagName === 'style' && noeud.textContent) {
      const propre = nettoyerCss(noeud.textContent);
      if (propre !== noeud.textContent) retraits.add('ressources Internet dans le CSS (@import, url())');
      noeud.textContent = propre;
    }
  });
  purif.addHook('uponSanitizeAttribute', (_noeud, data) => {
    const nom = data.attrName.toLowerCase();
    if (nom.startsWith('on')) { retraits.add('actions JavaScript (onclick…)'); data.keepAttr = false; return; }
    if (ATTRIBUTS_ADRESSE.includes(nom) && !adresseSure(data.attrValue)) {
      retraits.add('images ou liens vers Internet');
      data.keepAttr = false;
      return;
    }
    if (nom === 'style') {
      const propre = nettoyerCss(data.attrValue);
      if (propre !== data.attrValue) retraits.add('ressources Internet dans le CSS (@import, url())');
      data.attrValue = propre;
    }
  });
  const propre = purif.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style'],
    FORBID_TAGS: ['script', 'link', 'base', 'iframe', 'frame', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'meta'],
    ALLOW_DATA_ATTR: false,
  }) as string;
  return { html: `<!DOCTYPE html>\n${propre}`, retraits: [...retraits] };
};

/**
 * Un morceau de HTML (le contenu d'une zone de texte, d'un bloc importé)
 * nettoyé de la même façon, pour l'afficher DANS l'application : jamais de
 * HTML venu de la base posé tel quel dans la page.
 */
export const nettoyerFragment = (html: string): string => {
  const propre = nettoyer(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`).html;
  return new DOMParser().parseFromString(propre, 'text/html').body.innerHTML;
};

// ─── Remplissage ───────────────────────────────────────────────────────────

/** La valeur de chaque champ connu pour ce contexte, par nom normalisé. */
export const valeursChamps = (c: ContexteDocument): Map<string, string> =>
  new Map(CHAMPS.map(ch => [normaliserNomChamp(ch.nom), ch.valeur(c)]));

/** Les champs utilisés par le modèle qui restent vides pour ce contexte (ex. NOM DU PÈRE). */
export const champsVides = (verification: VerificationModele, c: ContexteDocument): string[] =>
  verification.utilises.filter(nom => !champConnu(nom)?.valeur(c).trim());

const remplacer = (texte: string, valeurs: Map<string, string>): string =>
  texte.replace(MOTIF_CHAMP, (tout, brut: string) => valeurs.get(normaliserNomChamp(brut)) ?? tout);

/**
 * Remplace chaque champ par sa valeur. Le modèle doit avoir été vérifié :
 * un champ inconnu resterait tel quel. Les valeurs sont posées comme TEXTE
 * (jamais interprétées comme du HTML) : un nom contenant « < » reste un nom.
 */
export const remplirModele = (html: string, valeurs: Map<string, string>, contexte?: ContexteDocument): string => {
  const doc = lireDocument(html);
  // D'abord les blocs (tableau des paiements) : un vrai tableau à la place du champ.
  if (contexte) {
    for (const t of noeudsTexte(doc)) {
      if (!t.data.includes('{')) continue;
      const morceaux: Node[] = [];
      let dernier = 0;
      let bloc = false;
      for (const m of t.data.matchAll(MOTIF_CHAMP)) {
        const ch = champConnu(m[1]);
        if (!ch?.bloc) continue;
        bloc = true;
        morceaux.push(doc.createTextNode(t.data.slice(dernier, m.index)), ch.bloc(doc, contexte));
        dernier = (m.index ?? 0) + m[0].length;
      }
      if (bloc) {
        morceaux.push(doc.createTextNode(t.data.slice(dernier)));
        t.replaceWith(...morceaux);
      }
    }
  }
  for (const t of noeudsTexte(doc)) {
    if (t.data.includes('{')) t.data = remplacer(t.data, valeurs);
  }
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes('{')) el.setAttribute(attr.name, remplacer(attr.value, valeurs));
    }
    // École sans logo : pas d'icône d'image cassée sur le document.
    if (el.tagName === 'IMG' && el.hasAttribute('src') && !el.getAttribute('src')?.trim()) el.remove();
  }
  return serialiser(doc);
};

/** Classe de chaque feuille quand plusieurs élèves sont imprimés d'un coup. */
export const CLASSE_FEUILLE = 'senclass-feuille';

/**
 * Classe d'une page A4 précise dans une feuille (page de l'éditeur visuel,
 * page d'un Word) : le PDF photographie chacune sur sa propre page.
 */
export const CLASSE_PAGE = 'senclass-page';

/** La partie d'une feuille entre les marges @page du modèle. */
export const CLASSE_ZONE = 'senclass-zone';

/**
 * Plusieurs documents remplis (un par élève) → un seul document : les styles
 * du premier, puis le contenu de chacun sur sa propre page.
 */
/** Ce que la règle `@page` du modèle dit de la feuille : marges et orientation. */
export interface ReglagesPage {
  /** Marges de la feuille (CSS), null si le modèle n'en met pas. */
  marges: string | null;
  paysage: boolean;
}

const ZERO = /^(0|0(px|mm|cm|in|pt|em|%))$/;

/**
 * Lit la règle `@page { size: …; margin: … }` du modèle. Le navigateur ne
 * l'applique qu'À L'IMPRESSION : à l'écran (aperçu, éditeur) et dans le PDF
 * fabriqué par capture, il faut reproduire ces marges nous-mêmes — sinon le
 * texte colle aux bords alors que l'impression est juste.
 */
export const lireReglagesPage = (html: string): ReglagesPage => {
  const doc = lireDocument(html);
  const css = Array.from(doc.querySelectorAll('style')).map(st => st.textContent ?? '').join('\n');
  let marges: string | null = null;
  let paysage = false;
  for (const bloc of css.matchAll(/@page\s*(?::[a-z-]+\s*)?\{([^}]*)\}/gi)) {
    const regles = bloc[1];
    const taille = /(?:^|;)\s*size\s*:\s*([^;]+)/i.exec(regles)?.[1] ?? '';
    if (/landscape/i.test(taille)) paysage = true;
    const tout = /(?:^|;)\s*margin\s*:\s*([^;]+)/i.exec(regles)?.[1]?.trim();
    const cote = (c: string) => /(?:^|;)\s*margin-COTE\s*:\s*([^;]+)/i.source.replace('COTE', c);
    const cotes = ['top', 'right', 'bottom', 'left'].map(c => new RegExp(cote(c), 'i').exec(regles)?.[1]?.trim());
    if (tout) marges = tout;
    if (cotes.some(Boolean)) {
      const base = (marges ?? '0').split(/\s+/);
      const [h, d = h, b = h, g = d] = base;
      marges = [cotes[0] ?? h, cotes[1] ?? d, cotes[2] ?? b, cotes[3] ?? g].join(' ');
    }
  }
  if (marges && marges.split(/\s+/).every(m => ZERO.test(m))) marges = null;
  return { marges, paysage };
};

export const assemblerDocuments = (documents: string[]): string => {
  if (documents.length === 0) return '';
  const premier = lireDocument(documents[0]);
  const corps = premier.body;
  const { marges, paysage } = lireReglagesPage(documents[0]);
  const feuilles = documents.map((html, i) => {
    const d = i === 0 ? premier : lireDocument(html);
    const feuille = premier.createElement('div');
    feuille.className = CLASSE_FEUILLE;
    // Avec des marges @page, le contenu va dans une « zone » : la partie de
    // la page entre les marges, comme à l'impression.
    feuille.innerHTML = marges ? `<div class="${CLASSE_ZONE}">${d.body.innerHTML}</div>` : d.body.innerHTML;
    return feuille;
  });
  corps.replaceChildren(...feuilles);
  const saut = premier.createElement('style');
  // À l'écran, la feuille « contient » les éléments fixés (pied de page en
  // position: fixed) : ils restent en bas de SA page au lieu de flotter sur
  // l'écran. À l'impression, le navigateur les place lui-même sur chaque page.
  saut.textContent = `.${CLASSE_FEUILLE}{break-after:page;page-break-after:always}.${CLASSE_FEUILLE}:last-child{break-after:auto;page-break-after:auto}`
    + `@media screen{.${CLASSE_FEUILLE}{position:relative;transform:translateZ(0)}}`;
  premier.head.appendChild(saut);
  // Marges de la règle @page : à l'écran (et pour le PDF par capture), chaque
  // feuille devient une page A4 avec ces marges. À l'impression, le navigateur
  // applique déjà @page : la feuille redevient neutre. (« only print » échappe
  // exprès à versionImprimee, qui ne touche que « @media print ».)
  if (marges) {
    const feuille = premier.createElement('style');
    // La zone remplit la page entre les marges ; c'est elle qui « contient »
    // un pied de page fixé, qui se pose donc au-dessus de la marge du bas.
    feuille.textContent = `@media screen{html,body{background:#e5e5e5}body{margin:0}`
      + `.${CLASSE_FEUILLE}{box-sizing:border-box;width:${paysage ? '297mm' : '210mm'};min-height:${paysage ? '210mm' : '297mm'};padding:${marges};margin:20px auto;background:#fff;display:flex;flex-direction:column;transform:none}`
      + `.${CLASSE_ZONE}{flex:1 1 auto;position:relative;transform:translateZ(0)}}`
      + `@media only print{.${CLASSE_FEUILLE}{padding:0;width:auto;min-height:0;margin:0}}`;
    premier.head.appendChild(feuille);
  }
  return serialiser(premier);
};

/**
 * Un document assemblé (plusieurs élèves) → un document complet par feuille,
 * avec les mêmes styles : ce qu'on garde au registre pour chaque personne.
 */
export const separerFeuilles = (html: string): string[] => {
  const doc = lireDocument(html);
  const feuilles = Array.from(doc.querySelectorAll(`body > .${CLASSE_FEUILLE}`));
  return feuilles.map(f => {
    const seul = lireDocument(html);
    seul.body.replaceChildren(seul.importNode(f, true));
    return serialiser(seul);
  });
};

/**
 * Une zone de texte trop pleine (un reçu de douze lignes dans la place prévue
 * pour quatre) est réduite pour tenir dans son cadre, au lieu de déborder sur
 * ce qui suit — comme le reçu SenClass, qui se resserre. À appeler sur le
 * document affiché (aperçu, impression, PDF), qui seul connaît les hauteurs.
 */
/** Une zone de texte n'est jamais réduite en deçà de 80 % : au-delà, le texte deviendrait trop petit. */
const REDUCTION_MAX = 0.8;

export const ajusterTextesDebordants = (doc: Document): void => {
  for (const boite of Array.from(doc.querySelectorAll<HTMLElement>('.el.texte, .el.bloc'))) {
    if (boite.dataset.ajuste) continue;
    const place = boite.clientHeight;
    if (!place || boite.scrollHeight <= place + 2) continue;
    // Réduction LÉGÈRE seulement : si le contenu est bien plus grand que la
    // zone (un tableau de douze lignes dans 14 mm), on le laisse à sa taille,
    // il continue dessous — l'écraser le rendrait illisible.
    if (boite.scrollHeight * REDUCTION_MAX < place) continue;
    const contenu = doc.createElement('div');
    contenu.append(...Array.from(boite.childNodes));
    boite.appendChild(contenu);
    boite.dataset.ajuste = '1';
    // Deux passes : en élargissant le contenu, le texte se réarrange et raccourcit un peu.
    let f = 1;
    for (let i = 0; i < 3; i++) {
      const hauteur = contenu.scrollHeight * f;
      if (hauteur <= place + 1) break;
      f = Math.max(REDUCTION_MAX, f * (place / hauteur));
      contenu.style.cssText = `transform:scale(${f});transform-origin:0 0;width:${100 / f}%`;
    }
  }
};

/**
 * Pour fabriquer le PDF par capture d'écran, la page doit ressembler à sa
 * version imprimée : les règles « @media print » du modèle (fond blanc, marges
 * retirées…) s'appliquent alors tout le temps.
 */
export const versionImprimee = (html: string): string =>
  html.replace(/@media\s+print/gi, '@media all');

// ─── Données d'exemple (aperçu dans l'éditeur) ─────────────────────────────

/** Toujours présentées comme un EXEMPLE à l'écran : ce n'est pas un vrai élève. */
export const contexteExemple = (ecole: InfosEcole, anneeScolaire?: string): ContexteDocument => ({
  ecole,
  anneeScolaire: anneeScolaire ?? '2026-2027',
  date: new Date().toISOString(),
  eleve: {
    matricule: 'ETU-2026-00001', prenom: 'Awa', nom: 'DIOP', sexe: 'femme',
    dateNaissance: '2012-03-05', lieuNaissance: 'Dakar', adresse: 'Médina, Dakar', telephone: '',
    dateInscription: '2026-10-01',
    tuteurs: [
      { nom: 'Moussa DIOP', telephone: '77 000 00 00', qualite: 'pere' },
      { nom: 'Fatou NDIAYE', telephone: '76 000 00 00', qualite: 'mere' },
    ],
    classe: '6ème A',
  },
  // Un paiement d'exemple, pour l'aperçu des modèles de reçu.
  recu: {
    numero: 'REC-2026-00042', date: '2026-10-10T14:32:00Z',
    lignes: [
      { designation: "Frais d'inscription", montant: 50000, annulee: false },
      { designation: 'Scolarité — Octobre 2026', montant: 25000, annulee: false },
    ],
    total: 75000, mode: 'Espèces', encaissePar: 'Fatou SOW', annule: false, duplicata: false,
  },
  // Les deux exemples à la fois : un modèle valide n'utilise que l'un des deux.
  professeur: {
    matricule: 'PROF-2026-00001', prenom: 'Mamadou', nom: 'SARR', sexe: 'homme',
    dateNaissance: '1985-06-12', lieuNaissance: 'Thiès', telephone: '77 000 00 01', email: '', adresse: 'Thiès',
    diplome: 'Licence', contrat: 'cdi', matieres: ['Mathématiques', 'Physique-Chimie'], classes: ['6ème A', '5ème B'],
  },
});

// ─── Production ────────────────────────────────────────────────────────────

/** Ce que SchoolContext sait d'un élève (sous-ensemble de `Student`). */
export interface EleveSource {
  studentId: string;
  firstName: string;
  lastName: string;
  sex?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  residence?: string;
  phone?: string;
  enrolledAt?: string;
  tutor1?: { fullName?: string; phone?: string; status?: string };
  tutor2?: { fullName?: string; phone?: string; status?: string };
}

export const eleveDocument = (s: EleveSource, classe?: string): EleveDocument => ({
  matricule: s.studentId, prenom: s.firstName, nom: s.lastName, sexe: s.sex,
  dateNaissance: s.dateOfBirth, lieuNaissance: s.placeOfBirth, adresse: s.residence, telephone: s.phone,
  dateInscription: s.enrolledAt,
  tuteurs: [s.tutor1, s.tutor2].filter((t): t is NonNullable<typeof t> => !!t)
    .map(t => ({ nom: t.fullName, telephone: t.phone, qualite: t.status })),
  classe,
});

/** Ce que SchoolContext sait d'un professeur (sous-ensemble de `Teacher`). */
export interface ProfesseurSource {
  id: string;
  teacherId: string;
  firstName: string;
  lastName: string;
  sex?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  phone?: string;
  email?: string;
  residence?: string;
  diploma?: string;
  contractType?: string;
}

/** Une séance de l'emploi du temps : d'où viennent ses matières et ses classes. */
export interface SeanceSource { teacherId: string | null; subjectName: string; className: string }

const listeTriee = (valeurs: string[]): string[] =>
  [...new Set(valeurs.map(v => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));

export const professeurDocument = (t: ProfesseurSource, seances: SeanceSource[]): ProfesseurDocument => {
  const siennes = seances.filter(se => se.teacherId === t.id);
  return {
    matricule: t.teacherId, prenom: t.firstName, nom: t.lastName, sexe: t.sex,
    dateNaissance: t.dateOfBirth, lieuNaissance: t.placeOfBirth, telephone: t.phone, email: t.email,
    adresse: t.residence, diplome: t.diploma, contrat: t.contractType,
    matieres: listeTriee(siennes.map(se => se.subjectName)),
    classes: listeTriee(siennes.map(se => se.className)),
  };
};

/** Un document prêt à afficher : rempli PUIS nettoyé (le nettoyage passe en dernier). */
export const documentPret = (modeleHtml: string, c: ContexteDocument): string =>
  nettoyer(remplirModele(modeleHtml, valeursChamps(c), c)).html;

export interface Production {
  /** Refus : le modèle a un champ inconnu (ou est vide) — rien n'est produit. */
  refus?: VerificationModele;
  html: string;
  /**
   * Pour chaque champ utilisé resté vide : les élèves concernés. Un champ de
   * l'école (logo, autorisation…) est vide pour tous : signalé une seule fois,
   * avec l'endroit où le remplir, sans liste d'élèves.
   */
  vides: { champ: string; eleves: string[]; source?: string }[];
}

/**
 * Remplit le modèle pour chaque élève et assemble le tout. La vérification
 * est REFAITE ici : un modèle enregistré avant un changement du catalogue ne
 * doit pas imprimer un champ inconnu tel quel.
 */
export const produireDocuments = (modeleHtml: string, contextes: ContexteDocument[]): Production => {
  const verification = verifierModele(modeleHtml);
  if (!verification.ok) return { refus: verification, html: '', vides: [] };
  return {
    html: assemblerDocuments(contextes.map(c => documentPret(modeleHtml, c))),
    vides: listerVides(verification.utilises, contextes),
  };
};

/** « DIOP Awa » : l'élève, ou le professeur pour un document de professeur. */
export const nomPersonne = (c: ContexteDocument): string =>
  (c.eleve.nom || !c.professeur ? `${c.eleve.nom} ${c.eleve.prenom}` : `${c.professeur.nom} ${c.professeur.prenom}`).trim();

/** Les champs utilisés restés vides, élève par élève (ceux de l'école : une seule fois). */
export const listerVides = (utilises: string[], contextes: ContexteDocument[]): Production['vides'] => {
  const vides = new Map<string, string[]>();
  for (const c of contextes) {
    for (const champ of utilises.filter(nom => !champConnu(nom)?.valeur(c).trim())) {
      vides.set(champ, [...(vides.get(champ) ?? []), nomPersonne(c)]);
    }
  }
  return [...vides].map(([champ, eleves]) => {
    const ch = champConnu(champ);
    return ch && ch.groupe !== 'eleve' && ch.groupe !== 'scolarite' && ch.groupe !== 'professeur'
      ? { champ, eleves: [], source: ch.source }
      : { champ, eleves };
  });
};
