import { useState } from 'react';
import { Loader2, UserMinus, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Retirer un élève ou un professeur SANS rien effacer (voir src/lib/retrait.ts).

type Genre = 'eleve' | 'prof';
const MOTS: Record<Genre, { les: string }> = {
  eleve: { les: 'élèves' },
  prof: { les: 'professeurs' },
};

const messageErreur = (e: unknown) => (e as { message?: string })?.message ?? 'Réessayez.';

/** Bouton « Retirer de l'école » avec confirmation. */
export const BoutonRetirer = ({ genre, nom, onRetirer, onFait }: {
  genre: Genre; nom: string; onRetirer: () => Promise<void>; onFait?: () => void;
}) => {
  const { toast } = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const confirmer = async () => {
    setEnCours(true);
    try {
      await onRetirer();
      toast({ title: `${nom} retiré(e)`, description: 'Retrouvable dans « Retirés », avec tout son historique.' });
      setOuvert(false);
      onFait?.();
    } catch (e) {
      toast({ title: 'Impossible de retirer', description: messageErreur(e), variant: 'destructive' });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <Button type="button" variant="ghost" className="gap-2 text-destructive hover:text-destructive sm:mr-auto" onClick={() => setOuvert(true)}>
        <UserMinus className="w-4 h-4" />
        Retirer de l'école
      </Button>
      <AlertDialog open={ouvert} onOpenChange={o => !enCours && setOuvert(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer {nom} ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {genre === 'eleve'
                    ? "L'élève n'apparaîtra plus dans les listes, les classes, les notes ni les impayés de l'année."
                    : "Le professeur n'apparaîtra plus dans les listes, l'emploi du temps ni la paie de l'année."}
                  {' '}Son compte de connexion sera désactivé.
                </p>
                <p className="font-medium text-foreground">
                  Rien n'est effacé : {genre === 'eleve' ? 'ses paiements, reçus et notes restent' : 'ses salaires versés restent'} dans
                  l'historique, et vous pourrez annuler à tout moment avec « Réintégrer », dans « Retirés ».
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enCours}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); confirmer(); }}
              disabled={enCours}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export interface PersonneRetiree { id: string; nom: string; identifiant: string; detail?: string }

/** Bouton « Retirés (n) » et la liste, avec « Réintégrer ». Rien n'est affiché s'il n'y a personne. */
export const ListeRetires = ({ genre, personnes, onReintegrer }: {
  genre: Genre; personnes: PersonneRetiree[]; onReintegrer: (id: string) => Promise<void>;
}) => {
  const { toast } = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);

  if (personnes.length === 0) return null;

  const reintegrer = async (p: PersonneRetiree) => {
    setEnCours(p.id);
    try {
      await onReintegrer(p.id);
      toast({ title: `${p.nom} réintégré(e)`, description: 'De retour dans les listes, compte de connexion réactivé.' });
    } catch (e) {
      toast({ title: 'Impossible de réintégrer', description: messageErreur(e), variant: 'destructive' });
    } finally {
      setEnCours(null);
    }
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOuvert(true)}>
        <Users className="w-4 h-4" />
        Retirés ({personnes.length})
      </Button>
      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{MOTS[genre].les.charAt(0).toUpperCase() + MOTS[genre].les.slice(1)} retirés cette année</DialogTitle>
            <DialogDescription>Leur historique est conservé. Réintégrer les remet dans les listes et réactive leur compte.</DialogDescription>
          </DialogHeader>
          <ul className="divide-y max-h-[60vh] overflow-y-auto">
            {personnes.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.nom}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.identifiant}{p.detail ? ` · ${p.detail}` : ''}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0" disabled={enCours !== null} onClick={() => reintegrer(p)}>
                  {enCours === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Réintégrer
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
};
