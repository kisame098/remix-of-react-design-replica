import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';
import { ChargementPage } from './ChargementPage';
import { BandeauDonneesEnregistrees } from './BandeauDonneesEnregistrees';
import { useSchool } from '@/contexts/SchoolContext';

export const DashboardLayout = () => {
  // Une seule annonce pour tout le tableau de bord : les écrans de l'école
  // lisent tous le même contexte, la date vaut donc pour l'ensemble.
  const { instantaneLe } = useSchool();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 min-h-0 overflow-y-auto relative">
        {instantaneLe && (
          <div className="px-4 pt-4 md:px-6">
            <BandeauDonneesEnregistrees enregistreLe={instantaneLe} />
          </div>
        )}

        {/* Suspense ICI et pas seulement au sommet de l'application : pendant
            le chargement d'un écran, le menu latéral reste en place au lieu
            de disparaître avec le reste de la page. */}
        <Suspense fallback={<ChargementPage />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
};
