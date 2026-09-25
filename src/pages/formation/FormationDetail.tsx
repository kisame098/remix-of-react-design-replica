import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Plus, Trash2, Loader2, Pencil, Layers, Copy, Clock, ShieldAlert, Percent } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type Niveau, type BaremeCategorie, nomNiveauValide, triNiveaux, totauxNiveau,
  peutGererMatieres, nomCategorieValide, pourcentageValide, sommeBareme, baremeComplet,
  LIBELLES_SOURCE_CATEGORIE, type TypeExamen,
} from '@/lib/formationPro';

/**
 * Page 2 du module Formations : les niveaux d'UNE formation (« CAP 1 »,
 * « CAP 2 »… ou « Cycle unique »). On clique sur un niveau pour gérer son
 * programme pédagogique (src/pages/formation/NiveauProgramme.tsx).
 */
const FormationDetail = () => {
  const { formationId } = useParams<{ formationId: string }>();
  const navigate = useNavigate();
  const { accountRole } = useAuth();
  const estDirecteur = peutGererMatieres(accountRole);
  const {
    loading, formations, niveaux, niveauMatieres, choixGroups, baremeCategories, evaluations,
    addNiveau, updateNiveau, deleteNiveau, duplicateNiveau,
    addBaremeCategorie, updateBaremeCategorie, deleteBaremeCategorie, appliquerBaremeParDefaut,
  } = useFormationPro();

  const formation = formations.find(f => f.id === formationId);
  const niveauxTries = useMemo(
    () => triNiveaux(niveaux.filter(n => n.formationId === formationId)),
    [niveaux, formationId],
  );
  const bareme = useMemo(
    () => baremeCategories.filter(c => c.formationId === formationId).sort((a, b) => a.ordering - b.ordering),
    [baremeCategories, formationId],
  );

  // ── Barème d'évaluation (catégories, réservé au directeur) ────────────────
  type DialogBareme = { kind: 'create' } | { kind: 'edit'; categorieId: string };
  const [dialogBareme, setDialogBareme] = useState<DialogBareme | null>(null);
  const [catName, setCatName] = useState('');
  const [catPourcentage, setCatPourcentage] = useState('');
  // D'où viennent les notes : saisies dans Évaluations, ou reprises des examens.
  const [catSource, setCatSource] = useState<'saisie' | TypeExamen>('saisie');
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null);

  const resetCatForm = () => { setCatName(''); setCatPourcentage(''); setCatSource('saisie'); setDialogBareme(null); };
  const openCreateCat = () => { setCatName(''); setCatPourcentage(''); setCatSource('saisie'); setDialogBareme({ kind: 'create' }); };
  const openEditCat = (c: BaremeCategorie) => {
    setCatName(c.name); setCatPourcentage(String(c.pourcentage)); setCatSource(c.sourceExamen ?? 'saisie');
    setDialogBareme({ kind: 'edit', categorieId: c.id });
  };

  const handleSaveCat = async () => {
    const pourcentage = Number(catPourcentage);
    if (!dialogBareme || !formationId || !nomCategorieValide(catName) || !pourcentageValide(pourcentage)) {
      toast({ title: 'Erreur', description: 'Le nom et un pourcentage entre 1 et 100 sont obligatoires.', variant: 'destructive' });
      return;
    }
    const sourceExamen = catSource === 'saisie' ? null : catSource;
    // Une seule catégorie par type d'examen : sinon on ne saurait pas où ranger ses notes.
    const doublon = sourceExamen && bareme.find(c => c.sourceExamen === sourceExamen && (dialogBareme.kind === 'create' || c.id !== dialogBareme.categorieId));
    if (doublon) {
      toast({ title: 'Déjà utilisé', description: `« ${doublon.name} » reprend déjà ces notes d'examen : une seule catégorie par type d'examen.`, variant: 'destructive' });
      return;
    }
    setIsSavingCat(true);
    try {
      if (dialogBareme.kind === 'create') {
        await addBaremeCategorie(formationId, { name: catName.trim(), pourcentage, sourceExamen });
        toast({ title: 'Catégorie ajoutée', description: catName });
      } else {
        await updateBaremeCategorie(dialogBareme.categorieId, { name: catName.trim(), pourcentage, sourceExamen });
        toast({ title: 'Catégorie modifiée' });
      }
      resetCatForm();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingCat(false);
    }
  };

  // La base refuse de supprimer une catégorie encore utilisée (sinon ses notes
  // ne compteraient plus nulle part) : on le dit clairement avant d'essayer.
  const nbEvaluationsCat = (id: string) => evaluations.filter(e => e.categorieId === id).length;
  const handleDeleteCat = async (id: string) => {
    const nb = nbEvaluationsCat(id);
    if (nb > 0) {
      toast({
        title: 'Catégorie utilisée',
        description: `${nb} évaluation${nb > 1 ? 's' : ''} ${nb > 1 ? 'sont' : 'est'} rangée${nb > 1 ? 's' : ''} dans cette catégorie. Supprimez-les d'abord dans Évaluations, ou renommez la catégorie.`,
        variant: 'destructive',
      });
      setConfirmDeleteCatId(null);
      return;
    }
    try {
      await deleteBaremeCategorie(id);
      toast({ title: 'Catégorie supprimée' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setConfirmDeleteCatId(null);
    }
  };

  const somme = sommeBareme(bareme);
  const complet = baremeComplet(bareme);

  const [isApplyingDefaut, setIsApplyingDefaut] = useState(false);
  const handleAppliquerDefaut = async () => {
    if (!formationId) return;
    setIsApplyingDefaut(true);
    try {
      await appliquerBaremeParDefaut(formationId);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsApplyingDefaut(false);
    }
  };

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

      {/* ── Formule d'évaluation : réservée au directeur ── */}
      {estDirecteur && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Percent className="h-4 w-4" />Formule d'évaluation</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Les catégories de notes de cette formation (contrôle continu, TP, examen…) et leur poids dans la moyenne. Réservé au directeur.
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-2" onClick={openCreateCat}>
                <Plus className="h-3.5 w-3.5" />Ajouter une catégorie
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {bareme.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Aucune catégorie définie — les moyennes ne peuvent pas encore être calculées.
                </p>
                <Button size="sm" variant="outline" className="gap-2" disabled={isApplyingDefaut} onClick={handleAppliquerDefaut}>
                  {isApplyingDefaut && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Utiliser la formule courante (contrôle continu 30 % · TP 30 % · examen blanc 10 % · examen final 30 %)
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {bareme.map(c => (
                  <div key={c.id} className="group flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className={`block text-xs ${c.sourceExamen ? 'text-primary' : 'text-muted-foreground'}`}>
                        {LIBELLES_SOURCE_CATEGORIE[c.sourceExamen ?? 'saisie']}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{c.pourcentage} %</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Modifier" onClick={() => openEditCat(c)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Supprimer"
                          onClick={() => setConfirmDeleteCatId(c.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <p className={`text-xs pt-1 ${complet ? 'text-muted-foreground' : 'text-destructive'}`}>
                  Total : {somme} % {complet ? '' : '— doit faire 100 % pour que les moyennes soient justes'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogBareme !== null} onOpenChange={(open) => !open && resetCatForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogBareme?.kind === 'edit' ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nom *</Label>
              <Input id="cat-name" placeholder="Ex : Contrôle continu, TP, Examen final…" value={catName} onChange={e => setCatName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-pourcentage">Pourcentage dans la moyenne *</Label>
              <Input id="cat-pourcentage" type="number" min={1} max={100} value={catPourcentage} onChange={e => setCatPourcentage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Les notes viennent de</Label>
              <Select value={catSource} onValueChange={v => setCatSource(v as 'saisie' | TypeExamen)}>
                <SelectTrigger aria-label="Source des notes"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LIBELLES_SOURCE_CATEGORIE) as ('saisie' | TypeExamen)[]).map(k => (
                    <SelectItem key={k} value={k}>{LIBELLES_SOURCE_CATEGORIE[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Une catégorie reprise des examens n'a pas de colonne dans Évaluations : ses notes se saisissent une seule fois, dans la rubrique Examens.
              </p>
            </div>
            <Button onClick={handleSaveCat} className="w-full" disabled={isSavingCat}>
              {isSavingCat && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialogBareme?.kind === 'edit' ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDeleteCatId} onOpenChange={(open) => !open && setConfirmDeleteCatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDeleteCatId && nbEvaluationsCat(confirmDeleteCatId) > 0
                ? `Impossible : ${nbEvaluationsCat(confirmDeleteCatId)} évaluation(s) l'utilisent encore. Supprimez-les d'abord dans Évaluations, ou renommez plutôt la catégorie.`
                : 'Aucune évaluation ne l\'utilise : elle disparaît simplement de la formule.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDeleteCatId && void handleDeleteCat(confirmDeleteCatId)}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

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
