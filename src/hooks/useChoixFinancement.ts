import { useFinancements } from '@/contexts/FinancementsContext';
import type { Student } from '@/contexts/SchoolContext';
import { toast } from '@/hooks/use-toast';

const messageDe = (e: unknown) => (e as { message?: string })?.message ?? String(e);

/**
 * Applique le choix fait dans le formulaire : active, change d'organisme ou
 * retire le financement. Un échec n'annule jamais l'inscription déjà faite :
 * il est dit, et se reprend depuis le dossier (Financements).
 */
export const useAppliquerChoixFinancement = () => {
  const fin = useFinancements();
  return async (eleve: Student, organismeId: string): Promise<void> => {
    if (!fin.actif) return;
    const actuel = fin.dossierDe(eleve.id);
    try {
      if (!organismeId && actuel) {
        await fin.desactiver(eleve);
        toast({ title: 'Financement retiré', description: `${eleve.lastName} ${eleve.firstName} redoit la totalité de ce qui n'est pas encore payé.` });
      } else if (organismeId && !actuel) {
        await fin.activer(eleve, organismeId);
        const o = fin.organisme(organismeId);
        toast({
          title: `Financement ${o?.nom ?? ''} activé`,
          description: o ? `À la caisse, il ne paie plus que ${100 - o.partFinancee} % des frais concernés ; son dossier est dans Financements.` : undefined,
        });
      } else if (organismeId && actuel && actuel.organismeId !== organismeId) {
        await fin.changerOrganisme(eleve, organismeId);
        toast({ title: 'Organisme changé', description: fin.organisme(organismeId)?.nom });
      }
    } catch (e) {
      toast({
        title: 'Financement non appliqué',
        description: `${messageDe(e)} — l'inscription, elle, est bien enregistrée. Reprenez depuis Financements.`,
        variant: 'destructive',
      });
    }
  };
};
