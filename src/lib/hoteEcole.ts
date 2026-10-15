// ═══════════════════════════════════════════════════════════════════════════
// SITE D'ÉCOLE SUR SON PROPRE SOUS-DOMAINE : <slug>.senclass.com
//
// Cloudflare envoie toutes les adresses *.senclass.com vers l'application (un
// Worker « sites-ecoles »). Sur une telle adresse, l'application n'affiche que
// le site publié de l'école — ni le SaaS, ni la connexion.
// ═══════════════════════════════════════════════════════════════════════════

/** Sous-domaines de SenClass qui ne sont PAS des sites d'école. */
export const SOUS_DOMAINES_RESERVES = new Set([
  'www', 'maj', 'send', 'rsend', 'app', 'api', 'admin', 'mail', 'smtp', 'email', 'senclass',
  'platform', 'plateforme', 'status', 'docs', 'aide', 'blog', 'support', 'dev', 'staging', 'test',
]);

/**
 * Le slug de l'école si l'adresse est un site d'école (« gsexcellence.senclass.com »
 * → « gsexcellence »), sinon null. « gsexcellence.localhost » marche aussi, pour essayer en local.
 */
export function sousDomaineEcole(hote: string): string | null {
  const m = hote.toLowerCase().match(/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.(?:senclass\.com|localhost)$/);
  if (!m || SOUS_DOMAINES_RESERVES.has(m[1])) return null;
  return m[1];
}

/** L'adresse publique à partager pour une école : son sous-domaine en production. */
export function adresseSiteEcole(slug: string, hoteActuel: string, origineActuelle: string): string {
  const h = hoteActuel.toLowerCase();
  if (h === 'senclass.com' || h === 'www.senclass.com') return `https://${slug}.senclass.com`;
  return `${origineActuelle}/site/${slug}`;
}
