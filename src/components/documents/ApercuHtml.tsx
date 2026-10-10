import { useEffect, useRef, useState } from 'react';

/** Largeur d'une feuille A4 à l'écran (210 mm à 96 points par pouce). */
const LARGEUR_A4_PX = 794;

/**
 * Aperçu d'un document HTML, réduit à la largeur disponible.
 *
 * Le HTML vient d'une école : il est affiché dans un cadre isolé SANS
 * allow-scripts — rien ne peut s'y exécuter. allow-same-origin sert seulement
 * à mesurer la hauteur du contenu.
 */
export const ApercuHtml = ({ html, titre = 'Aperçu du document' }: { html: string; titre?: string }) => {
  const conteneur = useRef<HTMLDivElement>(null);
  const cadre = useRef<HTMLIFrameElement>(null);
  const [echelle, setEchelle] = useState(1);
  const [hauteur, setHauteur] = useState(1123);

  useEffect(() => {
    const el = conteneur.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entree]) => {
      setEchelle(Math.min(1, entree.contentRect.width / LARGEUR_A4_PX));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const mesurer = () => {
    const doc = cadre.current?.contentDocument;
    if (doc?.documentElement) setHauteur(Math.max(200, doc.documentElement.scrollHeight));
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
            width: LARGEUR_A4_PX, height: hauteur, border: 0, background: 'white',
            transform: `scale(${echelle})`, transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  );
};
