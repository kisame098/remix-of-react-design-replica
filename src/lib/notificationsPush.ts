import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS PUSH — côté appareil
//
// Un abonnement relie UN appareil à UN compte. Le portail permet à un parent de
// garder plusieurs enfants sur son téléphone : le même appareil peut donc être
// abonné pour plusieurs comptes, chacun ayant activé le sien.
//
// À la déconnexion d'un compte on retire SON abonnement — jamais celui des
// autres comptes de l'appareil, et jamais l'abonnement du navigateur lui-même,
// qu'ils partagent.
// ═══════════════════════════════════════════════════════════════════════════

/** Le service worker n'est prêt que s'il est enregistré : on n'attend pas indéfiniment. */
const DELAI_SERVICE_WORKER_MS = 6_000;

export type EtatNotifications =
  | 'non-supporte'     // ce navigateur ne sait pas faire de push
  | 'a-installer-ios'  // iPhone/iPad : il faut d'abord ajouter le site à l'écran d'accueil
  | 'refusees'         // permission refusée dans les réglages du navigateur
  | 'inactives'        // possible, pas encore activé pour ce compte
  | 'actives';         // ce compte reçoit les notifications sur cet appareil

export interface EnvironnementNotifications {
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
  permission: NotificationPermission | null;
  iOS: boolean;
  installee: boolean;
  /** Ce compte a-t-il un abonnement enregistré pour cet appareil ? */
  abonneCeCompte: boolean;
}

/**
 * Décide ce qu'on affiche. Fonction pure : toute la logique « puis-je, dois-je,
 * que dire » tient ici, testée sans navigateur.
 *
 * Sur iPhone, `PushManager` n'existe que dans un site installé sur l'écran
 * d'accueil (iOS 16.4 et plus) : dans un onglet Safari il est absent, et ce
 * n'est pas « non supporté » mais « à installer ».
 */
export const etatNotifications = (e: EnvironnementNotifications): EtatNotifications => {
  if (e.iOS && !e.installee) return 'a-installer-ios';
  if (!e.serviceWorker || !e.pushManager || !e.notification) return 'non-supporte';
  if (e.permission === 'denied') return 'refusees';
  if (e.permission === 'granted' && e.abonneCeCompte) return 'actives';
  return 'inactives';
};

/** Base64 « URL-safe » → octets, format attendu par `pushManager.subscribe`. */
export const cleVersOctets = (base64: string): Uint8Array => {
  const remplissage = '='.repeat((4 - (base64.length % 4)) % 4);
  const brut = atob((base64 + remplissage).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(brut, c => c.charCodeAt(0));
};

/** Texte affiché selon l'état — exporté pour être vérifié sans monter le composant. */
export const TEXTES_NOTIFICATIONS: Record<EtatNotifications | 'inconnu', string> = {
  actives:
    'Vous recevez une alerte quand une note est saisie, qu\'un bulletin est publié, qu\'un paiement est enregistré, ou qu\'une absence, un retard ou un renvoi est noté.',
  inactives:
    'Soyez prévenu dès qu\'une note est saisie, qu\'un bulletin est publié, qu\'un paiement est enregistré, ou qu\'une absence, un retard ou un renvoi est noté, même quand l\'application est fermée.',
  refusees:
    'Les notifications sont bloquées pour SenClass. Autorisez-les dans les réglages de votre navigateur, puis revenez ici.',
  'a-installer-ios':
    'Sur iPhone, ajoutez d\'abord SenClass à votre écran d\'accueil (bouton Partager, puis « Sur l\'écran d\'accueil »), puis ouvrez l\'application depuis son icône.',
  'non-supporte':
    'Ce navigateur ne permet pas les notifications. Essayez avec Chrome ou installez l\'application.',
  inconnu:
    'Connectez-vous à internet pour gérer les notifications.',
};

// ─── Lecture de l'environnement ───────────────────────────────────────────────

export const estIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    // iPadOS se présente comme un Mac : seul l'écran tactile le trahit.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const estInstallee = (): boolean => {
  if (typeof window === 'undefined') return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
};

const attendre = <T>(promesse: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const minuterie = setTimeout(() => reject(new Error('delai')), ms);
    promesse.then(
      v => { clearTimeout(minuterie); resolve(v); },
      e => { clearTimeout(minuterie); reject(e); },
    );
  });

export const enregistrementServiceWorker = (): Promise<ServiceWorkerRegistration> =>
  attendre(navigator.serviceWorker.ready, DELAI_SERVICE_WORKER_MS);

// ─── Serveur ──────────────────────────────────────────────────────────────────

// Les fonctions RPC ne figurent pas encore dans les types générés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (nom: string, args: Record<string, unknown>) => (supabase as any).rpc(nom, args);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (nom: string) => (supabase as any).from(nom);

/** Ce compte est-il abonné, sur CET appareil ? (la politique RLS ne montre que les siens) */
export const abonneSurCetAppareil = async (endpoint: string): Promise<boolean> => {
  const { data, error } = await table('push_subscriptions').select('id').eq('endpoint', endpoint).limit(1);
  return !error && Array.isArray(data) && data.length > 0;
};

/**
 * Clé publique VAPID, lue sur le serveur : c'est lui qui la fabrique, et elle
 * change si on le réinitialise. Publique par nature — elle dit seulement au
 * service de push « seul ce serveur a le droit de m'écrire » ; la privée ne
 * quitte jamais la fonction.
 */
export const lireClePublique = async (): Promise<string | null> => {
  const { data, error } = await rpc('cle_publique_push', {});
  return !error && typeof data === 'string' && data ? data : null;
};

/**
 * Active les notifications pour le compte connecté sur cet appareil.
 * À appeler depuis un geste de l'utilisateur (un clic) : les navigateurs
 * refusent d'afficher la demande de permission autrement.
 */
export const activerNotifications = async (): Promise<'ok' | 'refusees' | 'indisponible'> => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'refusees' : 'indisponible';

  let abonnement: PushSubscription | null = null;
  let cree = false;
  try {
    const cle = await lireClePublique();
    if (!cle) return 'indisponible';

    const reg = await enregistrementServiceWorker();
    abonnement = await reg.pushManager.getSubscription();
    if (!abonnement) {
      abonnement = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleVersOctets(cle) as BufferSource,
      });
      cree = true;
    }

    const json = abonnement.toJSON();
    const { error } = await rpc('enregistrer_abonnement_push', {
      p_endpoint: abonnement.endpoint,
      p_p256dh: json.keys?.p256dh ?? '',
      p_auth: json.keys?.auth ?? '',
      p_user_agent: navigator.userAgent,
    });
    if (error) throw error;
    return 'ok';
  } catch {
    // Le serveur n'a pas enregistré l'abonnement : ne pas laisser l'appareil
    // croire qu'il est abonné. On ne défait que ce qu'on vient de créer — un
    // abonnement déjà là sert peut-être à un autre compte de cet appareil.
    if (cree) await abonnement?.unsubscribe().catch(() => undefined);
    return 'indisponible';
  }
};

/** Retire l'abonnement de CE compte sur cet appareil (les autres comptes gardent le leur). */
export const desactiverNotifications = async (): Promise<void> => {
  const reg = await enregistrementServiceWorker();
  const abonnement = await reg.pushManager.getSubscription();
  if (!abonnement) return;
  await rpc('supprimer_abonnement_push', { p_endpoint: abonnement.endpoint });
};

/**
 * À appeler AVANT `auth.signOut()`, tant que la session existe : le serveur
 * doit savoir de quel compte il s'agit. Discret par construction — une
 * déconnexion ne doit jamais échouer ni attendre à cause des notifications.
 *
 * Si le serveur n'a pas pu retirer l'abonnement (hors connexion, réponse trop
 * lente), l'appareil se désabonne LUI-MÊME : mieux vaut que les autres comptes
 * du téléphone doivent réactiver leurs notifications que de laisser celles de
 * ce compte continuer d'arriver sur un téléphone dont il vient de sortir.
 */
export const retirerAbonnementDuCompte = async (): Promise<void> => {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const abonnement = await reg?.pushManager?.getSubscription();
    if (!abonnement) return;

    try {
      const { error } = await attendre(
        rpc('supprimer_abonnement_push', { p_endpoint: abonnement.endpoint }) as Promise<{ error: unknown }>,
        3_000,
      );
      if (error) throw error;
    } catch {
      await abonnement.unsubscribe();
    }
  } catch { /* rien ne doit gêner la déconnexion */ }
};
