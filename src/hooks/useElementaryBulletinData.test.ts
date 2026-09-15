import { describe, it, expect } from 'vitest';
import { computeDecisionPassage } from './useElementaryBulletinData';
import { ADMIS, REDOUBLE } from '@/lib/decisionPassage';

// ════════════════════════════════════════════════════════════════════════════
// Le bulletin élémentaire délègue sa décision de passage à
// src/lib/decisionPassage.ts, partagé avec le collège et testé en détail là-bas
// (decisionPassage.test.ts). Ce fichier-ci vérifie le BRANCHEMENT : que le
// bulletin pose bien la question, et dans le bon ordre d'arguments.
// ════════════════════════════════════════════════════════════════════════════

const NIVEAUX = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];

describe('computeDecisionPassage — branchement du bulletin élémentaire', () => {
  it.each(NIVEAUX)('%s : redouble en dessous de 5/10', (niveau) => {
    expect(computeDecisionPassage(niveau, true, 2)).toBe(REDOUBLE);
    expect(computeDecisionPassage(niveau, true, 4.99)).toBe(REDOUBLE);
  });

  it.each(NIVEAUX)('%s : admis à partir de 5/10', (niveau) => {
    expect(computeDecisionPassage(niveau, true, 5)).toBe(ADMIS);
    expect(computeDecisionPassage(niveau, true, 8)).toBe(ADMIS);
  });

  it('n\'affiche rien hors du bulletin de fin d\'année', () => {
    // La case « dernière période » est cochée à la main : sans elle, le
    // bulletin du 1er semestre annoncerait un passage définitif.
    for (const moyenne of [2, 5, 9]) {
      expect(computeDecisionPassage('CE1', false, moyenne)).toBeUndefined();
    }
  });

  it('ne fait pas redoubler sur du vide, sans moyenne annuelle', () => {
    expect(computeDecisionPassage('CE1', true, undefined)).toBeUndefined();
  });

  it('ne décide rien sans niveau', () => {
    expect(computeDecisionPassage(undefined, true, 8)).toBeUndefined();
  });
});
