import { useState } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, School, Plus, Pencil, Trash2, Settings2, Tag, RefreshCw, Zap, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { AnnexService, SERVICE_FREQUENCY_LABELS, ServiceFrequency } from '@/types/payment';

// ─── Tuition Section ─────────────────────────────────────────────────────────
const TuitionSection = () => {
  const { classes } = useSchool();
  const { getTuitionConfig, setTuitionConfig } = usePayment();
  const [editing, setEditing]   = useState<string | null>(null);   // class UUID or null
  const [inscFee, setInscFee]   = useState('');
  const [monthFee, setMonthFee] = useState('');
  const [saving, setSaving]     = useState(false);

  const startEdit = (classId: string) => {
    const cfg = getTuitionConfig(classId);
    setInscFee(cfg ? String(cfg.inscriptionFee)  : '');
    setMonthFee(cfg ? String(cfg.monthlyFee) : '');
    setEditing(classId);
  };

  const saveEdit = async (classId: string) => {
    const insc   = parseFloat(inscFee);
    const monthly = parseFloat(monthFee);
    if (isNaN(insc) || insc < 0) {
      toast({ title: 'Erreur', description: 'Frais d\'inscription invalide', variant: 'destructive' }); return;
    }
    if (isNaN(monthly) || monthly < 0) {
      toast({ title: 'Erreur', description: 'Frais mensuel invalide', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      await setTuitionConfig(classId, insc, monthly);
      setEditing(null);
      toast({ title: 'Sauvegardé', description: 'Tarifs mis à jour' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <School className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Frais de scolarité par classe</h3>
      </div>
      {classes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune classe créée</p>
      ) : (
        <div className="space-y-2">
          {classes.map(cls => {
            const cfg       = getTuitionConfig(cls.id);
            const isEditing = editing === cls.id;
            return (
              <Card key={cls.id} className={`transition-all ${isEditing ? 'border-primary shadow-sm' : ''}`}>
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <p className="font-medium text-sm">{cls.name}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Frais d'inscription (FCFA)</Label>
                          <Input
                            type="number" min="0" placeholder="Ex: 50000"
                            value={inscFee} onChange={e => setInscFee(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Mensualité (FCFA)</Label>
                          <Input
                            type="number" min="0" placeholder="Ex: 25000"
                            value={monthFee} onChange={e => setMonthFee(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setEditing(null)} disabled={saving}>
                          Annuler
                        </Button>
                        <Button size="sm" onClick={() => saveEdit(cls.id)} disabled={saving}>
                          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{cls.name}</p>
                        {cfg ? (
                          <div className="flex gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              Inscription: <span className="font-medium text-foreground">{fmt(cfg.inscriptionFee)}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Mensuel: <span className="font-medium text-foreground">{fmt(cfg.monthlyFee)}</span>
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs mt-1 font-normal text-muted-foreground">
                            Non configuré
                          </Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(cls.id)} className="h-8 w-8">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Service Form Dialog ──────────────────────────────────────────────────────
interface ServiceFormProps {
  initial?: AnnexService;
  onClose: () => void;
}

const ServiceForm = ({ initial, onClose }: ServiceFormProps) => {
  const { classes } = useSchool();
  const { addAnnexService, updateAnnexService } = usePayment();

  const [name, setName]               = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount]           = useState(initial ? String(initial.amount) : '');
  const [frequency, setFrequency]     = useState<ServiceFrequency>(initial?.frequency ?? 'one_time');
  const [isObligatory, setIsObligatory] = useState(initial?.isObligatory ?? false);
  const [scope, setScope]             = useState<'all' | 'specific'>(initial?.scope ?? 'all');
  const [selectedClasses, setSelectedClasses] = useState<string[]>(initial?.classIds ?? []);
  const [saving, setSaving]           = useState(false);

  const toggleClass = (id: string) =>
    setSelectedClasses(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Erreur', description: 'Nom requis', variant: 'destructive' }); return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: 'Erreur', description: 'Montant invalide', variant: 'destructive' }); return;
    }
    if (scope === 'specific' && selectedClasses.length === 0) {
      toast({ title: 'Erreur', description: 'Sélectionnez au moins une classe', variant: 'destructive' }); return;
    }

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      amount: amt,
      frequency,
      isObligatory,
      scope,
      classIds: scope === 'all' ? [] : selectedClasses,
    };

    setSaving(true);
    try {
      if (initial) {
        await updateAnnexService(initial.id, data);
        toast({ title: 'Mis à jour' });
      } else {
        await addAnnexService(data);
        toast({ title: 'Service créé' });
      }
      onClose();
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Nom du service *</Label>
          <Input placeholder="Ex: Transport, Cantine, Uniforme..." value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Description (optionnel)</Label>
          <Input placeholder="Précisions..." value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Montant (FCFA) *</Label>
          <Input type="number" min="0" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Fréquence</Label>
          <Select value={frequency} onValueChange={v => setFrequency(v as ServiceFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SERVICE_FREQUENCY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div>
          <p className="text-sm font-medium">Service obligatoire</p>
          <p className="text-xs text-muted-foreground">Automatiquement ajouté à chaque élève</p>
        </div>
        <Switch checked={isObligatory} onCheckedChange={setIsObligatory} />
      </div>

      <div className="space-y-2">
        <Label>Applicable à</Label>
        <Select value={scope} onValueChange={v => setScope(v as 'all' | 'specific')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            <SelectItem value="specific">Classes spécifiques</SelectItem>
          </SelectContent>
        </Select>
        {scope === 'specific' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {classes.map(cls => (
              <label key={cls.id} className="flex items-center gap-2 cursor-pointer p-2 rounded border hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={selectedClasses.includes(cls.id)}
                  onCheckedChange={() => toggleClass(cls.id)}
                />
                <span className="text-sm">{cls.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          {initial ? 'Mettre à jour' : 'Créer le service'}
        </Button>
      </div>
    </div>
  );
};

// ─── Services Section ─────────────────────────────────────────────────────────
const ServicesSection = () => {
  const { annexServices, deleteAnnexService } = usePayment();
  const [dialogOpen, setDialogOpen]         = useState(false);
  const [editingService, setEditingService] = useState<AnnexService | null>(null);
  const [deleting, setDeleting]             = useState<string | null>(null);

  const openCreate = () => { setEditingService(null); setDialogOpen(true); };
  const openEdit   = (s: AnnexService) => { setEditingService(s); setDialogOpen(true); };

  const handleDelete = async (s: AnnexService) => {
    setDeleting(s.id);
    try {
      await deleteAnnexService(s.id);
      toast({ title: 'Service supprimé', description: s.name });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de supprimer', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const freqIcon: Record<string, React.ReactNode> = {
    monthly:  <RefreshCw className="h-3 w-3" />,
    annual:   <Calendar className="h-3 w-3" />,
    one_time: <Zap className="h-3 w-3" />,
  };

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Services annexes</h3>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingService ? 'Modifier le service' : 'Nouveau service annexe'}</DialogTitle>
            </DialogHeader>
            <ServiceForm initial={editingService ?? undefined} onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {annexServices.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Tag className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun service annexe</p>
          <p className="text-xs mt-1">Transport, cantine, uniforme…</p>
        </div>
      ) : (
        <div className="space-y-2">
          {annexServices.map(svc => (
            <Card key={svc.id} className="group">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{svc.name}</p>
                      {svc.isObligatory && (
                        <Badge variant="default" className="text-xs px-1.5 py-0 h-4">Obligatoire</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-sm font-semibold text-primary">{fmt(svc.amount)}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {freqIcon[svc.frequency]}
                        {SERVICE_FREQUENCY_LABELS[svc.frequency]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {svc.scope === 'all' ? 'Toutes classes' : `${svc.classIds.length} classe(s)`}
                      </span>
                    </div>
                    {svc.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(svc)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(svc)}
                      disabled={deleting === svc.id}
                    >
                      {deleting === svc.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Config Component ────────────────────────────────────────────────────
const PaymentConfig = () => {
  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Settings2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Configuration des paiements</h2>
      </div>
      <TuitionSection />
      <div className="border-t pt-6">
        <ServicesSection />
      </div>
    </div>
  );
};

export default PaymentConfig;
