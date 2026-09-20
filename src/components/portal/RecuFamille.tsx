import { useCallback, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Payment as PaiementPortail, AnnexSvc } from '@/pages/portal/portalHelpers';
import type { Payment, PaymentMethod } from '@/types/payment';
import type { RecuEleve } from '@/lib/recusFamille';
import { infosEcole, nomDeFichier } from '@/lib/documentsEcole';
import { construireRecu, numeroDeRecu } from '@/lib/recu';
import { DocumentDialog } from '@/components/documents/DocumentDialog';

interface Options {
  services: AnnexSvc[];
  libelleMois: (cle?: string) => string;
}

interface Ouvert { recu: RecuEleve; paiements: Payment[] }

/**
 * Le reçu d'un paiement, pour la famille : à télécharger ou imprimer.
 *
 * C'est toujours un DUPLICATA — l'original a été remis au guichet. Le PDF se
 * fabrique sur l'appareil à partir des données déjà chargées : il marche donc
 * aussi hors connexion.
 */
export function useRecuFamille({ services, libelleMois }: Options): {
  ouvrirRecu: (recu: RecuEleve, paiements: PaiementPortail[], parPaiement: Record<string, string>) => void;
  dialogueRecu: ReactNode;
} {
  const { school, schoolAccount } = useAuth();
  const [ouvert, setOuvert] = useState<Ouvert | null>(null);

  const ouvrirRecu = useCallback((recu: RecuEleve, paiements: PaiementPortail[], parPaiement: Record<string, string>) => {
    // Tous les paiements de CE reçu, pas seulement celui sur lequel on a touché.
    const siens = paiements.filter(p => parPaiement[p.id] === recu.id);
    if (siens.length === 0) return;
    setOuvert({
      recu,
      paiements: siens.map(p => ({
        id: p.id,
        studentId: schoolAccount?.studentEnrollmentId ?? '',
        studentUniqueId: schoolAccount?.displayId ?? '',
        academicYearLabel: recu.academicYearLabel,
        type: p.type as Payment['type'],
        serviceId: p.serviceId ?? undefined,
        monthKey: p.monthKey ?? undefined,
        amount: p.amount,
        method: p.method as PaymentMethod,
        reference: p.reference ?? undefined,
        note: p.note ?? undefined,
        receivedBy: p.receivedBy ?? undefined,
        paidAt: p.paidAt,
        status: p.status,
        cancelledAt: p.cancelledAt ?? undefined,
        cancelledBy: p.cancelledBy ?? undefined,
        receiptId: recu.id,
      })),
    });
  }, [schoolAccount]);

  const dialogueRecu = ouvert && (() => {
    const numero = numeroDeRecu(ouvert.recu.academicYearLabel, ouvert.recu.number);
    return (
      <DocumentDialog
        ouvert
        onFermer={() => setOuvert(null)}
        titre={`Reçu ${numero}`}
        description="Copie de votre reçu de paiement."
        nomFichier={`Recu_${numero}_${nomDeFichier(schoolAccount?.displayName ?? 'eleve')}`}
        generer={async () => {
          const { genererRecuPdf } = await import('@/lib/recuPdf');
          return genererRecuPdf(construireRecu({
            ecole: infosEcole(school),
            recu: { id: ouvert.recu.id, academicYearLabel: ouvert.recu.academicYearLabel, number: ouvert.recu.number,
                    studentId: schoolAccount?.studentEnrollmentId ?? '', createdAt: ouvert.recu.createdAt },
            paiements: ouvert.paiements,
            eleve: {
              nom: schoolAccount?.displayName ?? '',
              matricule: schoolAccount?.displayId ?? '',
              classe: schoolAccount?.className,
            },
            services,
            libelleMois,
            duplicata: true,
          }));
        }}
      />
    );
  })();

  return { ouvrirRecu, dialogueRecu: dialogueRecu || null };
}
