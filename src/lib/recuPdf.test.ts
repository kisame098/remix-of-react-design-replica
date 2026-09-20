import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RecuData } from './recu';
import { genererRecuPdf, LIGNES_MODE_NORMAL } from './recuPdf';
import { logoDeTest } from '@/test/helpers/png';

// ════════════════════════════════════════════════════════════════════════════
// On lit le PDF produit, pas seulement son existence : numéro, total, montant en
// lettres, marques ANNULÉ et DUPLICATA, et l'absence de tout caractère que les
// polices d'un PDF ne savent pas dessiner.
// ════════════════════════════════════════════════════════════════════════════

const base = (extra: Partial<RecuData> & { couleur?: string | null } = {}): RecuData & { couleur?: string | null } => ({
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

/** Tout le texte écrit, mis bout à bout : une valeur passée sur deux lignes redevient une seule chaîne. */
const textePdf = (brutPdf: string): string =>
  [...brutPdf.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map(m => m[1]).join('');

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
    expect(texte).toContain('75 000');
    expect(texte).toContain('FCFA');
    expect(texte).toContain('TOTAL PAY');
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

  it('date et heure de Dakar, écrites en toutes lettres', async () => {
    const { texte } = await brut(base({ date: '2026-09-19T14:32:00Z' }));
    expect(texte).toContain('19 septembre 2026 \xE0 14:32');
  });

  it('le tampon ACQUITTÉ figure sur un reçu valable', async () => {
    expect((await brut(base())).texte).toContain('ACQUITT');
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
    expect(texte).toContain('ACQUITT');
  });

  it('DUPLICATA sur une réédition', async () => {
    expect(await brut(base({ duplicata: true }))).toMatchObject({ texte: expect.stringContaining('DUPLICATA') });
  });

  it('ANNULÉ : montant annulé affiché, jamais « 0 FCFA » ni de somme « arrêtée »', async () => {
    const { texte } = await brut(base({ annule: { le: '2026-09-20T08:00:00Z', par: 'Le directeur' }, total: 0 }));
    expect(texte).toContain('TOTAL ANNUL');
    expect(texte).toContain('75 000');
    expect(texte).not.toContain('Arr\xEAt\xE9 le pr\xE9sent re\xE7u');
    expect(texte).not.toContain('TOTAL PAY');
    expect(texte).not.toContain('ACQUITT');            // un reçu annulé n'est jamais « acquitté »
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

describe('reçu PDF — aucun texte perdu en silence', () => {
  it('L\'E-MAIL DU CAISSIER s\'imprime en entier (« ahmadoukane3452@gma. » était coupé)', async () => {
    const { texte } = await brut(base({ encaissePar: 'ahmadoukane3452@gmail.com' }));
    expect(texte).toContain('ahmadoukane3452@gmail.com');
    expect(texte).not.toContain('@gma.');
  });

  it('même chose pour une adresse plus longue', async () => {
    const { texte } = await brut(base({ encaissePar: 'mamadou.lamine.diallo.comptabilite@collegesainteanne.sn' }));
    // Rétrécie ou passée sur deux lignes : jamais amputée de sa fin.
    expect(texte.replace(/\)\s*Tj[^(]*\(/g, '')).toContain('collegesainteanne');
    expect(texte).toContain('.sn');
  });

  it('un nom de mode de paiement ou une référence longs restent lisibles', async () => {
    const { texte } = await brut(base({ mode: 'Espèces, Wave, Orange Money', reference: 'WV-2026-09-19-000088213-XYZ' }));
    // Trop longue pour sa colonne : passée sur deux lignes — mais rien ne manque.
    expect(textePdf(texte)).toContain('WV-2026-09-19-000088213-XYZ');
    // Le mode aussi passe sur deux lignes, coupé entre les mots : chacun est là.
    for (const mot of ['Wave', 'Orange', 'Money']) expect(texte, mot).toContain(mot);
  });

  it('LA SOMME EN LETTRES n\'est jamais coupée : un montant très élevé garde tous ses mots', async () => {
    // Avant : limitée à deux lignes — des mots disparaissaient, donc un AUTRE montant
    // s\'imprimait en lettres. C\'est ce qui protège le reçu d\'une falsification.
    const total = 987_654_321;
    const { texte } = await brut(base({ total, lignes: [{ designation: 'Inscription', montant: total, annulee: false }] }));
    for (const morceau of ['Neuf cent quatre-vingt-sept millions', 'six cent cinquante-quatre mille', 'trois cent vingt et un francs CFA.']) {
      expect(texte.replace(/\)\s*Tj[^(]*\(/g, ' '), morceau).toContain(morceau);
    }
  });

  it('un nom d\'élève très long est rétréci, pas tronqué', async () => {
    const nom = 'DIALLO Mamadou Lamine Abdoulaye Cheikh Ahmadou Bamba';
    const { texte } = await brut(base({ eleve: { nom, matricule: 'ETU-2026-00042', classe: '6ème A' } }));
    expect(texte).toContain('Bamba');
  });

  it('une désignation très longue est entière, ou tronquée AVEC « … » — jamais en silence', async () => {
    const designation = "Participation au voyage pédagogique de fin d'année à Saint-Louis du Sénégal";
    const { texte } = await brut(base({ lignes: [{ designation, montant: 25000, annulee: false }], total: 25000 }));
    expect(texte.includes('Sénégal') || texte.includes('\x85')).toBe(true);
  });

  it('un très long nom d\'école tient dans le bandeau, sans perdre de mots', async () => {
    const nom = 'Complexe Scolaire Privé Franco-Arabe Cheikh Ahmadou Bamba Mbacké de la Médina Extension Nord';
    const { texte } = await brut(base({ ecole: { ...base().ecole, nom } }));
    expect(texte).toContain('NORD');
  });
});

describe('reçu PDF — robustesse', () => {
  it('aucun caractère que les polices d\'un PDF ne savent pas dessiner', async () => {
    const { texte } = await brut(base());
    expect(texte).not.toMatch(/[\u202F\u2192\u2713]/);
  });

  it.each([1, 2, 3, 4, 5, 6, 7])('un encaissement de %i ligne(s) tient sur UNE page — celle qu\'on agrafe', async (n) => {
    const lignes = Array.from({ length: n }, (_, i) => ({
      designation: i === 0 ? "Frais d'inscription" : `Scolarité — Mois ${i}`, montant: 25000, annulee: false,
    }));
    const { doc, texte } = await brut(base({ lignes, total: 25000 * n }));
    expect(doc.getNumberOfPages()).toBe(1);
    expect(texte).toContain('ACQUITT');                  // tampon, total et signatures sont bien sur cette page
  });

  it('le mode compact ne s\'active qu\'au-delà de quatre lignes', () => {
    expect(LIGNES_MODE_NORMAL).toBe(4);
  });

  it('beaucoup de lignes : le tableau continue sur une seconde page, le total reste sur la dernière', async () => {
    const lignes = Array.from({ length: 30 }, (_, i) => ({
      designation: `Scolarité — Mois ${i + 1}`, montant: 1000, annulee: false,
    }));
    const { doc, texte } = await brut(base({ lignes, total: 30000 }));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    // Dans un PDF, les parenthèses du texte sont échappées : « (suite) » s'y lit « \(suite\) ».
    expect(texte).toContain('suite');
    expect(texte).toContain('30 000');
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
    expect(texte).toContain('1 500 000');
  });
});

// Exemplaires à regarder à l'œil : SORTIE_PDF=/dossier npx vitest run …
describe.runIf(process.env.SORTIE_PDF)('exemplaires pour relecture visuelle', () => {
  it('écrit quelques reçus', async () => {
    const dossier = process.env.SORTIE_PDF as string;
    const cas: [string, RecuData & { couleur?: string | null }][] = [
      ['recu-ordinaire', base({ couleur: '#1F5FA9' })],
      ['recu-email-caissier', base({ couleur: '#1F5FA9', encaissePar: 'ahmadoukane3452@gmail.com', reference: 'WV-2026-09-19-000088213' })],
      ['recu-tres-long', base({ couleur: '#1F5FA9', total: 987654321, lignes: [{ designation: "Participation au voyage pédagogique de fin d'année à Saint-Louis", montant: 987654321, annulee: false }], encaissePar: 'mamadou.lamine.diallo.comptabilite@collegesainteanne.sn', eleve: { nom: 'DIALLO Mamadou Lamine Abdoulaye Cheikh Ahmadou Bamba', matricule: 'ETU-2026-00042', classe: '6ème A' } })],
      ['recu-vert', base({ couleur: '#1E9E5A', ecole: { ...base().ecole, nom: 'Groupe Scolaire Les Bâtisseurs', logo: logoDeTest(120, [30, 150, 90], [220, 60, 50]) } })],
      ['recu-rouge', base({ couleur: '#C0282D', ecole: { ...base().ecole, nom: 'Institut Cheikh Ahmadou Bamba', logo: logoDeTest(120, [190, 40, 45], [240, 200, 40]) } })],
      ['recu-jaune', base({ couleur: '#F2C200', ecole: { ...base().ecole, nom: 'École Le Petit Prince', logo: logoDeTest(120, [242, 194, 0], [40, 40, 40]) } })],
      ['recu-noir', base({ couleur: '#222222', ecole: { ...base().ecole, nom: 'Lycée Blaise Diagne', logo: logoDeTest(120, [40, 40, 40], [200, 200, 200]) } })],
      ['recu-duplicata', base({ couleur: '#1F5FA9', duplicata: true })],
      ['recu-annule', base({ couleur: '#1F5FA9', annule: { le: '2026-09-20T08:00:00Z', par: 'Le directeur' }, total: 0 })],
      ['recu-sans-logo', base({ ecole: { ...base().ecole, logo: null } })],
      ['recu-sept-lignes', base({ couleur: '#1F5FA9', lignes: [
        { designation: "Frais d'inscription", montant: 50000, annulee: false },
        ...['Septembre', 'Octobre', 'Novembre', 'Décembre'].map(m => ({ designation: `Scolarité — ${m} 2026`, montant: 25000, annulee: false })),
        { designation: 'Cantine — Septembre 2026', montant: 12500, annulee: false },
        { designation: 'Transport — Septembre 2026', montant: 15000, annulee: false },
      ], total: 177500, mode: 'Espèces, Wave', reference: 'WV-88213' })],
      ['recu-plusieurs-lignes', base({ couleur: '#1F5FA9', lignes: [
        { designation: "Frais d'inscription", montant: 50000, annulee: false },
        { designation: 'Scolarité — Septembre 2026', montant: 25000, annulee: false },
        { designation: 'Scolarité — Octobre 2026', montant: 25000, annulee: false },
        { designation: 'Cantine — Septembre 2026', montant: 12500, annulee: false },
        { designation: 'Transport — Septembre 2026', montant: 15000, annulee: false },
      ], total: 127500, mode: 'Espèces, Wave', reference: 'WV-88213' })],
    ];
    for (const [nom, data] of cas) {
      const doc = await genererRecuPdf(data);
      writeFileSync(join(dossier, `${nom}.pdf`), Buffer.from(doc.output('arraybuffer')));
    }
  });
});
