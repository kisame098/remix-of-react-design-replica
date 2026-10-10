import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { CLASSE_FEUILLE, versionImprimee } from '@/lib/modelesDocuments';
import { nomDeFichier } from '@/lib/documentsEcole';

// ═══════════════════════════════════════════════════════════════════════════
// SORTIE DES MODÈLES HTML : impression et PDF
//
// Chargé seulement au clic (html2canvas et jsPDF pèsent lourd) — d'où sa
// place dans FICHIERS_D_ACTION (src/lib/rechargementApresDeploiement.ts).
//
// Le HTML reçu ici est DÉJÀ rempli et nettoyé. Il est quand même posé dans un
// cadre isolé (sandbox sans allow-scripts) : rien ne peut s'y exécuter.
// ═══════════════════════════════════════════════════════════════════════════

/** 210 mm à 96 points par pouce : la largeur d'une feuille A4 à l'écran. */
const LARGEUR_A4_PX = 794;

const creerCadre = (html: string, visible: boolean): Promise<HTMLIFrameElement> =>
  new Promise((resolve, reject) => {
    const cadre = document.createElement('iframe');
    // allow-same-origin : pour lire le contenu (capture, impression) ;
    // allow-modals : pour ouvrir la fenêtre d'impression. Jamais allow-scripts.
    cadre.setAttribute('sandbox', 'allow-same-origin allow-modals');
    cadre.setAttribute('aria-hidden', 'true');
    cadre.style.position = 'fixed';
    cadre.style.left = visible ? '-10000px' : '0';
    cadre.style.top = '0';
    cadre.style.width = `${LARGEUR_A4_PX}px`;
    cadre.style.height = visible ? '1123px' : '0';
    cadre.style.border = '0';
    if (!visible) cadre.style.visibility = 'hidden';
    const delai = window.setTimeout(() => reject(new Error('Le document ne se charge pas.')), 15000);
    cadre.onload = () => { window.clearTimeout(delai); resolve(cadre); };
    cadre.srcdoc = html;
    document.body.appendChild(cadre);
  });

/** Les images (logo, cachet) doivent être prêtes avant d'imprimer ou de capturer. */
const imagesChargees = async (doc: Document): Promise<void> => {
  await Promise.all(Array.from(doc.images).map(img => (img.complete ? Promise.resolve() : new Promise<void>(r => {
    img.onload = () => r(); img.onerror = () => r();
  }))));
  await doc.fonts?.ready;
};

/**
 * Imprime avec le moteur du navigateur : rendu exactement fidèle au HTML,
 * texte net ; « Enregistrer en PDF » y est proposé par le navigateur.
 */
export const imprimerHtml = async (html: string): Promise<void> => {
  const cadre = await creerCadre(html, false);
  const fenetre = cadre.contentWindow;
  if (!fenetre || !cadre.contentDocument) { cadre.remove(); throw new Error("Impossible d'ouvrir l'impression."); }
  await imagesChargees(cadre.contentDocument);
  const retirer = () => window.setTimeout(() => cadre.remove(), 1000);
  fenetre.addEventListener('afterprint', retirer, { once: true });
  fenetre.focus();
  fenetre.print();
  // Certains navigateurs n'émettent pas afterprint : on nettoie quand même.
  window.setTimeout(() => { if (cadre.isConnected) cadre.remove(); }, 120000);
};

/**
 * Fabrique un PDF A4 : chaque feuille (un élève) est photographiée puis posée
 * sur sa page. Les règles « @media print » du modèle s'appliquent (fond blanc,
 * marges d'écran retirées). Le texte du PDF est une image : moins net qu'une
 * impression, mais c'est un vrai fichier à envoyer ou archiver.
 */
export const fabriquerPdfHtml = async (html: string): Promise<jsPDF> => {
  const cadre = await creerCadre(versionImprimee(html), true);
  try {
    const doc = cadre.contentDocument;
    if (!doc) throw new Error('Document illisible.');
    await imagesChargees(doc);
    const feuilles = Array.from(doc.querySelectorAll<HTMLElement>(`.${CLASSE_FEUILLE}`));
    const aCapturer = feuilles.length > 0 ? feuilles : [doc.body];
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const largeurPage = 210;
    const hauteurPage = 297;
    for (const [i, feuille] of aCapturer.entries()) {
      const toile = await html2canvas(feuille, {
        scale: 2, backgroundColor: '#ffffff', useCORS: false, logging: false,
        windowWidth: LARGEUR_A4_PX, width: Math.max(feuille.scrollWidth, LARGEUR_A4_PX),
      });
      if (i > 0) pdf.addPage('a4', 'portrait');
      // Toute la largeur ; si la feuille dépasse un peu en hauteur, on réduit pour qu'elle tienne.
      const ratio = Math.min(largeurPage / toile.width, hauteurPage / toile.height);
      const w = toile.width * ratio;
      const h = toile.height * ratio;
      pdf.addImage(toile.toDataURL('image/jpeg', 0.92), 'JPEG', (largeurPage - w) / 2, 0, w, h);
    }
    return pdf;
  } finally {
    cadre.remove();
  }
};

export const telechargerPdfHtml = async (html: string, nom: string): Promise<void> => {
  const pdf = await fabriquerPdfHtml(html);
  pdf.save(`${nomDeFichier(nom) || 'document'}.pdf`);
};
