import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { referencementDe } from '@/lib/referencement';

/**
 * Tient à jour, à chaque changement de page, le titre de l'onglet et la
 * consigne `robots` lue par Google. Les règles vivent dans
 * src/lib/referencement.ts.
 */
export const Referencement = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const { titre, indexer } = referencementDe(pathname);
    document.title = titre;

    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = indexer ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';
  }, [pathname]);

  return null;
};
