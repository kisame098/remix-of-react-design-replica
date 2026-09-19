import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const rpcMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...a: unknown[]) => rpcMock(...a), from: vi.fn() },
}));

import {
  activerNotifications, cleVersOctets, etatNotifications, lireClePublique, retirerAbonnementDuCompte,
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
  it('cleVersOctets décode le base64 « URL-safe » avec ou sans remplissage', () => {
    expect(Array.from(cleVersOctets('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(cleVersOctets('AQI'))).toEqual([1, 2]);
    expect(Array.from(cleVersOctets('-_8'))).toEqual([251, 255]);
  });

  it('la clé publique se lit sur le serveur', async () => {
    rpcMock.mockResolvedValue({ data: 'CLE-PUBLIQUE', error: null });
    await expect(lireClePublique()).resolves.toBe('CLE-PUBLIQUE');
    expect(rpcMock).toHaveBeenCalledWith('cle_publique_push', {});
  });

  it.each([
    ['pas encore fabriquée', { data: null, error: null }],
    ['chaîne vide', { data: '', error: null }],
    ['erreur serveur', { data: null, error: { message: 'boum' } }],
    ['type inattendu', { data: { x: 1 }, error: null }],
  ])('%s : aucune clé, jamais de valeur inventée', async (_nom, reponse) => {
    rpcMock.mockResolvedValue(reponse);
    await expect(lireClePublique()).resolves.toBeNull();
  });
});

describe('activation : activerNotifications', () => {
  // Une clé P-256 publique factice de la bonne taille : 65 octets, base64url.
  const CLE = 'BAYNVUsMc_VgP4ylu1T3Rbt52yDasJlS-iIdrWuaNpjA_DXDYPqNUE2fJm1e4PWSlnACA_R1GObwgPoDHL1JoqU';
  const unsubscribe = vi.fn().mockResolvedValue(true);
  const nouvelAbonnement = {
    endpoint: 'https://push.test/nouveau', unsubscribe,
    toJSON: () => ({ keys: { p256dh: 'PK', auth: 'AU' } }),
  };
  const subscribe = vi.fn();
  const getSubscription = vi.fn();
  const requestPermission = vi.fn();

  beforeEach(() => {
    rpcMock.mockReset(); subscribe.mockReset(); getSubscription.mockReset();
    requestPermission.mockReset(); unsubscribe.mockClear();
    requestPermission.mockResolvedValue('granted');
    getSubscription.mockResolvedValue(null);
    subscribe.mockResolvedValue(nouvelAbonnement);
    Object.defineProperty(window, 'Notification', { configurable: true, value: { requestPermission } });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true, value: { ready: Promise.resolve({ pushManager: { getSubscription, subscribe } }) },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    Reflect.deleteProperty(window, 'Notification');
  });

  const serveur = (surcharge: { cle?: unknown; enregistrement?: unknown } = {}) =>
    rpcMock.mockImplementation((nom: string) => Promise.resolve(
      nom === 'cle_publique_push'
        ? { data: 'cle' in surcharge ? surcharge.cle : CLE, error: null }
        : { data: null, error: 'enregistrement' in surcharge ? surcharge.enregistrement : null },
    ));

  it('parcours complet : s\'abonne avec la clé du serveur, puis l\'enregistre', async () => {
    serveur();
    await expect(activerNotifications()).resolves.toBe('ok');

    const { applicationServerKey, userVisibleOnly } = subscribe.mock.calls[0][0];
    expect(userVisibleOnly).toBe(true);
    expect(applicationServerKey).toHaveLength(65);
    expect(rpcMock).toHaveBeenCalledWith('enregistrer_abonnement_push', expect.objectContaining({
      p_endpoint: 'https://push.test/nouveau', p_p256dh: 'PK', p_auth: 'AU',
    }));
  });

  it('permission refusée : ne touche à rien', async () => {
    requestPermission.mockResolvedValue('denied');
    await expect(activerNotifications()).resolves.toBe('refusees');
    expect(subscribe).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('demande fermée sans réponse : indisponible, pas « refusée »', async () => {
    requestPermission.mockResolvedValue('default');
    await expect(activerNotifications()).resolves.toBe('indisponible');
  });

  it('clé pas encore fabriquée par le serveur : ne s\'abonne pas', async () => {
    // Sans cela, l'appareil s'abonnerait avec une mauvaise clé et ne recevrait jamais rien.
    serveur({ cle: null });
    await expect(activerNotifications()).resolves.toBe('indisponible');
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('le serveur refuse l\'enregistrement : retire l\'abonnement qu\'on vient de créer', async () => {
    serveur({ enregistrement: { message: 'refusé' } });
    await expect(activerNotifications()).resolves.toBe('indisponible');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('… mais jamais un abonnement déjà là : il sert peut-être à un autre compte de l\'appareil', async () => {
    getSubscription.mockResolvedValue(nouvelAbonnement);
    serveur({ enregistrement: { message: 'refusé' } });
    await expect(activerNotifications()).resolves.toBe('indisponible');
    expect(subscribe).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it('réutilise l\'abonnement du navigateur déjà là (compte lié supplémentaire)', async () => {
    getSubscription.mockResolvedValue(nouvelAbonnement);
    serveur();
    await expect(activerNotifications()).resolves.toBe('ok');
    expect(subscribe).not.toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith('enregistrer_abonnement_push', expect.anything());
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
