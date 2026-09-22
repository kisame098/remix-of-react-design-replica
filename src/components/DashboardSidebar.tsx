import { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/permissions';
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
  LayoutGrid,
  BookOpen,
  UsersRound,
  PenLine,
  FileCheck2,
  Hotel,
  FileText,
} from 'lucide-react';
import { menuPourMode, modeDeLEcole, urlMenuActive, type IconeMenu } from '@/lib/modeGestion';
import { SchoolYearSelector } from './SchoolYearSelector';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const ICONES: Record<IconeMenu, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard, inscription: UserPlus, eleves: Users, profs: Briefcase, classes: School,
  notes: ClipboardList, cursus: Shuffle, emploi: Calendar, presences: UserCheck, paiements: Wallet,
  salaires: Banknote, identifiants: KeyRound,
  apercu: LayoutGrid, formations: BookOpen, promotions: UsersRound, evaluations: PenLine,
  examens: FileCheck2, stages: Hotel, documents: FileText,
};

export const DashboardSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, school, signOut, accountRole, staffPermissions } = useAuth();

  const mode = modeDeLEcole(school);
  const visibleMenuItems = useMemo(
    () => menuPourMode(mode).filter(item => !item.permission || hasPermission(accountRole, staffPermissions, item.permission)),
    [mode, accountRole, staffPermissions]
  );
  // Une seule rubrique s'allume à la fois — la plus précise, même quand deux
  // URLs se chevauchent par préfixe (ex : /formation et /formation/formations).
  const urlActive = useMemo(() => urlMenuActive(visibleMenuItems, location.pathname), [visibleMenuItems, location.pathname]);

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
            const isActive = item.url === urlActive;
            const Icone = ICONES[item.icon];
            const premierDuGroupe = item.groupe === 'formation_pro'
              && visibleMenuItems.find(i => i.groupe === 'formation_pro')?.url === item.url;

            return (
              <li key={item.title}>
                {premierDuGroupe && !collapsed && (
                  <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Formation professionnelle
                  </p>
                )}
                {premierDuGroupe && collapsed && <div className="my-2 h-px bg-border" />}
                {(
                  <NavLink
                    to={item.url}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icone className="w-5 h-5 flex-shrink-0" />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="font-medium whitespace-nowrap"
                        >
                          {item.title}
                          {item.bientot && (
                            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-amber-100 text-amber-700'
                            }`}>
                              En dév.
                            </span>
                          )}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </NavLink>
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
