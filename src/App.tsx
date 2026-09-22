import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// Chargées d'emblée : la page d'accueil et la connexion sont les deux portes
// d'entrée — les faire attendre un second téléchargement ralentirait
// précisément le premier écran que voit un visiteur.
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PortalLayout   from "./components/portal/PortalLayout";
import PortalSchoolNotice   from "./components/portal/PortalSchoolNotice";
import { DashboardLayout } from "./components/DashboardLayout";
import { PlatformLayout } from "./components/PlatformLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import PlatformAdminRoute from "./components/PlatformAdminRoute";
import RequirePermission from "./components/RequirePermission";
import { ChargementPage } from "./components/ChargementPage";
import { BandeauHorsConnexion } from "./components/BandeauHorsConnexion";
import { MiseAJourApplication } from "./components/MiseAJourApplication";
import { Referencement } from "./components/Referencement";
import ModeRoute from "./components/ModeRoute";
import { FormationProProvider } from "./contexts/FormationProContext";
import { SuiviActivite } from "@/components/SuiviActivite";
import { SchoolYearProvider } from "./contexts/SchoolYearContext";
import { SchoolProvider } from "./contexts/SchoolContext";
import { ScheduleProvider } from "./contexts/ScheduleContext";
import { AttendanceProvider } from "./contexts/AttendanceContext";
import { PaymentProvider } from "./contexts/PaymentContext";
import { PayrollProvider } from "./contexts/PayrollContext";
import { AuthProvider } from "./contexts/AuthContext";

// ── Écrans chargés à la demande ─────────────────────────────────────────────
// Tout tenait dans un seul fichier de 2,5 Mo : un élève qui ouvrait son
// portail en 3G téléchargeait aussi la gestion des salaires et le générateur
// de bulletins. Chaque écran est désormais un morceau séparé, récupéré quand
// on y va — puis gardé sur l'appareil par l'application installée.
const ResetPassword         = lazy(() => import("./pages/ResetPassword"));
const Dashboard             = lazy(() => import("./pages/Dashboard"));
const StudentRegistration   = lazy(() => import("./pages/StudentRegistration"));
const ClassManagement       = lazy(() => import("./pages/ClassManagement"));
const StudentManagement     = lazy(() => import("./pages/StudentManagement"));
const TeacherRegistration   = lazy(() => import("./pages/TeacherRegistration"));
const TeacherManagement     = lazy(() => import("./pages/TeacherManagement"));
const GradeManagement       = lazy(() => import("./pages/GradeManagement"));
const PeriodClasses         = lazy(() => import("./pages/PeriodClasses"));
const ClassSubjects         = lazy(() => import("./pages/ClassSubjects"));
const SubjectGrades         = lazy(() => import("./pages/SubjectGrades"));
const ElementaryLineGrades  = lazy(() => import("./pages/ElementaryLineGrades"));
const SubjectSettings       = lazy(() => import("./pages/SubjectSettings"));
const Filieres              = lazy(() => import("./pages/Filieres"));
const FiliereEditor         = lazy(() => import("./pages/FiliereEditor"));
const ClassFiliereChoices   = lazy(() => import("./pages/ClassFiliereChoices"));
const ScheduleManagement    = lazy(() => import("./pages/ScheduleManagement"));
const AttendanceManagement  = lazy(() => import("./pages/AttendanceManagement"));
const PaymentManagement     = lazy(() => import("./pages/PaymentManagement"));
const Salaires              = lazy(() => import("./pages/Salaires"));
const Caisse                = lazy(() => import("./pages/Caisse"));
const IdentityManagement    = lazy(() => import("./pages/IdentityManagement"));
const SettingsPage          = lazy(() => import("./pages/Settings"));
const AbonnementPage        = lazy(() => import("./pages/Abonnement"));
const SubscriptionRequired  = lazy(() => import("./pages/SubscriptionRequired"));
const FormationEnDeveloppement = lazy(() => import("./pages/formation/FormationEnDeveloppement"));
const Formations = lazy(() => import("./pages/formation/Formations"));
const Promotions = lazy(() => import("./pages/formation/Promotions"));
const Evaluations = lazy(() => import("./pages/formation/Evaluations"));
const FormationDetail = lazy(() => import("./pages/formation/FormationDetail"));
const NiveauProgramme = lazy(() => import("./pages/formation/NiveauProgramme"));
const PlatformStats         = lazy(() => import("./pages/platform/PlatformStats"));
const PlatformSchools       = lazy(() => import("./pages/platform/PlatformSchools"));
const PlatformSchoolDetail  = lazy(() => import("./pages/platform/PlatformSchoolDetail"));
const PlatformPaymentClaims = lazy(() => import("./pages/platform/PlatformPaymentClaims"));
const NotFound              = lazy(() => import("./pages/NotFound"));
const PortalAccueil         = lazy(() => import("./pages/portal/PortalAccueil"));
const PortalNotes           = lazy(() => import("./pages/portal/PortalNotes"));
const PortalEmploi          = lazy(() => import("./pages/portal/PortalEmploi"));
const PortalPaiements       = lazy(() => import("./pages/portal/PortalPaiements"));
const PortalPresences       = lazy(() => import("./pages/portal/PortalPresences"));
const PortalProfil          = lazy(() => import("./pages/portal/PortalProfil"));
const PortalSubjectDetail   = lazy(() => import("./pages/portal/PortalSubjectDetail"));
const PortalFiliereChoice   = lazy(() => import("./pages/portal/PortalFiliereChoice"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
      <SchoolYearProvider>
        <SchoolProvider>
          <ScheduleProvider>
            <AttendanceProvider>
            <PaymentProvider>
            <PayrollProvider>
            <FormationProProvider>
            <Toaster />
            <Sonner />
            <BandeauHorsConnexion />
            <MiseAJourApplication />
            <BrowserRouter>
              <Referencement />
              <SuiviActivite />
              {/* Filet du sommet, pour les écrans sans mise en page propre.
                  Les mises en page (tableau de bord, portail) ont le leur, qui
                  garde le menu en place pendant le chargement. */}
              <Suspense fallback={<ChargementPage pleinEcran />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* ── Portail élève / professeur ─────────────────────── */}
                <Route element={<ProtectedRoute />}>
                  {/* PortalSchoolNotice enveloppe TOUT le portail : le bandeau
                      « ton école n'a pas payé » doit rester visible sur chaque
                      écran, y compris ceux qu'on ajoutera plus tard. */}
                  <Route element={<PortalSchoolNotice />}>
                    {/* Pages avec layout (header + bottom nav) */}
                    <Route element={<PortalLayout />}>
                      <Route path="/portail"            element={<PortalAccueil />}  />
                      <Route path="/portail/notes"      element={<PortalNotes />}    />
                      <Route path="/portail/emploi"     element={<PortalEmploi />}   />
                      <Route path="/portail/paiements"  element={<PortalPaiements />}/>
                      <Route path="/portail/presences"  element={<PortalPresences />}/>
                    </Route>
                    {/* Pages standalone (header propre, pas de bottom nav) */}
                    <Route path="/portail/profil"             element={<PortalProfil />} />
                    <Route path="/portail/notes/:subjectId"   element={<PortalSubjectDetail />} />
                    <Route path="/portail/filiere"            element={<PortalFiliereChoice />} />
                  </Route>
                </Route>

                {/* ── Caisse mobile (staff "cashier" uniquement) ─────── */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/caisse" element={<Caisse />} />
                </Route>

                {/* ── Abonnement suspendu/annulé — accessible même bloqué ── */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/abonnement-requis" element={<SubscriptionRequired />} />
                </Route>

                {/* ── Compte "chef du système" — pilote toutes les écoles ── */}
                <Route element={<PlatformAdminRoute />}>
                  <Route element={<PlatformLayout />}>
                    <Route path="/platform" element={<PlatformStats />} />
                    <Route path="/platform/ecoles" element={<PlatformSchools />} />
                    <Route path="/platform/ecoles/:schoolId" element={<PlatformSchoolDetail />} />
                    <Route path="/platform/paiements" element={<PlatformPaymentClaims />} />
                  </Route>
                </Route>

                {/* ── Dashboard admin complet ── */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/inscription" element={<RequirePermission permission="students"><StudentRegistration /></RequirePermission>} />
                    <Route path="/eleves" element={<RequirePermission permission="students"><StudentManagement /></RequirePermission>} />
                    <Route path="/inscription-prof" element={<RequirePermission permission="teachers"><TeacherRegistration /></RequirePermission>} />
                    <Route path="/professeurs" element={<RequirePermission permission="teachers"><TeacherManagement /></RequirePermission>} />
                    <Route path="/classes" element={<ModeRoute mode="classique"><RequirePermission permission="classes"><ClassManagement /></RequirePermission></ModeRoute>} />
                    <Route path="/notes" element={<ModeRoute mode="classique"><RequirePermission permission="grades"><GradeManagement /></RequirePermission></ModeRoute>} />
                    <Route path="/notes/:periodId" element={<ModeRoute mode="classique"><RequirePermission permission="grades"><PeriodClasses /></RequirePermission></ModeRoute>} />
                    <Route path="/notes/:periodId/:classId" element={<ModeRoute mode="classique"><RequirePermission permission="grades"><ClassSubjects /></RequirePermission></ModeRoute>} />
                    <Route path="/notes/:periodId/:classId/filiere-choices" element={<ModeRoute mode="classique"><RequirePermission permission="grades"><ClassFiliereChoices /></RequirePermission></ModeRoute>} />
                    <Route path="/notes/:periodId/:classId/elementaire/:lineId" element={<ModeRoute mode="classique"><RequirePermission permission="grades"><ElementaryLineGrades /></RequirePermission></ModeRoute>} />
                    <Route path="/notes/:periodId/:classId/:subjectId" element={<ModeRoute mode="classique"><RequirePermission permission="grades"><SubjectGrades /></RequirePermission></ModeRoute>} />
                    <Route path="/notes/:periodId/:classId/:subjectId/settings" element={<ModeRoute mode="classique"><RequirePermission permission="grades"><SubjectSettings /></RequirePermission></ModeRoute>} />
                    <Route path="/filieres" element={<ModeRoute mode="classique"><RequirePermission permission="grades"><Filieres /></RequirePermission></ModeRoute>} />
                    <Route path="/filieres/:filiereId" element={<ModeRoute mode="classique"><RequirePermission permission="grades"><FiliereEditor /></RequirePermission></ModeRoute>} />
                    <Route path="/formation/formations" element={
                      <ModeRoute mode="formation_pro"><RequirePermission permission="grades"><Formations /></RequirePermission></ModeRoute>
                    } />
                    <Route path="/formation/formations/:formationId" element={
                      <ModeRoute mode="formation_pro"><RequirePermission permission="grades"><FormationDetail /></RequirePermission></ModeRoute>
                    } />
                    <Route path="/formation/formations/:formationId/niveaux/:niveauId" element={
                      <ModeRoute mode="formation_pro"><RequirePermission permission="grades"><NiveauProgramme /></RequirePermission></ModeRoute>
                    } />
                    <Route path="/formation/promotions" element={
                      <ModeRoute mode="formation_pro"><RequirePermission permission="grades"><Promotions /></RequirePermission></ModeRoute>
                    } />
                    <Route path="/formation/evaluations" element={
                      <ModeRoute mode="formation_pro"><RequirePermission permission="grades"><Evaluations /></RequirePermission></ModeRoute>
                    } />
                    {["/formation",
                      "/formation/examens", "/formation/stages", "/formation/documents"].map(chemin => (
                      <Route key={chemin} path={chemin} element={
                        <ModeRoute mode="formation_pro"><RequirePermission permission="grades"><FormationEnDeveloppement /></RequirePermission></ModeRoute>
                      } />
                    ))}
                    <Route path="/emplois-du-temps" element={<RequirePermission permission="schedule"><ScheduleManagement /></RequirePermission>} />
                    <Route path="/presences" element={<RequirePermission permission="attendance"><AttendanceManagement /></RequirePermission>} />
                    <Route path="/paiements" element={<RequirePermission permission="payments"><PaymentManagement /></RequirePermission>} />
                    <Route path="/salaires" element={<RequirePermission permission="payroll"><Salaires /></RequirePermission>} />
                    <Route path="/identifiants" element={<RequirePermission permission="credentials"><IdentityManagement /></RequirePermission>} />
                    <Route path="/parametres" element={<RequirePermission adminOnly><SettingsPage /></RequirePermission>} />
                    <Route path="/abonnement" element={<RequirePermission adminOnly><AbonnementPage /></RequirePermission>} />
                  </Route>
                </Route>

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
            </FormationProProvider>
            </PayrollProvider>
            </PaymentProvider>
            </AttendanceProvider>
          </ScheduleProvider>
        </SchoolProvider>
      </SchoolYearProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
