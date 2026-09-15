import { describe, it, expect } from 'vitest';
import {
  hasPermission, isCashierAccount, ALL_PERMISSION_KEYS, ROUTE_PERMISSIONS, PERMISSION_LABELS,
  type PermissionKey,
} from './permissions';

// ════════════════════════════════════════════════════════════════════════════
// PERMISSIONS DU PERSONNEL — une régression ouvre à un surveillant l'accès aux
// mots de passe ou à la caisse. Chaque cas de refus est testé explicitement.
// ════════════════════════════════════════════════════════════════════════════

describe('hasPermission', () => {
  it('donne tout à l\'administrateur, même sans liste de permissions', () => {
    for (const key of ALL_PERMISSION_KEYS) {
      expect(hasPermission('admin', null, key)).toBe(true);
      expect(hasPermission('admin', [], key)).toBe(true);
    }
  });

  it('ne donne au personnel que ce qui est explicitement coché', () => {
    expect(hasPermission('staff', ['students'], 'students')).toBe(true);
    expect(hasPermission('staff', ['students'], 'payments')).toBe(false);
    expect(hasPermission('staff', ['students'], 'credentials')).toBe(false);
  });

  it('refuse tout au personnel sans permission', () => {
    for (const key of ALL_PERMISSION_KEYS) {
      expect(hasPermission('staff', null, key)).toBe(false);
      expect(hasPermission('staff', [], key)).toBe(false);
    }
  });

  it('REFUSE tout aux rôles hors dashboard (élève, professeur, inconnu)', () => {
    // Un élève avec une permission fabriquée côté client ne doit rien obtenir.
    for (const role of ['student', 'teacher', 'inconnu', '', null, undefined]) {
      expect(hasPermission(role, ['payments', 'credentials'], 'payments')).toBe(false);
    }
  });

  it('ne se laisse pas tromper par une permission inventée', () => {
    expect(hasPermission('staff', ['tout', '*', 'admin'], 'payroll')).toBe(false);
  });
});

describe('isCashierAccount', () => {
  it('reconnaît un compte caisse mobile', () => {
    expect(isCashierAccount('staff', ['cashier'])).toBe(true);
  });

  it('un admin n\'est jamais un compte caisse (il garde le dashboard complet)', () => {
    expect(isCashierAccount('admin', ['cashier'])).toBe(false);
  });

  it('un personnel sans la permission caisse n\'en est pas un', () => {
    expect(isCashierAccount('staff', ['payments'])).toBe(false);
    expect(isCashierAccount('staff', null)).toBe(false);
    expect(isCashierAccount(null, ['cashier'])).toBe(false);
  });
});

describe('table des routes', () => {
  it('chaque route protégée pointe vers une permission qui existe', () => {
    for (const [route, key] of Object.entries(ROUTE_PERMISSIONS)) {
      expect(ALL_PERMISSION_KEYS, `route ${route}`).toContain(key);
    }
  });

  it('chaque permission a un libellé lisible pour l\'écran de création de compte', () => {
    for (const key of ALL_PERMISSION_KEYS) {
      expect(PERMISSION_LABELS[key as PermissionKey]).toBeTruthy();
    }
  });

  it('les sections sensibles restent protégées par une permission', () => {
    // Garde-fou : si quelqu'un retire une de ces lignes, ce test tombe.
    expect(ROUTE_PERMISSIONS['/identifiants']).toBe('credentials');
    expect(ROUTE_PERMISSIONS['/paiements']).toBe('payments');
    expect(ROUTE_PERMISSIONS['/salaires']).toBe('payroll');
    expect(ROUTE_PERMISSIONS['/notes']).toBe('grades');
  });
});
