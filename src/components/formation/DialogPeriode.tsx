import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { type Periode, nomPeriodeValide, datesPromotionValides } from '@/lib/formationPro';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absente : création. Présente : modification de cette période. */
  periode?: Periode;
  /** Nombre de périodes déjà créées — sert aux suggestions « Semestre 2 », « Trimestre 2 ». */
  nbExistantes: number;
  onValider: (data: { name: string; startDate?: string; endDate?: string }) => Promise<void>;
}

/** Créer ou modifier une période de la promotion : un nom, et des dates facultatives. */
export const DialogPeriode = ({ open, onOpenChange, periode, nbExistantes, onValider }: Props) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(periode?.name ?? '');
    setStartDate(periode?.startDate ?? '');
    setEndDate(periode?.endDate ?? '');
  }, [open, periode]);

  const valider = async () => {
    if (!nomPeriodeValide(name)) {
      toast({ title: 'Erreur', description: 'Le nom de la période est obligatoire.', variant: 'destructive' });
      return;
    }
    if (!datesPromotionValides(startDate, endDate)) {
      toast({ title: 'Erreur', description: 'La date de fin doit être après la date de début.', variant: 'destructive' });
      return;
    }
    setEnregistrement(true);
    try {
      await onValider({ name: name.trim(), startDate: startDate || undefined, endDate: endDate || undefined });
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setEnregistrement(false);
    }
  };

  const suggestions = [`Semestre ${nbExistantes + 1}`, `Trimestre ${nbExistantes + 1}`];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{periode ? 'Modifier la période' : 'Nouvelle période'}</DialogTitle>
          <DialogDescription>Propre à cette promotion : chaque formation garde son propre rythme.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="periode-nom">Nom *</Label>
            <Input id="periode-nom" placeholder="Ex : Semestre 1" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && void valider()} />
            {!periode && (
              <div className="flex gap-2">
                {suggestions.map(s => (
                  <button key={s} type="button" onClick={() => setName(s)} className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/70">{s}</button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="periode-debut">Début (facultatif)</Label>
              <Input id="periode-debut" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periode-fin">Fin (facultatif)</Label>
              <Input id="periode-fin" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => void valider()} className="w-full" disabled={enregistrement}>
            {enregistrement && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {periode ? 'Enregistrer' : 'Créer la période'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
