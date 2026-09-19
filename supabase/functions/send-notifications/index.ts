// ═══════════════════════════════════════════════════════════════════════════
// send-notifications — envoie les notifications push en attente.
//
// Appelée toutes les 10 secondes par pg_cron (voir docs/sql/notifications_push.sql),
// seulement quand la file contient quelque chose — ou tant que les clés VAPID
// n'existent pas encore. Elle n'est pas destinée aux navigateurs : `verify_jwt`
// est désactivé (pg_net n'a pas de jeton utilisateur) et l'accès est protégé
// par un secret partagé.
//
// AUCUN secret à configurer à la main. Tout vit dans le coffre chiffré de
// Supabase (Vault) :
//   • le secret du planificateur, généré par le SQL ;
//   • la clé privée VAPID, fabriquée ici au premier appel.
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { composerNotifications, type LigneFile } from './notifications.ts';
import { genererPaireVapid } from './vapid.ts';

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
  // Sans en-tête, inutile d'aller plus loin — et rien n'est lu en base.
  const fourni = req.headers.get('x-cron-secret');
  if (!fourni) return json({ erreur: 'Non autorisé' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Échoue FERMÉ : secret absent ou illisible, personne n'entre.
  const { data: secret, error: erreurSecret } = await admin.rpc('push_secret_lire', { p_nom: 'senclass_cron_secret' });
  if (erreurSecret) return json({ erreur: 'Indisponible' }, 500);
  if (!secret || !egaux(String(secret), fourni)) return json({ erreur: 'Non autorisé' }, 401);

  // ── Clés VAPID : lues dans le coffre, fabriquées au tout premier appel ──────
  const lireCles = async () => {
    const [pub, priv] = await Promise.all([
      admin.from('push_config').select('valeur').eq('cle', 'vapid_public').maybeSingle(),
      admin.rpc('push_secret_lire', { p_nom: 'senclass_vapid_privee' }),
    ]);
    return { publique: pub.data?.valeur as string | undefined, privee: priv.data as string | null };
  };

  let { publique, privee } = await lireCles();
  let initialisees = false;
  if (!publique || !privee) {
    const paire = await genererPaireVapid();
    // Le SQL n'écrit qu'une fois et renvoie false si une autre exécution a été
    // plus rapide : on relit alors la paire de la gagnante, jamais la nôtre.
    const { data: creees, error } = await admin.rpc('push_initialiser_cles', {
      p_publique: paire.publique, p_privee: paire.privee,
    });
    if (error) return json({ erreur: 'Initialisation impossible' }, 500);
    initialisees = creees === true;
    ({ publique, privee } = await lireCles());
  }
  if (!publique || !privee) return json({ erreur: 'Clés VAPID indisponibles' }, 500);
  webpush.setVapidDetails('mailto:contact@senclass.com', publique, privee);

  const { data: lignes, error } = await admin.rpc('notifications_reclamer', { p_limite: 500 });
  if (error) return json({ erreur: error.message }, 500);
  if (!lignes?.length) return json({ envoyees: 0, initialisees });

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

  return json({ envoyees, echecs, lignes: lignes.length, initialisees });
});
