import { describe, it, expect } from 'vitest';
import {
  decisionDePassage, seuilDePassage, baremeDuNiveau,
  ADMIS, REDOUBLE, SEUIL_ELEMENTAIRE, SEUIL_SECONDAIRE,
} from './decisionPassage';

// ════════════════════════════════════════════════════════════════════════════
// LA PHRASE LA PLUS LOURDE QUE CE LOGICIEL IMPRIME.
//
// Le système tranche : admis ou redouble, sur la seule moyenne annuelle, du CI
// à la Terminale. Deux barèmes coexistent — 10 en élémentaire, 20 ensuite —
// et les confondre ferait passer la moitié d'un collège ou redoubler la
// moitié d'un CI.
//
// Régression vécue : « Passage de droit » s'affichait pour CI/CE1/CM1 SANS
// REGARDER LES NOTES. Un élève aux résultats catastrophiques recevait un
// bulletin l'autorisant à passer.
// ════════════════════════════════════════════════════════════════════════════

const ELEMENTAIRE = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
const SECONDAIRE  = ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Tle'];
const TOUS = [...ELEMENTAIRE, ...SECONDAIRE];

const decision = (niveau: string, moyenneAnnuelle: number | undefined, estDernierePeriode = true) =>
  decisionDePassage({ niveau, estDernierePeriode, moyenneAnnuelle });

describe('le système tranche, du CI à la Terminale', () => {
  it.each(TOUS)('%s : une décision est toujours rendue quand la moyenne existe', (niveau) => {
    for (const moyenne of [0, 5, 10, 20]) {
      expect([ADMIS, REDOUBLE], `${niveau} / ${moyenne}`).toContain(decision(niveau, moyenne));
    }
  });

  it.each(ELEMENTAIRE)('%s : admis à partir de 5/10, redouble en dessous', (niveau) => {
    expect(decision(niveau, SEUIL_ELEMENTAIRE)).toBe(ADMIS);
    expect(decision(niveau, 6.5)).toBe(ADMIS);
    expect(decision(niveau, 10)).toBe(ADMIS);
    expect(decision(niveau, 4.99)).toBe(REDOUBLE);
    expect(decision(niveau, 2)).toBe(REDOUBLE);
    expect(decision(niveau, 0)).toBe(REDOUBLE);
  });

  it.each(SECONDAIRE)('%s : admis à partir de 10/20, redouble en dessous', (niveau) => {
    expect(decision(niveau, SEUIL_SECONDAIRE)).toBe(ADMIS);
    expect(decision(niveau, 13.5)).toBe(ADMIS);
    expect(decision(niveau, 20)).toBe(ADMIS);
    expect(decision(niveau, 9.99)).toBe(REDOUBLE);
    expect(decision(niveau, 5)).toBe(REDOUBLE);
    expect(decision(niveau, 0)).toBe(REDOUBLE);
  });

  it('le seuil exact passe, le centième en dessous redouble', () => {
    expect(decision('CE1', 5)).toBe(ADMIS);
    expect(decision('CE1', 4.99)).toBe(REDOUBLE);
    expect(decision('4ème', 10)).toBe(ADMIS);
    expect(decision('4ème', 9.99)).toBe(REDOUBLE);
  });

  it('NE CONFOND JAMAIS les deux barèmes', () => {
    // 7 est une réussite sur 10 et un échec sur 20. Se tromper de barème
    // ferait passer la moitié d'un collège, ou redoubler la moitié d'un CI.
    expect(decision('CE1', 7)).toBe(ADMIS);      // 7/10 → admis
    expect(decision('4ème', 7)).toBe(REDOUBLE);  // 7/20 → redouble
    expect(decision('CM2', 7)).toBe(ADMIS);      // le CM2 reste sur 10
    expect(decision('Tle', 7)).toBe(REDOUBLE);   // la Terminale sur 20
  });

  it('le CM2 et la Terminale sont tranchés comme les autres', () => {
    // Ils ont beau dépendre du CFEE et du BAC, le bulletin rend sa décision.
    expect(decision('CM2', 6)).toBe(ADMIS);
    expect(decision('CM2', 3)).toBe(REDOUBLE);
    expect(decision('Tle', 12)).toBe(ADMIS);
    expect(decision('Tle', 8)).toBe(REDOUBLE);
  });
});

describe('ce qui n\'est jamais décidé', () => {
  it('« Passage de droit » n\'existe PLUS nulle part', () => {
    for (const niveau of TOUS)
      for (const moyenne of [undefined, 0, 5, 10, 20]) {
        expect(decision(niveau, moyenne) ?? '', `${niveau}/${moyenne}`).not.toContain('de droit');
      }
  });

  it('plus AUCUN renvoi au conseil : le système assume sa décision', () => {
    for (const niveau of TOUS)
      for (const moyenne of [0, 4, 4.99, 5, 9.99, 10, 20]) {
        expect((decision(niveau, moyenne) ?? '').toLowerCase(), `${niveau}/${moyenne}`)
          .not.toContain('conseil');
      }
  });

  it('N\'AFFICHE RIEN hors du bulletin de fin d\'année', () => {
    // La case « dernière période » est cochée à la main : sans elle, le
    // bulletin du 1er semestre annoncerait un passage définitif.
    for (const niveau of TOUS)
      for (const moyenne of [2, 12, 18])
        expect(decision(niveau, moyenne, false), niveau).toBeUndefined();
  });

  it('NE FAIT PAS REDOUBLER sur du vide, quand aucune moyenne n\'existe', () => {
    // Sans note, on ne prononce rien — un redoublement décidé sur l'absence de
    // données serait une faute.
    for (const niveau of TOUS) {
      expect(decision(niveau, undefined), niveau).toBeUndefined();
      expect(decision(niveau, NaN), niveau).toBeUndefined();
    }
  });

  it('ne décide rien sans niveau connu', () => {
    expect(decisionDePassage({ niveau: undefined, estDernierePeriode: true, moyenneAnnuelle: 18 })).toBeUndefined();
    expect(decisionDePassage({ niveau: '', estDernierePeriode: true, moyenneAnnuelle: 18 })).toBeUndefined();
  });

  it('ne rend que trois réponses possibles, jamais autre chose', () => {
    const attendues = [undefined, ADMIS, REDOUBLE];
    for (const niveau of [...TOUS, 'inconnu'])
      for (const moyenne of [undefined, -5, 0, 4.9, 5, 9.9, 10, 20, 99])
        for (const finale of [true, false])
          expect(attendues, `${niveau}/${moyenne}/${finale}`)
            .toContain(decision(niveau, moyenne, finale));
  });
});

describe('barèmes et seuils', () => {
  it('donne le bon barème selon le niveau', () => {
    for (const n of ELEMENTAIRE) expect(baremeDuNiveau(n), n).toBe(10);
    for (const n of SECONDAIRE) expect(baremeDuNiveau(n), n).toBe(20);
    expect(baremeDuNiveau(undefined)).toBeUndefined();
  });

  it('le seuil est toujours la moitié du barème', () => {
    for (const n of TOUS) expect(seuilDePassage(n), n).toBe(baremeDuNiveau(n)! / 2);
  });

  it('un niveau inconnu est traité comme le secondaire — le barème le plus exigeant', () => {
    expect(seuilDePassage('Petite Section')).toBe(SEUIL_SECONDAIRE);
  });
});
