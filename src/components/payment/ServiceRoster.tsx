import { useState, useMemo } from 'react';
import { useSchool, Student } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Search, Tag, Users, UserCheck, UserX, CheckCircle2,
  RefreshCw, Calendar, Zap, Info,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  getAcademicMonths, getCurrentMonthIndex, AcademicMonth,
  SERVICE_FREQUENCY_LABELS, AnnexService,
  TuitionBillingTiming, DEFAULT_TUITION_BILLING_TIMING,
} from '@/types/payment';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
const getInitials = (f: string, l: string) => `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase();

type EnrollStatus = 'never' | 'active' | 'left';

// ─── MonthPicker inline ────────────────────────────────────────────────────────
const MonthPicker = ({
  label, value, onChange, months, minIdx, maxIdx,
}: {
  label: string; value: number; onChange: (v: number) => void; months: AcademicMonth[];
  minIdx?: number; maxIdx?: number;
}) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
    <Select value={String(value)} onValueChange={v => onChange(parseInt(v))}>
      <SelectTrigger className="h-7 w-36 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months
          .filter(m => (minIdx === undefined || m.index >= minIdx) && (maxIdx === undefined || m.index <= maxIdx))
          .map(m => (
            <SelectItem key={m.key} value={String(m.index)}>{m.label}</SelectItem>
          ))}
      </SelectContent>
    </Select>
  </div>
);

// ─── Single student row ───────────────────────────────────────────────────────
interface StudentRowProps {
  student: Student;
  serviceId: string;      // UUID string
  className?: string;
  academicMonths: AcademicMonth[];
}

const StudentRow = ({ student, serviceId, className, academicMonths }: StudentRowProps) => {
  const { enrollInService, unenrollFromService, getStudentEnrollment } = usePayment();
  const currentMonthIdx = getCurrentMonthIndex(academicMonths);
  const [expanding, setExpanding] = useState(false);
  const [startIdx, setStartIdx]   = useState(currentMonthIdx);
  const [endIdx, setEndIdx]       = useState(currentMonthIdx);

  const enrollment = getStudentEnrollment(student.id, serviceId);

  const status: EnrollStatus =
    !enrollment ? 'never' :
    enrollment.endMonthIndex === undefined ? 'active' : 'left';

  const handleToggle = () => {
    if (status === 'never' || status === 'left') {
      setStartIdx(currentMonthIdx);
      setExpanding(true);
    } else {
      setEndIdx(currentMonthIdx);
      setExpanding(true);
    }
  };

  const confirmEnroll = async () => {
    try {
      await enrollInService(student.id, serviceId, startIdx);
      setExpanding(false);
      toast({ title: 'Inscrit', description: `${student.firstName} ${student.lastName} — dès ${academicMonths[startIdx]?.label ?? ''}` });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'inscrire', variant: 'destructive' });
    }
  };

  const confirmUnenroll = async () => {
    try {
      await unenrollFromService(student.id, serviceId, endIdx);
      setExpanding(false);
      toast({ title: 'Désinscrit', description: `${student.firstName} ${student.lastName} — dernier mois : ${academicMonths[endIdx]?.label ?? ''}` });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de désinscrire', variant: 'destructive' });
    }
  };

  const cancel = () => setExpanding(false);

  return (
    <div className={`border-b last:border-0 transition-colors ${expanding ? 'bg-muted/20' : 'hover:bg-muted/20'}`}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={student.photoUrl} className="object-cover" />
          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
            {getInitials(student.firstName, student.lastName)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{student.firstName} {student.lastName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted-foreground">{student.studentId}</span>
            {className && <Badge variant="outline" className="text-xs py-0 h-3.5 px-1">{className}</Badge>}
          </div>
        </div>

        <div className="flex-shrink-0">
          {status === 'active' && enrollment && (
            <span className="text-xs text-green-700 dark:text-green-400 font-medium">
              Depuis {academicMonths[enrollment.startMonthIndex]?.label}
            </span>
          )}
          {status === 'left' && enrollment && (
            <span className="text-xs text-muted-foreground">
              Quitté en {academicMonths[enrollment.endMonthIndex!]?.label}
            </span>
          )}
          {status === 'never' && (
            <span className="text-xs text-muted-foreground">Non inscrit</span>
          )}
        </div>

        <div className="flex-shrink-0 ml-2">
          <Switch
            checked={status === 'active'}
            onCheckedChange={handleToggle}
            className="data-[state=checked]:bg-green-600"
          />
        </div>
      </div>

      {expanding && (
        <div className="flex items-center gap-3 px-4 pb-3 pt-0">
          <div className="w-8 flex-shrink-0" />
          {status !== 'active' ? (
            <>
              <MonthPicker label="Inscrire dès :" value={startIdx} onChange={setStartIdx} months={academicMonths} />
              <Button size="sm" className="h-7 text-xs gap-1" onClick={confirmEnroll}>
                <UserCheck className="h-3 w-3" /> Confirmer
              </Button>
            </>
          ) : (
            <>
              <MonthPicker
                label="Dernier mois :"
                value={endIdx}
                onChange={setEndIdx}
                months={academicMonths}
                minIdx={enrollment?.startMonthIndex}
              />
              <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={confirmUnenroll}>
                <UserX className="h-3 w-3" /> Désinscrire
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancel}>Annuler</Button>
        </div>
      )}
    </div>
  );
};

// ─── Main ServiceRoster ───────────────────────────────────────────────────────
const ServiceRoster = () => {
  const { students, classes } = useSchool();
  const {
    annexServices, serviceEnrollments,
    enrollInService, unenrollFromService, getStudentEnrollment,
  } = usePayment();
  const { currentYear } = useSchoolYear();
  const { school } = useAuth();
  const billingTiming = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
  const academicMonths = useMemo(
    () => currentYear ? getAcademicMonths(currentYear.startDate, currentYear.endDate, billingTiming) : [],
    [currentYear, billingTiming]
  );

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [search, setSearch]                       = useState('');
  const [filterClass, setFilterClass]             = useState<string>('all');
  const [filterStatus, setFilterStatus]           = useState<'all' | 'active' | 'inactive'>('all');

  // Only optional services need manual management
  const optionalServices = useMemo(
    () => annexServices.filter(s => !s.isObligatory),
    [annexServices]
  );

  const selectedService = optionalServices.find(s => s.id === selectedServiceId);

  // Eligible students for this service (by scope)
  const eligibleStudents = useMemo(() => {
    if (!selectedService) return [];
    return students.filter(s => {
      if (!s.classId) return false;
      return selectedService.scope === 'all' || selectedService.classIds.includes(s.classId);
    });
  }, [students, selectedService]);

  // Count enrolled students per service
  const enrolledCountByService = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const svc of optionalServices) {
      counts[svc.id] = serviceEnrollments.filter(
        e => e.serviceId === svc.id && e.endMonthIndex === undefined
      ).length;
    }
    return counts;
  }, [optionalServices, serviceEnrollments]);

  // Filtered students in right panel
  const displayedStudents = useMemo(() => {
    let list = eligibleStudents;
    // UUID string comparison — no parseInt needed
    if (filterClass !== 'all') {
      list = list.filter(s => s.classId === filterClass);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      list = list.filter(s => {
        const e        = getStudentEnrollment(s.id, selectedServiceId!);
        const isActive = !!e && e.endMonthIndex === undefined;
        return filterStatus === 'active' ? isActive : !isActive;
      });
    }
    return list;
  }, [eligibleStudents, filterClass, search, filterStatus, getStudentEnrollment, selectedServiceId]);

  const activeCount = useMemo(
    () => eligibleStudents.filter(s => {
      const e = getStudentEnrollment(s.id, selectedServiceId!);
      return !!e && e.endMonthIndex === undefined;
    }).length,
    [eligibleStudents, getStudentEnrollment, selectedServiceId]
  );

  // ── Bulk actions ─────────────────────────────────────────────────────────────
  const handleBulkEnroll = async () => {
    if (!selectedService) return;
    const currentIdx = getCurrentMonthIndex(academicMonths);
    let count = 0;
    for (const s of displayedStudents) {
      const e = getStudentEnrollment(s.id, selectedService.id);
      if (!e || e.endMonthIndex !== undefined) {
        try {
          await enrollInService(s.id, selectedService.id, currentIdx);
          count++;
        } catch { /* continue with others */ }
      }
    }
    toast({ title: `${count} élève(s) inscrit(s)`, description: `Dès ${academicMonths[currentIdx]?.label ?? ''}` });
  };

  const handleBulkUnenroll = async () => {
    if (!selectedService) return;
    const currentIdx = getCurrentMonthIndex(academicMonths);
    let count = 0;
    for (const s of displayedStudents) {
      const e = getStudentEnrollment(s.id, selectedService.id);
      if (e && e.endMonthIndex === undefined) {
        try {
          await unenrollFromService(s.id, selectedService.id, currentIdx);
          count++;
        } catch { /* continue with others */ }
      }
    }
    toast({ title: `${count} élève(s) désinscrit(s)`, description: `Dernier mois : ${academicMonths[currentIdx]?.label ?? ''}` });
  };

  const freqIcon = (f: string) => {
    if (f === 'monthly') return <RefreshCw className="h-3 w-3" />;
    if (f === 'annual')  return <Calendar className="h-3 w-3" />;
    return <Zap className="h-3 w-3" />;
  };

  return (
    <div className="flex h-full min-h-0">
      {/* ── Left: service list ─────────────────────────────────────────────────── */}
      <div className="w-64 border-r flex-shrink-0 flex flex-col bg-muted/10">
        <div className="px-4 py-3 border-b">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services optionnels</p>
          <p className="text-xs text-muted-foreground mt-0.5">Gérez les inscriptions élèves</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {optionalServices.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground px-3">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Aucun service optionnel</p>
              <p className="text-xs mt-1 opacity-70">Créez des services dans Configuration</p>
            </div>
          ) : (
            optionalServices.map(svc => {
              const isSelected = selectedServiceId === svc.id;
              const count      = enrolledCountByService[svc.id] ?? 0;
              return (
                <button
                  key={svc.id}
                  onClick={() => { setSelectedServiceId(svc.id); setSearch(''); setFilterClass('all'); setFilterStatus('all'); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary-foreground' : ''}`}>{svc.name}</p>
                    <span className={`text-xs font-semibold flex-shrink-0 px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1.5 mt-0.5 text-xs ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {freqIcon(svc.frequency)}
                    <span>{SERVICE_FREQUENCY_LABELS[svc.frequency]}</span>
                    <span>·</span>
                    <span>{fmt(svc.amount)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: students ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!selectedService ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Tag className="h-16 w-16 mb-4 opacity-20" />
            <p className="font-medium">Sélectionnez un service</p>
            <p className="text-sm mt-1 opacity-70">Choisissez un service pour gérer ses inscriptions</p>
          </div>
        ) : (
          <>
            {/* Service header */}
            <div className="flex-shrink-0 px-5 py-3 border-b bg-muted/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">{selectedService.name}</h3>
                    <Badge variant="outline" className="text-xs gap-1">
                      {freqIcon(selectedService.frequency)}
                      {SERVICE_FREQUENCY_LABELS[selectedService.frequency]}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">{fmt(selectedService.amount)}</Badge>
                  </div>
                  {selectedService.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedService.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-3 w-3 text-green-600" />
                      <span className="text-green-700 font-medium">{activeCount}</span> inscrit(s)
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {eligibleStudents.length} élève(s) éligible(s)
                    </span>
                    <span>
                      {selectedService.scope === 'all' ? 'Toutes les classes' : `${selectedService.classIds.length} classe(s) ciblée(s)`}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline" size="sm" className="gap-1.5 text-xs h-8"
                    onClick={handleBulkEnroll}
                  >
                    <UserCheck className="h-3.5 w-3.5 text-green-600" />
                    Inscrire sélection
                  </Button>
                  <Button
                    variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive"
                    onClick={handleBulkUnenroll}
                  >
                    <UserX className="h-3.5 w-3.5" />
                    Désinscrire sélection
                  </Button>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex-shrink-0 px-5 py-2.5 border-b flex items-center gap-3 flex-wrap bg-muted/5">
              <div className="relative flex-1 min-w-48 max-w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Nom, prénom, ID…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {/* Class filter — UUID string values */}
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Toutes classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {classes
                    .filter(c => selectedService.scope === 'all' || selectedService.classIds.includes(c.id))
                    .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
                {([
                  { v: 'all',      l: 'Tous' },
                  { v: 'active',   l: 'Inscrits' },
                  { v: 'inactive', l: 'Non inscrits' },
                ] as const).map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setFilterStatus(v)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      filterStatus === v ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                {displayedStudents.length} élève(s)
              </span>
            </div>

            {/* Info tip */}
            {eligibleStudents.length > 0 && (
              <div className="flex-shrink-0 mx-5 mt-3 mb-0 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Activez le toggle pour inscrire un élève, désactivez-le pour le désinscrire.
                  Vous choisissez le mois de début/fin à chaque action.
                  Les actions en masse utilisent le mois académique actuel.
                </span>
              </div>
            )}

            {/* Student list */}
            <div className="flex-1 overflow-y-auto mt-3">
              {displayedStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Users className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Aucun élève trouvé</p>
                </div>
              ) : (
                <div className="divide-y mx-0">
                  {displayedStudents.map(student => {
                    const cls = student.classId ? classes.find(c => c.id === student.classId) : null;
                    return (
                      <StudentRow
                        key={student.id}
                        student={student}
                        serviceId={selectedService.id}
                        className={cls?.name}
                        academicMonths={academicMonths}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ServiceRoster;
