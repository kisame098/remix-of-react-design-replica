// ═══════════════════════════════════════════════════════════════════════════
// QUI A LE DROIT D'ALLER OÙ — la décision de redirection du dashboard.
//
// Extraite de ProtectedRoute pour être testable : c'est du contrôle d'accès,
// et une erreur ici ouvre un écran à qui ne devrait pas le voir, ou enferme
// quelqu'un dans une boucle de redirections.
//
// L'ORDRE des règles compte, et c'est là qu'était le piège : un compte « caisse
// mobile » d'une école bloquée rebondissait indéfiniment entre /caisse (où sa
// règle de rôle l'envoyait) et /abonnement-requis (où l'abonnement l'envoyait).
//
// Rappel : le vrai verrou est en base (voir docs/sql/subscription_enforcement.sql).
// Ce qui suit ne fait qu'éviter d'afficher des écrans vides — un utilisateur qui
// contournerait ces règles ne verrait aucune donnée pour autant.
// ═══════════════════════════════════════════════════════════════════════════

import { isCashierAccount } from '@/lib/permissions';
import { getSubscriptionGate, type SubscriptionStatus } from '@/lib/subscription';

/** Pages encore accessibles quand l'abonnement bloque — pour voir pourquoi et payer. */
export const SUBSCRIPTION_EXEMPT_PATHS = ['/abonnement', '/abonnement-requis', '/parametres'];

export interface RouteContext {
  loading: boolean;
  isSignedIn: boolean;
  isPlatformAdmin: boolean;
  accountRole: 'admin' | 'staff' | 'student' | 'teacher' | null;
  staffPermissions: string[] | null;
  subscriptionStatus: SubscriptionStatus | null | undefined;
  subscriptionExpiresAt: string | null | undefined;
  /** null quand l'école n'est pas encore chargée : on ne bloque pas sur une inconnue. */
  hasSchool: boolean;
  pathname: string;
}

export type RouteDecision =
  | { type: 'attendre' }                    // session ou rôle en cours de chargement
  | { type: 'rediriger'; vers: string }
  | { type: 'afficher' };

export const decideRoute = (c: RouteContext): RouteDecision => {
  if (c.loading) return { type: 'attendre' };
  if (!c.isSignedIn) return { type: 'rediriger', vers: '/auth' };

  // Le chef du système ne fait partie d'aucune école : tranché avant tout le
  // reste, car il n'a pas de accountRole.
  if (c.isPlatformAdmin) return { type: 'rediriger', vers: '/platform' };

  if (!c.accountRole) return { type: 'attendre' };

  const abonnementBloque = c.hasSchool
    && getSubscriptionGate(c.subscriptionStatus, c.subscriptionExpiresAt) !== 'ok';

  // ── L'ÉLÈVE N'EST JAMAIS BLOQUÉ ──────────────────────────────────────────
  // Décision produit : une école qui ne paie pas ne doit pas pénaliser les
  // familles. L'élève garde TOUT son portail — notes, bulletins, emploi du
  // temps, paiements, présences — et voit seulement un bandeau qui lui
  // explique la situation (BandeauEcoleImpayee). Reproduit à l'identique en
  // base : get_my_student_enrollment_id() ne contrôle jamais l'abonnement.
  if (c.accountRole === 'student') {
    return c.pathname.startsWith('/portail')
      ? { type: 'afficher' }
      : { type: 'rediriger', vers: '/portail' };
  }

  // ── LE PROFESSEUR FAIT PARTIE DE L'ÉQUIPE ────────────────────────────────
  // Il est traité comme le personnel : tant que l'école n'a pas payé, il ne
  // travaille pas. En base, get_my_teacher_enrollment_id() ferme ses notes,
  // ses présences, ses matières et son emploi du temps.
  if (c.accountRole === 'teacher') {
    if (abonnementBloque) {
      return c.pathname.startsWith('/abonnement-requis')
        ? { type: 'afficher' }
        : { type: 'rediriger', vers: '/abonnement-requis' };
    }
    return c.pathname.startsWith('/portail')
      ? { type: 'afficher' }
      : { type: 'rediriger', vers: '/portail' };
  }

  // ── Personnel et administrateur ──────────────────────────────────────────
  const pageDeSecours = SUBSCRIPTION_EXEMPT_PATHS.some(p => c.pathname.startsWith(p));

  // L'abonnement tranche AVANT les redirections de rôle. L'inverse enfermait le
  // compte caisse dans un aller-retour sans fin.
  if (abonnementBloque && !pageDeSecours) {
    return { type: 'rediriger', vers: '/abonnement-requis' };
  }

  // Caisse mobile : /caisse et rien d'autre — sauf quand l'abonnement le retient
  // sur une page de secours, qu'il doit pouvoir afficher.
  if (isCashierAccount(c.accountRole, c.staffPermissions)
      && !c.pathname.startsWith('/caisse')
      && !abonnementBloque) {
    return { type: 'rediriger', vers: '/caisse' };
  }

  return { type: 'afficher' };
};
