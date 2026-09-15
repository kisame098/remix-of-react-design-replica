import { WifiOff } from 'lucide-react';
import { useEnLigne } from '@/hooks/useEnLigne';

/**
 * Bandeau affiché sur toute l'application dès que le réseau tombe.
 *
 * L'application s'ouvre hors connexion, mais rien ne s'enregistre sans
 * internet : l'utilisateur doit le savoir AVANT de remplir un formulaire, pas
 * après avoir cliqué sur « Enregistrer ».
 */
export const BandeauHorsConnexion = () => {
  const enLigne = useEnLigne();
  if (enLigne) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[100] bg-gray-900 text-white px-4 py-2
                 flex items-center justify-center gap-2 text-xs sm:text-sm shadow-lg print:hidden"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        <strong className="font-semibold">Hors connexion.</strong>{' '}
        Les modifications ne peuvent pas être enregistrées pour l'instant.
      </span>
    </div>
  );
};
