import QRCode from 'qrcode';
import { initialesEcole, type InfosEcole } from '@/lib/documentsEcole';
import { hexVersRgb, rgbVersHex, type Palette } from '@/lib/couleurLogo';

// ═══════════════════════════════════════════════════════════════════════════
// CARTE D'IDENTITÉ SCOLAIRE (écoles en mode classique) — recto et verso
//
// Taille par défaut : la carte plastique standard, celle de la carte bancaire
// et de la carte d'identité (format CR80 / ISO 7810 ID-1 : 85,60 × 53,98 mm).
// C'est le format que chargent les imprimantes à cartes (Evolis, Zebra, Fargo…).
// L'école peut changer la largeur et la hauteur ; plus haute que large, la
// carte passe en badge (mise en page « debout »).
//
// Deux sorties, voir carteScolairePdf.ts :
//   • imprimante à cartes : un PDF dont chaque page fait EXACTEMENT la taille
//     de la carte — recto puis verso de chaque élève ;
//   • feuille A4 : autant de cartes que la feuille en contient, à découper
//     puis plastifier (écoles sans imprimante à cartes). Le verso est en miroir
//     pour tomber au dos de son recto.
//
// QR code au recto : il ne contient QUE le matricule de l'élève (rien de
// secret, il est déjà écrit sur la carte). Gestion paiements → Scanner et la
// caisse mobile le lisent pour retrouver l'élève sans le chercher.
//
// La mise en page est calculée ICI, sans jsPDF : une liste de tracés en mm.
// Le même dessin sert à l'aperçu à l'écran (SVG) et au PDF — ce qu'on voit est
// ce qui sort. Seule la mesure du texte vient de l'extérieur (jsPDF).
// ═══════════════════════════════════════════════════════════════════════════

/** Format CR80 : la carte plastique standard. */
export const FORMAT_STANDARD = { largeur: 85.6, hauteur: 53.98 } as const;

/** Bornes des dimensions libres, en mm : lisible, et toujours au moins une carte sur une feuille A4. */
export const TAILLE_MIN = 40;
export const TAILLE_MAX = 120;

export interface ReglagesCarte {
  largeur: number;
  hauteur: number;
  /** Couleur de la carte ; null = celle du logo de l'école. */
  couleur: string | null;
  /** Titre dans le bandeau du recto. */
  titre: string;
  /** Règles écrites au verso. */
  texteVerso: string;
  /** Fond des deux faces : motif de sécurité (guilloches, rosace) ou blanc uni. */
  fond: FondCarte;
}

export type FondCarte = 'motif' | 'uni';

export const TITRE_PAR_DEFAUT = "CARTE D'IDENTITÉ SCOLAIRE";
export const TEXTE_VERSO_PAR_DEFAUT =
  "Cette carte est strictement personnelle. Elle doit être présentée à toute demande du personnel de l'établissement. En cas de perte, prévenir aussitôt l'administration.";

export const REGLAGES_PAR_DEFAUT: ReglagesCarte = {
  ...FORMAT_STANDARD,
  couleur: null,
  titre: TITRE_PAR_DEFAUT,
  texteVerso: TEXTE_VERSO_PAR_DEFAUT,
  fond: 'motif',
};

/** Clé de `schools.settings` où l'école garde ses réglages de carte. */
export const CLE_CARTE_SCOLAIRE = 'carteScolaire';

export const LONGUEUR_MAX_TITRE = 40;
export const LONGUEUR_MAX_VERSO = 300;

/** Une dimension saisie → un nombre de mm dans les bornes (arrondi au dixième). */
export const borner = (v: unknown, defaut: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  if (!Number.isFinite(n)) return defaut;
  return Math.round(Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, n)) * 100) / 100;
};

/** Les réglages enregistrés dans `schools.settings`, corrigés s'ils sont abîmés ou absents. */
export const lireReglagesCarte = (settings: Record<string, unknown> | null | undefined): ReglagesCarte => {
  const brut = settings?.[CLE_CARTE_SCOLAIRE];
  if (!brut || typeof brut !== 'object') return { ...REGLAGES_PAR_DEFAUT };
  const r = brut as Record<string, unknown>;
  const texte = (v: unknown, defaut: string, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : defaut;
  return {
    largeur: borner(r.largeur, FORMAT_STANDARD.largeur),
    hauteur: borner(r.hauteur, FORMAT_STANDARD.hauteur),
    couleur: typeof r.couleur === 'string' && /^#[0-9a-f]{6}$/i.test(r.couleur) ? r.couleur.toUpperCase() : null,
    titre: texte(r.titre, TITRE_PAR_DEFAUT, LONGUEUR_MAX_TITRE),
    texteVerso: texte(r.texteVerso, TEXTE_VERSO_PAR_DEFAUT, LONGUEUR_MAX_VERSO),
    fond: r.fond === 'uni' ? 'uni' : 'motif',
  };
};

/** Plus haute que large : mise en page « badge ». */
export const estDebout = (r: Pick<ReglagesCarte, 'largeur' | 'hauteur'>): boolean => r.hauteur > r.largeur;

// ─── L'élève ────────────────────────────────────────────────────────────────

export interface EleveCarte {
  nom: string;
  prenom: string;
  matricule: string;
  classe?: string;
  /** ISO (2012-03-05) ou déjà écrite. */
  dateNaissance?: string;
  lieuNaissance?: string;
  sexe?: string;
  /** Photo en data URL ; null = cadre vide, pour y coller une photo d'identité. */
  photo: string | null;
  /** Personne à prévenir : le premier tuteur qui a un téléphone. */
  contactNom?: string;
  contactTelephone?: string;
}

/** Ce que SchoolContext sait d'un élève (sous-ensemble de `Student`). */
export interface EleveSourceCarte {
  studentId: string;
  firstName: string;
  lastName: string;
  sex?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  photoUrl?: string;
  tutor1?: { fullName?: string; phone?: string; status?: string };
  tutor2?: { fullName?: string; phone?: string; status?: string };
}

/** Le lien du tuteur avec l'élève (Gestion des élèves), quand son nom n'est pas connu. */
const LIENS_TUTEUR: Record<string, string> = { pere: 'Père', mere: 'Mère', oncle: 'Oncle', tante: 'Tante', autre: 'Tuteur' };

export const eleveCarte = (s: EleveSourceCarte, classe?: string): EleveCarte => {
  const tuteurs = [s.tutor1, s.tutor2].filter((t): t is NonNullable<typeof t> => !!t);
  const contact = tuteurs.find(t => t.phone?.trim()) ?? tuteurs.find(t => t.fullName?.trim());
  return {
    nom: s.lastName, prenom: s.firstName, matricule: s.studentId, classe,
    dateNaissance: s.dateOfBirth, lieuNaissance: s.placeOfBirth, sexe: s.sex,
    // Comme la fiche d'inscription : seule une image déjà dans l'application (jamais un lien distant).
    photo: s.photoUrl?.startsWith('data:image/') ? s.photoUrl : null,
    // L'inscription ne demande pas le nom du tuteur : « Père », « Mère »… à défaut.
    contactNom: contact?.fullName?.trim() || (contact?.status ? LIENS_TUTEUR[contact.status] : undefined) || undefined,
    contactTelephone: contact?.phone?.trim() || undefined,
  };
};

/** Un élève fictif, pour l'aperçu des réglages : toujours présenté comme un EXEMPLE. */
export const ELEVE_EXEMPLE: EleveCarte = {
  nom: 'DIOP', prenom: 'Awa', matricule: 'ETU-2026-00001', classe: '6ème A',
  dateNaissance: '2012-03-05', lieuNaissance: 'Dakar', sexe: 'femme', photo: null,
  contactNom: 'Moussa DIOP', contactTelephone: '77 000 00 00',
};

/** « 2012-03-05 » → « 05/03/2012 » ; une date déjà écrite à la main reste telle quelle. */
const dateCourte = (v?: string): string => {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v.trim();
};

/** « 05/03/2012 à Dakar », sans trou si l'un des deux manque. */
export const naissance = (e: EleveCarte): string =>
  [dateCourte(e.dateNaissance), e.lieuNaissance?.trim()].filter(Boolean).join(' à ');

// ─── Tracés ─────────────────────────────────────────────────────────────────

export type Style = 'normal' | 'bold' | 'italic';
export type Alignement = 'left' | 'center' | 'right';

export type Trace =
  | { type: 'rect'; x: number; y: number; l: number; h: number; fond?: string; trait?: string; epaisseur?: number; arrondi?: number; pointille?: boolean }
  | { type: 'ligne'; x1: number; y1: number; x2: number; y2: number; couleur: string; epaisseur: number }
  /** `y` : ligne de base de la première ligne ; `taille` en points ; `interligne` en mm. */
  | { type: 'texte'; x: number; y: number; lignes: string[]; taille: number; style: Style; couleur: string; align: Alignement; interligne: number }
  /** Ligne brisée (motif du fond), toujours à l'intérieur de la carte. */
  | { type: 'courbe'; points: [number, number][]; couleur: string; epaisseur: number }
  /** Photo de l'élève, déjà recadrée aux proportions du cadre. */
  | { type: 'photo'; x: number; y: number; l: number; h: number; src: string }
  /** Logo de l'école, à ses proportions ; sans logo, un monogramme aux initiales. */
  | { type: 'logo'; x: number; y: number; l: number; h: number; src: string | null; initiales: string; couleur: string };

/** Largeur d'un texte en mm, pour une taille en points (fournie par jsPDF). */
export type Mesure = (texte: string, taille: number, style: Style) => number;

/** 1 point = 0,3528 mm. */
export const PT_EN_MM = 25.4 / 72;

const ENCRE = '#1F2937';
const GRIS = '#6B7280';
const BLANC = '#FFFFFF';

/** Coupe un texte en lignes de `largeur` mm au plus, aux espaces ; un mot trop long seul est coupé net. */
const couper = (m: Mesure, texte: string, largeur: number, taille: number, style: Style): string[] => {
  const lignes: string[] = [];
  let courante = '';
  // Coupure aux espaces ordinaires seulement : l'espace insécable lie ses deux mots.
  for (const mot of texte.split(/[ \t\n\r]+/).filter(Boolean)) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (m(essai, taille, style) <= largeur) { courante = essai; continue; }
    if (courante) lignes.push(courante);
    courante = mot;
    while (m(courante, taille, style) > largeur && courante.length > 1) {
      let i = courante.length - 1;
      while (i > 1 && m(courante.slice(0, i), taille, style) > largeur) i--;
      lignes.push(courante.slice(0, i));
      courante = courante.slice(i);
    }
  }
  if (courante) lignes.push(courante);
  return lignes.length ? lignes : [''];
};

const avecPoints = (m: Mesure, ligne: string, largeur: number, taille: number, style: Style): string => {
  let t = ligne.trimEnd();
  while (t.length > 1 && m(`${t}…`, taille, style) > largeur) t = t.slice(0, -1).trimEnd();
  return `${t}…`;
};

/**
 * Fait tenir un texte dans `largeur` mm SANS JAMAIS EN PERDRE EN SILENCE :
 * rétrécir, puis passer à la ligne (jusqu'à `lignesMax`), et seulement en
 * dernier recours tronquer, avec « … » pour que ça se voie.
 */
export const ajuster = (
  m: Mesure, texte: string, largeur: number, taille: number, o: { min?: number; lignesMax?: number; style?: Style } = {},
): { lignes: string[]; taille: number } => {
  const a = ajusterBrut(m, texte, largeur, taille, o);
  // L'espace insécable a servi à ne pas couper : elle s'écrit comme une espace
  // ordinaire (la police du PDF la mesure mal, et décentrait le texte).
  return { ...a, lignes: a.lignes.map(l => l.replace(/\u00A0/g, ' ')) };
};

const ajusterBrut = (
  m: Mesure, texte: string, largeur: number, taille: number, o: { min?: number; lignesMax?: number; style?: Style },
): { lignes: string[]; taille: number } => {
  const style = o.style ?? 'normal';
  const min = o.min ?? taille * 0.75;
  const lignesMax = o.lignesMax ?? 1;
  // Une ligne d'abord, un peu réduite s'il le faut ; plusieurs lignes ensuite.
  for (let t = taille; t >= min - 1e-9; t -= 0.25) {
    if (m(texte, t, style) <= largeur) return { lignes: [texte], taille: t };
    if (lignesMax > 1 && t <= taille * 0.88) {
      const lignes = couper(m, texte, largeur, t, style);
      if (lignes.length <= lignesMax) return { lignes, taille: t };
    }
  }
  let lignes = couper(m, texte, largeur, min, style);
  if (lignes.length > lignesMax) {
    lignes = lignes.slice(0, lignesMax);
    lignes[lignesMax - 1] = avecPoints(m, lignes[lignesMax - 1], largeur, min, style);
  }
  return { lignes, taille: min };
};

// ─── Mise en page ───────────────────────────────────────────────────────────

export interface DonneesCarte {
  reglages: ReglagesCarte;
  eleve: EleveCarte;
  ecole: InfosEcole;
  anneeScolaire?: string;
  palette: Palette;
}

/** Proportions d'une photo d'identité : 35 × 45 mm. */
export const RATIO_PHOTO = 35 / 45;

/** Le crayon d'une face : il convertit les mesures du dessin de base vers la taille réelle. */
const crayon = (m: Mesure, largeur: number, hauteur: number, baseL: number, baseH: number) => {
  const sx = largeur / baseL;
  const sy = hauteur / baseH;
  const k = Math.min(sx, sy);
  const traces: Trace[] = [];
  const X = (v: number) => v * sx;
  const Y = (v: number) => v * sy;
  const F = (pt: number) => pt * k;
  /** Interligne d'un texte de `taille` points, en mm. */
  const IL = (taille: number) => taille * PT_EN_MM * 1.18;
  const texte = (
    t: string, x: number, y: number, largeurMax: number, taille: number,
    o: { min?: number; lignesMax?: number; style?: Style; couleur?: string; align?: Alignement } = {},
  ) => {
    if (!t.trim()) return { lignes: 0, taille };
    const a = ajuster(m, t, largeurMax, taille, o);
    traces.push({ type: 'texte', x, y, lignes: a.lignes, taille: a.taille, style: o.style ?? 'normal', couleur: o.couleur ?? ENCRE, align: o.align ?? 'left', interligne: IL(a.taille) });
    return { lignes: a.lignes.length, taille: a.taille };
  };
  return { traces, X, Y, F, k, IL, texte };
};

const majuscules = (t: string) => t.toLocaleUpperCase('fr');

/** Le cadre de la photo : la photo, ou un cadre vide « PHOTO » où coller une photo d'identité. */
const cadrePhoto = (traces: Trace[], d: DonneesCarte, x: number, y: number, l: number, h: number, F: (pt: number) => number) => {
  if (d.eleve.photo) {
    traces.push({ type: 'photo', x, y, l, h, src: d.eleve.photo });
    traces.push({ type: 'rect', x, y, l, h, trait: d.palette.trait, epaisseur: 0.2 });
    return;
  }
  traces.push({ type: 'rect', x, y, l, h, fond: d.palette.pale, trait: d.palette.trait, epaisseur: 0.25, pointille: true });
  traces.push({ type: 'texte', x: x + l / 2, y: y + h / 2 + F(5) * PT_EN_MM * 0.35, lignes: ['PHOTO'], taille: F(5), style: 'bold', couleur: GRIS, align: 'center', interligne: 0 });
};

/**
 * Le QR code du matricule, en carrés noirs vectoriels (net à toute taille),
 * sur fond blanc avec sa marge de silence : un téléphone le lit même sur une
 * carte imprimée en couleur. Les modules noirs d'une même ligne sont réunis.
 */
export const traceQr = (texte: string, x: number, y: number, cote: number): Trace[] => {
  const { modules } = QRCode.create(texte, { errorCorrectionLevel: 'M' });
  const marge = 1;
  const n = modules.size;
  const m = cote / (n + 2 * marge);
  const traces: Trace[] = [{ type: 'rect', x, y, l: cote, h: cote, fond: BLANC }];
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n;) {
      if (!modules.get(r, col)) { col++; continue; }
      const debut = col;
      while (col < n && modules.get(r, col)) col++;
      // Un soupçon de recouvrement : pas de fil blanc entre deux lignes à l'écran.
      traces.push({ type: 'rect', x: x + (marge + debut) * m, y: y + (marge + r) * m, l: (col - debut) * m + 0.04, h: m + 0.04, fond: '#000000' });
    }
  }
  return traces;
};

// ─── Fond de sécurité ───────────────────────────────────────────────────────

/** La couleur mélangée au blanc : `part` = 0 la couleur, 1 du blanc. */
export const eclaircir = (hex: string, part: number): string =>
  rgbVersHex(hexVersRgb(hex).map(v => v + (255 - v) * part) as [number, number, number]);

/**
 * Le fond des cartes officielles, SANS AUCUNE INFORMATION : de fines lignes
 * ondulées (guilloches) sur toute la carte et une rosace au centre, aux
 * couleurs de l'école et très pâles — le texte posé dessus reste lisible, et
 * la carte ne ressemble plus à une feuille imprimée. Tout reste dans la carte
 * (sur une feuille A4, rien ne déborde sur la carte voisine).
 */
/** Où poser la rosace : par défaut au centre de la carte (rayon 44 % du petit côté). */
export interface CentreRosace { cx: number; cy: number; r: number }

export const motifFond = (w: number, h: number, p: Palette, centre?: CentreRosace): Trace[] => {
  const traces: Trace[] = [];
  const k = Math.min(w, h) / FORMAT_STANDARD.hauteur;
  const pas = 0.8;
  // Guilloches : deux familles de vagues qui se croisent, comme sur un billet.
  const onde = eclaircir(p.trait, 0.45);
  const amplitude = 1.6 * k;
  const nombre = Math.max(8, Math.round(h / (2.4 * k)));
  for (const [famille, longueur] of [[0, 26], [1, 17]] as const) {
    for (let i = 0; i < nombre; i++) {
      const y0 = amplitude + ((h - 2 * amplitude) * (i + (famille ? 0.5 : 0))) / nombre;
      if (y0 > h - amplitude) continue;
      const points: [number, number][] = [];
      for (let x = 0; x <= w + 1e-9; x += pas) {
        const phase = (2 * Math.PI * x) / (longueur * k) + i * 0.55 + famille * Math.PI;
        points.push([Math.min(x, w), y0 + amplitude * Math.sin(phase)]);
      }
      traces.push({ type: 'courbe', points, couleur: onde, epaisseur: 0.08 });
    }
  }
  // Rosace (hypotrochoïde) au centre, en couleur d'accent très pâle.
  const rosace = eclaircir(p.accent, 0.82);
  const { cx, cy, r: R } = centre ?? { cx: w / 2, cy: h / 2, r: Math.min(w, h) * 0.44 };
  for (const echelle of [1, 0.72]) {
    const points: [number, number][] = [];
    const a = R * echelle;
    const b = a / 6.25;
    const d = a * 0.62;
    for (let t = 0; t <= 2 * Math.PI * 4 + 1e-9; t += 0.02) {
      const x = (a - b) * Math.cos(t) + d * Math.cos(((a - b) / b) * t);
      const y = (a - b) * Math.sin(t) - d * Math.sin(((a - b) / b) * t);
      // Ramenée dans le cercle de rayon `a` : jamais hors de la carte.
      const f = Math.min(1, a / (Math.hypot(x, y) || 1));
      points.push([cx + x * f, cy + y * f]);
    }
    traces.push({ type: 'courbe', points, couleur: rosace, epaisseur: 0.1 });
  }
  return traces;
};

/** Le fond d'une face : blanc, puis le motif si l'école l'a choisi. */
const fondFace = (traces: Trace[], d: DonneesCarte, centre?: CentreRosace) => {
  const { largeur: w, hauteur: h } = d.reglages;
  traces.push({ type: 'rect', x: 0, y: 0, l: w, h, fond: BLANC });
  if (d.reglages.fond === 'motif') traces.push(...motifFond(w, h, d.palette, centre));
};

/** Une rubrique : étiquette en petites capitales grises, valeur dessous. */
const rubrique = (
  c: ReturnType<typeof crayon>, etiquette: string, valeur: string, x: number, yEtiquette: number, yValeur: number,
  largeur: number, taille: number, couleur: string,
) => {
  c.texte(etiquette, x, yEtiquette, largeur, c.F(4.4), { style: 'bold', couleur: GRIS, min: c.F(3.6) });
  c.texte(valeur || '—', x, yValeur, largeur, taille, { style: 'bold', couleur, min: taille * 0.7 });
};

const BASE_COUCHEE = { l: FORMAT_STANDARD.largeur, h: FORMAT_STANDARD.hauteur };
const BASE_DEBOUT = { l: FORMAT_STANDARD.hauteur, h: FORMAT_STANDARD.largeur };

/** « Né le » / « Née le » selon le sexe. */
const etiquetteNaissance = (e: EleveCarte) => (e.sexe === 'femme' ? 'NÉE LE' : e.sexe === 'homme' ? 'NÉ LE' : 'NÉ(E) LE');

/** Espaces insécables : un numéro de téléphone ne se coupe jamais en fin de ligne. */
const insecable = (t: string) => t.replace(/ /g, '\u00A0');

const rectoCouchee = (m: Mesure, d: DonneesCarte): Trace[] => {
  const { largeur: w, hauteur: h } = d.reglages;
  const c = crayon(m, w, h, BASE_COUCHEE.l, BASE_COUCHEE.h);
  const { traces, X, Y, F, k } = c;
  const p = d.palette;
  fondFace(traces, d);

  // En-tête : logo, nom de l'école et ses coordonnées.
  const hautEntete = Y(13.6);
  const cote = Math.min(10.2 * k, hautEntete - Y(2.4));
  traces.push({ type: 'logo', x: X(3), y: (hautEntete - cote) / 2, l: cote, h: cote, src: d.ecole.logo ?? null, initiales: initialesEcole(d.ecole.nom), couleur: p.fonce });
  const xNom = X(3) + cote + X(2.2);
  const largeurNom = w - xNom - X(3);
  const nom = ajuster(m, majuscules(d.ecole.nom), largeurNom, F(8), { min: F(5.6), lignesMax: 2, style: 'bold' });
  const coord = [d.ecole.ville, d.ecole.telephone && `Tél. ${d.ecole.telephone}`].filter(Boolean).join(' · ');
  const tCoord = F(4.8);
  const hauteurBloc = nom.lignes.length * c.IL(nom.taille) + (coord ? c.IL(tCoord) : 0);
  let y = (hautEntete - hauteurBloc) / 2 + nom.taille * PT_EN_MM * 0.92;
  traces.push({ type: 'texte', x: xNom, y, lignes: nom.lignes, taille: nom.taille, style: 'bold', couleur: p.fonce, align: 'left', interligne: c.IL(nom.taille) });
  y += (nom.lignes.length - 1) * c.IL(nom.taille) + c.IL(tCoord) + 0.2 * k;
  if (coord) c.texte(coord, xNom, y, largeurNom, tCoord, { couleur: GRIS, min: F(3.8) });

  // Bandeau : titre de la carte et année scolaire.
  const yBande = hautEntete;
  const hBande = Y(5.6);
  traces.push({ type: 'rect', x: 0, y: yBande, l: w, h: hBande, fond: p.fonce });
  const base = yBande + hBande / 2 + F(6.4) * PT_EN_MM * 0.35;
  const annee = d.anneeScolaire ?? '';
  const largeurAnnee = annee ? m(annee, F(6), 'bold') + X(3) : 0;
  c.texte(majuscules(d.reglages.titre), X(3), base, w - X(6) - largeurAnnee, F(6.4), { style: 'bold', couleur: BLANC, min: F(4.6) });
  if (annee) traces.push({ type: 'texte', x: w - X(3), y: base, lignes: [annee], taille: F(6), style: 'bold', couleur: BLANC, align: 'right', interligne: 0 });

  // Photo à gauche, aux proportions d'une photo d'identité.
  const yCorps = yBande + hBande + Y(2.6);
  const hPhoto = Math.min(Y(51.4) - yCorps, (w * 0.3) / RATIO_PHOTO);
  const lPhoto = hPhoto * RATIO_PHOTO;
  cadrePhoto(traces, d, X(3.4), yCorps, lPhoto, hPhoto, F);

  // Identité à droite.
  const e = d.eleve;
  const x0 = X(3.4) + lPhoto + X(3.4);
  const larg = w - x0 - X(3);
  const pas = (Y(51) - yCorps) / 4;
  const ligne = (i: number) => ({ et: yCorps + i * pas + F(4.4) * PT_EN_MM * 0.75, val: yCorps + i * pas + pas * 0.72 });
  rubrique(c, 'NOM', majuscules(e.nom), x0, ligne(0).et, ligne(0).val, larg, F(9.4), p.fonce);
  rubrique(c, 'PRÉNOM(S)', e.prenom, x0, ligne(1).et, ligne(1).val, larg, F(8), ENCRE);
  // QR code en bas à droite ; la naissance, la classe et le matricule se serrent à sa gauche.
  const coteQr = Math.min(Y(51.4) - ligne(2).et + F(4.4) * PT_EN_MM * 0.75, 16 * k);
  traces.push(...traceQr(e.matricule, w - X(2.4) - coteQr, Y(51.4) - coteQr, coteQr));
  const largBas = larg - coteQr - X(1.4);
  rubrique(c, etiquetteNaissance(e), naissance(e), x0, ligne(2).et, ligne(2).val, largBas, F(6.6), ENCRE);
  const demi = (largBas - X(2)) / 2;
  rubrique(c, 'CLASSE', e.classe ?? '', x0, ligne(3).et, ligne(3).val, demi, F(7.2), p.fonce);
  rubrique(c, 'MATRICULE', e.matricule, x0 + demi + X(2), ligne(3).et, ligne(3).val, demi, F(6.6), ENCRE);

  // Liseré d'accent en bas.
  traces.push({ type: 'rect', x: 0, y: h - Y(1.6), l: w, h: Y(1.6), fond: p.accent });
  return traces;
};

const rectoDebout = (m: Mesure, d: DonneesCarte): Trace[] => {
  const { largeur: w, hauteur: h } = d.reglages;
  const c = crayon(m, w, h, BASE_DEBOUT.l, BASE_DEBOUT.h);
  const { traces, X, Y, F, k } = c;
  const p = d.palette;
  const e = d.eleve;
  fondFace(traces, d);

  const cote = 11 * k;
  traces.push({ type: 'logo', x: (w - cote) / 2, y: Y(2.6), l: cote, h: cote, src: d.ecole.logo ?? null, initiales: initialesEcole(d.ecole.nom), couleur: p.fonce });
  const nom = ajuster(m, majuscules(d.ecole.nom), w - X(6), F(7.4), { min: F(5.2), lignesMax: 2, style: 'bold' });
  const yNom = Y(2.6) + cote + Y(3.4);
  traces.push({ type: 'texte', x: w / 2, y: yNom, lignes: nom.lignes, taille: nom.taille, style: 'bold', couleur: p.fonce, align: 'center', interligne: c.IL(nom.taille) });

  const yBande = Y(23.6);
  const hBande = Y(5.6);
  traces.push({ type: 'rect', x: 0, y: yBande, l: w, h: hBande, fond: p.fonce });
  c.texte(majuscules(d.reglages.titre), w / 2, yBande + hBande / 2 + F(6) * PT_EN_MM * 0.35, w - X(5), F(6), { style: 'bold', couleur: BLANC, min: F(4.2), align: 'center' });

  const yPhoto = yBande + hBande + Y(2.6);
  const hPhoto = Y(28);
  const lPhoto = hPhoto * RATIO_PHOTO;
  cadrePhoto(traces, d, (w - lPhoto) / 2, yPhoto, lPhoto, hPhoto, F);
  // QR code à droite de la photo, aligné sur son bas.
  const coteQr = Math.min(13 * k, (w - lPhoto) / 2 - X(2.4));
  traces.push(...traceQr(e.matricule, w - X(1.6) - coteQr, yPhoto + hPhoto - coteQr, coteQr));

  const larg = w - X(5);
  let y = yPhoto + hPhoto + Y(4.6);
  c.texte(majuscules(e.nom), w / 2, y, larg, F(9.4), { style: 'bold', couleur: p.fonce, align: 'center', min: F(6.4) });
  y += Y(4.2);
  c.texte(e.prenom, w / 2, y, larg, F(8), { style: 'bold', align: 'center', min: F(5.6) });
  y += Y(4.4);
  c.texte([e.classe && `Classe : ${e.classe}`, `Matricule : ${e.matricule}`].filter(Boolean).join('  ·  '), w / 2, y, larg, F(5.8), { style: 'bold', align: 'center', min: F(4.2) });
  const nais = naissance(e);
  if (nais) c.texte(`${etiquetteNaissance(e) === 'NÉE LE' ? 'Née' : etiquetteNaissance(e) === 'NÉ LE' ? 'Né' : 'Né(e)'} le ${nais}`, w / 2, y + Y(3.6), larg, F(5.4), { couleur: GRIS, align: 'center', min: F(4) });

  const hPied = Y(5.4);
  traces.push({ type: 'rect', x: 0, y: h - hPied, l: w, h: hPied, fond: p.fonce });
  if (d.anneeScolaire) {
    c.texte(`Année scolaire ${d.anneeScolaire}`, w / 2, h - hPied / 2 + F(5.8) * PT_EN_MM * 0.35, larg, F(5.8), { style: 'bold', couleur: BLANC, align: 'center' });
  }
  return traces;
};

/** Le logo de l'école sur un disque blanc : lisible sur le fond de couleur du verso. */
const logoSurDisque = (traces: Trace[], d: DonneesCarte, cx: number, y: number, diametre: number, k: number) => {
  traces.push({ type: 'rect', x: cx - diametre / 2, y, l: diametre, h: diametre, fond: BLANC, arrondi: diametre / 2 });
  const marge = 1.6 * k;
  traces.push({
    type: 'logo', x: cx - diametre / 2 + marge, y: y + marge, l: diametre - 2 * marge, h: diametre - 2 * marge,
    src: d.ecole.logo ?? null, initiales: initialesEcole(d.ecole.nom), couleur: d.palette.fonce,
  });
};

/** La pastille « en cas d'urgence » : fond pâle, nom du parent, téléphone en grand. */
const pastilleUrgence = (
  c: ReturnType<typeof crayon>, d: DonneesCarte, x: number, y: number, l: number, h: number, align: Alignement,
) => {
  const { traces, F, k } = c;
  const p = d.palette;
  const e = d.eleve;
  traces.push({ type: 'rect', x, y, l, h, fond: p.pale, arrondi: 1.6 * k });
  traces.push({ type: 'rect', x, y: y + 1.6 * k, l: 0.9 * k, h: h - 3.2 * k, fond: p.accent });
  const xt = align === 'center' ? x + l / 2 : x + 3.4 * k;
  const larg = l - 5 * k;
  c.texte("EN CAS D'URGENCE, PRÉVENIR", xt, y + h * 0.27, larg, F(4.5), { style: 'bold', couleur: p.accent, align, min: F(3.6) });
  c.texte(e.contactNom || '—', xt, y + h * 0.53, larg, F(6.6), { style: 'bold', align, min: F(4.8) });
  if (e.contactTelephone) {
    c.texte(`Tél. ${insecable(e.contactTelephone)}`, xt, y + h * 0.84, larg, F(9.2), { style: 'bold', couleur: p.fonce, align, min: F(6.4) });
  }
};

/** Signature : « Le Directeur », un trait où signer, son nom dessous ; à côté, le rond du cachet. */
const signatureEtCachet = (c: ReturnType<typeof crayon>, d: DonneesCarte, x: number, xFin: number, yTrait: number, diametre: number) => {
  const { traces, F, k } = c;
  const p = d.palette;
  const xCachet = xFin - diametre;
  const finTrait = xCachet - 3 * k;
  c.texte('LE DIRECTEUR', x, yTrait - 6.2 * k, finTrait - x, F(4.4), { style: 'bold', couleur: GRIS, min: F(3.6) });
  traces.push({ type: 'ligne', x1: x, y1: yTrait, x2: finTrait, y2: yTrait, couleur: GRIS, epaisseur: 0.2 });
  if (d.ecole.directeurGeneral) {
    c.texte(d.ecole.directeurGeneral, x, yTrait + F(5) * PT_EN_MM * 1.25, finTrait - x, F(5), { style: 'bold', min: F(3.8) });
  }
  const yCachet = yTrait - diametre * 0.62;
  traces.push({ type: 'rect', x: xCachet, y: yCachet, l: diametre, h: diametre, trait: p.trait, epaisseur: 0.25, arrondi: diametre / 2, pointille: true });
  c.texte('CACHET', xCachet + diametre / 2, yCachet + diametre / 2 + F(3.8) * PT_EN_MM * 0.35, diametre, F(3.8), { style: 'bold', couleur: p.trait, align: 'center' });
};

/** Le texte « carte trouvée », sur le fond de couleur. */
const TEXTE_TROUVEE = "Carte trouvée ? Merci de la rapporter à l'établissement.";

const versoCouchee = (m: Mesure, d: DonneesCarte): Trace[] => {
  const { largeur: w, hauteur: h } = d.reglages;
  const c = crayon(m, w, h, BASE_COUCHEE.l, BASE_COUCHEE.h);
  const { traces, X, Y, F, k } = c;
  const p = d.palette;
  // La rosace au milieu de la partie blanche (à droite de la colonne de couleur).
  fondFace(traces, d, { cx: (X(28) + w) / 2, cy: h / 2, r: Math.min(w - X(28), h) * 0.44 });

  // Colonne de couleur : l'identité de l'école, comme le bandeau du recto.
  const lc = X(28);
  traces.push({ type: 'rect', x: 0, y: 0, l: lc, h, fond: p.fonce });
  traces.push({ type: 'rect', x: lc, y: 0, l: X(0.9), h, fond: p.accent });
  const disque = Math.min(14 * k, lc - X(8));
  logoSurDisque(traces, d, lc / 2, Y(4.4), disque, k);
  const nom = ajuster(m, majuscules(d.ecole.nom), lc - X(4), F(6), { min: F(4.2), lignesMax: 3, style: 'bold' });
  let y = Y(4.4) + disque + Y(3.4) + nom.taille * PT_EN_MM * 0.75;
  traces.push({ type: 'texte', x: lc / 2, y, lignes: nom.lignes, taille: nom.taille, style: 'bold', couleur: BLANC, align: 'center', interligne: c.IL(nom.taille) });
  y += (nom.lignes.length - 1) * c.IL(nom.taille) + Y(3.4);
  if (d.ecole.telephone) c.texte(`Tél. ${insecable(d.ecole.telephone)}`, lc / 2, y, lc - X(4), F(5), { couleur: BLANC, align: 'center', min: F(3.8) });
  const trouvee = ajuster(m, TEXTE_TROUVEE, lc - X(5), F(4.2), { min: F(3.4), lignesMax: 3, style: 'italic' });
  traces.push({
    type: 'texte', x: lc / 2, y: h - Y(4) - (trouvee.lignes.length - 1) * c.IL(trouvee.taille), lignes: trouvee.lignes,
    taille: trouvee.taille, style: 'italic', couleur: p.trait, align: 'center', interligne: c.IL(trouvee.taille),
  });

  // À droite : la personne à prévenir, les règles, la signature.
  const xr = lc + X(4.4);
  const fin = w - X(3.4);
  pastilleUrgence(c, d, xr, Y(4.4), fin - xr, Y(17.6), 'left');
  c.texte(d.reglages.texteVerso, xr, Y(27.4), fin - xr, F(4.9), { lignesMax: 4, min: F(4), couleur: '#4B5563' });
  signatureEtCachet(c, d, xr, fin, Y(47.6), 13 * k);
  return traces;
};

const versoDebout = (m: Mesure, d: DonneesCarte): Trace[] => {
  const { largeur: w, hauteur: h } = d.reglages;
  const c = crayon(m, w, h, BASE_DEBOUT.l, BASE_DEBOUT.h);
  const { traces, X, Y, F, k } = c;
  const p = d.palette;
  // La rosace au milieu de la partie blanche (entre l'en-tête et le pied).
  fondFace(traces, d, { cx: w / 2, cy: (Y(26) + h - Y(6)) / 2, r: Math.min(w, h - Y(32)) * 0.44 });

  // En-tête de couleur : logo sur son disque et nom de l'école.
  const hEntete = Y(25);
  traces.push({ type: 'rect', x: 0, y: 0, l: w, h: hEntete, fond: p.fonce });
  traces.push({ type: 'rect', x: 0, y: hEntete, l: w, h: Y(1), fond: p.accent });
  const disque = 12 * k;
  logoSurDisque(traces, d, w / 2, Y(3), disque, k);
  const nom = ajuster(m, majuscules(d.ecole.nom), w - X(6), F(6), { min: F(4.2), lignesMax: 2, style: 'bold' });
  traces.push({
    type: 'texte', x: w / 2, y: Y(3) + disque + Y(3.6), lignes: nom.lignes, taille: nom.taille, style: 'bold',
    couleur: BLANC, align: 'center', interligne: c.IL(nom.taille),
  });

  pastilleUrgence(c, d, X(3.6), Y(30), w - X(7.2), Y(17.4), 'center');
  c.texte(d.reglages.texteVerso, w / 2, Y(55.6), w - X(8), F(4.9), { lignesMax: 5, min: F(4), couleur: '#4B5563', align: 'center' });
  signatureEtCachet(c, d, X(4.4), w - X(4.4), Y(74.6), 12 * k);

  // Pied de couleur : que faire de la carte trouvée.
  const hPied = Y(6);
  traces.push({ type: 'rect', x: 0, y: h - hPied, l: w, h: hPied, fond: p.fonce });
  const pied = d.ecole.telephone ? `Carte trouvée ? Appelez le ${insecable(d.ecole.telephone)}` : TEXTE_TROUVEE;
  c.texte(pied, w / 2, h - hPied / 2 + F(4.4) * PT_EN_MM * 0.35, w - X(5), F(4.4), { style: 'italic', couleur: BLANC, align: 'center', min: F(3.4) });
  return traces;
};

export type Face = 'recto' | 'verso';

/** Les tracés d'une face, en mm depuis le coin haut gauche de la carte. */
export const dessinerFace = (face: Face, m: Mesure, d: DonneesCarte): Trace[] => {
  const debout = estDebout(d.reglages);
  if (face === 'recto') return debout ? rectoDebout(m, d) : rectoCouchee(m, d);
  return debout ? versoDebout(m, d) : versoCouchee(m, d);
};

// ─── Feuille A4 à découper ──────────────────────────────────────────────────

export const A4 = { largeur: 210, hauteur: 297 } as const;
/** Marge minimale de la feuille : la plupart des imprimantes de bureau n'impriment pas plus près du bord. */
export const MARGE_FEUILLE = 8;

export interface Planche {
  colonnes: number;
  rangees: number;
  /** Coin haut gauche de la première carte : la grille est centrée sur la feuille. */
  x0: number;
  y0: number;
}

/** Combien de cartes tiennent sur une feuille A4 portrait, collées (un seul trait de coupe entre deux cartes). */
export const planche = (r: Pick<ReglagesCarte, 'largeur' | 'hauteur'>): Planche => {
  const utileL = A4.largeur - 2 * MARGE_FEUILLE;
  const utileH = A4.hauteur - 2 * MARGE_FEUILLE;
  const colonnes = Math.max(1, Math.floor(utileL / r.largeur + 1e-9));
  const rangees = Math.max(1, Math.floor(utileH / r.hauteur + 1e-9));
  return {
    colonnes, rangees,
    x0: (A4.largeur - colonnes * r.largeur) / 2,
    y0: (A4.hauteur - rangees * r.hauteur) / 2,
  };
};

/**
 * Position de la i-ème carte d'une feuille. Au verso, les colonnes sont en
 * miroir : la feuille se retourne sur son grand côté, et le dos de chaque
 * carte doit tomber derrière son recto.
 */
export const positionSurPlanche = (pl: Planche, r: Pick<ReglagesCarte, 'largeur' | 'hauteur'>, i: number, face: Face): { x: number; y: number } => {
  const rangee = Math.floor(i / pl.colonnes);
  const col = i % pl.colonnes;
  const colonne = face === 'verso' ? pl.colonnes - 1 - col : col;
  return { x: pl.x0 + colonne * r.largeur, y: pl.y0 + rangee * r.hauteur };
};
