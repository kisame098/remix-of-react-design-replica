import { describe, it, expect } from 'vitest';
import {
  escapeCsvField, buildCsv, sanitizeFilename, UTF8_BOM,
  parseImportedDate, parseImportedSex,
} from './csvExport';

// ════════════════════════════════════════════════════════════════════════════
// EXPORT / IMPORT CSV — ces fichiers sont ouverts dans Excel par un
// secrétariat. Les dégâts ne se voient jamais à l'écran de l'app :
//   • une virgule dans une adresse décale toutes les colonnes suivantes ;
//   • un BOM manquant affiche « NdÃ¨ye » au lieu de « Ndèye » ;
//   • une date d'import mal lue fausse l'âge de l'élève pour toute sa scolarité.
// ════════════════════════════════════════════════════════════════════════════

const lines = (csv: string) => csv.replace(UTF8_BOM, '').split('\r\n');

describe('escapeCsvField', () => {
  it('entoure toujours le champ de guillemets', () => {
    expect(escapeCsvField('Diop')).toBe('"Diop"');
  });

  it('DOUBLE les guillemets internes — sinon la ligne se coupe en deux', () => {
    expect(escapeCsvField('Cité "Keur Gorgui"')).toBe('"Cité ""Keur Gorgui"""');
  });

  it('protège une virgule et un point-virgule dans une adresse', () => {
    expect(escapeCsvField('Keur Gorgui, villa 12')).toBe('"Keur Gorgui, villa 12"');
    expect(escapeCsvField('Sacré-Cœur 3; lot 5')).toBe('"Sacré-Cœur 3; lot 5"');
  });

  it('protège un retour à la ligne collé dans une cellule', () => {
    expect(escapeCsvField('ligne1\nligne2')).toBe('"ligne1\nligne2"');
  });

  it('rend une cellule vide — jamais "null" ni "undefined" — sur une valeur absente', () => {
    expect(escapeCsvField(null)).toBe('""');
    expect(escapeCsvField(undefined)).toBe('""');
    expect(escapeCsvField('')).toBe('""');
  });

  it('accepte un nombre sans le transformer', () => {
    expect(escapeCsvField(15000)).toBe('"15000"');
    expect(escapeCsvField(0)).toBe('"0"');
  });

  it('conserve les accents tels quels', () => {
    expect(escapeCsvField('Ndèye Fatou Bâ')).toBe('"Ndèye Fatou Bâ"');
  });
});

describe('buildCsv', () => {
  it('écrit les en-têtes puis les lignes, séparées par des points-virgules', () => {
    const csv = buildCsv(['Nom', 'Prénom'], [['Diop', 'Fatou'], ['Ndiaye', 'Moussa']]);
    expect(lines(csv)).toEqual(['"Nom";"Prénom"', '"Diop";"Fatou"', '"Ndiaye";"Moussa"']);
  });

  it('COMMENCE PAR LE BOM UTF-8 — sans lui Excel casse tous les accents', () => {
    expect(buildCsv(['Prénom'], [['Ndèye']]).startsWith(UTF8_BOM)).toBe(true);
  });

  it('sépare les lignes par CRLF, comme l\'attend Excel sous Windows', () => {
    expect(buildCsv(['A'], [['1']]).includes('\r\n')).toBe(true);
  });

  it('place la bannière en tête, suivie d\'une ligne vide', () => {
    const csv = buildCsv(['Nom'], [['Diop']], ['Scolarité — Novembre 2025']);
    expect(lines(csv)).toEqual(['"Scolarité — Novembre 2025"', '', '"Nom"', '"Diop"']);
  });

  it('n\'insère pas de ligne vide quand il n\'y a pas de bannière', () => {
    expect(lines(buildCsv(['Nom'], [['Diop']]))[1]).toBe('"Diop"');
  });

  it('garde toutes les colonnes alignées même avec des virgules partout', () => {
    const csv = buildCsv(
      ['Nom', 'Adresse', 'Montant'],
      [['Diop, Fatou', 'Keur Gorgui, villa 12', 15000]],
    );
    const data = lines(csv)[1];
    // Trois cellules, malgré les deux virgules dans les valeurs.
    expect(data.split(';')).toHaveLength(3);
    expect(data).toBe('"Diop, Fatou";"Keur Gorgui, villa 12";"15000"');
  });

  it('exporte un fichier d\'en-têtes seuls quand il n\'y a aucune ligne', () => {
    expect(lines(buildCsv(['Nom'], []))).toEqual(['"Nom"']);
  });
});

describe('sanitizeFilename', () => {
  it('retire les accents et les caractères interdits', () => {
    expect(sanitizeFilename('Liste des élèves — 6ème A')).toBe('Liste_des_eleves_6eme_A');
  });

  it('ne laisse ni slash ni deux-points, qui casseraient l\'enregistrement', () => {
    expect(sanitizeFilename('Paiements 01/11/2025 : CM2')).toBe('Paiements_01_11_2025_CM2');
  });

  it('ne produit que des caractères sûrs, quelle que soit l\'entrée', () => {
    for (const s of ['Ndèye Bâ', 'a*b?c<d>e|f', 'Scolarité 100%']) {
      expect(sanitizeFilename(s)).toMatch(/^[a-zA-Z0-9_]*$/);
    }
  });
});

describe('parseImportedDate — colonne date de naissance', () => {
  it('lit le format français JJ/MM/AAAA', () => {
    expect(parseImportedDate('15/03/2015')).toBe('2015-03-15');
  });

  it('accepte les tirets et les jours/mois sur un seul chiffre', () => {
    expect(parseImportedDate('5-3-2015')).toBe('2015-03-05');
    expect(parseImportedDate('5/3/2015')).toBe('2015-03-05');
  });

  it('laisse passer une date déjà au format ISO', () => {
    expect(parseImportedDate('2015-03-15')).toBe('2015-03-15');
  });

  it('tolère les espaces autour de la valeur', () => {
    expect(parseImportedDate('  15/03/2015  ')).toBe('2015-03-15');
  });

  it('REFUSE plutôt que de deviner une date ambiguë ou illisible', () => {
    // Mieux vaut une ligne en erreur à corriger qu'un âge faux pour dix ans.
    expect(parseImportedDate('15/03/15')).toBeNull();   // année sur 2 chiffres
    expect(parseImportedDate('mars 2015')).toBeNull();
    expect(parseImportedDate('')).toBeNull();
    expect(parseImportedDate('2015/03/15')).toBeNull();
  });

  it('encaisse une cellule absente du fichier sans planter', () => {
    // Papaparse rend undefined pour une colonne manquante en fin de ligne.
    expect(parseImportedDate(undefined as unknown as string)).toBeNull();
    expect(parseImportedDate(null as unknown as string)).toBeNull();
  });

  it('NE CONFOND PAS le format américain avec le format français', () => {
    // 03/15/2015 (US) n'est pas une date française valide : le mois 15 n'existe
    // pas. On la convertit littéralement, la validation métier la rejettera —
    // l'important est de ne pas la lire comme le 3 mars.
    expect(parseImportedDate('03/15/2015')).toBe('2015-15-03');
  });
});

describe('parseImportedSex — colonne sexe', () => {
  it('accepte les écritures courantes des deux sexes', () => {
    for (const v of ['M', 'm', 'H', 'homme', 'Homme', ' HOMME ']) {
      expect(parseImportedSex(v), v).toBe('homme');
    }
    for (const v of ['F', 'f', 'femme', 'Femme', ' FEMME ']) {
      expect(parseImportedSex(v), v).toBe('femme');
    }
  });

  it('REFUSE une valeur ambiguë au lieu de choisir un sexe au hasard', () => {
    expect(parseImportedSex(undefined as unknown as string)).toBeNull();
    expect(parseImportedSex(null as unknown as string)).toBeNull();
    expect(parseImportedSex('')).toBeNull();
    expect(parseImportedSex('garçon')).toBeNull();
    expect(parseImportedSex('X')).toBeNull();
    expect(parseImportedSex('1')).toBeNull();
  });
});
