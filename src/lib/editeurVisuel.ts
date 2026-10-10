import { arrondirMm, dimensionsPage, nouvelId, type DocumentVisuel, type ElementVisuel } from '@/lib/documentVisuel';

// ═══════════════════════════════════════════════════════════════════════════
// CALCULS DE L'ÉDITEUR VISUEL (sans écran, donc testables)
//
// Déplacer, redimensionner, aligner sur le centre de la feuille, ordre des
// plans, et l'historique Annuler / Rétablir.
// ═══════════════════════════════════════════════════════════════════════════

/** Pixels CSS par millimètre (96 points par pouce). */
export const PX_PAR_MM = 96 / 25.4;

/** Taille minimale d'un élément, pour qu'il reste attrapable. */
export const TAILLE_MIN = 2;

/** Distance sous laquelle un élément « colle » au centre de la feuille. */
export const AIMANT_CENTRE = 1.5;

export type Poignee = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const POIGNEES: Poignee[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface Guides {
  /** Ligne verticale au centre de la feuille. */
  vertical: boolean;
  /** Ligne horizontale au centre de la feuille. */
  horizontal: boolean;
}

/**
 * Déplace un élément depuis sa position de départ. Il colle au centre de la
 * feuille quand il en passe tout près (et l'éditeur affiche le guide).
 */
export const deplacer = (
  depart: ElementVisuel, dx: number, dy: number, doc: DocumentVisuel,
): { element: ElementVisuel; guides: Guides } => {
  const { largeur, hauteur } = dimensionsPage(doc.orientation);
  let x = arrondirMm(depart.x + dx);
  let y = arrondirMm(depart.y + dy);
  const guides: Guides = { vertical: false, horizontal: false };
  if (Math.abs(x + depart.l / 2 - largeur / 2) < AIMANT_CENTRE) { x = arrondirMm(largeur / 2 - depart.l / 2); guides.vertical = true; }
  if (Math.abs(y + depart.h / 2 - hauteur / 2) < AIMANT_CENTRE) { y = arrondirMm(hauteur / 2 - depart.h / 2); guides.horizontal = true; }
  return { element: { ...depart, x, y }, guides };
};

/**
 * Redimensionne par une poignée. Le côté opposé ne bouge pas. Avec
 * `garderProportions` (touche Maj, ou une image par un coin), le rapport
 * largeur/hauteur est conservé.
 */
export const redimensionner = (
  depart: ElementVisuel, poignee: Poignee, dx: number, dy: number, garderProportions = false,
): ElementVisuel => {
  let { x, y, l, h } = depart;
  if (poignee.includes('e')) l = depart.l + dx;
  if (poignee.includes('w')) { l = depart.l - dx; x = depart.x + dx; }
  if (poignee.includes('s')) h = depart.h + dy;
  if (poignee.includes('n')) { h = depart.h - dy; y = depart.y + dy; }

  if (garderProportions && poignee.length === 2 && depart.h > 0) {
    const rapport = depart.l / depart.h;
    // La plus grande variation l'emporte ; l'autre dimension suit.
    if (Math.abs(l - depart.l) / depart.l >= Math.abs(h - depart.h) / depart.h) h = l / rapport;
    else l = h * rapport;
    if (poignee.includes('w')) x = depart.x + depart.l - l;
    if (poignee.includes('n')) y = depart.y + depart.h - h;
  }

  // Jamais plus petit que le minimum : le côté opposé reste en place.
  if (l < TAILLE_MIN) { if (poignee.includes('w')) x = depart.x + depart.l - TAILLE_MIN; l = TAILLE_MIN; }
  if (h < TAILLE_MIN) { if (poignee.includes('n')) y = depart.y + depart.h - TAILLE_MIN; h = TAILLE_MIN; }
  return { ...depart, x: arrondirMm(x), y: arrondirMm(y), l: arrondirMm(l), h: arrondirMm(h) };
};

// ─── Opérations sur le document ────────────────────────────────────────────

export const remplacerElement = (doc: DocumentVisuel, el: ElementVisuel): DocumentVisuel =>
  ({ ...doc, elements: doc.elements.map(e => (e.id === el.id ? el : e)) });

export const supprimerElement = (doc: DocumentVisuel, id: string): DocumentVisuel =>
  ({ ...doc, elements: doc.elements.filter(e => e.id !== id) });

/** Copie décalée de 5 mm, posée au premier plan. */
export const dupliquerElement = (doc: DocumentVisuel, id: string): { doc: DocumentVisuel; copie: ElementVisuel | null } => {
  const el = doc.elements.find(e => e.id === id);
  if (!el) return { doc, copie: null };
  const copie = { ...structuredClone(el), id: nouvelId(), x: arrondirMm(el.x + 5), y: arrondirMm(el.y + 5) } as ElementVisuel;
  return { doc: { ...doc, elements: [...doc.elements, copie] }, copie };
};

export type Plan = 'premier' | 'arriere' | 'avancer' | 'reculer';

/** L'ordre des éléments est l'ordre d'empilement : le dernier est au-dessus. */
export const changerPlan = (doc: DocumentVisuel, id: string, plan: Plan): DocumentVisuel => {
  const i = doc.elements.findIndex(e => e.id === id);
  if (i < 0) return doc;
  const els = [...doc.elements];
  const [el] = els.splice(i, 1);
  const cible = plan === 'premier' ? els.length : plan === 'arriere' ? 0
    : plan === 'avancer' ? Math.min(els.length, i + 1) : Math.max(0, i - 1);
  els.splice(cible, 0, el);
  return { ...doc, elements: els };
};

/** Bascule portrait ↔ paysage en gardant les éléments dans la feuille. */
export const changerOrientation = (doc: DocumentVisuel, orientation: DocumentVisuel['orientation']): DocumentVisuel => {
  const { largeur, hauteur } = dimensionsPage(orientation);
  return {
    ...doc,
    orientation,
    elements: doc.elements.map(e => ({
      ...e,
      x: arrondirMm(Math.max(0, Math.min(e.x, largeur - Math.min(e.l, largeur)))),
      y: arrondirMm(Math.max(0, Math.min(e.y, hauteur - Math.min(e.h, hauteur)))),
    })),
  };
};

// ─── Annuler / Rétablir ────────────────────────────────────────────────────

export interface Historique {
  passe: DocumentVisuel[];
  present: DocumentVisuel;
  futur: DocumentVisuel[];
}

/** Au-delà, les plus vieilles étapes sont oubliées. */
export const PROFONDEUR_HISTORIQUE = 100;

export type ActionHistorique =
  /** Une modification qui compte comme une étape (Annuler y revient). */
  | { type: 'valider'; doc: DocumentVisuel; avant?: DocumentVisuel }
  /** Une modification en cours (glisser, taper du texte) : pas encore une étape. */
  | { type: 'direct'; doc: DocumentVisuel }
  | { type: 'annuler' }
  | { type: 'retablir' }
  | { type: 'reinitialiser'; doc: DocumentVisuel };

export const historiqueInitial = (doc: DocumentVisuel): Historique => ({ passe: [], present: doc, futur: [] });

export const reduireHistorique = (h: Historique, a: ActionHistorique): Historique => {
  switch (a.type) {
    case 'direct':
      return { ...h, present: a.doc };
    case 'valider': {
      // `avant` : l'état au début d'un glisser — l'étape annulée revient là.
      const precedent = a.avant ?? h.present;
      if (precedent === a.doc) return h;
      return { passe: [...h.passe, precedent].slice(-PROFONDEUR_HISTORIQUE), present: a.doc, futur: [] };
    }
    case 'annuler':
      if (h.passe.length === 0) return h;
      return { passe: h.passe.slice(0, -1), present: h.passe[h.passe.length - 1], futur: [h.present, ...h.futur] };
    case 'retablir':
      if (h.futur.length === 0) return h;
      return { passe: [...h.passe, h.present], present: h.futur[0], futur: h.futur.slice(1) };
    case 'reinitialiser':
      return historiqueInitial(a.doc);
  }
};
