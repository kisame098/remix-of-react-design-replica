import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Loader2, Pencil, GraduationCap, Copy, Download, Upload, Clock, Layers, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type Formation, type NiveauMatiereType, type NiveauMatiereNature,
  TYPES_DIPLOME_SUGGERES, nomFormationValide, triFormations, resumeFormation,
  construireExport, analyserImport, peutGererMatieres,
} from '@/lib/formationPro';

/**
 * Page 1 du module Formations : la liste des formations de l'école. Une
 * formation regroupe ses niveaux (CAP 1, CAP 2…) — on clique dessus pour les
 * gérer (src/pages/formation/FormationDetail.tsx).
 */
const Formations = () => {
  const { accountRole } = useAuth();
  const estDirecteur = peutGererMatieres(accountRole);
  const {
    loading, formations, niveaux, niveauMatieres, choixGroups,
    addFormation, updateFormation, deleteFormation, duplicateFormation,
    addNiveau, addMatiereToNiveau, addChoixGroup, addChoixOption,
  } = useFormationPro();

  const formationsTriees = useMemo(() => triFormations(formations), [formations]);

  // ── Export / import ──────────────────────────────────────────────────────
  const handleExport = () => {
    const data = construireExport(formations, niveaux, niveauMatieres, choixGroups);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formations-senclass-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const importerFormations = async (data: ReturnType<typeof analyserImport>) => {
    if (!data) throw new Error("Fichier invalide — ce n'est pas un export de formations SenClass.");
    let nbFormations = 0, nbNiveaux = 0, nbMatieres = 0;
    const formationsExistantes = new Set(formations.map(f => f.name.trim().toLowerCase()));
    for (const f of data.formations) {
      if (formationsExistantes.has(f.name.trim().toLowerCase())) continue;   // formation déjà présente : on ne l'écrase jamais
      const nouvelleFormation = await addFormation({
        name: f.name, diplomaType: f.diplomaType, duration: f.duration, entryLevel: f.entryLevel, description: f.description,
      });
      nbFormations++;
      for (const n of f.niveaux) {
        const nouveauNiveau = await addNiveau(nouvelleFormation.id, { name: n.name, description: n.description });
        nbNiveaux++;
        for (const m of n.matieres) {
          await addMatiereToNiveau(nouveauNiveau.id, m.name, { type: m.type, coefficient: m.coefficient, volumeHoraire: m.volumeHoraire, nature: m.nature, categorie: m.categorie });
          nbMatieres++;
        }
        for (const g of n.choixGroups) {
          const groupe = await addChoixGroup(nouveauNiveau.id, { label: g.label, coefficient: g.coefficient });
          for (const opt of g.options) await addChoixOption(groupe.id, opt);
        }
      }
    }
    return { nbFormations, nbNiveaux, nbMatieres };
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const texte = await file.text();
      const data = analyserImport(JSON.parse(texte));
      const { nbFormations, nbNiveaux, nbMatieres } = await importerFormations(data);
      toast({ title: 'Import terminé', description: `${nbFormations} formation(s), ${nbNiveaux} niveau(x) et ${nbMatieres} matière(s) importés.` });
    } catch (err) {
      toast({ title: 'Import impossible', description: String(err instanceof Error ? err.message : err), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  // ── Modèles hôtellerie-restauration ─────────────────────────────────────
  const [modelesOuvert, setModelesOuvert] = useState(false);
  const [modelesSelectionnes, setModelesSelectionnes] = useState<Set<string>>(new Set());
  const [important, setImportantModeles] = useState(false);
  const toggleModele = (nom: string) => setModelesSelectionnes(prev => {
    const next = new Set(prev);
    if (next.has(nom)) next.delete(nom); else next.add(nom);
    return next;
  });
  const handleImporterModeles = async () => {
    const choisis = MODELES_IFHO.filter(m => modelesSelectionnes.has(m.name));
    if (choisis.length === 0) return;
    setImportantModeles(true);
    try {
      const data = { type: 'senclass_formation_pro_export' as const, version: 2 as const, exportedAt: new Date().toISOString(), formations: choisis };
      const { nbFormations, nbNiveaux, nbMatieres } = await importerFormations(data);
      toast({ title: 'Modèles ajoutés', description: `${nbFormations} formation(s), ${nbNiveaux} niveau(x), ${nbMatieres} matière(s) — entièrement modifiables.` });
      setModelesOuvert(false);
      setModelesSelectionnes(new Set());
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setImportantModeles(false);
    }
  };

  // ── Créer / modifier / dupliquer une formation ───────────────────────────
  type DialogState = { kind: 'create' } | { kind: 'edit'; formationId: string } | { kind: 'duplicate'; sourceId: string; sourceName: string };
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [name, setName] = useState('');
  const [diplomaType, setDiplomaType] = useState('');
  const [duration, setDuration] = useState('');
  const [entryLevel, setEntryLevel] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const remplirFormulaire = (f?: Partial<Formation>) => {
    setName(f?.name ?? ''); setDiplomaType(f?.diplomaType ?? ''); setDuration(f?.duration ?? '');
    setEntryLevel(f?.entryLevel ?? ''); setDescription(f?.description ?? '');
  };
  const resetForm = () => { remplirFormulaire(); setDialog(null); };
  const openCreate = () => { remplirFormulaire(); setDialog({ kind: 'create' }); };
  const openEdit = (f: Formation) => { remplirFormulaire(f); setDialog({ kind: 'edit', formationId: f.id }); };
  const openDuplicate = (f: Formation) => {
    // Le nom reste vide : on force à taper le nom de la NOUVELLE formation
    // (ex : « DAP Restauration »), jamais celui de l'originale par mégarde.
    remplirFormulaire({ ...f, name: undefined });
    setDialog({ kind: 'duplicate', sourceId: f.id, sourceName: f.name });
  };

  const handleSave = async () => {
    if (!dialog || !nomFormationValide(name)) {
      toast({ title: 'Erreur', description: 'Le nom de la formation est obligatoire.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const data = { name: name.trim(), diplomaType: diplomaType.trim() || undefined, duration: duration.trim() || undefined, entryLevel: entryLevel.trim() || undefined, description: description.trim() || undefined };
      if (dialog.kind === 'create') {
        await addFormation(data);
        toast({ title: 'Formation créée', description: data.name });
      } else if (dialog.kind === 'edit') {
        await updateFormation(dialog.formationId, data);
        toast({ title: 'Formation modifiée' });
      } else {
        await duplicateFormation(dialog.sourceId, data);
        toast({ title: 'Formation dupliquée', description: `« ${data.name} » créée avec le même contenu que « ${dialog.sourceName} » — l'originale n'a pas changé.` });
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
      await deleteFormation(id);
      toast({ title: 'Formation supprimée' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const toggleActive = async (f: Formation) => {
    try {
      await updateFormation(f.id, { active: !f.active });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Formations
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Le catalogue de votre école. Une formation (« CAP Restauration ») regroupe ses niveaux
            (« CAP 1 », « CAP 2 »…) — ouvrez-la pour les gérer.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={formations.length === 0}>
            <Download className="h-3.5 w-3.5" />Exporter
          </Button>
          {estDirecteur && (
            <>
              <input
                ref={fileInputRef} type="file" accept="application/json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); e.target.value = ''; }}
              />
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setModelesOuvert(true)}>
                Modèles hôtellerie-restauration
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Importer
              </Button>
            </>
          )}
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />Ajouter une formation
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />Chargement…
        </div>
      ) : formations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <GraduationCap className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucune formation créée</h3>
            <p className="text-muted-foreground mb-6">
              {estDirecteur
                ? "Créez votre première formation, ou partez d'un modèle hôtellerie-restauration à adapter."
                : "Créez votre première formation — demandez au directeur général d'importer un modèle si besoin."}
            </p>
            <div className="flex items-center justify-center gap-2">
              {estDirecteur && <Button variant="outline" onClick={() => setModelesOuvert(true)}>Voir les modèles</Button>}
              <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />Ajouter une formation</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {formationsTriees.map(f => {
            const niveauxDeLaFormation = niveaux.filter(n => n.formationId === f.id);
            const resume = resumeFormation(niveauxDeLaFormation, niveauMatieres, choixGroups);
            const isDeleting = deletingId === f.id;
            return (
              <Card key={f.id} className={`group h-full flex flex-col ${!f.active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate flex items-center gap-1.5">
                        <Link to={`/formation/formations/${f.id}`} className="hover:underline">{f.name}</Link>
                        {!f.active && <Badge variant="outline" className="gap-1 text-[10px]"><EyeOff className="h-2.5 w-2.5" />Inactive</Badge>}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {[f.diplomaType, f.duration].filter(Boolean).join(' · ') || '—'}
                      </p>
                      {f.entryLevel && <p className="text-xs text-muted-foreground truncate">Entrée : {f.entryLevel}</p>}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Modifier" onClick={() => openEdit(f)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Dupliquer" onClick={() => openDuplicate(f)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Supprimer"
                        disabled={isDeleting} onClick={() => setConfirmDeleteId(f.id)}
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  {f.description && <p className="text-xs text-muted-foreground/80 mt-1.5">{f.description}</p>}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
                    <Layers className="h-3 w-3" />
                    {resume.nbNiveaux} niveau{resume.nbNiveaux > 1 ? 'x' : ''} · {resume.nbMatieres} matière{resume.nbMatieres > 1 ? 's' : ''}
                    {resume.totalHeures > 0 && (
                      <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{resume.totalHeures} h</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link to={`/formation/formations/${f.id}`}>Gérer</Link>
                    </Button>
                    {estDirecteur && (
                      <Button variant="ghost" size="sm" onClick={() => void toggleActive(f)}>
                        {f.active ? 'Désactiver' : 'Activer'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Créer / modifier / dupliquer une formation ── */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === 'edit' ? 'Modifier la formation' : dialog?.kind === 'duplicate' ? 'Dupliquer la formation' : 'Nouvelle formation'}
            </DialogTitle>
            {dialog?.kind === 'duplicate' && (
              <DialogDescription>
                Copie tous les niveaux de « {dialog.sourceName} » (matières, coefficients, créneaux au choix) vers une
                formation neuve — « {dialog.sourceName} » n'est pas modifiée.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="formation-name">{dialog?.kind === 'duplicate' ? 'Nom de la nouvelle formation *' : 'Nom *'}</Label>
              <Input id="formation-name" placeholder="Ex : CAP Restauration" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formation-diplome">Type de diplôme (optionnel)</Label>
              <Input
                id="formation-diplome" placeholder="Ex : Diplôme d'État" value={diplomaType}
                onChange={e => setDiplomaType(e.target.value)} list="types-diplome"
              />
              <datalist id="types-diplome">
                {TYPES_DIPLOME_SUGGERES.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="formation-duree">Durée (optionnel)</Label>
                <Input id="formation-duree" placeholder="Ex : 3 ans, 6 mois…" value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="formation-entree">Niveau d'entrée (optionnel)</Label>
                <Input id="formation-entree" placeholder="Ex : CM2 à 4e secondaire" value={entryLevel} onChange={e => setEntryLevel(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="formation-description">Description (optionnel)</Label>
              <Textarea id="formation-description" placeholder="Ex : coefficients confirmés par le relevé DECPC 2022…" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
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
            <AlertDialogTitle>Supprimer cette formation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous ses niveaux, leurs matières et leurs créneaux au choix seront supprimés. Le catalogue de matières de
              l'école (les noms) n'est pas touché. Cette action ne peut pas être défaite.
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

      {/* ── Modèles hôtellerie-restauration ── */}
      <Dialog open={modelesOuvert} onOpenChange={(open) => { if (!open) { setModelesOuvert(false); setModelesSelectionnes(new Set()); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modèles hôtellerie-restauration</DialogTitle>
            <DialogDescription>
              Matières et coefficients d'une maquette pédagogique type — entièrement modifiables et supprimables une fois importés.
              Chaque modèle crée un premier niveau à dupliquer pour les années suivantes. Les coefficients « constatés » viennent
              d'un document officiel ; les autres sont proposés, à valider par votre établissement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {MODELES_IFHO.map(m => (
              <label key={m.name} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
                <input type="checkbox" className="mt-1" checked={modelesSelectionnes.has(m.name)} onChange={() => toggleModele(m.name)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              </label>
            ))}
          </div>
          <Button onClick={handleImporterModeles} className="w-full gap-2" disabled={important || modelesSelectionnes.size === 0}>
            {important && <Loader2 className="h-4 w-4 animate-spin" />}
            Importer {modelesSelectionnes.size > 0 ? `(${modelesSelectionnes.size})` : ''}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Modèles hôtellerie-restauration (maquette IFHO) ─────────────────────────
// Un modèle = une formation avec un premier niveau importable, exactement au
// format d'un export. Les coefficients du CAP sont confirmés par un relevé de
// notes officiel DECPC (session 2022) — signalé dans la description, jamais
// dans un calcul. Le premier niveau se duplique ensuite pour créer les
// années suivantes (CAP 1 → CAP 2 → CAP 3).
const MODELES_IFHO: {
  name: string; diplomaType?: string; duration?: string; entryLevel?: string; description: string;
  niveaux: { name: string; matieres: { name: string; type: NiveauMatiereType; coefficient: number; volumeHoraire?: number; nature: NiveauMatiereNature }[]; choixGroups: { label: string; coefficient: number; options: string[] }[] }[];
}[] = [
  {
    name: 'CAP Restauration', diplomaType: 'Diplôme d\'État', duration: '3 ans', entryLevel: 'CM2 à 4e secondaire',
    description: 'Coefficients confirmés par un relevé de notes officiel DECPC (session 2022).',
    niveaux: [{
      name: 'Niveau 1',
      matieres: [
        { name: 'Français', type: 'obligatoire', coefficient: 1, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Mathématiques', type: 'obligatoire', coefficient: 1, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Anglais', type: 'obligatoire', coefficient: 1, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Nutrition-Alimentation', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Technologie du matériel', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Entretien', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'TP / Technologie Pâtisserie', type: 'obligatoire', coefficient: 3, volumeHoraire: 90, nature: 'pratique' },
        { name: 'TP Cuisine', type: 'obligatoire', coefficient: 4, volumeHoraire: 150, nature: 'pratique' },
        { name: 'TP Restaurant', type: 'obligatoire', coefficient: 4, volumeHoraire: 150, nature: 'pratique' },
        { name: 'Conduite professionnelle', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      ],
      choixGroups: [],
    }],
  },
  {
    name: 'BEP Hôtellerie-Restauration', diplomaType: 'Diplôme d\'État', duration: '2 ans', entryLevel: 'BFEM requis',
    description: 'Coefficients en partie confirmés par un bulletin IFHO transmis ; les autres sont proposés, à valider auprès de la DECPC. Le total d\'heures indicatif transmis (1 035 h) diffère légèrement de la somme des matières.',
    niveaux: [{
      name: 'Niveau 1',
      matieres: [
        { name: 'Français / Communication', type: 'obligatoire', coefficient: 1, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Mathématiques', type: 'obligatoire', coefficient: 1, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Anglais', type: 'obligatoire', coefficient: 1, volumeHoraire: 45, nature: 'theorique' },
        { name: 'HSSE', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Droit professionnel', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Entrepreneuriat', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Nutrition-Alimentation', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Technologie du matériel', type: 'obligatoire', coefficient: 1, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Technologie Restaurant', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Technologie Cuisine', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Technologie Pâtisserie', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Réalisation d\'une entrée', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
        { name: 'TP Cuisine', type: 'obligatoire', coefficient: 3, volumeHoraire: 120, nature: 'pratique' },
        { name: 'TP Pâtisserie', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
        { name: 'TP Restaurant', type: 'obligatoire', coefficient: 3, volumeHoraire: 120, nature: 'pratique' },
        { name: 'Conduite professionnelle', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      ],
      choixGroups: [],
    }],
  },
  {
    name: 'BT Hôtellerie-Tourisme', diplomaType: 'Diplôme d\'État', duration: '2 ans', entryLevel: 'BAC requis',
    description: 'Coefficients proposés (maquette interne), à valider auprès de la DECPC.',
    niveaux: [{
      name: 'Niveau 1',
      matieres: [
        { name: 'Français', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Anglais', type: 'obligatoire', coefficient: 2, volumeHoraire: 90, nature: 'theorique' },
        { name: 'Mathématiques appliquées', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Informatique', type: 'obligatoire', coefficient: 1, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Communication professionnelle', type: 'obligatoire', coefficient: 1, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Technologie hôtelière', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Gestion hôtelière', type: 'obligatoire', coefficient: 3, volumeHoraire: 90, nature: 'theorique' },
        { name: 'Hébergement / Réception', type: 'obligatoire', coefficient: 3, volumeHoraire: 90, nature: 'pratique' },
        { name: 'Technologie Restaurant', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Technologie Cuisine', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Gestion de la restauration', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'HSSE', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Comptabilité / Gestion', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Géographie touristique', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Patrimoine culturel et touristique', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Techniques de guidage', type: 'obligatoire', coefficient: 3, volumeHoraire: 90, nature: 'pratique' },
        { name: 'Conception de circuits', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Agence de voyages / billetterie', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Tourisme durable', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Projet / stage professionnel', type: 'obligatoire', coefficient: 3, volumeHoraire: 120, nature: 'stage' },
      ],
      choixGroups: [],
    }],
  },
  {
    name: 'DTS Gestion Hôtelière', diplomaType: 'Diplôme de l\'établissement', duration: '2 ans', entryLevel: 'Terminale',
    description: 'Coefficients proposés (maquette interne), à valider auprès de la DECPC. Le total d\'heures indicatif transmis (1 525 h) diffère légèrement de la somme des matières.',
    niveaux: [{
      name: 'Niveau 1',
      matieres: [
        { name: 'Communication professionnelle', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Anglais professionnel', type: 'obligatoire', coefficient: 3, volumeHoraire: 90, nature: 'theorique' },
        { name: 'Informatique', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Comptabilité générale', type: 'obligatoire', coefficient: 3, volumeHoraire: 90, nature: 'theorique' },
        { name: 'Comptabilité analytique', type: 'obligatoire', coefficient: 3, volumeHoraire: 75, nature: 'theorique' },
        { name: 'Gestion financière', type: 'obligatoire', coefficient: 3, volumeHoraire: 75, nature: 'theorique' },
        { name: 'Contrôle de gestion', type: 'obligatoire', coefficient: 3, volumeHoraire: 75, nature: 'theorique' },
        { name: 'Gestion budgétaire', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Management hôtelier', type: 'obligatoire', coefficient: 3, volumeHoraire: 90, nature: 'theorique' },
        { name: 'Ressources humaines', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Gestion de l\'hébergement', type: 'obligatoire', coefficient: 3, volumeHoraire: 90, nature: 'pratique' },
        { name: 'Gestion de la restauration', type: 'obligatoire', coefficient: 3, volumeHoraire: 90, nature: 'pratique' },
        { name: 'Achats / stocks', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Marketing hôtelier', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Marketing digital', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Droit hôtelier / droit du travail', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
        { name: 'Gestion de la qualité', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Entrepreneuriat', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Projet / mémoire', type: 'obligatoire', coefficient: 3, volumeHoraire: 90, nature: 'theorique' },
        { name: 'Stage professionnel', type: 'obligatoire', coefficient: 4, volumeHoraire: 300, nature: 'stage' },
      ],
      choixGroups: [],
    }],
  },
  {
    name: 'DQP Polyvalent Restauration', diplomaType: 'Attestation', duration: '12 mois', entryLevel: undefined,
    description: 'Coefficients proposés (maquette interne), à valider auprès de la DECPC. Le total d\'heures indicatif transmis (815 h) diffère légèrement de la somme des matières.',
    niveaux: [{
      name: 'Cycle unique',
      matieres: [
        { name: 'Hygiène et sécurité alimentaire', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Technologie alimentaire', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Technologie du matériel', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Cuisine', type: 'obligatoire', coefficient: 3, volumeHoraire: 120, nature: 'pratique' },
        { name: 'Pâtisserie', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Restaurant / service', type: 'obligatoire', coefficient: 3, volumeHoraire: 100, nature: 'pratique' },
        { name: 'Bar et boissons', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Fast-food / restauration rapide', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Nutrition-Alimentation', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Approvisionnement / stockage', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Nettoyage / entretien', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Accueil / relation client', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Calcul professionnel', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Communication professionnelle', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Stage / pratique professionnelle', type: 'obligatoire', coefficient: 3, volumeHoraire: 120, nature: 'stage' },
      ],
      choixGroups: [],
    }],
  },
  {
    name: 'CPS Pâtissier', diplomaType: 'Attestation', duration: '6 mois', entryLevel: undefined,
    description: 'Coefficients proposés (maquette interne), à valider auprès de la DECPC.',
    niveaux: [{
      name: 'Cycle unique',
      matieres: [
        { name: 'Hygiène et sécurité alimentaire', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Technologie pâtisserie', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Technologie matériel', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Matières premières', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Pâtes de base', type: 'obligatoire', coefficient: 3, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Crèmes et garnitures', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Gâteaux / entremets', type: 'obligatoire', coefficient: 3, volumeHoraire: 75, nature: 'pratique' },
        { name: 'Tartes / tartelettes', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Biscuits / petits fours', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Viennoiserie', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Décoration / finition', type: 'obligatoire', coefficient: 3, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Pâtisserie africaine / sénégalaise', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Calcul des coûts', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Organisation du laboratoire', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Épreuve pratique professionnelle', type: 'obligatoire', coefficient: 4, volumeHoraire: 90, nature: 'stage' },
      ],
      choixGroups: [],
    }],
  },
  {
    name: 'CPS Cuisinier', diplomaType: 'Attestation', duration: '6 mois', entryLevel: undefined,
    description: 'Coefficients proposés (maquette interne), à valider auprès de la DECPC. Le total d\'heures indicatif transmis (835 h) diffère légèrement de la somme des matières.',
    niveaux: [{
      name: 'Cycle unique',
      matieres: [
        { name: 'Hygiène et sécurité alimentaire', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Technologie cuisine', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Technologie matériel', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Connaissance des produits', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Techniques de découpe', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Techniques de cuisson', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Fonds / sauces', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Entrées', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Viandes / volailles', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Poissons / fruits de mer', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Légumes / garnitures', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Riz / céréales / légumineuses', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Cuisine sénégalaise', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Cuisine africaine / internationale', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Dressage / présentation', type: 'obligatoire', coefficient: 2, volumeHoraire: 30, nature: 'pratique' },
        { name: 'Gestion des stocks', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Calcul des coûts', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Épreuve pratique cuisine', type: 'obligatoire', coefficient: 4, volumeHoraire: 120, nature: 'stage' },
      ],
      choixGroups: [],
    }],
  },
  {
    name: 'CPS Serveur / Barman', diplomaType: 'Attestation', duration: '6 mois', entryLevel: undefined,
    description: 'Coefficients proposés (maquette interne), à valider auprès de la DECPC.',
    niveaux: [{
      name: 'Cycle unique',
      matieres: [
        { name: 'Hygiène et sécurité', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Technologie restaurant', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Mise en place', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Arts de la table', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Techniques de service', type: 'obligatoire', coefficient: 3, volumeHoraire: 75, nature: 'pratique' },
        { name: 'Prise de commande', type: 'obligatoire', coefficient: 2, volumeHoraire: 30, nature: 'pratique' },
        { name: 'Service des mets', type: 'obligatoire', coefficient: 3, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Service des boissons', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Technologie du bar', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Cocktails / boissons sans alcool', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Accueil / relation client', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Communication professionnelle', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Anglais professionnel', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Gestion des stocks du bar', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Facturation / calcul', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Épreuve pratique restaurant/bar', type: 'obligatoire', coefficient: 4, volumeHoraire: 90, nature: 'stage' },
      ],
      choixGroups: [],
    }],
  },
  {
    name: 'EQM — Employé Qualifié de Maison', diplomaType: 'Attestation', duration: 'variable', entryLevel: undefined,
    description: 'Coefficients proposés (maquette interne), à valider auprès de la DECPC.',
    niveaux: [{
      name: 'Cycle unique',
      matieres: [
        { name: 'Hygiène et sécurité', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Techniques de nettoyage', type: 'obligatoire', coefficient: 3, volumeHoraire: 75, nature: 'pratique' },
        { name: 'Produits / matériels d\'entretien', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
        { name: 'Entretien des chambres', type: 'obligatoire', coefficient: 3, volumeHoraire: 75, nature: 'pratique' },
        { name: 'Entretien des sanitaires', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Espaces communs', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Linge : lavage / tri / entretien', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Repassage / rangement', type: 'obligatoire', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
        { name: 'Cuisine familiale de base', type: 'obligatoire', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
        { name: 'Préparation / service à table', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'pratique' },
        { name: 'Conservation des aliments', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Approvisionnement / courses', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Organisation du travail', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Communication professionnelle', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Sécurité domestique / premiers secours', type: 'obligatoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
        { name: 'Épreuve pratique professionnelle', type: 'obligatoire', coefficient: 4, volumeHoraire: 90, nature: 'stage' },
      ],
      choixGroups: [],
    }],
  },
];

export default Formations;
