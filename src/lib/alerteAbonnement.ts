// ═══════════════════════════════════════════════════════════════════════════
// FIN D'ESSAI / FIN D'ABONNEMENT BIENTÔT — quand et comment prévenir l'école.
//
//   • Période d'essai : prévenue PENDANT TOUT L'ESSAI (il dure quelques jours :
//     l'école doit savoir dès le début quand il s'arrête). À l'échéance, l'accès
//     se ferme de lui-même (src/lib/subscription.ts) : plus de bandeau, l'écran
//     « abonnement requis » prend le relais.
//   • Abonnement payé : prévenu dans les 7 DERNIERS JOURS — assez tôt pour payer
//     sans urgence, pas assez pour devenir un bruit de fond. Une fois l'échéance
//     passée, le système ne bloque jamais seul un abonnement payé : le bandeau
//     dit alors qu'il a expiré.
//
// Dans les dernières 24 heures, le bandeau passe en urgent et ne se masque plus.
// Fonctions pures (alerteAbonnement.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

import type { SubscriptionStatus } from '@/lib/subscription';

export const JOURS_AVANT_FIN_ABONNEMENT = 7;

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

export type NiveauAlerte = 'info' | 'urgent' | 'expire';

export interface AlerteAbonnement {
  essai: boolean;
  niveau: NiveauAlerte;
  /** Échéance (ISO). */
  expireLe: string;
  /** Millisecondes restantes (négatif une fois l'échéance passée). */
  restantMs: number;
}

export const alerteAbonnement = (
  statut: SubscriptionStatus | null | undefined,
  expireLe: string | null | undefined,
  maintenant: number = Date.now(),
): AlerteAbonnement | null => {
  if (!expireLe) return null;
  const fin = Date.parse(expireLe);
  if (Number.isNaN(fin)) return null;
  const restantMs = fin - maintenant;

  if (statut === 'trial') {
    if (restantMs <= 0) return null;
    return { essai: true, niveau: restantMs <= JOUR ? 'urgent' : 'info', expireLe, restantMs };
  }
  if (statut === 'active') {
    if (restantMs <= 0) return { essai: false, niveau: 'expire', expireLe, restantMs };
    if (restantMs > JOURS_AVANT_FIN_ABONNEMENT * JOUR) return null;
    return { essai: false, niveau: restantMs <= JOUR ? 'urgent' : 'info', expireLe, restantMs };
  }
  return null;
};

/** « 2 jours et 3 h », « 5 h 12 min », « 12 min », « moins d'une minute ». */
export const dureeEnLettres = (ms: number): string => {
  const t = Math.max(0, ms);
  const jours = Math.floor(t / JOUR);
  const heures = Math.floor((t % JOUR) / HEURE);
  const minutes = Math.floor((t % HEURE) / MINUTE);
  if (jours > 0) return `${jours} jour${jours > 1 ? 's' : ''}${heures > 0 ? ` et ${heures} h` : ''}`;
  if (heures > 0) return `${heures} h${minutes > 0 ? ` ${String(minutes).padStart(2, '0')} min` : ''}`;
  if (minutes > 0) return `${minutes} min`;
  return 'moins d\'une minute';
};

/** Le bandeau peut-il être masqué ? Jamais dans les dernières 24 h, ni une fois expiré. */
export const peutMasquer = (a: AlerteAbonnement): boolean => a.niveau === 'info';
