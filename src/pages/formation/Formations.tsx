import { useMemo, useRef, useState } from 'react';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, Loader2, Pencil, GraduationCap, Copy, Download, Upload, Clock, Lock,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type FormationBloc, type FormationMatiere, type FormationMatiereType, type FormationMatiereNature,
  NATURE_LABELS, totauxBloc, nomBlocValide, coefficientValide, volumeHoraireValide, nomMatiereDejaPris,
  libelleBloc, triBlocs, construireExport, analyserImport, peutModifierCoefficients,
} from '@/lib/formationPro';

type RowKind = 'obligatoire' | 'facultative' | 'choix';
type EditTarget =
  | { kind: 'obligatoire' | 'facultative'; row: FormationMatiere }
  | { kind: 'choix'; row: { id: string; label: string; coefficient: number; options: { id: string; subjectName: string }[] } };

const Formations = () => {
  const { accountRole } = useAuth();
  const estDirecteur = peutModifierCoefficients(accountRole);
  const {
    loading, blocs, matieres, choixGroups,
    addBloc, updateBloc, deleteBloc, duplicateBloc,
    addMatiere, updateMatiere, deleteMatiere,
    addChoixGroup, updateChoixGroup, deleteChoixGroup, addChoixOption, deleteChoixOption,
  } = useFormationPro();

  const blocsTries = useMemo(() => triBlocs(blocs), [blocs]);

  // ── Export / import ──────────────────────────────────────────────────────
  const handleExport = () => {
    const data = construireExport(blocs, matieres, choixGroups);
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

  const importerBlocs = async (data: ReturnType<typeof analyserImport>) => {
    if (!data) throw new Error("Fichier invalide — ce n'est pas un export de formations SenClass.");
    let nbBlocs = 0, nbMatieres = 0;
    const existants = new Set(blocs.map(b => `${b.formationName.trim().toLowerCase()}::${b.anneeLabel.trim().toLowerCase()}`));
    for (const b of data.blocs) {
      const cle = `${b.formationName.trim().toLowerCase()}::${b.anneeLabel.trim().toLowerCase()}`;
      if (existants.has(cle)) continue;   // bloc déjà présent : on ne l'écrase jamais
      const nouveau = await addBloc({ formationName: b.formationName, anneeLabel: b.anneeLabel, diplome: b.diplome, duree: b.duree, description: b.description });
      nbBlocs++;
      for (const m of b.matieres) {
        await addMatiere(nouveau.id, { type: m.type, name: m.name, coefficient: m.coefficient, volumeHoraire: m.volumeHoraire, nature: m.nature });
        nbMatieres++;
      }
      for (const g of b.choixGroups) {
        const groupe = await addChoixGroup(nouveau.id, { label: g.label, coefficient: g.coefficient });
        for (const opt of g.options) await addChoixOption(groupe.id, opt);
      }
    }
    return { nbBlocs, nbMatieres };
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const texte = await file.text();
      const data = analyserImport(JSON.parse(texte));
      const { nbBlocs, nbMatieres } = await importerBlocs(data);
      toast({ title: 'Import terminé', description: `${nbBlocs} bloc(s) et ${nbMatieres} matière(s) importé(s).` });
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
    const choisis = MODELES_IFHO.filter(m => modelesSelectionnes.has(m.formationName));
    if (choisis.length === 0) return;
    setImportantModeles(true);
    try {
      const data = { type: 'senclass_formation_pro_export' as const, version: 1 as const, exportedAt: new Date().toISOString(), blocs: choisis };
      const { nbBlocs, nbMatieres } = await importerBlocs(data);
      toast({ title: 'Modèles ajoutés', description: `${nbBlocs} bloc(s) et ${nbMatieres} matière(s) — entièrement modifiables.` });
      setModelesOuvert(false);
      setModelesSelectionnes(new Set());
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setImportantModeles(false);
    }
  };

  // ── Créer / modifier / dupliquer un bloc ─────────────────────────────────
  type BlocDialogState = { kind: 'create' } | { kind: 'edit'; blocId: string } | { kind: 'duplicate'; sourceId: string };
  const [blocDialog, setBlocDialog] = useState<BlocDialogState | null>(null);
  const [formationName, setFormationName] = useState('');
  const [anneeLabel, setAnneeLabel] = useState('');
  const [diplome, setDiplome] = useState('');
  const [duree, setDuree] = useState('');
  const [description, setDescription] = useState('');
  const [isSavingBloc, setIsSavingBloc] = useState(false);

  const resetBlocForm = () => { setFormationName(''); setAnneeLabel(''); setDiplome(''); setDuree(''); setDescription(''); setBlocDialog(null); };
  const openCreateBloc = () => { setFormationName(''); setAnneeLabel(''); setDiplome(''); setDuree(''); setDescription(''); setBlocDialog({ kind: 'create' }); };
  const openEditBloc = (bloc: FormationBloc) => {
    setFormationName(bloc.formationName); setAnneeLabel(bloc.anneeLabel);
    setDiplome(bloc.diplome ?? ''); setDuree(bloc.duree ?? ''); setDescription(bloc.description ?? '');
    setBlocDialog({ kind: 'edit', blocId: bloc.id });
  };
  const openDuplicateBloc = (bloc: FormationBloc) => {
    setFormationName(bloc.formationName); setAnneeLabel('');
    setDiplome(bloc.diplome ?? ''); setDuree(bloc.duree ?? ''); setDescription(bloc.description ?? '');
    setBlocDialog({ kind: 'duplicate', sourceId: bloc.id });
  };

  const handleSaveBloc = async () => {
    if (!blocDialog || !nomBlocValide(formationName, anneeLabel)) {
      toast({ title: 'Erreur', description: 'Le nom de la formation et le libellé de l\'année sont obligatoires.', variant: 'destructive' });
      return;
    }
    setIsSavingBloc(true);
    try {
      const data = { formationName: formationName.trim(), anneeLabel: anneeLabel.trim(), diplome: diplome.trim() || undefined, duree: duree.trim() || undefined, description: description.trim() || undefined };
      if (blocDialog.kind === 'create') {
        await addBloc(data);
        toast({ title: 'Bloc créé', description: libelleBloc(data) });
      } else if (blocDialog.kind === 'edit') {
        await updateBloc(blocDialog.blocId, data);
        toast({ title: 'Bloc modifié' });
      } else {
        const nouveau = await duplicateBloc(blocDialog.sourceId, data);
        toast({ title: 'Bloc dupliqué', description: `« ${libelleBloc(nouveau)} » créé avec le même contenu — l'original n'a pas changé.` });
      }
      resetBlocForm();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingBloc(false);
    }
  };

  const [deletingBlocId, setDeletingBlocId] = useState<string | null>(null);
  const [confirmDeleteBlocId, setConfirmDeleteBlocId] = useState<string | null>(null);
  const handleDeleteBloc = async (id: string) => {
    setDeletingBlocId(id);
    try {
      await deleteBloc(id);
      toast({ title: 'Bloc supprimé' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingBlocId(null);
      setConfirmDeleteBlocId(null);
    }
  };

  // ── Dialogue unifié « Ajouter / Modifier une matière » ──────────────────
  const [rowDialogBlocId, setRowDialogBlocId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [rowType, setRowType] = useState<RowKind>('obligatoire');
  const [rowName, setRowName] = useState('');
  const [rowCoef, setRowCoef] = useState('1');
  const [rowVolume, setRowVolume] = useState('');
  const [rowNature, setRowNature] = useState<FormationMatiereNature>('theorique');
  const [existingOptions, setExistingOptions] = useState<{ id: string; name: string }[]>([]);
  const [newOptionNames, setNewOptionNames] = useState<string[]>(['', '']);
  const [savingRow, setSavingRow] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);

  const openAddRow = (blocId: string) => {
    setRowDialogBlocId(blocId); setEditTarget(null);
    setRowType('obligatoire'); setRowName(''); setRowCoef('1'); setRowVolume(''); setRowNature('theorique');
    setExistingOptions([]); setNewOptionNames(['', '']);
  };
  // Le personnel ne fixe jamais un coefficient : le champ reste à 1 pour une
  // nouvelle matière, à ajuster par le directeur général ensuite.
  const rowCoefEffectif = estDirecteur ? rowCoef : (editTarget?.row.coefficient != null ? String(editTarget.row.coefficient) : '1');
  const openEditRow = (blocId: string, target: EditTarget) => {
    setRowDialogBlocId(blocId); setEditTarget(target);
    if (target.kind === 'choix') {
      setRowType('choix'); setRowName(target.row.label); setRowCoef(String(target.row.coefficient));
      setRowVolume(''); setRowNature('theorique');
      setExistingOptions(target.row.options.map(o => ({ id: o.id, name: o.subjectName })));
      setNewOptionNames(['', '']);
    } else {
      setRowType(target.kind); setRowName(target.row.name); setRowCoef(String(target.row.coefficient));
      setRowVolume(target.row.volumeHoraire != null ? String(target.row.volumeHoraire) : ''); setRowNature(target.row.nature);
      setExistingOptions([]); setNewOptionNames(['', '']);
    }
  };
  const closeRowDialog = () => { setRowDialogBlocId(null); setEditTarget(null); };

  const handleSaveRow = async () => {
    const blocId = rowDialogBlocId;
    if (!blocId || !rowName.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est obligatoire.', variant: 'destructive' });
      return;
    }
    const coef = parseFloat(rowCoefEffectif.replace(',', '.'));
    if (!coefficientValide(coef)) {
      toast({ title: 'Erreur', description: 'Le coefficient doit être un nombre supérieur à 0.', variant: 'destructive' });
      return;
    }
    const volume = rowVolume.trim() === '' ? undefined : parseFloat(rowVolume.replace(',', '.'));
    if (!volumeHoraireValide(volume)) {
      toast({ title: 'Erreur', description: 'Le volume horaire doit être un nombre positif (ou vide).', variant: 'destructive' });
      return;
    }
    if (rowType !== 'choix' && nomMatiereDejaPris(matieres, rowName, blocId, editTarget?.kind !== 'choix' ? editTarget?.row.id : undefined)) {
      toast({ title: 'Erreur', description: 'Une matière porte déjà ce nom dans ce bloc.', variant: 'destructive' });
      return;
    }
    setSavingRow(true);
    try {
      if (rowType === 'choix') {
        if (editTarget?.kind === 'choix') {
          await updateChoixGroup(editTarget.row.id, { label: rowName.trim(), coefficient: coef });
          const removedIds = editTarget.row.options.map(o => o.id).filter(id => !existingOptions.some(e => e.id === id));
          for (const id of removedIds) await deleteChoixOption(id);
          for (const n of newOptionNames.map(n => n.trim()).filter(Boolean)) await addChoixOption(editTarget.row.id, n);
        } else {
          const groupe = await addChoixGroup(blocId, { label: rowName.trim(), coefficient: coef });
          for (const n of newOptionNames.map(n => n.trim()).filter(Boolean)) await addChoixOption(groupe.id, n);
        }
      } else if (editTarget && editTarget.kind !== 'choix') {
        await updateMatiere(editTarget.row.id, { type: rowType, name: rowName.trim(), coefficient: coef, volumeHoraire: volume, nature: rowNature });
      } else {
        await addMatiere(blocId, { type: rowType, name: rowName.trim(), coefficient: coef, volumeHoraire: volume, nature: rowNature });
      }
      closeRowDialog();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setSavingRow(false);
    }
  };

  const handleDeleteRow = async (target: EditTarget) => {
    setDeletingRowId(target.row.id);
    try {
      if (target.kind === 'choix') await deleteChoixGroup(target.row.id);
      else await deleteMatiere(target.row.id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingRowId(null);
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Formations
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Le catalogue de votre école : chaque bloc est le programme d'UNE année d'UNE formation
            (ex : « CAP Restauration — Année 1 »). Dupliquez un bloc pour créer l'année suivante — l'original
            n'est jamais modifié.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={blocs.length === 0}>
            <Download className="h-3.5 w-3.5" />Exporter
          </Button>
          {/* Importer un fichier ou un modèle fixe des coefficients en bloc — même
              restriction que le formulaire, pour qu'un import ne serve pas à la
              contourner. */}
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
          <Button size="sm" className="gap-2" onClick={openCreateBloc}>
            <Plus className="h-3.5 w-3.5" />Nouveau bloc
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />Chargement…
        </div>
      ) : blocsTries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <GraduationCap className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucune formation créée</h3>
            <p className="text-muted-foreground mb-6">
              {estDirecteur
                ? "Créez votre premier bloc, ou partez d'un modèle hôtellerie-restauration à adapter."
                : "Créez votre premier bloc — demandez au directeur général d'importer un modèle si besoin."}
            </p>
            <div className="flex items-center justify-center gap-2">
              {estDirecteur && <Button variant="outline" onClick={() => setModelesOuvert(true)}>Voir les modèles</Button>}
              <Button onClick={openCreateBloc} className="gap-2"><Plus className="h-4 w-4" />Nouveau bloc</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {blocsTries.map(bloc => {
            const mats = matieres.filter(m => m.blocId === bloc.id).sort((a, b) => a.ordering - b.ordering);
            const choix = choixGroups.filter(c => c.blocId === bloc.id).sort((a, b) => a.ordering - b.ordering);
            const totaux = totauxBloc(mats, choix);
            const obligatoires = mats.filter(m => m.type === 'obligatoire');
            const facultatives = mats.filter(m => m.type === 'facultative');
            const isDeleting = deletingBlocId === bloc.id;

            const renderMatiere = (m: FormationMatiere) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm group/row">
                <span className="truncate flex items-center gap-1.5">
                  {m.name}
                  {m.nature !== 'theorique' && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 border rounded px-1">{NATURE_LABELS[m.nature]}</span>
                  )}
                </span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-muted-foreground text-xs">
                    coef {m.coefficient}{m.volumeHoraire != null ? ` · ${m.volumeHoraire} h` : ''}
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100" aria-label={`Modifier ${m.name}`} onClick={() => openEditRow(bloc.id, { kind: m.type, row: m })}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
                    disabled={deletingRowId === m.id} onClick={() => void handleDeleteRow({ kind: m.type, row: m })}
                  >
                    {deletingRowId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </span>
              </li>
            );

            return (
              <Card key={bloc.id} className="group h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{bloc.formationName}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{bloc.anneeLabel}{bloc.diplome ? ` · ${bloc.diplome}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Modifier" onClick={() => openEditBloc(bloc)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Dupliquer vers une autre année" onClick={() => openDuplicateBloc(bloc)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Supprimer ce bloc"
                        disabled={isDeleting} onClick={() => setConfirmDeleteBlocId(bloc.id)}
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  {bloc.description && <p className="text-xs text-muted-foreground/80 mt-1.5">{bloc.description}</p>}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1 space-y-3">
                    {mats.length === 0 && choix.length === 0 ? (
                      <p className="text-sm text-muted-foreground/70 italic">Aucune matière définie</p>
                    ) : (
                      <>
                        {obligatoires.length > 0 && <ul className="space-y-1.5">{obligatoires.map(renderMatiere)}</ul>}
                        {facultatives.length > 0 && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold mb-1.5">Facultatif</p>
                            <ul className="space-y-1.5">{facultatives.map(renderMatiere)}</ul>
                          </div>
                        )}
                        {choix.length > 0 && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold mb-1.5">Au choix (options)</p>
                            <ul className="space-y-1.5">
                              {choix.map(g => (
                                <li key={g.id} className="text-sm group/row">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">{g.label}</span>
                                    <span className="flex items-center gap-1 flex-shrink-0">
                                      <span className="text-muted-foreground text-xs">coef {g.coefficient}</span>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100" onClick={() => openEditRow(bloc.id, { kind: 'choix', row: g })}>
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
                                        disabled={deletingRowId === g.id} onClick={() => void handleDeleteRow({ kind: 'choix', row: g })}
                                      >
                                        {deletingRowId === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                      </Button>
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground/80">{g.options.map(o => o.subjectName).join(' / ') || 'Aucune option'}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {totaux.nbMatieres > 0 && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                      {totaux.nbMatieres} matière{totaux.nbMatieres > 1 ? 's' : ''} · {totaux.totalCoef} coef.
                      {totaux.totalHeures > 0 && (
                        <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{totaux.totalHeures} h{totaux.heuresIncompletes ? ' (partiel)' : ''}</span>
                      )}
                    </p>
                  )}
                  <Button variant="outline" size="sm" className="w-full gap-1.5 mt-3" onClick={() => openAddRow(bloc.id)}>
                    <Plus className="h-3.5 w-3.5" />Ajouter une matière
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Créer / modifier / dupliquer un bloc ── */}
      <Dialog open={blocDialog !== null} onOpenChange={(open) => !open && resetBlocForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {blocDialog?.kind === 'edit' ? 'Modifier le bloc' : blocDialog?.kind === 'duplicate' ? 'Dupliquer le bloc' : 'Nouveau bloc'}
            </DialogTitle>
            {blocDialog?.kind === 'duplicate' && (
              <DialogDescription>Copie les matières et créneaux au choix du bloc d'origine — celui-ci n'est pas modifié.</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Formation *</Label>
              <Input placeholder="Ex : CAP Restauration" value={formationName} onChange={e => setFormationName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Année / cycle *</Label>
              <Input placeholder="Ex : Année 1, Cycle unique…" value={anneeLabel} onChange={e => setAnneeLabel(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Diplôme (optionnel)</Label>
                <Input placeholder="Ex : Diplôme d'État" value={diplome} onChange={e => setDiplome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Durée (optionnel)</Label>
                <Input placeholder="Ex : 3 ans, 6 mois…" value={duree} onChange={e => setDuree(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (optionnel)</Label>
              <Textarea placeholder="Ex : coefficients confirmés par le relevé DECPC 2022…" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <Button onClick={handleSaveBloc} className="w-full" disabled={isSavingBloc}>
              {isSavingBloc && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {blocDialog?.kind === 'edit' ? 'Enregistrer' : blocDialog?.kind === 'duplicate' ? 'Dupliquer' : 'Créer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation suppression d'un bloc ── */}
      <AlertDialog open={!!confirmDeleteBlocId} onOpenChange={(open) => !open && setConfirmDeleteBlocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bloc ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le bloc et toutes ses matières et créneaux au choix seront supprimés. Cette action ne peut pas être défaite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDeleteBlocId && void handleDeleteBloc(confirmDeleteBlocId)}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialogue ajout/édition d'une matière ── */}
      <Dialog open={rowDialogBlocId !== null} onOpenChange={(open) => !open && closeRowDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Modifier' : 'Ajouter'} une matière</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <RadioGroup value={rowType} onValueChange={(v: RowKind) => setRowType(v)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="obligatoire" id="type-obl" /><Label htmlFor="type-obl">Obligatoire</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="facultative" id="type-fac" /><Label htmlFor="type-fac">Facultative</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="choix" id="type-choix" /><Label htmlFor="type-choix">Au choix</Label>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label>{rowType === 'choix' ? 'Libellé du créneau (ex : LV2)' : 'Nom de la matière'} *</Label>
              <Input value={rowName} onChange={e => setRowName(e.target.value)} placeholder={rowType === 'choix' ? 'Ex : Option' : 'Ex : TP Cuisine'} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="row-coefficient" className="flex items-center gap-1.5">
                  Coefficient *
                  {!estDirecteur && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Input
                  id="row-coefficient" type="number" min="0.5" step="0.5" value={rowCoefEffectif}
                  disabled={!estDirecteur}
                  onChange={e => setRowCoef(e.target.value)}
                />
                {!estDirecteur && (
                  <p className="text-xs text-muted-foreground">Réservé au directeur général.</p>
                )}
              </div>
              {rowType !== 'choix' && (
                <div className="space-y-2">
                  <Label>Volume horaire (optionnel)</Label>
                  <Input type="number" min="0" step="5" placeholder="Ex : 150" value={rowVolume} onChange={e => setRowVolume(e.target.value)} />
                </div>
              )}
            </div>

            {rowType !== 'choix' && (
              <div className="space-y-2">
                <Label>Nature</Label>
                <Select value={rowNature} onValueChange={(v: FormationMatiereNature) => setRowNature(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(NATURE_LABELS) as FormationMatiereNature[]).map(n => (
                      <SelectItem key={n} value={n}>{NATURE_LABELS[n]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {rowType === 'choix' && (
              <div className="space-y-2">
                <Label>Options (ex : Cuisine, Pâtisserie, Restaurant-bar…)</Label>
                {existingOptions.length > 0 && (
                  <ul className="space-y-1">
                    {existingOptions.map(o => (
                      <li key={o.id} className="flex items-center justify-between text-sm bg-muted/40 rounded px-2 py-1">
                        <span>{o.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExistingOptions(prev => prev.filter(x => x.id !== o.id))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {newOptionNames.map((n, i) => (
                  <Input
                    key={i} placeholder={`Nouvelle option ${i + 1}`} value={n}
                    onChange={e => setNewOptionNames(prev => prev.map((x, idx) => idx === i ? e.target.value : x))}
                  />
                ))}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setNewOptionNames(prev => [...prev, ''])}>
                  <Plus className="h-3.5 w-3.5" />Ajouter une option
                </Button>
              </div>
            )}

            <Button onClick={handleSaveRow} className="w-full" disabled={savingRow}>
              {savingRow && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editTarget ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modèles hôtellerie-restauration ── */}
      <Dialog open={modelesOuvert} onOpenChange={(open) => { if (!open) { setModelesOuvert(false); setModelesSelectionnes(new Set()); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modèles hôtellerie-restauration</DialogTitle>
            <DialogDescription>
              Matières et coefficients d'une maquette pédagogique type — entièrement modifiables et supprimables une fois importés.
              Les coefficients « constatés » viennent d'un document officiel ; les autres sont proposés, à valider par votre établissement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {MODELES_IFHO.map(m => (
              <label key={m.formationName} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox" className="mt-1" checked={modelesSelectionnes.has(m.formationName)}
                  onChange={() => toggleModele(m.formationName)}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{m.formationName} — {m.anneeLabel}</p>
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
// Un modèle = un bloc importable, exactement au format d'un export. Les
// coefficients du CAP sont confirmés par un relevé de notes officiel DECPC
// (session 2022) — signalé dans la description, jamais dans un calcul.
const MODELES_IFHO: {
  formationName: string; anneeLabel: string; diplome?: string; duree?: string; description: string;
  matieres: { type: FormationMatiereType; name: string; coefficient: number; volumeHoraire?: number; nature: FormationMatiereNature }[];
  choixGroups: { label: string; coefficient: number; options: string[] }[];
}[] = [
  {
    formationName: 'CAP Restauration', anneeLabel: 'Année 1', diplome: "Diplôme d'État", duree: '3 ans',
    description: 'Coefficients confirmés par un relevé de notes officiel DECPC (session 2022).',
    matieres: [
      { type: 'obligatoire', name: 'Français', coefficient: 1, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Mathématiques', coefficient: 1, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Anglais', coefficient: 1, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Nutrition-Alimentation', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie du matériel', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Entretien', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'TP / Technologie Pâtisserie', coefficient: 3, volumeHoraire: 90, nature: 'pratique' },
      { type: 'obligatoire', name: 'TP Cuisine', coefficient: 4, volumeHoraire: 150, nature: 'pratique' },
      { type: 'obligatoire', name: 'TP Restaurant', coefficient: 4, volumeHoraire: 150, nature: 'pratique' },
      { type: 'obligatoire', name: 'Conduite professionnelle', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
    ],
    choixGroups: [],
  },
  {
    formationName: 'BEP Hôtellerie-Restauration', anneeLabel: 'Année 1', diplome: "Diplôme d'État", duree: '2 ans',
    description: "Coefficients en partie confirmés par un bulletin IFHO transmis ; les autres sont proposés, à valider auprès de la DECPC. Le total d'heures indicatif transmis (1 035 h) diffère légèrement de la somme des matières.",
    matieres: [
      { type: 'obligatoire', name: 'Français / Communication', coefficient: 1, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Mathématiques', coefficient: 1, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Anglais', coefficient: 1, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'HSSE', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Droit professionnel', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Entrepreneuriat', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Nutrition-Alimentation', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie du matériel', coefficient: 1, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie Restaurant', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie Cuisine', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie Pâtisserie', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: "Réalisation d'une entrée", coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Réalisation d\'un plat de résistance', coefficient: 2, volumeHoraire: 90, nature: 'pratique' },
      { type: 'obligatoire', name: 'TP Cuisine', coefficient: 3, volumeHoraire: 120, nature: 'pratique' },
      { type: 'obligatoire', name: 'TP Pâtisserie', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'TP Restaurant', coefficient: 3, volumeHoraire: 120, nature: 'pratique' },
      { type: 'obligatoire', name: 'Conduite professionnelle', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
    ],
    choixGroups: [],
  },
  {
    formationName: 'BT Hôtellerie-Tourisme', anneeLabel: 'Année 1', diplome: "Diplôme d'État", duree: '2 ans',
    description: "Coefficients proposés (maquette interne), à valider auprès de la DECPC.",
    matieres: [
      { type: 'obligatoire', name: 'Français', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Anglais', coefficient: 2, volumeHoraire: 90, nature: 'theorique' },
      { type: 'obligatoire', name: 'Mathématiques appliquées', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Informatique', coefficient: 1, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Communication professionnelle', coefficient: 1, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie hôtelière', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Gestion hôtelière', coefficient: 3, volumeHoraire: 90, nature: 'theorique' },
      { type: 'obligatoire', name: 'Hébergement / Réception', coefficient: 3, volumeHoraire: 90, nature: 'pratique' },
      { type: 'obligatoire', name: 'Technologie Restaurant', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie Cuisine', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Gestion de la restauration', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'HSSE', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Comptabilité / Gestion', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Géographie touristique', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Patrimoine culturel et touristique', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Techniques de guidage', coefficient: 3, volumeHoraire: 90, nature: 'pratique' },
      { type: 'obligatoire', name: 'Conception de circuits', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Agence de voyages / billetterie', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Tourisme durable', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Projet / stage professionnel', coefficient: 3, volumeHoraire: 120, nature: 'stage' },
    ],
    choixGroups: [],
  },
  {
    formationName: 'DTS Gestion Hôtelière', anneeLabel: 'Année 1', diplome: 'Diplôme de l\'établissement', duree: '2 ans',
    description: "Coefficients proposés (maquette interne), à valider auprès de la DECPC. Le total d'heures indicatif transmis (1 525 h) diffère légèrement de la somme des matières.",
    matieres: [
      { type: 'obligatoire', name: 'Communication professionnelle', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Anglais professionnel', coefficient: 3, volumeHoraire: 90, nature: 'theorique' },
      { type: 'obligatoire', name: 'Informatique', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Comptabilité générale', coefficient: 3, volumeHoraire: 90, nature: 'theorique' },
      { type: 'obligatoire', name: 'Comptabilité analytique', coefficient: 3, volumeHoraire: 75, nature: 'theorique' },
      { type: 'obligatoire', name: 'Gestion financière', coefficient: 3, volumeHoraire: 75, nature: 'theorique' },
      { type: 'obligatoire', name: 'Contrôle de gestion', coefficient: 3, volumeHoraire: 75, nature: 'theorique' },
      { type: 'obligatoire', name: 'Gestion budgétaire', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Management hôtelier', coefficient: 3, volumeHoraire: 90, nature: 'theorique' },
      { type: 'obligatoire', name: 'Ressources humaines', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: "Gestion de l'hébergement", coefficient: 3, volumeHoraire: 90, nature: 'pratique' },
      { type: 'obligatoire', name: 'Gestion de la restauration', coefficient: 3, volumeHoraire: 90, nature: 'pratique' },
      { type: 'obligatoire', name: 'Achats / stocks', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Marketing hôtelier', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Marketing digital', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Droit hôtelier / droit du travail', coefficient: 2, volumeHoraire: 60, nature: 'theorique' },
      { type: 'obligatoire', name: 'Gestion de la qualité', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Entrepreneuriat', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Projet / mémoire', coefficient: 3, volumeHoraire: 90, nature: 'theorique' },
      { type: 'obligatoire', name: 'Stage professionnel', coefficient: 4, volumeHoraire: 300, nature: 'stage' },
    ],
    choixGroups: [],
  },
  {
    formationName: 'DQP Polyvalent Restauration', anneeLabel: 'Cycle unique', diplome: 'Attestation', duree: '12 mois',
    description: "Coefficients proposés (maquette interne), à valider auprès de la DECPC. Le total d'heures indicatif transmis (815 h) diffère légèrement de la somme des matières.",
    matieres: [
      { type: 'obligatoire', name: 'Hygiène et sécurité alimentaire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie alimentaire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie du matériel', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Cuisine', coefficient: 3, volumeHoraire: 120, nature: 'pratique' },
      { type: 'obligatoire', name: 'Pâtisserie', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Restaurant / service', coefficient: 3, volumeHoraire: 100, nature: 'pratique' },
      { type: 'obligatoire', name: 'Bar et boissons', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Fast-food / restauration rapide', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Nutrition-Alimentation', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Approvisionnement / stockage', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Nettoyage / entretien', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Accueil / relation client', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Calcul professionnel', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Communication professionnelle', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Stage / pratique professionnelle', coefficient: 3, volumeHoraire: 120, nature: 'stage' },
    ],
    choixGroups: [],
  },
  {
    formationName: 'CPS Pâtissier', anneeLabel: 'Cycle unique', diplome: 'Attestation', duree: '6 mois',
    description: 'Coefficients proposés (maquette interne), à valider auprès de la DECPC.',
    matieres: [
      { type: 'obligatoire', name: 'Hygiène et sécurité alimentaire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie pâtisserie', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie matériel', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Matières premières', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Pâtes de base', coefficient: 3, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Crèmes et garnitures', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Gâteaux / entremets', coefficient: 3, volumeHoraire: 75, nature: 'pratique' },
      { type: 'obligatoire', name: 'Tartes / tartelettes', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Biscuits / petits fours', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Viennoiserie', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Décoration / finition', coefficient: 3, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Pâtisserie africaine / sénégalaise', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Calcul des coûts', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Organisation du laboratoire', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Épreuve pratique professionnelle', coefficient: 4, volumeHoraire: 90, nature: 'stage' },
    ],
    choixGroups: [],
  },
  {
    formationName: 'CPS Cuisinier', anneeLabel: 'Cycle unique', diplome: 'Attestation', duree: '6 mois',
    description: "Coefficients proposés (maquette interne), à valider auprès de la DECPC. Le total d'heures indicatif transmis (835 h) diffère légèrement de la somme des matières.",
    matieres: [
      { type: 'obligatoire', name: 'Hygiène et sécurité alimentaire', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie cuisine', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie matériel', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Connaissance des produits', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Techniques de découpe', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Techniques de cuisson', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Fonds / sauces', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Entrées', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Viandes / volailles', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Poissons / fruits de mer', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Légumes / garnitures', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Riz / céréales / légumineuses', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Cuisine sénégalaise', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Cuisine africaine / internationale', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Dressage / présentation', coefficient: 2, volumeHoraire: 30, nature: 'pratique' },
      { type: 'obligatoire', name: 'Gestion des stocks', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Calcul des coûts', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Épreuve pratique cuisine', coefficient: 4, volumeHoraire: 120, nature: 'stage' },
    ],
    choixGroups: [],
  },
  {
    formationName: 'CPS Serveur / Barman', anneeLabel: 'Cycle unique', diplome: 'Attestation', duree: '6 mois',
    description: 'Coefficients proposés (maquette interne), à valider auprès de la DECPC.',
    matieres: [
      { type: 'obligatoire', name: 'Hygiène et sécurité', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Technologie restaurant', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Mise en place', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Arts de la table', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Techniques de service', coefficient: 3, volumeHoraire: 75, nature: 'pratique' },
      { type: 'obligatoire', name: 'Prise de commande', coefficient: 2, volumeHoraire: 30, nature: 'pratique' },
      { type: 'obligatoire', name: 'Service des mets', coefficient: 3, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Service des boissons', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Technologie du bar', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Cocktails / boissons sans alcool', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Accueil / relation client', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Communication professionnelle', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Anglais professionnel', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Gestion des stocks du bar', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Facturation / calcul', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Épreuve pratique restaurant/bar', coefficient: 4, volumeHoraire: 90, nature: 'stage' },
    ],
    choixGroups: [],
  },
  {
    formationName: 'EQM — Employé Qualifié de Maison', anneeLabel: 'Cycle unique', diplome: 'Attestation', duree: 'variable',
    description: 'Coefficients proposés (maquette interne), à valider auprès de la DECPC.',
    matieres: [
      { type: 'obligatoire', name: 'Hygiène et sécurité', coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Techniques de nettoyage', coefficient: 3, volumeHoraire: 75, nature: 'pratique' },
      { type: 'obligatoire', name: "Produits / matériels d'entretien", coefficient: 2, volumeHoraire: 45, nature: 'theorique' },
      { type: 'obligatoire', name: 'Entretien des chambres', coefficient: 3, volumeHoraire: 75, nature: 'pratique' },
      { type: 'obligatoire', name: 'Entretien des sanitaires', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Espaces communs', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Linge : lavage / tri / entretien', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Repassage / rangement', coefficient: 2, volumeHoraire: 45, nature: 'pratique' },
      { type: 'obligatoire', name: 'Cuisine familiale de base', coefficient: 2, volumeHoraire: 60, nature: 'pratique' },
      { type: 'obligatoire', name: 'Préparation / service à table', coefficient: 1, volumeHoraire: 30, nature: 'pratique' },
      { type: 'obligatoire', name: 'Conservation des aliments', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Approvisionnement / courses', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Organisation du travail', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Communication professionnelle', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Sécurité domestique / premiers secours', coefficient: 1, volumeHoraire: 30, nature: 'theorique' },
      { type: 'obligatoire', name: 'Épreuve pratique professionnelle', coefficient: 4, volumeHoraire: 90, nature: 'stage' },
    ],
    choixGroups: [],
  },
];

export default Formations;
