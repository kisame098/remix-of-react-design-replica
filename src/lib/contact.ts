// Coordonnées commerciales affichées sur la page d'accueil.
//
// Le numéro WhatsApp est celui déjà présenté sur les sections Tarifs et
// Témoignages : c'est le seul contact vérifié du site.

export const WHATSAPP_NUMERO = '221706811277';

/** +221 70 681 12 77 */
export const TELEPHONE_LISIBLE = `+${WHATSAPP_NUMERO.slice(0, 3)} ${WHATSAPP_NUMERO.slice(3, 5)} `
  + `${WHATSAPP_NUMERO.slice(5, 8)} ${WHATSAPP_NUMERO.slice(8, 10)} ${WHATSAPP_NUMERO.slice(10)}`;

export const lienWhatsApp = (message: string): string =>
  `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(message)}`;

/** Adresse de la page de création d'école (formulaire d'inscription ouvert d'office). */
export const ADRESSE_INSCRIPTION = '/auth?inscription=1';
