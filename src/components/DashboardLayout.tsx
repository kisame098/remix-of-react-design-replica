import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';

export const DashboardLayout = () => {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <DashboardSidebar />
      <main className="flex-1 h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
