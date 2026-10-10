import { describe, it, expect } from 'vitest';
import { enDeuxParFeuille, ECHELLE_DEMI_PAGE } from './deuxParFeuille';
import { assemblerDocuments, CLASSE_PAGE } from './modelesDocuments';
import { visuelVersHtml, documentVierge, nouvelElement, type ElementTexte } from './documentVisuel';

const lire = (html: string) => new DOMParser().parseFromString(html, 'text/html');

const pageVisuelle = (texte: string) => {
  const d = documentVierge();
  d.elements = [{ ...nouvelElement('texte', 'portrait'), html: texte } as ElementTexte];
  return visuelVersHtml(d);
};

describe('deux documents par feuille', () => {
  it('3 élèves → 2 feuilles A4 horizontales : 2 demi-pages puis 1', () => {
    const html = enDeuxParFeuille(assemblerDocuments(['DIOP', 'FALL', 'SECK'].map(pageVisuelle)));
    const doc = lire(html);
    const doubles = Array.from(doc.querySelectorAll('.senclass-double'));
    expect(doubles).toHaveLength(2);
    expect(doubles.map(d => d.querySelectorAll('.senclass-demi').length)).toEqual([2, 1]);
    expect(doubles.map(d => d.textContent?.replace(/\s+/g, ''))).toEqual(['DIOPFALL', 'SECK']);
    expect(html).toContain('size: A4 landscape');
  });

  it('pour le PDF, seule la feuille réelle est une « page » (pas les documents réduits qu\'elle contient)', () => {
    const doc = lire(enDeuxParFeuille(assemblerDocuments(['A', 'B'].map(pageVisuelle))));
    expect(Array.from(doc.querySelectorAll(`.${CLASSE_PAGE}`)).every(e => e.classList.contains('senclass-double'))).toBe(true);
    expect(doc.querySelectorAll(`.${CLASSE_PAGE}`)).toHaveLength(1);
  });

  it('réduction exacte A4 → A5 (1/√2), et les marges @page d\'un modèle HTML suivent dans la demi-page', () => {
    expect(ECHELLE_DEMI_PAGE).toBeCloseTo(0.7071, 4);
    const modele = '<!DOCTYPE html><html><head><style>@page { size: A4; margin: 2cm 2.5cm }</style></head><body><p>Texte</p></body></html>';
    const html = enDeuxParFeuille(assemblerDocuments([modele, modele]));
    expect(html).toContain('padding:2cm 2.5cm');
    expect(html).toContain(`scale(${ECHELLE_DEMI_PAGE})`);
  });
});
