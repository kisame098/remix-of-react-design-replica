import { useState, useEffect } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PaymentMethod, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from '@/types/payment';
import { PayeeType, PayrollPaymentType } from '@/types/payroll';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
const METHODS: PaymentMethod[] = ['especes', 'wave', 'orange_money', 'virement', 'cheque'];

const MethodButton = ({ method, selected, onSelect }: { method: PaymentMethod; selected: boolean; onSelect: () => void }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
      selected
        ? 'border-primary bg-primary/5 text-primary font-medium shadow-sm'
        : 'border-border hover:border-primary/40 hover:bg-muted/50'
    }`}
  >
    <span>{PAYMENT_METHOD_ICONS[method]}</span>
    <span>{PAYMENT_METHOD_LABELS[method]}</span>
  </button>
);

interface RecordSalaryPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payeeType: PayeeType;
  payeeId: string;
  payeeName: string;
  periodMonthKey: string;
  paymentType: PayrollPaymentType;
  /** null = pas de calcul auto possible (salarié payé à l'heure) — saisie manuelle */
  defaultAmountDue: number | null;
  /** heures déjà calculées automatiquement pour un prof payé à l'heure */
  defaultHoursWorked?: number;
}

export const RecordSalaryPaymentDialog = ({
  open, onOpenChange, payeeType, payeeId, payeeName, periodMonthKey,
  paymentType, defaultAmountDue, defaultHoursWorked,
}: RecordSalaryPaymentDialogProps) => {
  const { recordSalaryPayment } = usePayroll();
  const { profile } = useAuth();

  const needsManualAmount = defaultAmountDue === null;
  const needsManualHours = payeeType === 'staff' && paymentType === 'hourly';

  const [hoursWorked, setHoursWorked] = useState('');
  const [amountDue, setAmountDue]     = useState('');
  const [amountPaid, setAmountPaid]   = useState('');
  const [method, setMethod]           = useState<PaymentMethod>('especes');
  const [reference, setReference]     = useState('');
  const [note, setNote]               = useState('');
  const [processing, setProcessing]   = useState(false);

  useEffect(() => {
    if (!open) return;
    setHoursWorked(defaultHoursWorked !== undefined ? defaultHoursWorked.toFixed(1) : '');
    const due = defaultAmountDue ?? 0;
    setAmountDue(due > 0 ? String(due) : '');
    setAmountPaid(due > 0 ? String(due) : '');
    setMethod('especes');
    setReference('');
    setNote('');
  }, [open, defaultAmountDue, defaultHoursWorked]);

  const handleSubmit = async () => {
    const due = parseFloat(amountDue) || 0;
    const paid = parseFloat(amountPaid) || 0;
    if (paid <= 0) {
      toast({ title: 'Montant requis', description: 'Le montant versé doit être supérieur à 0.', variant: 'destructive' });
      return;
    }
    const needsRef = method === 'virement' || method === 'cheque';
    if (needsRef && !reference.trim()) {
      toast({ title: 'Référence requise', description: 'Saisissez une référence pour ce mode de paiement', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      await recordSalaryPayment({
        payeeType,
        teacherEnrollmentId: payeeType === 'teacher' ? payeeId : undefined,
        payrollEmployeeId:   payeeType === 'staff' ? payeeId : undefined,
        periodMonthKey,
        hoursWorked: hoursWorked.trim() ? parseFloat(hoursWorked) : undefined,
        amountDue: due,
        amountPaid: paid,
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        confirmedBy: profile?.full_name || profile?.email || undefined,
      });
      toast({ title: 'Paiement enregistré ✓', description: `${fmt(paid)} versé à ${payeeName} via ${PAYMENT_METHOD_LABELS[method]}` });
      onOpenChange(false);
    } catch {
      toast({ title: 'Erreur', description: "Le paiement n'a pas pu être enregistré.", variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>{payeeName} — période {periodMonthKey}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {needsManualHours && (
            <div className="space-y-1.5">
              <Label className="text-xs">Heures travaillées (optionnel)</Label>
              <Input
                type="number" min="0" step="0.5"
                placeholder="Ex: 12"
                value={hoursWorked} onChange={e => setHoursWorked(e.target.value)}
              />
            </div>
          )}

          {needsManualAmount && (
            <div className="space-y-1.5">
              <Label className="text-xs">Montant dû (FCFA) *</Label>
              <Input
                type="number" min="0"
                placeholder="Ex: 60000"
                value={amountDue} onChange={e => setAmountDue(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Montant versé (FCFA) *</Label>
            <Input
              type="number" min="0"
              value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
            />
            {!needsManualAmount && defaultAmountDue !== null && parseFloat(amountPaid) < defaultAmountDue && (
              <p className="text-xs text-amber-600">Paiement partiel — reste {fmt(defaultAmountDue - (parseFloat(amountPaid) || 0))}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mode de paiement</Label>
            <div className="flex flex-wrap gap-2">
              {METHODS.map(m => (
                <MethodButton key={m} method={m} selected={method === m} onSelect={() => setMethod(m)} />
              ))}
            </div>
          </div>

          {(method === 'virement' || method === 'cheque') && (
            <div className="space-y-1.5">
              <Label className="text-xs">{method === 'cheque' ? 'N° de chèque *' : 'Référence virement *'}</Label>
              <Input
                placeholder={method === 'cheque' ? 'Ex: CHQ-0012345' : 'Ex: VIR-2024-001'}
                value={reference} onChange={e => setReference(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Note (optionnel)</Label>
            <Input placeholder="Remarque interne…" value={note} onChange={e => setNote(e.target.value)} />
          </div>

          <Button className="w-full gap-2" size="lg" onClick={handleSubmit} disabled={processing}>
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Confirmer le paiement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
