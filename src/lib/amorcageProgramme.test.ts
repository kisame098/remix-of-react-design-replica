import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLE_AMORCE, dejaAmorce, doitAmorcer, getNiveauxSupprimes, sansNiveauxSupprimes } from './amorcageProgramme';

const base = { type: 'college' as const, settings: {}, tableVide: true, estAdmin: true, accesBloque: false };

describe('amorçage du programme — ne ressuscite plus ce que l\'école a supprimé', () => {
  it('école neuve, table vide, admin : on amorce', () => {
    expect(doitAmorcer(base)).toBe(true);
  });

  it('école qui a tout supprimé : table vide MAIS déjà amorcée → on ne remet rien (le bug)', () => {
    expect(doitAmorcer({ ...base, settings: { [CLE_AMORCE.college]: true } })).toBe(false);
    expect(doitAmorcer({ ...base, type: 'elementaire', settings: { [CLE_AMORCE.elementaire]: true } })).toBe(false);
  });

  it('les deux programmes sont indépendants', () => {
    const settings = { [CLE_AMORCE.college]: true };
    expect(doitAmorcer({ ...base, type: 'elementaire', settings })).toBe(true);
    expect(dejaAmorce(settings, 'elementaire')).toBe(false);
  });

  it('pas d\'amorçage sans table vide, hors admin, ou abonnement bloqué', () => {
    expect(doitAmorcer({ ...base, tableVide: false })).toBe(false);
    expect(doitAmorcer({ ...base, estAdmin: false })).toBe(false);
    expect(doitAmorcer({ ...base, accesBloque: true })).toBe(false);
  });

  it('réglages absents : école neuve', () => {
    expect(doitAmorcer({ ...base, settings: undefined })).toBe(true);
  });
});

describe('niveaux supprimés', () => {
  it('lecture tolérante', () => {
    expect(getNiveauxSupprimes({ niveauxSupprimes: ['CI', 3, null, 'CP'] })).toEqual(['CI', 'CP']);
    expect(getNiveauxSupprimes({ niveauxSupprimes: 'CI' })).toEqual([]);
    expect(getNiveauxSupprimes(undefined)).toEqual([]);
  });
  it('l\'amorçage saute les niveaux supprimés', () => {
    const lignes = [{ niveau: 'CI', n: 1 }, { niveau: 'CP', n: 2 }, { niveau: 'CE1', n: 3 }];
    expect(sansNiveauxSupprimes(lignes, ['CI', 'CP'])).toEqual([{ niveau: 'CE1', n: 3 }]);
  });
});

describe('garde-fous — le contexte et la page Cursus', () => {
  const ctx = readFileSync('src/contexts/SchoolContext.tsx', 'utf8');
  const page = readFileSync('src/pages/Filieres.tsx', 'utf8');

  it('l\'amorçage passe par doitAmorcer, plus par un simple « table vide »', () => {
    expect(ctx).toContain("type: 'college'");
    expect(ctx).toContain("type: 'elementaire'");
    expect(ctx).not.toMatch(/\(ndRes\.data \?\? \[\]\)\.length === 0 && accountRole/);
    expect(ctx).not.toMatch(/\(dRes\.data \?\? \[\]\)\.length === 0 && accountRole/);
  });

  it('la page marque l\'école amorcée AVANT de supprimer, et reprend le drapeau dans l\'enregistrement final', () => {
    expect(page).toContain("await assurerAmorce('elementaire');\n      await deleteElementaryDefaultLine");
    expect(page).toMatch(/\[CLE_AMORCE\[type\]\]: true,\s*\n\s*niveauxSupprimes/);
  });

  it('un bloc utilisé par une classe ne peut pas être supprimé', () => {
    expect(page).toContain('Impossible de supprimer ce bloc');
  });
});
