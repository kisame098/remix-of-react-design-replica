import { useRef, useState } from 'react';
import {
  useSchool, NIVEAUX, NIVEAU_BASE,
  mergeFiliereMandatorySubjects, mergeFiliereFacultativeSubjects, mergeFiliereChoiceGroups,
  type NiveauDefaultSubject, type FiliereMandatorySubject, type FiliereFacultativeSubject, type FiliereChoiceGroup,
} from '@/contexts/SchoolContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Trash2, Loader2, Pencil, GraduationCap, X, Download, Upload, Copy,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { buildProgrammeCards, isCompanionFiliere, getNiveauLabels, resolveNiveauLabel, type ProgrammeCard } from '@/lib/programmeCards';
import { NIVEAUX_ELEMENTAIRE } from '@/lib/elementaryDefaults';
import ElementaryBaremeEditor from '@/components/ElementaryBaremeEditor';

// ─── Programme par niveau ───────────────────────────────────────────────────
// Une seule grille de blocs, un bloc par niveau (6ème à Tle), plus un bloc par
// combinaison (cursus × niveau) pour les cursus qui couvrent plusieurs niveaux
// (ex: "S1" en 1ère ET Tle → deux blocs séparés). Deux sources de données
// derrière, un seul langage visuel :
// - 6ème/5ème/4ème/3ème sans choix particulier → `niveau_default_subjects`
//   (liste plate, aucun concept de "commun entre niveaux").
// - Tout le reste (séries de lycée, cursus personnalisés, et un niveau du
//   collège dès qu'il a besoin d'un vrai créneau au choix) → `filieres` +
//   `filiere_choice_groups`. Un "cursus compagnon" (même nom que le niveau,
//   ex: filiere.name === '6ème') est créé automatiquement, à la demande,
//   la première fois qu'un créneau au choix est ajouté à un niveau du collège
//   — invisible en tant que bloc séparé, ses créneaux apparaissent directement
//   fondus dans le bloc "6ème". L'admin n'a jamais besoin de savoir que ça
//   existe.

type RowKind = 'obligatoire' | 'facultative' | 'choix';

type RowDialogContext =
  | { mode: 'niveau'; niveau: string }
  | { mode: 'filiere'; filiereId: string; niveau: string; filiereNiveaux: string[] };

type EditTarget =
  | { kind: 'niveau'; row: NiveauDefaultSubject }
  | { kind: 'obligatoire'; row: FiliereMandatorySubject }
  | { kind: 'facultative'; row: FiliereFacultativeSubject }
  | { kind: 'choix'; row: FiliereChoiceGroup };

const Filieres = () => {
  const {
    filieres, filiereMandatorySubjects, filiereFacultativeSubjects, filiereChoiceGroups,
    addFiliere, updateFiliere, updateFiliereNiveaux, deleteFiliere, assignClassFiliere,
    addFiliereMandatorySubject, updateFiliereMandatorySubject, deleteFiliereMandatorySubject,
    addFiliereFacultativeSubject, updateFiliereFacultativeSubject, deleteFiliereFacultativeSubject,
    addFiliereChoiceGroup, updateFiliereChoiceGroup, deleteFiliereChoiceGroup,
    addFiliereChoiceOption, deleteFiliereChoiceOption,
    niveauDefaultSubjects, addNiveauDefaultSubject, updateNiveauDefaultSubject, deleteNiveauDefaultSubject,
    elementaryDefaultLines, deleteElementaryDefaultLine,
    classes, applyNiveauDefaultsToClass,
  } = useSchool();
  const { currentYear } = useSchoolYear();
  const { school, updateSchoolSettings } = useAuth();

  // Nom affiché personnalisable par l'école pour un niveau fixe (ex: "6ème" →
  // "Sixième") — le niveau technique ne change jamais (matching classes/RPC
  // de matérialisation), seul ce qui est AFFICHÉ ici et dans le sélecteur de
  // bloc de Gestion des Classes change. Voir src/lib/programmeCards.ts.
  const niveauLabels = getNiveauLabels(school?.settings);

  // ── Export / import du programme (partage entre écoles) ────────────────
  // Format JSON simple, lisible, indépendant de l'école qui l'a produit —
  // aucun ID interne, seulement des noms/coefficients/niveaux, pour pouvoir
  // être réimporté tel quel dans une autre école SenClass.
  const handleExportProgramme = () => {
    const data = {
      type: 'teranga_school_programme_export',
      version: 1,
      exportedAt: new Date().toISOString(),
      niveauDefaults: niveauDefaultSubjects.map(s => ({
        niveau: s.niveau, name: s.name, coefficient: s.coefficient, isFacultative: s.isFacultative,
      })),
      filieres: filieres.map(f => ({
        name: f.name,
        description: f.description ?? null,
        niveaux: f.niveaux,
        mandatorySubjects: filiereMandatorySubjects
          .filter(m => m.filiereId === f.id)
          .map(m => ({ niveau: m.niveau, name: m.name, coefficient: m.coefficient })),
        facultativeSubjects: filiereFacultativeSubjects
          .filter(m => m.filiereId === f.id)
          .map(m => ({ niveau: m.niveau, name: m.name, coefficient: m.coefficient })),
        choiceGroups: filiereChoiceGroups
          .filter(g => g.filiereId === f.id)
          .map(g => ({ niveau: g.niveau, label: g.label, coefficient: g.coefficient, options: g.options.map(o => o.subjectName) })),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `programme-senclass-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || (!Array.isArray(data.niveauDefaults) && !Array.isArray(data.filieres))) {
        throw new Error("Fichier invalide — ce n'est pas un export de programme SenClass.");
      }

      let importedSubjects = 0;
      let importedFilieres = 0;

      // Matières de niveau : on n'écrase jamais, on saute les doublons (même
      // niveau + même nom déjà présents).
      const existingNiveauKeys = new Set(niveauDefaultSubjects.map(s => `${s.niveau}::${s.name}`));
      for (const s of data.niveauDefaults ?? []) {
        if (!s?.niveau || !s?.name) continue;
        const key = `${s.niveau}::${s.name}`;
        if (existingNiveauKeys.has(key)) continue;
        await addNiveauDefaultSubject({
          niveau: s.niveau, name: s.name, coefficient: Number(s.coefficient) || 1, isFacultative: !!s.isFacultative,
        });
        existingNiveauKeys.add(key);
        importedSubjects++;
      }

      // Cursus : toujours créés en tant que nouveaux cursus (jamais fusionnés
      // avec un cursus existant du même nom) — à supprimer manuellement ensuite
      // en cas de doublon volontaire.
      for (const f of data.filieres ?? []) {
        if (!f?.name || !Array.isArray(f.niveaux)) continue;
        const created = await addFiliere({ name: f.name, description: f.description || undefined });
        if (f.niveaux.length > 0) await updateFiliereNiveaux(created.id, f.niveaux);
        for (const m of f.mandatorySubjects ?? []) {
          if (!m?.name) continue;
          await addFiliereMandatorySubject(created.id, { niveau: m.niveau ?? '', name: m.name, coefficient: Number(m.coefficient) || 1 });
        }
        for (const m of f.facultativeSubjects ?? []) {
          if (!m?.name) continue;
          await addFiliereFacultativeSubject(created.id, { niveau: m.niveau ?? '', name: m.name, coefficient: Number(m.coefficient) || 1 });
        }
        for (const g of f.choiceGroups ?? []) {
          if (!g?.label) continue;
          const group = await addFiliereChoiceGroup(created.id, { niveau: g.niveau ?? '', label: g.label, coefficient: Number(g.coefficient) || 1 });
          for (const optName of g.options ?? []) {
            if (optName) await addFiliereChoiceOption(group.id, optName);
          }
        }
        importedFilieres++;
      }

      toast({
        title: 'Import terminé',
        description: `${importedSubjects} matière(s) de niveau et ${importedFilieres} cursus importés.`,
      });
    } catch (err) {
      toast({ title: "Erreur d'import", description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  // Un cursus "compagnon" d'un niveau : même nom que le niveau, ne couvre que
  // ce niveau. Créé automatiquement à la demande — jamais affiché comme bloc
  // séparé (voir isCompanionFiliere, importé de src/lib/programmeCards.ts).
  const findCompanionFiliere = (niveau: string) =>
    filieres.find(f => f.niveaux.length === 1 && f.niveaux[0] === niveau && f.name === niveau);
  const getOrCreateCompanionFiliere = async (niveau: string): Promise<string> => {
    const existing = findCompanionFiliere(niveau);
    if (existing) return existing.id;
    const created = await addFiliere({ name: niveau });
    await updateFiliereNiveaux(created.id, [niveau]);
    return created.id;
  };

  const [applyingNiveau, setApplyingNiveau] = useState<string | null>(null);
  const handleApplyToExistingClasses = async (niveau: string) => {
    if (!currentYear) return;
    const targetClasses = classes.filter(c => c.niveau === niveau);
    if (targetClasses.length === 0) {
      toast({ title: 'Aucune classe', description: `Aucune classe de niveau ${niveau} pour l'année en cours.` });
      return;
    }
    setApplyingNiveau(niveau);
    try {
      const companion = findCompanionFiliere(niveau);
      for (const c of targetClasses) {
        await applyNiveauDefaultsToClass(c.id, currentYear.id);
        if (companion) await assignClassFiliere(c.id, currentYear.id, companion.id);
      }
      toast({
        title: 'Programme appliqué',
        description:
          `${targetClasses.length} classe${targetClasses.length !== 1 ? 's' : ''} de ${niveau} mise${targetClasses.length !== 1 ? 's' : ''} à jour — `
          + `seules les matières manquantes ont été ajoutées, les coefficients déjà personnalisés n'ont pas été modifiés.`,
      });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setApplyingNiveau(null);
    }
  };

  // ── Cursus × niveau à afficher en blocs (hors cursus "compagnons") ──────
  // Source partagée avec ClassManagement.tsx (src/lib/programmeCards.ts) —
  // pour que "les blocs qu'on peut choisir à la création d'une classe" soient
  // toujours exactement "les blocs qui existent ici dans Cursus".
  const allCards: ProgrammeCard[] = buildProgrammeCards(filieres, niveauDefaultSubjects, elementaryDefaultLines);

  // ── Éditeur de barème élémentaire (CI-CM2) — système à part, voir ElementaryBaremeEditor ──
  const [elementaryBaremeNiveau, setElementaryBaremeNiveau] = useState<string | null>(null);
  const [elementaryEditLineId, setElementaryEditLineId] = useState<string | null>(null);
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null);
  const handleDeleteElementaryLine = async (id: string) => {
    setDeletingLineId(id);
    try {
      await deleteElementaryDefaultLine(id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingLineId(null);
    }
  };

  // ── Dialogue unifié "Ajouter/Modifier une matière" ──────────────────────
  const [rowDialog, setRowDialog] = useState<RowDialogContext | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [rowType, setRowType] = useState<RowKind>('obligatoire');
  const [rowName, setRowName] = useState('');
  const [rowCoef, setRowCoef] = useState('1');
  const [existingOptions, setExistingOptions] = useState<{ id: string; name: string }[]>([]);
  const [newOptionNames, setNewOptionNames] = useState<string[]>(['', '']);
  const [savingRow, setSavingRow] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<EditTarget | null>(null);
  const [deletingFiliereId, setDeletingFiliereId] = useState<string | null>(null);
  const [confirmDeleteFiliereId, setConfirmDeleteFiliereId] = useState<string | null>(null);

  const openAddRow = (ctx: RowDialogContext) => {
    setRowDialog(ctx);
    setEditTarget(null);
    setRowType('obligatoire');
    setRowName('');
    setRowCoef('1');
    setExistingOptions([]);
    setNewOptionNames(['', '']);
  };
  const openEditRow = (ctx: RowDialogContext, target: EditTarget) => {
    setRowDialog(ctx);
    setEditTarget(target);
    if (target.kind === 'niveau') {
      setRowType(target.row.isFacultative ? 'facultative' : 'obligatoire');
      setRowName(target.row.name); setRowCoef(String(target.row.coefficient));
      setExistingOptions([]); setNewOptionNames(['']);
    } else if (target.kind === 'obligatoire') {
      setRowType('obligatoire'); setRowName(target.row.name); setRowCoef(String(target.row.coefficient));
      setExistingOptions([]); setNewOptionNames(['']);
    } else if (target.kind === 'facultative') {
      setRowType('facultative'); setRowName(target.row.name); setRowCoef(String(target.row.coefficient));
      setExistingOptions([]); setNewOptionNames(['']);
    } else {
      setRowType('choix'); setRowName(target.row.label); setRowCoef(String(target.row.coefficient));
      setExistingOptions(target.row.options.map(o => ({ id: o.id, name: o.subjectName })));
      setNewOptionNames(['']);
    }
  };
  const closeRowDialog = () => setRowDialog(null);

  const handleSaveRow = async () => {
    if (!rowDialog || !rowName.trim()) return;
    const coef = parseFloat(rowCoef);
    if (!coef || coef <= 0) {
      toast({ title: 'Erreur', description: 'Coefficient invalide', variant: 'destructive' });
      return;
    }
    setSavingRow(true);
    try {
      if (!editTarget) {
        // ── Ajout — toujours enregistré pour CE niveau précis, jamais en base commune. ──
        if (rowDialog.mode === 'niveau') {
          const { niveau } = rowDialog;
          if (rowType === 'choix') {
            const filiereId = await getOrCreateCompanionFiliere(niveau);
            const group = await addFiliereChoiceGroup(filiereId, { niveau, label: rowName.trim(), coefficient: coef });
            const names = newOptionNames.map(n => n.trim()).filter(Boolean);
            for (const n of names) await addFiliereChoiceOption(group.id, n);
          } else {
            await addNiveauDefaultSubject({ niveau, name: rowName.trim(), coefficient: coef, isFacultative: rowType === 'facultative' });
          }
        } else {
          const { filiereId, niveau } = rowDialog;
          if (rowType === 'obligatoire') {
            await addFiliereMandatorySubject(filiereId, { niveau, name: rowName.trim(), coefficient: coef });
          } else if (rowType === 'facultative') {
            await addFiliereFacultativeSubject(filiereId, { niveau, name: rowName.trim(), coefficient: coef });
          } else {
            const group = await addFiliereChoiceGroup(filiereId, { niveau, label: rowName.trim(), coefficient: coef });
            const names = newOptionNames.map(n => n.trim()).filter(Boolean);
            for (const n of names) await addFiliereChoiceOption(group.id, n);
          }
        }
      } else if (editTarget.kind === 'niveau') {
        await updateNiveauDefaultSubject(editTarget.row.id, { name: rowName.trim(), coefficient: coef, isFacultative: rowType === 'facultative' });
      } else if (editTarget.kind === 'obligatoire') {
        await updateFiliereMandatorySubject(editTarget.row.id, { name: rowName.trim(), coefficient: coef });
      } else if (editTarget.kind === 'facultative') {
        await updateFiliereFacultativeSubject(editTarget.row.id, { name: rowName.trim(), coefficient: coef });
      } else {
        await updateFiliereChoiceGroup(editTarget.row.id, { label: rowName.trim(), coefficient: coef });
        const removedIds = editTarget.row.options.map(o => o.id).filter(id => !existingOptions.some(e => e.id === id));
        for (const id of removedIds) await deleteFiliereChoiceOption(id);
        const names = newOptionNames.map(n => n.trim()).filter(Boolean);
        for (const n of names) await addFiliereChoiceOption(editTarget.row.id, n);
      }
      closeRowDialog();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setSavingRow(false);
    }
  };

  const doDeleteRow = async (target: EditTarget) => {
    setDeletingRowId(target.row.id);
    try {
      if (target.kind === 'niveau') await deleteNiveauDefaultSubject(target.row.id);
      else if (target.kind === 'obligatoire') await deleteFiliereMandatorySubject(target.row.id);
      else if (target.kind === 'facultative') await deleteFiliereFacultativeSubject(target.row.id);
      else await deleteFiliereChoiceGroup(target.row.id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingRowId(null);
      setConfirmDeleteRow(null);
    }
  };
  const handleDeleteRow = (target: EditTarget, filiereNiveaux: string[]) => {
    const isShared = target.kind !== 'niveau' && target.row.niveau === NIVEAU_BASE && filiereNiveaux.length > 1;
    if (isShared) setConfirmDeleteRow(target);
    else void doDeleteRow(target);
  };

  // ── Créer / modifier / dupliquer un bloc (une série de lycée pour UN niveau
  // précis — ex: "TS2", pas "S2" partagé entre 2nde/1ère/Tle) ─────────────────
  type BlocDialogState =
    | { kind: 'create' }
    | { kind: 'edit'; filiereId: string }
    | { kind: 'duplicate'; sourceFiliereId: string; sourceNiveau: string };
  const NO_NIVEAU_SELECTED = '';
  const [blocDialog, setBlocDialog] = useState<BlocDialogState | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedNiveau, setSelectedNiveau] = useState(NO_NIVEAU_SELECTED);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => { setName(''); setDescription(''); setSelectedNiveau(NO_NIVEAU_SELECTED); setBlocDialog(null); };
  const openCreateBloc = () => { setName(''); setDescription(''); setSelectedNiveau(NO_NIVEAU_SELECTED); setBlocDialog({ kind: 'create' }); };
  const openEditBloc = (filiereId: string) => {
    const f = filieres.find(x => x.id === filiereId);
    if (!f) return;
    setName(f.name);
    setDescription(f.description ?? '');
    setSelectedNiveau(f.niveaux[0] ?? NO_NIVEAU_SELECTED);
    setBlocDialog({ kind: 'edit', filiereId });
  };
  const openDuplicateBloc = (sourceFiliereId: string, sourceNiveau: string, sourceName: string, sourceDescription?: string) => {
    setName(`${sourceName} (copie)`);
    setDescription(sourceDescription ?? '');
    setSelectedNiveau(NO_NIVEAU_SELECTED);
    setBlocDialog({ kind: 'duplicate', sourceFiliereId, sourceNiveau });
  };

  const handleSaveBloc = async () => {
    if (!blocDialog || !name.trim()) {
      toast({ title: 'Erreur', description: 'Le nom de la série est requis', variant: 'destructive' });
      return;
    }
    if (!selectedNiveau) {
      toast({ title: 'Erreur', description: 'Choisissez le niveau de ce bloc', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      if (blocDialog.kind === 'create') {
        const filiere = await addFiliere({ name: name.trim(), description: description.trim() || undefined });
        await updateFiliereNiveaux(filiere.id, [selectedNiveau]);
      } else if (blocDialog.kind === 'edit') {
        await updateFiliere(blocDialog.filiereId, { name: name.trim(), description: description.trim() || undefined });
        await updateFiliereNiveaux(blocDialog.filiereId, [selectedNiveau]);
      } else {
        // Duplication — copie le contenu résolu (base + redéfinitions du
        // niveau source déjà fusionnées) vers le nouveau bloc, sur son propre
        // niveau. N'affecte jamais le bloc d'origine.
        const source = filieres.find(f => f.id === blocDialog.sourceFiliereId);
        if (!source) throw new Error('Bloc source introuvable');
        const newFiliere = await addFiliere({ name: name.trim(), description: description.trim() || undefined });
        await updateFiliereNiveaux(newFiliere.id, [selectedNiveau]);

        const mandatory = mergeFiliereMandatorySubjects(filiereMandatorySubjects, source.id, blocDialog.sourceNiveau);
        for (const m of mandatory) {
          await addFiliereMandatorySubject(newFiliere.id, { niveau: selectedNiveau, name: m.name, coefficient: m.coefficient });
        }
        const facultative = mergeFiliereFacultativeSubjects(filiereFacultativeSubjects, source.id, blocDialog.sourceNiveau);
        for (const m of facultative) {
          await addFiliereFacultativeSubject(newFiliere.id, { niveau: selectedNiveau, name: m.name, coefficient: m.coefficient });
        }
        const groups = mergeFiliereChoiceGroups(filiereChoiceGroups, source.id, blocDialog.sourceNiveau);
        for (const g of groups) {
          const newGroup = await addFiliereChoiceGroup(newFiliere.id, { niveau: selectedNiveau, label: g.label, coefficient: g.coefficient });
          for (const opt of g.options) await addFiliereChoiceOption(newGroup.id, opt.subjectName);
        }
        toast({ title: 'Bloc dupliqué', description: `"${name.trim()}" créé avec ${mandatory.length + facultative.length + groups.length} matière(s)/créneau(x) copié(s).` });
      }
      resetForm();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFiliere = async (id: string) => {
    setDeletingFiliereId(id);
    try {
      await deleteFiliere(id);
      toast({ title: 'Succès', description: 'Cursus supprimé' });
    } catch {
      toast({
        title: 'Impossible de supprimer',
        description: "Ce cursus est assigné à une classe — désassignez-le d'abord dans Gestion des Notes.",
        variant: 'destructive',
      });
    } finally {
      setDeletingFiliereId(null);
      setConfirmDeleteFiliereId(null);
    }
  };

  // ── Vider un niveau de collège (supprime toutes ses matières par défaut +
  // ses créneaux au choix compagnons) — le bloc lui-même reste affiché (c'est
  // un niveau fixe, pas une entité qu'on peut supprimer) mais redevient vide. ──
  const [clearingNiveau, setClearingNiveau] = useState<string | null>(null);
  const [confirmClearNiveau, setConfirmClearNiveau] = useState<string | null>(null);
  const handleClearNiveau = async (niveau: string) => {
    setClearingNiveau(niveau);
    try {
      const toDelete = niveauDefaultSubjects.filter(s => s.niveau === niveau);
      for (const s of toDelete) await deleteNiveauDefaultSubject(s.id);
      const companion = findCompanionFiliere(niveau);
      if (companion) {
        const groups = mergeFiliereChoiceGroups(filiereChoiceGroups, companion.id, niveau);
        for (const g of groups) await deleteFiliereChoiceGroup(g.id);
      }
      toast({ title: 'Niveau vidé', description: `Toutes les matières de ${niveau} ont été supprimées.` });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setClearingNiveau(null);
      setConfirmClearNiveau(null);
    }
  };

  // ── Dupliquer un niveau de collège vers un autre niveau de collège — copie
  // les matières + créneaux au choix, comme "Dupliquer" pour un bloc lycée,
  // mais reste sur niveau_default_subjects (la table que lisent les RPC de
  // matérialisation) au lieu de créer une filière séparée. Ne remplace jamais
  // une matière déjà présente sur le niveau cible (même nom = ignorée).
  const [duplicateNiveauSource, setDuplicateNiveauSource] = useState<string | null>(null);
  const [duplicateNiveauTarget, setDuplicateNiveauTarget] = useState('');
  const [isDuplicatingNiveau, setIsDuplicatingNiveau] = useState(false);
  const openDuplicateNiveau = (niveau: string) => { setDuplicateNiveauSource(niveau); setDuplicateNiveauTarget(''); };

  const handleDuplicateNiveau = async () => {
    if (!duplicateNiveauSource || !duplicateNiveauTarget) return;
    setIsDuplicatingNiveau(true);
    try {
      const source = duplicateNiveauSource;
      const target = duplicateNiveauTarget;
      const existingTargetNames = new Set(niveauDefaultSubjects.filter(s => s.niveau === target).map(s => s.name));
      const toCopy = niveauDefaultSubjects.filter(s => s.niveau === source && !existingTargetNames.has(s.name));
      for (const s of toCopy) {
        await addNiveauDefaultSubject({ niveau: target, name: s.name, coefficient: s.coefficient, isFacultative: s.isFacultative });
      }

      let copiedGroups = 0;
      const sourceCompanion = findCompanionFiliere(source);
      if (sourceCompanion) {
        const groups = mergeFiliereChoiceGroups(filiereChoiceGroups, sourceCompanion.id, source);
        if (groups.length > 0) {
          const targetFiliereId = await getOrCreateCompanionFiliere(target);
          const existingTargetLabels = new Set(mergeFiliereChoiceGroups(filiereChoiceGroups, targetFiliereId, target).map(g => g.label));
          for (const g of groups) {
            if (existingTargetLabels.has(g.label)) continue;
            const newGroup = await addFiliereChoiceGroup(targetFiliereId, { niveau: target, label: g.label, coefficient: g.coefficient });
            for (const opt of g.options) await addFiliereChoiceOption(newGroup.id, opt.subjectName);
            copiedGroups++;
          }
        }
      }

      toast({
        title: 'Programme dupliqué',
        description: `${toCopy.length} matière(s)${copiedGroups > 0 ? ` et ${copiedGroups} créneau(x) au choix` : ''} copié(s) de ${source} vers ${target}.`,
      });
      setDuplicateNiveauSource(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsDuplicatingNiveau(false);
    }
  };

  // ── Modifier le nom affiché d'un niveau de collège ──────────────────────
  const [renameNiveauTarget, setRenameNiveauTarget] = useState<string | null>(null);
  const [renameNiveauValue, setRenameNiveauValue] = useState('');
  const [isSavingNiveauLabel, setIsSavingNiveauLabel] = useState(false);
  const openRenameNiveau = (niveau: string) => {
    setRenameNiveauTarget(niveau);
    setRenameNiveauValue(resolveNiveauLabel(niveauLabels, niveau));
  };
  const handleSaveNiveauLabel = async () => {
    if (!renameNiveauTarget || !renameNiveauValue.trim()) return;
    setIsSavingNiveauLabel(true);
    try {
      await updateSchoolSettings({ niveauLabels: { ...niveauLabels, [renameNiveauTarget]: renameNiveauValue.trim() } });
      toast({ title: 'Nom personnalisé', description: `"${renameNiveauValue.trim()}" enregistré.` });
      setRenameNiveauTarget(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingNiveauLabel(false);
    }
  };
  const handleResetNiveauLabel = async () => {
    if (!renameNiveauTarget) return;
    setIsSavingNiveauLabel(true);
    try {
      const next = { ...niveauLabels };
      delete next[renameNiveauTarget];
      await updateSchoolSettings({ niveauLabels: next });
      setRenameNiveauTarget(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingNiveauLabel(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Programme par niveau
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Le programme de votre école, niveau par niveau. 6ème à 3ème ont une liste de matières simple par défaut —
            ajoutez un créneau au choix (LV1, LV2…) à n'importe quel niveau si votre établissement en a besoin. Pour
            le lycée, chaque bloc est une série pour un niveau précis (ex: "TS2" pour la Terminale S2, "1S2" pour la
            1ère S2) — pas une série partagée entre plusieurs niveaux.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = '';
            }}
          />
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportProgramme}>
            <Download className="h-3.5 w-3.5" />
            Exporter
          </Button>
          <Button variant="outline" size="sm" className="gap-2" disabled={importing} onClick={() => fileInputRef.current?.click()}>
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Importer
          </Button>
          <Button className="gap-2" onClick={openCreateBloc}><Plus className="h-4 w-4" />Nouveau bloc</Button>
        </div>
      </div>

      {/* ── Dialogue créer / modifier / dupliquer un bloc ── */}
      <Dialog open={blocDialog !== null} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {blocDialog?.kind === 'edit' ? 'Modifier le bloc' : blocDialog?.kind === 'duplicate' ? 'Dupliquer le bloc' : 'Nouveau bloc'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Niveau</Label>
              <Select value={selectedNiveau} onValueChange={setSelectedNiveau}>
                <SelectTrigger><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
                <SelectContent>
                  {NIVEAUX.map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Série</Label>
              <Input
                placeholder="Ex: S2, L1, STIDD2… (pas TS2 — le niveau est déjà choisi ci-dessus)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveBloc()}
              />
              <p className="text-xs text-muted-foreground">
                Juste le nom de la série (ex: "S2", pas "TS2") — le niveau choisi ci-dessus s'affichera devant
                automatiquement. Cette série ne concerne que ce niveau précis — pour la même série à un autre
                niveau (ex: S2 en 1ère ET en Tle), créez un bloc séparé.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description (optionnel)</Label>
              <Textarea
                placeholder="Ex: Série littéraire, dominante langues"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            {blocDialog?.kind === 'duplicate' && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
                Copie les matières, matières facultatives et créneaux au choix du bloc d'origine — le bloc d'origine
                n'est pas modifié.
              </p>
            )}
            <Button onClick={handleSaveBloc} className="w-full" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {blocDialog?.kind === 'edit' ? 'Enregistrer' : blocDialog?.kind === 'duplicate' ? 'Dupliquer' : 'Créer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {allCards.map(card => {
          if (card.type === 'niveau' && (NIVEAUX_ELEMENTAIRE as readonly string[]).includes(card.niveau)) {
            const { niveau } = card;
            const lines = elementaryDefaultLines.filter(l => l.niveau === niveau && l.isActiveByDefault).sort((a, b) => a.ordering - b.ordering);
            const competenceLines = lines.filter(l => l.registre === 'COMPETENCE');
            const ressourcesLines = lines.filter(l => l.registre === 'RESSOURCES');
            const classCount = classes.filter(c => c.niveau === niveau).length;
            const renderLineGroup = (label: string, rows: typeof lines) => rows.length === 0 ? null : (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold mb-1.5">
                  {label} — {rows.reduce((s, l) => s + l.pointMax, 0)} pts
                </p>
                <ul className="space-y-1.5">
                  {rows.map(l => (
                    <li key={l.id} className="flex items-center justify-between gap-2 text-sm group/row">
                      <span className="truncate">{l.name}</span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-muted-foreground text-xs">{l.pointMax} pts</span>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100"
                          onClick={() => { setElementaryEditLineId(l.id); setElementaryBaremeNiveau(niveau); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
                          disabled={deletingLineId === l.id}
                          onClick={() => handleDeleteElementaryLine(l.id)}
                        >
                          {deletingLineId === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
            return (
              <Card key={`niveau-${niveau}`} className="group h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{resolveNiveauLabel(niveauLabels, niveau)}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{classCount} classe{classCount !== 1 ? 's' : ''} · barème</p>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Éditer le barème"
                      onClick={() => { setElementaryEditLineId(null); setElementaryBaremeNiveau(niveau); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1 space-y-3">
                    {lines.length === 0 ? (
                      <p className="text-sm text-muted-foreground/70 italic">Aucune discipline définie</p>
                    ) : (
                      <>
                        {renderLineGroup('Compétence', competenceLines)}
                        {renderLineGroup('Ressources', ressourcesLines)}
                      </>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="w-full gap-2 mt-3" onClick={() => { setElementaryEditLineId(null); setElementaryBaremeNiveau(niveau); }}>
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter une discipline
                  </Button>
                </CardContent>
              </Card>
            );
          }
          if (card.type === 'niveau') {
            const { niveau } = card;
            const subjects = niveauDefaultSubjects.filter(s => s.niveau === niveau).sort((a, b) => a.ordering - b.ordering);
            const companion = findCompanionFiliere(niveau);
            const choice = companion ? mergeFiliereChoiceGroups(filiereChoiceGroups, companion.id, niveau) : [];
            const classCount = classes.filter(c => c.niveau === niveau).length;
            const dialogCtx: RowDialogContext = { mode: 'niveau', niveau };
            return (
              <Card key={`niveau-${niveau}`} className="group h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{resolveNiveauLabel(niveauLabels, niveau)}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{classCount} classe{classCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        title="Modifier le nom affiché"
                        onClick={() => openRenameNiveau(niveau)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        title={`Dupliquer ${niveau} vers un autre niveau`}
                        onClick={() => openDuplicateNiveau(niveau)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        title={`Supprimer toutes les matières de ${niveau}`}
                        disabled={clearingNiveau === niveau}
                        onClick={() => setConfirmClearNiveau(niveau)}
                      >
                        {clearingNiveau === niveau ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1 space-y-3">
                    {subjects.length === 0 && choice.length === 0 ? (
                      <p className="text-sm text-muted-foreground/70 italic">Aucune matière définie</p>
                    ) : (
                      <>
                        {subjects.filter(s => !s.isFacultative).length > 0 && (
                          <ul className="space-y-1.5">
                            {subjects.filter(s => !s.isFacultative).map(s => (
                              <li key={s.id} className="flex items-center justify-between gap-2 text-sm group/row">
                                <span className="truncate">{s.name}</span>
                                <span className="flex items-center gap-1 flex-shrink-0">
                                  <span className="text-muted-foreground text-xs">coef {s.coefficient}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100" onClick={() => openEditRow(dialogCtx, { kind: 'niveau', row: s })}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
                                    disabled={deletingRowId === s.id}
                                    onClick={() => handleDeleteRow({ kind: 'niveau', row: s }, [])}
                                  >
                                    {deletingRowId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                  </Button>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {subjects.filter(s => s.isFacultative).length > 0 && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold mb-1.5">Facultatif</p>
                            <ul className="space-y-1.5">
                              {subjects.filter(s => s.isFacultative).map(s => (
                                <li key={s.id} className="flex items-center justify-between gap-2 text-sm group/row">
                                  <span className="truncate">{s.name}</span>
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-muted-foreground text-xs">coef {s.coefficient}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100" onClick={() => openEditRow(dialogCtx, { kind: 'niveau', row: s })}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
                                      disabled={deletingRowId === s.id}
                                      onClick={() => handleDeleteRow({ kind: 'niveau', row: s }, [])}
                                    >
                                      {deletingRowId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                    </Button>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {choice.length > 0 && companion && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold mb-1.5">Au choix</p>
                            <ul className="space-y-1.5">
                              {choice.map(g => (
                                <li key={g.id} className="text-sm group/row">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">{g.label}</span>
                                    <span className="flex items-center gap-1 flex-shrink-0">
                                      <span className="text-muted-foreground text-xs">coef {g.coefficient}</span>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100" onClick={() => openEditRow({ mode: 'filiere', filiereId: companion.id, niveau, filiereNiveaux: companion.niveaux }, { kind: 'choix', row: g })}>
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
                                        disabled={deletingRowId === g.id}
                                        onClick={() => handleDeleteRow({ kind: 'choix', row: g }, companion.niveaux)}
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
                  <Button variant="outline" size="sm" className="w-full gap-1.5 mt-3" onClick={() => openAddRow(dialogCtx)}>
                    <Plus className="h-3.5 w-3.5" />
                    Ajouter une matière
                  </Button>
                  {(subjects.length > 0 || choice.length > 0) && classCount > 0 && (
                    <Button
                      variant="ghost" size="sm" className="w-full gap-1.5 text-xs text-muted-foreground mt-1"
                      disabled={applyingNiveau === niveau}
                      onClick={() => handleApplyToExistingClasses(niveau)}
                    >
                      {applyingNiveau === niveau ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Appliquer aux classes existantes
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          }

          const { filiereId, filiereName, niveau } = card;
          const filiere = filieres.find(f => f.id === filiereId)!;
          const mandatory = mergeFiliereMandatorySubjects(filiereMandatorySubjects, filiereId, niveau);
          const facultative = mergeFiliereFacultativeSubjects(filiereFacultativeSubjects, filiereId, niveau);
          const choice = mergeFiliereChoiceGroups(filiereChoiceGroups, filiereId, niveau);
          const isDeleting = deletingFiliereId === filiereId;
          const dialogCtx: RowDialogContext = { mode: 'filiere', filiereId, niveau, filiereNiveaux: filiere.niveaux };
          return (
            <Card key={`filiere-${filiereId}-${niveau}`} className="relative group h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{resolveNiveauLabel(niveauLabels, niveau)} {filiereName}</CardTitle>
                    {filiere.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{filiere.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6"
                      title="Modifier ce bloc"
                      onClick={() => openEditBloc(filiereId)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6"
                      title="Dupliquer ce bloc"
                      onClick={() => openDuplicateBloc(filiereId, niveau, filiereName, filiere.description)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      title="Supprimer ce bloc"
                      disabled={isDeleting}
                      onClick={() => setConfirmDeleteFiliereId(filiereId)}
                    >
                      {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 space-y-3">
                  {mandatory.length === 0 && facultative.length === 0 && choice.length === 0 ? (
                    <p className="text-sm text-muted-foreground/70 italic">Aucune matière définie</p>
                  ) : (
                    <>
                      {mandatory.length > 0 && (
                        <ul className="space-y-1.5">
                          {mandatory.map(m => (
                            <li key={m.id} className="flex items-center justify-between gap-2 text-sm group/row">
                              <span className="truncate">{m.name}</span>
                              <span className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-muted-foreground text-xs">coef {m.coefficient}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100" onClick={() => openEditRow(dialogCtx, { kind: 'obligatoire', row: m })}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
                                  disabled={deletingRowId === m.id}
                                  onClick={() => handleDeleteRow({ kind: 'obligatoire', row: m }, filiere.niveaux)}
                                >
                                  {deletingRowId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                </Button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {facultative.length > 0 && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold mb-1.5">Facultatif</p>
                          <ul className="space-y-1.5">
                            {facultative.map(m => (
                              <li key={m.id} className="flex items-center justify-between gap-2 text-sm group/row">
                                <span className="truncate">{m.name}</span>
                                <span className="flex items-center gap-1 flex-shrink-0">
                                  <span className="text-muted-foreground text-xs">coef {m.coefficient}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100" onClick={() => openEditRow(dialogCtx, { kind: 'facultative', row: m })}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
                                    disabled={deletingRowId === m.id}
                                    onClick={() => handleDeleteRow({ kind: 'facultative', row: m }, filiere.niveaux)}
                                  >
                                    {deletingRowId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                  </Button>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {choice.length > 0 && (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold mb-1.5">Au choix</p>
                          <ul className="space-y-1.5">
                            {choice.map(g => (
                              <li key={g.id} className="text-sm group/row">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{g.label}</span>
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-muted-foreground text-xs">coef {g.coefficient}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100" onClick={() => openEditRow(dialogCtx, { kind: 'choix', row: g })}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
                                      disabled={deletingRowId === g.id}
                                      onClick={() => handleDeleteRow({ kind: 'choix', row: g }, filiere.niveaux)}
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
                <Button variant="outline" size="sm" className="w-full gap-1.5 mt-3" onClick={() => openAddRow(dialogCtx)}>
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter une matière
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Dialogue ajout/édition d'une matière (obligatoire / facultative / choix) ── */}
      <Dialog open={rowDialog !== null} onOpenChange={(open) => !open && closeRowDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? 'Modifier' : 'Nouvelle matière'}{rowDialog ? ` — ${rowDialog.niveau}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {(!editTarget || editTarget.kind === 'niveau') && (
              <div className="space-y-2">
                <Label>Type</Label>
                <RadioGroup value={rowType} onValueChange={(v) => setRowType(v as RowKind)} className="gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="obligatoire" /> Matière obligatoire
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="facultative" /> Matière facultative
                  </label>
                  {!editTarget && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value="choix" /> Créneau au choix (LV1, LV2…)
                    </label>
                  )}
                </RadioGroup>
              </div>
            )}
            <div className="space-y-2">
              <Label>{rowType === 'choix' ? 'Nom du créneau (ex: LV1)' : 'Nom de la matière'}</Label>
              <Input value={rowName} onChange={(e) => setRowName(e.target.value)} placeholder={rowType === 'choix' ? 'Ex: LV1' : 'Ex: Français'} />
            </div>
            <div className="space-y-2">
              <Label>Coefficient</Label>
              <Input type="number" min="0.5" step="0.5" value={rowCoef} onChange={(e) => setRowCoef(e.target.value)} />
            </div>
            {rowType === 'choix' && (
              <div className="space-y-2">
                <Label>Options (l'élève en choisit une seule)</Label>
                {existingOptions.map(o => (
                  <div key={o.id} className="flex items-center gap-2">
                    <Input value={o.name} disabled className="opacity-60" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => setExistingOptions(prev => prev.filter(x => x.id !== o.id))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {newOptionNames.map((val, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={val}
                      placeholder="Ex: Anglais"
                      onChange={(e) => setNewOptionNames(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                    />
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"
                      onClick={() => setNewOptionNames(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setNewOptionNames(prev => [...prev, ''])}>
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter une option
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

      {/* ── Confirmation suppression d'une ligne commune à plusieurs niveaux ── */}
      <AlertDialog open={!!confirmDeleteRow} onOpenChange={(open) => !open && setConfirmDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Matière commune à plusieurs niveaux</AlertDialogTitle>
            <AlertDialogDescription>
              Cette matière vient du socle commun du cursus — la supprimer l'enlèvera de TOUS les niveaux concernés
              par ce cursus, pas seulement celui-ci.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteRow && doDeleteRow(confirmDeleteRow)}
            >
              Supprimer partout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmation suppression d'un cursus entier ── */}
      <AlertDialog open={!!confirmDeleteFiliereId} onOpenChange={(open) => !open && setConfirmDeleteFiliereId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce cursus ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible et retire ce cursus de TOUS ses niveaux (pas seulement ce bloc). Si le
              cursus est assigné à une classe, la suppression sera refusée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteFiliereId && handleDeleteFiliere(confirmDeleteFiliereId)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmation vidage d'un niveau de collège ── */}
      <AlertDialog open={!!confirmClearNiveau} onOpenChange={(open) => !open && setConfirmClearNiveau(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vider {confirmClearNiveau && resolveNiveauLabel(niveauLabels, confirmClearNiveau)} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Supprime toutes les matières et créneaux au choix par défaut de ce niveau — vous pourrez le
              reconstruire matière par matière. Les classes déjà créées et leurs notes ne sont pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmClearNiveau && handleClearNiveau(confirmClearNiveau)}
            >
              Vider
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dupliquer un niveau de collège vers un autre ── */}
      <Dialog open={!!duplicateNiveauSource} onOpenChange={(open) => !open && setDuplicateNiveauSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dupliquer {duplicateNiveauSource && resolveNiveauLabel(niveauLabels, duplicateNiveauSource)} vers…</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Niveau cible</Label>
              <Select value={duplicateNiveauTarget} onValueChange={setDuplicateNiveauTarget}>
                <SelectTrigger><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
                <SelectContent>
                  {allCards
                    .filter((c): c is Extract<ProgrammeCard, { type: 'niveau' }> => c.type === 'niveau' && c.niveau !== duplicateNiveauSource)
                    .map(c => (
                      <SelectItem key={c.niveau} value={c.niveau}>{resolveNiveauLabel(niveauLabels, c.niveau)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Copie les matières et créneaux au choix de {duplicateNiveauSource} vers ce niveau — sans jamais
                remplacer une matière déjà présente (même nom) sur le niveau cible.
              </p>
            </div>
            <Button onClick={handleDuplicateNiveau} className="w-full" disabled={isDuplicatingNiveau || !duplicateNiveauTarget}>
              {isDuplicatingNiveau && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Dupliquer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modifier le nom affiché d'un niveau ── */}
      <Dialog open={!!renameNiveauTarget} onOpenChange={(open) => !open && setRenameNiveauTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le nom affiché</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nom affiché</Label>
              <Input
                value={renameNiveauValue}
                onChange={(e) => setRenameNiveauValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveNiveauLabel()}
                placeholder={renameNiveauTarget ?? ''}
              />
              <p className="text-xs text-muted-foreground">
                Change uniquement ce qui est affiché ici et dans le choix de bloc à la création d'une classe —
                n'affecte pas les élèves, notes ou classes déjà existants.
              </p>
            </div>
            <div className="flex gap-2">
              {niveauLabels[renameNiveauTarget ?? ''] && (
                <Button variant="outline" onClick={handleResetNiveauLabel} disabled={isSavingNiveauLabel} className="flex-shrink-0">
                  Réinitialiser
                </Button>
              )}
              <Button onClick={handleSaveNiveauLabel} className="w-full" disabled={isSavingNiveauLabel || !renameNiveauValue.trim()}>
                {isSavingNiveauLabel && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ElementaryBaremeEditor
        niveau={elementaryBaremeNiveau}
        initialEditLineId={elementaryEditLineId}
        onOpenChange={open => { if (!open) { setElementaryBaremeNiveau(null); setElementaryEditLineId(null); } }}
      />
    </div>
  );
};

export default Filieres;
