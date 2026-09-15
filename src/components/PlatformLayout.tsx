import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { School, CreditCard, LogOut, ShieldCheck, BarChart3 } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/platform', label: 'Statistiques', icon: BarChart3, end: true },
  { to: '/platform/ecoles', label: 'Écoles', icon: School, end: false },
  { to: '/platform/paiements', label: 'Paiements', icon: CreditCard, end: false },
];

/**
 * Layout minimal pour le compte "chef du système" — sidebar à 2 entrées,
 * volontairement plus simple que DashboardSidebar (pas de contexte école ici).
 */
export const PlatformLayout = () => {
  const { signOut, profile } = useAuth();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-60 border-r flex-shrink-0 flex flex-col bg-muted/10">
        <div className="p-4 border-b flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">SenClass</p>
            <p className="text-xs text-muted-foreground">Administration plateforme</p>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-foreground hover:bg-muted'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t space-y-2">
          {profile?.email && <p className="text-xs text-muted-foreground truncate px-1">{profile.email}</p>}
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" />
            Déconnexion
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
