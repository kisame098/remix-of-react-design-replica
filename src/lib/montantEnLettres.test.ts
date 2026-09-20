import { describe, it, expect } from 'vitest';
import { nombreEnLettres, montantEnLettres, formaterMontant } from './montantEnLettres';

// ════════════════════════════════════════════════════════════════════════════
// Le montant en lettres est ce qui empêche de transformer 25 000 en 125 000 d'un
// coup de stylo. Une faute d'orthographe ou, pire, un mauvais nombre l'annule.
// Chaque cas ci-dessous est une règle du français qui a déjà fait échouer des
// convertisseurs naïfs.
// ════════════════════════════════════════════════════════════════════════════

describe('nombreEnLettres — les cas de base', () => {
  it.each([
    [0, 'zéro'], [1, 'un'], [2, 'deux'], [10, 'dix'], [11, 'onze'], [16, 'seize'],
    [17, 'dix-sept'], [19, 'dix-neuf'], [20, 'vingt'],
  ])('%i → %s', (n, attendu) => expect(nombreEnLettres(n)).toBe(attendu));
});

describe('nombreEnLettres — « et un » et les traits d\'union', () => {
  it.each([
    [21, 'vingt et un'], [22, 'vingt-deux'], [31, 'trente et un'], [41, 'quarante et un'],
    [51, 'cinquante et un'], [61, 'soixante et un'], [69, 'soixante-neuf'],
  ])('%i → %s', (n, attendu) => expect(nombreEnLettres(n)).toBe(attendu));
});

describe('nombreEnLettres — soixante-dix, quatre-vingt, quatre-vingt-dix', () => {
  it.each([
    [70, 'soixante-dix'], [71, 'soixante et onze'], [72, 'soixante-douze'], [77, 'soixante-dix-sept'],
    [79, 'soixante-dix-neuf'],
    [80, 'quatre-vingts'], [81, 'quatre-vingt-un'], [85, 'quatre-vingt-cinq'],
    [90, 'quatre-vingt-dix'], [91, 'quatre-vingt-onze'], [99, 'quatre-vingt-dix-neuf'],
  ])('%i → %s', (n, attendu) => expect(nombreEnLettres(n)).toBe(attendu));

  it('81 n\'a pas de « et » (contrairement à 21 et 71)', () => {
    expect(nombreEnLettres(81)).not.toContain(' et ');
  });
});

describe('nombreEnLettres — cent : le s tombe quand quelque chose suit', () => {
  it.each([
    [100, 'cent'], [101, 'cent un'], [180, 'cent quatre-vingts'], [199, 'cent quatre-vingt-dix-neuf'],
    [200, 'deux cents'], [201, 'deux cent un'], [280, 'deux cent quatre-vingts'], [900, 'neuf cents'],
    [999, 'neuf cent quatre-vingt-dix-neuf'],
  ])('%i → %s', (n, attendu) => expect(nombreEnLettres(n)).toBe(attendu));
});

describe('nombreEnLettres — mille est invariable et ne prend pas « un »', () => {
  it.each([
    [1000, 'mille'], [1001, 'mille un'], [1100, 'mille cent'], [1200, 'mille deux cents'],
    [2000, 'deux mille'], [21000, 'vingt et un mille'], [25000, 'vingt-cinq mille'],
    [80000, 'quatre-vingt mille'],                 // vingt/cent ne prennent pas de s devant mille
    [100000, 'cent mille'], [200000, 'deux cent mille'], [250000, 'deux cent cinquante mille'],
    [999999, 'neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf'],
  ])('%i → %s', (n, attendu) => expect(nombreEnLettres(n)).toBe(attendu));

  it('jamais « un mille »', () => {
    for (const n of [1000, 1500, 1234, 1000000, 1001000]) expect(nombreEnLettres(n)).not.toMatch(/\bun mille\b/);
  });
});

describe('nombreEnLettres — millions et milliards', () => {
  it.each([
    [1_000_000, 'un million'], [2_000_000, 'deux millions'], [1_500_000, 'un million cinq cent mille'],
    [80_000_000, 'quatre-vingts millions'],       // million est un nom : le s reste
    [200_000_000, 'deux cents millions'],
    [1_000_001, 'un million un'],
    [1_000_000_000, 'un milliard'], [2_500_000_000, 'deux milliards cinq cents millions'],
  ])('%i → %s', (n, attendu) => expect(nombreEnLettres(n)).toBe(attendu));
});

describe('nombreEnLettres — entrées limites', () => {
  it('ignore le signe et les décimales', () => {
    expect(nombreEnLettres(-25)).toBe('vingt-cinq');
    expect(nombreEnLettres(25.9)).toBe('vingt-cinq');
  });
  it('refuse ce qui dépasse ce qu\'il sait écrire, plutôt que d\'inventer', () => {
    expect(() => nombreEnLettres(1e12)).toThrow(RangeError);
    expect(() => nombreEnLettres(Number.NaN)).toThrow(RangeError);
    expect(() => nombreEnLettres(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('montantEnLettres — ce qui s\'imprime sur le reçu', () => {
  it.each([
    [25000, 'Vingt-cinq mille francs CFA'],
    [1, 'Un franc CFA'],
    [0, 'Zéro franc CFA'],
    [100, 'Cent francs CFA'],
    [15000, 'Quinze mille francs CFA'],
    [180000, 'Cent quatre-vingt mille francs CFA'],
    [1_500_000, 'Un million cinq cent mille francs CFA'],
  ])('%i → %s', (n, attendu) => expect(montantEnLettres(n)).toBe(attendu));

  it('« un million DE francs » quand rien ne suit million', () => {
    expect(montantEnLettres(1_000_000)).toBe('Un million de francs CFA');
    expect(montantEnLettres(3_000_000)).toBe('Trois millions de francs CFA');
    expect(montantEnLettres(1_500_000)).not.toContain(' de ');
  });

  it('arrondit : le franc CFA n\'a pas de centimes', () => {
    expect(montantEnLettres(25000.4)).toBe('Vingt-cinq mille francs CFA');
    expect(montantEnLettres(25000.6)).toBe('Vingt-cinq mille un francs CFA');
  });

  it('commence par une majuscule', () => {
    expect(montantEnLettres(5000)[0]).toBe('C');
  });
});

describe('formaterMontant — pas d\'espace fine dans un PDF', () => {
  it.each([
    [0, '0'], [999, '999'], [1000, '1 000'], [25000, '25 000'], [1234567, '1 234 567'],
  ])('%i → %s', (n, attendu) => expect(formaterMontant(n)).toBe(attendu));

  it('n\'emploie que l\'espace ordinaire, jamais U+202F ni U+00A0', () => {
    const s = formaterMontant(1234567);
    expect(s).not.toMatch(/[\u202F\u00A0]/);
    expect(s).toContain(' ');
  });

  it('arrondit', () => {
    expect(formaterMontant(2499.6)).toBe('2 500');
  });
});
