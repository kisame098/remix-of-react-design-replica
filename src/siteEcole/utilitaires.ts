/** Lien wa.me : chiffres seuls, indicatif compris (221…). */
export function lienWhatsApp(numero: string, message = ''): string {
  const chiffres = numero.replace(/\D/g, '');
  return `https://wa.me/${chiffres}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

/** Carte Google sans clé d'API, à partir de l'adresse écrite par l'école. */
export function lienCarte(adresse: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(adresse)}&output=embed`;
}

/** « #/actualites/semaine-culturelle » → { page: 'actualites', sous: 'semaine-culturelle' }. */
export function routeDepuisHash(hash: string): { page: string; sous: string } {
  const [page = '', sous = ''] = hash.replace(/^#\/?/, '').split(/[?#]/)[0].split('/');
  return { page, sous: decodeURIComponent(sous) };
}

/**
 * Site publié : les pages sont de vraies adresses, pour que Google les voie une à une.
 * « /site/ecole-x/actualites/abc » (base « /site/ecole-x ») → { page: 'actualites', sous: 'abc' }.
 * Sur le sous-domaine de l'école, la base est vide : « /actualites/abc ».
 */
export function routeDepuisChemin(chemin: string, base: string): { page: string; sous: string } {
  const reste = chemin.startsWith(base) ? chemin.slice(base.length) : chemin;
  return routeDepuisHash(`#${reste.startsWith('/') ? reste : `/${reste}`}`);
}

/** Lien interne écrit « #/admissions » → vraie adresse « <base>/admissions ». `null` si ce n'est pas un lien interne. */
export function cheminDepuisLien(lien: string, base: string): string | null {
  if (!lien.startsWith('#/')) return null;
  const reste = lien.slice(2).replace(/\/+$/, '');
  return reste ? `${base}/${reste}` : (base || '/');
}

/** Identifiant lisible d'une actualité, à partir de son titre, unique parmi `existants`. */
export function identifiant(titre: string, existants: string[]): string {
  const base = titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'actualite';
  let id = base;
  for (let n = 2; existants.includes(id); n++) id = `${base}-${n}`;
  return id;
}

export type Integration =
  | { type: 'iframe'; src: string; ratio: string; fournisseur: string }
  | { type: 'video'; src: string };

/**
 * Transforme le lien collé par l'école en contenu intégrable dans un article :
 * vidéo YouTube, publication ou vidéo Facebook, TikTok, Instagram, fichier vidéo.
 * `null` : lien ordinaire (il reste un lien, ou devient une carte d'aperçu).
 */
export function integrationDepuisUrl(brut: string): Integration | null {
  let url: URL;
  try { url = new URL(brut.trim()); } catch { return null; }
  const hote = url.hostname.replace(/^www\.|^m\./, '');

  if (/\.(mp4|webm|ogg|mov)$/i.test(url.pathname)) return { type: 'video', src: url.href };

  if (hote === 'youtu.be' || hote.endsWith('youtube.com')) {
    const id = hote === 'youtu.be' ? url.pathname.slice(1)
      : url.searchParams.get('v') ?? url.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
    return id ? { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}`, ratio: '16/9', fournisseur: 'YouTube' } : null;
  }
  if (hote.endsWith('facebook.com') || hote === 'fb.watch') {
    const video = /\/videos?\/|\/watch|\/reel\/|fb\.watch/.test(url.href);
    const plugin = video ? 'video' : 'post';
    return {
      type: 'iframe', fournisseur: 'Facebook', ratio: video ? '16/9' : '4/5',
      src: `https://www.facebook.com/plugins/${plugin}.php?href=${encodeURIComponent(url.href)}&show_text=true&width=500`,
    };
  }
  if (hote.endsWith('tiktok.com')) {
    const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
    return id ? { type: 'iframe', src: `https://www.tiktok.com/embed/v2/${id}`, ratio: '9/16', fournisseur: 'TikTok' } : null;
  }
  if (hote.endsWith('instagram.com')) {
    const code = url.pathname.match(/\/(p|reel|tv)\/([^/]+)/);
    return code ? { type: 'iframe', src: `https://www.instagram.com/${code[1]}/${code[2]}/embed`, ratio: '4/5', fournisseur: 'Instagram' } : null;
  }
  return null;
}

/** Le lien Facebook pointe-t-il vers une vraie page (et pas l'accueil de Facebook) ? */
export function estPageFacebook(lien: string): boolean {
  try {
    const u = new URL(lien);
    return u.hostname.replace(/^www\.|^m\./, '') === 'facebook.com' && u.pathname.replace(/\//g, '').length > 0;
  } catch { return false; }
}
