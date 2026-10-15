/** Lien wa.me : chiffres seuls, indicatif compris (221…). */
export function lienWhatsApp(numero: string, message: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

/** Carte Google sans clé d'API, à partir de l'adresse écrite par l'école. */
export function lienCarte(adresse: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(adresse)}&output=embed`;
}

/** Page affichée à partir de l'adresse « #/admissions ». */
export function pageDepuisHash(hash: string): string {
  return hash.replace(/^#\/?/, '').split(/[?#]/)[0] || '';
}
