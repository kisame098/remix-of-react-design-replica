import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

/**
 * Route réservée au compte "chef du système" (table platform_admins) —
 * n'appartient à aucune école, pilote toutes les écoles. Miroir de
 * ProtectedRoute.tsx mais pour ce rôle orthogonal aux rôles école.
 */
const PlatformAdminRoute = () => {
  const { user, loading, isPlatformAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default PlatformAdminRoute;
