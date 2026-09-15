import { useState, useMemo, useCallback } from 'react';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { filterAccountsToCurrentYear } from '@/lib/schoolYears';
import { createStudentAccount, createTeacherAccount } from '@/lib/accountUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Copy, Search, KeyRound,
  GraduationCap, Briefcase, CheckCircle2, AlertCircle, Loader2, Wand2, Users, RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import PersonnelManagement from '@/components/identity/PersonnelManagement';
import { PasswordCell, copyToClipboard } from '@/components/identity/PasswordCell';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AccountRow {
  id:                    string;
  role:                  'student' | 'teacher';
  email:                 string;
  displayName:           string;
  displayId:             string;
  className?:            string;
  schoolName:            string;
  isActive:              boolean;
  authUserId?:           string;
  createdAt:             string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getInitials = (name: string) =>
  name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);

// ─── Account row in table ─────────────────────────────────────────────────────
const AccountTableRow = ({ acct }: {
  acct: AccountRow;
}) => {
  const hasAuth = !!acct.authUserId;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
      {/* Identité */}
      <td className="p-3">
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
              {getInitials(acct.displayName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{acct.displayName}</p>
            <p className="text-xs text-muted-foreground">{acct.displayId}</p>
            {acct.className && (
              <Badge variant="outline" className="text-[10px] h-4 py-0 mt-0.5">{acct.className}</Badge>
            )}
          </div>
        </div>
      </td>

      {/* Email */}
      <td className="p-3">
        <div className="flex items-center gap-1.5">
          <code className="text-xs font-mono text-primary">{acct.email}</code>
          <Button
            variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0"
            onClick={() => copyToClipboard(acct.email, 'Email')}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </td>

      {/* Mot de passe */}
      <td className="p-3">
        <PasswordCell accountId={acct.id} />
      </td>

      {/* Statut */}
      <td className="p-3 text-center">
        {hasAuth ? (
          <Badge className="gap-1 text-xs bg-green-500 hover:bg-green-500">
            <CheckCircle2 className="h-3 w-3" /> Actif
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-300">
            <AlertCircle className="h-3 w-3" /> En création…
          </Badge>
        )}
      </td>
    </tr>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const IdentityManagement = () => {
  const { school } = useAuth();
  const { students, teachers } = useSchool();
  const { currentYear } = useSchoolYear();

  const [accounts,        setAccounts]        = useState<AccountRow[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [activeTab,       setActiveTab]       = useState<'student' | 'teacher' | 'staff'>('student');
  const [search,          setSearch]          = useState('');
  const [backfilling,     setBackfilling]     = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number; errors: number } | null>(null);

  // ── Chargement ───────────────────────────────────────────────────────────────
  // Un compte school_accounts est rattaché à UNE inscription, donc à UNE année.
  // Les comptes des années passées restent en base (historique, et le compte
  // reprend vie si l'élève est réinscrit), mais ils n'ont rien à faire ici :
  // on n'affiche que les élèves/profs inscrits pour l'année courante.
  const loadAccounts = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('school_accounts')
        .select('id, school_id, auth_user_id, role, student_enrollment_id, teacher_enrollment_id, email, display_name, display_id, class_name, school_name, is_active, created_at')
        .eq('school_id', school.id)
        .in('role', ['student', 'teacher'])
        .order('created_at', { ascending: false });

      if (data) {
        const currentStudentIds = new Set(students.map(s => s.id));
        const currentTeacherIds = new Set(teachers.map(t => t.id));

        // Filtre pur dans src/lib/schoolYears.ts (schoolYears.test.ts) : sans lui,
        // les élèves et profs des années passées traînent dans cet écran.
        setAccounts(filterAccountsToCurrentYear(
          data.map(r => ({ ...r, studentEnrollmentId: r.student_enrollment_id, teacherEnrollmentId: r.teacher_enrollment_id })),
          currentStudentIds, currentTeacherIds)
          .map(r => ({
            id:            r.id,
            role:          r.role as 'student' | 'teacher',
            email:         r.email,
            displayName:   r.display_name,
            displayId:     r.display_id,
            className:     r.class_name ?? undefined,
            schoolName:    r.school_name,
            isActive:      r.is_active,
            authUserId:    r.auth_user_id ?? undefined,
            createdAt:     r.created_at,
          })));
      }
    } finally {
      setLoading(false);
    }
  }, [school, students, teachers]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  // ── Backfill : créer les comptes manquants ───────────────────────────────────
  const runBackfill = useCallback(async () => {
    if (!school) return;
    setBackfilling(true);
    setBackfillProgress({ done: 0, total: 0, errors: 0 });

    try {
      // 1. Récupérer les IDs d'inscription déjà couverts par un compte
      const { data: existingAccts } = await supabase
        .from('school_accounts')
        .select('student_enrollment_id, teacher_enrollment_id')
        .eq('school_id', school.id);

      const coveredStudent = new Set<string>(
        (existingAccts ?? []).map(a => a.student_enrollment_id).filter(Boolean) as string[]
      );
      const coveredTeacher = new Set<string>(
        (existingAccts ?? []).map(a => a.teacher_enrollment_id).filter(Boolean) as string[]
      );

      // 2. Inscriptions élèves de l'ANNÉE COURANTE uniquement — sinon on
      //    ressusciterait des comptes pour des élèves des années passées qui
      //    ne sont pas réinscrits.
      const { data: studentEnrs } = await supabase
        .from('student_enrollments')
        .select('id, student_profile_id, class_id, student_profiles(first_name, last_name, unique_id), classes(name)')
        .eq('school_id', school.id)
        .eq('academic_year_label', currentYear?.id ?? '');

      // 3. Idem pour les professeurs
      const { data: teacherEnrs } = await supabase
        .from('teacher_enrollments')
        .select('id, teacher_profile_id, teacher_profiles(first_name, last_name, unique_id)')
        .eq('school_id', school.id)
        .eq('academic_year_label', currentYear?.id ?? '');

      // 4. Filtrer + dédupliquer par profile_id (un compte par personne)
      type StudentTask = { enrollmentId: string; firstName: string; lastName: string; displayId: string; className: string };
      type TeacherTask = { enrollmentId: string; firstName: string; lastName: string; displayId: string };

      const seenStudents = new Set<string>();
      const studentsToCreate: StudentTask[] = [];

      for (const enr of (studentEnrs ?? [])) {
        if (coveredStudent.has(enr.id)) continue;
        if (seenStudents.has(enr.student_profile_id)) continue;
        seenStudents.add(enr.student_profile_id);
        const p = enr.student_profiles as { first_name: string; last_name: string; unique_id: string } | null;
        const c = enr.classes as { name: string } | null;
        if (!p) continue;
        studentsToCreate.push({
          enrollmentId: enr.id,
          firstName:    p.first_name ?? '',
          lastName:     p.last_name  ?? '',
          displayId:    p.unique_id  ?? '',
          className:    c?.name      ?? '',
        });
      }

      const seenTeachers = new Set<string>();
      const teachersToCreate: TeacherTask[] = [];

      for (const enr of (teacherEnrs ?? [])) {
        if (coveredTeacher.has(enr.id)) continue;
        if (seenTeachers.has(enr.teacher_profile_id)) continue;
        seenTeachers.add(enr.teacher_profile_id);
        const p = enr.teacher_profiles as { first_name: string; last_name: string; unique_id: string } | null;
        if (!p) continue;
        teachersToCreate.push({
          enrollmentId: enr.id,
          firstName:    p.first_name ?? '',
          lastName:     p.last_name  ?? '',
          displayId:    p.unique_id  ?? '',
        });
      }

      const total = studentsToCreate.length + teachersToCreate.length;
      setBackfillProgress({ done: 0, total, errors: 0 });

      if (total === 0) {
        toast({ title: 'Aucun compte manquant', description: 'Tous les élèves et professeurs ont déjà un compte.' });
        return;
      }

      let done   = 0;
      let errors = 0;

      // 5. Créer les comptes élèves
      for (const s of studentsToCreate) {
        try {
          await createStudentAccount({
            enrollmentId: s.enrollmentId,
            firstName:    s.firstName,
            lastName:     s.lastName,
            displayId:    s.displayId,
            className:    s.className,
            schoolId:     school.id,
            schoolName:   school.name,
          });
        } catch { errors++; }
        done++;
        setBackfillProgress({ done, total, errors });
      }

      // 6. Créer les comptes profs
      for (const t of teachersToCreate) {
        try {
          await createTeacherAccount({
            enrollmentId: t.enrollmentId,
            firstName:    t.firstName,
            lastName:     t.lastName,
            displayId:    t.displayId,
            schoolId:     school.id,
            schoolName:   school.name,
          });
        } catch { errors++; }
        done++;
        setBackfillProgress({ done, total, errors });
      }

      toast({
        title:       errors === 0 ? `${done} compte(s) créé(s) !` : `Terminé avec ${errors} erreur(s)`,
        description: `${done - errors} compte(s) créé(s) avec succès sur ${total} attendu(s).`,
        variant:     errors > 0 ? 'destructive' : 'default',
      });

      // Recharger la liste
      await loadAccounts();
    } finally {
      setBackfilling(false);
      // Garder la barre de progression visible 3 s puis effacer
      setTimeout(() => setBackfillProgress(null), 3000);
    }
  }, [school, loadAccounts]);

  // ── Filtrage ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const byRole = accounts.filter(a => a.role === activeTab);
    if (!search.trim()) return byRole;
    const q = search.toLowerCase();
    return byRole.filter(a =>
      a.displayName.toLowerCase().includes(q) ||
      a.displayId.toLowerCase().includes(q)   ||
      a.email.toLowerCase().includes(q)        ||
      (a.className ?? '').toLowerCase().includes(q)
    );
  }, [accounts, activeTab, search]);

  const studentCount = accounts.filter(a => a.role === 'student').length;
  const teacherCount = accounts.filter(a => a.role === 'teacher').length;
  const activeCount  = accounts.filter(a => a.role === activeTab && !!a.authUserId).length;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2 border-b">
        <div className="p-2 bg-primary/10 rounded-lg">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Gestion des Identifiants</h1>
          <p className="text-sm text-muted-foreground">
            Comptes de connexion — élèves et professeurs
          </p>
        </div>
      </div>

      {/* Stats */}
      {activeTab !== 'staff' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Comptes élèves',  value: studentCount, icon: <GraduationCap className="h-4 w-4" />, bg: 'bg-blue-50',   text: 'text-blue-600' },
            { label: 'Comptes profs',   value: teacherCount, icon: <Briefcase className="h-4 w-4" />,     bg: 'bg-purple-50', text: 'text-purple-600' },
            { label: 'Actifs',          value: activeCount,  icon: <CheckCircle2 className="h-4 w-4" />,  bg: 'bg-green-50',  text: 'text-green-600' },
            { label: 'Total comptes',   value: accounts.length, icon: <KeyRound className="h-4 w-4" />,   bg: 'bg-muted/50',  text: 'text-foreground' },
          ].map(({ label, value, icon, bg, text }) => (
            <div key={label} className={cn('p-3 rounded-xl', bg)}>
              <div className={cn('flex items-center gap-2 mb-1', text)}>{icon}<span className="text-xs">{label}</span></div>
              <p className={cn('text-xl font-bold', text)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-0.5 bg-muted rounded-xl p-1">
          {([
            { key: 'student' as const,   label: 'Élèves',      icon: <GraduationCap className="h-4 w-4" />, count: studentCount },
            { key: 'teacher' as const,   label: 'Professeurs', icon: <Briefcase className="h-4 w-4" />,     count: teacherCount },
            { key: 'staff' as const, label: 'Personnel',   icon: <Users className="h-4 w-4" />,         count: null },
          ]).map(({ key, label, icon, count }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setSearch(''); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === key
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {icon} {label}
              {count !== null && <Badge variant="secondary" className="text-xs ml-1">{count}</Badge>}
            </button>
          ))}
        </div>

        {activeTab !== 'staff' && (
          <>
            <div className="relative flex-1 max-w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder={`Rechercher ${activeTab === 'student' ? 'un élève' : 'un prof'}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={runBackfill}
                disabled={backfilling || loading}
                className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
              >
                {backfilling
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Wand2 className="h-3.5 w-3.5" />}
                Générer les comptes manquants
              </Button>
              <Button variant="outline" size="sm" onClick={loadAccounts} disabled={loading || backfilling} className="gap-1.5">
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Actualiser
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Barre de progression du backfill */}
      {activeTab !== 'staff' && backfillProgress !== null && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-amber-800">
              {backfilling ? 'Création des comptes en cours…' : 'Création terminée'}
            </span>
            <span className="text-amber-700 font-mono">
              {backfillProgress.done} / {backfillProgress.total}
              {backfillProgress.errors > 0 && (
                <span className="text-red-600 ml-2">({backfillProgress.errors} erreur{backfillProgress.errors > 1 ? 's' : ''})</span>
              )}
            </span>
          </div>
          <div className="w-full bg-amber-200 rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                backfillProgress.errors > 0 ? 'bg-red-500' : 'bg-amber-500'
              )}
              style={{
                width: backfillProgress.total === 0
                  ? '0%'
                  : `${Math.round((backfillProgress.done / backfillProgress.total) * 100)}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      {activeTab === 'staff' ? (
        <PersonnelManagement />
      ) : (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">
                  {accounts.filter(a => a.role === activeTab).length === 0
                    ? `Aucun compte ${activeTab === 'student' ? 'élève' : 'professeur'} créé`
                    : 'Aucun résultat pour cette recherche'}
                </p>
                <p className="text-sm mt-1 opacity-70">
                  {accounts.filter(a => a.role === activeTab).length === 0
                    ? `Les comptes sont créés automatiquement lors de l'inscription.`
                    : 'Modifiez votre recherche.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-muted-foreground">
                        {activeTab === 'student' ? 'Élève' : 'Professeur'}
                      </th>
                      <th className="text-left p-3 text-xs font-semibold text-muted-foreground">
                        Email de connexion
                      </th>
                      <th className="text-left p-3 text-xs font-semibold text-muted-foreground">
                        Mot de passe
                      </th>
                      <th className="text-center p-3 text-xs font-semibold text-muted-foreground">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(acct => (
                      <AccountTableRow key={acct.id} acct={acct} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Les identifiants sont créés automatiquement à l'inscription.
          Le statut <strong>"En création…"</strong> disparaît en quelques secondes une fois le compte activé.
          Donnez l'email et le mot de passe à l'élève/prof pour qu'il puisse se connecter sur le portail.
        </span>
      </div>
    </div>
  );
};

export default IdentityManagement;
