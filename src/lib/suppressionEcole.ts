// ═══════════════════════════════════════════════════════════════════════════
// SUPPRESSION DÉFINITIVE D'UNE ÉCOLE (chef du système)
//
// Trois confirmations successives, dans l'ordre :
//   1. lire ce qui sera effacé et cocher « j'ai compris » ;
//   2. taper le mot SUPPRIMER ;
//   3. retaper le nom EXACT de l'école.
// Le serveur revérifie 2 et 3 (platform_delete_school) : contourner
// l'interface ne suffit pas.
// ═══════════════════════════════════════════════════════════════════════════

export const MOT_DE_CONFIRMATION = 'SUPPRIMER';

export type EtapeSuppression = 1 | 2 | 3;

export interface ApercuSuppression {
  eleves: number;
  professeurs: number;
  classes: number;
  paiements: number;
  recus: number;
  bulletins: number;
  comptes: number;
  compte_chef_conserve: boolean;
}

export interface SaisieSuppression {
  compris: boolean;
  mot: string;
  nom: string;
}

/** Le mot doit être tapé tel quel, en majuscules : « supprimer » ne passe pas. */
export const motValide = (mot: string): boolean => mot.trim() === MOT_DE_CONFIRMATION;

/** Le nom se compare sans les espaces de bord, mais respecte la casse et les accents. */
export const nomValide = (saisi: string, nomEcole: string): boolean =>
  saisi.trim() !== '' && saisi.trim() === nomEcole.trim();

export const etapeFranchie = (etape: EtapeSuppression, s: SaisieSuppression, nomEcole: string): boolean => {
  if (etape === 1) return s.compris;
  if (etape === 2) return motValide(s.mot);
  return motValide(s.mot) && nomValide(s.nom, nomEcole) && s.compris;
};

export const lignesApercu = (a: ApercuSuppression): { label: string; valeur: number }[] => [
  { label: 'Élèves', valeur: a.eleves },
  { label: 'Professeurs', valeur: a.professeurs },
  { label: 'Classes', valeur: a.classes },
  { label: 'Paiements des familles', valeur: a.paiements },
  { label: 'Reçus', valeur: a.recus },
  { label: 'Bulletins publiés', valeur: a.bulletins },
  { label: 'Comptes de connexion', valeur: a.comptes },
];

/** Message lisible pour un échec ; le serveur parle en français, le réseau non. */
export const messageErreurSuppression = (e: unknown): string => {
  const brut = typeof (e as { message?: unknown } | null)?.message === 'string' ? (e as { message: string }).message : '';
  if (/ne correspond pas/i.test(brut)) return "Le nom saisi ne correspond pas à celui de l'école.";
  if (/confirmation manquante/i.test(brut)) return 'Confirmation manquante : tapez SUPPRIMER.';
  if (/non autoris/i.test(brut)) return "Seul le chef du système peut supprimer une école.";
  if (/introuvable/i.test(brut)) return "Cette école n'existe plus : actualisez la liste.";
  return "La suppression n'a pas pu aboutir. Rien n'a été effacé : vérifiez la connexion et réessayez.";
};
