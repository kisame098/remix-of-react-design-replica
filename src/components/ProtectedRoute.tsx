import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { decideRoute } from '@/lib/routeAccess';
import { useEnLigne } from '@/hooks/useEnLigne';
import { EcranHorsConnexion } from '@/components/EcranHorsConnexion';
import { Loader2, RefreshCw } from 'lucide-react';

/** Au-delà, on propose de réessayer au lieu de laisser tourner la roue. */
export const DELAI_CHARGEMENT_LENT = 15_000;

/**
 * Route protégée. Toute la décision (qui va où) vit dans src/lib/routeAccess.ts
 * — fonction pure couverte par routeAccess.test.ts, car une erreur de contrôle
 * d'accès ouvre un écran à qui ne devrait pas le voir, ou enferme quelqu'un
 * dans une boucle de redirections.
 */
const ProtectedRoute = () => {
  const { user, loading, accountRole, staffPermissions, isPlatformAdmin, school } = useAuth();
  const location = useLocation();
  const enLigne = useEnLigne();

  const decision = decideRoute({
    loading,
    isSignedIn: !!user,
    isPlatformAdmin,
    accountRole,
    staffPermissions,
    subscriptionStatus: school?.subscription_status,
    subscriptionExpiresAt: school?.subscription_expires_at,
    hasSchool: !!school,
    pathname: location.pathname,
  });

  // Réseau présent mais très lent (fréquent en 3G) : `navigator.onLine` dit
  // « en ligne » alors que rien n'arrive. Passé un délai, on donne la main.
  const enAttente = decision.type === 'attendre';
  const [lent, setLent] = useState(false);
  useEffect(() => {
    if (!enAttente) { setLent(false); return; }
    const minuterie = setTimeout(() => setLent(true), DELAI_CHARGEMENT_LENT);
    return () => clearTimeout(minuterie);
  }, [enAttente]);

  if (enAttente) {
    if (!enLigne) return <EcranHorsConnexion />;
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {loading ? 'Vérification de la session…' : 'Chargement du profil…'}
          </p>
          {lent && (
            <div className="mt-2 max-w-xs space-y-3">
              <p className="text-xs text-muted-foreground">
                Le chargement prend plus de temps que prévu. Votre connexion est peut-être lente.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2
                           text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (decision.type === 'rediriger') return <Navigate to={decision.vers} replace />;

  return <Outlet />;
};

export default ProtectedRoute;
