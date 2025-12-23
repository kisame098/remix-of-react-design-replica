import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import StudentRegistration from "./pages/StudentRegistration";
import ClassManagement from "./pages/ClassManagement";
import StudentManagement from "./pages/StudentManagement";
import TeacherRegistration from "./pages/TeacherRegistration";
import TeacherManagement from "./pages/TeacherManagement";
import GradeManagement from "./pages/GradeManagement";
import PeriodClasses from "./pages/PeriodClasses";
import ClassSubjects from "./pages/ClassSubjects";
import SubjectGrades from "./pages/SubjectGrades";
import SubjectSettings from "./pages/SubjectSettings";
import ScheduleManagement from "./pages/ScheduleManagement";
import AttendanceManagement from "./pages/AttendanceManagement";
import NotFound from "./pages/NotFound";
import { DashboardLayout } from "./components/DashboardLayout";
import { SchoolYearProvider } from "./contexts/SchoolYearContext";
import { SchoolProvider } from "./contexts/SchoolContext";
import { ScheduleProvider } from "./contexts/ScheduleContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SchoolYearProvider>
        <SchoolProvider>
          <ScheduleProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route element={<DashboardLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/inscription" element={<StudentRegistration />} />
                  <Route path="/eleves" element={<StudentManagement />} />
                  <Route path="/inscription-prof" element={<TeacherRegistration />} />
                  <Route path="/professeurs" element={<TeacherManagement />} />
                  <Route path="/classes" element={<ClassManagement />} />
                  <Route path="/notes" element={<GradeManagement />} />
                  <Route path="/notes/:periodId" element={<PeriodClasses />} />
                  <Route path="/notes/:periodId/:classId" element={<ClassSubjects />} />
                  <Route path="/notes/:periodId/:classId/:subjectId" element={<SubjectGrades />} />
                  <Route path="/notes/:periodId/:classId/:subjectId/settings" element={<SubjectSettings />} />
                  <Route path="/emplois-du-temps" element={<ScheduleManagement />} />
                  <Route path="/presences" element={<AttendanceManagement />} />
                </Route>
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ScheduleProvider>
        </SchoolProvider>
      </SchoolYearProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
