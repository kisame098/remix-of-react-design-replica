import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...a: unknown[]) => rpcMock(...a), from: vi.fn() },
}));

import {
  CLE_PUBLIQUE_VAPID, cleVersOctets, etatNotifications, retirerAbonnementDuCompte,
  type EnvironnementNotifications,
} from './notificationsPush';

// ════════════════════════════════════════════════════════════════════════════
// Que dit-on à l'élève, et que fait-on de l'abonnement quand il se déconnecte ?
// Sur un téléphone partagé, la seconde question compte plus que la première.
// ════════════════════════════════════════════════════════════════════════════

const env = (surcharge: Partial<EnvironnementNotifications> = {}): EnvironnementNotifications => ({
  serviceWorker: true, pushManager: true, notification: true,
  permission: 'default', iOS: false, installee: false, abonneCeCompte: false,
  ...surcharge,
});

describe('etatNotifications', () => {
  it('navigateur capable, rien activé : proposer', () => {
    expect(etatNotifications(env())).toBe('inactives');
  });

  it('permission accordée ET abonnement de ce compte : actives', () => {
    expect(etatNotifications(env({ permission: 'granted', abonneCeCompte: true }))).toBe('actives');
  });

  it('permission accordée mais pas pour CE compte : proposer (un frère l\'a peut-être activé)', () => {
    expect(etatNotifications(env({ permission: 'granted', abonneCeCompte: false }))).toBe('inactives');
  });

  it('abonnement en base mais permission retirée depuis : pas « actives »', () => {
    expect(etatNotifications(env({ permission: 'denied', abonneCeCompte: true }))).toBe('refusees');
  });

  it('permission refusée : expliquer comment la rétablir', () => {
    expect(etatNotifications(env({ permission: 'denied' }))).toBe('refusees');
  });

  it('iPhone dans un onglet Safari : demander d\'installer, ce n\'est pas « non supporté »', () => {
    // Dans Safari, PushManager est absent — sans ce cas, l'élève lirait à tort
    // que son téléphone ne sait pas faire de notifications.
    expect(etatNotifications(env({ iOS: true, installee: false, pushManager: false }))).toBe('a-installer-ios');
  });

  it('iPhone avec le site installé : fonctionne comme ailleurs', () => {
    expect(etatNotifications(env({ iOS: true, installee: true }))).toBe('inactives');
  });

  it('navigateur sans push : non supporté', () => {
    expect(etatNotifications(env({ pushManager: false }))).toBe('non-supporte');
    expect(etatNotifications(env({ serviceWorker: false }))).toBe('non-supporte');
    expect(etatNotifications(env({ notification: false }))).toBe('non-supporte');
  });
});

describe('clé VAPID', () => {
  it('est une clé publique P-256 non compressée : 65 octets commençant par 0x04', () => {
    const octets = cleVersOctets(CLE_PUBLIQUE_VAPID);
    expect(octets).toHaveLength(65);
    expect(octets[0]).toBe(4);
  });

  it('cleVersOctets décode le base64 « URL-safe » avec ou sans remplissage', () => {
    expect(Array.from(cleVersOctets('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(cleVersOctets('AQI'))).toEqual([1, 2]);
    expect(Array.from(cleVersOctets('-_8'))).toEqual([251, 255]);
  });
});

describe('déconnexion : retirerAbonnementDuCompte', () => {
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const abonnement = { endpoint: 'https://push.test/ep', unsubscribe };

  const installerServiceWorker = (sub: unknown) => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(sub) } }) },
    });
  };

  beforeEach(() => { rpcMock.mockReset(); unsubscribe.mockClear(); });
  afterEach(() => { Reflect.deleteProperty(navigator, 'serviceWorker'); });

  it('retire l\'abonnement de CE compte auprès du serveur, sans toucher au navigateur', async () => {
    installerServiceWorker(abonnement);
    rpcMock.mockResolvedValue({ error: null });

    await retirerAbonnementDuCompte();

    expect(rpcMock).toHaveBeenCalledWith('supprimer_abonnement_push', { p_endpoint: 'https://push.test/ep' });
    // Les autres comptes du téléphone partagent cet abonnement du navigateur.
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('si le serveur ne répond pas, l\'appareil se désabonne lui-même (échec du côté sûr)', async () => {
    installerServiceWorker(abonnement);
    rpcMock.mockResolvedValue({ error: { message: 'réseau' } });

    await retirerAbonnementDuCompte();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('si le serveur lève une exception, même chose', async () => {
    installerServiceWorker(abonnement);
    rpcMock.mockRejectedValue(new Error('hors connexion'));

    await retirerAbonnementDuCompte();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('sans abonnement : ne fait rien', async () => {
    installerServiceWorker(null);
    await retirerAbonnementDuCompte();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('sans service worker : ne lève jamais, la déconnexion doit aboutir', async () => {
    await expect(retirerAbonnementDuCompte()).resolves.toBeUndefined();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
