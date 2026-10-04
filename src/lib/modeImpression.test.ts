import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lireModeImpression, retenirModeImpression } from '@/lib/modeImpression';
import { genererFacturesPdf, type FactureDoc } from '@/lib/facturePdf';
import { genererRecuPdf } from '@/lib/recuPdf';

describe('mode d\'impression : choisi une fois par type de document', () => {
  beforeEach(() => localStorage.clear());

  it('jamais choisi → null (la fenêtre d\'aperçu le demande)', () => {
    expect(lireModeImpression('recu')).toBeNull();
  });

  it('retenu par type : les reçus en noir et blanc n\'imposent rien aux factures', () => {
    retenirModeImpression('recu', 'economique');
    expect(lireModeImpression('recu')).toBe('economique');
    expect(lireModeImpression('facture')).toBeNull();
  });

  it('modifiable ensuite', () => {
    retenirModeImpression('facture', 'economique');
    retenirModeImpression('facture', 'couleur');
    expect(lireModeImpression('facture')).toBe('couleur');
  });

  it('stockage indisponible (navigation privée) : pas d\'erreur, couleur par défaut', () => {
    const lire = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqué'); });
    const ecrire = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqué'); });
    expect(() => retenirModeImpression('recu', 'economique')).not.toThrow();
    expect(lireModeImpression('recu')).toBeNull();
    lire.mockRestore(); ecrire.mockRestore();
  });
});

// Un bandeau plein = un rectangle rempli de toute la largeur de la page.
// jsPDF écrit la largeur en points, en pleine précision : « 595.2755905… » (A4), « 419.527… » (A5).
const bandeauPlein = (brut: string, largeurPt: string) =>
  new RegExp(`^0\\.? [\\d.]+ ${largeurPt.replace('.', '\\.')}\\d* -?[\\d.]+ re\\s+f`, 'm').test(brut);
const brut = (doc: { output: (t: 'arraybuffer') => ArrayBuffer }) => Buffer.from(doc.output('arraybuffer')).toString('latin1');

const ecole = { nom: 'École Exemple', ville: 'Dakar' };
const facture: FactureDoc = {
  type: 'facture', numero: 'FAC-2026-00001', emiseLe: '2026-10-04T10:00:00Z', dateLimite: '2026-10-31', anneeScolaire: '2026-2027',
  eleve: { nom: 'ÉLÈVE Exemple', matricule: 'ETU-1' },
  lignes: [{ cle: 'i', designation: 'Inscription', montant: 50000, deja_verse: 0, reste: 50000, en_retard: false }], total: 50000,
};
const recu = {
  ecole, numero: 'REC-2026-00001', date: '2026-10-04T10:00:00Z', eleve: { nom: 'ÉLÈVE Exemple', matricule: 'ETU-1' },
  anneeScolaire: '2026-2027', lignes: [{ designation: 'Inscription', montant: 50000, annulee: false }], total: 50000,
  mode: 'Espèces', annule: null, duplicata: false, couleur: null,
};

describe('impression noir et blanc : plus de grand bandeau rempli', () => {
  it('facture : bandeau plein en couleur, aucun en noir et blanc', async () => {
    expect(bandeauPlein(brut(await genererFacturesPdf(ecole, [facture], null)), '595.27')).toBe(true);
    expect(bandeauPlein(brut(await genererFacturesPdf(ecole, [facture], null, { economique: true })), '595.27')).toBe(false);
  });

  it('reçu : bandeau plein en couleur, aucun en noir et blanc', async () => {
    expect(bandeauPlein(brut(await genererRecuPdf(recu)), '419.52')).toBe(true);
    expect(bandeauPlein(brut(await genererRecuPdf({ ...recu, economique: true })), '419.52')).toBe(false);
  });

  it('le contenu reste le même : numéro et total présents dans les deux modes', async () => {
    const texte = brut(await genererFacturesPdf(ecole, [facture], null, { economique: true }));
    expect(texte).toContain('FAC-2026-00001');
    expect(texte).toContain('50 000');
  });
});
