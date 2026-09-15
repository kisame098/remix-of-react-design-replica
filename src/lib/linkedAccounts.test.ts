import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getLinkedAccounts, upsertLinkedAccount, removeLinkedAccount, type LinkedAccount } from './linkedAccounts';

// ════════════════════════════════════════════════════════════════════════════
// COMPTES LIÉS — un parent avec trois enfants scolarisés bascule de l'un à
// l'autre sans se reconnecter. Les jetons vivent dans le localStorage DE CET
// APPAREIL, jamais synchronisés. Deux risques : mélanger deux comptes (un
// parent verrait les notes du mauvais enfant) et faire planter le portail sur
// un stockage corrompu.
// ════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'teranga_linked_accounts';

const account = (userId: string, displayName: string, over: Partial<LinkedAccount> = {}): LinkedAccount => ({
  userId, email: `${userId}@terranga.com`, displayName,
  displayId: `ETU-${userId}`, role: 'student', schoolName: 'École Teranga',
  accessToken: `token-${userId}`, refreshToken: `refresh-${userId}`,
  addedAt: '2026-01-01T00:00:00.000Z', ...over,
});

beforeEach(() => localStorage.clear());

describe('getLinkedAccounts', () => {
  it('ne rend rien sur un appareil neuf', () => {
    expect(getLinkedAccounts()).toEqual([]);
  });

  it('trie les comptes par nom — l\'ordre du sélecteur doit être stable', () => {
    upsertLinkedAccount(account('u3', 'Zeynab Sow'));
    upsertLinkedAccount(account('u1', 'Aminata Fall'));
    upsertLinkedAccount(account('u2', 'Moussa Ndiaye'));
    expect(getLinkedAccounts().map(a => a.displayName))
      .toEqual(['Aminata Fall', 'Moussa Ndiaye', 'Zeynab Sow']);
  });

  it('NE PLANTE PAS sur un stockage corrompu — le portail doit rester ouvrable', () => {
    localStorage.setItem(STORAGE_KEY, 'ceci n\'est pas du JSON');
    expect(getLinkedAccounts()).toEqual([]);
  });

  it('survit à un localStorage inaccessible (navigation privée)', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(getLinkedAccounts()).toEqual([]);
    spy.mockRestore();
  });
});

describe('upsertLinkedAccount', () => {
  it('ajoute un compte avec sa date de liaison', () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'));
    upsertLinkedAccount({ ...account('u1', 'Aminata Fall'), addedAt: undefined });
    expect(getLinkedAccounts()[0].addedAt).toBe('2026-03-01T10:00:00.000Z');
    vi.useRealTimers();
  });

  it('MET À JOUR le compte existant au lieu de le dupliquer', () => {
    upsertLinkedAccount(account('u1', 'Aminata Fall'));
    upsertLinkedAccount(account('u1', 'Aminata Fall', { accessToken: 'nouveau-jeton' }));
    const all = getLinkedAccounts();
    expect(all).toHaveLength(1);
    expect(all[0].accessToken).toBe('nouveau-jeton');
  });

  it('conserve la date de première liaison lors d\'une mise à jour', () => {
    upsertLinkedAccount(account('u1', 'Aminata Fall', { addedAt: '2025-09-01T00:00:00.000Z' }));
    upsertLinkedAccount(account('u1', 'Aminata Fall', { addedAt: '2030-01-01T00:00:00.000Z' }));
    expect(getLinkedAccounts()[0].addedAt).toBe('2025-09-01T00:00:00.000Z');
  });

  it('NE MÉLANGE PAS deux comptes distincts — chacun garde ses jetons', () => {
    // Le risque à éviter absolument : un parent qui verrait les notes de
    // l'autre enfant parce que les jetons se sont écrasés.
    upsertLinkedAccount(account('u1', 'Aminata Fall'));
    upsertLinkedAccount(account('u2', 'Moussa Ndiaye'));
    const all = getLinkedAccounts();
    expect(all).toHaveLength(2);
    expect(all.find(a => a.userId === 'u1')!.accessToken).toBe('token-u1');
    expect(all.find(a => a.userId === 'u2')!.accessToken).toBe('token-u2');
  });

  it('accepte un compte professeur à côté d\'un compte élève', () => {
    upsertLinkedAccount(account('u1', 'Aminata Fall'));
    upsertLinkedAccount(account('t1', 'M. Diop', { role: 'teacher', displayId: 'PROF-t1' }));
    expect(getLinkedAccounts().map(a => a.role).sort()).toEqual(['student', 'teacher']);
  });
});

describe('removeLinkedAccount', () => {
  it('retire le compte demandé et laisse les autres intacts', () => {
    upsertLinkedAccount(account('u1', 'Aminata Fall'));
    upsertLinkedAccount(account('u2', 'Moussa Ndiaye'));
    removeLinkedAccount('u1');
    expect(getLinkedAccounts().map(a => a.userId)).toEqual(['u2']);
  });

  it('ne fait rien — sans planter — sur un compte inconnu', () => {
    upsertLinkedAccount(account('u1', 'Aminata Fall'));
    removeLinkedAccount('jamais-lié');
    expect(getLinkedAccounts()).toHaveLength(1);
  });

  it('efface bien le jeton du stockage, pas seulement de la liste affichée', () => {
    upsertLinkedAccount(account('u1', 'Aminata Fall'));
    removeLinkedAccount('u1');
    expect(localStorage.getItem(STORAGE_KEY) ?? '').not.toContain('token-u1');
  });
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});
