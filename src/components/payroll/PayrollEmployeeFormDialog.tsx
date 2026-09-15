import { useState, useEffect } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PayrollEmployee, PayrollPaymentType, PAYROLL_PAYMENT_TYPE_LABELS } from '@/types/payroll';

interface PayrollEmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Présent = édition, absent = création */
  employee?: PayrollEmployee;
}

const emptyForm = { firstName: '', lastName: '', phone: '', roleTitle: '', paymentType: '' as PayrollPaymentType | '', salaryAmount: '' };

export const PayrollEmployeeFormDialog = ({ open, onOpenChange, employee }: PayrollEmployeeFormDialogProps) => {
  const { addPayrollEmployee, updatePayrollEmployee } = usePayroll();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(employee ? {
      firstName: employee.firstName, lastName: employee.lastName, phone: employee.phone ?? '',
      roleTitle: employee.roleTitle, paymentType: employee.paymentType, salaryAmount: String(employee.salaryAmount),
    } : emptyForm);
  }, [open, employee]);

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.roleTitle.trim() || !form.paymentType || !form.salaryAmount) {
      toast({ title: 'Champs requis', description: 'Nom, prénom, poste, type et montant sont obligatoires.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        firstName:    form.firstName.trim(),
        lastName:     form.lastName.trim(),
        phone:        form.phone.trim() || undefined,
        roleTitle:    form.roleTitle.trim(),
        paymentType:  form.paymentType as PayrollPaymentType,
        salaryAmount: parseFloat(form.salaryAmount) || 0,
      };
      if (employee) {
        await updatePayrollEmployee(employee.id, data);
        toast({ title: 'Salarié modifié ✓' });
      } else {
        await addPayrollEmployee(data);
        toast({ title: 'Salarié ajouté ✓' });
      }
      onOpenChange(false);
    } catch {
      toast({ title: 'Erreur', description: "L'enregistrement a échoué.", variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{employee ? 'Modifier le salarié' : 'Ajouter un salarié'}</DialogTitle>
          <DialogDescription>Personnel non-enseignant (comptable, gardien, etc.)</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Prénom *</Label>
              <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} disabled={submitting} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Poste *</Label>
            <Input placeholder="Ex: Comptable, Gardien, Femme de ménage…" value={form.roleTitle}
              onChange={e => setForm(f => ({ ...f, roleTitle: e.target.value }))} disabled={submitting} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Téléphone</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} disabled={submitting} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type de paiement *</Label>
            <Select value={form.paymentType} onValueChange={v => setForm(f => ({ ...f, paymentType: v as PayrollPaymentType }))} disabled={submitting}>
              <SelectTrigger><SelectValue placeholder="Sélectionner le mode de paiement" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYROLL_PAYMENT_TYPE_LABELS) as PayrollPaymentType[]).map(k => (
                  <SelectItem key={k} value={k}>{PAYROLL_PAYMENT_TYPE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.paymentType && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                {form.paymentType === 'hourly' ? 'Taux horaire (FCFA/heure) *' : 'Salaire mensuel (FCFA) *'}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">FCFA</span>
                <Input
                  type="number" min="0" className="pl-14"
                  placeholder={form.paymentType === 'hourly' ? 'Ex: 2000' : 'Ex: 80000'}
                  value={form.salaryAmount} onChange={e => setForm(f => ({ ...f, salaryAmount: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              {form.paymentType === 'hourly' && (
                <p className="text-xs text-muted-foreground">
                  Aucun système ne suit les heures de ce type de personnel — le montant sera saisi manuellement à chaque paiement.
                </p>
              )}
            </div>
          )}

          <Button className="w-full gap-2" size="lg" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {employee ? 'Enregistrer les modifications' : 'Ajouter le salarié'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
