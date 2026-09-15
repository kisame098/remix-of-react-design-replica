import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';
import { ChargementPage } from './ChargementPage';

export const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 min-h-0 overflow-y-auto relative">
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
