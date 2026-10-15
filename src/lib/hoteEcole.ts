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

/**
 * Pourquoi une adresse ne peut pas servir, ou null si elle convient.
 * Même règle que le serveur (site_adresse_refusee, docs/sql/site_web_adresse.sql).
 */
export function adresseRefusee(slug: string): 'format' | 'reservee' | null {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) return 'format';
  if (SOUS_DOMAINES_RESERVES.has(slug)) return 'reservee';
  return null;
}

/** Nettoie ce que tape le directeur : minuscules, sans accents, espaces → tirets. */
export function nettoyerAdresse(saisie: string): string {
  return saisie.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+/, '').slice(0, 63);
}

/** Adresse proposée à partir du nom de l'école (« Groupe Scolaire Excellence » → « groupe-scolaire-excellence »). */
export function suggestionAdresse(nom: string): string {
  const base = nettoyerAdresse(nom).replace(/-+$/, '').slice(0, 60).replace(/-+$/, '');
  return adresseRefusee(base) ? `ecole-${base}`.replace(/-+$/, '') : base;
}
