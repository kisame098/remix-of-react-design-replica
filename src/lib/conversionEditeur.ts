import { CLASSE_FEUILLE, CLASSE_PAGE, assemblerDocuments, nettoyer, versionImprimee } from '@/lib/modelesDocuments';
import { depuisBase64 } from '@/lib/modeleWord';
import { documentVierge, nouvelElement, type DocumentVisuel } from '@/lib/documentVisuel';

// ═══════════════════════════════════════════════════════════════════════════
// OUVRIR UN WORD OU UN HTML DANS L'ÉDITEUR
//
// Le document est affiché une fois dans un cadre caché ; pour chaque élément,
// le navigateur dit quel style il a réellement (police, marges, bordures…),
// et on recopie ce style SUR l'élément. Plus aucune feuille de style globale :
// le contenu devient un « bloc » posé sur la feuille de l'éditeur, modifiable
// comme un texte, et l'école peut ajouter autour son logo, des images, des
// formes. Le rendu reste celui d'origine.
//
// Chargé seulement au clic (FICHIERS_D_ACTION).
// ═══════════════════════════════════════════════════════════════════════════

/** Styles recopiés tels quels (non hérités). */
const PROPRIETES_BOITE = [
  'display', 'box-sizing', 'float', 'clear', 'vertical-align',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-top-style', 'border-top-color',
  'border-right-width', 'border-right-style', 'border-right-color',
  'border-bottom-width', 'border-bottom-style', 'border-bottom-color',
  'border-left-width', 'border-left-style', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self', 'flex-grow', 'flex-shrink', 'flex-basis', 'gap',
  'text-decoration-line', 'text-decoration-style', 'text-decoration-color',
  'border-collapse', 'border-spacing', 'table-layout', 'list-style-type', 'list-style-position',
  'position', 'top', 'left', 'right', 'bottom', 'z-index', 'transform', 'opacity',
];

/** Styles hérités : recopiés seulement là où ils changent par rapport au parent. */
const PROPRIETES_HERITEES = [
  'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'word-spacing', 'text-align', 'text-indent', 'text-transform', 'white-space',
];

/**
 * Valeur par défaut de chaque propriété : inutile de la recopier. Propriété
 * par propriété — « 1 » est neutre pour l'opacité mais PAS pour flex-grow
 * (une case « valeur » qui prend toute la largeur restante).
 */
const DEFAUTS: Record<string, string[]> = {
  'flex-grow': ['0'], 'flex-shrink': ['1'], 'flex-basis': ['auto'], 'opacity': ['1'], 'z-index': ['auto'],
  'flex-direction': ['row'], 'flex-wrap': ['nowrap'], 'justify-content': ['normal', 'flex-start', 'start'],
  'align-items': ['normal', 'stretch'], 'align-self': ['auto'], 'gap': ['normal', '0px'],
  'vertical-align': ['baseline'], 'float': ['none'], 'clear': ['none'],
  'background-color': ['rgba(0, 0, 0, 0)', 'transparent'], 'background-image': ['none'],
  'background-size': ['auto', 'auto auto'], 'background-position': ['0% 0%'], 'background-repeat': ['repeat'],
  'text-decoration-line': ['none'], 'text-decoration-style': ['solid'],
  'border-collapse': ['separate'], 'border-spacing': ['0px 0px', '0px'], 'table-layout': ['auto'],
  'list-style-type': ['disc'], 'list-style-position': ['outside'],
  'top': ['auto'], 'left': ['auto'], 'right': ['auto'], 'bottom': ['auto'], 'transform': ['none'], 'box-sizing': ['content-box'],
};
const NEUTRES = new Set(['0px', 'none', 'normal', 'auto']);
const TOUJOURS = new Set(['display', 'position']);
const estNeutre = (p: string, v: string): boolean => (DEFAUTS[p] ? DEFAUTS[p].includes(v) : NEUTRES.has(v));

const DOIT_GARDER_LARGEUR = new Set(['IMG', 'TABLE', 'TD', 'TH', 'COL', 'SVG', 'CANVAS']);

/**
 * Word coupe souvent un texte en plusieurs morceaux (« {NOM DE » + « L'ÉLÈVE} »,
 * chacun dans sa balise). Un champ coupé ne serait ni vérifié ni rempli : on
 * le recolle dans le premier morceau, qui garde sa mise en forme.
 */
export const recollerChamps = (racine: Node): void => {
  const doc = racine.ownerDocument ?? (racine as Document);
  const textes: Text[] = [];
  const parcours = doc.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  for (let n = parcours.nextNode(); n; n = parcours.nextNode()) textes.push(n as Text);
  for (let i = 0; i < textes.length; i++) {
    const t = textes[i];
    const ouverte = t.data.lastIndexOf('{');
    if (ouverte < 0 || t.data.lastIndexOf('}') > ouverte) continue;
    // On va chercher la suite dans les morceaux suivants, 80 caractères au plus.
    let manque = 80 - (t.data.length - ouverte);
    for (let j = i + 1; j < textes.length && manque > 0; j++) {
      const suite = textes[j];
      const fin = suite.data.indexOf('}');
      if (suite.data.includes('{') && (fin < 0 || suite.data.indexOf('{') < fin)) break;
      if (fin >= 0) {
        t.data += suite.data.slice(0, fin + 1);
        suite.data = suite.data.slice(fin + 1);
        break;
      }
      t.data += suite.data;
      manque -= suite.data.length;
      suite.data = '';
    }
  }
};

/** Recopie sur chaque élément le style que le navigateur lui donne réellement. */
const figerStyles = (racine: HTMLElement, vue: Window): void => {
  const elements = [racine, ...Array.from(racine.querySelectorAll<HTMLElement>('*'))];
  // On lit tout AVANT d'écrire : écrire un style changerait les mesures suivantes.
  const lus = elements.map(el => {
    const cs = vue.getComputedStyle(el);
    const parent = el === racine || !el.parentElement ? null : vue.getComputedStyle(el.parentElement);
    const styles: [string, string][] = [];
    for (const p of PROPRIETES_BOITE) {
      const v = cs.getPropertyValue(p);
      // Une couleur ou un style de bordure ne sert à rien sans épaisseur.
      const cote = /^border-(top|right|bottom|left)-(color|style)$/.exec(p)?.[1];
      if (cote && cs.getPropertyValue(`border-${cote}-width`) === '0px') continue;
      if (v && (TOUJOURS.has(p) || !estNeutre(p, v))) styles.push([p, v]);
    }
    for (const p of PROPRIETES_HERITEES) {
      const v = cs.getPropertyValue(p);
      if (v && (!parent || parent.getPropertyValue(p) !== v)) styles.push([p, v]);
    }
    // La largeur n'est figée que si elle compte (image, tableau, colonne
    // plus étroite que son parent) ; la hauteur seulement pour les images :
    // un texte rempli plus long doit pouvoir pousser la suite.
    const largeur = el.getBoundingClientRect().width;
    const largeurParent = el.parentElement?.getBoundingClientRect().width ?? largeur;
    if (DOIT_GARDER_LARGEUR.has(el.tagName) || largeur < largeurParent - 1 || el === racine) styles.push(['width', `${largeur}px`]);
    if (el.tagName === 'IMG' || el.tagName === 'SVG') styles.push(['height', `${el.getBoundingClientRect().height}px`]);
    if (el === racine) styles.push(['min-height', cs.getPropertyValue('min-height')]);
    return styles;
  });
  elements.forEach((el, i) => {
    el.removeAttribute('class');
    el.setAttribute('style', lus[i].map(([p, v]) => `${p}:${v}`).join(';'));
  });
};

const ouvrirCadre = (html: string): Promise<HTMLIFrameElement> => new Promise((resolve, reject) => {
  const cadre = document.createElement('iframe');
  cadre.setAttribute('sandbox', 'allow-same-origin');
  cadre.setAttribute('aria-hidden', 'true');
  Object.assign(cadre.style, { position: 'fixed', left: '-10000px', top: '0', width: '1123px', height: '1123px', border: '0' });
  const delai = window.setTimeout(() => reject(new Error('Le document ne se charge pas.')), 15000);
  cadre.onload = () => { window.clearTimeout(delai); resolve(cadre); };
  cadre.srcdoc = html;
  document.body.appendChild(cadre);
});

/**
 * Un document HTML (déjà vérifié) → une page de l'éditeur : un bloc avec tout
 * son contenu, à la taille de la feuille. Seule la PREMIÈRE page est reprise.
 */
export const htmlVersDocumentVisuel = async (html: string): Promise<DocumentVisuel> => {
  // Passé par l'assemblage : les marges de la règle @page deviennent celles
  // de la feuille, comme dans l'aperçu (sinon le texte collerait aux bords).
  const cadre = await ouvrirCadre(assemblerDocuments([versionImprimee(nettoyer(html).html)]));
  try {
    const doc = cadre.contentDocument;
    const vue = cadre.contentWindow;
    if (!doc || !vue) throw new Error('Document illisible.');
    await Promise.all(Array.from(doc.images).map(img => (img.complete ? null : new Promise(r => { img.onload = r; img.onerror = r; }))));
    // La feuille : une page de Word, la « .page » d'un modèle HTML, sinon le corps entier.
    const feuille = doc.querySelector<HTMLElement>(`.${CLASSE_PAGE}`)
      ?? doc.querySelector<HTMLElement>('section.docx, .page')
      ?? doc.querySelector<HTMLElement>(`.${CLASSE_FEUILLE}`)
      ?? doc.body;
    const rect = feuille.getBoundingClientRect();
    const paysage = rect.width > rect.height && rect.width > 900;
    const fond = vue.getComputedStyle(feuille).backgroundColor;

    recollerChamps(feuille);
    figerStyles(feuille, vue);
    // La feuille de l'éditeur fait déjà la page : pas de marge ni d'ombre autour.
    feuille.style.margin = '0';
    feuille.style.boxShadow = 'none';
    // Le corps lui-même ne se recopie pas : on reprend ses styles dans un div
    // (par le DOM : un nom de police entre guillemets casserait un attribut écrit à la main).
    let contenu = feuille.outerHTML;
    if (feuille === doc.body) {
      const div = doc.createElement('div');
      div.setAttribute('style', feuille.getAttribute('style') ?? '');
      div.innerHTML = feuille.innerHTML;
      contenu = div.outerHTML;
    }

    const resultat = documentVierge(paysage ? 'paysage' : 'portrait');
    if (fond && fond !== 'rgba(0, 0, 0, 0)' && fond !== 'transparent') resultat.fond = fond;
    resultat.elements = [{ ...nouvelElement('bloc', resultat.orientation), html: contenu } as DocumentVisuel['elements'][number]];
    return resultat;
  } finally {
    cadre.remove();
  }
};

/** Un modèle Word → une page de l'éditeur (sa première page). */
export const wordVersDocumentVisuel = async (fichierBase64: string): Promise<DocumentVisuel> => {
  const { wordVersHtml } = await import('@/lib/modeleWordRendu');
  return htmlVersDocumentVisuel(await wordVersHtml(depuisBase64(fichierBase64)));
};
