import { useCallback, useState } from 'react';
import { useSchool, type Student } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { useElementsAPayer } from '@/hooks/useElementsAPayer';
import { DocumentDialog } from '@/components/documents/DocumentDialog';
import { infosEcole, nomDeFichier } from '@/lib/documentsEcole';
import { numeroDeRecu } from '@/lib/recu';
import { aujourdhuiDakar } from '@/lib/facture';
import { bilanFiche, lignesDeFiche, type BilanFiche } from '@/lib/fichePaiement';
import type { FichePaiementDoc } from '@/lib/fichePaiementPdf';

const nomEleve = (e: Student) => `${e.lastName.toUpperCase()} ${e.firstName}`;

/**
 * Fiches de paiement (relevé de l'année) : construction et fenêtre d'impression.
 * Partagé entre Facturation (en lot : classe, école) et le Suivi (un élève).
 */
export function useFichesPaiement() {
  const { classes } = useSchool();
  const { payments, receipts } = usePayment();
  const { currentYear } = useSchoolYear();
  const { school } = useAuth();
  const { mois, elementsDe } = useElementsAPayer();
  const [ouvert, setOuvert] = useState<{ fiches: FichePaiementDoc[]; titre: string; nomFichier: string } | null>(null);

  const ficheDe = useCallback((eleve: Student): FichePaiementDoc & { bilan: BilanFiche } => {
    const numero = (receiptId: string) => {
      const r = receipts.find(x => x.id === receiptId);
      return r ? numeroDeRecu(r.academicYearLabel, r.number) : undefined;
    };
    const lignes = lignesDeFiche(
      elementsDe(eleve), payments.filter(p => p.studentId === eleve.id), numero, mois, aujourdhuiDakar(),
    );
    return {
      anneeScolaire: currentYear?.id ?? '',
      situationAu: new Date().toISOString(),
      eleve: { nom: nomEleve(eleve), matricule: eleve.studentId, classe: eleve.classId ? classes.find(c => c.id === eleve.classId)?.name : undefined },
      tuteur: { nom: eleve.tutor1?.fullName, telephone: eleve.tutor1?.phone },
      lignes,
      bilan: bilanFiche(lignes),
    };
  }, [receipts, elementsDe, payments, mois, currentYear, classes]);

  const montrerFiches = useCallback((fiches: FichePaiementDoc[], titre: string, nomFichierBrut: string) => {
    if (fiches.length > 0) setOuvert({ fiches, titre, nomFichier: nomDeFichier(nomFichierBrut) });
  }, []);

  const dialogueFiches = ouvert && (
    <DocumentDialog
      ouvert
      onFermer={() => setOuvert(null)}
      titre={ouvert.titre}
      description={`Situation au ${new Date().toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })} : les paiements enregistrés après cette date n'y figurent pas.`}
      nomFichier={ouvert.nomFichier}
      typeDocument="fiche_paiement"
      generer={async ({ economique }) => {
        const { genererFichesPaiementPdf } = await import('@/lib/fichePaiementPdf');
        return genererFichesPaiementPdf(infosEcole(school), ouvert.fiches, { economique });
      }}
    />
  );

  return { ficheDe, montrerFiches, dialogueFiches: dialogueFiches || null };
}
