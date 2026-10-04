import { describe, expect, it } from 'vitest';
import { genererFacturesPdf, type FactureDoc } from './facturePdf';
import { logoDeTest } from '@/test/helpers/png';

// On lit le PDF produit : numéro, total en chiffres et en lettres, date limite,
// marque du rappel, une facture par page.

const ecole = { nom: 'Collège Sainte Anne', ville: 'Dakar', telephone: '77 123 45 67', logo: logoDeTest() };

const facture = (extra: Partial<FactureDoc> = {}): FactureDoc => ({
  type: 'facture', numero: 'FAC-2026-00042', emiseLe: '2026-10-04T10:00:00Z', dateLimite: '2026-10-31',
  anneeScolaire: '2026-2027', eleve: { nom: 'DIOP Awa', matricule: 'ETU-2026-00042', classe: '6ème A' },
  tuteur: { nom: 'Mamadou Diop', telephone: '77 555 44 33' },
  lignes: [
    { cle: 'inscription', designation: "Frais d'inscription", montant: 50000, deja_verse: 20000, reste: 30000, en_retard: false },
    { cle: 't', designation: 'Scolarité — Septembre 2026', montant: 25000, deja_verse: 0, reste: 25000, en_retard: true },
  ],
  total: 55000,
  ...extra,
});

const textePdf = (brut: string): string => [...brut.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map(m => m[1]).join('');
const lire = async (docs: FactureDoc[]) => {
  const doc = await genererFacturesPdf(ecole, docs, null);
  return { doc, texte: textePdf(Buffer.from(doc.output('arraybuffer')).toString('latin1')) };
};

describe('facture PDF', () => {
  it('une page A4 par facture, toutes dans le même PDF', async () => {
    const { doc } = await lire([facture(), facture({ numero: 'FAC-2026-00043' }), facture({ numero: 'FAC-2026-00044' })]);
    expect(doc.getNumberOfPages()).toBe(3);
    const { width, height } = doc.internal.pageSize;
    expect([Math.round(width), Math.round(height)]).toEqual([210, 297]);
  });

  it('porte le numéro, l\'élève, le tuteur, la date limite et le total en chiffres et en lettres', async () => {
    const { texte } = await lire([facture()]);
    for (const attendu of ['FAC-2026-00042', 'DIOP Awa', 'Mamadou Diop', '31 octobre 2026', '55 000', 'Cinquante-cinq mille francs CFA']) {
      expect(texte).toContain(attendu);
    }
  });

  it('le rappel cite la facture d\'origine et sa date limite dépassée', async () => {
    const { texte } = await lire([facture({
      type: 'rappel', numero: 'RAP-2026-00003', emiseLe: '2026-11-10T10:00:00Z', dateLimite: '2026-11-20',
      origine: { numero: 'FAC-2026-00042', emiseLe: '2026-10-04T10:00:00Z', dateLimite: '2026-10-31' },
    })]);
    expect(texte).toContain('RAP-2026-00003');
    expect(texte).toContain('FAC-2026-00042');
    expect(texte).toContain('10 jours de retard');
    expect(texte).toContain('20 novembre 2026');
  });

  it('une longue facture continue sur une page de suite, sans rien perdre', async () => {
    const lignes = Array.from({ length: 30 }, (_, i) => ({
      cle: `l${i}`, designation: `Ligne ${i + 1}`, montant: 1000, deja_verse: 0, reste: 1000, en_retard: false,
    }));
    const { doc, texte } = await lire([facture({ lignes, total: 30000 })]);
    expect(doc.getNumberOfPages()).toBe(2);
    expect(texte).toContain('Ligne 30');
    expect(texte).toContain('suite');
  });

  it('refuse un lot vide', async () => {
    await expect(genererFacturesPdf(ecole, [], null)).rejects.toThrow();
  });
});
