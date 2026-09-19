import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  abonneSurCetAppareil, activerNotifications, desactiverNotifications,
  estIOS, estInstallee, etatNotifications, type EtatNotifications,
} from '@/lib/notificationsPush';

export interface NotificationsPush {
  /** `null` tant qu'on ne sait pas (en cours de lecture, ou hors connexion). */
  etat: EtatNotifications | null;
  occupe: boolean;
  erreur: string | null;
  activer: () => Promise<void>;
  desactiver: () => Promise<void>;
}

/**
 * État des notifications push pour le compte connecté, sur cet appareil.
 *
 * L'état « actives » se lit auprès du serveur (le compte a-t-il un abonnement
 * pour CET appareil ?) et non dans le navigateur seul : la permission du
 * navigateur vaut pour tout le site, alors qu'un abonnement est propre à un
 * compte — un enfant peut l'avoir activé et pas son frère.
 */
export function useNotificationsPush(): NotificationsPush {
  const { user } = useAuth();
  const utilisateurId = user?.id ?? null;

  const [etat, setEtat] = useState<EtatNotifications | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const lireEtat = useCallback(async () => {
    const serviceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const pushManager = typeof window !== 'undefined' && 'PushManager' in window;
    const notification = typeof window !== 'undefined' && 'Notification' in window;
    const permission = notification ? Notification.permission : null;

    let abonneCeCompte = false;
    if (serviceWorker && pushManager && permission === 'granted') {
      // Sans réseau, on ne peut pas interroger le serveur : « inconnu » plutôt
      // que d'afficher « désactivées » à tort.
      if (!navigator.onLine) { setEtat(null); return; }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const abonnement = await reg?.pushManager.getSubscription();
        abonneCeCompte = !!abonnement && await abonneSurCetAppareil(abonnement.endpoint);
      } catch { abonneCeCompte = false; }
    }

    setEtat(etatNotifications({
      serviceWorker, pushManager, notification, permission,
      iOS: estIOS(), installee: estInstallee(), abonneCeCompte,
    }));
  }, []);

  // Relit à chaque changement de compte : un abonnement est propre à un compte.
  useEffect(() => {
    setErreur(null);
    if (!utilisateurId) { setEtat(null); return; }
    void lireEtat();
    window.addEventListener('online', lireEtat);
    return () => window.removeEventListener('online', lireEtat);
  }, [utilisateurId, lireEtat]);

  const activer = useCallback(async () => {
    setOccupe(true);
    setErreur(null);
    try {
      const resultat = await activerNotifications();
      if (resultat === 'indisponible') {
        setErreur("Impossible d'activer les notifications pour l'instant. Réessayez dans un moment.");
      }
    } finally {
      await lireEtat();
      setOccupe(false);
    }
  }, [lireEtat]);

  const desactiver = useCallback(async () => {
    setOccupe(true);
    setErreur(null);
    try {
      await desactiverNotifications();
    } catch {
      setErreur('Impossible de désactiver les notifications pour l\'instant. Réessayez dans un moment.');
    } finally {
      await lireEtat();
      setOccupe(false);
    }
  }, [lireEtat]);

  return { etat, occupe, erreur, activer, desactiver };
}
