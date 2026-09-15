// ─── État d'abonnement d'une école ─────────────────────────────────────────
// Règle métier : le système ne désactive JAMAIS de lui-même un abonnement
// payant arrivé à échéance — il se contente de le signaler au chef du système,
// qui tranche à la main. SEULE exception : la période d'essai, qui s'arrête
// d'elle-même quand elle est écoulée (rien n'a été payé, aucune décision
// humaine à prendre). Aucune écriture en base n'a lieu dans les deux cas : le
// statut stocké reste la vérité de ce qui a été décidé manuellement.

export type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

export type SubscriptionGate = 'ok' | 'trial_expired' | 'suspended' | 'cancelled';

export const isExpired = (expiresAt: string | null | undefined): boolean =>
  !!expiresAt && new Date(expiresAt).getTime() < Date.now();

/** Accès au dashboard école : bloqué ou non, et pourquoi. */
export const getSubscriptionGate = (
  status: SubscriptionStatus | null | undefined,
  expiresAt: string | null | undefined,
): SubscriptionGate => {
  if (status === 'suspended') return 'suspended';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'trial' && isExpired(expiresAt)) return 'trial_expired';
  return 'ok';
};

/** Abonnement payant dont l'échéance est passée — signal uniquement, jamais d'action automatique. */
export const isPaidOverdue = (
  status: SubscriptionStatus | null | undefined,
  expiresAt: string | null | undefined,
): boolean => status === 'active' && isExpired(expiresAt);

/** Préréglages de durée d'essai proposés au chef du système (défaut : 7 jours). */
export const TRIAL_PRESETS: { label: string; minutes: number }[] = [
  { label: '1 minute (test)', minutes: 1 },
  { label: '1 jour',          minutes: 60 * 24 },
  { label: '3 jours',         minutes: 60 * 24 * 3 },
  { label: '7 jours (défaut)', minutes: 60 * 24 * 7 },
  { label: '13 jours',        minutes: 60 * 24 * 13 },
  { label: '30 jours',        minutes: 60 * 24 * 30 },
];

export const minutesFromNowISO = (minutes: number): string =>
  new Date(Date.now() + minutes * 60_000).toISOString();
