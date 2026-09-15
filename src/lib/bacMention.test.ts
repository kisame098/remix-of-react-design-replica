import { describe, it, expect } from 'vitest';
import { computeBacMention } from './bacMention';

// Seuils officiels du Bac sénégalais : 10 / 12 / 14 / 16.
// Ils apparaissent sur un document remis aux familles — ils ne se « corrigent »
// pas au jugé, d'où ces tests aux bornes exactes.
describe('computeBacMention', () => {
  it('donne la mention attendue à chaque seuil exact', () => {
    expect(computeBacMention(10)).toBe('Passable');
    expect(computeBacMention(12)).toBe('Assez Bien');
    expect(computeBacMention(14)).toBe('Bien');
    expect(computeBacMention(16)).toBe('Très Bien');
  });

  it('ne donne pas la mention supérieure juste en dessous du seuil', () => {
    expect(computeBacMention(9.99)).toBe('Ajourné');
    expect(computeBacMention(11.99)).toBe('Passable');
    expect(computeBacMention(13.99)).toBe('Assez Bien');
    expect(computeBacMention(15.99)).toBe('Bien');
  });

  it('couvre le milieu de chaque tranche', () => {
    expect(computeBacMention(11)).toBe('Passable');
    expect(computeBacMention(13)).toBe('Assez Bien');
    expect(computeBacMention(15)).toBe('Bien');
    expect(computeBacMention(18)).toBe('Très Bien');
  });

  it('gère les extrêmes', () => {
    expect(computeBacMention(0)).toBe('Ajourné');
    expect(computeBacMention(20)).toBe('Très Bien');
  });
});
