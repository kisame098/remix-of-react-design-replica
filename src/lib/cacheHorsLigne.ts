// ═══════════════════════════════════════════════════════════════════════════
// DONNÉES DISPONIBLES HORS CONNEXION — RANGÉES PAR COMPTE
//
// Les écoles, les élèves et les professeurs doivent pouvoir ouvrir SenClass
// sans réseau et consulter leurs données. On les enregistre donc sur
// l'appareil, à chaque chargement réussi.
//
// POURQUOI PAS LE CACHE DU SERVICE WORKER : il est rangé par ADRESSE, pas par
// utilisateur. Le portail permet plusieurs comptes sur un même téléphone (une
// mère et ses enfants) : hors connexion, un élève y verrait les réponses
// enregistrées pour un autre. Ici, chaque compte a son propre espace, effacé
// à sa déconnexion.
//
// Ce qui est enregistré est TOUJOURS daté : les écrans affichent cette date,
// pour que personne ne prenne d'anciennes données pour des données fraîches.
// ═══════════════════════════════════════════════════════════════════════════

const PREFIXE = 'senclass.horsligne.v1';

export interface Enregistrement<T> {
  donnees: T;
  /** Date ISO du dernier chargement réussi. */
  enregistreLe: string;
}

/** `senclass.horsligne.v1.<compte>.<écran>` */
export const cleDeCache = (utilisateurId: string, nom: string): string =>
  `${PREFIXE}.${utilisateurId}.${nom}`;

/**
 * Enregistre des données pour UN compte.
 * Sans identifiant de compte, on n'écrit rien : une donnée sans propriétaire
 * pourrait être lue par le compte suivant sur le même appareil.
 */
export const enregistrer = <T>(
  utilisateurId: string | null | undefined,
  nom: string,
  donnees: T,
  maintenant: Date = new Date(),
): boolean => {
  if (!utilisateurId || !nom) return false;
  try {
    const paquet: Enregistrement<T> = { donnees, enregistreLe: maintenant.toISOString() };
    localStorage.setItem(cleDeCache(utilisateurId, nom), JSON.stringify(paquet));
    return true;
  } catch {
    // Stockage plein ou navigation privée : l'application marche sans.
    return false;
  }
};

/** Relit les données enregistrées pour ce compte, ou `null`. */
export const lire = <T>(
  utilisateurId: string | null | undefined,
  nom: string,
): Enregistrement<T> | null => {
  if (!utilisateurId || !nom) return null;
  try {
    const brut = localStorage.getItem(cleDeCache(utilisateurId, nom));
    if (!brut) return null;
    const paquet = JSON.parse(brut) as Enregistrement<T>;
    if (!paquet || typeof paquet.enregistreLe !== 'string' || !('donnees' in paquet)) return null;
    return paquet;
  } catch {
    return null;   // contenu corrompu : on repart du réseau
  }
};

/** Efface tout ce qui appartient à ce compte — appelé à la déconnexion. */
export const effacerUtilisateur = (utilisateurId: string | null | undefined): number => {
  if (!utilisateurId) return 0;
  const prefixe = `${PREFIXE}.${utilisateurId}.`;
  try {
    const cles = Object.keys(localStorage).filter(c => c.startsWith(prefixe));
    cles.forEach(c => localStorage.removeItem(c));
    return cles.length;
  } catch {
    return 0;
  }
};

/** Efface les données hors connexion de TOUS les comptes de cet appareil. */
export const effacerTout = (): number => {
  try {
    const cles = Object.keys(localStorage).filter(c => c.startsWith(`${PREFIXE}.`));
    cles.forEach(c => localStorage.removeItem(c));
    return cles.length;
  } catch {
    return 0;
  }
};

/** « 19 septembre à 11:20 » — pour le bandeau des écrans. */
export const dateLisible = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const jour = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${jour} à ${heure}`;
};
