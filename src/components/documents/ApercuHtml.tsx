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

  // Nouveau document : on repart de la largeur A4, puis on mesure (sinon une
  // feuille horizontale laisserait le cadre trop large pour le document suivant).
  useEffect(() => { setLargeur(LARGEUR_A4_PX); }, [html]);

  const mesurer = () => {
    const doc = cadre.current?.contentDocument;
    if (!doc?.documentElement) return;
    setLargeur(Math.max(LARGEUR_A4_PX, doc.documentElement.scrollWidth));
    setHauteur(Math.max(200, doc.documentElement.scrollHeight));
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
