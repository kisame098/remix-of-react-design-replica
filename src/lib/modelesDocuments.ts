import DOMPurify from 'dompurify';
import { dateDakar, type InfosEcole } from '@/lib/documentsEcole';

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

export type GroupeChamp = 'ecole' | 'document' | 'eleve' | 'scolarite';

export const LIBELLES_GROUPE_CHAMP: Record<GroupeChamp, string> = {
  ecole: "L'établissement",
  document: 'Le document',
  eleve: "L'élève",
  scolarite: 'La scolarité',
};

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
  eleve: EleveDocument;
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
  return {
    ok: inconnus.size === 0 && imagesMalPlacees.size === 0,
    inconnus: [...inconnus], imagesMalPlacees: [...imagesMalPlacees], utilises, retraits,
  };
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
export const remplirModele = (html: string, valeurs: Map<string, string>): string => {
  const doc = lireDocument(html);
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

/**
 * Plusieurs documents remplis (un par élève) → un seul document : les styles
 * du premier, puis le contenu de chacun sur sa propre page.
 */
export const assemblerDocuments = (documents: string[]): string => {
  if (documents.length === 0) return '';
  const premier = lireDocument(documents[0]);
  const corps = premier.body;
  const feuilles = documents.map((html, i) => {
    const d = i === 0 ? premier : lireDocument(html);
    const feuille = premier.createElement('div');
    feuille.className = CLASSE_FEUILLE;
    feuille.innerHTML = d.body.innerHTML;
    return feuille;
  });
  corps.replaceChildren(...feuilles);
  const saut = premier.createElement('style');
  saut.textContent = `.${CLASSE_FEUILLE}{break-after:page;page-break-after:always}.${CLASSE_FEUILLE}:last-child{break-after:auto;page-break-after:auto}`;
  premier.head.appendChild(saut);
  return serialiser(premier);
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

/** Un document prêt à afficher : rempli PUIS nettoyé (le nettoyage passe en dernier). */
export const documentPret = (modeleHtml: string, c: ContexteDocument): string =>
  nettoyer(remplirModele(modeleHtml, valeursChamps(c))).html;

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

/** Les champs utilisés restés vides, élève par élève (ceux de l'école : une seule fois). */
export const listerVides = (utilises: string[], contextes: ContexteDocument[]): Production['vides'] => {
  const vides = new Map<string, string[]>();
  for (const c of contextes) {
    for (const champ of utilises.filter(nom => !champConnu(nom)?.valeur(c).trim())) {
      vides.set(champ, [...(vides.get(champ) ?? []), `${c.eleve.nom} ${c.eleve.prenom}`.trim()]);
    }
  }
  return [...vides].map(([champ, eleves]) => {
    const ch = champConnu(champ);
    return ch && ch.groupe !== 'eleve' && ch.groupe !== 'scolarite'
      ? { champ, eleves: [], source: ch.source }
      : { champ, eleves };
  });
};
