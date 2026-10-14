import { useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Banknote, CalendarRange, Filter, Layers, School, Users, X, EyeOff } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useFormationPro } from '@/contexts/FormationProContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MONTANT_MASQUE, useMontantsMasques } from '@/hooks/useMontantsMasques';
import { estFormationPro } from '@/lib/modeGestion';
import { estPrescolaire } from '@/lib/prescolaire';
import { CYCLES, cycleDuNiveau } from '@/lib/configScolarite';
import {
  DEFAULT_TUITION_BILLING_TIMING, PAYMENT_METHOD_LABELS, getAcademicMonths,
  type PaymentMethod, type TuitionBillingTiming,
} from '@/types/payment';
import {
  FILTRES_VIDES, LIBELLES_RUBRIQUE, RUBRIQUES, filtrerEncaissements, lignesEncaissement, parClasse, parFrais, parMois,
  repartition, type FiltresEncaissements, type Rubrique,
} from '@/lib/detailEncaissements';

// ═══════════════════════════════════════════════════════════════════════════
// Gestion des paiements → Total encaissé → détail : d'où vient l'argent.
// Inscriptions, mensualités, services annexes ; puis des filtres (rubrique,
// frais précis, cycle ou formation, classe, mode, période) qui répondent à
// « combien la classe X a-t-elle payé en frais Z ? », avec les graphiques.
// ═══════════════════════════════════════════════════════════════════════════

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
const COULEURS: Record<Rubrique, string> = { inscription: '#3B82F6', tuition: 'hsl(var(--primary))', service: '#10B981' };
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const libelleMoisCivil = (cle: string) => { const [a, m] = cle.split('-'); return `${MOIS_COURTS[Number(m) - 1] ?? m} ${a.slice(2)}`; };
const LIBELLE_PRESCOLAIRE = 'Préscolaire';

export const DetailEncaissements = ({ onRetour }: { onRetour: () => void }) => {
  const { school } = useAuth();
  const { tousLesEleves, classes } = useSchool();
  const { payments, annexServices } = usePayment();
  const { currentYear } = useSchoolYear();
  const { promotions, niveaux, formations } = useFormationPro();
  const [masques] = useMontantsMasques();
  const somme = (n: number) => (masques ? MONTANT_MASQUE : fmt(n));
  const formation = estFormationPro(school);

  const billingTiming = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
  const mois = useMemo(
    () => (currentYear ? getAcademicMonths(currentYear.startDate, currentYear.endDate, billingTiming) : []),
    [currentYear, billingTiming],
  );

  // Cycle (classique) ou formation (formation professionnelle) de chaque classe.
  const groupeDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes) {
      if (formation) {
        const promo = promotions.find(p => p.classId === c.id);
        const niveau = promo ? niveaux.find(n => n.id === promo.niveauId) : undefined;
        if (niveau) m.set(c.id, niveau.formationId);
      } else {
        const g = estPrescolaire(c.niveau) ? 'prescolaire' : cycleDuNiveau(c.niveau);
        if (g) m.set(c.id, g);
      }
    }
    return m;
  }, [classes, formation, promotions, niveaux]);
  const groupes = formation
    ? formations.filter(f => [...groupeDe.values()].includes(f.id)).map(f => ({ id: f.id, nom: f.name }))
    : [{ id: 'prescolaire', nom: LIBELLE_PRESCOLAIRE }, ...CYCLES.map(c => ({ id: c.cycle as string, nom: c.libelle }))]
      .filter(g => [...groupeDe.values()].includes(g.id));

  const classeDe = useMemo(() => new Map(tousLesEleves.map(e => [e.id, e.classId ?? undefined])), [tousLesEleves]);
  const lignes = useMemo(
    () => lignesEncaissement(payments, id => classeDe.get(id), c => groupeDe.get(c)),
    [payments, classeDe, groupeDe],
  );

  const [f, setF] = useState<FiltresEncaissements>(FILTRES_VIDES);
  const changer = (p: Partial<FiltresEncaissements>) => setF(prev => ({ ...prev, ...p }));
  const filtrees = useMemo(() => filtrerEncaissements(lignes, f), [lignes, f]);
  const total = repartition(lignes);
  const resultat = repartition(filtrees);
  const filtre = JSON.stringify(f) !== JSON.stringify(FILTRES_VIDES);

  const libelleFrais = (cle: string): string => {
    if (cle === 'inscription') return "Frais d'inscription";
    if (cle.startsWith('tuition:')) { const k = cle.slice(8); return `Mensualité ${mois.find(m => m.key === k)?.label ?? k}`; }
    return annexServices.find(s => `service:${s.id}` === cle)?.name ?? 'Service supprimé';
  };
  // Les frais proposés : ceux réellement encaissés, dans la rubrique choisie.
  const fraisPossibles = useMemo(() => {
    const cles = [...new Set(lignes.filter(l => f.rubrique === 'toutes' || l.rubrique === f.rubrique).map(l => l.frais))];
    const rang = (c: string) => (c === 'inscription' ? -1 : c.startsWith('tuition:') ? mois.findIndex(m => `tuition:${m.key}` === c) : 1000);
    return cles.sort((a, b) => rang(a) - rang(b) || a.localeCompare(b));
  }, [lignes, f.rubrique, mois]);
  const classesPossibles = classes
    .filter(c => f.groupe === 'tous' || groupeDe.get(c.id) === f.groupe)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));

  const evolution = parMois(filtrees).map(m => ({ ...m, libelle: libelleMoisCivil(m.mois) }));
  const classesRes = [...parClasse(filtrees).entries()]
    .map(([id, r]) => ({ id, nom: id ? classes.find(c => c.id === id)?.name ?? 'Classe supprimée' : 'Sans classe', ...r }))
    .sort((a, b) => b.total - a.total);
  const fraisRes = parFrais(filtrees);
  const pct = (n: number, sur: number) => (sur > 0 ? Math.round((n / sur) * 100) : 0);

  return (
    <div className="p-5 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={onRetour}><ArrowLeft className="h-4 w-4" />Vue d'ensemble</Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">D'où vient l'argent encaissé</h2>
          <p className="text-sm text-muted-foreground">Total encaissé : <span className="font-semibold text-foreground">{somme(total.total)} FCFA</span></p>
        </div>
      </div>

      {/* Les trois sources, cliquables pour filtrer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {RUBRIQUES.map(r => {
          const actif = f.rubrique === r;
          return (
            <Card key={r} role="button" tabIndex={0}
              className={`cursor-pointer transition-all hover:shadow-md ${actif ? 'border-primary ring-1 ring-primary' : ''}`}
              onClick={() => changer({ rubrique: actif ? 'toutes' : r, frais: 'tous' })}
              onKeyDown={e => { if (e.key === 'Enter') changer({ rubrique: actif ? 'toutes' : r, frais: 'tous' }); }}>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{LIBELLES_RUBRIQUE[r]}</p>
                    <p className="text-2xl font-bold mt-0.5">{somme(total[r])}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Progress value={pct(total[r], total.total)} className="h-1 w-12" />
                      <p className="text-xs text-muted-foreground">{pct(total[r], total.total)}% du total</p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl" style={{ background: `color-mix(in srgb, ${COULEURS[r]} 12%, transparent)` }}>
                    <Banknote className="h-5 w-5" style={{ color: COULEURS[r] }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4 text-muted-foreground" />Filtrer</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={f.rubrique} onValueChange={v => changer({ rubrique: v as FiltresEncaissements['rubrique'], frais: 'tous' })}>
              <SelectTrigger aria-label="Rubrique"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les rubriques</SelectItem>
                {RUBRIQUES.map(r => <SelectItem key={r} value={r}>{LIBELLES_RUBRIQUE[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.frais} onValueChange={v => changer({ frais: v })}>
              <SelectTrigger aria-label="Frais"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les frais</SelectItem>
                {fraisPossibles.map(c => <SelectItem key={c} value={c}>{libelleFrais(c)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.groupe} onValueChange={v => changer({ groupe: v, classe: 'toutes' })}>
              <SelectTrigger aria-label={formation ? 'Formation' : 'Cycle'}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">{formation ? 'Toutes les formations' : 'Tous les cycles'}</SelectItem>
                {groupes.map(g => <SelectItem key={g.id} value={g.id}>{g.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.classe} onValueChange={v => changer({ classe: v })}>
              <SelectTrigger aria-label="Classe"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les classes</SelectItem>
                {classesPossibles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={f.methode} onValueChange={v => changer({ methode: v as FiltresEncaissements['methode'] })}>
              <SelectTrigger aria-label="Mode de paiement"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Tous les modes de paiement</SelectItem>
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(m => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 lg:col-span-2">
              <CalendarRange className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input type="date" aria-label="Du" value={f.du} onChange={e => changer({ du: e.target.value })} />
              <span className="text-sm text-muted-foreground">au</span>
              <Input type="date" aria-label="Au" value={f.au} onChange={e => changer({ au: e.target.value })} />
            </div>
            {filtre && (
              <Button variant="ghost" size="sm" className="text-muted-foreground justify-self-start self-center" onClick={() => setF(FILTRES_VIDES)}>
                <X className="w-3 h-3 mr-1" />Effacer les filtres
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Résultat */}
      <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-sm text-muted-foreground">{filtre ? 'Résultat du filtre' : 'Tout ce qui a été encaissé'}</p>
        <p className="text-2xl font-bold">{somme(resultat.total)} <span className="text-sm font-normal text-muted-foreground">FCFA</span></p>
        <p className="text-sm text-muted-foreground">
          {filtrees.length} paiement{filtrees.length > 1 ? 's' : ''}
          {filtre && total.total > 0 && !masques ? ` · ${pct(resultat.total, total.total)} % du total encaissé` : ''}
        </p>
      </div>

      {masques ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <EyeOff className="h-4 w-4" />Montants masqués : cliquez sur l'œil en haut pour afficher les graphiques et le détail.
        </div>
      ) : filtrees.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Aucun encaissement pour ces filtres.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Évolution par mois</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evolution} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis dataKey="libelle" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} width={60} tickFormatter={v => fmt(Number(v))} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(v: number, nom: string) => [`${fmt(v)} FCFA`, LIBELLES_RUBRIQUE[nom as Rubrique] ?? nom]} />
                      <Legend formatter={(nom: string) => LIBELLES_RUBRIQUE[nom as Rubrique] ?? nom} wrapperStyle={{ fontSize: 12 }} />
                      {RUBRIQUES.map(r => <Bar key={r} dataKey={r} stackId="a" fill={COULEURS[r]} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><School className="h-4 w-4 text-primary" />Par classe</CardTitle></CardHeader>
              <CardContent>
                <div style={{ height: Math.max(256, classesRes.slice(0, 12).length * 28) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classesRes.slice(0, 12)} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                      <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tickFormatter={v => fmt(Number(v))} />
                      <YAxis type="category" dataKey="nom" tickLine={false} axisLine={false} fontSize={11} width={90} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        formatter={(v: number, nom: string) => [`${fmt(v)} FCFA`, LIBELLES_RUBRIQUE[nom as Rubrique] ?? nom]} />
                      {RUBRIQUES.map(r => <Bar key={r} dataKey={r} stackId="a" fill={COULEURS[r]} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Ce que chaque classe a payé</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Classe</th>
                      <th className="px-4 py-2 font-medium text-right">Élèves payeurs</th>
                      {RUBRIQUES.map(r => <th key={r} className="px-4 py-2 font-medium text-right">{LIBELLES_RUBRIQUE[r]}</th>)}
                      <th className="px-4 py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classesRes.map(c => (
                      <tr key={c.id} className="border-t hover:bg-muted/20">
                        <td className="px-4 py-2 font-medium">{c.nom}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{c.eleves}</td>
                        {RUBRIQUES.map(r => <td key={r} className="px-4 py-2 text-right whitespace-nowrap">{c[r] ? fmt(c[r]) : '—'}</td>)}
                        <td className="px-4 py-2 text-right font-semibold whitespace-nowrap">{fmt(c.total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="px-4 py-2">Total</td>
                      <td />
                      {RUBRIQUES.map(r => <td key={r} className="px-4 py-2 text-right whitespace-nowrap">{fmt(resultat[r])}</td>)}
                      <td className="px-4 py-2 text-right whitespace-nowrap">{fmt(resultat.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />Par frais</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {fraisRes.map(x => (
                <button key={x.frais} type="button" className="w-full text-left" onClick={() => changer({ frais: x.frais, rubrique: x.rubrique })}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-sm">{libelleFrais(x.frais)} <span className="text-xs text-muted-foreground">· {x.paiements} paiement{x.paiements > 1 ? 's' : ''}</span></span>
                    <span className="text-sm font-semibold whitespace-nowrap">{fmt(x.total)} FCFA</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={pct(x.total, resultat.total)} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-8 text-right">{pct(x.total, resultat.total)}%</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
