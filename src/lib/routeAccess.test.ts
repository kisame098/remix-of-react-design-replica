import { describe, it, expect } from 'vitest';
import { decideRoute, SUBSCRIPTION_EXEMPT_PATHS, type RouteContext } from './routeAccess';

// ════════════════════════════════════════════════════════════════════════════
// CONTRÔLE D'ACCÈS DU DASHBOARD.
//
// Deux façons de se tromper, aussi graves l'une que l'autre : ouvrir un écran à
// qui ne devrait pas le voir, ou enfermer quelqu'un dans une boucle de
// redirections dont il ne peut plus sortir.
//
// Rappel : le vrai verrou est en base. Ces règles évitent d'afficher des écrans
// vides — elles ne sont pas la sécurité.
// ════════════════════════════════════════════════════════════════════════════

const ctx = (over: Partial<RouteContext> = {}): RouteContext => ({
  loading: false, isSignedIn: true, isPlatformAdmin: false,
  accountRole: 'admin', staffPermissions: [],
  subscriptionStatus: 'active', subscriptionExpiresAt: '2099-01-01',
  hasSchool: true, pathname: '/dashboard', ...over,
});

const FUTUR = '2099-01-01';
const PASSE = '2020-01-01';

describe('decideRoute — session', () => {
  it('attend pendant le chargement, sans rien décider', () => {
    expect(decideRoute(ctx({ loading: true }))).toEqual({ type: 'attendre' });
  });

  it('renvoie à la connexion si personne n\'est connecté', () => {
    expect(decideRoute(ctx({ isSignedIn: false }))).toEqual({ type: 'rediriger', vers: '/auth' });
  });

  it('attend tant que le rôle est inconnu, plutôt que d\'ouvrir le dashboard', () => {
    expect(decideRoute(ctx({ accountRole: null }))).toEqual({ type: 'attendre' });
  });

  it('envoie le chef du système dans son espace, jamais dans une école', () => {
    expect(decideRoute(ctx({ isPlatformAdmin: true, accountRole: null })))
      .toEqual({ type: 'rediriger', vers: '/platform' });
  });
});

describe('decideRoute — élèves et professeurs', () => {
  it('les envoie au portail, et les y laisse, quand l\'école est en règle', () => {
    for (const role of ['student', 'teacher'] as const) {
      expect(decideRoute(ctx({ accountRole: role, pathname: '/dashboard' })))
        .toEqual({ type: 'rediriger', vers: '/portail' });
      expect(decideRoute(ctx({ accountRole: role, pathname: '/portail/notes' })))
        .toEqual({ type: 'afficher' });
    }
  });

  it('L\'ÉLÈVE N\'EST JAMAIS BLOQUÉ par l\'abonnement de son école', () => {
    // Décision produit : l'élève n'est pour rien dans l'impayé de son école.
    // Il garde tout son portail et voit seulement un bandeau d'information.
    // Reproduit à l'identique en base : get_my_student_enrollment_id() ne
    // contrôle jamais l'abonnement.
    const pages = ['/portail', '/portail/notes', '/portail/paiements',
                   '/portail/presences', '/portail/emploi', '/portail/profil'];
    for (const statut of ['suspended', 'cancelled'] as const)
      for (const pathname of pages)
        expect(decideRoute(ctx({ accountRole: 'student', pathname, subscriptionStatus: statut })),
          `${statut} ${pathname}`).toEqual({ type: 'afficher' });

    expect(decideRoute(ctx({
      accountRole: 'student', pathname: '/portail',
      subscriptionStatus: 'trial', subscriptionExpiresAt: PASSE,
    }))).toEqual({ type: 'afficher' });
  });

  it('LE PROFESSEUR EST BLOQUÉ comme le personnel', () => {
    // Il fait partie de l'équipe : tant que l'école n'a pas payé, il ne
    // travaille pas. En base, get_my_teacher_enrollment_id() ferme ses notes,
    // ses présences, ses matières et son emploi du temps.
    for (const statut of ['suspended', 'cancelled'] as const)
      for (const pathname of ['/portail', '/portail/notes', '/portail/presences'])
        expect(decideRoute(ctx({ accountRole: 'teacher', pathname, subscriptionStatus: statut })),
          `${statut} ${pathname}`).toEqual({ type: 'rediriger', vers: '/abonnement-requis' });

    expect(decideRoute(ctx({
      accountRole: 'teacher', pathname: '/portail',
      subscriptionStatus: 'trial', subscriptionExpiresAt: PASSE,
    }))).toEqual({ type: 'rediriger', vers: '/abonnement-requis' });
  });

  it('le professeur bloqué peut AFFICHER l\'écran qui lui explique pourquoi', () => {
    expect(decideRoute(ctx({
      accountRole: 'teacher', pathname: '/abonnement-requis', subscriptionStatus: 'suspended',
    }))).toEqual({ type: 'afficher' });
  });

  it('un abonnement payant échu ne bloque ni l\'élève ni le professeur', () => {
    for (const role of ['student', 'teacher'] as const)
      expect(decideRoute(ctx({
        accountRole: role, pathname: '/portail',
        subscriptionStatus: 'active', subscriptionExpiresAt: PASSE,
      })), role).toEqual({ type: 'afficher' });
  });
});

describe('decideRoute — abonnement bloqué', () => {
  const bloque = (over: Partial<RouteContext> = {}) =>
    ctx({ subscriptionStatus: 'suspended', ...over });

  it('ferme le dashboard au personnel comme à l\'administrateur', () => {
    // LE POINT CAPITAL : si le personnel passait, il suffirait de créer un
    // compte personnel tout-puissant pour contourner la suspension.
    for (const role of ['admin', 'staff'] as const) {
      expect(decideRoute(bloque({ accountRole: role, pathname: '/eleves' })), role)
        .toEqual({ type: 'rediriger', vers: '/abonnement-requis' });
      expect(decideRoute(bloque({ accountRole: role, pathname: '/paiements' })), role)
        .toEqual({ type: 'rediriger', vers: '/abonnement-requis' });
    }
  });

  it('ferme aussi sur un essai écoulé et une résiliation', () => {
    expect(decideRoute(ctx({ subscriptionStatus: 'trial', subscriptionExpiresAt: PASSE, pathname: '/eleves' })))
      .toEqual({ type: 'rediriger', vers: '/abonnement-requis' });
    expect(decideRoute(ctx({ subscriptionStatus: 'cancelled', pathname: '/eleves' })))
      .toEqual({ type: 'rediriger', vers: '/abonnement-requis' });
  });

  it('NE FERME PAS sur un abonnement payant échu — le système ne coupe jamais seul', () => {
    expect(decideRoute(ctx({ subscriptionStatus: 'active', subscriptionExpiresAt: PASSE, pathname: '/eleves' })))
      .toEqual({ type: 'afficher' });
  });

  it('laisse ouvertes les pages qui permettent de régler la situation', () => {
    for (const page of SUBSCRIPTION_EXEMPT_PATHS) {
      expect(decideRoute(bloque({ pathname: page })), page).toEqual({ type: 'afficher' });
    }
  });

  it('ne bloque pas une école dont la fiche n\'est pas encore chargée', () => {
    // Sinon on renverrait vers l'écran d'abonnement le temps d'un battement,
    // à des écoles parfaitement en règle.
    expect(decideRoute(ctx({ hasSchool: false, subscriptionStatus: undefined, pathname: '/eleves' })))
      .toEqual({ type: 'afficher' });
  });
});

describe('decideRoute — compte caisse mobile', () => {
  const caisse = (over: Partial<RouteContext> = {}) =>
    ctx({ accountRole: 'staff', staffPermissions: ['cashier'], ...over });

  it('est confiné à /caisse quand tout va bien', () => {
    expect(decideRoute(caisse({ pathname: '/dashboard' })))
      .toEqual({ type: 'rediriger', vers: '/caisse' });
    expect(decideRoute(caisse({ pathname: '/caisse' }))).toEqual({ type: 'afficher' });
  });

  it('un compte caisse ne voit pas le dashboard, même avec d\'autres permissions cochées', () => {
    expect(decideRoute(caisse({ staffPermissions: ['cashier', 'payments', 'grades'], pathname: '/paiements' })))
      .toEqual({ type: 'rediriger', vers: '/caisse' });
  });

  it('est bien bloqué quand l\'abonnement l\'est', () => {
    expect(decideRoute(caisse({ pathname: '/caisse', subscriptionStatus: 'suspended' })))
      .toEqual({ type: 'rediriger', vers: '/abonnement-requis' });
  });

  it('NE REBONDIT PAS À L\'INFINI entre /caisse et /abonnement-requis', () => {
    // Le bug : la règle de rôle le renvoyait sur /caisse, d'où l'abonnement le
    // renvoyait sur /abonnement-requis, et ainsi de suite — écran figé.
    const surPageDeSecours = caisse({ pathname: '/abonnement-requis', subscriptionStatus: 'suspended' });
    expect(decideRoute(surPageDeSecours)).toEqual({ type: 'afficher' });
  });

  it('aucun rôle ne peut boucler : deux redirections mènent toujours à un écran', () => {
    // Garde-fou général contre les cycles, sur toutes les combinaisons.
    const roles = ['admin', 'staff', 'teacher', 'student'] as const;
    const statuts = ['active', 'trial', 'suspended', 'cancelled'] as const;
    const pages = ['/dashboard', '/caisse', '/eleves', '/abonnement-requis', '/parametres',
                   '/paiements', '/portail', '/portail/notes', '/portail/profil'];
    const permissions = [[], ['cashier'], ['payments'], ['cashier', 'payments']];

    for (const accountRole of roles)
      for (const subscriptionStatus of statuts)
        for (const staffPermissions of permissions)
          for (const pathname of pages) {
            let courant = pathname;
            const vus = new Set<string>();
            for (let i = 0; i < 6; i++) {
              const d = decideRoute(ctx({
                accountRole, staffPermissions, subscriptionStatus,
                subscriptionExpiresAt: subscriptionStatus === 'trial' ? PASSE : FUTUR,
                pathname: courant,
              }));
              if (d.type !== 'rediriger') break;
              expect(vus.has(d.vers),
                `boucle : ${accountRole}/${subscriptionStatus}/[${staffPermissions}] ${pathname} → ${d.vers}`
              ).toBe(false);
              vus.add(d.vers);
              courant = d.vers;
            }
          }
  });
});
