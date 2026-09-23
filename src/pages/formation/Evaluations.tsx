import { useFormationPro } from '@/contexts/FormationProContext';
import { ClipboardList, CalendarRange } from 'lucide-react';
import { GrillePromotions } from '@/components/formation/GrillePromotions';

/**
 * Page 1 du module Évaluations : choisir une promotion — équivalent de
 * « choisir une classe » dans Gestion des Notes (src/pages/GradeManagement.tsx),
 * sauf que chez nous les périodes appartiennent à la promotion (pas à
 * l'école) : la promotion doit donc être choisie AVANT la période.
 */
const Evaluations = () => {
  const { evaluations, periodes } = useFormationPro();
  return (
    <GrillePromotions
      titre="Évaluations"
      lien={p => `/formation/evaluations/${p.id}`}
      details={p => {
        const nbEval = evaluations.filter(e => e.promotionId === p.id).length;
        const nbPeriodes = periodes.filter(x => x.promotionId === p.id).length;
        return (
          <>
            <span className="flex items-center gap-1"><CalendarRange className="h-3 w-3" />{nbPeriodes} période{nbPeriodes !== 1 ? 's' : ''}</span>
            <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" />{nbEval} évaluation{nbEval !== 1 ? 's' : ''}</span>
          </>
        );
      }}
    />
  );
};

export default Evaluations;
