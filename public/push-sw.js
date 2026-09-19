// ═══════════════════════════════════════════════════════════════════════════
// Notifications push — chargé par le service worker principal (importScripts,
// voir vite.config.ts). Deux rôles : afficher une notification reçue, et
// ouvrir la bonne page quand on la touche.
//
// Le texte arrive déjà composé par le serveur (supabase/functions/
// send-notifications) et ne contient jamais de note ni de montant.
// ═══════════════════════════════════════════════════════════════════════════

self.addEventListener('push', (event) => {
  let notification = {};
  try {
    notification = event.data ? event.data.json() : {};
  } catch (_) {
    notification = {};
  }

  const titre = typeof notification.title === 'string' && notification.title
    ? notification.title
    : 'SenClass';

  event.waitUntil(
    self.registration.showNotification(titre, {
      body: typeof notification.body === 'string' ? notification.body : '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: 'fr',
      // Même étiquette = la nouvelle remplace l'ancienne au lieu de s'empiler ;
      // renotify pour que ce remplacement sonne quand même.
      tag: typeof notification.tag === 'string' ? notification.tag : 'senclass',
      renotify: true,
      data: { url: typeof notification.url === 'string' ? notification.url : '/portail' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Seuls les chemins internes sont suivis : une notification ne doit jamais
  // pouvoir envoyer l'utilisateur ailleurs que sur SenClass.
  const demande = (event.notification.data && event.notification.data.url) || '/portail';
  const chemin = typeof demande === 'string' && demande.startsWith('/') && !demande.startsWith('//')
    ? demande
    : '/portail';
  const cible = new URL(chemin, self.location.origin).href;

  event.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const fenetre of fenetres) {
      if (new URL(fenetre.url).origin !== self.location.origin) continue;
      await fenetre.focus();
      // navigate() n'existe pas partout : à défaut, l'application reste
      // simplement au premier plan.
      if ('navigate' in fenetre) {
        try { await fenetre.navigate(cible); } catch (_) { /* reste au premier plan */ }
      }
      return;
    }
    await self.clients.openWindow(cible);
  })());
});
