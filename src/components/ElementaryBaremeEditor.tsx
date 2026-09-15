import { useState, useMemo, useEffect } from 'react';
import { useSchool, ElementaryDefaultLine } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  ElementaryDomaine, ElementaryRegistre, DOMAINE_LABELS, REGISTRE_LABELS,
  ETAPE_TOTALS, etapeForNiveau, ELEMENTARY_OPTIONAL_CATALOG,
} from '@/lib/elementaryDefaults';

interface ElementaryBaremeEditorProps {
  /** null = fermé */
  niveau: string | null;
  /** Si défini à l'ouverture, ouvre directement le formulaire d'édition de cette discipline */
  initialEditLineId?: string | null;
  onOpenChange: (open: boolean) => void;
}

const emptyForm = { domaine: 'LC' as ElementaryDomaine, registre: 'COMPETENCE' as ElementaryRegistre, name: '', pointMax: '' };

const ElementaryBaremeEditor = ({ niveau, initialEditLineId, onOpenChange }: ElementaryBaremeEditorProps) => {
  const {
    elementaryDefaultLines,
    addElementaryDefaultLine, updateElementaryDefaultLine, deleteElementaryDefaultLine,
  } = useSchool();

  const [isRowDialogOpen, setIsRowDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingName, setActivatingName] = useState<string | null>(null);

  const lines = useMemo(
    () => niveau ? elementaryDefaultLines.filter(l => l.niveau === niveau && l.isActiveByDefault).sort((a, b) => a.ordering - b.ordering) : [],
    [elementaryDefaultLines, niveau]
  );
  const competenceLines = lines.filter(l => l.registre === 'COMPETENCE');
  const ressourcesLines = lines.filter(l => l.registre === 'RESSOURCES');
  const etape = niveau ? etapeForNiveau(niveau) : undefined;
  const totals = etape ? ETAPE_TOTALS[etape] : undefined;

  const activeNames = new Set(lines.map(l => l.name));
  const optionalForNiveau = niveau
    ? ELEMENTARY_OPTIONAL_CATALOG.filter(c => c.niveau === niveau && !activeNames.has(c.name))
    : [];

  // Ouvert via le crayon d'une discipline précise (pas via "Éditer le barème"/"Ajouter une discipline") :
  // on ne veut QUE le formulaire de modification, jamais la liste complète en arrière-plan.
  const directEditLine = initialEditLineId ? elementaryDefaultLines.find(l => l.id === initialEditLineId) ?? null : null;
  const isDirectEdit = !!directEditLine;

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setIsRowDialogOpen(true); };
  const openEdit = (line: ElementaryDefaultLine) => {
    setEditingId(line.id);
    setForm({ domaine: line.domaine, registre: line.registre, name: line.name, pointMax: String(line.pointMax) });
    setIsRowDialogOpen(true);
  };

  useEffect(() => {
    if (!niveau || !directEditLine) return;
    openEdit(directEditLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niveau, directEditLine]);

  // En mode édition directe, fermer le formulaire doit tout fermer (pas de retour à la liste).
  const closeRowDialog = (open: boolean) => {
    setIsRowDialogOpen(open);
    if (!open && isDirectEdit) onOpenChange(false);
  };

  const handleSave = async () => {
    if (!niveau || !form.name.trim()) {
      toast({ title: 'Erreur', description: 'Le nom de la discipline est requis', variant: 'destructive' });
      return;
    }
    const pointMax = parseFloat(form.pointMax);
    if (isNaN(pointMax) || pointMax <= 0) {
      toast({ title: 'Erreur', description: 'Le barème doit être un nombre positif', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await updateElementaryDefaultLine(editingId, { name: form.name.trim(), pointMax });
      } else {
        await addElementaryDefaultLine({ niveau, domaine: form.domaine, registre: form.registre, name: form.name.trim(), pointMax });
      }
      closeRowDialog(false);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteElementaryDefaultLine(id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleActivateOptional = async (catalogEntry: typeof ELEMENTARY_OPTIONAL_CATALOG[number]) => {
    if (!niveau) return;
    setActivatingName(catalogEntry.name);
    try {
      await addElementaryDefaultLine({
        niveau, domaine: catalogEntry.domaine, registre: catalogEntry.registre,
        name: catalogEntry.name, pointMax: catalogEntry.pointMax, isOptional: true,
      });
      toast({ title: 'Succès', description: `"${catalogEntry.name}" activé pour ce niveau.` });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setActivatingName(null);
    }
  };

  const renderRegistreSection = (registre: ElementaryRegistre, rows: ElementaryDefaultLine[], expected?: number) => {
    const sum = rows.reduce((s, l) => s + l.pointMax, 0);
    return (
      <div className="border rounded-xl overflow-hidden">
        <div className="bg-muted/60 px-3 py-1.5 flex items-center justify-between">
          <h4 className="font-semibold text-xs">{REGISTRE_LABELS[registre]}</h4>
          <Badge variant={expected !== undefined && sum !== expected ? 'destructive' : 'outline'} className="text-[10px] h-4">
            {sum}{expected !== undefined ? ` / ${expected}` : ''} pts
          </Badge>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Aucune discipline</p>
        ) : (
          <ul className="divide-y">
            {rows.map(line => (
              <li key={line.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm group">
                <div className="min-w-0">
                  <span className="truncate">{line.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">{DOMAINE_LABELS[line.domaine]}</span>
                </div>
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-muted-foreground text-xs">{line.pointMax} pts</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => openEdit(line)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    disabled={deletingId === line.id}
                    onClick={() => handleDelete(line.id)}
                  >
                    {deletingId === line.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={!!niveau && !isDirectEdit} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Barème — {niveau}</DialogTitle>
            <DialogDescription>
              {totals
                ? `Total attendu : ${totals.total} pts (÷${totals.diviseur}) — Compétence ${totals.competence} + Ressources ${totals.ressources}`
                : 'Système de notation par barème de points'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {renderRegistreSection('COMPETENCE', competenceLines, totals?.competence)}
            {renderRegistreSection('RESSOURCES', ressourcesLines, totals?.ressources)}

            <Button variant="outline" size="sm" className="w-full gap-2" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />Ajouter une discipline
            </Button>

            {optionalForNiveau.length > 0 && (
              <div className="border rounded-xl p-3 space-y-2 bg-muted/10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Disciplines optionnelles disponibles</p>
                <div className="flex flex-wrap gap-1.5">
                  {optionalForNiveau.map(c => (
                    <Button
                      key={c.name} size="sm" variant="secondary" className="text-xs h-7 gap-1"
                      disabled={activatingName === c.name}
                      onClick={() => handleActivateOptional(c)}
                    >
                      {activatingName === c.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      {c.name} ({c.pointMax} pts)
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRowDialogOpen} onOpenChange={closeRowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier' : 'Ajouter'} une discipline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nom de la discipline</Label>
              <Input
                placeholder="Ex: Lecture — Compréhension / Fluidité"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Domaine</Label>
                <Select value={form.domaine} onValueChange={v => setForm(f => ({ ...f, domaine: v as ElementaryDomaine }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DOMAINE_LABELS) as ElementaryDomaine[]).map(d => (
                      <SelectItem key={d} value={d}>{DOMAINE_LABELS[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Registre</Label>
                <Select value={form.registre} onValueChange={v => setForm(f => ({ ...f, registre: v as ElementaryRegistre }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REGISTRE_LABELS) as ElementaryRegistre[]).map(r => (
                      <SelectItem key={r} value={r}>{REGISTRE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Barème (points)</Label>
              <Input
                type="number" min="1" placeholder="Ex: 20"
                value={form.pointMax}
                onChange={e => setForm(f => ({ ...f, pointMax: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Enregistrer les modifications' : 'Ajouter la discipline'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ElementaryBaremeEditor;
