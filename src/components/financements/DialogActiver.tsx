import { useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, Search } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { Organisme } from '@/lib/financements';
import { messageDe } from '@/components/financements/donneesOrganisme';

/**
 * Rattacher plusieurs apprenants à un organisme d'un coup (une cohorte 3FPT
 * entière, par exemple). Chacun reçoit un dossier « en attente » : la prise en
 * charge s'appliquera quand il sera validé. Le même geste existe, un par un,
 * à l'inscription et dans Gestion des élèves.
 */
export const DialogAjouterApprenants = ({ ouvert, organisme, onFermer }: { ouvert: boolean; organisme: Organisme; onFermer: () => void }) => {
  const fin = useFinancements();
  const { students } = useSchool();
  const { promotions } = useFormationPro();
  const [promotion, setPromotion] = useState('');
  const [recherche, setRecherche] = useState('');
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState(false);
  useEffect(() => { if (ouvert) { setCoches(new Set()); setRecherche(''); } }, [ouvert]);

  const promos = useMemo(() => [...promotions].sort((a, b) => a.name.localeCompare(b.name, 'fr')), [promotions]);
  const choisie = promos.find(p => p.id === promotion) ?? promos[0];
  const eleves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return students
      .filter(s => choisie && s.classId === choisie.classId && !fin.dossierDe(s.id))
      .filter(s => !q || `${s.lastName} ${s.firstName} ${s.studentId}`.toLowerCase().includes(q))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'));
  }, [students, choisie, fin, recherche]);

  const tous = eleves.length > 0 && eleves.every(e => coches.has(e.id));
  const basculer = (id: string) => setCoches(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  const ajouter = async () => {
    setEnCours(true);
    let reussis = 0;
    const echecs: string[] = [];
    for (const e of students.filter(x => coches.has(x.id))) {
      try { await fin.activer(e, organisme.id); reussis++; } catch (err) { echecs.push(`${e.lastName} ${e.firstName} : ${messageDe(err)}`); }
    }
    setEnCours(false);
    if (reussis > 0) {
      toast({
        title: `${reussis} apprenant${reussis > 1 ? 's' : ''} rattaché${reussis > 1 ? 's' : ''} à ${organisme.nom}`,
        description: 'Leur dossier est en attente : validez-le pour que la prise en charge s\'applique.',
      });
    }
    if (echecs.length > 0) toast({ title: `${echecs.length} ajout${echecs.length > 1 ? 's' : ''} impossible${echecs.length > 1 ? 's' : ''}`, description: echecs.slice(0, 3).join(' · '), variant: 'destructive' });
    if (echecs.length === 0) onFermer();
  };

  return (
    <Dialog open={ouvert} onOpenChange={o => { if (!o && !enCours) onFermer(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" />Ajouter des apprenants</DialogTitle>
          <DialogDescription>Pris en charge par {organisme.nom}, une fois leur dossier validé.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
          <div className="flex gap-2">
            <Select value={choisie?.id ?? ''} onValueChange={v => { setPromotion(v); setCoches(new Set()); }}>
              <SelectTrigger className="w-1/2" aria-label="Promotion"><SelectValue placeholder="Promotion" /></SelectTrigger>
              <SelectContent>{promos.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Rechercher…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8" />
            </div>
          </div>
          <div className="rounded-lg border flex-1 min-h-0 flex flex-col">
            <label className="flex items-center gap-2 px-3 py-2 border-b text-sm cursor-pointer">
              <Checkbox checked={tous} disabled={eleves.length === 0}
                onCheckedChange={() => setCoches(prev => { const s = new Set(prev); for (const e of eleves) { if (tous) s.delete(e.id); else s.add(e.id); } return s; })} />
              <span className="text-muted-foreground">Tout cocher ({eleves.length})</span>
            </label>
            <div className="overflow-y-auto divide-y max-h-[40vh]">
              {eleves.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {promos.length === 0 ? 'Aucune promotion créée.' : 'Aucun apprenant à ajouter dans cette promotion.'}
                </p>
              ) : eleves.map(e => (
                <label key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={coches.has(e.id)} onCheckedChange={() => basculer(e.id)} aria-label={`${e.lastName} ${e.firstName}`} />
                  <span className="flex-1"><span className="font-medium">{e.lastName}</span> {e.firstName}</span>
                  <span className="text-xs text-muted-foreground font-mono">{e.studentId}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFermer} disabled={enCours}>Annuler</Button>
          <Button onClick={() => void ajouter()} disabled={enCours || coches.size === 0} className="gap-2">
            {enCours && <Loader2 className="h-4 w-4 animate-spin" />}Ajouter{coches.size > 0 ? ` (${coches.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
