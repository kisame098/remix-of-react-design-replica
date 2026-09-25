import { describe, it, expect } from 'vitest';
import { detecterOrdinateur, architectureDepuisCarte, VERSIONS } from './telechargement';

const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36';

describe('Télécharger — liens fixes', () => {
  it('les trois liens sont ceux de maj.senclass.com, jamais modifiés', () => {
    expect(VERSIONS.map(v => v.lien)).toEqual([
      'https://maj.senclass.com/telecharger/SenClass-Windows.exe',
      'https://maj.senclass.com/telecharger/SenClass-Mac-Apple-Silicon.dmg',
      'https://maj.senclass.com/telecharger/SenClass-Mac-Intel.dmg',
    ]);
  });
});

describe('Télécharger — reconnaître l\'ordinateur', () => {
  it('Windows', async () => {
    expect(await detecterOrdinateur({ userAgent: WIN })).toBe('windows');
  });
  it('Mac : l\'architecture annoncée par le navigateur (arm → puce Apple, x86 → Intel)', async () => {
    expect(await detecterOrdinateur({ userAgent: MAC, architecture: async () => 'arm' })).toBe('mac-arm');
    expect(await detecterOrdinateur({ userAgent: MAC, architecture: async () => 'x86' })).toBe('mac-intel');
  });
  it('Mac sans architecture (Safari) : la carte graphique décide', async () => {
    expect(await detecterOrdinateur({ userAgent: MAC, carteGraphique: () => 'Apple M2' })).toBe('mac-arm');
    expect(await detecterOrdinateur({ userAgent: MAC, carteGraphique: () => 'Apple GPU' })).toBe('mac-arm');
    expect(await detecterOrdinateur({ userAgent: MAC, carteGraphique: () => 'Intel(R) Iris(TM) Plus Graphics' })).toBe('mac-intel');
    expect(await detecterOrdinateur({ userAgent: MAC, architecture: async () => { throw new Error('refusé'); }, carteGraphique: () => 'AMD Radeon Pro 5500M' })).toBe('mac-intel');
  });
  it('Mac dont la puce reste inconnue, téléphone, tablette : non reconnu (pas de bouton principal)', async () => {
    expect(await detecterOrdinateur({ userAgent: MAC })).toBeNull();
    expect(await detecterOrdinateur({ userAgent: IPHONE })).toBeNull();
    expect(await detecterOrdinateur({ userAgent: ANDROID })).toBeNull();
  });
  it('noms de cartes graphiques', () => {
    expect(architectureDepuisCarte('NVIDIA GeForce GT 750M')).toBe('mac-intel');
    expect(architectureDepuisCarte('inconnue')).toBeNull();
  });
});
