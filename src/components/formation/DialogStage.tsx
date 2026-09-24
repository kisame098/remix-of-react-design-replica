import { useEffect, useMemo, useState } from 'react';
import { useStages } from '@/contexts/StagesContext';
import type { Student } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Trash2, Building2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type Stage, type Periode, type NiveauMatiere, trouverEntreprise, datesStageValides, noteStageValide,
  periodePourStage, dureeStageJours, libelleDuree,
} from '@/lib/formationPro';

const AUCUNE = '__aucune';
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dateFr = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionId: string;
  /** Absent : création. */
  stage?: Stage;
  /** Élève déjà choisi (création depuis sa ligne). */
  eleveId?: string;
  eleves: Student[];
  periodes: Periode[];
  /** Les matières « Stage » du programme — la note du stage les remplit. */
  matieresStage: NiveauMatiere[];
}

const vide = {
  eleveId: '', entreprise: '', poste: '', tuteur: '', tuteurTelephone: '', dateDebut: '', dateFin: '',
  conventionSignee: false, abandonne: false, periodeId: AUCUNE, matiereId: AUCUNE, note: '', appreciation: '',
};

/**
 * La fiche d'un stage : l'entreprise (retrouvée dans le carnet de l'école ou
 * ajoutée au passage), les dates, où compte la note, la note sur 20 et
 * l'appréciation, et les visites de suivi.
 */
export const DialogStage = ({ open, onOpenChange, promotionId, stage, eleveId, eleves, periodes, matieresStage }: Props) => {
  const { entreprises, visites, entrepriseParNom, addStage, updateStage, deleteStage, addVisite, deleteVisite } = useStages();
  const [f, setF] = useState(vide);
  // La période suit la date de fin tant que l'école ne l'a pas choisie elle-même.
  const [periodeChoisie, setPeriodeChoisie] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [visite, setVisite] = useState({ date: aujourdhui(), visiteur: '', observation: '' });

  useEffect(() => {
    if (!open) return;
    const entreprise = stage?.entrepriseId ? entreprises.find(e => e.id === stage.entrepriseId)?.nom ?? '' : '';
    setF({
      eleveId: stage?.studentEnrollmentId ?? eleveId ?? '',
      entreprise, poste: stage?.poste ?? '', tuteur: stage?.tuteur ?? '', tuteurTelephone: stage?.tuteurTelephone ?? '',
      dateDebut: stage?.dateDebut ?? '', dateFin: stage?.dateFin ?? '',
      conventionSignee: stage?.conventionSignee ?? false, abandonne: stage?.abandonne ?? false,
      periodeId: stage ? stage.periodeId ?? AUCUNE : periodePourStage(periodes)?.id ?? AUCUNE,
      matiereId: stage ? stage.niveauMatiereId ?? AUCUNE : matieresStage[0]?.id ?? AUCUNE,
      note: stage?.note == null ? '' : String(stage.note).replace('.', ','),
      appreciation: stage?.appreciation ?? '',
    });
    setPeriodeChoisie(!!stage);
    setVisite({ date: aujourdhui(), visiteur: '', observation: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stage, eleveId]);

  const changerDateFin = (dateFin: string) => {
    setF(prev => ({
      ...prev, dateFin,
      periodeId: periodeChoisie ? prev.periodeId : periodePourStage(periodes, dateFin || undefined)?.id ?? prev.periodeId,
    }));
  };

  const entrepriseConnue = f.entreprise.trim() ? trouverEntreprise(entreprises, f.entreprise) : undefined;
  const duree = libelleDuree(dureeStageJours(f.dateDebut || undefined, f.dateFin || undefined));
  const visitesDuStage = useMemo(() => visites.filter(v => stage && v.stageId === stage.id), [visites, stage]);
  const periode = periodes.find(p => p.id === f.periodeId);
  const matiere = matieresStage.find(m => m.id === f.matiereId);

  const enregistrer = async () => {
    const note = f.note.trim() === '' ? undefined : Number(f.note.replace(',', '.'));
    if (!f.eleveId) { toast({ title: 'Erreur', description: 'Choisissez l\'élève.', variant: 'destructive' }); return; }
    if (!datesStageValides(f.dateDebut || undefined, f.dateFin || undefined)) {
      toast({ title: 'Erreur', description: 'La date de fin doit être après la date de début.', variant: 'destructive' }); return;
    }
    if (!noteStageValide(note)) {
      toast({ title: 'Erreur', description: 'La note doit être entre 0 et 20 (ou vide tant que le stage n\'est pas noté).', variant: 'destructive' }); return;
    }
    setEnregistrement(true);
    try {
      const entrepriseId = f.entreprise.trim() ? (await entrepriseParNom(f.entreprise)).id : '';
      const data = {
        studentEnrollmentId: f.eleveId, entrepriseId, poste: f.poste, tuteur: f.tuteur, tuteurTelephone: f.tuteurTelephone,
        dateDebut: f.dateDebut, dateFin: f.dateFin, conventionSignee: f.conventionSignee, abandonne: f.abandonne,
        periodeId: f.periodeId === AUCUNE ? '' : f.periodeId, niveauMatiereId: f.matiereId === AUCUNE ? '' : f.matiereId,
        note, appreciation: f.appreciation,
      };
      if (stage) await updateStage(stage.id, data);
      else await addStage(promotionId, data);
      toast({ title: stage ? 'Stage enregistré' : 'Stage créé' });
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setEnregistrement(false);
    }
  };

  const ajouterVisite = async () => {
    if (!stage || !visite.date) return;
    try {
      await addVisite(stage.id, visite);
      setVisite({ date: aujourdhui(), visiteur: '', observation: '' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    }
  };

  const eleve = eleves.find(s => s.id === f.eleveId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{stage ? 'Stage' : 'Nouveau stage'}{eleve ? ` — ${eleve.lastName} ${eleve.firstName}` : ''}</DialogTitle>
            <DialogDescription>Une seule note sur 20, donnée à la fin du stage.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 -mx-1 px-1">
            {!stage && !eleveId && (
              <div className="space-y-2">
                <Label>Élève *</Label>
                <Select value={f.eleveId} onValueChange={v => setF({ ...f, eleveId: v })}>
                  <SelectTrigger aria-label="Élève"><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
                  <SelectContent>
                    {eleves.map(s => <SelectItem key={s.id} value={s.id}>{s.lastName} {s.firstName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="h-4 w-4 text-primary" />Entreprise d'accueil</h3>
              <div className="space-y-1.5">
                <Label htmlFor="stage-entreprise">Entreprise</Label>
                <Input id="stage-entreprise" list="carnet-entreprises" placeholder="Ex : Hôtel Terrou-Bi" value={f.entreprise} onChange={e => setF({ ...f, entreprise: e.target.value })} />
                <datalist id="carnet-entreprises">{entreprises.map(e => <option key={e.id} value={e.nom} />)}</datalist>
                {f.entreprise.trim() && !entrepriseConnue && (
                  <p className="text-xs text-muted-foreground">Nouvelle entreprise : elle sera ajoutée au carnet de l'école.</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stage-poste">Poste / service</Label>
                  <Input id="stage-poste" placeholder="Ex : Cuisine" value={f.poste} onChange={e => setF({ ...f, poste: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stage-tuteur">Tuteur</Label>
                  <Input id="stage-tuteur" value={f.tuteur} onChange={e => setF({ ...f, tuteur: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stage-tel">Téléphone du tuteur</Label>
                  <Input id="stage-tel" inputMode="tel" value={f.tuteurTelephone} onChange={e => setF({ ...f, tuteurTelephone: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Dates</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stage-debut">Début</Label>
                  <Input id="stage-debut" type="date" value={f.dateDebut} onChange={e => setF({ ...f, dateDebut: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stage-fin">Fin</Label>
                  <Input id="stage-fin" type="date" value={f.dateFin} onChange={e => changerDateFin(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={f.conventionSignee} onCheckedChange={v => setF({ ...f, conventionSignee: v === true })} />
                  Convention de stage signée
                </label>
                {duree && <span className="text-muted-foreground">Durée : {duree}</span>}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Note</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stage-note">Note sur 20</Label>
                  <Input id="stage-note" inputMode="decimal" placeholder="—" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Compte dans la moyenne de</Label>
                  <Select value={f.periodeId} onValueChange={v => { setPeriodeChoisie(true); setF({ ...f, periodeId: v }); }}>
                    <SelectTrigger aria-label="Période"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {periodes.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      <SelectItem value={AUCUNE}>Aucune période</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {matieresStage.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Matière du programme</Label>
                  <Select value={f.matiereId} onValueChange={v => setF({ ...f, matiereId: v })}>
                    <SelectTrigger aria-label="Matière"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {matieresStage.map(m => <SelectItem key={m.id} value={m.id}>{m.matiereName}</SelectItem>)}
                      <SelectItem value={AUCUNE}>Aucune</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {periode && matiere
                  ? `La note remplit « ${matiere.matiereName} » (×${matiere.coefficient}) dans Évaluations, pour ${periode.name}.`
                  : matieresStage.length === 0
                    ? 'Le programme n\'a pas de matière de nature « Stage » : la note reste propre au stage.'
                    : 'Sans période, la note ne compte dans aucune moyenne.'}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="stage-appreciation">Appréciation</Label>
                <Textarea id="stage-appreciation" rows={2} placeholder="Ce que l'entreprise et l'école retiennent du stage…" value={f.appreciation} onChange={e => setF({ ...f, appreciation: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={f.abandonne} onCheckedChange={v => setF({ ...f, abandonne: v === true })} />
                Stage abandonné (ne compte pas dans les moyennes)
              </label>
            </section>

            {stage && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Visites de suivi</h3>
                {visitesDuStage.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune visite notée.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {visitesDuStage.map(v => (
                      <li key={v.id} className="group flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{dateFr(v.date)}</span>
                          {v.visiteur && <span className="text-muted-foreground"> · {v.visiteur}</span>}
                          {v.observation && <p className="text-muted-foreground mt-0.5">{v.observation}</p>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" title="Supprimer la visite"
                          onClick={() => void deleteVisite(v.id).catch(err => toast({ title: 'Erreur', description: String(err), variant: 'destructive' }))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
                  <Input type="date" aria-label="Date de la visite" value={visite.date} onChange={e => setVisite({ ...visite, date: e.target.value })} />
                  <Input placeholder="Qui a fait la visite ?" aria-label="Visiteur" value={visite.visiteur} onChange={e => setVisite({ ...visite, visiteur: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Observation" aria-label="Observation" value={visite.observation} onChange={e => setVisite({ ...visite, observation: e.target.value })} />
                  <Button variant="outline" className="gap-1.5 flex-shrink-0" onClick={() => void ajouterVisite()}><Plus className="h-3.5 w-3.5" />Visite</Button>
                </div>
              </section>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t">
            {stage ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setConfirmer(true)}>
                <Trash2 className="h-4 w-4" />Supprimer
              </Button>
            ) : <span />}
            <Button onClick={() => void enregistrer()} disabled={enregistrement}>
              {enregistrement && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {stage ? 'Enregistrer' : 'Créer le stage'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmer} onOpenChange={setConfirmer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce stage ?</AlertDialogTitle>
            <AlertDialogDescription>Sa note et ses visites seront supprimées. Cette action ne peut pas être défaite.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (!stage) return;
              void deleteStage(stage.id).then(() => { onOpenChange(false); toast({ title: 'Stage supprimé' }); })
                .catch(err => toast({ title: 'Erreur', description: String(err), variant: 'destructive' }));
            }}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
