// ═══════════════════════════════════════════════════════════════════════════
// COULEUR D'ÉCOLE — la teinte d'un document se déduit du logo de l'école.
//
// Un reçu au logo bleu ciel avec un bandeau vert n'a pas l'air de venir de la
// même maison. On lit donc la couleur dominante du logo et on en dérive toute
// la palette du document (bandeau foncé, accent, fond pâle).
//
// Les fonctions pures (pixels → couleur, palette) se testent sans navigateur ;
// seule la lecture de l'image passe par un canvas, et retombe sur la couleur par
// défaut si elle échoue (logo illisible, environnement sans canvas).
// ═══════════════════════════════════════════════════════════════════════════

/** Le bleu nuit historique de SenClass, quand l'école n'a pas de logo exploitable. */
export const COULEUR_PAR_DEFAUT = '#1F3A5F';

export type Rgb = [number, number, number];
export interface Hsl { h: number; s: number; l: number }

export const hexVersRgb = (hex: string): Rgb => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hexVersRgb(COULEUR_PAR_DEFAUT);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgbVersHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

export const rgbVersHsl = ([r, g, b]: Rgb): Hsl => {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: ((h * 60) + 360) % 360, s, l };
};

export const hslVersRgb = ({ h, s, l }: Hsl): Rgb => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};

/**
 * La couleur qui « signe » un logo : la teinte saturée la plus présente.
 *
 * On ignore le transparent et le presque-blanc (fond) ; on regroupe les pixels
 * par teinte (12 familles de 30°) en pondérant par leur saturation, pour qu'un
 * grand aplat gris ne l'emporte pas sur un emblème bleu plus petit mais franc.
 * Renvoie `null` si le logo n'a aucune couleur exploitable (noir et blanc pur).
 */
export const dominanteDepuisPixels = (rgba: ArrayLike<number>): string | null => {
  const familles = Array.from({ length: 12 }, () => ({ poids: 0, r: 0, g: 0, b: 0 }));
  let sombres = { n: 0, r: 0, g: 0, b: 0 };

  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const [r, g, b, a] = [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
    if (a < 128) continue;                                   // transparent
    const { h, s, l } = rgbVersHsl([r, g, b]);
    if (l > 0.93) continue;                                  // fond blanc
    if (s < 0.22 || l < 0.08) {                              // gris ou noir : mémorisé à part
      if (l < 0.6) { sombres = { n: sombres.n + 1, r: sombres.r + r, g: sombres.g + g, b: sombres.b + b }; }
      continue;
    }
    const f = familles[Math.floor(h / 30) % 12];
    const poids = s * (1 - Math.abs(2 * l - 1) * 0.5);       // le très clair ou très foncé pèse moins
    f.poids += poids; f.r += r * poids; f.g += g * poids; f.b += b * poids;
  }

  const meilleure = familles.reduce((m, f) => (f.poids > m.poids ? f : m), familles[0]);
  if (meilleure.poids > 0) {
    return rgbVersHex([meilleure.r / meilleure.poids, meilleure.g / meilleure.poids, meilleure.b / meilleure.poids]);
  }
  // Logo en niveaux de gris : son noir/anthracite fait un très bon bandeau.
  return sombres.n > 0 ? rgbVersHex([sombres.r / sombres.n, sombres.g / sombres.n, sombres.b / sombres.n]) : null;
};

export interface Palette {
  /** Bandeau, gros titres, total — sombre : le blanc y reste lisible. */
  fonce: string;
  /** Filets, étiquettes, barre d'accent. */
  accent: string;
  /** Fonds de panneaux, très pâle. */
  pale: string;
  /** Traits fins et séparateurs, tirés de la teinte. */
  trait: string;
}

/**
 * Toute la palette du document à partir d'UNE couleur. La luminosité est
 * imposée à chaque rôle : un logo jaune pâle donne quand même un bandeau assez
 * sombre pour y lire du blanc, et un logo presque noir un accent assez clair pour
 * se distinguer.
 */
export const paletteDepuis = (hex: string | null | undefined): Palette => {
  const base = rgbVersHsl(hexVersRgb(hex ?? COULEUR_PAR_DEFAUT));
  // Un gris n'a pas de teinte : on lui garde une saturation nulle plutôt que d'en inventer.
  const s = base.s < 0.08 ? 0 : Math.min(base.s, 0.85);
  const ton = (l: number, sat = s): string => rgbVersHex(hslVersRgb({ h: base.h, s: sat, l }));

  // Un jaune et un bleu de MÊME luminosité HSL n'ont pas le même contraste avec
  // le blanc : on descend la luminosité jusqu'à atteindre le contraste voulu.
  const assez = (lDepart: number, minimum: number, sat = s): string => {
    let l = lDepart;
    while (l > 0.08 && contraste(ton(l, sat), '#FFFFFF') < minimum) l -= 0.01;
    return ton(l, sat);
  };

  return {
    fonce: assez(0.21, 9, Math.max(s, s === 0 ? 0 : 0.35)),
    accent: assez(0.4, 5),
    pale: ton(0.96, Math.min(s, 0.45)),
    trait: ton(0.82, Math.min(s, 0.35)),
  };
};

/** Luminance relative (WCAG) : sert à choisir un texte lisible sur une couleur. */
export const luminance = (hex: string): number => {
  const [r, g, b] = hexVersRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export const contraste = (a: string, b: string): number => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const COTE_ANALYSE = 48;

/**
 * Lit la couleur dominante d'un logo (data URL). Ne lève jamais : `null` si
 * l'image est illisible ou si l'environnement n'a pas de canvas.
 */
export const couleurDominanteDuLogo = async (logo: string | null | undefined): Promise<string | null> => {
  if (!logo || typeof document === 'undefined') return null;
  try {
    const img = new Image();
    img.src = logo;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = COTE_ANALYSE; canvas.height = COTE_ANALYSE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, COTE_ANALYSE, COTE_ANALYSE);
    return dominanteDepuisPixels(ctx.getImageData(0, 0, COTE_ANALYSE, COTE_ANALYSE).data);
  } catch {
    return null;
  }
};
