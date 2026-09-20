import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import {
  DEFAULT_TUITION_BILLING_TIMING, getAcademicMonths, type Payment, type Receipt,
  type TuitionBillingTiming,
} from '@/types/payment';
import { infosEcole, nomDeFichier } from '@/lib/documentsEcole';
import { construireRecu, numeroDeRecu } from '@/lib/recu';
import { DocumentDialog } from '@/components/documents/DocumentDialog';
import { toast } from '@/hooks/use-toast';

export interface OptionsRecu {
  /** `true` pour une réédition d'un reçu déjà remis (historique). */
  duplicata?: boolean;
  /** Formule du message si le numéro n'a pas pu être attribué. */
  apresEncaissement?: boolean;
}

interface RecuOuvert { paiements: Payment[]; recu: Receipt; duplicata: boolean }

/**
 * Émettre et montrer le reçu d'un encaissement.
 *
 *   const { montrerRecu, dialogueRecu } = useRecus();
 *   …
 *   await montrerRecu(paiementsEnregistres, { apresEncaissement: true });
 *   …
 *   return <>{…}{dialogueRecu}</>;
 *
 * `montrerRecu` ne lève JAMAIS : le paiement est déjà enregistré quand on
 * l'appelle, et un incident sur le reçu ne doit pas ressembler à un échec de
 * l'encaissement. Il avertit par un message et laisse le paiement intact.
 */
export function useRecus(): { montrerRecu: (paiements: Payment[], options?: OptionsRecu) => Promise<boolean>; dialogueRecu: ReactNode } {
  const { school } = useAuth();
  const { students, classes } = useSchool();
  const { payments, annexServices, emettreRecu, getReceiptOf } = usePayment();
  const { currentYear } = useSchoolYear();
  const [ouvert, setOuvert] = useState<RecuOuvert | null>(null);

  const billingTiming = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
  const mois = useMemo(
    () => currentYear ? getAcademicMonths(currentYear.startDate, currentYear.endDate, billingTiming) : [],
    [currentYear, billingTiming],
  );
  const libelleMois = useCallback(
    (cle?: string) => (cle && mois.find(m => m.key === cle)?.label) || cle || '',
    [mois],
  );

  const montrerRecu = useCallback(async (fournis: Payment[], options: OptionsRecu = {}): Promise<boolean> => {
    if (fournis.length === 0) return false;

    // Les objets reçus peuvent dater d'avant l'attribution du reçu : on relit l'état.
    const ids = new Set(fournis.map(p => p.id));
    const frais = fournis.map(p => payments.find(x => x.id === p.id) ?? p);

    try {
      let recu: Receipt | undefined;
      const dejaRattaches = frais.filter(p => p.receiptId);
      if (dejaRattaches.length === frais.length) {
        recu = getReceiptOf(frais[0]);
      }
      if (!recu) {
        if (frais.some(p => p.status === 'cancelled' && !p.receiptId)) {
          toast({ title: 'Paiement annulé', description: 'Aucun reçu n\'a été émis pour ce paiement, il n\'y en a donc pas à imprimer.' });
          return false;
        }
        recu = await emettreRecu(frais.map(p => p.id));
      }

      // Tous les paiements de CE reçu, même ceux qu'on n'a pas passés (on clique
      // parfois sur une seule ligne d'un encaissement qui en comptait quatre).
      const recuId = recu.id;
      const autres = payments.filter(p => p.receiptId === recuId && !ids.has(p.id));
      const tous = [...frais.map(p => ({ ...p, receiptId: recuId })), ...autres];

      setOuvert({ paiements: tous, recu, duplicata: options.duplicata ?? false });
      return true;
    } catch {
      toast({
        title: options.apresEncaissement ? 'Paiement enregistré, reçu non émis' : 'Reçu indisponible',
        description: options.apresEncaissement
          ? 'Le paiement est bien enregistré. Le reçu n\'a pas pu être généré : rouvrez-le depuis l\'historique.'
          : 'Le reçu n\'a pas pu être préparé. Vérifiez la connexion et réessayez.',
        variant: options.apresEncaissement ? undefined : 'destructive',
      });
      return false;
    }
  }, [payments, emettreRecu, getReceiptOf]);

  const dialogueRecu = ouvert && (() => {
    const premier = ouvert.paiements[0];
    const eleve = students.find(s => s.id === premier.studentId);
    const nomClasse = eleve?.classId ? classes.find(c => c.id === eleve.classId)?.name : undefined;
    const numero = numeroDeRecu(ouvert.recu.academicYearLabel, ouvert.recu.number);

    return (
      <DocumentDialog
        ouvert
        onFermer={() => setOuvert(null)}
        titre={`Reçu ${numero}`}
        description={ouvert.duplicata ? 'Duplicata d\'un reçu déjà remis.' : 'Le paiement est enregistré : remettez ce reçu à la famille.'}
        nomFichier={`Recu_${numero}_${nomDeFichier(eleve ? `${eleve.lastName}_${eleve.firstName}` : premier.studentUniqueId)}`}
        generer={async () => {
          const [{ genererRecuPdf }] = await Promise.all([import('@/lib/recuPdf')]);
          return genererRecuPdf(construireRecu({
            ecole: infosEcole(school),
            recu: ouvert.recu,
            paiements: ouvert.paiements,
            eleve: {
              nom: eleve ? `${eleve.lastName.toUpperCase()} ${eleve.firstName}` : premier.studentUniqueId,
              matricule: premier.studentUniqueId,
              classe: nomClasse,
            },
            services: annexServices,
            libelleMois,
            duplicata: ouvert.duplicata,
          }));
        }}
      />
    );
  })();

  return { montrerRecu, dialogueRecu: dialogueRecu || null };
}
