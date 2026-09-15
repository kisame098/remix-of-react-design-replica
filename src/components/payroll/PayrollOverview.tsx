import { useState, useMemo } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayroll } from '@/contexts/PayrollContext';
import { useAttendance } from '@/hooks/useAttendance';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, CheckCircle2, AlertCircle, PenLine } from 'lucide-react';
import { RecordSalaryPaymentDialog } from './RecordSalaryPaymentDialog';
import { PayeeType } from '@/types/payroll';
import { computeAmountOwed, computeRemaining } from '@/lib/payroll';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';

const MONTHS = [
  { value: 1,  label: 'Janvier'   }, { value: 2,  label: 'Février'   },
  { value: 3,  label: 'Mars'      }, { value: 4,  label: 'Avril'     },
  { value: 5,  label: 'Mai'       }, { value: 6,  label: 'Juin'      },
  { value: 7,  label: 'Juillet'   }, { value: 8,  label: 'Août'      },
  { value: 9,  label: 'Septembre' }, { value: 10, label: 'Octobre'   },
  { value: 11, label: 'Novembre'  }, { value: 12, label: 'Décembre'  },
];

interface PayeeRow {
  payeeType: PayeeType;
  id: string;
  name: string;
  roleLabel: string;
  paymentType: 'hourly' | 'fixed';
  salaryAmount: number;
  hoursWorked?: number;   // uniquement prof + horaire (calcul auto)
  owed: number | null;    // null = à saisir manuellement (salarié + horaire)
}

const PayrollOverview = () => {
  const { teachers } = useSchool();
  const { payrollEmployees, getPaidAmountForPeriod } = usePayroll();
  const { calculateMonthlyHours, lockedMonths } = useAttendance();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [dialogRow, setDialogRow] = useState<PayeeRow | null>(null);

  const periodMonthKey = `${year}-${String(month).padStart(2, '0')}`;
  const isLocked = lockedMonths.includes(periodMonthKey);

  const rows = useMemo((): PayeeRow[] => {
    // Le calcul du dû vit dans src/lib/payroll.ts (couvert par payroll.test.ts).
    const teacherRows: PayeeRow[] = teachers.map(t => {
      const name = `${t.firstName} ${t.lastName}`;
      const minutes = t.paymentType === 'hourly'
        ? calculateMonthlyHours(t.id, month, year, name).totalEffectiveMinutes
        : undefined;
      return {
        payeeType: 'teacher', id: t.id, name, roleLabel: 'Professeur',
        paymentType: t.paymentType, salaryAmount: t.salaryAmount,
        hoursWorked: minutes === undefined ? undefined : minutes / 60,
        owed: computeAmountOwed('teacher', t.paymentType, t.salaryAmount, minutes),
      };
    });

    const staffRows: PayeeRow[] = payrollEmployees
      .filter(e => e.isActive)
      .map(e => ({
        payeeType: 'staff', id: e.id, name: `${e.firstName} ${e.lastName}`, roleLabel: e.roleTitle,
        paymentType: e.paymentType, salaryAmount: e.salaryAmount,
        owed: computeAmountOwed('staff', e.paymentType, e.salaryAmount),
      }));

    return [...teacherRows, ...staffRows];
  }, [teachers, payrollEmployees, calculateMonthlyHours, month, year]);

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold">Qui doit être payé ce mois-ci</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Montants calculés automatiquement pour les profs à l'heure — saisie manuelle pour le personnel non-enseignant à l'heure.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && <Badge variant="secondary" className="text-xs">Période clôturée</Badge>}
          <Select value={month.toString()} onValueChange={v => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[130px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-[90px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun prof ni salarié à afficher</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Nom</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Rôle</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Type</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Dû</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Versé</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Reste</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Statut</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const paid = getPaidAmountForPeriod(row.payeeType, row.id, periodMonthKey);
                const remaining = computeRemaining(row.owed, paid);
                return (
                  <tr key={`${row.payeeType}-${row.id}`} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="p-3">
                      <p className="text-sm font-medium">{row.name}</p>
                      {row.hoursWorked !== undefined && (
                        <p className="text-xs text-muted-foreground">{row.hoursWorked.toFixed(1)}h effectuées</p>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{row.roleLabel}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className="text-xs">
                        {row.paymentType === 'hourly' ? 'Horaire' : 'Fixe'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-sm font-medium">
                      {row.owed === null ? <span className="text-muted-foreground italic">à saisir</span> : fmt(row.owed)}
                    </td>
                    <td className="p-3 text-right text-sm">{paid > 0 ? fmt(paid) : '—'}</td>
                    <td className="p-3 text-right text-sm font-semibold">
                      {remaining === null ? '—' : fmt(Math.max(remaining, 0))}
                    </td>
                    <td className="p-3 text-center">
                      {row.owed === null ? (
                        paid > 0
                          ? <Badge className="gap-1 text-xs bg-blue-500 hover:bg-blue-500"><PenLine className="h-3 w-3" />Saisi</Badge>
                          : <Badge variant="outline" className="gap-1 text-xs"><PenLine className="h-3 w-3" />À saisir</Badge>
                      ) : row.owed === 0 && paid === 0 ? (
                        // Prof à l'heure sans heure effectuée ce mois — rien à payer,
                        // à ne pas confondre avec un paiement réellement effectué.
                        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">Rien dû</Badge>
                      ) : remaining! <= 0 ? (
                        <Badge className="gap-1 text-xs bg-green-500 hover:bg-green-500"><CheckCircle2 className="h-3 w-3" />Payé</Badge>
                      ) : paid > 0 ? (
                        <Badge className="gap-1 text-xs bg-amber-500 hover:bg-amber-500"><AlertCircle className="h-3 w-3" />Partiel</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 text-xs"><AlertCircle className="h-3 w-3" />Non payé</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setDialogRow(row)}>
                        Enregistrer
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogRow && (
        <RecordSalaryPaymentDialog
          open={!!dialogRow}
          onOpenChange={open => !open && setDialogRow(null)}
          payeeType={dialogRow.payeeType}
          payeeId={dialogRow.id}
          payeeName={dialogRow.name}
          periodMonthKey={periodMonthKey}
          paymentType={dialogRow.paymentType}
          defaultAmountDue={dialogRow.owed}
          defaultHoursWorked={dialogRow.hoursWorked}
        />
      )}
    </div>
  );
};

export default PayrollOverview;
