import { normaliserNomChamp, type VerificationModele } from '@/lib/modelesDocuments';

// ═══════════════════════════════════════════════════════════════════════════
// NUMÉROTATION DES DOCUMENTS DÉLIVRÉS
//
// Même logique que les reçus (REC-2026-00042) : PRÉFIXE-ANNÉE-NNNNN, l'année
// étant le début de l'année scolaire, le compteur propre à l'école, à l'année
// et au préfixe. Le numéro est attribué par la base (docs/sql/documents_delivres.sql)
// au moment d'imprimer ou de télécharger — jamais à l'aperçu.
// ═══════════════════════════════════════════════════════════════════════════

export const CHAMP_NUMERO = 'NUMÉRO DU DOCUMENT';

/** Préfixes des modèles fournis. */
const PREFIXES_FOURNIS: Record<string, string> = {
  'senclass:certificat-scolarite': 'CS',
  'senclass:certificat-inscription': 'CI',
  'senclass:convocation-eleve': 'CE',
  'senclass:convocation-parent': 'CP',
  'senclass:absence-eleve': 'PAE',
  'senclass:absence-professeur': 'PAP',
  'senclass:sortie-scolaire': 'ASS',
};

/** Petits mots ignorés pour les initiales : « Certificat de scolarité » → CS. */
const MOTS_VIDES = new Set(['DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'L', 'D', 'ET', 'A', 'AU', 'AUX', 'EN', 'POUR', 'UN', 'UNE', 'SUR']);

/**
 * Le préfixe d'un modèle : fixé pour les modèles fournis ; pour ceux de
 * l'école, les initiales des mots de son nom (4 lettres au plus).
 */
export const prefixeDuModele = (modeleRef: string, nom: string): string => {
  if (PREFIXES_FOURNIS[modeleRef]) return PREFIXES_FOURNIS[modeleRef];
  const mots = normaliserNomChamp(nom).replace(/[^A-Z ]+/g, ' ').split(/\s+/).filter(m => m && !MOTS_VIDES.has(m));
  return mots.map(m => m[0]).join('').slice(0, 4) || 'DOC';
};

/** « 2026-2027 » → « 2026 ». */
const anDeDebut = (anneeScolaire: string): string => /^\d{4}/.exec(anneeScolaire)?.[0] ?? anneeScolaire;

export const formaterNumero = (prefixe: string, anneeScolaire: string, seq: number): string =>
  `${prefixe}-${anDeDebut(anneeScolaire)}-${String(seq).padStart(5, '0')}`;

/** Ce que montre l'aperçu à la place du numéro, tant que rien n'est délivré. */
export const numeroProvisoire = (prefixe: string, anneeScolaire: string): string =>
  `${prefixe}-${anDeDebut(anneeScolaire)}-·····`;

export const utiliseNumero = (v: Pick<VerificationModele, 'utilises'>): boolean =>
  v.utilises.some(nom => normaliserNomChamp(nom) === normaliserNomChamp(CHAMP_NUMERO));
