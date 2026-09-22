import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Trash2, Loader2, Pencil, Clock, ShieldAlert } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type NiveauMatiere, type NiveauMatiereNature,
  NATURE_LABELS, totauxNiveau, coefficientValide, volumeHoraireValide, matiereDejaAuNiveau,
  regrouperParCategorie, nomsDuCatalogue, peutGererMatieres,
} from '@/lib/formationPro';

type RowKind = 'obligatoire' | 'facultative' | 'choix';
type EditTarget =
  | { kind: 'obligatoire' | 'facultative'; row: NiveauMatiere }
  | { kind: 'choix'; row: { id: string; label: string; coefficient: number; options: { id: string; subjectName: string }[] } };

/**
 * Page 3 du module Formations : le programme pédagogique d'UN niveau — ses
 * matières (obligatoires/facultatives, groupées par catégorie) et ses
 * créneaux au choix. C'est ici qu'on retrouve « CAP 1 : 10 matières,
 * 21 coefficients, 750 h ».
 */
const NiveauProgramme = () => {
  const { formationId, niveauId } = useParams<{ formationId: string; niveauId: string }>();
  const { accountRole } = useAuth();
  const estDirecteur = peutGererMatieres(accountRole);
  const {
    loading, formations, niveaux, catalogue, niveauMatieres, choixGroups,
    addMatiereToNiveau, updateNiveauMatiere, deleteNiveauMatiere,
    addChoixGroup, updateChoixGroup, deleteChoixGroup, addChoixOption, deleteChoixOption,
  } = useFormationPro();

  const formation = formations.find(f => f.id === formationId);
  const niveau = niveaux.find(n => n.id === niveauId);
  const matieres = useMemo(() => niveauMatieres.filter(m => m.niveauId === niveauId), [niveauMatieres, niveauId]);
  const choix = useMemo(() => choixGroups.filter(c => c.niveauId === niveauId).sort((a, b) => a.ordering - b.ordering), [choixGroups, niveauId]);
  const groupesCategorie = useMemo(() => regrouperParCategorie(matieres), [matieres]);
  const totaux = useMemo(() => totauxNiveau(matieres, choix), [matieres, choix]);
  const nomsConnus = useMemo(() => nomsDuCatalogue(catalogue), [catalogue]);

  // ── Dialogue unifié « Ajouter / Modifier une matière » ──────────────────
  const [rowDialogOuvert, setRowDialogOuvert] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [rowType, setRowType] = useState<RowKind>('obligatoire');
  const [rowName, setRowName] = useState('');
  const [rowCoef, setRowCoef] = useState('1');
  const [rowVolume, setRowVolume] = useState('');
  const [rowNature, setRowNature] = useState<NiveauMatiereNature>('theorique');
  const [rowCategorie, setRowCategorie] = useState('');
  const [existingOptions, setExistingOptions] = useState<{ id: string; name: string }[]>([]);
  const [newOptionNames, setNewOptionNames] = useState<string[]>(['', '']);
  const [savingRow, setSavingRow] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);

  const openAddRow = () => {
    setEditTarget(null); setRowType('obligatoire'); setRowName(''); setRowCoef('1'); setRowVolume('');
    setRowNature('theorique'); setRowCategorie(''); setExistingOptions([]); setNewOptionNames(['', '']);
    setRowDialogOuvert(true);
  };
  const openEditRow = (target: EditTarget) => {
    setEditTarget(target);
    if (target.kind === 'choix') {
      setRowType('choix'); setRowName(target.row.label); setRowCoef(String(target.row.coefficient));
      setRowVolume(''); setRowNature('theorique'); setRowCategorie('');
      setExistingOptions(target.row.options.map(o => ({ id: o.id, name: o.subjectName })));
      setNewOptionNames(['', '']);
    } else {
      setRowType(target.kind); setRowName(target.row.matiereName); setRowCoef(String(target.row.coefficient));
      setRowVolume(target.row.volumeHoraire != null ? String(target.row.volumeHoraire) : ''); setRowNature(target.row.nature);
      setRowCategorie(target.row.categorie ?? ''); setExistingOptions([]); setNewOptionNames(['', '']);
    }
    setRowDialogOuvert(true);
  };
  const closeRowDialog = () => { setRowDialogOuvert(false); setEditTarget(null); };

  const handleSaveRow = async () => {
    if (!niveauId || !rowName.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est obligatoire.', variant: 'destructive' });
      return;
    }
    const coef = parseFloat(rowCoef.replace(',', '.'));
    if (!coefficientValide(coef)) {
      toast({ title: 'Erreur', description: 'Le coefficient doit être un nombre supérieur à 0.', variant: 'destructive' });
      return;
    }
    const volume = rowVolume.trim() === '' ? undefined : parseFloat(rowVolume.replace(',', '.'));
    if (!volumeHoraireValide(volume)) {
      toast({ title: 'Erreur', description: 'Le volume horaire doit être un nombre positif (ou vide).', variant: 'destructive' });
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
          const groupe = await addChoixGroup(niveauId, { label: rowName.trim(), coefficient: coef });
          for (const n of newOptionNames.map(n => n.trim()).filter(Boolean)) await addChoixOption(groupe.id, n);
        }
      } else if (editTarget && editTarget.kind !== 'choix') {
        // Retrouver l'id de la matière visée pour la garde d'unicité (même nom que soi-même = autorisé).
        const catalogueMatiere = catalogue.find(m => m.name.trim().toLowerCase() === rowName.trim().toLowerCase());
        if (catalogueMatiere && matiereDejaAuNiveau(niveauMatieres, catalogueMatiere.id, niveauId, editTarget.row.id)) {
          toast({ title: 'Erreur', description: 'Cette matière est déjà enseignée à ce niveau.', variant: 'destructive' });
          setSavingRow(false);
          return;
        }
        await updateNiveauMatiere(editTarget.row.id, {
          matiereName: rowName.trim(), type: rowType, coefficient: coef, volumeHoraire: volume, nature: rowNature, categorie: rowCategorie.trim() || undefined,
        });
      } else {
        const catalogueMatiere = catalogue.find(m => m.name.trim().toLowerCase() === rowName.trim().toLowerCase());
        if (catalogueMatiere && matiereDejaAuNiveau(niveauMatieres, catalogueMatiere.id, niveauId)) {
          toast({ title: 'Erreur', description: 'Cette matière est déjà enseignée à ce niveau.', variant: 'destructive' });
          setSavingRow(false);
          return;
        }
        await addMatiereToNiveau(niveauId, rowName.trim(), { type: rowType, coefficient: coef, volumeHoraire: volume, nature: rowNature, categorie: rowCategorie.trim() || undefined });
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
      else await deleteNiveauMatiere(target.row.id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingRowId(null);
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }
  if (!formation || !niveau) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/formation/formations" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Formations</Link>
        <p className="text-destructive text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Niveau introuvable.</p>
      </div>
    );
  }

  const renderMatiere = (m: NiveauMatiere) => (
    <li key={m.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0 text-sm group/row">
      <span className="truncate flex items-center gap-2">
        {m.matiereName}
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{m.type === 'facultative' ? 'Facultatif' : ''}</span>
        {m.nature !== 'theorique' && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 border rounded px-1">{NATURE_LABELS[m.nature]}</span>
        )}
      </span>
      <span className="flex items-center gap-3 flex-shrink-0">
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          coef {m.coefficient}{m.volumeHoraire != null ? ` · ${m.volumeHoraire} h` : ''}
        </span>
        {estDirecteur && (
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100" aria-label={`Modifier ${m.matiereName}`} onClick={() => openEditRow({ kind: m.type, row: m })}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
              disabled={deletingRowId === m.id} onClick={() => void handleDeleteRow({ kind: m.type, row: m })}
            >
              {deletingRowId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </Button>
          </span>
        )}
      </span>
    </li>
  );

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link to={`/formation/formations/${formationId}`} className="text-sm text-primary flex items-center gap-1 w-fit">
        <ArrowLeft className="h-4 w-4" />{formation.name}
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{niveau.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{formation.name} — Programme pédagogique</p>
        </div>
        {estDirecteur && (
          <Button size="sm" className="gap-2" onClick={openAddRow}>
            <Plus className="h-3.5 w-3.5" />Ajouter une matière
          </Button>
        )}
      </div>

      {matieres.length === 0 && choix.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-6">
              {estDirecteur ? 'Aucune matière définie pour ce niveau.' : 'Aucune matière définie — le directeur général doit les ajouter.'}
            </p>
            {estDirecteur && <Button onClick={openAddRow} className="gap-2"><Plus className="h-4 w-4" />Ajouter une matière</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupesCategorie.map(groupe => (
            <div key={groupe.categorie}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold mb-1.5">{groupe.categorie}</p>
              <ul>{groupe.matieres.map(renderMatiere)}</ul>
            </div>
          ))}

          {choix.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold mb-1.5">Au choix (options)</p>
              <ul>
                {choix.map(g => (
                  <li key={g.id} className="py-2 border-b last:border-0 text-sm group/row">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{g.label}</span>
                      <span className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-muted-foreground text-xs">coef {g.coefficient}</span>
                        {estDirecteur && (
                          <span className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100" aria-label={`Modifier ${g.label}`} onClick={() => openEditRow({ kind: 'choix', row: g })}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive"
                              disabled={deletingRowId === g.id} onClick={() => void handleDeleteRow({ kind: 'choix', row: g })}
                            >
                              {deletingRowId === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </Button>
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/80">{g.options.map(o => o.subjectName).join(' / ') || 'Aucune option'}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Card>
            <CardContent className="py-4 flex items-center gap-4 text-sm">
              <span className="font-semibold">{totaux.nbMatieres} matière{totaux.nbMatieres > 1 ? 's' : ''}</span>
              <span className="text-muted-foreground">Coefficient total : <span className="font-semibold text-foreground">{totaux.totalCoef}</span></span>
              {totaux.totalHeures > 0 && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />Volume horaire : <span className="font-semibold text-foreground">{totaux.totalHeures} h</span>
                  {totaux.heuresIncompletes && ' (partiel)'}
                </span>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Dialogue ajout/édition d'une matière ── */}
      <Dialog open={rowDialogOuvert} onOpenChange={(open) => !open && closeRowDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Modifier' : 'Ajouter'} une matière</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <RadioGroup value={rowType} onValueChange={(v: RowKind) => setRowType(v)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="obligatoire" id="type-obl" /><Label htmlFor="type-obl">Obligatoire</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="facultative" id="type-fac" /><Label htmlFor="type-fac">Facultative</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="choix" id="type-choix" /><Label htmlFor="type-choix">Au choix</Label></div>
            </RadioGroup>

            <div className="space-y-2">
              <Label htmlFor="row-name">{rowType === 'choix' ? 'Libellé du créneau (ex : LV2)' : 'Nom de la matière'} *</Label>
              <Input
                id="row-name" value={rowName} onChange={e => setRowName(e.target.value)}
                placeholder={rowType === 'choix' ? 'Ex : Option' : 'Ex : TP Cuisine'}
                list={rowType === 'choix' ? undefined : 'matieres-catalogue'}
              />
              {rowType !== 'choix' && (
                <datalist id="matieres-catalogue">
                  {nomsConnus.map(n => <option key={n} value={n} />)}
                </datalist>
              )}
              {rowType !== 'choix' && (
                <p className="text-xs text-muted-foreground">
                  Un nom déjà utilisé ailleurs dans l'école est repris tel quel (catalogue partagé) — pas de doublon créé.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="row-coef">Coefficient *</Label>
                <Input id="row-coef" type="number" min="0.5" step="0.5" value={rowCoef} onChange={e => setRowCoef(e.target.value)} />
              </div>
              {rowType !== 'choix' && (
                <div className="space-y-2">
                  <Label htmlFor="row-volume">Volume horaire (optionnel)</Label>
                  <Input id="row-volume" type="number" min="0" step="5" placeholder="Ex : 150" value={rowVolume} onChange={e => setRowVolume(e.target.value)} />
                </div>
              )}
            </div>

            {rowType !== 'choix' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="row-nature">Nature</Label>
                  <Select value={rowNature} onValueChange={(v: NiveauMatiereNature) => setRowNature(v)}>
                    <SelectTrigger id="row-nature"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(NATURE_LABELS) as NiveauMatiereNature[]).map(n => (
                        <SelectItem key={n} value={n}>{NATURE_LABELS[n]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="row-categorie">Catégorie (optionnel)</Label>
                  <Input
                    id="row-categorie" placeholder="Ex : Enseignement général, Enseignement professionnel…"
                    value={rowCategorie} onChange={e => setRowCategorie(e.target.value)} list="categories-connues"
                  />
                  <datalist id="categories-connues">
                    {[...new Set(matieres.map(m => m.categorie).filter((c): c is string => !!c))].map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </>
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
    </div>
  );
};

export default NiveauProgramme;
