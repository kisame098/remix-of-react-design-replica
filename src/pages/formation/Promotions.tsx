import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFormationPro } from '@/contexts/FormationProContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Loader2, Pencil, Copy, Users, GraduationCap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type Promotion, type RythmePromotion, type StatutPromotion,
  LIBELLES_RYTHME, LIBELLES_STATUT_PROMOTION, nomPromotionValide, datesPromotionValides,
  suggererNomPromotion, grouperPromotions, totauxNiveau,
} from '@/lib/formationPro';

const COULEUR_STATUT: Record<StatutPromotion, string> = {
  a_venir: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  terminee: 'bg-slate-100 text-slate-600',
  archivee: 'bg-slate-100 text-slate-400',
};

/**
 * Les promotions : les élèves qui suivent, ensemble, le programme d'UN
 * niveau. Chaque promotion possède une classe classique (nom, effectif) —
 * Paiements, Présences, Emploi du temps et le portail élève la voient déjà,
 * sans rien savoir de Formation professionnelle.
 */
const Promotions = () => {
  const {
    loading, formations, niveaux, niveauMatieres, choixGroups, promotions,
    addPromotion, updatePromotion, deletePromotion, duplicatePromotion,
  } = useFormationPro();

  const groupes = useMemo(() => grouperPromotions(promotions, niveaux, formations), [promotions, niveaux, formations]);
  const niveauxTries = useMemo(
    () => [...niveaux].sort((a, b) => {
      const fa = formations.find(f => f.id === a.formationId)?.name ?? '';
      const fb = formations.find(f => f.id === b.formationId)?.name ?? '';
      return fa.localeCompare(fb, 'fr') || a.ordering - b.ordering;
    }),
    [niveaux, formations],
  );

  // ── Créer / modifier / dupliquer une promotion ───────────────────────────
  type DialogState = { kind: 'create' } | { kind: 'edit'; promotionId: string } | { kind: 'duplicate'; sourceId: string; sourceName: string };
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [niveauId, setNiveauId] = useState('');
  const [name, setName] = useState('');
  const [nameTouche, setNameTouche] = useState(false);
  const [studentLimit, setStudentLimit] = useState('30');
  const [rythme, setRythme] = useState<RythmePromotion>('jour');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<StatutPromotion>('active');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setNiveauId(''); setName(''); setNameTouche(false); setStudentLimit('30'); setRythme('jour');
    setStartDate(''); setEndDate(''); setStatus('active'); setDescription(''); setDialog(null);
  };
  const openCreate = () => { resetForm(); setDialog({ kind: 'create' }); };
  const openEdit = (p: Promotion) => {
    setNiveauId(p.niveauId); setName(p.name); setNameTouche(true); setStudentLimit(String(p.studentLimit));
    setRythme(p.rythme); setStartDate(p.startDate ?? ''); setEndDate(p.endDate ?? ''); setStatus(p.status);
    setDescription(p.description ?? '');
    setDialog({ kind: 'edit', promotionId: p.id });
  };
  const openDuplicate = (p: Promotion) => {
    setNiveauId(p.niveauId); setName(''); setNameTouche(false); setStudentLimit(String(p.studentLimit)); setRythme(p.rythme);
    setStartDate(''); setEndDate(''); setStatus('active'); setDescription(p.description ?? '');
    setDialog({ kind: 'duplicate', sourceId: p.id, sourceName: p.name });
  };

  // Nom suggéré tant que l'école n'a pas encore tapé le sien.
  const niveauSelectionne = niveaux.find(n => n.id === niveauId);
  const nomSuggere = niveauSelectionne ? suggererNomPromotion(niveauSelectionne.name, startDate) : '';
  const nomAffiche = nameTouche ? name : nomSuggere;

  const totauxDuNiveau = niveauId ? totauxNiveau(niveauMatieres.filter(m => m.niveauId === niveauId), choixGroups.filter(c => c.niveauId === niveauId)) : null;

  const handleSave = async () => {
    const effectif = parseInt(studentLimit, 10);
    if (!niveauId) {
      toast({ title: 'Erreur', description: 'Choisissez le niveau suivi par cette promotion.', variant: 'destructive' });
      return;
    }
    if (!nomPromotionValide(nomAffiche)) {
      toast({ title: 'Erreur', description: 'Le nom de la promotion est obligatoire.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(effectif) || effectif < 1) {
      toast({ title: 'Erreur', description: "L'effectif maximum doit être un nombre positif.", variant: 'destructive' });
      return;
    }
    if (!datesPromotionValides(startDate || undefined, endDate || undefined)) {
      toast({ title: 'Erreur', description: 'La date de fin ne peut pas précéder la date de début.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const data = {
        name: nomAffiche.trim(), studentLimit: effectif, rythme,
        startDate: startDate || undefined, endDate: endDate || undefined, status, description: description.trim() || undefined,
      };
      if (dialog?.kind === 'create') {
        await addPromotion(niveauId, data);
        toast({ title: 'Promotion créée', description: data.name });
      } else if (dialog?.kind === 'edit') {
        await updatePromotion(dialog.promotionId, data);
        toast({ title: 'Promotion modifiée' });
      } else if (dialog?.kind === 'duplicate') {
        await duplicatePromotion(dialog.sourceId, data);
        toast({ title: 'Promotion dupliquée', description: `« ${data.name} » créée sans élève ni note — « ${dialog.sourceName} » n'a pas changé.` });
      }
      resetForm();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err instanceof Error ? err.message : err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deletePromotion(id);
      toast({ title: 'Promotion supprimée' });
      setConfirmDeleteId(null);
    } catch (err) {
      toast({ title: 'Suppression impossible', description: String(err instanceof Error ? err.message : err), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Promotions
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Les élèves qui suivent, ensemble, le programme d'un niveau. Une promotion reprend automatiquement les
            matières et coefficients de son niveau — rien à ressaisir.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate} disabled={niveaux.length === 0}>
          <Plus className="h-3.5 w-3.5" />Nouvelle promotion
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />Chargement…
        </div>
      ) : niveaux.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <GraduationCap className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucun niveau créé</h3>
            <p className="text-muted-foreground mb-6">
              Créez d'abord une formation et son premier niveau dans <Link to="/formation/formations" className="text-primary underline">Formations</Link>, avant de pouvoir ouvrir une promotion.
            </p>
          </CardContent>
        </Card>
      ) : promotions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Users className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucune promotion créée</h3>
            <p className="text-muted-foreground mb-6">Créez la première pour pouvoir y inscrire des élèves.</p>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />Nouvelle promotion</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupes.map(groupe => (
            <section key={groupe.formation.id}>
              <h2 className="text-base font-semibold text-foreground mb-3">{groupe.formation.name}</h2>
              <div className="space-y-5">
                {groupe.niveaux.map(({ niveau, promotions: promosDuNiveau }) => (
                  <div key={niveau.id}>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 font-semibold mb-2">{niveau.name}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {promosDuNiveau.map(p => {
                        const isDeleting = deletingId === p.id;
                        return (
                          <Card key={p.id} className="group h-full flex flex-col">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <CardTitle className="text-base truncate">{p.name}</CardTitle>
                                  <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${COULEUR_STATUT[p.status]}`}>
                                    {LIBELLES_STATUT_PROMOTION[p.status]}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Modifier" onClick={() => openEdit(p)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Dupliquer" onClick={() => openDuplicate(p)}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Supprimer"
                                    disabled={isDeleting} onClick={() => setConfirmDeleteId(p.id)}
                                  >
                                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-end">
                              <p className="text-xs text-muted-foreground mb-1">{LIBELLES_RYTHME[p.rythme]}</p>
                              {(p.startDate || p.endDate) && (
                                <p className="text-xs text-muted-foreground mb-3">
                                  {p.startDate ?? '?'} → {p.endDate ?? '?'}
                                </p>
                              )}
                              <Badge variant="outline" className="w-fit">{p.studentLimit} places max</Badge>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Créer / modifier / dupliquer une promotion ── */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === 'edit' ? 'Modifier la promotion' : dialog?.kind === 'duplicate' ? 'Dupliquer la promotion' : 'Nouvelle promotion'}
            </DialogTitle>
            {dialog?.kind === 'duplicate' && (
              <DialogDescription>
                Reprend le niveau et les réglages de « {dialog.sourceName} » — sans ses élèves ni ses notes. Utile pour
                ouvrir la même promotion l'année suivante.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {dialog?.kind !== 'edit' && dialog?.kind !== 'duplicate' && (
              <div className="space-y-2">
                <Label htmlFor="promo-niveau">Niveau suivi *</Label>
                <Select value={niveauId} onValueChange={setNiveauId}>
                  <SelectTrigger id="promo-niveau"><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
                  <SelectContent>
                    {niveauxTries.map(n => (
                      <SelectItem key={n.id} value={n.id}>
                        {formations.find(f => f.id === n.formationId)?.name} — {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {totauxDuNiveau && (
                  <p className="text-xs text-muted-foreground">
                    Programme : {totauxDuNiveau.nbMatieres} matière{totauxDuNiveau.nbMatieres > 1 ? 's' : ''} ·
                    coef. {totauxDuNiveau.totalCoef}{totauxDuNiveau.totalHeures > 0 ? ` · ${totauxDuNiveau.totalHeures} h` : ''} — rien à ressaisir.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="promo-name">Nom de la promotion *</Label>
              <Input
                id="promo-name" placeholder="Ex : CAP 1 — Promo Septembre 2026" value={nomAffiche}
                onChange={e => { setName(e.target.value); setNameTouche(true); }}
              />
              {!nameTouche && nomSuggere && <p className="text-xs text-muted-foreground">Suggéré depuis le niveau et la date de début — modifiable.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="promo-limite">Effectif maximum *</Label>
                <Input id="promo-limite" type="number" min="1" value={studentLimit} onChange={e => setStudentLimit(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rythme</Label>
                <RadioGroup value={rythme} onValueChange={(v: RythmePromotion) => setRythme(v)} className="flex gap-4 pt-2">
                  <div className="flex items-center gap-2"><RadioGroupItem value="jour" id="rythme-jour" /><Label htmlFor="rythme-jour">Jour</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="soir" id="rythme-soir" /><Label htmlFor="rythme-soir">Soir</Label></div>
                </RadioGroup>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="promo-debut">Date de début (optionnel)</Label>
                <Input id="promo-debut" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promo-fin">Date de fin (optionnel)</Label>
                <Input id="promo-fin" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            {dialog?.kind === 'edit' && (
              <div className="space-y-2">
                <Label htmlFor="promo-statut">Statut</Label>
                <Select value={status} onValueChange={(v: StatutPromotion) => setStatus(v)}>
                  <SelectTrigger id="promo-statut"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LIBELLES_STATUT_PROMOTION) as StatutPromotion[]).map(s => (
                      <SelectItem key={s} value={s}>{LIBELLES_STATUT_PROMOTION[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="promo-description">Description (optionnel)</Label>
              <Textarea id="promo-description" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
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
            <AlertDialogTitle>Supprimer cette promotion ?</AlertDialogTitle>
            <AlertDialogDescription>
              Impossible si des élèves y sont encore inscrits — retirez-les d'abord depuis Gestion Élèves. Cette action
              ne peut pas être défaite.
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

export default Promotions;
