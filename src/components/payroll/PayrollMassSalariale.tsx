import { useState, useMemo } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayroll } from '@/contexts/PayrollContext';
import { useAttendance } from '@/hooks/useAttendance';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

const monthsBack = (n: number): string[] => {
  const now = new Date();
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
};

const PayrollMassSalariale = () => {
  const { teachers } = useSchool();
  const { payrollEmployees, salaryPayments } = usePayroll();
  const { calculateMonthlyHours } = useAttendance();
  const { currentYear } = useSchoolYear();

  const [rangeMonths, setRangeMonths] = useState(6);
  const periodKeys = useMemo(() => monthsBack(rangeMonths), [rangeMonths]);

  // ── Effectivement payé — fiable sur n'importe quelle plage, tiré du journal ──
  const paidTotals = useMemo(() => {
    let teacher = 0, staff = 0;
    for (const p of salaryPayments) {
      if (p.status === 'cancelled' || !periodKeys.includes(p.periodMonthKey)) continue;
      if (p.payeeType === 'teacher') teacher += p.amountPaid; else staff += p.amountPaid;
    }
    return { teacher, staff, total: teacher + staff };
  }, [salaryPayments, periodKeys]);

  // ── Coût théorique accru — uniquement calculable pour l'année scolaire
  // actuellement sélectionnée (teachers/calculateMonthlyHours n'en connaissent
  // pas d'autre) ; les salariés payés à l'heure ne sont pas comptés ici (aucune
  // heure suivie pour eux).
  const accrualTotals = useMemo(() => {
    let teacher = 0, staff = 0;
    for (const key of periodKeys) {
      const [y, m] = key.split('-').map(Number);
      for (const t of teachers) {
        if (t.paymentType === 'fixed') {
          teacher += t.salaryAmount;
        } else {
          const hours = calculateMonthlyHours(t.id, m, y, `${t.firstName} ${t.lastName}`).totalEffectiveMinutes / 60;
          teacher += hours * t.salaryAmount;
        }
      }
      for (const e of payrollEmployees.filter(e => e.isActive && e.paymentType === 'fixed')) {
        staff += e.salaryAmount;
      }
    }
    return { teacher, staff, total: teacher + staff };
  }, [teachers, payrollEmployees, calculateMonthlyHours, periodKeys]);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold">Masse salariale</h3>
        <div className="flex gap-1.5">
          {[1, 6, 12].map(n => (
            <Button key={n} size="sm" variant={rangeMonths === n ? 'default' : 'outline'} className="text-xs h-7"
              onClick={() => setRangeMonths(n)}>
              {n} mois
            </Button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Période : {periodKeys[0]} → {periodKeys[periodKeys.length - 1]}
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">Effectivement versé</h4>
          <p className="text-2xl font-bold">{fmt(paidTotals.total)}</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Professeurs : <span className="font-medium text-foreground">{fmt(paidTotals.teacher)}</span></span>
            <span>Personnel : <span className="font-medium text-foreground">{fmt(paidTotals.staff)}</span></span>
          </div>
          <p className="text-xs text-muted-foreground">Basé sur le journal des paiements réels — fiable pour n'importe quelle plage.</p>
        </div>

        <div className="border rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">Coût théorique (accru)</h4>
          <p className="text-2xl font-bold">{fmt(accrualTotals.total)}</p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Professeurs : <span className="font-medium text-foreground">{fmt(accrualTotals.teacher)}</span></span>
            <span>Personnel (fixe) : <span className="font-medium text-foreground">{fmt(accrualTotals.staff)}</span></span>
          </div>
          <div className={cn('flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg p-2')}>
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Basé sur l'année scolaire {currentYear?.id ?? '—'} actuellement sélectionnée — changez d'année pour voir
              d'autres périodes. Le personnel non-enseignant payé à l'heure n'est pas inclus (aucune heure suivie automatiquement).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollMassSalariale;
