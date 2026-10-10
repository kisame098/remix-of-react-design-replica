import { renderAsync } from 'docx-preview';
import { CLASSE_PAGE } from '@/lib/modelesDocuments';

// ═══════════════════════════════════════════════════════════════════════════
// AFFICHER UN WORD REMPLI (aperçu, impression, PDF)
//
// Le navigateur ne sait pas lire un .docx : docx-preview le redessine en
// HTML, page par page. Le rendu est TRÈS proche de Word mais pas identique au
// millimètre (polices absentes, objets flottants complexes) : le fichier Word
// rempli, lui, est exact — c'est pourquoi on le propose aussi au téléchargement.
//
// Chargé seulement au clic (FICHIERS_D_ACTION).
// ═══════════════════════════════════════════════════════════════════════════

const STYLE_IMPRESSION = `
@page { margin: 0; }
body { margin: 0; background: #e5e5e5; }
.docx-wrapper { background: transparent !important; padding: 0 !important; display: block !important; }
section.docx { margin: 20px auto !important; box-shadow: none !important; }
@media print { body { background: white; } section.docx { margin: 0 !important; } }
`;

/** Un Word (rempli) → un document HTML complet, une `CLASSE_PAGE` par page Word. */
export const wordVersHtml = async (fichier: Uint8Array): Promise<string> => {
  const corps = document.createElement('div');
  const styles = document.createElement('div');
  await renderAsync(new Blob([fichier]), corps, styles, {
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    useBase64URL: true,
    experimental: true,
  });
  for (const page of Array.from(corps.querySelectorAll('section.docx'))) page.classList.add(CLASSE_PAGE);
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">${styles.innerHTML}<style>${STYLE_IMPRESSION}</style></head><body>${corps.innerHTML}</body></html>`;
};
