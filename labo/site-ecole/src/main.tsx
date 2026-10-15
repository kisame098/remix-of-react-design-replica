import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import './site.css';
import { FournisseurEdition, useEdition } from './edition';
import { GabaritTeranga } from './themes/teranga/GabaritTeranga';
import { GabaritPrestige } from './themes/prestige/GabaritPrestige';
import { GabaritCampus } from './themes/campus/GabaritCampus';
import { GabaritBaobab } from './themes/baobab/GabaritBaobab';
import { Gabarit } from './Gabarit';
import BarreEdition from './BarreEdition';
import { PageSections } from './sections';
import { PageArticle } from './pages/Actualites';
import { routeDepuisHash } from './utilitaires';

// Chaque page s'ouvre en haut : le navigateur ne doit pas rouvrir au milieu de l'ancienne position.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function Site() {
  const [route, setRoute] = useState(() => routeDepuisHash(location.hash));
  useEffect(() => {
    const f = () => { setRoute(routeDepuisHash(location.hash)); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  return (
    <FournisseurEdition>
      <Habillage page={route.page} article={route.page === 'actualites' && !!route.sous}>
        {route.page === 'actualites' && route.sous
          ? <PageArticle id={route.sous} />
          : <PageSections page={route.page} />}
      </Habillage>
      <BarreEdition />
    </FournisseurEdition>
  );
}

/** Le gabarit (en-tête, menu, pied de page) du modèle choisi par l'école. */
function Habillage({ page, article, children }: { page: string; article: boolean; children: React.ReactNode }) {
  const { contenu } = useEdition();
  const modele = contenu.identite.modele;
  if (modele === 'prestige') return <GabaritPrestige page={page} sansBandeau={article}>{children}</GabaritPrestige>;
  if (modele === 'campus') return <GabaritCampus page={page} sansBandeau={article}>{children}</GabaritCampus>;
  if (modele === 'baobab') return <GabaritBaobab page={page}>{children}</GabaritBaobab>;
  const Composant = modele === 'teranga' ? GabaritTeranga : Gabarit;
  return <Composant page={page}>{children}</Composant>;
}

createRoot(document.getElementById('root')!).render(<Site />);
