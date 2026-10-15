import { describe, it, expect } from 'vitest';
import { ajouterElement, deplacerElement, ecrire, fusionner, lire, retirerElement } from './chemin';
import { CONTENU_DEFAUT } from './contenu';

describe('chemin', () => {
  const objet = { a: { b: [{ c: 'x' }, { c: 'y' }] }, d: 1 };

  it('lit une valeur profonde, y compris dans une liste', () => {
    expect(lire(objet, 'a.b.1.c')).toBe('y');
    expect(lire(objet, 'a.z.c')).toBeUndefined();
  });

  it('écrit sans toucher à l\'original et garde les listes en listes', () => {
    const r = ecrire(objet, 'a.b.0.c', 'neuf');
    expect(lire(r, 'a.b.0.c')).toBe('neuf');
    expect(Array.isArray(r.a.b)).toBe(true);
    expect(objet.a.b[0].c).toBe('x');
    expect(r.a.b[1]).toBe(objet.a.b[1]);
  });

  it('ajoute, retire et déplace dans une liste', () => {
    expect(ajouterElement([1, 2, 3], 9, 0)).toEqual([1, 9, 2, 3]);
    expect(ajouterElement([1, 2], 9)).toEqual([1, 2, 9]);
    expect(retirerElement([1, 2, 3], 1)).toEqual([1, 3]);
    expect(deplacerElement([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    const l = [1, 2];
    expect(deplacerElement(l, 0, -1)).toBe(l);
    expect(deplacerElement(l, 1, 1)).toBe(l);
  });

  it('fusionne une sauvegarde avec le modèle : l\'école gagne, les nouveaux champs apparaissent', () => {
    const modele = { titre: 'Modèle', nouveau: 'ajouté plus tard', liste: [1, 2], sous: { x: 1, y: 2 } };
    const r = fusionner(modele, { titre: 'École', liste: [7], sous: { x: 5 }, inconnu: 'ignoré' });
    expect(r).toEqual({ titre: 'École', nouveau: 'ajouté plus tard', liste: [7], sous: { x: 5, y: 2 } });
  });

  it('fusionne : une sauvegarde abîmée ne casse pas le site', () => {
    expect(fusionner({ a: 'x' }, 'n\'importe quoi')).toEqual({ a: 'x' });
    expect(fusionner({ a: 'x' }, { a: 42 })).toEqual({ a: 'x' });
    expect(fusionner({ l: [1] }, { l: 'pas une liste' })).toEqual({ l: [1] });
  });

  it('le contenu par défaut se recharge à l\'identique', () => {
    expect(fusionner(CONTENU_DEFAUT, JSON.parse(JSON.stringify(CONTENU_DEFAUT)))).toEqual(CONTENU_DEFAUT);
  });
});
