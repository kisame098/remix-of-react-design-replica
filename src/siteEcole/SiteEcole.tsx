import { useEffect, useState, type ReactNode } from 'react';
import './site.css';
import { FournisseurEdition, useEdition } from './edition';
import type { Contenu } from './contenu';
import { GabaritTeranga } from './themes/teranga/GabaritTeranga';
import { GabaritPrestige } from './themes/prestige/GabaritPrestige';
import { GabaritCampus } from './themes/campus/GabaritCampus';
import { GabaritBaobab } from './themes/baobab/GabaritBaobab';
import { Gabarit } from './Gabarit';
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

/** Le gabarit (en-tête, menu, pied de page) du modèle choisi par l'école. */
function Habillage({ page, article, children }: { page: string; article: boolean; children: ReactNode }) {
  const { contenu } = useEdition();
  const modele = contenu.identite.modele;
  if (modele === 'prestige') return <GabaritPrestige page={page} sansBandeau={article}>{children}</GabaritPrestige>;
  if (modele === 'campus') return <GabaritCampus page={page} sansBandeau={article}>{children}</GabaritCampus>;
  if (modele === 'baobab') return <GabaritBaobab page={page}>{children}</GabaritBaobab>;
  const Composant = modele === 'teranga' ? GabaritTeranga : Gabarit;
  return <Composant page={page}>{children}</Composant>;
}
