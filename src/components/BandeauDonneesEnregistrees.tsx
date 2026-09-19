import { Clock } from 'lucide-react';
import { useEnLigne } from '@/hooks/useEnLigne';
import { dateLisible } from '@/lib/cacheHorsLigne';

/**
 * Rappelle, hors connexion, de quand datent les données affichées.
 *
 * Sans cette date, un élève pourrait croire que sa moyenne ou son solde de
 * scolarité sont à jour alors qu'ils datent de la veille.
 */
export const BandeauDonneesEnregistrees = ({ enregistreLe }: { enregistreLe: string | null }) => {
  const enLigne = useEnLigne();
  if (enLigne || !enregistreLe) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2
                 text-xs text-amber-900 print:hidden"
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Données enregistrées le <strong className="font-semibold">{dateLisible(enregistreLe)}</strong>.
        Sans connexion, elles ne se mettent pas à jour.
      </span>
    </div>
  );
};
