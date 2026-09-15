import { useState } from 'react';
import { usePayroll } from '@/contexts/PayrollContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { UserPlus, UsersRound, Pencil } from 'lucide-react';
import { PayrollEmployeeFormDialog } from './PayrollEmployeeFormDialog';
import { PayrollEmployee } from '@/types/payroll';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

const PayrollEmployeeManagement = () => {
  const { payrollEmployees, setPayrollEmployeeActive } = usePayroll();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollEmployee | undefined>(undefined);

  const openCreate = () => { setEditing(undefined); setDialogOpen(true); };
  const openEdit = (e: PayrollEmployee) => { setEditing(e); setDialogOpen(true); };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Personnel non-enseignant</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Comptables, gardiens, agents d'entretien…</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <UserPlus className="h-4 w-4" /> Ajouter un salarié
        </Button>
      </div>

      {payrollEmployees.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <UsersRound className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucun salarié non-enseignant</p>
          <p className="text-sm mt-1 opacity-70">Ajoutez un comptable, un gardien, etc.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Nom</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Poste</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Type</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Montant</th>
                <th className="text-center p-3 text-xs font-semibold text-muted-foreground">Actif</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {payrollEmployees.map((e, idx) => (
                <tr key={e.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="p-3">
                    <p className="text-sm font-medium">{e.firstName} {e.lastName}</p>
                    {e.phone && <p className="text-xs text-muted-foreground">{e.phone}</p>}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{e.roleTitle}</td>
                  <td className="p-3 text-center">
                    <Badge variant="outline" className="text-xs">{e.paymentType === 'hourly' ? 'Horaire' : 'Fixe'}</Badge>
                  </td>
                  <td className="p-3 text-right text-sm font-medium">
                    {fmt(e.salaryAmount)}{e.paymentType === 'hourly' ? '/h' : '/mois'}
                  </td>
                  <td className="p-3 text-center">
                    <Switch checked={e.isActive} onCheckedChange={v => setPayrollEmployeeActive(e.id, v)} />
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(e)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PayrollEmployeeFormDialog open={dialogOpen} onOpenChange={setDialogOpen} employee={editing} />
    </div>
  );
};

export default PayrollEmployeeManagement;
