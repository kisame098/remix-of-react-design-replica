// ═══════════════════════════════════════════════════════════════════════════
// WORKER CLOUDFLARE « sites-ecoles » — <adresse>.senclass.com
//
// Copie de référence du Worker en ligne (Cloudflare → Workers → sites-ecoles,
// route *.senclass.com/*). Le modifier ici PUIS le republier sur Cloudflare.
//
//   • Sert l'application (senclass.pages.dev) sous l'adresse de chaque école.
//   • Rend chaque site indexable par Google :
//       - retire l'interdiction d'indexer que Cloudflare met sur pages.dev ;
//       - réécrit l'en-tête de la page : titre, description, adresse officielle
//         (canonical), aperçu de partage WhatsApp/Facebook, fiche « École »
//         (schema.org) — page par page et article par article ;
//       - sert le robots.txt et le plan du site (sitemap.xml) de l'école ;
//       - adresse inconnue ou site non publié : vraie réponse 404, non indexée.
//   • Les sous-domaines de SenClass (www, maj, send…) ne sont pas touchés :
//     même liste que src/lib/hoteEcole.ts (SOUS_DOMAINES_RESERVES).
// ═══════════════════════════════════════════════════════════════════════════

const RESERVES = new Set(['www', 'maj', 'send', 'rsend', 'app', 'api', 'admin', 'mail', 'smtp', 'email', 'senclass',
  'platform', 'plateforme', 'status', 'docs', 'aide', 'blog', 'support', 'dev', 'staging', 'test']);
const ORIGINE = 'senclass.pages.dev';
const SUPABASE = 'https://gofwbpmmarwckwvcfbmp.supabase.co';
// Clé publique (la même que dans l'application) : ne lit que les sites publiés.
const CLE_PUBLIQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvZndicG1tYXJ3Y2t3dmNmYm1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODkzNDEsImV4cCI6MjA5NDM2NTM0MX0.D5e-dtpYPAfF3fVurNMrF7dBViJdoGf0xgijMzEXvSY';

/** Pages du site, dans l'ordre du menu (src/siteEcole/edition.tsx, PAGES_INTERNES). */
const PAGES = [
  ['', 'Accueil', 'accueil'], ['ecole', 'Notre école', 'ecole'], ['enseignement', 'Enseignement', 'enseignement'],
  ['vie-scolaire', 'Vie scolaire', 'vieScolaire'], ['admissions', 'Admissions', 'admissions'],
  ['actualites', 'Actualités', 'actualites'], ['contact', 'Contact', 'contact'],
];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hote = url.hostname;
    const slug = hote.split('.')[0];
    if (hote === 'senclass.com' || RESERVES.has(slug)) return fetch(request);

    if (url.pathname === '/robots.txt') {
      return texte(`User-agent: *\nAllow: /\n\nSitemap: https://${hote}/sitemap.xml\n`, 'text/plain');
    }
    if (url.pathname === '/sitemap.xml') {
      const site = await lireSite(slug);
      if (!site) return texte('Site introuvable', 'text/plain', 404);
      return texte(planDuSite(site, hote), 'application/xml');
    }

    const reponse = await depuisOrigine(request, url, hote);
    const type = reponse.headers.get('content-type') || '';
    if (!type.includes('text/html')) return reponse;

    const site = await lireSite(slug);
    const page = site && pageDe(site, url.pathname, hote);
    const r = new Response(reponse.body, reponse);
    r.headers.delete('x-robots-tag');
    if (!page) {
      // Site inconnu, non publié ou page qui n'existe pas : jamais dans Google.
      return new HTMLRewriter()
        .on('meta[name="robots"]', { element: e => e.setAttribute('content', 'noindex') })
        .transform(new Response(r.body, { status: 404, headers: r.headers }));
    }
    r.headers.set('cache-control', 'public, max-age=0, must-revalidate');
    return reecrireEntete(r, site, page, `https://${hote}${page.chemin}`);
  },
};

/** L'application, servie depuis Pages ; ses redirections gardent l'adresse de l'école. */
async function depuisOrigine(request, url, hote) {
  const origine = new URL(url);
  origine.hostname = ORIGINE;
  const reponse = await fetch(new Request(origine, request), { redirect: 'manual' });
  const r = new Response(reponse.body, reponse);
  r.headers.delete('x-robots-tag');
  const lieu = r.headers.get('location');
  if (lieu && lieu.includes(ORIGINE)) r.headers.set('location', lieu.split(ORIGINE).join(hote));
  return r;
}

/** Le site publié de l'école (null s'il n'existe pas), gardé une minute en cache. */
async function lireSite(slug) {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) return null;
  try {
    const r = await fetch(`${SUPABASE}/rest/v1/rpc/site_public?p_slug=${slug}`, {
      headers: { apikey: CLE_PUBLIQUE, authorization: `Bearer ${CLE_PUBLIQUE}` },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!r.ok) return null;
    const site = await r.json();
    return site && typeof site === 'object' ? site : null;
  } catch {
    return null;
  }
}

const articles = site => (site.actualites?.elements || []).filter(a => a && a.id);
// Les photos des modèles sont servies par l'application (« /site-ecole/… ») : adresse complète exigée par les aperçus.
const imageWeb = (hote, ...urls) => {
  const u = urls.find(x => typeof x === 'string' && (/^https:\/\//.test(x) || /^\/[^/]/.test(x))) || '';
  return u.startsWith('/') ? `https://${hote}${u}` : u;
};
const court = (s, n = 160) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };

/** La page demandée : titre, description, image. null si elle n'existe pas. */
function pageDe(site, chemin, hote) {
  const id = site.identite || {};
  const nom = id.nom || 'École';
  const parties = chemin.replace(/^\/+|\/+$/g, '').split('/').map(p => { try { return decodeURIComponent(p); } catch { return p; } });
  const [cle = '', sous = ''] = parties;
  if (parties.length > 2) return null;

  const logo = imageWeb(hote, id.logo);
  const accueil = imageWeb(hote, site.accueil?.diapos?.[0]?.image, logo);
  const lieu = id.adresse ? ` ${id.adresse}.` : '';

  if (cle === 'actualites' && sous) {
    const a = articles(site).find(x => x.id === sous);
    if (!a) return null;
    return {
      chemin: `/actualites/${encodeURIComponent(a.id)}`, titre: `${a.titre} | ${nom}`, article: a,
      description: court(a.texte || String(a.contenu || '').replace(/<[^>]+>/g, ' ')) || `${a.titre} — ${nom}.`,
      image: imageWeb(hote, a.image, accueil),
    };
  }
  const p = PAGES.find(x => x[0] === cle);
  if (!p || sous) return null;
  if (!cle) {
    return {
      chemin: '/', titre: id.slogan ? `${nom} | ${id.slogan}` : nom,
      description: court(`${nom}${id.slogan ? ` — ${id.slogan}` : ''}.${lieu} Inscriptions, actualités, contact et WhatsApp.`),
      image: accueil,
    };
  }
  const entete = site[p[2]]?.entete || {};
  return {
    chemin: `/${cle}`, titre: `${p[1]} | ${nom}`,
    description: court(`${entete.texte ? `${entete.texte} ` : ''}${p[1]} — ${nom}.${lieu}`),
    image: imageWeb(hote, entete.image, accueil),
  };
}

/** Fiche « École » lisible par Google : nom, logo, contacts, adresse, réseaux sociaux. */
function ficheEcole(site, hote, page) {
  const id = site.identite || {};
  const ecole = {
    '@type': 'School', '@id': `https://${hote}/#ecole`, name: id.nom, url: `https://${hote}/`,
    ...(id.slogan ? { slogan: id.slogan } : {}),
    ...(imageWeb(hote, id.logo) ? { logo: imageWeb(hote, id.logo) } : {}),
    ...(page.image ? { image: page.image } : {}),
    ...(id.telephone ? { telephone: id.telephone } : {}),
    ...(id.email ? { email: id.email } : {}),
    ...(id.adresse ? { address: { '@type': 'PostalAddress', streetAddress: id.adresse, addressCountry: 'SN' } } : {}),
    ...(id.creation ? { foundingDate: String(id.creation) } : {}),
    sameAs: (id.reseaux || []).map(r => r && r.url).filter(u => typeof u === 'string' && /^https:\/\/[^/]+\/.+/.test(u)),
  };
  const graphe = [ecole, { '@type': 'WebSite', '@id': `https://${hote}/#site`, url: `https://${hote}/`, name: id.nom, inLanguage: 'fr', publisher: { '@id': ecole['@id'] } }];
  if (page.article) {
    graphe.push({
      '@type': 'NewsArticle', headline: court(page.article.titre, 110), description: page.description,
      ...(page.image ? { image: [page.image] } : {}),
      mainEntityOfPage: `https://${hote}${page.chemin}`, publisher: { '@id': ecole['@id'] }, author: { '@id': ecole['@id'] },
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graphe }).replace(/</g, '\\u003c');
}

function reecrireEntete(reponse, site, page, adresse) {
  const hote = new URL(adresse).hostname;
  const nom = site.identite?.nom || 'École';
  const attribut = valeur => ({ element: e => e.setAttribute('content', valeur) });
  const retirer = { element: e => e.remove() };
  return new HTMLRewriter()
    .on('title', { element: e => e.setInnerContent(page.titre) })
    .on('meta[name="description"]', attribut(page.description))
    .on('meta[name="robots"]', attribut('index, follow, max-image-preview:large'))
    .on('meta[name="author"]', attribut(nom))
    .on('meta[name="apple-mobile-web-app-title"]', attribut(nom))
    .on('link[rel="canonical"]', { element: e => e.setAttribute('href', adresse) })
    .on('meta[property="og:site_name"]', attribut(nom))
    .on('meta[property="og:title"]', attribut(page.titre))
    .on('meta[property="og:description"]', attribut(page.description))
    .on('meta[property="og:type"]', attribut(page.article ? 'article' : 'website'))
    .on('meta[property="og:url"]', attribut(adresse))
    .on('meta[property="og:image"]', page.image ? attribut(page.image) : retirer)
    .on('meta[property="og:image:alt"]', attribut(page.titre))
    .on('meta[property="og:image:width"]', retirer)
    .on('meta[property="og:image:height"]', retirer)
    .on('meta[name="twitter:image"]', page.image ? attribut(page.image) : retirer)
    .on('script[type="application/ld+json"]', { element: e => e.setInnerContent(ficheEcole(site, hote, page), { html: true }) })
    .transform(reponse);
}

function planDuSite(site, hote) {
  const echapper = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const adresses = [
    ...PAGES.map(([cle]) => `https://${hote}/${cle}`),
    ...articles(site).map(a => `https://${hote}/actualites/${encodeURIComponent(a.id)}`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    adresses.map(u => `  <url><loc>${echapper(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
}

function texte(corps, type, status = 200) {
  return new Response(corps, { status, headers: { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'public, max-age=300' } });
}
