import { describe, it, expect } from 'vitest';
import {
  deplacer, redimensionner, changerPlan, dupliquerElement, supprimerElement, changerOrientation,
  reduireHistorique, historiqueInitial, TAILLE_MIN, PROFONDEUR_HISTORIQUE,
} from './editeurVisuel';
import { documentVierge, nouvelElement, type DocumentVisuel, type ElementVisuel } from './documentVisuel';

const boite = (x: number, y: number, l: number, h: number): ElementVisuel =>
  ({ ...nouvelElement('forme', 'portrait'), id: `b${x}${y}`, x, y, l, h });

const doc = (...elements: ElementVisuel[]): DocumentVisuel => ({ ...documentVierge(), elements });

describe('déplacer', () => {
  it('ajoute le déplacement, arrondi au dixième de mm', () => {
    expect(deplacer(boite(10, 10, 20, 20), 5.04, -3.26, doc()).element).toMatchObject({ x: 15, y: 6.7 });
  });

  it('colle au centre de la feuille (210 × 297) quand il passe tout près, et le signale', () => {
    // Centre horizontal : x + 20/2 = 105 → x = 95. On arrive à 96 : collé à 95.
    const r = deplacer(boite(0, 0, 20, 20), 96, 10, doc());
    expect(r.element.x).toBe(95);
    expect(r.guides).toEqual({ vertical: true, horizontal: false });
    expect(deplacer(boite(0, 0, 20, 20), 80, 10, doc()).guides.vertical).toBe(false);
  });
});

describe('redimensionner', () => {
  const b = boite(50, 50, 40, 20);

  it('par la droite ou le bas : seul le côté tiré bouge', () => {
    expect(redimensionner(b, 'e', 10, 0)).toMatchObject({ x: 50, l: 50, h: 20 });
    expect(redimensionner(b, 's', 0, 5)).toMatchObject({ y: 50, h: 25 });
  });

  it('par la gauche ou le haut : le côté opposé reste en place', () => {
    expect(redimensionner(b, 'w', 10, 0)).toMatchObject({ x: 60, l: 30 });
    expect(redimensionner(b, 'nw', -5, -5)).toMatchObject({ x: 45, y: 45, l: 45, h: 25 });
  });

  it('jamais plus petit que le minimum, sans faire sauter le côté opposé', () => {
    const r = redimensionner(b, 'w', 100, 0);
    expect(r.l).toBe(TAILLE_MIN);
    expect(r.x + r.l).toBe(90);
  });

  it('en gardant les proportions (image, touche Maj) par un coin', () => {
    const r = redimensionner(b, 'se', 40, 0, true);
    expect(r).toMatchObject({ l: 80, h: 40 });
    const g = redimensionner(b, 'nw', -40, 0, true);
    expect(g).toMatchObject({ l: 80, h: 40, x: 10, y: 30 });
  });
});

describe('plans, copie, suppression, orientation', () => {
  const a = boite(1, 1, 5, 5);
  const b = boite(2, 2, 5, 5);
  const c = boite(3, 3, 5, 5);

  it('premier plan, arrière-plan, avancer, reculer', () => {
    const d = doc(a, b, c);
    expect(changerPlan(d, a.id, 'premier').elements.map(e => e.id)).toEqual([b.id, c.id, a.id]);
    expect(changerPlan(d, c.id, 'arriere').elements.map(e => e.id)).toEqual([c.id, a.id, b.id]);
    expect(changerPlan(d, a.id, 'avancer').elements.map(e => e.id)).toEqual([b.id, a.id, c.id]);
    expect(changerPlan(d, a.id, 'reculer').elements.map(e => e.id)).toEqual([a.id, b.id, c.id]);
  });

  it('dupliquer : une copie indépendante, décalée, au premier plan', () => {
    const { doc: d, copie } = dupliquerElement(doc(a, b), a.id);
    expect(copie).toMatchObject({ x: 6, y: 6 });
    expect(copie!.id).not.toBe(a.id);
    expect(d.elements[2]).toBe(copie);
    expect(supprimerElement(d, copie!.id).elements).toHaveLength(2);
  });

  it('passer en paysage ramène dans la feuille un élément qui en sortirait', () => {
    const bas = boite(10, 280, 30, 10);
    const r = changerOrientation(doc(bas), 'paysage');
    expect(r.orientation).toBe('paysage');
    expect(r.elements[0].y).toBe(200);
  });
});

describe('annuler / rétablir', () => {
  const d0 = doc();
  const d1 = doc(boite(1, 1, 5, 5));
  const d2 = doc(boite(2, 2, 5, 5));

  it('chaque étape validée s\'annule puis se rétablit', () => {
    let h = historiqueInitial(d0);
    h = reduireHistorique(h, { type: 'valider', doc: d1 });
    h = reduireHistorique(h, { type: 'valider', doc: d2 });
    h = reduireHistorique(h, { type: 'annuler' });
    expect(h.present).toBe(d1);
    h = reduireHistorique(h, { type: 'annuler' });
    expect(h.present).toBe(d0);
    h = reduireHistorique(h, { type: 'annuler' });
    expect(h.present).toBe(d0);
    h = reduireHistorique(h, { type: 'retablir' });
    expect(h.present).toBe(d1);
  });

  it('un glisser ne fait qu\'UNE étape : on revient à la position d\'avant le glisser', () => {
    let h = historiqueInitial(d0);
    h = reduireHistorique(h, { type: 'direct', doc: d1 });
    h = reduireHistorique(h, { type: 'direct', doc: d2 });
    h = reduireHistorique(h, { type: 'valider', doc: d2, avant: d0 });
    expect(h.passe).toEqual([d0]);
    expect(reduireHistorique(h, { type: 'annuler' }).present).toBe(d0);
  });

  it('une nouvelle modification efface ce qu\'on pouvait rétablir ; l\'historique a une limite', () => {
    let h = historiqueInitial(d0);
    h = reduireHistorique(h, { type: 'valider', doc: d1 });
    h = reduireHistorique(h, { type: 'annuler' });
    h = reduireHistorique(h, { type: 'valider', doc: d2 });
    expect(h.futur).toEqual([]);
    for (let i = 0; i < PROFONDEUR_HISTORIQUE + 20; i++) h = reduireHistorique(h, { type: 'valider', doc: doc(boite(i, i, 5, 5)) });
    expect(h.passe.length).toBe(PROFONDEUR_HISTORIQUE);
  });
});
