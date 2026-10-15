import { createRoot } from 'react-dom/client';
import '@/index.css';
import SiteEcole from '@/siteEcole/SiteEcole';
import { contenuDepuis } from '@/siteEcole/edition';

// Labo : le site est gardé dans ce navigateur. Dans le SaaS, il est enregistré dans Supabase.
const CLE = 'labo.site-ecole.contenu';

function lire() {
  try { return contenuDepuis(JSON.parse(localStorage.getItem(CLE) ?? 'null')); } catch { return contenuDepuis(null); }
}

createRoot(document.getElementById('root')!).render(
  <SiteEcole
    initial={lire()}
    onChange={c => { try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* photos trop lourdes pour le navigateur */ } }}
  />,
);
