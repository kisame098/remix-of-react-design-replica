import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type Examen, type TypeExamen, LIBELLES_TYPE_EXAMEN, nomExamenValide, seuilAdmissionValide, datesPromotionValides,
} from '@/lib/formationPro';
import type { DonneesExamen } from '@/contexts/ExamensContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent : création. */
  examen?: Examen;
  nbExistants: number;
  /** Résumé des épreuves reprises du programme (« Écrit : 3 · Pratique : 2 »), vide si rien à reprendre. */
  resumeProgramme: string;
  onValider: (data: DonneesExamen, depuisProgramme: boolean) => Promise<void>;
}

export const DialogExamen = ({ open, onOpenChange, examen, nbExistants, resumeProgramme, onValider }: Props) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<TypeExamen>('blanc');
  const [reference, setReference] = useState('');
  const [seuil, setSeuil] = useState('10');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [depuisProgramme, setDepuisProgramme] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(examen?.name ?? '');
    setType(examen?.type ?? 'blanc');
    setReference(examen?.reference ?? '');
    setSeuil(String(examen?.seuilAdmission ?? 10).replace('.', ','));
    setDateDebut(examen?.dateDebut ?? '');
    setDateFin(examen?.dateFin ?? '');
    setDepuisProgramme(resumeProgramme !== '');
  }, [open, examen, resumeProgramme]);

  const valider = async () => {
    const seuilAdmission = Number(seuil.replace(',', '.'));
    if (!nomExamenValide(name)) {
      toast({ title: 'Erreur', description: 'Le nom de l\'examen est obligatoire.', variant: 'destructive' });
      return;
    }
    if (!seuilAdmissionValide(seuilAdmission)) {
      toast({ title: 'Erreur', description: 'Le seuil d\'admission doit être entre 0 et 20.', variant: 'destructive' });
      return;
    }
    if (!datesPromotionValides(dateDebut, dateFin)) {
      toast({ title: 'Erreur', description: 'La date de fin doit être après la date de début.', variant: 'destructive' });
      return;
    }
    setEnregistrement(true);
    try {
      await onValider({
        name: name.trim(), type, reference: type === 'officiel' ? reference : '', seuilAdmission,
        dateDebut: dateDebut || undefined, dateFin: dateFin || undefined,
      }, !examen && depuisProgramme && resumeProgramme !== '');
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setEnregistrement(false);
    }
  };

  const suggestions = [`Examen blanc n°${nbExistants + 1}`, 'Examen final'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{examen ? 'Modifier l\'examen' : 'Nouvel examen'}</DialogTitle>
          <DialogDescription>Un rattrapage se crée comme un nouvel examen : le premier passage reste en mémoire.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="examen-nom">Nom *</Label>
            <Input id="examen-nom" placeholder="Ex : Examen blanc n°1" value={name} onChange={e => setName(e.target.value)} />
            {!examen && (
              <div className="flex gap-2 flex-wrap">
                {suggestions.map(s => (
                  <button key={s} type="button" onClick={() => setName(s)} className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/70">{s}</button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(LIBELLES_TYPE_EXAMEN) as TypeExamen[]).map(t => (
                <button
                  key={t} type="button" onClick={() => setType(t)}
                  className={`rounded-md border px-3 py-2 text-sm text-left transition-all ${type === t ? 'border-primary bg-primary/5 ring-1 ring-primary font-medium' : 'hover:bg-muted/40'}`}
                >
                  {LIBELLES_TYPE_EXAMEN[t]}
                </button>
              ))}
            </div>
          </div>
          {type === 'officiel' && (
            <div className="space-y-2">
              <Label htmlFor="examen-ref">Référence de session (facultatif)</Label>
              <Input id="examen-ref" placeholder="Ex : Session juin 2027" value={reference} onChange={e => setReference(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="examen-seuil">Admis à partir de</Label>
              <div className="flex items-center gap-1.5">
                <Input id="examen-seuil" inputMode="decimal" value={seuil} onChange={e => setSeuil(e.target.value)} />
                <span className="text-sm text-muted-foreground">/20</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="examen-debut">Début</Label>
              <Input id="examen-debut" type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="examen-fin">Fin</Label>
              <Input id="examen-fin" type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
            </div>
          </div>
          {!examen && resumeProgramme !== '' && (
            <label className="flex items-start gap-2.5 rounded-md border p-3 cursor-pointer">
              <Checkbox checked={depuisProgramme} onCheckedChange={v => setDepuisProgramme(v === true)} className="mt-0.5" />
              <span className="text-sm">
                Préparer les épreuves à partir du programme
                <span className="block text-xs text-muted-foreground mt-0.5">{resumeProgramme} — avec leurs coefficients, notées sur 20. Modifiables ensuite par le directeur.</span>
              </span>
            </label>
          )}
          <Button onClick={() => void valider()} className="w-full" disabled={enregistrement}>
            {enregistrement && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {examen ? 'Enregistrer' : 'Créer l\'examen'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
