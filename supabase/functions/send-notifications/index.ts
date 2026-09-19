// ═══════════════════════════════════════════════════════════════════════════
// send-notifications — envoie les notifications push en attente.
//
// Appelée chaque minute par pg_cron (voir docs/sql/notifications_push.sql),
// seulement quand la file contient quelque chose. Elle n'est pas destinée aux
// navigateurs : `verify_jwt` est désactivé (pg_net n'a pas de jeton
// utilisateur) et l'accès est protégé par un secret partagé, `CRON_SECRET`.
//
// Secrets à définir (Edge Functions → Secrets) :
//   CRON_SECRET         même valeur que le secret Vault `senclass_cron_secret`
//   VAPID_PUBLIC_KEY    clé publique  (la même que dans src/lib/notificationsPush.ts)
//   VAPID_PRIVATE_KEY   clé privée
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { composerNotifications, type LigneFile } from './notifications.ts';

interface AbonnementPush { endpoint: string; p256dh: string; auth: string }

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

/** Comparaison en temps constant : ne révèle pas le secret par le temps de réponse. */
const egaux = (a: string, b: string): boolean => {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
};

Deno.serve(async (req) => {
  // Échoue FERMÉ : sans secret configuré, personne n'entre.
  const secret = Deno.env.get('CRON_SECRET');
  const fourni = req.headers.get('x-cron-secret');
  if (!secret || !fourni || !egaux(secret, fourni)) return json({ erreur: 'Non autorisé' }, 401);

  const clePublique = Deno.env.get('VAPID_PUBLIC_KEY');
  const clePrivee = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!clePublique || !clePrivee) return json({ erreur: 'Clés VAPID manquantes' }, 500);
  webpush.setVapidDetails('mailto:contact@senclass.com', clePublique, clePrivee);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: lignes, error } = await admin.rpc('notifications_reclamer', { p_limite: 500 });
  if (error) return json({ erreur: error.message }, 500);
  if (!lignes?.length) return json({ envoyees: 0 });

  // Une série par compte.
  const parCompte = new Map<string, (LigneFile & { id: string })[]>();
  for (const l of lignes as (LigneFile & { auth_user_id: string })[]) {
    parCompte.set(l.auth_user_id, [...(parCompte.get(l.auth_user_id) ?? []), l]);
  }

  const traitees: string[] = [];
  let envoyees = 0;
  let echecs = 0;

  for (const [compteId, seriesLignes] of parCompte) {
    const { data: abonnements } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('auth_user_id', compteId);

    const notifications = composerNotifications(seriesLignes);
    let livree = false;
    let echecTransitoire = false;

    for (const abo of (abonnements ?? []) as AbonnementPush[]) {
      for (const notification of notifications) {
        try {
          await webpush.sendNotification(
            { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
            JSON.stringify(notification),
            { TTL: 60 * 60 * 24, urgency: 'normal' },
          );
          envoyees++;
          livree = true;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            // Appareil désinstallé ou permission retirée : l'abonnement est mort.
            await admin.from('push_subscriptions').delete().eq('endpoint', abo.endpoint);
            break;
          }
          echecs++;
          echecTransitoire = true;
        }
      }
    }

    // Terminé si livré, ou s'il n'y a plus personne à qui livrer. En cas
    // d'échec passager, la ligne reste : elle sera reprise (3 essais au plus).
    if (livree || !echecTransitoire) traitees.push(...seriesLignes.map(l => l.id));
  }

  if (traitees.length) {
    await admin.from('notification_queue').update({ sent_at: new Date().toISOString() }).in('id', traitees);
  }

  return json({ envoyees, echecs, lignes: lignes.length });
});
