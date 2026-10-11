import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool } from '@/contexts/SchoolContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import type { Promotion } from '@/lib/formationPro';

const AUCUN = '__aucun';

/**
 * Le formateur de CHAQUE matière d'une promotion, sur un seul écran : c'est
 * lui qui saisit les notes de la matière depuis son portail (onglet Notes).
 * « Aucun » : la saisie reste faite par l'administration, dans Évaluations.
 * Les matières « Stage » n'y figurent pas : leur note vient de la rubrique Stages.
 */
export const DialogFormateurs = ({ promotion, open, onOpenChange }: {
  promotion: Promotion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { niveauMatieres, affectations, affecterFormateur } = useFormationPro();
  const { teachers } = useSchool();

  const matieres = useMemo(
    () => (promotion ? niveauMatieres.filter(m => m.niveauId === promotion.niveauId && m.nature !== 'stage') : [])
      .sort((a, b) => a.ordering - b.ordering),
    [niveauMatieres, promotion],
  );
  const profs = useMemo(() => [...teachers].sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr')), [teachers]);

  const choisir = (niveauMatiereId: string, valeur: string) => {
    if (!promotion) return;
    affecterFormateur(promotion.id, niveauMatiereId, valeur === AUCUN ? null : valeur)
      .then(() => toast({ title: valeur === AUCUN ? 'Formateur retiré' : 'Formateur affecté' }))
      .catch(err => toast({ title: "Impossible d'affecter le formateur", description: String(err?.message ?? err), variant: 'destructive' }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Formateurs — {promotion?.name}</DialogTitle>
          <DialogDescription>
            Le formateur choisi saisit lui-même les notes de la matière depuis son portail (onglet Notes).
            Laissez « Aucun » pour que l'administration les saisisse dans Évaluations.
          </DialogDescription>
        </DialogHeader>
        {profs.length === 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2">
            Aucun professeur inscrit cette année. Inscrivez d'abord vos formateurs dans{' '}
            <Link to="/professeurs" className="underline">Professeurs</Link>.
          </p>
        )}
        {matieres.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aucune matière au programme de ce niveau.</p>
        ) : (
          <div className="divide-y">
            {matieres.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.matiereName}</p>
                  <p className="text-xs text-muted-foreground">coefficient {m.coefficient}</p>
                </div>
                <Select
                  value={affectations.find(a => a.promotionId === promotion?.id && a.niveauMatiereId === m.id)?.teacherId ?? AUCUN}
                  onValueChange={v => choisir(m.id, v)}
                >
                  <SelectTrigger className="w-56" aria-label={`Formateur — ${m.matiereName}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUCUN}>Aucun (administration)</SelectItem>
                    {profs.map(t => <SelectItem key={t.id} value={t.id}>{t.lastName} {t.firstName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
