import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { RUBRIQUES_FORMATION_PRO } from '@/lib/modeGestion';

/**
 * Page provisoire des rubriques du mode « Formation professionnelle » : elle
 * annonce ce que la rubrique contiendra. Chaque rubrique sera remplacée par son
 * vrai écran, étape par étape.
 */
const FormationEnDeveloppement = () => {
  const { pathname } = useLocation();
  const rubrique = RUBRIQUES_FORMATION_PRO.find(r => r.url === pathname) ?? RUBRIQUES_FORMATION_PRO[0];

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">{rubrique.title}</h1>
      <p className="text-sm text-muted-foreground mt-1">Formation professionnelle</p>

      <div className="mt-8 rounded-2xl border border-dashed bg-muted/30 p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
          <Construction className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">En cours de développement</h2>
        <p className="mt-2 text-sm text-muted-foreground">{rubrique.description}</p>
        <p className="mt-4 text-xs text-muted-foreground/80">
          Cette rubrique arrivera dans une prochaine mise à jour. Vos autres outils (élèves, professeurs, emplois du temps,
          présences, paiements) fonctionnent normalement.
        </p>
      </div>
    </div>
  );
};

export default FormationEnDeveloppement;
