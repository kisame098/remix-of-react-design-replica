import { Landmark } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AUCUN = '__aucun';

/**
 * Le choix discret « Financement » d'un apprenant (inscription, Gestion des
 * élèves). N'apparaît que si l'école a activé les financements.
 * `valeur` : identifiant de l'organisme, ou '' (pas de financement).
 */
export const ChoixFinancement = ({ valeur, onChange, disabled }: { valeur: string; onChange: (id: string) => void; disabled?: boolean }) => {
  const { actif, reglages } = useFinancements();
  if (!actif) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-3 border-t">
      <Label className="flex items-center gap-1.5 text-sm text-muted-foreground font-normal">
        <Landmark className="h-4 w-4" />Financement
      </Label>
      <Select value={valeur || AUCUN} onValueChange={v => onChange(v === AUCUN ? '' : v)} disabled={disabled}>
        <SelectTrigger className="w-64 h-9" aria-label="Financement"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={AUCUN}>Aucun — l'apprenant paie tout</SelectItem>
          {reglages.organismes.map(o => (
            <SelectItem key={o.id} value={o.id}>{o.nom} — {o.partFinancee} % pris en charge</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
