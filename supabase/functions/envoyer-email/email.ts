// ═══════════════════════════════════════════════════════════════════════════
// Logique pure de la fonction `envoyer-email` — testée depuis src/test.
// Aucune dépendance Deno ni réseau ici.
// ═══════════════════════════════════════════════════════════════════════════

export const EXPEDITEUR = 'SenClass <contact@senclass.com>';
export const REPONDRE_A = 'contact@senclass.com';
/** Plafond par envoi : l'offre Resend actuelle permet 100 e-mails par jour. */
export const MAX_DESTINATAIRES = 50;

export interface Destinataire {
  email: string;
  prospectId?: string;
  schoolId?: string;
  ecole?: string;
  responsable?: string;
}

export interface RequeteEnvoi {
  objet: string;
  contenu: string;
  destinataires: Destinataire[];
}

export const emailValide = (e: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** Remplace {{ecole}} et {{responsable}} ; une variable vide devient « Madame, Monsieur » ou « votre école ». */
export const personnaliser = (texte: string, d: Pick<Destinataire, 'ecole' | 'responsable'>): string =>
  texte
    .replace(/\{\{\s*responsable\s*\}\}/g, d.responsable?.trim() || 'Madame, Monsieur')
    .replace(/\{\{\s*ecole\s*\}\}/g, d.ecole?.trim() || 'votre école');

const echapper = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Rend cliquables les adresses http(s) d'un texte déjà échappé (la ponctuation finale reste hors du lien). */
const lierAdresses = (t: string) =>
  t.replace(/https?:\/\/[^\s<]+?(?=[.,;:!?)]*(?:\s|<|$))/g, u => `<a href="${u}" style="color:#1d4ed8">${u}</a>`);

/** Version HTML sobre du message texte : paragraphes, retours à la ligne et liens, rien d'autre. */
export const versHtml = (texte: string): string =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">${
    texte.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${lierAdresses(echapper(p)).replace(/\n/g, '<br>')}</p>`).join('')
  }</div>`;

/** Vérifie une requête ; renvoie la liste des erreurs (vide si tout va bien). */
export const verifierRequete = (r: unknown): string[] => {
  const erreurs: string[] = [];
  const q = r as Partial<RequeteEnvoi> | null;
  if (!q || typeof q !== 'object') return ['Requête illisible'];
  if (!q.objet?.trim()) erreurs.push("L'objet est vide");
  if (!q.contenu?.trim()) erreurs.push('Le message est vide');
  if (!Array.isArray(q.destinataires) || q.destinataires.length === 0) erreurs.push('Aucun destinataire');
  else {
    if (q.destinataires.length > MAX_DESTINATAIRES) erreurs.push(`${MAX_DESTINATAIRES} destinataires au plus par envoi`);
    const invalides = q.destinataires.filter(d => !d || typeof d.email !== 'string' || !emailValide(d.email));
    if (invalides.length) erreurs.push(`${invalides.length} adresse(s) e-mail invalide(s)`);
  }
  return erreurs;
};

/** Le corps envoyé à l'API Resend pour un destinataire. */
export const messageResend = (r: RequeteEnvoi, d: Destinataire) => {
  const contenu = personnaliser(r.contenu, d);
  return {
    from: EXPEDITEUR,
    to: [d.email.trim()],
    reply_to: REPONDRE_A,
    subject: personnaliser(r.objet, d),
    text: contenu,
    html: versHtml(contenu),
  };
};
