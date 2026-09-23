import { useMemo, useState } from 'react';
import type { Student } from '@/contexts/SchoolContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Search, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  elevesPromotion: Student[];
  tousLesEleves: Student[];
  candidats: Set<string>;
  verrouille: boolean;
  onAjouter: (studentId: string) => Promise<void>;
  onRetirer: (studentId: string) => Promise<void>;
}

/**
 * Les candidats d'un examen : les élèves de la promotion (décocher un élève
 * parti), plus, si besoin, un élève d'une autre promotion (un redoublant qui
 * repasse cet examen). Retirer un candidat ne supprime pas ses notes.
 */
export const DialogCandidats = ({ open, onOpenChange, elevesPromotion, tousLesEleves, candidats, verrouille, onAjouter, onRetirer }: Props) => {
  const [enCours, setEnCours] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');

  const idsPromotion = useMemo(() => new Set(elevesPromotion.map(s => s.id)), [elevesPromotion]);
  const externes = tousLesEleves.filter(s => candidats.has(s.id) && !idsPromotion.has(s.id));
  const trouves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 2) return [];
    return tousLesEleves
      .filter(s => !idsPromotion.has(s.id) && !candidats.has(s.id))
      .filter(s => `${s.lastName} ${s.firstName} ${s.studentId}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [recherche, tousLesEleves, idsPromotion, candidats]);

  const basculer = async (s: Student, estCandidat: boolean) => {
    setEnCours(s.id);
    try {
      if (estCandidat) await onRetirer(s.id);
      else await onAjouter(s.id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setEnCours(null);
    }
  };

  const ligne = (s: Student) => {
    const estCandidat = candidats.has(s.id);
    return (
      <label key={s.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
        <Checkbox checked={estCandidat} disabled={verrouille || enCours === s.id} onCheckedChange={() => void basculer(s, estCandidat)} />
        <span className="text-sm"><span className="font-medium">{s.lastName}</span> {s.firstName}</span>
      </label>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Candidats ({candidats.size})</DialogTitle>
          <DialogDescription>
            {verrouille ? 'Examen verrouillé : la liste ne peut plus changer.' : 'Décochez un élève qui ne passe pas cet examen. Ses notes éventuelles sont conservées.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 -mx-1 px-1">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Élèves de la promotion</p>
            {elevesPromotion.length === 0 ? <p className="text-sm text-muted-foreground px-2">Aucun élève inscrit.</p> : elevesPromotion.map(ligne)}
          </div>
          {externes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Autres promotions</p>
              {externes.map(ligne)}
            </div>
          )}
          {!verrouille && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ajouter un élève d'une autre promotion</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Nom, prénom ou matricule…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8 h-9" />
              </div>
              {trouves.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-2 px-2 py-1">
                  <span className="text-sm"><span className="font-medium">{s.lastName}</span> {s.firstName} <span className="text-xs text-muted-foreground">{s.studentId}</span></span>
                  <Button size="sm" variant="outline" className="h-7 gap-1" disabled={enCours === s.id} onClick={() => void basculer(s, false)}>
                    <UserPlus className="h-3.5 w-3.5" />Ajouter
                  </Button>
                </div>
              ))}
              {recherche.trim().length >= 2 && trouves.length === 0 && <p className="text-xs text-muted-foreground px-2">Aucun élève trouvé.</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
