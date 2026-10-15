import { useEffect, useState, type ReactNode } from 'react';
import './site.css';
import { FournisseurEdition } from './edition';
import Habillage from './Habillage';
import type { Contenu } from './contenu';
import BarreEdition from './BarreEdition';
import { PageSections } from './sections';
import { PageArticle } from './pages/Actualites';
import { routeDepuisHash } from './utilitaires';

/**
 * Le site d'une école, complet. Le même composant sert :
 *   - dans le SaaS (directeur d'une école bêta) : modifiable, enregistré dans Supabase ;
 *   - sur le site public (/site/:cle) : en lecture seule ;
 *   - dans le labo : modifiable, enregistré dans le navigateur.
 * Les pages du site sont dans l'ancre de l'adresse (#/admissions…).
 */
export default function SiteEcole({ initial, onChange, televerser, modifiable = true, editionInitiale = false, alerte, actions }: {
  initial: Contenu;
  onChange?: (c: Contenu) => void;
  televerser?: (f: File) => Promise<string>;
  modifiable?: boolean;
  editionInitiale?: boolean;
  alerte?: string | null;
  actions?: ReactNode;
}) {
  const [route, setRoute] = useState(() => routeDepuisHash(location.hash));
  useEffect(() => {
    // Chaque page s'ouvre en haut : le navigateur ne doit pas rouvrir au milieu de l'ancienne position.
    const avant = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const f = () => { setRoute(routeDepuisHash(location.hash)); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', f);
    return () => { window.removeEventListener('hashchange', f); history.scrollRestoration = avant; };
  }, []);

  return (
    <FournisseurEdition initial={initial} onChange={onChange} televerser={televerser} modifiable={modifiable} editionInitiale={editionInitiale} alerte={alerte}>
      <Habillage page={route.page} article={route.page === 'actualites' && !!route.sous}>
        {route.page === 'actualites' && route.sous ? <PageArticle id={route.sous} /> : <PageSections page={route.page} />}
      </Habillage>
      {modifiable && <BarreEdition actions={actions} />}
    </FournisseurEdition>
  );
}
