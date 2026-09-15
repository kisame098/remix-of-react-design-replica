import { describe, it, expect } from 'vitest';
import {
  NIVEAUX_ELEMENTAIRE, etapeForNiveau, ETAPE_TOTALS,
  ELEMENTARY_DEFAULT_LINES, ELEMENTARY_OPTIONAL_CATALOG,
  DOMAINE_LABELS, REGISTRE_LABELS,
  type Etape, type ElementaryDomaine, type ElementaryRegistre,
} from './elementaryDefaults';

// ════════════════════════════════════════════════════════════════════════════
// BARÈMES OFFICIELS DE L'ÉLÉMENTAIRE — la grille que chaque école reçoit à sa
// création. Si la somme des points d'un niveau ne tombe pas juste, TOUTES les
// moyennes de ce niveau sont fausses dès le premier bulletin, dans toutes les
// écoles à la fois. C'est le genre d'erreur qu'on ne voit pas à l'œil nu.
// ════════════════════════════════════════════════════════════════════════════

const linesOf = (niveau: string) => ELEMENTARY_DEFAULT_LINES.filter(l => l.niveau === niveau);
const sum = (arr: { pointMax: number }[]) => arr.reduce((s, l) => s + l.pointMax, 0);

describe('etapeForNiveau', () => {
  it('range les six niveaux en trois étapes', () => {
    expect([etapeForNiveau('CI'), etapeForNiveau('CP')]).toEqual([1, 1]);
    expect([etapeForNiveau('CE1'), etapeForNiveau('CE2')]).toEqual([2, 2]);
    expect([etapeForNiveau('CM1'), etapeForNiveau('CM2')]).toEqual([3, 3]);
  });

  it('ne range pas un niveau de collège dans une étape d\'élémentaire', () => {
    expect(etapeForNiveau('6ème')).toBeUndefined();
    expect(etapeForNiveau('Tle')).toBeUndefined();
    expect(etapeForNiveau('')).toBeUndefined();
  });

  it('couvre tous les niveaux déclarés, sans exception', () => {
    for (const niveau of NIVEAUX_ELEMENTAIRE) {
      expect(etapeForNiveau(niveau), niveau).toBeDefined();
    }
  });
});

describe('ETAPE_TOTALS — cohérence arithmétique', () => {
  it('total = 10 × diviseur pour chaque étape (la moyenne tombe sur 10)', () => {
    for (const etape of [1, 2, 3] as Etape[]) {
      const { total, diviseur } = ETAPE_TOTALS[etape];
      expect(total, `étape ${etape}`).toBe(diviseur * 10);
    }
  });

  it('compétence + ressources = total, pour chaque étape', () => {
    for (const etape of [1, 2, 3] as Etape[]) {
      const { total, competence, ressources } = ETAPE_TOTALS[etape];
      expect(competence + ressources, `étape ${etape}`).toBe(total);
    }
  });

  it('le barème s\'alourdit à mesure que l\'élève monte', () => {
    expect(ETAPE_TOTALS[1].total).toBeLessThan(ETAPE_TOTALS[2].total);
    expect(ETAPE_TOTALS[2].total).toBeLessThan(ETAPE_TOTALS[3].total);
  });
});

describe('ELEMENTARY_DEFAULT_LINES — grille livrée à chaque école', () => {
  it('livre une grille à chacun des six niveaux', () => {
    for (const niveau of NIVEAUX_ELEMENTAIRE) {
      expect(linesOf(niveau).length, niveau).toBeGreaterThan(0);
    }
  });

  it('LA SOMME DES POINTS DE CHAQUE NIVEAU TOMBE EXACTEMENT SUR LE TOTAL DE SON ÉTAPE', () => {
    for (const niveau of NIVEAUX_ELEMENTAIRE) {
      const etape = etapeForNiveau(niveau)!;
      expect(sum(linesOf(niveau)), `${niveau} (étape ${etape})`).toBe(ETAPE_TOTALS[etape].total);
    }
  });

  it('les sous-totaux Compétence et Ressources tombent juste eux aussi', () => {
    for (const niveau of NIVEAUX_ELEMENTAIRE) {
      const etape = etapeForNiveau(niveau)!;
      const lines = linesOf(niveau);
      expect(sum(lines.filter(l => l.registre === 'COMPETENCE')), `${niveau} compétence`)
        .toBe(ETAPE_TOTALS[etape].competence);
      expect(sum(lines.filter(l => l.registre === 'RESSOURCES')), `${niveau} ressources`)
        .toBe(ETAPE_TOTALS[etape].ressources);
    }
  });

  it('les deux niveaux d\'une même étape reçoivent la même grille', () => {
    const pairs: [string, string][] = [['CI', 'CP'], ['CE1', 'CE2'], ['CM1', 'CM2']];
    for (const [a, b] of pairs) {
      const strip = (n: string) => linesOf(n).map(({ name, pointMax, registre, domaine }) =>
        ({ name, pointMax, registre, domaine }));
      expect(strip(a), `${a} vs ${b}`).toEqual(strip(b));
    }
  });

  it('chaque niveau reçoit une COPIE indépendante, jamais un objet partagé', () => {
    // Une référence partagée ferait qu'éditer le barème du CI modifierait le CP.
    const ci = linesOf('CI')[0];
    const cp = linesOf('CP')[0];
    expect(ci).not.toBe(cp);
  });

  it('aucune discipline à 0 point ni à barème négatif', () => {
    for (const line of ELEMENTARY_DEFAULT_LINES) {
      expect(line.pointMax, `${line.niveau} — ${line.name}`).toBeGreaterThan(0);
    }
  });

  it('un même intitulé est évalué dans les DEUX registres — ce ne sont pas des doublons', () => {
    // « Mathématiques » compte en Compétence ET en Ressources, avec des barèmes
    // différents : c'est la structure officielle. Tout code qui regroupe les
    // disciplines doit donc le faire sur nom + registre, jamais sur le seul nom
    // (cf. le profil académique dans StudentManagement).
    const maths = linesOf('CI').filter(l => l.name === 'Mathématiques');
    expect(maths).toHaveLength(2);
    expect(maths.map(l => l.registre).sort()).toEqual(['COMPETENCE', 'RESSOURCES']);
    expect(maths[0].pointMax).not.toBe(maths[1].pointMax);
  });

  it('aucun doublon de couple (nom, registre) dans un même niveau', () => {
    for (const niveau of NIVEAUX_ELEMENTAIRE) {
      const keys = linesOf(niveau).map(l => `${l.registre}:${l.name}`);
      expect(new Set(keys).size, `${niveau} : doublon`).toBe(keys.length);
    }
  });

  it('les disciplines de base sont toutes actives et non optionnelles', () => {
    for (const line of ELEMENTARY_DEFAULT_LINES) {
      expect(line.isOptional ?? false, line.name).toBe(false);
    }
  });

  it('l\'ordre d\'affichage part de 0 et ne saute aucun rang, par niveau', () => {
    for (const niveau of NIVEAUX_ELEMENTAIRE) {
      const orders = linesOf(niveau).map(l => l.ordering).sort((a, b) => a - b);
      expect(orders, niveau).toEqual(orders.map((_, i) => i));
    }
  });
});

describe('ELEMENTARY_OPTIONAL_CATALOG — disciplines que l\'école peut ajouter', () => {
  it('AUCUNE n\'est active par défaut — sinon elles fausseraient le total', () => {
    for (const line of ELEMENTARY_OPTIONAL_CATALOG) {
      expect(line.isActiveByDefault, `${line.niveau} — ${line.name}`).toBe(false);
      expect(line.isOptional, `${line.niveau} — ${line.name}`).toBe(true);
    }
  });

  it('ne double jamais une discipline déjà présente dans la grille de base', () => {
    for (const opt of ELEMENTARY_OPTIONAL_CATALOG) {
      const base = linesOf(opt.niveau).map(l => l.name);
      expect(base, `${opt.niveau} — ${opt.name} existe déjà`).not.toContain(opt.name);
    }
  });

  it('propose Arabe et Éducation religieuse à tous les niveaux (contexte sénégalais)', () => {
    for (const niveau of NIVEAUX_ELEMENTAIRE) {
      const names = ELEMENTARY_OPTIONAL_CATALOG.filter(l => l.niveau === niveau).map(l => l.name);
      expect(names, niveau).toContain('Arabe');
      expect(names, niveau).toContain('Éducation religieuse');
    }
  });

  it('classe les options après les disciplines de base', () => {
    const maxBase = Math.max(...ELEMENTARY_DEFAULT_LINES.map(l => l.ordering));
    for (const opt of ELEMENTARY_OPTIONAL_CATALOG) {
      expect(opt.ordering, opt.name).toBeGreaterThan(maxBase);
    }
  });
});

describe('libellés', () => {
  it('chaque domaine et chaque registre utilisé a un libellé lisible', () => {
    const domaines = new Set<ElementaryDomaine>(ELEMENTARY_DEFAULT_LINES.map(l => l.domaine));
    for (const d of domaines) expect(DOMAINE_LABELS[d], d).toBeTruthy();
    const registres = new Set<ElementaryRegistre>(ELEMENTARY_DEFAULT_LINES.map(l => l.registre));
    for (const r of registres) expect(REGISTRE_LABELS[r], r).toBeTruthy();
  });

  it('les quatre domaines officiels sont tous représentés dans la grille', () => {
    const domaines = new Set(ELEMENTARY_DEFAULT_LINES.map(l => l.domaine));
    expect([...domaines].sort()).toEqual(['EPSA', 'ESVS', 'LC', 'MATH']);
  });
});
