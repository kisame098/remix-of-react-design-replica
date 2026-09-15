import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isExpired, getSubscriptionGate, isPaidOverdue, minutesFromNowISO, TRIAL_PRESETS,
  type SubscriptionStatus,
} from './subscription';

// ════════════════════════════════════════════════════════════════════════════
// ABONNEMENTS — règle capitale : le système ne coupe JAMAIS de lui-même un
// abonnement payant échu, il ne fait que le signaler. Seule la période d'essai
// s'arrête toute seule. Une régression ici couperait l'accès d'une école qui
// paie, ou laisserait un essai courir indéfiniment.
// ════════════════════════════════════════════════════════════════════════════

const PAST = '2020-01-01T00:00:00Z';
const FUTURE = '2099-01-01T00:00:00Z';

describe('isExpired', () => {
  it('reconnaît une échéance passée et une échéance à venir', () => {
    expect(isExpired(PAST)).toBe(true);
    expect(isExpired(FUTURE)).toBe(false);
  });

  it('considère qu\'une absence d\'échéance n\'expire jamais', () => {
    expect(isExpired(null)).toBe(false);
    expect(isExpired(undefined)).toBe(false);
    expect(isExpired('')).toBe(false);
  });

  it('expire à la seconde près', () => {
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'));
    expect(isExpired('2026-05-01T11:59:59Z')).toBe(true);
    expect(isExpired('2026-05-01T12:00:01Z')).toBe(false);
    vi.useRealTimers();
  });
});

describe('getSubscriptionGate — accès au dashboard école', () => {
  it('laisse passer un abonnement actif, échéance à venir', () => {
    expect(getSubscriptionGate('active', FUTURE)).toBe('ok');
  });

  it('NE COUPE PAS un abonnement payant dont l\'échéance est passée', () => {
    // Règle produit explicite : une école qui a payé n'est jamais coupée
    // automatiquement — le chef du système décide à la main.
    expect(getSubscriptionGate('active', PAST)).toBe('ok');
  });

  it('coupe une période d\'essai écoulée — la seule coupure automatique', () => {
    expect(getSubscriptionGate('trial', PAST)).toBe('trial_expired');
  });

  it('laisse travailler un essai encore valide', () => {
    expect(getSubscriptionGate('trial', FUTURE)).toBe('ok');
  });

  it('bloque une école suspendue ou résiliée, quelle que soit l\'échéance', () => {
    expect(getSubscriptionGate('suspended', FUTURE)).toBe('suspended');
    expect(getSubscriptionGate('suspended', PAST)).toBe('suspended');
    expect(getSubscriptionGate('cancelled', FUTURE)).toBe('cancelled');
    expect(getSubscriptionGate('cancelled', null)).toBe('cancelled');
  });

  it('la suspension l\'emporte sur un essai expiré (motif affiché le plus précis)', () => {
    expect(getSubscriptionGate('suspended', PAST)).toBe('suspended');
  });

  it('laisse passer un statut inconnu ou absent plutôt que de bloquer une école par erreur', () => {
    expect(getSubscriptionGate(null, null)).toBe('ok');
    expect(getSubscriptionGate(undefined, PAST)).toBe('ok');
  });

  it('un essai sans date de fin ne bloque pas', () => {
    expect(getSubscriptionGate('trial', null)).toBe('ok');
  });
});

describe('isPaidOverdue — signal pour le chef du système', () => {
  it('signale uniquement un abonnement payant échu', () => {
    expect(isPaidOverdue('active', PAST)).toBe(true);
    expect(isPaidOverdue('active', FUTURE)).toBe(false);
  });

  it('ne signale ni un essai, ni une suspension, ni une résiliation', () => {
    expect(isPaidOverdue('trial', PAST)).toBe(false);
    expect(isPaidOverdue('suspended', PAST)).toBe(false);
    expect(isPaidOverdue('cancelled', PAST)).toBe(false);
    expect(isPaidOverdue(null, PAST)).toBe(false);
  });

  it('un abonnement échu est signalé mais reste ouvert — les deux règles cohabitent', () => {
    expect(isPaidOverdue('active', PAST)).toBe(true);
    expect(getSubscriptionGate('active', PAST)).toBe('ok');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PARITÉ CLIENT / SERVEUR
//
// Le routeur React n'est qu'un confort d'affichage : le vrai blocage est en
// base, dans `is_school_access_allowed()` (docs/sql/subscription_enforcement.sql),
// qui ferme l'accès aux données de l'école via get_my_school_id().
//
// Les deux règles doivent dire EXACTEMENT la même chose. Si elles divergent,
// soit une école bloquée voit encore ses données (le trou qu'on vient de
// fermer), soit une école en règle se retrouve devant des écrans vides sans
// comprendre pourquoi. Ces tests lisent le fichier SQL pour le vérifier.
// ════════════════════════════════════════════════════════════════════════════

describe('parité avec le blocage serveur', () => {
  const SQL = readFileSync(
    join(process.cwd(), 'docs/sql/subscription_enforcement.sql'), 'utf8');

  const ALL_STATUSES: SubscriptionStatus[] = ['trial', 'active', 'suspended', 'cancelled'];

  it('le fichier de blocage serveur existe et gate bien get_my_school_id', () => {
    expect(SQL).toContain('is_school_access_allowed');
    expect(SQL).toContain('create or replace function public.get_my_school_id()');
    expect(SQL).toMatch(/get_my_school_id[\s\S]*is_school_access_allowed/);
  });

  it('CHAQUE statut d\'abonnement connu du client est traité côté serveur', () => {
    // Ajouter un statut en TypeScript sans l'ajouter au SQL ferait silencieusement
    // passer les écoles de ce statut à travers le blocage.
    for (const status of ALL_STATUSES) {
      expect(SQL, `statut "${status}" absent du SQL`).toContain(`'${status}'`);
    }
  });

  it('les statuts bloqués côté client sont ceux refusés côté serveur', () => {
    const bloquesClient = ALL_STATUSES.filter(s => getSubscriptionGate(s, FUTURE) !== 'ok');
    expect(bloquesClient).toEqual(['suspended', 'cancelled']);
    // Le SQL les refuse ensemble, dans une seule liste.
    expect(SQL).toMatch(/subscription_status in \('suspended',\s*'cancelled'\)/);
  });

  it('l\'essai écoulé est la SEULE coupure automatique, des deux côtés', () => {
    expect(getSubscriptionGate('trial', PAST)).toBe('trial_expired');
    expect(SQL).toMatch(/subscription_status = 'trial'[\s\S]*subscription_expires_at < now\(\)/);
  });

  it('un abonnement PAYANT échu n\'est coupé NI côté client NI côté serveur', () => {
    expect(getSubscriptionGate('active', PAST)).toBe('ok');
    // Côté SQL, seul 'trial' est associé à un test d'échéance : 'active' ne
    // doit apparaître dans aucune condition de blocage.
    const conditionsDeBlocage = SQL.match(/when[\s\S]*?then false/g) ?? [];
    expect(conditionsDeBlocage.length).toBeGreaterThan(0);
    for (const cond of conditionsDeBlocage) {
      expect(cond, `condition bloquant un abonnement actif : ${cond}`).not.toContain("'active'");
    }
  });

  it('les écoles bloquées gardent de quoi se remettre en règle', () => {
    // Bouées de sauvetage : sans elles, une école suspendue ne pourrait ni voir
    // sa suspension, ni payer pour en sortir.
    expect(SQL).toContain('get_my_membership_school_id');
    expect(SQL).toContain('submit_payment_claim');
    expect(SQL).toMatch(/billing_transactions[\s\S]*get_my_membership_school_id/);
  });

  it('le statut d\'abonnement n\'est plus écrivable par une école', () => {
    // Le piège : un REVOKE colonne par colonne ne fait rien contre un GRANT au
    // niveau de la table — il faut retirer le droit de table puis re-donner les
    // seules colonnes de la fiche école.
    expect(SQL).toMatch(/revoke update on public\.schools from authenticated/);
    const grant = SQL.match(/grant update \(([^)]*)\)\s*\n?\s*on public\.schools to authenticated/);
    expect(grant, 'aucun re-grant des colonnes de la fiche école').not.toBeNull();
    for (const colonne of ['subscription_status', 'subscription_plan', 'subscription_expires_at']) {
      expect(grant![1], `${colonne} ne doit jamais être re-donnée`).not.toContain(colonne);
    }
    expect(grant![1]).toContain('settings'); // /parametres doit continuer à marcher
  });

  it('les élèves et professeurs ne sont bloqués par l\'abonnement d\'aucun côté', () => {
    // Règle produit déjà posée dans ProtectedRoute.tsx : seul le dashboard
    // admin/staff se ferme. Le SQL ne doit donc pas gater la voie du portail.
    expect(SQL).toContain('get_my_account_school_id');
    expect(SQL).not.toMatch(/get_my_account_school_id[\s\S]{0,80}is_school_access_allowed/);
  });
});

describe('durées d\'essai', () => {
  afterEach(() => vi.useRealTimers());

  it('propose la minute de test et jusqu\'à 30 jours', () => {
    const minutes = TRIAL_PRESETS.map(p => p.minutes);
    expect(minutes).toContain(1);                 // test immédiat
    expect(minutes).toContain(60 * 24 * 7);       // défaut 7 jours
    expect(minutes).toContain(60 * 24 * 30);
    expect(Math.max(...minutes)).toBe(60 * 24 * 30);
  });

  it('propose des durées strictement croissantes', () => {
    const minutes = TRIAL_PRESETS.map(p => p.minutes);
    expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
  });

  it('calcule une échéance exacte à partir de maintenant', () => {
    vi.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));
    expect(minutesFromNowISO(1)).toBe('2026-05-01T12:01:00.000Z');
    expect(minutesFromNowISO(60 * 24 * 7)).toBe('2026-05-08T12:00:00.000Z');
  });

  it('un essai d\'une minute expire bien une minute plus tard', () => {
    vi.setSystemTime(new Date('2026-05-01T12:00:00.000Z'));
    const expiresAt = minutesFromNowISO(1);
    expect(getSubscriptionGate('trial', expiresAt)).toBe('ok');
    vi.setSystemTime(new Date('2026-05-01T12:01:30.000Z'));
    expect(getSubscriptionGate('trial', expiresAt)).toBe('trial_expired');
  });
});
