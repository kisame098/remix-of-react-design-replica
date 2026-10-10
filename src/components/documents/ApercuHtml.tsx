import { useEffect, useRef, useState } from 'react';

/** Largeur d'une feuille A4 à l'écran (210 mm à 96 points par pouce). */
const LARGEUR_A4_PX = 794;

/**
 * Aperçu d'un document HTML, réduit à la largeur disponible. S'adapte à une
 * feuille plus large (A4 horizontal : deux documents par feuille).
 *
 * Le HTML vient d'une école : il est affiché dans un cadre isolé SANS
 * allow-scripts — rien ne peut s'y exécuter. allow-same-origin sert seulement
 * à mesurer le contenu.
 */
export const ApercuHtml = ({ html, titre = 'Aperçu du document' }: { html: string; titre?: string }) => {
  const conteneur = useRef<HTMLDivElement>(null);
  const cadre = useRef<HTMLIFrameElement>(null);
  const [dispo, setDispo] = useState(LARGEUR_A4_PX);
  const [largeur, setLargeur] = useState(LARGEUR_A4_PX);
  const [hauteur, setHauteur] = useState(1123);
  const echelle = Math.min(1, dispo / largeur);

  useEffect(() => {
    const el = conteneur.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entree]) => setDispo(entree.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Nouveau document : on repart d'un cadre A4 avant de mesurer (sinon une
  // feuille horizontale laisserait le cadre trop large pour le suivant).
  useEffect(() => { setLargeur(LARGEUR_A4_PX); }, [html]);

  /**
   * Taille du CONTENU, mesurée élément par élément : la hauteur de défilement
   * du document vaut au moins celle du cadre, qui garderait la taille du
   * document précédent (une feuille horizontale laissait un grand vide gris).
   */
  const mesurer = () => {
    const doc = cadre.current?.contentDocument;
    const vue = doc?.defaultView;
    if (!doc?.body || !vue) return;
    let bas = 0;
    let droite = 0;
    for (const el of Array.from(doc.body.children)) {
      const r = el.getBoundingClientRect();
      const cs = vue.getComputedStyle(el);
      // Une feuille plus large que le cadre a une marge droite négative : on l'ignore.
      bas = Math.max(bas, r.bottom + Math.max(0, parseFloat(cs.marginBottom) || 0));
      droite = Math.max(droite, r.right + Math.max(0, parseFloat(cs.marginRight) || 0));
    }
    setLargeur(Math.max(LARGEUR_A4_PX, Math.ceil(droite)));
    // + 20 px : la marge grise sous la dernière feuille (elle « traverse » son parent et échappe à la mesure).
    setHauteur(Math.max(200, Math.ceil(bas + 20 + (parseFloat(vue.getComputedStyle(doc.body).paddingBottom) || 0))));
  };

  return (
    <div ref={conteneur} className="w-full overflow-hidden rounded-lg border bg-muted/40">
      <div style={{ height: hauteur * echelle }}>
        <iframe
          ref={cadre}
          title={titre}
          sandbox="allow-same-origin"
          srcDoc={html}
          onLoad={mesurer}
          style={{
            width: largeur, height: hauteur, border: 0, background: 'white',
            transform: `scale(${echelle})`, transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  );
};
