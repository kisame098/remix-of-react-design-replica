import { useEffect, useState, type ReactNode } from 'react';
import './site.css';
import { FournisseurEdition, PAGES_INTERNES } from './edition';
import Habillage from './Habillage';
import type { Contenu } from './contenu';
import BarreEdition from './BarreEdition';
import { PageSections } from './sections';
import { PageArticle } from './pages/Actualites';
import { cheminDepuisLien, routeDepuisChemin, routeDepuisHash } from './utilitaires';

/**
 * Le site d'une école, complet. Le même composant sert :
 *   - dans le SaaS (directeur de l'école) : modifiable, enregistré dans Supabase ;
 *   - sur le site public (/site/:cle) : en lecture seule ;
 *   - dans le labo : modifiable, enregistré dans le navigateur.
 * Les liens internes s'écrivent « #/admissions ». Dans l'éditeur, les pages restent
 * dans l'ancre de l'adresse ; sur le site publié (`base` donnée), elles deviennent de
 * vraies adresses (/admissions), pour que Google indexe chaque page et chaque article.
 */
export default function SiteEcole({ initial, onChange, televerser, modifiable = true, editionInitiale = false, alerte, actions, base }: {
  initial: Contenu;
  onChange?: (c: Contenu) => void;
  televerser?: (f: File) => Promise<string>;
  modifiable?: boolean;
  editionInitiale?: boolean;
  alerte?: string | null;
  actions?: ReactNode;
  /** Site publié : début des adresses des pages ('' sur le sous-domaine, '/site/<adresse>' sinon). */
  base?: string;
}) {
  const [route, setRoute] = useState(() => {
    if (base === undefined) return routeDepuisHash(location.hash);
    // Ancien lien partagé en « #/admissions » : on le remplace par la vraie adresse.
    const ancien = cheminDepuisLien(location.hash, base);
    if (ancien) history.replaceState(null, '', ancien);
    return routeDepuisChemin(location.pathname, base);
  });

  useEffect(() => {
    // Chaque page s'ouvre en haut : le navigateur ne doit pas rouvrir au milieu de l'ancienne position.
    const avant = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    if (base === undefined) {
      const f = () => { setRoute(routeDepuisHash(location.hash)); window.scrollTo({ top: 0 }); };
      window.addEventListener('hashchange', f);
      return () => { window.removeEventListener('hashchange', f); history.scrollRestoration = avant; };
    }

    const afficher = () => { setRoute(routeDepuisChemin(location.pathname, base)); window.scrollTo({ top: 0 }); };
    const aller = (chemin: string) => { history.pushState(null, '', chemin); afficher(); };
    // Les liens « #/… » du site deviennent de vraies adresses, que Google peut suivre.
    const reecrire = () => document.querySelectorAll<HTMLAnchorElement>('a[href^="#/"]').forEach(a => {
      const chemin = cheminDepuisLien(a.getAttribute('href')!, base);
      if (chemin) a.setAttribute('href', chemin);
    });
    reecrire();
    const observateur = new MutationObserver(reecrire);
    observateur.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
    // Un clic sur une page du site change de page sans recharger.
    const clic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || (a.target && a.target !== '_self')) return;
      const href = a.getAttribute('href') ?? '';
      const chemin = cheminDepuisLien(href, base) ?? (href.startsWith('/') && !href.startsWith('//') ? href : null);
      if (!chemin || (base && !(chemin === base || chemin.startsWith(`${base}/`)))) return;
      e.preventDefault();
      if (chemin !== location.pathname) aller(chemin);
    };
    // « location.hash = '#/admissions' » (formulaires, cartes) : même traitement.
    const ancre = () => { const chemin = cheminDepuisLien(location.hash, base); if (chemin) { history.replaceState(null, '', chemin); afficher(); } };
    document.addEventListener('click', clic);
    window.addEventListener('popstate', afficher);
    window.addEventListener('hashchange', ancre);
    return () => {
      observateur.disconnect();
      document.removeEventListener('click', clic);
      window.removeEventListener('popstate', afficher);
      window.removeEventListener('hashchange', ancre);
      history.scrollRestoration = avant;
    };
  }, [base]);

  // Site publié : le titre de l'onglet (et de Google) suit la page ouverte.
  useEffect(() => {
    if (base === undefined) return;
    document.title = titreDePage(initial, route);
  }, [base, initial, route]);

  return (
    <FournisseurEdition initial={initial} onChange={onChange} televerser={televerser} modifiable={modifiable} editionInitiale={editionInitiale} alerte={alerte}>
      <Habillage page={route.page} article={route.page === 'actualites' && !!route.sous}>
        {route.page === 'actualites' && route.sous ? <PageArticle id={route.sous} /> : <PageSections page={route.page} />}
      </Habillage>
      {modifiable && <BarreEdition actions={actions} />}
    </FournisseurEdition>
  );
}

/** « Admissions | Groupe Scolaire Excellence » — le même titre que celui donné à Google par le serveur. */
export function titreDePage(contenu: Contenu, route: { page: string; sous: string }): string {
  const nom = contenu.identite.nom;
  if (route.page === 'actualites' && route.sous) {
    const article = contenu.actualites.elements.find(a => a.id === route.sous);
    if (article) return `${article.titre} | ${nom}`;
  }
  const page = PAGES_INTERNES.find(p => p.lien === `#/${route.page}`);
  return route.page && page ? `${page.nom} | ${nom}` : nom;
}
