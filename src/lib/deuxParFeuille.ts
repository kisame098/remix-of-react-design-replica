import { CLASSE_DEMI, CLASSE_FEUILLE, CLASSE_PAGE, CLASSE_ZONE, lireReglagesPage } from '@/lib/modelesDocuments';

// ═══════════════════════════════════════════════════════════════════════════
// DEUX DOCUMENTS PAR FEUILLE (demi-page)
//
// Pour les écoles qui économisent le papier : la feuille A4 passe à
// l'horizontale et reçoit deux documents côte à côte, chacun exactement au
// format d'une demi-feuille (A5, 148,5 × 210 mm). On coupe au pointillé.
//
// Chaque document reste dessiné en A4 et est réduit à 1/√2 (≈ 71 %) : c'est
// le rapport exact entre A4 et A5, rien n'est déformé ni rogné. Marche pour
// tous les modèles (page de l'éditeur, HTML, Word), à l'impression et en PDF.
//
// Retenu sur cet ordinateur, comme le choix couleur / noir et blanc.
// ═══════════════════════════════════════════════════════════════════════════

/** Rapport A5 / A4. */
export const ECHELLE_DEMI_PAGE = Math.SQRT1_2;

const CLASSE_DOUBLE = 'senclass-double';
const CLASSE_A4 = 'senclass-a4';

const STYLE = `
@page { size: A4 landscape; margin: 0; }
.${CLASSE_DOUBLE} { position: relative; width: 297mm; height: 210mm; display: flex; overflow: hidden; background: #fff;
  break-after: page; page-break-after: always; box-sizing: border-box; }
.${CLASSE_DOUBLE}:last-child { break-after: auto; page-break-after: auto; }
.${CLASSE_DEMI} { position: relative; width: 148.5mm; height: 210mm; overflow: hidden; flex: none; }
.${CLASSE_DEMI} + .${CLASSE_DEMI} { border-left: 0.2mm dashed #000; }
.${CLASSE_A4} { position: absolute; left: 0; top: 0; width: 210mm; height: 297mm; box-sizing: border-box; overflow: hidden;
  background: #fff; display: flex; flex-direction: column; transform: scale(${ECHELLE_DEMI_PAGE}); transform-origin: top left; }
.${CLASSE_A4} > *, .${CLASSE_A4} > section.docx { margin: 0 !important; box-shadow: none !important; }
.${CLASSE_A4} .${CLASSE_ZONE} { flex: 1 1 auto; position: relative; }
@media screen { html, body { background: #e5e5e5; } body { margin: 0; } .${CLASSE_DOUBLE} { margin: 20px auto; } }
`;

const lireDocument = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

/**
 * Un document assemblé (une feuille par personne) → les mêmes documents, deux
 * par feuille A4 horizontale. Une personne dont le document a plusieurs pages
 * (Word) occupe plusieurs demi-feuilles, dans l'ordre.
 */
export const enDeuxParFeuille = (html: string): string => {
  const doc = lireDocument(html);
  const { marges } = lireReglagesPage(html);

  // Les unités à placer : chaque page A4 (éditeur, Word), sinon chaque feuille entière.
  const unites: HTMLElement[] = [];
  for (const feuille of Array.from(doc.querySelectorAll<HTMLElement>(`body > .${CLASSE_FEUILLE}`))) {
    const pages = Array.from(feuille.querySelectorAll<HTMLElement>(`.${CLASSE_PAGE}`));
    if (pages.length > 0) {
      for (const p of pages) { p.classList.remove(CLASSE_PAGE); unites.push(p); }
    } else {
      // Feuille d'un modèle HTML : ses marges @page deviennent les marges de la demi-feuille.
      const contenu = doc.createElement('div');
      contenu.style.cssText = 'flex:1 1 auto;display:flex;flex-direction:column;box-sizing:border-box;' + (marges ? `padding:${marges};` : '');
      contenu.append(...Array.from(feuille.childNodes));
      unites.push(contenu);
    }
  }

  const feuilles: HTMLElement[] = [];
  for (let i = 0; i < unites.length; i += 2) {
    const double = doc.createElement('div');
    // C'est la feuille réelle : le PDF la photographie comme une page.
    double.className = `${CLASSE_DOUBLE} ${CLASSE_PAGE}`;
    for (const unite of unites.slice(i, i + 2)) {
      const demi = doc.createElement('div');
      demi.className = CLASSE_DEMI;
      const a4 = doc.createElement('div');
      a4.className = CLASSE_A4;
      a4.appendChild(unite);
      demi.appendChild(a4);
      double.appendChild(demi);
    }
    feuilles.push(double);
  }
  doc.body.replaceChildren(...feuilles);
  const style = doc.createElement('style');
  style.textContent = STYLE;
  doc.head.appendChild(style);
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
};

export { lireDeuxParFeuille, retenirDeuxParFeuille } from '@/lib/choixDeuxParFeuille';

/**
 * Un reçu seul sur une demi-feuille : la feuille A4 passe à l'horizontale, le
 * reçu occupe la moitié gauche (l'autre reste libre), pointillé de coupe.
 * Un modèle A5 est posé tel quel ; un modèle A4 est réduit à la demi-page.
 */
export const recuSurDemiFeuille = (html: string): string => {
  if (!/@page[^{]*\{[^}]*size\s*:\s*A5/i.test(html)) return enDeuxParFeuille(html);
  const doc = lireDocument(html);
  const page = doc.querySelector<HTMLElement>(`.${CLASSE_PAGE}`)
    ?? doc.querySelector<HTMLElement>(`body > .${CLASSE_FEUILLE}`)
    ?? doc.body.firstElementChild as HTMLElement | null;
  if (!page) return html;
  page.classList.remove(CLASSE_PAGE);
  const double = doc.createElement('div');
  double.className = `${CLASSE_DOUBLE} ${CLASSE_PAGE}`;
  const demi = doc.createElement('div');
  demi.className = CLASSE_DEMI;
  demi.appendChild(page);
  const vide = doc.createElement('div');
  vide.className = CLASSE_DEMI;
  double.append(demi, vide);
  doc.body.replaceChildren(double);
  const style = doc.createElement('style');
  style.textContent = `${STYLE}\n.${CLASSE_DEMI} > * { margin: 0 !important; box-shadow: none !important; }`;
  doc.head.appendChild(style);
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
};
