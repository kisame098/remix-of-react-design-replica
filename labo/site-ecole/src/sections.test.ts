// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { SECTIONS, sectionsDuModele } from './sections';
import { CONTENU_DEFAUT, MODELES_SITE, type ModeleSite } from './contenu';

describe('modèles de site', () => {
  it('chaque page du modèle de départ ne cite que des sections existantes', () => {
    for (const [page, ids] of Object.entries(CONTENU_DEFAUT.pages)) {
      for (const id of ids) expect(SECTIONS[id], `${page} → ${id}`).toBeDefined();
    }
  });

  it('chaque section a sa propre présentation dans Teranga (pas de retour discret au modèle Institution)', () => {
    const teranga = sectionsDuModele('teranga');
    for (const id of Object.keys(SECTIONS)) {
      expect(teranga[id].Composant, id).not.toBe(SECTIONS[id].Composant);
    }
  });

  it('changer de modèle garde les mêmes sections, donc le même contenu', () => {
    for (const modele of Object.keys(MODELES_SITE) as ModeleSite[]) {
      expect(Object.keys(sectionsDuModele(modele)).sort()).toEqual(Object.keys(SECTIONS).sort());
    }
  });
});
