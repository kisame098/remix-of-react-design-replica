import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ════════════════════════════════════════════════════════════════════════════
// public/push-sw.js s'exécute dans un service worker, hors de portée des tests
// habituels. On le fait tourner ici dans un faux `self`, pour vérifier ce que
// l'appareil affiche réellement et où mène un clic.
// ════════════════════════════════════════════════════════════════════════════

const code = readFileSync(join(process.cwd(), 'public/push-sw.js'), 'utf8');
const ORIGINE = 'https://senclass.com';

type Ecouteur = (event: unknown) => void;

const monter = (fenetres: { url: string; focus: () => Promise<void>; navigate?: (u: string) => Promise<void> }[] = []) => {
  const ecouteurs = new Map<string, Ecouteur>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const self = {
    location: { origin: ORIGINE },
    registration: { showNotification },
    clients: { matchAll: vi.fn().mockResolvedValue(fenetres), openWindow },
    addEventListener: (nom: string, fn: Ecouteur) => ecouteurs.set(nom, fn),
  };
  new Function('self', code)(self);
  return { ecouteurs, showNotification, openWindow };
};

/** Un évènement dont `waitUntil` capture la promesse pour qu'on l'attende. */
const evenement = <T extends object>(extra: T = {} as T) => {
  let promesse: Promise<unknown> = Promise.resolve();
  return { ...extra, waitUntil: (p: Promise<unknown>) => { promesse = p; }, attendre: () => promesse };
};

describe('réception : push', () => {
  it('affiche titre, texte, étiquette et lien tels que le serveur les a composés', async () => {
    const { ecouteurs, showNotification } = monter();
    const e = evenement({ data: { json: () => ({ title: 'Nouvelle note', body: 'En Maths.', tag: 'notes', url: '/portail/notes' }) } });
    ecouteurs.get('push')!(e);
    await e.attendre();

    expect(showNotification).toHaveBeenCalledWith('Nouvelle note', expect.objectContaining({
      body: 'En Maths.', tag: 'notes', renotify: true, lang: 'fr',
      icon: '/pwa-192x192.png', badge: '/pwa-64x64.png',
      data: { url: '/portail/notes' },
    }));
  });

  it('une charge illisible affiche quand même quelque chose plutôt que de disparaître', async () => {
    const { ecouteurs, showNotification } = monter();
    const e = evenement({ data: { json: () => { throw new Error('pas du JSON'); } } });
    ecouteurs.get('push')!(e);
    await e.attendre();

    expect(showNotification).toHaveBeenCalledWith('SenClass', expect.objectContaining({ data: { url: '/portail' } }));
  });

  it('une charge vide aussi', async () => {
    const { ecouteurs, showNotification } = monter();
    const e = evenement({ data: null });
    ecouteurs.get('push')!(e);
    await e.attendre();
    expect(showNotification).toHaveBeenCalledWith('SenClass', expect.anything());
  });

  it('ne se laisse pas piéger par des types inattendus', async () => {
    const { ecouteurs, showNotification } = monter();
    const e = evenement({ data: { json: () => ({ title: 42, body: {}, tag: [], url: 7 }) } });
    ecouteurs.get('push')!(e);
    await e.attendre();
    expect(showNotification).toHaveBeenCalledWith('SenClass', expect.objectContaining({
      body: '', tag: 'senclass', data: { url: '/portail' },
    }));
  });
});

describe('clic sur la notification', () => {
  const clic = (url: unknown) => evenement({ notification: { close: vi.fn(), data: { url } } });

  beforeEach(() => vi.clearAllMocks());

  it('ferme la notification', async () => {
    const { ecouteurs } = monter();
    const e = clic('/portail/notes');
    ecouteurs.get('notificationclick')!(e);
    await e.attendre();
    expect(e.notification.close).toHaveBeenCalled();
  });

  it('application déjà ouverte : la ramène au premier plan et va à la bonne page', async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn().mockResolvedValue(undefined);
    const { ecouteurs, openWindow } = monter([{ url: `${ORIGINE}/portail`, focus, navigate }]);
    const e = clic('/portail/paiements');
    ecouteurs.get('notificationclick')!(e);
    await e.attendre();

    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(`${ORIGINE}/portail/paiements`);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('application fermée : l\'ouvre sur la bonne page', async () => {
    const { ecouteurs, openWindow } = monter([]);
    const e = clic('/portail/notes');
    ecouteurs.get('notificationclick')!(e);
    await e.attendre();
    expect(openWindow).toHaveBeenCalledWith(`${ORIGINE}/portail/notes`);
  });

  it('ignore les fenêtres d\'un autre site', async () => {
    const focusEtranger = vi.fn();
    const { ecouteurs, openWindow } = monter([{ url: 'https://autre-site.com/', focus: focusEtranger }]);
    const e = clic('/portail');
    ecouteurs.get('notificationclick')!(e);
    await e.attendre();
    expect(focusEtranger).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalled();
  });

  it('navigateur sans navigate() : reste au premier plan sans planter', async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const { ecouteurs, openWindow } = monter([{ url: `${ORIGINE}/`, focus }]);
    const e = clic('/portail/notes');
    ecouteurs.get('notificationclick')!(e);
    await expect(e.attendre()).resolves.toBeUndefined();
    expect(focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it.each([
    ['adresse absolue', 'https://pirate.example/vol'],
    ['adresse relative au protocole', '//pirate.example/vol'],
    ['schéma javascript', 'javascript:alert(1)'],
    ['type inattendu', 42],
    ['absent', undefined],
  ])('%s : ne mène JAMAIS hors de SenClass', async (_nom, url) => {
    const { ecouteurs, openWindow } = monter([]);
    const e = clic(url);
    ecouteurs.get('notificationclick')!(e);
    await e.attendre();
    expect(openWindow).toHaveBeenCalledWith(`${ORIGINE}/portail`);
  });
});
