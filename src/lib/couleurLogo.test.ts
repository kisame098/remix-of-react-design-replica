import { describe, it, expect } from 'vitest';
import {
  COULEUR_PAR_DEFAUT, contraste, couleurDominanteDuLogo, dominanteDepuisPixels, hexVersRgb,
  hslVersRgb, luminance, paletteDepuis, rgbVersHex, rgbVersHsl, type Rgb,
} from './couleurLogo';

// ════════════════════════════════════════════════════════════════════════════
// Le bandeau d'un reçu prend la couleur du logo de l'école. Deux échecs se voient
// tout de suite sur un document officiel : un bandeau trop clair pour y lire du
// blanc, ou une teinte qui n'a rien à voir avec le logo.
// ════════════════════════════════════════════════════════════════════════════

/** Fabrique un tableau RGBA à partir de « blocs » de pixels identiques. */
const pixels = (...blocs: [Rgb, number, number?][]): number[] =>
  blocs.flatMap(([[r, g, b], n, a = 255]) => Array.from({ length: n }, () => [r, g, b, a]).flat());

describe('conversions', () => {
  it('hex ↔ rgb', () => {
    expect(hexVersRgb('#1F3A5F')).toEqual([31, 58, 95]);
    expect(hexVersRgb('1f3a5f')).toEqual([31, 58, 95]);
    expect(rgbVersHex([31, 58, 95])).toBe('#1F3A5F');
  });

  it('une valeur illisible retombe sur la couleur par défaut, sans lever', () => {
    expect(hexVersRgb('n\'importe quoi')).toEqual(hexVersRgb(COULEUR_PAR_DEFAUT));
  });

  it('rgb → hsl → rgb revient au même', () => {
    for (const c of [[200, 40, 40], [30, 120, 200], [20, 160, 90], [240, 200, 20]] as Rgb[]) {
      const retour = hslVersRgb(rgbVersHsl(c));
      c.forEach((v, i) => expect(Math.abs(retour[i] - v)).toBeLessThan(1.5));
    }
  });

  it('un gris n\'a pas de saturation', () => {
    expect(rgbVersHsl([128, 128, 128]).s).toBe(0);
  });
});

describe('dominanteDepuisPixels', () => {
  it('un logo bleu sur fond blanc : le bleu', () => {
    const c = dominanteDepuisPixels(pixels([[255, 255, 255], 800], [[30, 90, 180], 200]))!;
    const { h } = rgbVersHsl(hexVersRgb(c));
    expect(h).toBeGreaterThan(200); expect(h).toBeLessThan(230);
  });

  it('un logo vert : le vert', () => {
    const { h } = rgbVersHsl(hexVersRgb(dominanteDepuisPixels(pixels([[20, 150, 80], 300]))!));
    expect(h).toBeGreaterThan(130); expect(h).toBeLessThan(160);
  });

  it('le transparent est ignoré : un logo PNG à fond transparent', () => {
    const c = dominanteDepuisPixels(pixels([[255, 0, 0], 900, 0], [[30, 90, 180], 100]))!;
    expect(rgbVersHsl(hexVersRgb(c)).h).toBeGreaterThan(200);
  });

  it('un grand aplat GRIS ne l\'emporte pas sur un emblème coloré plus petit', () => {
    const c = dominanteDepuisPixels(pixels([[120, 120, 120], 700], [[200, 40, 40], 100]))!;
    const { h, s } = rgbVersHsl(hexVersRgb(c));
    expect(s).toBeGreaterThan(0.5);
    expect(h < 15 || h > 345).toBe(true);
  });

  it('deux couleurs : celle qui pèse le plus l\'emporte', () => {
    const c = dominanteDepuisPixels(pixels([[30, 90, 180], 600], [[230, 165, 30], 200]))!;
    expect(rgbVersHsl(hexVersRgb(c)).h).toBeGreaterThan(200);
  });

  it('logo en niveaux de gris : son anthracite, pas rien', () => {
    const c = dominanteDepuisPixels(pixels([[40, 40, 40], 400], [[255, 255, 255], 600]));
    expect(c).not.toBeNull();
    expect(rgbVersHsl(hexVersRgb(c!)).s).toBe(0);
  });

  it('blanc pur, ou entièrement transparent : aucune couleur exploitable', () => {
    expect(dominanteDepuisPixels(pixels([[255, 255, 255], 500]))).toBeNull();
    expect(dominanteDepuisPixels(pixels([[10, 10, 10], 500, 0]))).toBeNull();
    expect(dominanteDepuisPixels([])).toBeNull();
  });
});

describe('paletteDepuis', () => {
  it.each([
    ['bleu nuit', '#1F3A5F'], ['jaune vif', '#FFD400'], ['rose pâle', '#F8C8DC'],
    ['vert', '#1E9E5A'], ['rouge', '#D62828'], ['presque noir', '#111111'], ['presque blanc', '#F5F5F5'],
  ])('%s : le bandeau reste assez sombre pour y lire du blanc', (_nom, couleur) => {
    const p = paletteDepuis(couleur);
    expect(contraste(p.fonce, '#FFFFFF'), p.fonce).toBeGreaterThanOrEqual(7);   // AAA
  });

  it('l\'accent se lit sur fond blanc', () => {
    for (const c of ['#FFD400', '#F8C8DC', '#1E9E5A', '#1F3A5F']) {
      expect(contraste(paletteDepuis(c).accent, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);   // AA texte
    }
  });

  it('le fond pâle est presque blanc : le texte foncé y reste lisible', () => {
    for (const c of ['#FFD400', '#1F3A5F', '#D62828']) {
      expect(luminance(paletteDepuis(c).pale)).toBeGreaterThan(0.85);
    }
  });

  it('toute la palette garde la teinte du logo', () => {
    const teinte = (hex: string) => rgbVersHsl(hexVersRgb(hex)).h;
    const p = paletteDepuis('#1E9E5A');
    for (const ton of [p.fonce, p.accent]) expect(Math.abs(teinte(ton) - teinte('#1E9E5A'))).toBeLessThan(6);
  });

  it('un gris reste gris : aucune teinte inventée', () => {
    const p = paletteDepuis('#808080');
    for (const ton of Object.values(p)) expect(rgbVersHsl(hexVersRgb(ton)).s).toBeLessThan(0.05);
  });

  it('sans couleur : la palette SenClass par défaut', () => {
    expect(paletteDepuis(null)).toEqual(paletteDepuis(COULEUR_PAR_DEFAUT));
    expect(paletteDepuis(undefined)).toEqual(paletteDepuis(COULEUR_PAR_DEFAUT));
  });
});

describe('couleurDominanteDuLogo', () => {
  it('ne lève jamais : logo absent, illisible ou environnement sans canvas → null', async () => {
    await expect(couleurDominanteDuLogo(null)).resolves.toBeNull();
    await expect(couleurDominanteDuLogo('data:image/png;base64,PAS-UNE-IMAGE')).resolves.toBeNull();
  });
});

describe('contraste', () => {
  it('noir sur blanc = 21', () => expect(Math.round(contraste('#000000', '#FFFFFF'))).toBe(21));
  it('symétrique', () => expect(contraste('#123456', '#FFFFFF')).toBeCloseTo(contraste('#FFFFFF', '#123456')));
});
