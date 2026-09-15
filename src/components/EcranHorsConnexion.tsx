import { RefreshCw, WifiOff } from 'lucide-react';

/**
 * Remplace le chargement infini quand l'application s'ouvre sans réseau.
 *
 * La session est gardée sur l'appareil, mais le rôle de l'utilisateur (admin,
 * élève, professeur…) se lit chez Supabase. Sans internet, on ne peut pas
 * savoir quel écran lui montrer : on le dit, plutôt que de faire tourner une
 * roue qui ne s'arrêtera jamais. Dès le retour du réseau, AuthContext recharge
 * le profil et l'application reprend d'elle-même.
 */
export const EcranHorsConnexion = () => (
  <div className="flex min-h-screen w-full items-center justify-center bg-background px-6">
    <div className="max-w-sm text-center space-y-4">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
        <WifiOff className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-bold text-foreground">Vous êtes hors connexion</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        SenClass a besoin d'internet pour charger vos informations.
        L'application reprendra toute seule dès le retour du réseau.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold
                   text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Réessayer
      </button>
    </div>
  </div>
);
