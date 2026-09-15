import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, PermissionKey } from '@/lib/permissions';

/**
 * Bloque l'accès à une route pour un membre du personnel (staff) qui n'a pas
 * la permission requise. Un admin passe toujours. Redirige vers /dashboard
 * plutôt que d'afficher une page vide — évite la confusion pour quelqu'un qui
 * arriverait ici via un lien direct.
 *
 * `adminOnly` bloque même un staff avec toutes les permissions cochées — pour
 * les pages sans clé de permission dédiée (ex: Paramètres, qui touche les
 * dates de l'année scolaire et donc les échéances de paiement).
 */
const RequirePermission = ({ permission, adminOnly, children }: {
  permission?: PermissionKey;
  adminOnly?: boolean;
  children: React.ReactNode;
}) => {
  const { accountRole, staffPermissions } = useAuth();

  if (adminOnly && accountRole !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  if (permission && !hasPermission(accountRole, staffPermissions, permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RequirePermission;
