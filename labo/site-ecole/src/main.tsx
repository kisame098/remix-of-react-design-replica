import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import './site.css';
import { FournisseurEdition, useEdition } from './edition';
import { GabaritTeranga } from './themes/teranga/GabaritTeranga';
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
      <Habillage page={route.page}>
        {route.page === 'actualites' && route.sous
          ? <PageArticle id={route.sous} />
          : <PageSections page={route.page} />}
      </Habillage>
      <BarreEdition />
    </FournisseurEdition>
  );
}

/** Le gabarit (en-tête, menu, pied de page) du modèle choisi par l'école. */
function Habillage({ page, children }: { page: string; children: React.ReactNode }) {
  const { contenu } = useEdition();
  const Composant = contenu.identite.modele === 'teranga' ? GabaritTeranga : Gabarit;
  return <Composant page={page}>{children}</Composant>;
}

createRoot(document.getElementById('root')!).render(<Site />);
