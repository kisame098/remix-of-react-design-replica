import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Trash2, Loader2, Pencil, Layers, Copy, Clock, ShieldAlert } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { type Niveau, nomNiveauValide, triNiveaux, totauxNiveau } from '@/lib/formationPro';

/**
 * Page 2 du module Formations : les niveaux d'UNE formation (« CAP 1 »,
 * « CAP 2 »… ou « Cycle unique »). On clique sur un niveau pour gérer son
 * programme pédagogique (src/pages/formation/NiveauProgramme.tsx).
 */
const FormationDetail = () => {
  const { formationId } = useParams<{ formationId: string }>();
  const navigate = useNavigate();
  const {
    loading, formations, niveaux, niveauMatieres, choixGroups,
    addNiveau, updateNiveau, deleteNiveau, duplicateNiveau,
  } = useFormationPro();

  const formation = formations.find(f => f.id === formationId);
  const niveauxTries = useMemo(
    () => triNiveaux(niveaux.filter(n => n.formationId === formationId)),
    [niveaux, formationId],
  );

  // ── Créer / modifier / dupliquer un niveau ───────────────────────────────
  type DialogState = { kind: 'create' } | { kind: 'edit'; niveauId: string } | { kind: 'duplicate'; sourceId: string; sourceName: string };
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => { setName(''); setDescription(''); setDialog(null); };
  const openCreate = () => { setName(''); setDescription(''); setDialog({ kind: 'create' }); };
  const openEdit = (n: Niveau) => { setName(n.name); setDescription(n.description ?? ''); setDialog({ kind: 'edit', niveauId: n.id }); };
  const openDuplicate = (n: Niveau) => { setName(''); setDescription(n.description ?? ''); setDialog({ kind: 'duplicate', sourceId: n.id, sourceName: n.name }); };

  const handleSave = async () => {
    if (!dialog || !formationId || !nomNiveauValide(name)) {
      toast({ title: 'Erreur', description: 'Le nom du niveau est obligatoire.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const data = { name: name.trim(), description: description.trim() || undefined };
      if (dialog.kind === 'create') {
        await addNiveau(formationId, data);
        toast({ title: 'Niveau créé', description: data.name });
      } else if (dialog.kind === 'edit') {
        await updateNiveau(dialog.niveauId, data);
        toast({ title: 'Niveau modifié' });
      } else {
        const nouveau = await duplicateNiveau(dialog.sourceId, formationId, data);
        toast({ title: 'Niveau dupliqué', description: `« ${nouveau.name} » créé avec le même contenu que « ${dialog.sourceName} » — l'original n'a pas changé.` });
      }
      resetForm();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteNiveau(id);
      toast({ title: 'Niveau supprimé' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }
  if (!formation) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/formation/formations" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Formations</Link>
        <p className="text-destructive text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Formation introuvable.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Link to="/formation/formations" className="text-sm text-primary flex items-center gap-1 w-fit"><ArrowLeft className="h-4 w-4" />Formations</Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{formation.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {[formation.diplomaType, formation.duration, formation.entryLevel ? `Entrée : ${formation.entryLevel}` : null].filter(Boolean).join(' · ') || '—'}
          </p>
          {formation.description && <p className="text-sm text-muted-foreground/80 mt-1 max-w-2xl">{formation.description}</p>}
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />Ajouter un niveau
        </Button>
      </div>

      {niveauxTries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Layers className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucun niveau</h3>
            <p className="text-muted-foreground mb-6">
              Pour un cursus en plusieurs années, créez « {formation.name.split(' ')[0]} 1 », puis dupliquez-le pour
              les années suivantes. Pour un cursus en une seule étape, créez « Cycle unique ».
            </p>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />Ajouter un niveau</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {niveauxTries.map(n => {
            const mats = niveauMatieres.filter(m => m.niveauId === n.id);
            const choix = choixGroups.filter(c => c.niveauId === n.id);
            const totaux = totauxNiveau(mats, choix);
            const isDeleting = deletingId === n.id;
            return (
              <Card key={n.id} className="group h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base truncate">
                      <Link to={`/formation/formations/${formationId}/niveaux/${n.id}`} className="hover:underline">{n.name}</Link>
                    </CardTitle>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Modifier" onClick={() => openEdit(n)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Dupliquer" onClick={() => openDuplicate(n)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Supprimer"
                        disabled={isDeleting} onClick={() => setConfirmDeleteId(n.id)}
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  {n.description && <p className="text-xs text-muted-foreground/80 mt-1">{n.description}</p>}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
                    {totaux.nbMatieres} matière{totaux.nbMatieres > 1 ? 's' : ''} · {totaux.totalCoef} coef.
                    {totaux.totalHeures > 0 && (
                      <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{totaux.totalHeures} h{totaux.heuresIncompletes ? ' (partiel)' : ''}</span>
                    )}
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/formation/formations/${formationId}/niveaux/${n.id}`}>Gérer le programme</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Créer / modifier / dupliquer un niveau ── */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === 'edit' ? 'Modifier le niveau' : dialog?.kind === 'duplicate' ? 'Dupliquer le niveau' : 'Nouveau niveau'}
            </DialogTitle>
            {dialog?.kind === 'duplicate' && (
              <DialogDescription>
                Copie les matières, coefficients, volumes horaires et créneaux au choix de « {dialog.sourceName} » —
                celui-ci n'est pas modifié. Utile pour créer rapidement CAP 1 → CAP 2 → CAP 3.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="niveau-name">Nom *</Label>
              <Input id="niveau-name" placeholder="Ex : CAP 1, Cycle unique…" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="niveau-description">Description (optionnel)</Label>
              <Textarea id="niveau-description" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialog?.kind === 'edit' ? 'Enregistrer' : dialog?.kind === 'duplicate' ? 'Dupliquer' : 'Créer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation suppression ── */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce niveau ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ses matières enseignées et ses créneaux au choix seront supprimés. Le catalogue de matières de l'école
              (les noms) n'est pas touché. Cette action ne peut pas être défaite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDeleteId && void handleDelete(confirmDeleteId)}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FormationDetail;
