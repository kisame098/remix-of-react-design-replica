import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { modeDeLEcole, type ModeGestion } from '@/lib/modeGestion';

/**
 * Réserve une page à un mode de gestion. Une école en « formation
 * professionnelle » n'a plus les pages classiques (classes, notes, cursus) : un
 * lien direct ou un favori l'amène à son propre espace, et inversement une
 * école classique n'accède pas aux pages du mode formation.
 */
const ModeRoute = ({ mode, children }: { mode: ModeGestion; children: React.ReactNode }) => {
  const { school } = useAuth();
  const actuel = modeDeLEcole(school);
  if (actuel !== mode) {
    return <Navigate to={actuel === 'formation_pro' ? '/formation' : '/dashboard'} replace />;
  }
  return <>{children}</>;
};

export default ModeRoute;
