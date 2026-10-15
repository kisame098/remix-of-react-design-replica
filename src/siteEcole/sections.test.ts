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

  it('changer de modèle garde toutes les sections communes, donc tout le contenu', () => {
    for (const modele of Object.keys(MODELES_SITE) as ModeleSite[]) {
      const ids = Object.keys(sectionsDuModele(modele));
      for (const id of Object.keys(SECTIONS)) expect(ids, `${modele} → ${id}`).toContain(id);
    }
  });

  it('Prestige présente chaque section à sa façon et a ses sections propres', () => {
    const prestige = sectionsDuModele('prestige');
    const teranga = sectionsDuModele('teranga');
    for (const id of Object.keys(SECTIONS)) {
      expect(prestige[id].Composant, id).not.toBe(SECTIONS[id].Composant);
      expect(prestige[id].Composant, id).not.toBe(teranga[id].Composant);
    }
    for (const id of ['manifeste', 'distinctions', 'destinations', 'visite']) {
      expect(prestige[id], id).toBeDefined();
      expect(SECTIONS[id], `${id} ne doit pas apparaître dans les autres modèles`).toBeUndefined();
    }
  });

  it('l\'ordre des pages de Prestige ne cite que des sections de Prestige', () => {
    const prestige = sectionsDuModele('prestige');
    for (const [page, ids] of Object.entries(CONTENU_DEFAUT.pagesPrestige)) {
      for (const id of ids) expect(prestige[id], `${page} → ${id}`).toBeDefined();
    }
  });

  it('Campus présente chaque section à sa façon, a ses sections propres et son propre ordre', () => {
    const campus = sectionsDuModele('campus');
    const autres = (['institution', 'teranga', 'prestige'] as ModeleSite[]).map(sectionsDuModele);
    for (const id of Object.keys(SECTIONS)) {
      for (const autre of autres) expect(campus[id].Composant, id).not.toBe(autre[id].Composant);
    }
    for (const id of ['apropos', 'vie-campus', 'communiques', 'bandeau-resultats', 'agenda', 'bande-photos']) {
      expect(campus[id], id).toBeDefined();
      expect(sectionsDuModele('prestige')[id], `${id} ne doit pas apparaître dans Prestige`).toBeUndefined();
    }
    for (const [page, ids] of Object.entries(CONTENU_DEFAUT.pagesCampus)) {
      for (const id of ids) expect(campus[id], `${page} → ${id}`).toBeDefined();
    }
  });

  it('Baobab présente chaque section à sa façon, a ses sections propres et son propre ordre', () => {
    const baobab = sectionsDuModele('baobab');
    const autres = (['institution', 'teranga', 'prestige', 'campus'] as ModeleSite[]).map(sectionsDuModele);
    for (const id of Object.keys(SECTIONS)) {
      for (const autre of autres) expect(baobab[id].Composant, id).not.toBe(autre[id].Composant);
    }
    for (const id of ['confiance', 'journee', 'evolution', 'question']) {
      expect(baobab[id], id).toBeDefined();
      expect(sectionsDuModele('campus')[id], `${id} ne doit pas apparaître dans Campus`).toBeUndefined();
    }
    for (const [page, ids] of Object.entries(CONTENU_DEFAUT.pagesBaobab)) {
      for (const id of ids) expect(baobab[id], `${page} → ${id}`).toBeDefined();
    }
  });
});
