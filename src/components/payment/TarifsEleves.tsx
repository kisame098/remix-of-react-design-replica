import { useMemo, useState } from 'react';
import { useSchool, type Student } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { BadgePercent, Loader2, Search, Trash2, UserCog, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  getAcademicMonths, getBillableMonthsFor, readBillingRules,
  DEFAULT_TUITION_BILLING_TIMING, type TuitionBillingTiming,
} from '@/types/payment';
import { buildPayableItems, type PayableItem } from '@/lib/dueItems';
import {
  LIBELLES_MODE, appliquerAjustement, decrireAjustement, developperAjustement,
  manqueAGagner, montantEleve, tarifNormalDe, verifierAjustement,
  type AjustementTarif, type ElementFrais, type ModeAjustement,
} from '@/lib/tarifsEleve';

// ═══════════════════════════════════════════════════════════════════════════
// Réductions : tarif personnalisé d'un élève (src/lib/tarifsEleve.ts).
// Accorder / retirer : directeur, ou personnel ayant la permission
// « reductions » (vérifié aussi par la base, docs/sql/tarifs_eleve.sql).
// ═══════════════════════════════════════════════════════════════════════════

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' F';
const elementDe = (i: PayableItem): ElementFrais => ({
  type: i.type, ...(i.monthKey ? { monthKey: i.monthKey } : {}), ...(i.serviceId ? { serviceId: i.serviceId } : {}),
});

/** Peut accorder ou retirer une réduction. */
const usePeutAccorder = () => {
  const { accountRole, staffPermissions } = useAuth();
  return accountRole === 'admin' || (accountRole === 'staff' && !!staffPermissions?.includes('reductions'));
};

// ─── Les frais d'un élève, au tarif normal ───────────────────────────────────
const useFraisEleve = (eleve: Student | undefined) => {
  const { classes } = useSchool();
  const {
    getTuitionConfig, getStudentActiveServices, hasPaidInscription, hasPaidTuitionMonth, hasPaidService,
    isEnrolledInService,
  } = usePayment();
  const { currentYear } = useSchoolYear();
  const { school } = useAuth();
  return useMemo((): PayableItem[] => {
    if (!eleve || !currentYear) return [];
    const timing = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
    const mois = getAcademicMonths(currentYear.startDate, currentYear.endDate, timing);
    const factures = getBillableMonthsFor(mois, readBillingRules(school?.settings), eleve.enrolledAt);
    return buildPayableItems({
      academicMonths: mois,
      billableKeys: new Set(factures.map(m => m.key)),
      tuitionConfig: eleve.classId ? getTuitionConfig(eleve.classId) : undefined,
      className: classes.find(c => c.id === eleve.classId)?.name,
      services: getStudentActiveServices(eleve.id, eleve.classId),
      hasPaidInscription: () => hasPaidInscription(eleve.id),
      hasPaidTuitionMonth: k => hasPaidTuitionMonth(eleve.id, k),
      hasPaidService: (s, k) => hasPaidService(eleve.id, s, k),
      isEnrolledInService: (s, i) => isEnrolledInService(eleve.id, eleve.classId, s, i),
      // Sans tarif personnalisé : on veut ici TOUS les frais, au tarif normal.
    });
  }, [eleve, currentYear, school, classes, getTuitionConfig, getStudentActiveServices, hasPaidInscription, hasPaidTuitionMonth, hasPaidService, isEnrolledInService]);
};

// ─── Éditeur d'un élève ─────────────────────────────────────────────────────
const EditeurTarifEleve = ({ eleve, onFermer }: { eleve: Student; onFermer: () => void }) => {
  const { getAjustementsEleve, appliquerTarifsEleve, retirerTarifsEleve } = usePayment();
  const peutAccorder = usePeutAccorder();
  const frais = useFraisEleve(eleve);
  const index = getAjustementsEleve(eleve.id);

  const [mode, setMode] = useState<ModeAjustement>('pourcentage');
  const [valeur, setValeur] = useState('');
  const [motif, setMotif] = useState('');
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState(false);

  const modifiables = frais.filter(i => !i.paid);
  const moisModifiables = modifiables.filter(i => i.type === 'tuition');
  const basculer = (id: string) => setCoches(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const cocherTous = (ids: string[], oui: boolean) => setCoches(prev => {
    const n = new Set(prev); ids.forEach(id => (oui ? n.add(id) : n.delete(id))); return n;
  });

  const nombre = Number(valeur.replace(/[\s\u00a0\u202f]/g, ''));
  const erreur = verifierAjustement({ mode, valeur: nombre, motif });

  const appliquer = async () => {
    if (erreur) { toast({ title: 'À corriger', description: erreur, variant: 'destructive' }); return; }
    const cibles = modifiables.filter(i => coches.has(i.id)).map(elementDe);
    if (cibles.length === 0) { toast({ title: 'À corriger', description: 'Cochez au moins un frais', variant: 'destructive' }); return; }
    setEnCours(true);
    try {
      await appliquerTarifsEleve(eleve.id, developperAjustement({ studentId: eleve.id, mode, valeur: nombre, motif }, cibles));
      toast({ title: 'Tarif personnalisé enregistré', description: `${cibles.length} frais pour ${eleve.firstName} ${eleve.lastName}` });
      setCoches(new Set());
    } catch (e) {
      toast({ title: 'Impossible d\'enregistrer', description: (e as { message?: string })?.message ?? 'Réessayez', variant: 'destructive' });
    } finally {
      setEnCours(false);
    }
  };

  const retirer = async (ids: string[]) => {
    setEnCours(true);
    try {
      await retirerTarifsEleve(ids);
      toast({ title: 'Tarif normal rétabli', description: `${ids.length} frais` });
    } catch (e) {
      toast({ title: 'Impossible de retirer', description: (e as { message?: string })?.message ?? 'Réessayez', variant: 'destructive' });
    } finally {
      setEnCours(false);
    }
  };

  const lignes = frais.map(i => ({ item: i, ...montantEleve(i.tarifNormal, elementDe(i), index) }));
  const personnalises = lignes.filter(l => l.ajustement);

  return (
    <Dialog open onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" />{eleve.firstName} {eleve.lastName}</DialogTitle>
          <DialogDescription>
            Tarif personnalisé : réduction en %, en francs, ou montant fixe, sur les frais cochés.
            Les frais déjà payés ne changent pas.
          </DialogDescription>
        </DialogHeader>

        {peutAccorder ? (
          <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Formule</Label>
                <Select value={mode} onValueChange={v => setMode(v as ModeAjustement)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(LIBELLES_MODE) as ModeAjustement[]).map(m => <SelectItem key={m} value={m}>{LIBELLES_MODE[m]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{mode === 'pourcentage' ? 'Réduction (%)' : mode === 'reduction' ? 'Réduction (F)' : 'Il paie (F)'}</Label>
                <Input inputMode="numeric" value={valeur} onChange={e => setValeur(e.target.value.replace(/[^\d\s]/g, ''))}
                  placeholder={mode === 'pourcentage' ? 'Ex : 50' : 'Ex : 5000'} aria-label="Valeur" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motif (obligatoire)</Label>
                <Input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex : enfant du personnel" aria-label="Motif" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => cocherTous(moisModifiables.map(i => i.id), true)}>Tous les mois</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => cocherTous(modifiables.map(i => i.id), true)}>Tous les frais</Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCoches(new Set())}>Aucun</Button>
            </div>

            <ul className="divide-y rounded-md border bg-background max-h-72 overflow-y-auto">
              {lignes.map(({ item, du, tarifNormal, ajustement }) => {
                const apercu = !item.paid && coches.has(item.id) && !erreur ? appliquerAjustement(tarifNormal, { mode, valeur: nombre }) : null;
                return (
                  <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    {item.paid
                      ? <Lock className="h-4 w-4 text-muted-foreground" aria-label="Déjà payé" />
                      : <Checkbox checked={coches.has(item.id)} onCheckedChange={() => basculer(item.id)} aria-label={item.label} />}
                    <span className={`flex-1 min-w-0 truncate ${item.paid ? 'text-muted-foreground' : ''}`}>{item.label}</span>
                    {ajustement && <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300">{decrireAjustement(ajustement)}</Badge>}
                    <span className="w-40 text-right tabular-nums">
                      {item.paid ? <span className="text-xs text-green-700">payé</span> : apercu !== null ? (
                        <><span className="line-through text-muted-foreground mr-1">{fmt(du)}</span><span className="font-semibold text-primary">{fmt(apercu)}</span></>
                      ) : du !== tarifNormal ? (
                        <><span className="line-through text-muted-foreground mr-1">{fmt(tarifNormal)}</span><span className="font-semibold">{fmt(du)}</span></>
                      ) : fmt(du)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-end">
              <Button onClick={appliquer} disabled={enCours || coches.size === 0} className="gap-2">
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgePercent className="h-4 w-4" />}
                Appliquer aux {coches.size} frais cochés
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Seuls le directeur et le personnel autorisé peuvent accorder une réduction.</p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Tarifs personnalisés en place ({personnalises.length})</p>
            {peutAccorder && personnalises.length > 0 && (
              <Button size="sm" variant="ghost" className="text-destructive h-7 text-xs gap-1" disabled={enCours}
                onClick={() => retirer(personnalises.map(l => l.ajustement!.id!).filter(Boolean))}>
                <Trash2 className="h-3.5 w-3.5" /> Tout retirer
              </Button>
            )}
          </div>
          {personnalises.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun : l'élève paie le tarif normal.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {personnalises.map(({ item, du, tarifNormal, ajustement }) => (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{item.label} · <span className="text-violet-700">{decrireAjustement(ajustement!)}</span></p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ajustement!.motif}{ajustement!.accordePar ? ` — accordé par ${ajustement!.accordePar}` : ''}
                    </p>
                  </div>
                  <span className="text-right tabular-nums text-xs"><span className="line-through text-muted-foreground mr-1">{fmt(tarifNormal)}</span>{fmt(du)}</span>
                  {peutAccorder && ajustement!.id && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={enCours}
                      onClick={() => retirer([ajustement!.id!])} aria-label={`Retirer le tarif personnalisé de ${item.label}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Onglet « Réductions » ──────────────────────────────────────────────────
const TarifsEleves = () => {
  const { students, classes } = useSchool();
  const { ajustements, getTuitionConfig, annexServices } = usePayment();
  const peutAccorder = usePeutAccorder();
  const [recherche, setRecherche] = useState('');
  const [eleveOuvert, setEleveOuvert] = useState<string | null>(null);

  // Élèves ayant un tarif personnalisé, avec l'argent en moins pour l'école.
  const lignes = useMemo(() => {
    const parEleve = new Map<string, AjustementTarif[]>();
    for (const a of ajustements) parEleve.set(a.studentId, [...(parEleve.get(a.studentId) ?? []), a]);
    return [...parEleve.entries()].flatMap(([id, liste]) => {
      const eleve = students.find(s => s.id === id);
      if (!eleve) return [];
      const cfg = eleve.classId ? getTuitionConfig(eleve.classId) : undefined;
      const montants = liste.map(a => {
        const tarifNormal = tarifNormalDe(a, cfg, annexServices);
        return { tarifNormal, du: appliquerAjustement(tarifNormal, a) };
      });
      return [{ eleve, liste, enMoins: manqueAGagner(montants), motifs: [...new Set(liste.map(a => a.motif))] }];
    }).sort((a, b) => b.enMoins - a.enMoins);
  }, [ajustements, students, getTuitionConfig, annexServices]);
  const total = lignes.reduce((s, l) => s + l.enMoins, 0);

  const trouves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return [];
    return students.filter(s => `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(q)).slice(0, 8);
  }, [recherche, students]);

  const eleve = students.find(s => s.id === eleveOuvert);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><BadgePercent className="h-5 w-5 text-primary" />Réductions et tarifs personnalisés</h2>
          <p className="text-sm text-muted-foreground">Bourses, enfants du personnel, fratries, cas particuliers : chaque réduction a un motif et un auteur.</p>
        </div>
        <Card><CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">Argent en moins cette année</p>
          <p className="text-xl font-bold text-violet-700">{fmt(total)}</p>
          <p className="text-xs text-muted-foreground">{lignes.length} élève{lignes.length > 1 ? 's' : ''}</p>
        </CardContent></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={peutAccorder ? 'Chercher un élève pour personnaliser ses frais…' : 'Chercher un élève…'}
          value={recherche} onChange={e => setRecherche(e.target.value)} aria-label="Chercher un élève" />
        {trouves.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
            {trouves.map(s => (
              <li key={s.id}>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setEleveOuvert(s.id); setRecherche(''); }}>
                  {s.firstName} {s.lastName} <span className="text-xs text-muted-foreground">· {classes.find(c => c.id === s.classId)?.name ?? 'sans classe'} · {s.studentId}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lignes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Aucun élève n'a de tarif personnalisé.</p>
      ) : (
        <div className="rounded-lg border divide-y">
          {lignes.map(({ eleve: e, liste, enMoins, motifs }) => (
            <button key={e.id} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/40" onClick={() => setEleveOuvert(e.id)}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{e.firstName} {e.lastName} <span className="text-xs text-muted-foreground">· {classes.find(c => c.id === e.classId)?.name ?? ''}</span></p>
                <p className="text-xs text-muted-foreground truncate">{motifs.join(' · ')}</p>
              </div>
              <Badge variant="outline">{liste.length} frais</Badge>
              <span className="w-28 text-right text-sm font-semibold text-violet-700 tabular-nums">−{fmt(enMoins)}</span>
            </button>
          ))}
        </div>
      )}

      {eleve && <EditeurTarifEleve eleve={eleve} onFermer={() => setEleveOuvert(null)} />}
    </div>
  );
};

export default TarifsEleves;
