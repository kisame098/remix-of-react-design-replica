import { useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePayment } from '@/contexts/PaymentContext';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import {
  CLE_FINANCEMENTS, erreurOrganisme, lireReglagesFinancements, nouvelId, organisme3FPT, organismeVierge,
  type Organisme, type ReglagesFinancements as Reglages,
} from '@/lib/financements';

// ═══════════════════════════════════════════════════════════════════════════
// Financements (formation professionnelle) : l'interrupteur du module
// (Paramètres) et les organismes qui prennent en charge des apprenants (3FPT…)
// avec leurs règles (dans le module, bouton « Organismes »).
// ═══════════════════════════════════════════════════════════════════════════

const pct = (n: number) => String(n).replace('.', ',');

/**
 * Un pourcentage saisi au clavier : le champ peut être vidé puis retapé (« 9 »
 * avant « 90 ») ; la valeur n'est transmise que lorsqu'elle est un nombre.
 */
const ChampPourcent = ({ valeur, onChange, entier, label, className }: {
  valeur: number; onChange: (n: number) => void; entier?: boolean; label: string; className?: string;
}) => {
  const [texte, setTexte] = useState(pct(valeur));
  useEffect(() => { setTexte(t => (Number(t.replace(',', '.')) === valeur ? t : pct(valeur))); }, [valeur]);
  return (
    <div className={`relative ${className ?? ''}`}>
      <Input
        aria-label={label} inputMode={entier ? 'numeric' : 'decimal'} className="pr-8" value={texte}
        onChange={e => {
          setTexte(e.target.value);
          const n = Number(e.target.value.replace(',', '.'));
          if (e.target.value.trim() && Number.isFinite(n)) onChange(entier ? Math.round(n) : n);
        }}
        onBlur={() => setTexte(pct(valeur))}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
    </div>
  );
};

const EditeurOrganisme = ({ o, onChange, onSupprimer, supprimable }: {
  o: Organisme; onChange: (o: Organisme) => void; onSupprimer: () => void; supprimable: boolean;
}) => {
  const { annexServices } = usePayment();
  const [nouvellePiece, setNouvellePiece] = useState('');
  const totalTranches = Math.round(o.tranches.reduce((s, t) => s + t.pourcentage, 0) * 100) / 100;
  const ajouterPiece = () => {
    const nom = nouvellePiece.trim();
    if (!nom) return;
    onChange({ ...o, pieces: [...o.pieces, { id: nouvelId(), nom }] });
    setNouvellePiece('');
  };
  const basculerService = (id: string) => onChange({
    ...o, frais: { ...o.frais, services: o.frais.services.includes(id) ? o.frais.services.filter(s => s !== id) : [...o.frais.services, id] },
  });

  return (
    <div className="rounded-xl border p-4 space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5 flex-1 min-w-[180px]">
          <Label>Organisme</Label>
          <Input value={o.nom} placeholder="3FPT, ONFP, entreprise…" onChange={e => onChange({ ...o, nom: e.target.value })} />
        </div>
        <div className="space-y-1.5 w-40">
          <Label>Part prise en charge</Label>
          <ChampPourcent entier label="Part prise en charge" valeur={o.partFinancee} onChange={n => onChange({ ...o, partFinancee: n })} />
        </div>
        {supprimable && (
          <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={onSupprimer} aria-label={`Retirer ${o.nom || "l'organisme"}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Les frais restent dus en entier à l'école. L'apprenant en paie {pct(Math.max(0, 100 - o.partFinancee))} % à la caisse ;
        les {pct(o.partFinancee)} % de l'organisme lui sont facturés dans l'onglet Finances.
      </p>

      <div className="space-y-2">
        <Label>Frais pris en charge</Label>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={o.frais.inscription} onCheckedChange={v => onChange({ ...o, frais: { ...o.frais, inscription: v === true } })} />
            Frais d'inscription
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={o.frais.mensualites} onCheckedChange={v => onChange({ ...o, frais: { ...o.frais, mensualites: v === true } })} />
            Mensualités
          </label>
          {annexServices.map(s => (
            <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={o.frais.services.includes(s.id)} onCheckedChange={() => basculerService(s.id)} />
              {s.name}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tranches de versement de l'organisme</Label>
        <div className="space-y-2">
          {o.tranches.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2">
              <Input
                className="flex-1" value={t.libelle} placeholder="Acompte, solde…"
                onChange={e => onChange({ ...o, tranches: o.tranches.map(x => x.id === t.id ? { ...x, libelle: e.target.value } : x) })}
              />
              <ChampPourcent
                className="w-28" label={`Pourcentage de ${t.libelle || `la tranche ${i + 1}`}`} valeur={t.pourcentage}
                onChange={n => onChange({ ...o, tranches: o.tranches.map(x => x.id === t.id ? { ...x, pourcentage: n } : x) })}
              />
              <Button
                type="button" variant="ghost" size="icon" disabled={o.tranches.length === 1} aria-label={`Retirer la tranche ${i + 1}`}
                onClick={() => onChange({ ...o, tranches: o.tranches.filter(x => x.id !== t.id) })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" className="gap-1.5"
            onClick={() => onChange({ ...o, tranches: [...o.tranches, { id: nouvelId(), libelle: '', pourcentage: Math.max(0, Math.round((100 - totalTranches) * 100) / 100) }] })}>
            <Plus className="h-3.5 w-3.5" /> Ajouter une tranche
          </Button>
          <span className={`text-xs font-medium ${totalTranches === 100 ? 'text-muted-foreground' : 'text-destructive'}`}>
            Total : {pct(totalTranches)} % {totalTranches === 100 ? '' : '(doit faire 100 %)'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Pourcentages de la somme prise en charge : 70 % puis 30 % des {pct(o.partFinancee)} %, par exemple.</p>
      </div>

      <div className="space-y-2">
        <Label>Pièces du dossier</Label>
        {o.pieces.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune pièce exigée pour l'instant. Ajoutez celles que l'organisme demande.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {o.pieces.map(p => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                {p.nom}
                <button type="button" aria-label={`Retirer ${p.nom}`} className="text-muted-foreground hover:text-destructive"
                  onClick={() => onChange({ ...o, pieces: o.pieces.filter(x => x.id !== p.id) })}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input value={nouvellePiece} placeholder="Copie de la pièce d'identité, diplôme…" onChange={e => setNouvellePiece(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouterPiece(); } }} />
          <Button type="button" variant="outline" onClick={ajouterPiece} disabled={!nouvellePiece.trim()}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Paramètres → Financements : seulement l'interrupteur du module. Les
 * organismes et leurs règles se gèrent DANS le module (Financements →
 * Organismes), là où on s'en sert — comme les entreprises dans Stages.
 */
export const ActivationFinancements = () => {
  const { school, updateSchoolSettings } = useAuth();
  const reglages = useMemo(() => lireReglagesFinancements(school?.settings), [school?.settings]);
  const [saving, setSaving] = useState(false);

  const basculer = async (actif: boolean) => {
    setSaving(true);
    try {
      // Première activation : le 3FPT est proposé, avec les règles de la demande.
      const organismes = actif && reglages.organismes.length === 0 ? [organisme3FPT()] : reglages.organismes;
      await updateSchoolSettings({ [CLE_FINANCEMENTS]: { actif, organismes } });
      toast({
        title: actif ? 'Module Financements activé' : 'Module Financements désactivé',
        description: actif ? 'Il apparaît dans le menu. Ses organismes se règlent depuis le module (bouton « Organismes »).' : 'Les dossiers déjà saisis sont gardés.',
      });
    } catch (e) {
      toast({ title: 'Réglage non enregistré', description: (e as { message?: string })?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> Apprenants financés</CardTitle>
            <CardDescription className="mt-1.5">
              Le module Financements suit les apprenants pris en charge par un organisme (3FPT…) : dossiers, factures,
              rapports de fin de formation, insertion. Une fois activé, il apparaît dans le menu ; ses organismes et
              leurs règles se gèrent depuis le module lui-même.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Switch checked={reglages.actif} onCheckedChange={v => void basculer(v)} disabled={saving} aria-label="Activer les financements" />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};

/**
 * Financements → Organismes : les organismes financeurs et leurs règles
 * (part prise en charge, frais concernés, tranches, pièces). Le directeur
 * règle ; les autres consultent.
 */
export const DialogOrganismes = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { school, updateSchoolSettings, accountRole } = useAuth();
  const modifiable = accountRole === 'admin';
  const enregistres = useMemo(() => lireReglagesFinancements(school?.settings), [school?.settings]);
  const [brouillon, setBrouillon] = useState<Reglages>(enregistres);
  const cleEnregistree = JSON.stringify(enregistres);
  useEffect(() => { if (open) setBrouillon(JSON.parse(cleEnregistree) as Reglages); }, [cleEnregistree, open]);
  const [saving, setSaving] = useState(false);
  const modifie = JSON.stringify(brouillon) !== cleEnregistree;

  const enregistrer = async () => {
    const erreur = brouillon.organismes.length === 0 ? 'Gardez au moins un organisme.' : brouillon.organismes.map(erreurOrganisme).find(Boolean);
    if (erreur) { toast({ title: 'Réglages incomplets', description: erreur, variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await updateSchoolSettings({ [CLE_FINANCEMENTS]: { ...brouillon, organismes: brouillon.organismes.map(o => ({ ...o, nom: o.nom.trim() })) } });
      toast({ title: 'Organismes enregistrés' });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Réglages non enregistrés', description: (e as { message?: string })?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" />Organismes financeurs</DialogTitle>
          <DialogDescription>
            {modifiable ? 'Part prise en charge, frais concernés, tranches de versement et pièces du dossier, pour chaque organisme.' : 'Seul le directeur peut modifier ces règles.'}
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={!modifiable} className="flex-1 overflow-y-auto space-y-4 -mx-1 px-1">
          {brouillon.organismes.map(o => (
            <EditeurOrganisme
              key={o.id} o={o} supprimable={modifiable && brouillon.organismes.length > 1}
              onChange={n => setBrouillon(b => ({ ...b, organismes: b.organismes.map(x => x.id === o.id ? n : x) }))}
              onSupprimer={() => setBrouillon(b => ({ ...b, organismes: b.organismes.filter(x => x.id !== o.id) }))}
            />
          ))}
          {modifiable && (
            <Button type="button" variant="outline" className="gap-2" onClick={() => setBrouillon(b => ({ ...b, organismes: [...b.organismes, organismeVierge()] }))}>
              <Plus className="h-4 w-4" /> Ajouter un organisme
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Changer la part prise en charge ne touche pas les apprenants déjà activés : ouvrez leur dossier et cliquez sur
            « Réappliquer la part » pour mettre leurs frais à jour.
          </p>
        </fieldset>
        {modifiable && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Fermer</Button>
            <Button onClick={() => void enregistrer()} disabled={!modifie || saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
