import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RecuData } from './recu';
import { genererRecuPdf } from './recuPdf';
import { logoDeTest } from '@/test/helpers/png';

// ════════════════════════════════════════════════════════════════════════════
// On lit le PDF produit, pas seulement son existence : numéro, total, montant en
// lettres, marques ANNULÉ et DUPLICATA, et l'absence de tout caractère que les
// polices d'un PDF ne savent pas dessiner.
// ════════════════════════════════════════════════════════════════════════════

const base = (extra: Partial<RecuData> = {}): RecuData => ({
  ecole: {
    nom: 'Collège Sainte Anne', ville: 'Dakar', pays: 'Sénégal', telephone: '77 123 45 67',
    email: 'contact@sainteanne.sn', adresse: 'BP 1234, Point E', ninea: '00512345 2G3', logo: logoDeTest(),
  },
  numero: 'REC-2026-00042',
  date: '2026-09-19T14:32:00Z',
  eleve: { nom: 'DIOP Awa', matricule: 'ETU-2026-00042', classe: '6ème A' },
  anneeScolaire: '2026-2027',
  lignes: [
    { designation: "Frais d'inscription", montant: 50000, annulee: false },
    { designation: 'Scolarité — Septembre 2026', montant: 25000, annulee: false },
  ],
  total: 75000,
  mode: 'Espèces',
  encaissePar: 'Fatou Sow',
  annule: null,
  duplicata: false,
  ...extra,
});

/** Le PDF brut, lisible : jsPDF n'y compresse pas le texte par défaut. */
const brut = async (data: RecuData) => {
  const doc = await genererRecuPdf(data);
  return { doc, texte: Buffer.from(doc.output('arraybuffer')).toString('latin1') };
};

describe('reçu PDF — contenu', () => {
  it('est un vrai PDF, d\'une seule page pour un reçu ordinaire', async () => {
    const { doc, texte } = await brut(base());
    expect(texte.startsWith('%PDF-')).toBe(true);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('est au format A5 portrait', async () => {
    const { doc } = await brut(base());
    const { width, height } = doc.internal.pageSize;
    expect(Math.round(width)).toBe(148);
    expect(Math.round(height)).toBe(210);
  });

  it('porte le numéro, le nom de l\'élève, son matricule et le nom de l\'école', async () => {
    const { texte } = await brut(base());
    for (const attendu of ['REC-2026-00042', 'DIOP Awa', 'ETU-2026-00042', 'COLL', 'SAINTE ANNE']) {
      expect(texte, attendu).toContain(attendu);
    }
  });

  it('affiche chaque désignation et le total en chiffres', async () => {
    const { texte } = await brut(base());
    expect(texte).toContain("Frais d'inscription");
    expect(texte).toContain('50 000');
    expect(texte).toContain('25 000');
    expect(texte).toContain('75 000 FCFA');
  });

  it('écrit le total EN LETTRES', async () => {
    const { texte } = await brut(base());
    expect(texte).toContain('Soixante-quinze mille francs CFA.');
  });

  it('indique le mode de paiement, la référence et le caissier', async () => {
    const { texte } = await brut(base({ mode: 'Chèque', reference: 'CHQ-0012345', encaissePar: 'Fatou Sow' }));
    expect(texte).toContain('Chèque');
    expect(texte).toContain('CHQ-0012345');
    expect(texte).toContain('Fatou Sow');
  });

  it('date et heure de Dakar', async () => {
    const { texte } = await brut(base({ date: '2026-09-19T14:32:00Z' }));
    expect(texte).toContain('19/09/2026 à 14:32');
  });

  it('les coordonnées de l\'école : adresse, téléphone, NINEA', async () => {
    const { texte } = await brut(base());
    expect(texte).toContain('BP 1234, Point E');
    expect(texte).toContain('77 123 45 67');
    expect(texte).toContain('00512345 2G3');
  });
});

describe('reçu PDF — logo', () => {
  it('avec un logo : l\'image est dans le PDF', async () => {
    const { texte } = await brut(base());
    expect(texte).toContain('/Subtype /Image');
  });

  it('sans logo : un monogramme, pas de trou — et aucune image', async () => {
    const { texte } = await brut(base({ ecole: { ...base().ecole, logo: null } }));
    expect(texte).not.toContain('/Subtype /Image');
    expect(texte).toContain('CS');            // Collège Sainte Anne → « CS »
  });

  it('un logo corrompu ne fait pas échouer le reçu : le monogramme prend le relais', async () => {
    const { doc, texte } = await brut(base({ ecole: { ...base().ecole, logo: 'data:image/png;base64,PAS-UNE-IMAGE' } }));
    expect(doc.getNumberOfPages()).toBe(1);
    expect(texte).toContain('REC-2026-00042');
  });
});

describe('reçu PDF — mentions', () => {
  it('reçu ordinaire : ni ANNULÉ ni DUPLICATA', async () => {
    const { texte } = await brut(base());
    expect(texte).not.toContain('ANNUL');
    expect(texte).not.toContain('DUPLICATA');
  });

  it('DUPLICATA sur une réédition', async () => {
    expect(await brut(base({ duplicata: true }))).toMatchObject({ texte: expect.stringContaining('DUPLICATA') });
  });

  it('ANNULÉ : montant annulé affiché, jamais « 0 FCFA » ni de somme « arrêtée »', async () => {
    const { texte } = await brut(base({ annule: { le: '2026-09-20T08:00:00Z', par: 'Le directeur' }, total: 0 }));
    expect(texte).toContain('TOTAL ANNUL');
    expect(texte).toContain('75 000 FCFA');
    expect(texte).not.toContain('Arrêté la présente somme');
    expect(texte).not.toContain('TOTAL PAY');
  });

  it('ANNULÉ : tampon, mention « sans valeur », qui et quand', async () => {
    const { texte } = await brut(base({ annule: { le: '2026-09-20T08:00:00Z', par: 'Le directeur' }, total: 0 }));
    expect(texte).toContain('ANNUL');
    expect(texte).toContain('sans valeur');
    expect(texte).toContain('20/09/2026');
    expect(texte).toContain('Le directeur');
  });

  it('une ligne annulée est signalée', async () => {
    const { texte } = await brut(base({
      lignes: [
        { designation: 'Scolarité — Septembre 2026', montant: 25000, annulee: false },
        { designation: 'Scolarité — Octobre 2026', montant: 25000, annulee: true },
      ],
      total: 25000,
    }));
    expect(texte).toContain('(annul');
  });
});

describe('reçu PDF — robustesse', () => {
  it('aucun caractère que les polices d\'un PDF ne savent pas dessiner', async () => {
    const { texte } = await brut(base());
    expect(texte).not.toMatch(/[\u202F\u2192\u2713]/);
  });

  it('beaucoup de lignes : le tableau continue sur une seconde page, le total reste sur la dernière', async () => {
    const lignes = Array.from({ length: 30 }, (_, i) => ({
      designation: `Scolarité — Mois ${i + 1}`, montant: 1000, annulee: false,
    }));
    const { doc, texte } = await brut(base({ lignes, total: 30000 }));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    // Dans un PDF, les parenthèses du texte sont échappées : « (suite) » s'y lit « \(suite\) ».
    expect(texte).toMatch(/suite\\\)/);
    expect(texte).toContain('30 000 FCFA');
  });

  it('un nom d\'école très long ne déborde pas de la page', async () => {
    const nom = 'Complexe Scolaire Privé Franco-Arabe Cheikh Ahmadou Bamba Mbacké de la Médina Extension';
    const { doc } = await brut(base({ ecole: { ...base().ecole, nom } }));
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('une école sans aucune coordonnée reste présentable', async () => {
    const { texte } = await brut(base({ ecole: { nom: 'École Test' } }));
    expect(texte).toContain('REC-2026-00042');
  });

  it('montant en millions : lettres correctes', async () => {
    const { texte } = await brut(base({ total: 1_500_000, lignes: [{ designation: 'Inscription', montant: 1_500_000, annulee: false }] }));
    expect(texte).toContain('Un million cinq cent mille francs CFA.');
    expect(texte).toContain('1 500 000 FCFA');
  });
});

// Exemplaires à regarder à l'œil : SORTIE_PDF=/dossier npx vitest run …
describe.runIf(process.env.SORTIE_PDF)('exemplaires pour relecture visuelle', () => {
  it('écrit quelques reçus', async () => {
    const dossier = process.env.SORTIE_PDF as string;
    const cas: [string, RecuData][] = [
      ['recu-ordinaire', base()],
      ['recu-duplicata', base({ duplicata: true })],
      ['recu-annule', base({ annule: { le: '2026-09-20T08:00:00Z', par: 'Le directeur' }, total: 0 })],
      ['recu-sans-logo', base({ ecole: { ...base().ecole, logo: null } })],
    ];
    for (const [nom, data] of cas) {
      const doc = await genererRecuPdf(data);
      writeFileSync(join(dossier, `${nom}.pdf`), Buffer.from(doc.output('arraybuffer')));
    }
  });
});
