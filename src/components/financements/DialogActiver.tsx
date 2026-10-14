import { useEffect, useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import type { Student } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

const messageDe = (e: unknown) => (e as { message?: string })?.message ?? String(e);

/**
 * Activer le financement de plusieurs apprenants d'une promotion d'un coup
 * (une cohorte 3FPT entière, par exemple). Le même geste existe, un par un, à
 * l'inscription et dans Gestion des élèves.
 */
export const DialogActiver = ({ ouvert, eleves, onFermer }: { ouvert: boolean; eleves: Student[]; onFermer: () => void }) => {
  const fin = useFinancements();
  const [organismeId, setOrganismeId] = useState('');
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    if (!ouvert) return;
    setCoches(new Set());
    setOrganismeId(fin.reglages.organismes[0]?.id ?? '');
  }, [ouvert, fin.reglages.organismes]);

  const tous = eleves.length > 0 && eleves.every(e => coches.has(e.id));
  const basculer = (id: string) => setCoches(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  const activer = async () => {
    setEnCours(true);
    let reussis = 0;
    let sansReduction = 0;
    const echecs: string[] = [];
    for (const e of eleves.filter(x => coches.has(x.id))) {
      try {
        const { fraisReduits } = await fin.activer(e, organismeId);
        reussis++;
        if (fraisReduits === 0) sansReduction++;
      } catch (err) {
        echecs.push(`${e.lastName} ${e.firstName} : ${messageDe(err)}`);
      }
    }
    setEnCours(false);
    const nom = fin.organisme(organismeId)?.nom ?? '';
    if (reussis > 0) {
      toast({
        title: `${reussis} apprenant${reussis > 1 ? 's' : ''} financé${reussis > 1 ? 's' : ''} par ${nom}`,
        description: sansReduction > 0 ? `${sansReduction} sans frais à réduire pour l'instant (frais pas encore réglés dans Paiements → Configuration ?).` : 'Leur part est appliquée sur leurs frais.',
      });
    }
    if (echecs.length > 0) toast({ title: `${echecs.length} activation${echecs.length > 1 ? 's' : ''} impossible${echecs.length > 1 ? 's' : ''}`, description: echecs.slice(0, 3).join(' · '), variant: 'destructive' });
    if (echecs.length === 0) onFermer();
  };

  return (
    <Dialog open={ouvert} onOpenChange={o => { if (!o && !enCours) onFermer(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" />Activer un financement</DialogTitle>
          <DialogDescription>Un dossier est ouvert pour chaque apprenant, et sa part est appliquée sur ses frais.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          <div className="space-y-1.5">
            <Label>Organisme</Label>
            <Select value={organismeId} onValueChange={setOrganismeId}>
              <SelectTrigger aria-label="Organisme"><SelectValue /></SelectTrigger>
              <SelectContent>{fin.reglages.organismes.map(o => <SelectItem key={o.id} value={o.id}>{o.nom} ({o.partFinancee} % pris en charge)</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border flex-1 min-h-0 flex flex-col">
            <label className="flex items-center gap-2 px-3 py-2 border-b text-sm cursor-pointer">
              <Checkbox checked={tous} disabled={eleves.length === 0}
                onCheckedChange={() => setCoches(tous ? new Set() : new Set(eleves.map(e => e.id)))} />
              <span className="text-muted-foreground">{eleves.length} apprenant{eleves.length > 1 ? 's' : ''} non financé{eleves.length > 1 ? 's' : ''}</span>
            </label>
            <div className="overflow-y-auto divide-y max-h-[40vh]">
              {eleves.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Tous les apprenants de la promotion sont déjà financés.</p>
              ) : eleves.map(e => (
                <label key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={coches.has(e.id)} onCheckedChange={() => basculer(e.id)} aria-label={`${e.lastName} ${e.firstName}`} />
                  <span><span className="font-medium">{e.lastName}</span> {e.firstName}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer} disabled={enCours}>Annuler</Button>
          <Button onClick={() => void activer()} disabled={enCours || coches.size === 0 || !organismeId} className="gap-2">
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}Activer{coches.size > 0 ? ` (${coches.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
