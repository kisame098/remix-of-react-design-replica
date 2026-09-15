import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

/** Fréquence de recherche d'une nouvelle version. */
export const INTERVALLE_VERIFICATION = 60 * 60 * 1000;   // une heure

/**
 * Enregistre le service worker (application installable, ouverture hors
 * connexion) et annonce les nouvelles versions.
 *
 * La mise à jour n'est jamais imposée : recharger d'office ferait perdre à un
 * caissier l'encaissement qu'il est en train de saisir. Le bandeau reste
 * affiché tant qu'on ne l'a pas traité.
 */
export const MiseAJourApplication = () => {
  const {
    needRefresh: [aMettreAJour, setAMettreAJour],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_adresse, enregistrement) {
      // Un onglet ouvert toute la journée à la caisse ne se rechargerait
      // jamais : on vérifie nous-mêmes s'il existe une nouvelle version.
      if (!enregistrement) return;
      setInterval(() => { enregistrement.update().catch(() => { /* hors ligne */ }); }, INTERVALLE_VERIFICATION);
    },
  });

  if (!aMettreAJour) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Au-dessus de la barre de navigation basse du portail sur téléphone.
      className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 z-[100] w-[calc(100%-2rem)] max-w-md
                 rounded-2xl bg-gray-900 text-white shadow-2xl px-4 py-3 flex items-center gap-3 print:hidden"
    >
      <RefreshCw className="h-5 w-5 shrink-0 text-amber-400" />
      <p className="flex-1 text-sm leading-snug">
        <strong className="font-semibold">Nouvelle version disponible.</strong>{' '}
        Enregistrez votre saisie en cours, puis mettez à jour.
      </p>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Mettre à jour
      </button>
      <button
        type="button"
        aria-label="Plus tard"
        onClick={() => setAMettreAJour(false)}
        className="shrink-0 rounded-lg p-1 text-white/60 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
