import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, XCircle, Users, Filter, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Download,
} from 'lucide-react';
import {
  getAcademicMonths, isMonthOverdue, MonthKey, PAYMENT_METHOD_LABELS, AnnexService,
  TuitionBillingTiming, DEFAULT_TUITION_BILLING_TIMING,
  getBillableMonthsFor, readBillingRules,
} from '@/types/payment';
import PaymentExportDialog from '@/components/payment/PaymentExportDialog';

// Full datetime display (date + heure exacte)
const fmtDatetime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

type ViewMode = 'inscription' | 'tuition' | 'service';

const PaymentTracking = () => {
  const { students, classes } = useSchool();
  const {
    annexServices, getTuitionConfig,
    hasPaidInscription, hasPaidTuitionMonth, hasPaidService,
    isEnrolledInService, getStudentPayments,
  } = usePayment();
  const { currentYear } = useSchoolYear();
  const { school } = useAuth();
  const billingTiming = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
  const academicMonths = useMemo(
    () => currentYear ? getAcademicMonths(currentYear.startDate, currentYear.endDate, billingTiming) : [],
    [currentYear, billingTiming]
  );

  const [selectedClassId, setSelectedClassId]   = useState<string>('all');
  const [viewMode, setViewMode]                 = useState<ViewMode>('tuition');
  const [selectedMonth, setSelectedMonth]       = useState<MonthKey>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [expandedStudent, setExpandedStudent]   = useState<string | null>(null);   // enrollment UUID
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Filter students by class (UUIDs — no parseInt needed)
  const classStudents = useMemo(() => {
    if (selectedClassId === 'all') return students;
    return students.filter(s => s.classId === selectedClassId);
  }, [students, selectedClassId]);

  // Services scoped to selected class
  const scopedServices = useMemo((): AnnexService[] => {
    if (selectedClassId === 'all') return annexServices;
    return annexServices.filter(s => s.scope === 'all' || s.classIds.includes(selectedClassId));
  }, [annexServices, selectedClassId]);

  const selectedSvc = selectedServiceId ? annexServices.find(s => s.id === selectedServiceId) : null;
  const showMonthFilter = viewMode === 'tuition' || (viewMode === 'service' && selectedSvc?.frequency === 'monthly');

  // Initialiser le mois sélectionné dès que les mois de l'année scolaire sont connus
  useEffect(() => {
    if (!selectedMonth && academicMonths.length > 0) setSelectedMonth(academicMonths[0].key);
  }, [academicMonths, selectedMonth]);

  const selectedMonthIndex = academicMonths.findIndex(m => m.key === selectedMonth);

  const billingRules = useMemo(() => readBillingRules(school?.settings), [school]);
  // Le mois sélectionné est-il dû par CET élève ? (mois décoché par l'école,
  // ou antérieur à son inscription → il ne doit rien pour ce mois).
  const isMonthDueBy = useCallback(
    (student: { enrolledAt: string }, monthKey: string) =>
      getBillableMonthsFor(academicMonths, billingRules, student.enrolledAt).some(m => m.key === monthKey),
    [academicMonths, billingRules],
  );

  // ── Build rows ───────────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    return classStudents
      .filter(student => {
        // Un élève arrivé après ce mois (ou un mois non facturé) n'a rien à
        // devoir — sauf s'il a déjà payé, auquel cas la ligne reste visible.
        if (viewMode === 'tuition' && !isMonthDueBy(student, selectedMonth)) {
          return hasPaidTuitionMonth(student.id, selectedMonth);
        }
        if (viewMode === 'service' && selectedServiceId) {
          const svc = annexServices.find(s => s.id === selectedServiceId);
          if (!svc) return false;
          if (showMonthFilter && !isMonthDueBy(student, selectedMonth)
              && !hasPaidService(student.id, selectedServiceId, selectedMonth)) {
            return false;
          }
          const monthIdx = showMonthFilter ? selectedMonthIndex : undefined;
          return isEnrolledInService(student.id, student.classId, selectedServiceId, monthIdx);
        }
        return true;
      })
      .map(student => {
        let paid   = false;
        let amount = 0;

        if (viewMode === 'inscription') {
          paid   = hasPaidInscription(student.id);
          const cfg = student.classId ? getTuitionConfig(student.classId) : undefined;
          amount = cfg?.inscriptionFee ?? 0;

        } else if (viewMode === 'tuition') {
          paid   = hasPaidTuitionMonth(student.id, selectedMonth);
          const cfg = student.classId ? getTuitionConfig(student.classId) : undefined;
          amount = cfg?.monthlyFee ?? 0;

        } else if (viewMode === 'service' && selectedServiceId) {
          const svc = annexServices.find(s => s.id === selectedServiceId);
          if (svc) {
            paid   = svc.frequency === 'monthly'
              ? hasPaidService(student.id, selectedServiceId, selectedMonth)
              : hasPaidService(student.id, selectedServiceId);
            amount = svc.amount;
          }
        }

        const overdue = (viewMode === 'tuition' || (viewMode === 'service' && showMonthFilter))
          ? isMonthOverdue(academicMonths[selectedMonthIndex] ?? { key: '', label: '', index: 0, dueDate: '9999-12-31' }, paid)
          : false;

        // Paiement précis correspondant à cet item (pour la date/méthode/référence à l'export) —
        // même logique de correspondance que hasPaid*, mais on garde la ligne entière.
        const payment = paid ? getStudentPayments(student.id).find(p => {
          if (p.status === 'cancelled') return false;
          if (viewMode === 'inscription') return p.type === 'inscription';
          if (viewMode === 'tuition') return p.type === 'tuition' && p.monthKey === selectedMonth;
          if (viewMode === 'service' && selectedServiceId) {
            return p.type === 'service' && p.serviceId === selectedServiceId
              && (!showMonthFilter || p.monthKey === selectedMonth);
          }
          return false;
        }) : undefined;

        return { student, paid, amount, overdue, payment };
      });
  }, [
    classStudents, viewMode, selectedMonth, selectedMonthIndex, academicMonths,
    selectedServiceId, showMonthFilter, isMonthDueBy,
    hasPaidInscription, hasPaidTuitionMonth, hasPaidService,
    isEnrolledInService, getTuitionConfig, annexServices,
  ]);

  const itemLabel = useMemo(() => {
    if (viewMode === 'inscription') return "Frais d'inscription";
    if (viewMode === 'tuition') {
      const m = academicMonths.find(m => m.key === selectedMonth);
      return `Scolarité${m ? ' — ' + m.label : ''}`;
    }
    if (viewMode === 'service' && selectedSvc) {
      const m = showMonthFilter ? academicMonths.find(m => m.key === selectedMonth) : null;
      return `${selectedSvc.name}${m ? ' — ' + m.label : ''}`;
    }
    return 'Paiement';
  }, [viewMode, selectedMonth, academicMonths, selectedSvc, showMonthFilter]);

  const selectedClassName = selectedClassId !== 'all' ? classes.find(c => c.id === selectedClassId)?.name : undefined;

  const paidCount   = rows.filter(r => r.paid).length;
  const unpaidCount = rows.length - paidCount;
  const paidRate    = rows.length > 0 ? Math.round((paidCount / rows.length) * 100) : 0;

  const getPaymentLabel = (p: ReturnType<typeof getStudentPayments>[0]) => {
    if (p.type === 'inscription') return 'Frais d\'inscription';
    if (p.type === 'tuition')     return `Scolarité ${academicMonths.find(m => m.key === p.monthKey)?.label ?? ''}`;
    if (p.type === 'service') {
      const svc       = annexServices.find(s => s.id === p.serviceId);
      const monthLabel = p.monthKey ? ` — ${academicMonths.find(m => m.key === p.monthKey)?.label}` : '';
      return `${svc?.name ?? 'Service'}${monthLabel}`;
    }
    return 'Paiement';
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Filter bar ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3 border-b bg-muted/20 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtres</span>
        </div>

        {/* Class — value is UUID string or 'all' */}
        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Mode */}
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          {(['inscription', 'tuition', 'service'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); if (mode === 'service') setSelectedServiceId(''); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === mode ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode === 'inscription' ? 'Inscription' : mode === 'tuition' ? 'Scolarité' : 'Service'}
            </button>
          ))}
        </div>

        {/* Service selector — value is UUID string */}
        {viewMode === 'service' && (
          <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
            <SelectTrigger className="w-52 h-8 text-sm"><SelectValue placeholder="Choisir un service…" /></SelectTrigger>
            <SelectContent>
              {scopedServices.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} {s.isObligatory ? '(obligatoire)' : '(optionnel)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Month */}
        {showMonthFilter && (
          <Select value={selectedMonth} onValueChange={v => setSelectedMonth(v as MonthKey)}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Mois" /></SelectTrigger>
            <SelectContent>
              {academicMonths.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Button
          variant="outline" size="sm" className="gap-1.5 h-8 ml-auto"
          disabled={rows.length === 0}
          onClick={() => setIsExportOpen(true)}
        >
          <Download className="h-3.5 w-3.5" />
          Exporter
        </Button>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-3 border-b grid grid-cols-4 gap-4">
        {[
          { icon: <Users className="h-4 w-4 text-primary" />,           bg: 'bg-primary/10',     label: 'Concernés', value: String(rows.length) },
          { icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,  bg: 'bg-green-500/10',   label: 'Payé',      value: String(paidCount),   cls: 'text-green-700' },
          { icon: <AlertTriangle className="h-4 w-4 text-destructive" />, bg: 'bg-destructive/10', label: 'Non payé',  value: String(unpaidCount), cls: 'text-destructive' },
          { icon: <TrendingUp className="h-4 w-4 text-amber-600" />,    bg: 'bg-amber-500/10',   label: 'Taux',      value: `${paidRate}%` },
        ].map(({ icon, bg, label, value, cls }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${bg}`}>{icon}</div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`font-bold text-sm ${cls ?? ''}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 px-5 py-2 border-b">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${paidRate}%` }} />
        </div>
      </div>

      {/* ── Student list ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Users className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium">Aucun élève dans cette sélection</p>
            {viewMode === 'service' && !selectedServiceId && (
              <p className="text-sm mt-1 opacity-70">Sélectionnez un service ci-dessus</p>
            )}
            {viewMode === 'service' && selectedServiceId && rows.length === 0 && (
              <p className="text-sm mt-1 opacity-70">Aucun élève n'est inscrit à ce service pour ce mois</p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {rows.map(({ student, paid, amount, overdue }) => {
              const cls        = student.classId ? classes.find(c => c.id === student.classId) : null;
              const isExpanded = expandedStudent === student.id;
              const studentPayments = getStudentPayments(student.id);

              return (
                <div key={student.id}>
                  <div
                    className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                  >
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarImage src={student.photoUrl} className="object-cover" />
                      <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                        {`${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{student.firstName} {student.lastName}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{student.studentId}</p>
                        {cls && <Badge variant="outline" className="text-xs py-0 h-4">{cls.name}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {amount > 0 && <span className="text-sm text-muted-foreground">{fmt(amount)}</span>}
                      {paid ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400 border-green-200 gap-1.5 font-normal">
                          <CheckCircle2 className="h-3 w-3" /> Payé
                        </Badge>
                      ) : overdue ? (
                        <Badge variant="destructive" className="gap-1.5 font-normal">
                          <XCircle className="h-3 w-3" /> En retard
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border gap-1.5 font-normal">
                          <XCircle className="h-3 w-3" /> Non payé
                        </Badge>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded: all payments for this student */}
                  {isExpanded && (
                    <div className="px-5 pb-3 bg-muted/10">
                      {studentPayments.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 pl-12">Aucun paiement enregistré</p>
                      ) : (
                        <div className="pl-12 space-y-1 pt-1">
                          {studentPayments
                            .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
                            .map(pay => {
                            const cancelled = pay.status === 'cancelled';
                            return (
                            <div key={pay.id} className="py-1 border-b border-border/40 last:border-0">
                              <div className="flex items-center gap-3 text-xs">
                                <span className={`w-40 truncate flex-shrink-0 ${cancelled ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}>
                                  {getPaymentLabel(pay)}
                                </span>
                                <span className={`font-semibold ${cancelled ? 'line-through text-muted-foreground' : ''}`}>{fmt(pay.amount)}</span>
                                {cancelled && <Badge variant="destructive" className="text-[10px] py-0 h-4 flex-shrink-0">ANNULÉ</Badge>}
                                <Badge variant="outline" className="text-xs py-0 h-4 flex-shrink-0">
                                  {PAYMENT_METHOD_LABELS[pay.method]}
                                </Badge>
                                {pay.reference && (
                                  <span className="text-muted-foreground flex-shrink-0">Réf: {pay.reference}</span>
                                )}
                                <span className="text-muted-foreground flex-shrink-0 font-mono">
                                  {fmtDatetime(pay.paidAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 mt-0.5">
                                <span className="font-mono tracking-wide">N° {pay.id.split('-')[0].toUpperCase()}</span>
                                <span>Encaissé par <span className="font-medium text-muted-foreground">{pay.receivedBy || 'Non renseigné'}</span></span>
                                {cancelled && (
                                  <span className="text-destructive">
                                    Annulé {pay.cancelledAt ? `le ${fmtDatetime(pay.cancelledAt)}` : ''} par{' '}
                                    <span className="font-medium">{pay.cancelledBy || 'Non renseigné'}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );})}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PaymentExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
        rows={rows}
        classes={classes}
        itemLabel={itemLabel}
        className={selectedClassName}
      />
    </div>
  );
};

export default PaymentTracking;
