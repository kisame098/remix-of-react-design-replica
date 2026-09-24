import { useStages } from '@/contexts/StagesContext';
import { Hotel, Clock } from 'lucide-react';
import { GrillePromotions } from '@/components/formation/GrillePromotions';
import { statutStage } from '@/lib/formationPro';

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Page 1 du module Stages : choisir une promotion (même grille qu'Évaluations et Examens). */
const Stages = () => {
  const { loading, stages } = useStages();
  const auj = aujourdhui();
  return (
    <GrillePromotions
      titre="Stages"
      chargement={loading}
      lien={p => `/formation/stages/${p.id}`}
      details={p => {
        const siens = stages.filter(s => s.promotionId === p.id);
        const enCours = siens.filter(s => statutStage(s, auj) === 'en_cours').length;
        const aNoter = siens.filter(s => statutStage(s, auj) === 'a_noter').length;
        return (
          <>
            <span className="flex items-center gap-1"><Hotel className="h-3 w-3" />{enCours} en cours</span>
            {aNoter > 0 && <span className="flex items-center gap-1 text-amber-700"><Clock className="h-3 w-3" />{aNoter} à noter</span>}
          </>
        );
      }}
    />
  );
};

export default Stages;
