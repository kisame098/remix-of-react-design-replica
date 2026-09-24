import { useState } from 'react';
import { useStages } from '@/contexts/StagesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Pencil, Trash2, Search, Phone, MapPin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { type Entreprise, nomEntrepriseValide, trouverEntreprise } from '@/lib/formationPro';

interface Props { open: boolean; onOpenChange: (open: boolean) => void }

/**
 * Le carnet d'entreprises de l'école : les coordonnées se corrigent ici, une
 * fois pour tous les stages. Une entreprise encore utilisée ne se supprime pas.
 */
export const DialogEntreprises = ({ open, onOpenChange }: Props) => {
  const { entreprises, stages, updateEntreprise, deleteEntreprise } = useStages();
  const [recherche, setRecherche] = useState('');
  const [edition, setEdition] = useState<Entreprise | null>(null);

  const q = recherche.trim().toLowerCase();
  const liste = q ? entreprises.filter(e => `${e.nom} ${e.secteur ?? ''} ${e.adresse ?? ''}`.toLowerCase().includes(q)) : entreprises;
  const nbStages = (id: string) => stages.filter(s => s.entrepriseId === id).length;

  const enregistrer = async () => {
    if (!edition) return;
    if (!nomEntrepriseValide(edition.nom)) { toast({ title: 'Erreur', description: 'Le nom est obligatoire.', variant: 'destructive' }); return; }
    if (trouverEntreprise(entreprises, edition.nom, edition.id)) {
      toast({ title: 'Déjà dans le carnet', description: `« ${edition.nom} » existe déjà.`, variant: 'destructive' }); return;
    }
    try {
      const { id, ...data } = edition;
      await updateEntreprise(id, data);
      setEdition(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    }
  };

  const supprimer = async (e: Entreprise) => {
    if (nbStages(e.id) > 0) return;
    try { await deleteEntreprise(e.id); }
    catch (err) { toast({ title: 'Erreur', description: String(err), variant: 'destructive' }); }
  };

  const champ = (cle: keyof Omit<Entreprise, 'id'>, label: string) => edition && (
    <div className="space-y-1">
      <Label htmlFor={`ent-${cle}`} className="text-xs">{label}</Label>
      <Input id={`ent-${cle}`} className="h-8" value={edition[cle] ?? ''} onChange={ev => setEdition({ ...edition, [cle]: ev.target.value })} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) setEdition(null); onOpenChange(o); }}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Entreprises ({entreprises.length})</DialogTitle>
          <DialogDescription>Les entreprises s'ajoutent toutes seules en créant un stage. Corrigez ici leurs coordonnées.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1">
          {liste.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Aucune entreprise.</p>}
          {liste.map(e => edition?.id === e.id ? (
            <div key={e.id} className="rounded-md border border-primary/40 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {champ('nom', 'Nom')}{champ('secteur', 'Secteur')}
                {champ('adresse', 'Adresse')}{champ('telephone', 'Téléphone')}
                {champ('email', 'E-mail')}{champ('contact', 'Personne à contacter')}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEdition(null)}>Annuler</Button>
                <Button size="sm" onClick={() => void enregistrer()}>Enregistrer</Button>
              </div>
            </div>
          ) : (
            <div key={e.id} className="group flex items-start justify-between gap-2 rounded-md border px-3 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium">{e.nom}{e.secteur && <span className="font-normal text-muted-foreground"> · {e.secteur}</span>}</p>
                <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                  {e.adresse && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.adresse}</span>}
                  {e.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.telephone}</span>}
                  <span>{nbStages(e.id)} stage{nbStages(e.id) !== 1 ? 's' : ''}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifier" onClick={() => setEdition(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  disabled={nbStages(e.id) > 0}
                  title={nbStages(e.id) > 0 ? 'Utilisée par des stages : impossible de la supprimer' : 'Supprimer'}
                  onClick={() => void supprimer(e)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
