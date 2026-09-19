// ═══════════════════════════════════════════════════════════════════════════
// FABRICATION DES CLÉS VAPID — WebCrypto uniquement, sans API Deno.
//
// La paire est créée par la fonction elle-même, au premier appel : ainsi la clé
// privée n'est jamais saisie, jamais copiée, jamais affichée. Elle passe de la
// mémoire de la fonction au coffre chiffré de Supabase, et n'en sort que pour
// signer.
// ═══════════════════════════════════════════════════════════════════════════

export interface PaireVapid {
  /** Point public non compressé (65 octets : 0x04 ‖ X ‖ Y), en base64 « URL-safe ». */
  publique: string;
  /** Scalaire privé (32 octets), en base64 « URL-safe ». */
  privee: string;
}

const versBase64Url = (octets: Uint8Array): string => {
  let binaire = '';
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const depuisBase64Url = (texte: string): Uint8Array => {
  const remplissage = '='.repeat((4 - (texte.length % 4)) % 4);
  const binaire = atob((texte + remplissage).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binaire, c => c.charCodeAt(0));
};

export const genererPaireVapid = async (): Promise<PaireVapid> => {
  const paire = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', paire.privateKey);
  if (!jwk.x || !jwk.y || !jwk.d) throw new Error('Clé VAPID incomplète');

  const x = depuisBase64Url(jwk.x);
  const y = depuisBase64Url(jwk.y);
  const d = depuisBase64Url(jwk.d);
  // Une clé mal dimensionnée serait refusée par tous les services de push,
  // sans message utile : on préfère échouer ici.
  if (x.length !== 32 || y.length !== 32 || d.length !== 32) throw new Error('Clé VAPID de taille inattendue');

  const publique = new Uint8Array(65);
  publique[0] = 4;
  publique.set(x, 1);
  publique.set(y, 33);
  return { publique: versBase64Url(publique), privee: versBase64Url(d) };
};
