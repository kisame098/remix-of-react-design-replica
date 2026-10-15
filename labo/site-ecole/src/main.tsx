import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import './site.css';
import { FournisseurEdition } from './edition';
import { Gabarit } from './Gabarit';
import BarreEdition from './BarreEdition';
import { PageSections } from './sections';
import { PageArticle } from './pages/Actualites';
import { routeDepuisHash } from './utilitaires';

function Site() {
  const [route, setRoute] = useState(() => routeDepuisHash(location.hash));
  useEffect(() => {
    const f = () => { setRoute(routeDepuisHash(location.hash)); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  return (
    <FournisseurEdition>
      <Gabarit page={route.page}>
        {route.page === 'actualites' && route.sous
          ? <PageArticle id={route.sous} />
          : <PageSections page={route.page} />}
      </Gabarit>
      <BarreEdition />
    </FournisseurEdition>
  );
}

createRoot(document.getElementById('root')!).render(<Site />);
