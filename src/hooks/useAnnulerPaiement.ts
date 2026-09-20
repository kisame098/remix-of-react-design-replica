import { useCallback, useEffect, useState } from 'react';
import { usePayment } from '@/contexts/PaymentContext';
import { toast } from '@/hooks/use-toast';
import { messageErreurAnnulation } from '@/lib/historiquePaiements';
import type { Payment } from '@/types/payment';
import type { OptionsRecu } from '@/hooks/useRecus';

/**
 * Annuler un paiement, partout de la même façon (tableau du directeur et
 * Caisse mobile) :
 *   1. l'annulation passe par le RPC audité — le paiement n'est jamais supprimé ;
 *   2. un message dit ce qui s'est passé, succès comme échec ;
 *   3. si un reçu avait été émis, on ouvre ce reçu marqué ANNULÉ (même numéro,
 *      qui/quand) : c'est la pièce à remettre à la famille.
 * Le reçu s'ouvre une fois le paiement REVU à l'état « annulé » par l'écran,
 * sinon il s'imprimerait encore « acquitté ».
 */
export function useAnnulerPaiement(
  montrerRecu: (paiements: Payment[], options?: OptionsRecu) => Promise<boolean>,
) {
  const { payments, cancelPayment } = usePayment();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [aImprimer, setAImprimer] = useState<string | null>(null);

  useEffect(() => {
    if (!aImprimer) return;
    const p = payments.find(x => x.id === aImprimer);
    if (!p || p.status !== 'cancelled') return;
    setAImprimer(null);
    void montrerRecu([p], { duplicata: true, annulation: true });
  }, [aImprimer, payments, montrerRecu]);

  const annuler = useCallback(async (p: Payment): Promise<boolean> => {
    setEnCours(p.id);
    try {
      await cancelPayment(p.id);
      toast({
        title: 'Paiement annulé',
        description: p.receiptId
          ? 'Il reste dans l\'historique, marqué « Annulé ». Le reçu annulé s\'ouvre pour être remis à la famille.'
          : 'Il reste dans l\'historique, marqué « Annulé ». Aucun reçu n\'avait été émis pour ce paiement.',
      });
      if (p.receiptId) setAImprimer(p.id);
      return true;
    } catch (e) {
      toast({ title: 'Paiement non annulé', description: messageErreurAnnulation(e), variant: 'destructive' });
      return false;
    } finally {
      setEnCours(null);
    }
  }, [cancelPayment]);

  return { annuler, enCours };
}
