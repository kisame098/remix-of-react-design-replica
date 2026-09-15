import { useState, useMemo } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { History, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import { SalaryPayment } from '@/types/payroll';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
const fmtDatetime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

const PayrollLedger = () => {
  const { salaryPayments, cancelSalaryPayment, payrollEmployees } = usePayroll();
  const { teachers } = useSchool();
  const [filterPayeeType, setFilterPayeeType] = useState<'all' | 'teacher' | 'staff'>('all');
  const [toCancel, setToCancel] = useState<SalaryPayment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const nameFor = (p: SalaryPayment) => {
    if (p.payeeType === 'teacher') {
      const t = teachers.find(t => t.id === p.teacherEnrollmentId);
      return t ? `${t.firstName} ${t.lastName}` : 'Professeur (introuvable)';
    }
    const e = payrollEmployees.find(e => e.id === p.payrollEmployeeId);
    return e ? `${e.firstName} ${e.lastName}` : 'Salarié (introuvable)';
  };

  const rows = useMemo(() =>
    salaryPayments
      .filter(p => filterPayeeType === 'all' || p.payeeType === filterPayeeType)
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()),
  [salaryPayments, filterPayeeType]);

  const handleCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      await cancelSalaryPayment(toCancel.id);
      toast({ title: 'Paiement annulé' });
      setToCancel(null);
    } catch {
      toast({ title: 'Erreur', description: "L'annulation a échoué.", variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold">Journal des paiements</h3>
        <Select value={filterPayeeType} onValueChange={v => setFilterPayeeType(v as typeof filterPayeeType)}>
          <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="teacher">Professeurs</SelectItem>
            <SelectItem value="staff">Personnel non-enseignant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun paiement enregistré</p>
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map(pay => {
            const cancelled = pay.status === 'cancelled';
            return (
              <div key={pay.id} className="py-2 px-3 border rounded-lg bg-background">
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className={`font-medium ${cancelled ? 'line-through text-muted-foreground' : ''}`}>{nameFor(pay)}</span>
                  <Badge variant="outline" className="text-xs py-0 h-5">{pay.periodMonthKey}</Badge>
                  <span className={`font-semibold ${cancelled ? 'line-through text-muted-foreground' : ''}`}>{fmt(pay.amountPaid)}</span>
                  {cancelled && <Badge variant="destructive" className="text-[10px] py-0 h-4">ANNULÉ</Badge>}
                  <Badge variant="outline" className="text-xs py-0 h-5">{PAYMENT_METHOD_LABELS[pay.method]}</Badge>
                  {pay.reference && <span className="text-xs text-muted-foreground">Réf: {pay.reference}</span>}
                  <span className="text-xs text-muted-foreground font-mono ml-auto">{fmtDatetime(pay.paidAt)}</span>
                  {!cancelled && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive gap-1"
                      onClick={() => setToCancel(pay)}>
                      <XCircle className="h-3 w-3" /> Annuler
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70 mt-1">
                  <span>Confirmé par <span className="font-medium">{pay.confirmedBy || 'Non renseigné'}</span></span>
                  {pay.hoursWorked !== undefined && <span>{pay.hoursWorked.toFixed(1)}h</span>}
                  {pay.note && <span className="italic">"{pay.note}"</span>}
                  {cancelled && (
                    <span className="text-destructive">
                      Annulé {pay.cancelledAt ? `le ${fmtDatetime(pay.cancelledAt)}` : ''} par{' '}
                      <span className="font-medium">{pay.cancelledBy || 'Non renseigné'}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toCancel} onOpenChange={open => !open && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel && `${fmt(toCancel.amountPaid)} versé à ${nameFor(toCancel)} le ${fmtDatetime(toCancel.paidAt)}. `}
              Le paiement reste visible dans le journal (marqué "Annulé"), il n'est jamais supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelling} className="bg-destructive hover:bg-destructive/90">
              Annuler le paiement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PayrollLedger;
