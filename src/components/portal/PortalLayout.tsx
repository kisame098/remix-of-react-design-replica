import { useEffect, Suspense } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { ChargementPage } from '@/components/ChargementPage';
import { useAuth } from '@/contexts/AuthContext';
import { initials } from '@/pages/portal/portalHelpers';
import { upsertLinkedAccount } from '@/lib/linkedAccounts';
import {
  LayoutDashboard, BookOpen, CalendarDays, CreditCard, ClipboardList,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// DEUX MISES EN PAGE, PAS UNE MISE EN PAGE ÉTIRÉE.
//
// 90 % des élèves et des professeurs sont sur téléphone : le portail est donc
// conçu pour le mobile d'abord — en-tête collant, navigation en bas du pouce.
// Mais ceux qui ouvrent sur un ordinateur ou une tablette ne doivent pas
// recevoir une colonne de téléphone perdue au milieu d'un écran large.
//
// À partir de 768 px (tablette et au-delà), la structure CHANGE : la barre du
// bas disparaît au profit d'une colonne latérale, l'en-tête mobile s'efface,
// et le contenu respire sur toute la largeur.
//
// Le basculement se fait par POINTS DE RUPTURE CSS (préfixe `md:`), pas par
// détection d'appareil en JavaScript : rien à deviner, rien qui clignote au
// chargement, et le passage est immédiat quand on redimensionne une fenêtre.
// En dessous de 768 px, aucune de ces classes ne s'applique — l'expérience
// mobile est strictement celle d'avant.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Éléments de navigation (partagés par les deux mises en page) ────────────

const NAV = [
  { to: '/portail',            label: 'Accueil',   Icon: LayoutDashboard, end: true,  studentOnly: false },
  { to: '/portail/notes',      label: 'Notes',     Icon: BookOpen,        end: false, studentOnly: false },
  { to: '/portail/emploi',     label: 'Emploi',    Icon: CalendarDays,    end: false, studentOnly: false },
  { to: '/portail/paiements',  label: 'Paiements', Icon: CreditCard,      end: false, studentOnly: true  },
  { to: '/portail/presences',  label: 'Présences', Icon: ClipboardList,   end: false, studentOnly: false },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function PortalLayout() {
  const { session, schoolAccount, accountRole } = useAuth();

  const avatarInitials = initials(schoolAccount?.displayName ?? '');
  const schoolName     = schoolAccount?.schoolName ?? 'SenClass';
  const className      = schoolAccount?.className;
  const photoUrl       = schoolAccount?.photoUrl;
  const navItems       = NAV.filter(item => !item.studentOnly || accountRole === 'student');

  // Garde ce compte à jour dans la liste des "comptes liés" de cet appareil
  // (voir src/lib/linkedAccounts.ts) — permet au sélecteur de compte du profil
  // de toujours proposer le compte courant, avec des tokens à jour.
  useEffect(() => {
    if (!session || !schoolAccount || (schoolAccount.role !== 'student' && schoolAccount.role !== 'teacher')) return;
    upsertLinkedAccount({
      userId:       schoolAccount.authUserId,
      email:        schoolAccount.email,
      displayName:  schoolAccount.displayName,
      displayId:    schoolAccount.displayId,
      role:         schoolAccount.role,
      schoolName:   schoolAccount.schoolName,
      photoUrl:     schoolAccount.photoUrl,
      accessToken:  session.access_token,
      refreshToken: session.refresh_token,
    });
  }, [session, schoolAccount]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 md:flex-row">

      {/* ══════════════════════════════════════════════════════════════════
          ORDINATEUR ET TABLETTE — colonne latérale fixe (≥ 768 px)
          Invisible sur téléphone : c'est la barre du bas qui y règne.
      ══════════════════════════════════════════════════════════════════ */}
      <aside className="hidden md:flex md:flex-col md:w-64 lg:w-72 md:shrink-0
                        md:sticky md:top-0 md:h-screen
                        bg-white border-r border-gray-100">

        {/* Identité de l'école */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-white font-black">T</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight truncate">{schoolName}</p>
            {className && <p className="text-xs text-gray-400 leading-tight truncate">{className}</p>}
          </div>
        </div>

        {/* Navigation verticale — libellés entiers, pas d'abréviation :
            la place ne manque pas ici. */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Compte, en pied de colonne — la place habituelle sur un ordinateur */}
        <NavLink
          to="/portail/profil"
          className="flex items-center gap-3 px-4 py-3.5 border-t border-gray-100
                     hover:bg-gray-50 transition-colors"
        >
          <span className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-blue-100 shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={schoolAccount?.displayName ?? ''} className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-[13px]">{avatarInitials}</span>
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900 truncate">
              {schoolAccount?.displayName ?? 'Mon profil'}
            </span>
            <span className="block text-xs text-gray-400 truncate">{schoolAccount?.displayId}</span>
          </span>
        </NavLink>
      </aside>

      {/* Colonne principale : c'est elle qui défile sur ordinateur */}
      <div className="flex flex-col flex-1 min-w-0">

      {/* ── En-tête collant — TÉLÉPHONE UNIQUEMENT ─────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">

          {/* Left: logo + school info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white font-black text-sm">T</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-sm leading-tight truncate max-w-[160px]">
                {schoolName}
              </p>
              {className && (
                <p className="text-[11px] text-gray-400 leading-tight">{className}</p>
              )}
            </div>
          </div>

          {/* Right: avatar → profile page */}
          <NavLink
            to="/portail/profil"
            className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden ring-2 ring-blue-100
                       hover:ring-blue-300 transition-all shadow-sm"
            aria-label="Mon profil"
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={schoolAccount?.displayName ?? ''}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-[13px]">{avatarInitials}</span>
              </div>
            )}
          </NavLink>
        </div>
      </header>

      {/* ── Contenu ───────────────────────────────────────────────────── */}
      {/* Téléphone : colonne étroite + marge basse pour la barre de navigation.
          Ordinateur : la marge basse disparaît (plus de barre) et le contenu
          s'élargit au lieu de rester en colonne de téléphone. */}
      <main className="flex-1 w-full mx-auto pb-20 max-w-lg
                       md:pb-10 md:max-w-3xl lg:max-w-5xl md:px-2 lg:px-6">
        {/* La barre de navigation reste en place pendant le chargement d'un écran. */}
        <Suspense fallback={<ChargementPage />}>
          <Outlet />
        </Suspense>
      </main>

      </div>

      {/* ── Barre de navigation basse — TÉLÉPHONE UNIQUEMENT ───────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100
                      shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-lg mx-auto flex">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex-1 flex flex-col items-center gap-0.5 py-3 text-[11px] font-semibold
                 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator line */}
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5
                                     bg-blue-600 rounded-full" />
                  )}
                  <Icon className="h-[22px] w-[22px]" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
