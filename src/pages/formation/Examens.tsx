import { useExamens } from '@/contexts/ExamensContext';
import { FileCheck2, Lock } from 'lucide-react';
import { GrillePromotions } from '@/components/formation/GrillePromotions';

/** Page 1 du module Examens : choisir une promotion (même grille qu'Évaluations). */
const Examens = () => {
  const { loading, examens } = useExamens();
  return (
    <GrillePromotions
      titre="Examens"
      chargement={loading}
      lien={p => `/formation/examens/${p.id}`}
      details={p => {
        const siens = examens.filter(e => e.promotionId === p.id);
        const verrouilles = siens.filter(e => e.verrouille).length;
        return (
          <>
            <span className="flex items-center gap-1"><FileCheck2 className="h-3 w-3" />{siens.length} examen{siens.length !== 1 ? 's' : ''}</span>
            {verrouilles > 0 && <span className="flex items-center gap-1"><Lock className="h-3 w-3" />{verrouilles} clôturé{verrouilles !== 1 ? 's' : ''}</span>}
          </>
        );
      }}
    />
  );
};

export default Examens;
