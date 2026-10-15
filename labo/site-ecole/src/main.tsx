import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import './site.css';
import { FournisseurEdition } from './edition';
import { Gabarit } from './Gabarit';
import BarreEdition from './BarreEdition';
import { pageDepuisHash } from './utilitaires';
import Accueil from './pages/Accueil';
import Ecole from './pages/Ecole';
import Enseignement from './pages/Enseignement';
import VieScolaire from './pages/VieScolaire';
import Admissions from './pages/Admissions';
import Actualites from './pages/Actualites';
import Contact from './pages/Contact';

const PAGES: Record<string, () => JSX.Element> = {
  '': Accueil, ecole: Ecole, enseignement: Enseignement, 'vie-scolaire': VieScolaire,
  admissions: Admissions, actualites: Actualites, contact: Contact,
};

function Site() {
  const [page, setPage] = useState(() => pageDepuisHash(location.hash));
  useEffect(() => {
    const f = () => { setPage(pageDepuisHash(location.hash)); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  const Page = PAGES[page] ?? Accueil;

  return (
    <FournisseurEdition>
      <Gabarit page={page}><Page /></Gabarit>
      <BarreEdition />
    </FournisseurEdition>
  );
}

createRoot(document.getElementById('root')!).render(<Site />);
