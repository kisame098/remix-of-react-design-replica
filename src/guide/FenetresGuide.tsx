import {
  BookOpen, Briefcase, Calendar, CheckCircle2, Compass, GraduationCap, LayoutGrid, Map, PartyPopper, PenLine, School,
  Settings, Shuffle, UserCheck, UserPlus, Users, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { statutChapitre, type Chapitre, type IconeChapitre, type Progression } from '@/lib/guide';

const ICONES: Record<IconeChapitre, typeof Compass> = {
  reperes: Map, parametres: Settings, cursus: Shuffle, classes: School, formations: BookOpen, eleve: UserPlus, eleves: Users,
  prof: Briefcase, profs: GraduationCap, notes: PenLine, emploi: Calendar, presences: UserCheck, paiements: Wallet, autres: LayoutGrid,
};

/** Au tout début : on demande, on n'impose pas. */
export const FenetreProposition = ({ ecole, onOui, onNon, onPlusTard }: {
  ecole: string; onOui: () => void; onNon: () => void; onPlusTard: () => void;
}) => (
  <Dialog open onOpenChange={o => { if (!o) onPlusTard(); }}>
    {/* Un clic à côté ne vaut pas réponse : la proposition attend un choix, ou la croix. */}
    <DialogContent data-guide-ui className="max-w-lg" onInteractOutside={e => e.preventDefault()}>
      <DialogHeader>
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><Compass className="h-7 w-7 text-primary" /></div>
        <DialogTitle className="text-center text-xl">Voulez-vous être guidé ?</DialogTitle>
        <DialogDescription className="text-center">
          Bienvenue dans SenClass{ecole ? ` — ${ecole}` : ''}. Le guide vous accompagne pas à pas : il vous montre où aller et à quoi ça sert, et c'est vous qui faites, sur votre école.
        </DialogDescription>
      </DialogHeader>
      <ul className="space-y-2 text-sm">
        {['Vous avancez à votre rythme, chapitre par chapitre.', 'Ce que vous créez est bien enregistré : rien à refaire ensuite.', 'Vous pouvez arrêter, passer ou reprendre quand vous voulez.'].map(t => (
          <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />{t}</li>
        ))}
      </ul>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={onNon}>Non merci, je découvre seul</Button>
        <Button onClick={onOui} className="gap-2"><Compass className="h-4 w-4" />Oui, guidez-moi</Button>
      </DialogFooter>
      <p className="text-center text-xs text-muted-foreground">Vous le retrouverez toujours en cliquant sur votre nom, puis « Apprendre SenClass ».</p>
    </DialogContent>
  </Dialog>
);

/** Tous les chapitres : continuer, refaire, ou n'en prendre qu'un. */
export const FenetreChapitres = ({ chapitres, progression, onFermer, onChoisir }: {
  chapitres: Chapitre[]; progression: Progression; onFermer: () => void; onChoisir: (c: Chapitre, reprendre: boolean) => void;
}) => {
  const faits = chapitres.filter(c => progression.termines.includes(c.id)).length;
  return (
    <Dialog open onOpenChange={o => { if (!o) onFermer(); }}>
      <DialogContent data-guide-ui className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Compass className="h-5 w-5 text-primary" />Apprendre SenClass</DialogTitle>
          <DialogDescription>
            {faits} chapitre{faits > 1 ? 's' : ''} terminé{faits > 1 ? 's' : ''} sur {chapitres.length}. Choisissez celui que vous voulez : le guide vous montre, vous pratiquez.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {chapitres.map((c, i) => {
            const Icone = ICONES[c.icone];
            const statut = statutChapitre(c, progression);
            return (
              <button key={c.id} type="button" onClick={() => onChoisir(c, statut === 'commence')}
                className={cn('flex flex-col rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:shadow-md', statut === 'commence' && 'border-primary')}>
                <div className="mb-2 flex w-full items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><Icone className="h-4 w-4 text-primary" /></span>
                  <span className="flex-1" />
                  {statut === 'termine' && <Badge className="gap-1 bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3 w-3" />Terminé</Badge>}
                  {statut === 'commence' && <Badge>En cours</Badge>}
                </div>
                <p className="font-semibold">{i + 1}. {c.titre}</p>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">{c.description}</p>
                <p className="mt-3 text-xs font-medium text-primary">
                  {statut === 'commence' ? 'Reprendre' : statut === 'termine' ? 'Refaire' : 'Commencer'} · {c.etapes.length} étapes
                </p>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const FenetreBilan = ({ chapitre, suivant, faits, total, onContinuer, onListe, onFermer }: {
  chapitre: Chapitre | null; suivant: Chapitre | null; faits: number; total: number;
  onContinuer: (c: Chapitre) => void; onListe: () => void; onFermer: () => void;
}) => (
  <Dialog open onOpenChange={o => { if (!o) onFermer(); }}>
    <DialogContent data-guide-ui className="max-w-md">
      <DialogHeader>
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100"><PartyPopper className="h-7 w-7 text-green-600" /></div>
        <DialogTitle className="text-center">{suivant ? 'Chapitre terminé !' : 'Vous avez tout vu, bravo !'}</DialogTitle>
        <DialogDescription className="text-center">
          {chapitre ? `« ${chapitre.titre} » est fait. ` : ''}{faits} chapitre{faits > 1 ? 's' : ''} sur {total}.
          {suivant ? ` La suite : « ${suivant.titre} ».` : ''}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="gap-2 sm:gap-2 sm:justify-center">
        <Button variant="outline" onClick={onFermer}>M'arrêter là</Button>
        <Button variant="outline" onClick={onListe}>Voir les chapitres</Button>
        {suivant && <Button onClick={() => onContinuer(suivant)}>Continuer</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
