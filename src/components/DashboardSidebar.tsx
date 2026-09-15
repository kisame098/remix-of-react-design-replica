import { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PermissionKey } from '@/lib/permissions';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  School,
  ChevronLeft,
  ChevronRight,
  LogOut,
  GraduationCap,
  Briefcase,
  ClipboardList,
  Calendar,
  UserCheck,
  Wallet,
  KeyRound,
  Settings,
  ChevronsUpDown,
  Shuffle,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { SchoolYearSelector } from './SchoolYearSelector';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const menuItems: { title: string; url: string; icon: typeof LayoutDashboard; active: boolean; permission?: PermissionKey }[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, active: true },
  { title: 'Inscription Élèves', url: '/inscription', icon: UserPlus, active: true, permission: 'students' },
  { title: 'Gestion Élèves', url: '/eleves', icon: Users, active: true, permission: 'students' },
  { title: 'Inscription Profs', url: '/inscription-prof', icon: UserPlus, active: true, permission: 'teachers' },
  { title: 'Gestion Profs', url: '/professeurs', icon: Briefcase, active: true, permission: 'teachers' },
  { title: 'Gestion Classe', url: '/classes', icon: School, active: true, permission: 'classes' },
  { title: 'Gestion Notes', url: '/notes', icon: ClipboardList, active: true, permission: 'grades' },
  { title: 'Cursus', url: '/filieres', icon: Shuffle, active: true, permission: 'grades' },
  { title: 'Emplois du Temps', url: '/emplois-du-temps', icon: Calendar, active: true, permission: 'schedule' },
  { title: 'Gestion Présences',    url: '/presences',    icon: UserCheck, active: true, permission: 'attendance' },
  { title: 'Gestion Paiements',    url: '/paiements',    icon: Wallet,    active: true, permission: 'payments' },
  { title: 'Gestion Salaires',     url: '/salaires',     icon: Banknote,  active: true, permission: 'payroll' },
  { title: 'Gestion Identifiants', url: '/identifiants', icon: KeyRound,  active: true, permission: 'credentials' },
];

export const DashboardSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, school, signOut, accountRole, staffPermissions } = useAuth();

  const visibleMenuItems = useMemo(
    () => menuItems.filter(item => !item.permission || hasPermission(accountRole, staffPermissions, item.permission)),
    [accountRole, staffPermissions]
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Initiales pour l'avatar
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() ?? 'TS';

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="bg-card border-r border-border h-screen flex flex-col relative flex-shrink-0"
    >
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-bold text-xl text-foreground"
              >
                SenClass
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* School Year Selector */}
      <SchoolYearSelector collapsed={collapsed} />

      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto sidebar-scroll">
        <ul className="space-y-2">
          {visibleMenuItems.map((item) => {
            // Comparaison par préfixe : une sous-page garde sa rubrique allumée
            // (ex: /notes/:periodId/:classId reste sur "Gestion Notes"). Le
            // '/' final évite qu'un chemin comme /notesomething matche /notes.
            const isActive = location.pathname === item.url || location.pathname.startsWith(`${item.url}/`);
            const isDisabled = !item.active;

            return (
              <li key={item.title}>
                {item.active ? (
                  <NavLink
                    to={item.url}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="font-medium whitespace-nowrap"
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </NavLink>
                ) : (
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground/50 cursor-not-allowed`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="font-medium whitespace-nowrap"
                        >
                          {item.title}
                          <span className="text-xs ml-2">(Bientôt)</span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User menu */}
      <div className="p-4 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted transition-colors text-left">
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarImage src={profile?.avatar_url ?? undefined} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{initials}</AvatarFallback>
              </Avatar>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="overflow-hidden min-w-0 flex-1"
                  >
                    <p className="font-medium text-foreground text-sm truncate">
                      {profile?.full_name ?? profile?.email ?? 'Administrateur'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {school?.name ?? 'Mon École'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              {!collapsed && <ChevronsUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            {accountRole === 'admin' && (
              <DropdownMenuItem onClick={() => navigate('/abonnement')} className="gap-2 cursor-pointer">
                <CreditCard className="h-4 w-4" />
                Abonnement
              </DropdownMenuItem>
            )}
            {accountRole === 'admin' && (
              <DropdownMenuItem onClick={() => navigate('/parametres')} className="gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Paramètres
              </DropdownMenuItem>
            )}
            {accountRole === 'admin' && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.aside>
  );
};
