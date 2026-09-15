import { useSyncExternalStore } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// ÉTAT DE LA CONNEXION
//
// L'application s'ouvre hors connexion (PWA), mais ses données vivent chez
// Supabase. Savoir qu'on est hors ligne permet de le DIRE à l'utilisateur au
// lieu de le laisser devant un chargement qui ne finit jamais.
// ═══════════════════════════════════════════════════════════════════════════

const abonner = (rappel: () => void) => {
  window.addEventListener('online', rappel);
  window.addEventListener('offline', rappel);
  return () => {
    window.removeEventListener('online', rappel);
    window.removeEventListener('offline', rappel);
  };
};

/** `navigator.onLine` n'est fiable que dans un sens : `false` veut bien dire hors ligne. */
export const estEnLigne = (): boolean =>
  typeof navigator === 'undefined' || navigator.onLine !== false;

export const useEnLigne = (): boolean =>
  useSyncExternalStore(abonner, estEnLigne, () => true);
