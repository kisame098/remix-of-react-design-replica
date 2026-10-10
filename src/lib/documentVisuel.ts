// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENT VISUEL — la page libre de l'éditeur (façon Canva)
//
// Une feuille A4 (portrait ou paysage) sur laquelle on pose des éléments :
// zones de texte, images (dont le logo de l'école), rectangles, ellipses,
// traits. Toutes les mesures sont en MILLIMÈTRES, comme sur la feuille.
//
// Le document est enregistré tel quel (JSON) pour être rouvert dans
// l'éditeur, et converti en HTML pour tout le reste : vérification des
// champs, nettoyage, aperçu, impression, PDF (src/lib/modelesDocuments.ts).
// L'éditeur dessine les éléments avec les MÊMES styles que ce HTML : ce qu'on
// voit à l'écran est ce qui sort à l'impression.
// ═══════════════════════════════════════════════════════════════════════════

export type Orientation = 'portrait' | 'paysage';
export type Alignement = 'left' | 'center' | 'right' | 'justify';
export type StyleTrait = 'solid' | 'dashed' | 'dotted' | 'double';

export interface Bordure {
  couleur: string;
  /** Épaisseur en mm. */
  epaisseur: number;
  style: StyleTrait;
}

export interface StyleTexte {
  police: string;
  /** Taille en points, comme dans Word. */
  taille: number;
  couleur: string;
  gras: boolean;
  italique: boolean;
  souligne: boolean;
  alignement: Alignement;
  /** Hauteur de ligne (1 = serré, 1.5 = aéré). */
  interligne: number;
}

interface Base {
  id: string;
  /** Position et taille en mm, depuis le coin haut gauche de la feuille. */
  x: number;
  y: number;
  l: number;
  h: number;
  /** Rotation en degrés. */
  rotation: number;
}

export interface ElementTexte extends Base {
  type: 'texte';
  /** Contenu mis en forme (gras, italique… sur une partie du texte). Les champs s'y écrivent {COMME CECI}. */
  html: string;
  style: StyleTexte;
  fond: string | null;
  bordure: Bordure | null;
}

export interface ElementImage extends Base {
  type: 'image';
  /** 'logo' = le logo de l'école ({LOGO DE L'ÉTABLISSEMENT}) ; sinon une image intégrée (data URL). */
  source: 'logo' | string;
}

export interface ElementForme extends Base {
  type: 'forme';
  forme: 'rectangle' | 'ellipse';
  fond: string | null;
  bordure: Bordure | null;
  /** Coins arrondis en mm (rectangle seulement). */
  arrondi: number;
}

export interface ElementLigne extends Base {
  type: 'ligne';
  bordure: Bordure;
}

export type ElementVisuel = ElementTexte | ElementImage | ElementForme | ElementLigne;
export type TypeElement = ElementVisuel['type'];

export interface DocumentVisuel {
  version: 1;
  orientation: Orientation;
  /** Couleur de la feuille. */
  fond: string;
  /** Du fond vers le dessus : le dernier élément est au premier plan. */
  elements: ElementVisuel[];
}

export const FORMAT_A4 = { largeur: 210, hauteur: 297 } as const;

export const dimensionsPage = (o: Orientation) =>
  o === 'portrait' ? { largeur: FORMAT_A4.largeur, hauteur: FORMAT_A4.hauteur } : { largeur: FORMAT_A4.hauteur, hauteur: FORMAT_A4.largeur };

/** Polices présentes sur tous les ordinateurs (Windows, Mac, téléphones) : rien à télécharger. */
export const POLICES: { nom: string; css: string }[] = [
  { nom: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { nom: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { nom: 'Georgia', css: 'Georgia, serif' },
  { nom: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  { nom: 'Tahoma', css: 'Tahoma, Geneva, sans-serif' },
  { nom: 'Trebuchet MS', css: '"Trebuchet MS", Helvetica, sans-serif' },
  { nom: 'Courier New', css: '"Courier New", Courier, monospace' },
  { nom: 'Garamond', css: 'Garamond, "Times New Roman", serif' },
];

const cssPolice = (nom: string): string => POLICES.find(p => p.nom === nom)?.css ?? POLICES[0].css;

export const STYLE_TEXTE_PAR_DEFAUT: StyleTexte = {
  police: 'Times New Roman', taille: 14, couleur: '#111111', gras: false, italique: false, souligne: false,
  alignement: 'left', interligne: 1.3,
};

export const documentVierge = (orientation: Orientation = 'portrait'): DocumentVisuel =>
  ({ version: 1, orientation, fond: '#ffffff', elements: [] });

// ─── Création d'éléments ───────────────────────────────────────────────────

export const nouvelId = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `e${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

/** Un nouvel élément, posé au centre de la feuille (ou là où on le demande). */
export const nouvelElement = (type: TypeElement, o: Orientation, extra: { source?: string; forme?: 'rectangle' | 'ellipse' } = {}): ElementVisuel => {
  const { largeur, hauteur } = dimensionsPage(o);
  const centrer = (l: number, h: number) => ({ x: Math.round((largeur - l) / 2), y: Math.round((hauteur - h) / 2), l, h, rotation: 0 });
  const id = nouvelId();
  switch (type) {
    case 'texte':
      return { id, type, ...centrer(120, 14), html: 'Votre texte', style: { ...STYLE_TEXTE_PAR_DEFAUT }, fond: null, bordure: null };
    case 'image':
      return { id, type, ...centrer(35, 35), source: extra.source ?? 'logo' };
    case 'forme':
      return {
        id, type, forme: extra.forme ?? 'rectangle', ...centrer(extra.forme === 'ellipse' ? 50 : 80, 50),
        fond: null, bordure: { couleur: '#222222', epaisseur: 0.5, style: 'solid' }, arrondi: 0,
      };
    case 'ligne':
      return { id, type, ...centrer(120, 2), bordure: { couleur: '#222222', epaisseur: 0.4, style: 'solid' } };
  }
};

// ─── Styles : partagés par l'éditeur et le HTML produit ────────────────────

const mm = (v: number) => `${Math.round(v * 100) / 100}mm`;

const cssBordure = (b: Bordure | null): string =>
  b && b.epaisseur > 0 ? `${mm(b.epaisseur)} ${b.style} ${b.couleur}` : 'none';

/**
 * Les propriétés CSS d'un élément (sans sa position, que l'éditeur gère à part
 * pendant un déplacement). Clés en notation CSS : `font-size`, pas `fontSize`.
 */
export const cssContenu = (el: ElementVisuel): Record<string, string> => {
  switch (el.type) {
    case 'texte': {
      const s = el.style;
      return {
        'font-family': cssPolice(s.police),
        'font-size': `${s.taille}pt`,
        color: s.couleur,
        'font-weight': s.gras ? 'bold' : 'normal',
        'font-style': s.italique ? 'italic' : 'normal',
        'text-decoration': s.souligne ? 'underline' : 'none',
        'text-align': s.alignement,
        'line-height': String(s.interligne),
        background: el.fond ?? 'transparent',
        border: cssBordure(el.bordure),
        'overflow-wrap': 'break-word',
        'white-space': 'pre-wrap',
      };
    }
    case 'image':
      return {};
    case 'forme':
      return {
        background: el.fond ?? 'transparent',
        border: cssBordure(el.bordure),
        'border-radius': el.forme === 'ellipse' ? '50%' : mm(el.arrondi),
      };
    case 'ligne':
      return { 'border-top': cssBordure(el.bordure), height: '0', 'margin-top': mm(el.h / 2) };
  }
};

export const cssPosition = (el: ElementVisuel): Record<string, string> => ({
  position: 'absolute',
  left: mm(el.x),
  top: mm(el.y),
  width: mm(el.l),
  height: mm(el.h),
  ...(el.rotation ? { transform: `rotate(${el.rotation}deg)` } : {}),
});

/** `{ 'font-size': '12pt' }` → `{ fontSize: '12pt' }`, pour React. */
export const versStyleReact = (css: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(css).map(([k, v]) => [k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v]));

const versAttributStyle = (css: Record<string, string>): string =>
  Object.entries(css).map(([k, v]) => `${k}:${v.replace(/"/g, "'")}`).join(';');

const echapper = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const SOURCE_LOGO = "{LOGO DE L'ÉTABLISSEMENT}";

export const sourceImage = (el: ElementImage): string => (el.source === 'logo' ? SOURCE_LOGO : el.source);

const elementVersHtml = (el: ElementVisuel): string => {
  const position = versAttributStyle(cssPosition(el));
  switch (el.type) {
    case 'texte':
      return `<div class="el texte" style="${position};${versAttributStyle(cssContenu(el))}">${el.html}</div>`;
    case 'image':
      return `<div class="el" style="${position}"><img src="${echapper(sourceImage(el))}" alt="" style="display:block;width:100%;height:100%;object-fit:contain"></div>`;
    case 'forme':
      return `<div class="el" style="${position};${versAttributStyle(cssContenu(el))}"></div>`;
    case 'ligne':
      return `<div class="el" style="${position}"><div style="${versAttributStyle(cssContenu(el))}"></div></div>`;
  }
};

/** Le HTML complet d'une feuille, prêt pour la vérification, l'aperçu et l'impression. */
export const visuelVersHtml = (doc: DocumentVisuel, titre = 'Document'): string => {
  const { largeur, hauteur } = dimensionsPage(doc.orientation);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${echapper(titre)}</title>
<style>
@page { size: A4 ${doc.orientation === 'portrait' ? 'portrait' : 'landscape'}; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; background: #e5e5e5; }
.page { position: relative; width: ${largeur}mm; height: ${hauteur}mm; margin: 20px auto; overflow: hidden; }
.texte p, .texte div { margin: 0; }
@media print { body { background: white; } .page { margin: 0; } }
</style>
</head>
<body>
<div class="page senclass-page" style="background:${doc.fond}">
${doc.elements.map(elementVersHtml).join('\n')}
</div>
</body>
</html>
`;
};

// ─── Lecture prudente (données de la base) ─────────────────────────────────

/** Un document lu en base : jamais de plantage sur une donnée inattendue. */
export const lireDocumentVisuel = (brut: unknown): DocumentVisuel | null => {
  if (!brut || typeof brut !== 'object') return null;
  const d = brut as Partial<DocumentVisuel>;
  if (d.version !== 1 || !Array.isArray(d.elements)) return null;
  return {
    version: 1,
    orientation: d.orientation === 'paysage' ? 'paysage' : 'portrait',
    fond: typeof d.fond === 'string' ? d.fond : '#ffffff',
    elements: d.elements.filter(e => e && typeof e === 'object' && ['texte', 'image', 'forme', 'ligne'].includes((e as ElementVisuel).type)),
  };
};

/** Arrondi au dixième de millimètre : des positions lisibles dans le panneau. */
export const arrondirMm = (v: number): number => Math.round(v * 10) / 10;
