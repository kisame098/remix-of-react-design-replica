import { Loader2 } from 'lucide-react';

/**
 * Affiché le temps de télécharger le code d'un écran (chargement différé des
 * pages, voir App.tsx). Une fois l'application installée, ce code vient du
 * téléphone lui-même et cet écran ne fait que clignoter.
 */
export const ChargementPage = ({ pleinEcran = false }: { pleinEcran?: boolean }) => (
  <div
    className={pleinEcran
      ? 'flex min-h-screen w-full items-center justify-center bg-background'
      : 'flex w-full items-center justify-center py-24'}
    role="status"
    aria-label="Chargement"
  >
    <Loader2 className="h-7 w-7 animate-spin text-primary" />
  </div>
);
