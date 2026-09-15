import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Banknote, TrendingUp, Users, School, CheckCircle2, AlertTriangle,
  CreditCard, ArrowUpRight
} from 'lucide-react';
import {
  getAcademicMonths, getCurrentMonthIndex, PAYMENT_METHOD_LABELS, PaymentMethod,
  TuitionBillingTiming, DEFAULT_TUITION_BILLING_TIMING,
  getBillableMonthsFor, readBillingRules,
} from '@/types/payment';

const PaymentOverview = () => {
  const { students, classes, getStudentCountByClass } = useSchool();
  const { payments, tuitionConfigs, annexServices, getTuitionConfig, hasPaidInscription, hasPaidTuitionMonth } = usePayment();
  const { currentYear } = useSchoolYear();
  const { school } = useAuth();
  const billingTiming = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
  const academicMonths = useMemo(
    () => currentYear ? getAcademicMonths(currentYear.startDate, currentYear.endDate, billingTiming) : [],
    [currentYear, billingTiming]
  );

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  // ── Global stats — un paiement annulé n'est plus de l'argent encaissé ───────
  const confirmedPayments = useMemo(() => payments.filter(p => p.status !== 'cancelled'), [payments]);
  const totalCollected = useMemo(() => confirmedPayments.reduce((s, p) => s + p.amount, 0), [confirmedPayments]);

  const inscriptionStats = useMemo(() => {
    const total = students.length;
    const paid = students.filter(s => hasPaidInscription(s.id)).length;
    return { total, paid, rate: total > 0 ? Math.round((paid / total) * 100) : 0 };
  }, [students, hasPaidInscription]);

  // Mois courant dans l'année scolaire (retombe sur le premier/dernier mois si on est hors période)
  const currentAcademicMonth = academicMonths[getCurrentMonthIndex(academicMonths)] ?? null;

  const currentMonthStats = useMemo(() => {
    // Seuls les élèves qui doivent RÉELLEMENT ce mois comptent : un élève
    // arrivé après (ou un mois décoché par l'école) ne doit pas faire chuter
    // le taux de recouvrement.
    const rules = readBillingRules(school?.settings);
    const concerned = currentAcademicMonth
      ? students.filter(s =>
          getBillableMonthsFor(academicMonths, rules, s.enrolledAt)
            .some(m => m.key === currentAcademicMonth.key))
      : [];
    const total = concerned.length;
    const paid = currentAcademicMonth
      ? concerned.filter(s => hasPaidTuitionMonth(s.id, currentAcademicMonth.key)).length
      : 0;
    return {
      total, paid,
      rate: total > 0 ? Math.round((paid / total) * 100) : 0,
      month: currentAcademicMonth?.label ?? '—',
    };
  }, [students, hasPaidTuitionMonth, currentAcademicMonth, academicMonths, school]);

  // ── By payment method ────────────────────────────────────────────────────────
  const byMethod = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const p of confirmedPayments) {
      acc[p.method] = (acc[p.method] ?? 0) + p.amount;
    }
    return Object.entries(acc)
      .map(([method, amount]) => ({ method: method as PaymentMethod, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [confirmedPayments]);

  // ── By class ────────────────────────────────────────────────────────────────
  const byClass = useMemo(() => {
    return classes.map(cls => {
      const classStudents = students.filter(s => s.classId === cls.id);
      const classPayments = confirmedPayments.filter(p => classStudents.some(s => s.id === p.studentId));
      const collected = classPayments.reduce((s, p) => s + p.amount, 0);
      const paidInscription = classStudents.filter(s => hasPaidInscription(s.id)).length;
      const cfg = getTuitionConfig(cls.id);
      return {
        cls, collected, paidInscription,
        studentCount: classStudents.length,
        inscRate: classStudents.length > 0 ? Math.round((paidInscription / classStudents.length) * 100) : 0,
        hasCfg: !!cfg,
      };
    }).sort((a, b) => b.collected - a.collected);
  }, [classes, students, confirmedPayments, hasPaidInscription, getTuitionConfig]);

  // ── Recent payments ──────────────────────────────────────────────────────────
  const recentPayments = useMemo(() =>
    [...payments].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()).slice(0, 8),
  [payments]);

  const getStudentName = (studentId: string) => {
    const s = students.find(s => s.id === studentId);
    return s ? `${s.firstName} ${s.lastName}` : 'Élève inconnu';
  };
  const getPaymentLabel = (p: typeof payments[0]) => {
    if (p.type === 'inscription') return 'Inscription';
    if (p.type === 'tuition') return `Scolarité ${academicMonths.find(m => m.key === p.monthKey)?.label ?? ''}`;
    return 'Service';
  };

  return (
    <div className="p-5 space-y-6 overflow-y-auto h-full">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total encaissé</p>
                <p className="text-2xl font-bold mt-0.5">{fmt(totalCollected)}</p>
                <p className="text-xs text-muted-foreground">FCFA</p>
              </div>
              <div className="p-2.5 rounded-xl bg-green-500/10">
                <Banknote className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Paiements</p>
                <p className="text-2xl font-bold mt-0.5">{confirmedPayments.length}</p>
                <p className="text-xs text-muted-foreground">transactions</p>
              </div>
              <div className="p-2.5 rounded-xl bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Inscriptions payées</p>
                <p className="text-2xl font-bold mt-0.5">{inscriptionStats.paid}/{inscriptionStats.total}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Progress value={inscriptionStats.rate} className="h-1 w-12" />
                  <p className="text-xs text-muted-foreground">{inscriptionStats.rate}%</p>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Scolarité {currentMonthStats.month}</p>
                <p className="text-2xl font-bold mt-0.5">{currentMonthStats.paid}/{currentMonthStats.total}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Progress value={currentMonthStats.rate} className="h-1 w-12" />
                  <p className="text-xs text-muted-foreground">{currentMonthStats.rate}%</p>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* By class */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <School className="h-4 w-4 text-primary" />
              Collecte par classe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byClass.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>
            ) : byClass.map(({ cls, collected, paidInscription, studentCount, inscRate, hasCfg }) => (
              <div key={cls.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{cls.name}</span>
                    {!hasCfg && (
                      <Badge variant="outline" className="text-xs py-0 h-4 text-muted-foreground">Non configuré</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground text-xs">{paidInscription}/{studentCount} inscrits</span>
                    <span className="font-semibold">{fmt(collected)} FCFA</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={inscRate} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground w-8 text-right">{inscRate}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By method */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Par mode de paiement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement</p>
            ) : byMethod.map(({ method, amount }) => {
              const pct = totalCollected > 0 ? Math.round((amount / totalCollected) * 100) : 0;
              return (
                <div key={method}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{PAYMENT_METHOD_LABELS[method]}</span>
                    <span className="text-sm font-semibold">{fmt(amount)} FCFA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent payments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-primary" />
            Paiements récents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement enregistré</p>
          ) : (
            <div className="space-y-2">
              {recentPayments.map(pay => {
                const cancelled = pay.status === 'cancelled';
                return (
                <div key={pay.id} className={cn('py-2 border-b last:border-0', cancelled && 'bg-destructive/5 -mx-2 px-2 rounded')}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={cn('text-sm font-medium truncate', cancelled && 'text-muted-foreground')}>{getStudentName(pay.studentId)}</p>
                        {cancelled && <Badge variant="destructive" className="text-[10px] py-0 h-4">ANNULÉ</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{getPaymentLabel(pay)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">{PAYMENT_METHOD_LABELS[pay.method]}</Badge>
                      <span className={cn('text-sm font-semibold', cancelled && 'line-through text-muted-foreground')}>{fmt(pay.amount)} FCFA</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(pay.paidAt).toLocaleString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[10px] font-mono text-muted-foreground/60 tracking-wide">
                      N° {pay.id.split('-')[0].toUpperCase()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Encaissé par <span className="font-medium">{pay.receivedBy || 'Non renseigné'}</span>
                    </span>
                  </div>
                  {cancelled && (
                    <div className="text-[10px] text-destructive mt-0.5">
                      Annulé le {pay.cancelledAt ? new Date(pay.cancelledAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} par{' '}
                      <span className="font-medium">{pay.cancelledBy || 'Non renseigné'}</span>
                    </div>
                  )}
                </div>
              );})}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentOverview;
