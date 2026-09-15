import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TITRE_ACCUEIL, PREFIXES_PRIVES } from '@/lib/referencement';
import { TARIF_MENSUEL } from '@/lib/subscriptionPlans';
import { EMAIL_CONTACT } from '@/lib/contact';

// ════════════════════════════════════════════════════════════════════════════
// GARDE-FOUS DE MISE EN LIGNE
//
// Ce qui casse une mise en production ne se voit pas dans l'application
// locale : un service worker mis en cache par l'hébergeur fige tous les
// utilisateurs sur une vieille version, une icône manquante empêche
// l'installation, un titre qui perd son mot-clé fait disparaître le site de
// Google. Aucun de ces défauts n'affiche d'erreur. Ces tests lisent la
// configuration et tombent à leur place.
// ════════════════════════════════════════════════════════════════════════════

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8');
const DOMAINE = 'https://senclass.com';

describe('chargement différé des écrans', () => {
  const app = lire('src/App.tsx');
  // Portes d'entrée : chargées d'emblée exprès (voir le commentaire d'App.tsx).
  const CHARGEES_D_EMBLEE = ['Index', 'Auth'];

  it('aucun écran n\'est importé en dur, sauf les portes d\'entrée', () => {
    const importsEnDur = [...app.matchAll(/^import (\w+) from "\.\/pages\/[^"]+";$/gm)].map(m => m[1]);
    expect(importsEnDur.sort()).toEqual([...CHARGEES_D_EMBLEE].sort());
  });

  it('les écrans différés existent vraiment (pas de chemin mort)', () => {
    const chemins = [...app.matchAll(/lazy\(\(\) => import\("\.\/(pages\/[^"]+)"\)\)/g)].map(m => m[1]);
    expect(chemins.length).toBeGreaterThan(30);
    for (const c of chemins) {
      expect(existsSync(join(RACINE, 'src', `${c}.tsx`)), c).toBe(true);
    }
  });

  it('un filet Suspense couvre les routes', () => {
    expect(app).toMatch(/<Suspense fallback=/);
    expect(lire('src/components/DashboardLayout.tsx')).toMatch(/<Suspense[\s\S]*<Outlet \/>[\s\S]*<\/Suspense>/);
    expect(lire('src/components/portal/PortalLayout.tsx')).toMatch(/<Suspense[\s\S]*<Outlet \/>[\s\S]*<\/Suspense>/);
  });

  it('un onglet resté ouvert pendant un déploiement se recharge au lieu de planter', () => {
    const main = lire('src/main.tsx');
    expect(main).toContain('vite:preloadError');
    // …une seule fois : jamais de boucle de rechargement.
    expect(main).toContain('sessionStorage');
  });
});

describe('application installable (PWA)', () => {
  const config = lire('vite.config.ts');

  it('le plugin PWA est branché', () => {
    expect(config).toContain('VitePWA(');
  });

  it('les mises à jour sont PROPOSÉES, jamais imposées', () => {
    // Une mise à jour automatique rechargerait la page en pleine saisie.
    expect(config).toMatch(/registerType:\s*"prompt"/);
    expect(lire('src/App.tsx')).toContain('<MiseAJourApplication />');
  });

  it('une adresse profonde s\'ouvre hors connexion', () => {
    expect(config).toMatch(/navigateFallback:\s*"\/index\.html"/);
  });

  it('les données Supabase ne sont JAMAIS mises en cache par le service worker', () => {
    // Cache rangé par adresse, pas par utilisateur : sur un téléphone partagé,
    // un élève verrait hors connexion les données d'un autre compte.
    const motifs = [...config.matchAll(/urlPattern:\s*([^,\n]+)/g)].map(m => m[1]);
    expect(motifs.length).toBeGreaterThan(0);
    for (const m of motifs) expect(m, m).not.toMatch(/supabase/i);
  });

  it('chaque icône déclarée dans le manifeste existe', () => {
    const icones = [...config.matchAll(/src:\s*"([^"]+\.png)"/g)].map(m => m[1]);
    expect(icones.length).toBeGreaterThanOrEqual(4);
    for (const i of icones) expect(existsSync(join(RACINE, 'public', i)), i).toBe(true);
  });

  it('chaque fichier de includeAssets existe', () => {
    const bloc = /includeAssets:\s*\[([^\]]+)\]/.exec(config)![1];
    for (const f of [...bloc.matchAll(/"([^"]+)"/g)].map(m => m[1])) {
      expect(existsSync(join(RACINE, 'public', f)), f).toBe(true);
    }
  });

  it('une icône « maskable » est fournie — sans elle, Android affiche un logo rogné', () => {
    expect(config).toMatch(/purpose:\s*"maskable"/);
  });

  it('les tailles exigées pour l\'installation sont là (192 et 512)', () => {
    expect(config).toContain('"192x192"');
    expect(config).toContain('"512x512"');
  });

  it('le manifeste est en français', () => {
    expect(config).toMatch(/lang:\s*"fr"/);
  });
});

describe('icône de l\'onglet (favicon)', () => {
  const html = lire('index.html');

  it('aucun favicon SVG : les navigateurs le préféreraient à l\'icône fournie', () => {
    expect(existsSync(join(RACINE, 'public/favicon.svg'))).toBe(false);
    expect(html).not.toMatch(/image\/svg\+xml/);
  });

  it('le favicon n\'est plus celui de Lovable', () => {
    // L'ancien fichier (cœur Lovable) pesait exactement 20 373 octets.
    expect(statSync(join(RACINE, 'public/favicon.ico')).size).not.toBe(20373);
  });

  it('une taille multiple de 48 px est déclarée — exigence de Google pour ses résultats', () => {
    expect(html).toMatch(/rel="icon"[^>]*sizes="(48x48|96x96)"/);
  });
});

describe('page d\'accueil (index.html)', () => {
  const html = lire('index.html');

  it('plus aucune trace de Lovable (logo, image d\'aperçu)', () => {
    expect(html).not.toMatch(/lovable/i);
  });

  it('les fichiers référencés par index.html existent', () => {
    const fichiers = [...html.matchAll(/href="\/([^"%]+)"/g)].map(m => m[1]);
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) expect(existsSync(join(RACINE, 'public', f)), f).toBe(true);
  });

  it('l\'image d\'aperçu des liens partagés existe', () => {
    expect(html).toContain('/og-image.png');
    expect(existsSync(join(RACINE, 'public/og-image.png'))).toBe(true);
  });

  it('la couleur de la barre d\'état correspond au manifeste', () => {
    const couleur = /name="theme-color" content="([^"]+)"/.exec(html)?.[1];
    expect(couleur).toBeTruthy();
    expect(lire('vite.config.ts')).toContain(`"${couleur}"`);
  });
});

describe('référencement Google', () => {
  const html = lire('index.html');

  it('le <title> est celui qu\'applique l\'application (pas de divergence)', () => {
    expect(/<title>([^<]+)<\/title>/.exec(html)?.[1]).toBe(TITRE_ACCUEIL);
  });

  it('la description tient dans Google (≤ 160 caractères) et porte les mots-clés', () => {
    const description = /name="description" content="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(description.length).toBeGreaterThan(70);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain('gestion scolaire');
    expect(description).toContain('Sénégal');
  });

  it('adresse canonique sur le domaine définitif', () => {
    expect(html).toContain('<link rel="canonical" href="%VITE_SITE_URL%/" />');
    expect(lire('.env')).toMatch(new RegExp(`^VITE_SITE_URL="?${DOMAINE}"?$`, 'm'));
  });

  it('les données structurées sont du JSON valide, sans note ni avis inventé', () => {
    const brut = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1];
    const donnees = JSON.parse(brut);
    const types = donnees['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'SoftwareApplication']));
    expect(brut).not.toMatch(/aggregateRating|"review"/);
  });

  it('le prix des données structurées est le vrai tarif', () => {
    const brut = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1];
    const appli = JSON.parse(brut)['@graph'].find((n: { '@type': string }) => n['@type'] === 'SoftwareApplication');
    expect(Number(appli.offers.price)).toBe(TARIF_MENSUEL);
    expect(appli.offers.priceCurrency).toBe('XOF');
  });

  it('l\'e-mail déclaré à Google est celui affiché sur le site', () => {
    const brut = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1];
    const organisation = JSON.parse(brut)['@graph'].find((n: { '@type': string }) => n['@type'] === 'Organization');
    expect(organisation.contactPoint.email).toBe(EMAIL_CONTACT);
  });

  it('le logo déclaré à Google existe', () => {
    expect(html).toContain('/logo-512.png');
    expect(existsSync(join(RACINE, 'public/logo-512.png'))).toBe(true);
  });

  it('robots.txt ferme CHAQUE espace privé et annonce le plan du site', () => {
    const robots = lire('public/robots.txt');
    const fermes = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map(m => m[1]);
    for (const prefixe of PREFIXES_PRIVES) {
      expect(fermes.some(f => prefixe.startsWith(f)), `${prefixe} n'est pas fermé aux robots`).toBe(true);
    }
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toContain(`Sitemap: ${DOMAINE}/sitemap.xml`);
  });

  it('robots.txt ne ferme PAS l\'accueil par erreur', () => {
    const robots = lire('public/robots.txt');
    expect(robots).not.toMatch(/^Disallow:\s*\/\s*$/m);
  });

  it('le plan du site pointe vers le domaine définitif', () => {
    expect(lire('public/sitemap.xml')).toContain(`<loc>${DOMAINE}/</loc>`);
  });
});

describe('hébergement Cloudflare Pages', () => {
  const entetes = lire('public/_headers');
  /** Lignes d'en-têtes d'une règle de _headers (lignes indentées sous son chemin). */
  const regle = (chemin: string): string => {
    const lignes = entetes.split('\n');
    const i = lignes.findIndex(l => l.trim() === chemin);
    if (i < 0) return '';
    const suite: string[] = [];
    for (const l of lignes.slice(i + 1)) {
      if (!/^\s+\S/.test(l)) break;
      suite.push(l.trim());
    }
    return suite.join('\n');
  };

  it('le service worker n\'est JAMAIS mis en cache', () => {
    // Sinon les utilisateurs restent bloqués sur l'ancienne version.
    expect(regle('/sw.js')).toMatch(/Cache-Control:\s*no-cache/);
  });

  it('les fichiers à empreinte sont gardés un an', () => {
    expect(regle('/assets/*')).toMatch(/Cache-Control:[^\n]*immutable/);
  });

  it('la caméra reste autorisée — photo d\'inscription et scan de la caisse', () => {
    expect(regle('/*')).toMatch(/Permissions-Policy:[^\n]*camera=\(self\)/);
  });

  it('les adresses *.pages.dev (technique et prévisualisations) ne sont pas indexées', () => {
    // Sinon Google verrait le site en double et partagerait son classement.
    expect(regle('https://:project.pages.dev/*')).toBe('X-Robots-Tag: noindex');
    expect(regle('https://:version.:project.pages.dev/*')).toBe('X-Robots-Tag: noindex');
  });

  it('aucune page 404.html : Cloudflare sert alors l\'application pour toute adresse', () => {
    // Sa présence désactiverait le mode « application d'une seule page » :
    // /portail/notes ouvert directement répondrait « introuvable ».
    expect(existsSync(join(RACINE, 'public/404.html'))).toBe(false);
  });

  it('l\'installation passera chez Cloudflare malgré les dépendances pairs', () => {
    const paquet = JSON.parse(lire('package.json'));
    if (paquet.devDependencies?.['lovable-tagger']) expect(lire('.npmrc')).toMatch(/^legacy-peer-deps=true$/m);
  });

  it('la version de Node est fixée dans .nvmrc, assez récente pour Vite 8', () => {
    expect(Number(lire('.nvmrc').trim().split('.')[0])).toBeGreaterThanOrEqual(20);
  });

  it('la CI utilise la même version de Node que l\'hébergeur', () => {
    expect(lire('.github/workflows/ci.yml')).toContain("node-version-file: '.nvmrc'");
  });

  it('un seul fichier de verrouillage, celui de npm — Cloudflare choisit son outil d\'après lui', () => {
    // Un bun.lockb hérité de Lovable a fait échouer le premier déploiement :
    // Cloudflare a lancé « bun install --frozen-lockfile » au lieu de npm.
    for (const f of ['bun.lockb', 'bun.lock', 'yarn.lock', 'pnpm-lock.yaml']) {
      expect(existsSync(join(RACINE, f)), f).toBe(false);
    }
    expect(existsSync(join(RACINE, 'package-lock.json'))).toBe(true);
  });

  it('plus de configuration Vercel qui pourrait induire en erreur', () => {
    expect(existsSync(join(RACINE, 'vercel.json'))).toBe(false);
  });
});

describe('reprise au retour du réseau', () => {
  it('AuthContext recharge le profil quand la connexion revient', () => {
    const auth = lire('src/contexts/AuthContext.tsx');
    expect(auth).toContain("addEventListener('online'");
    expect(auth).toContain("removeEventListener('online'");
  });
});
