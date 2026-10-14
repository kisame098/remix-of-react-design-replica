import { useMemo, useState } from 'react';
import { AlertTriangle, Ban, Banknote, FileText, History, Loader2, Plus, Printer, Receipt, Trash2, Users, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancements } from '@/contexts/FinancementsContext';
import type { Student } from '@/contexts/SchoolContext';
import { useElementsAPayer } from '@/hooks/useElementsAPayer';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DocumentDialog } from '@/components/documents/DocumentDialog';
import { toast } from '@/hooks/use-toast';
import { infosEcole, dateDakar } from '@/lib/documentsEcole';
import { montantFinance, type Dossier, type Organisme } from '@/lib/financements';
import {
  COULEUR_STATUT_FACTURE, LIBELLES_STATUT_FACTURE, alertesCohorte, aujourdhuiIso, factureDeLaTranche, montantTranche,
  numeroFacture, situationFinanciere, sommeSituations, statutFacture, totalVerse,
  type FactureFinanceur, type PorteeFacture, type SituationFinanciere,
} from '@/lib/financementsSuivi';
import type { DonneesFactureFinanceur } from '@/lib/factureFinanceurPdf';

// ═══════════════════════════════════════════════════════════════════════════
// Onglet « Finances » d'une promotion financée : ce que l'organisme prend en
// charge, ce qui est facturé, ce qui est reçu — par apprenant et pour la
// cohorte —, les factures et leurs versements, et les alertes.
// ═══════════════════════════════════════════════════════════════════════════

const fmt = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} F`;
const jour = (iso?: string) => (iso ? dateDakar(`${iso}T12:00:00Z`) : '—');
const messageDe = (e: unknown) => (e as { message?: string })?.message ?? String(e);

export interface LigneFinancee { eleve: Student; dossier: Dossier; organisme?: Organisme }

/** Les chiffres d'une cohorte, en cinq cartes. */
export const CartesSituation = ({ s }: { s: SituationFinanciere }) => (
  <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
    {([
      ['Pris en charge', s.finance, 'text-foreground'],
      ['Facturé', s.facture, 'text-foreground'],
      ['Reçu', s.recu, 'text-green-700 dark:text-green-400'],
      ['Reste à facturer', s.resteAFacturer, s.resteAFacturer > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'],
      ['Reste à encaisser', s.resteAEncaisser, s.resteAEncaisser > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'],
    ] as const).map(([titre, montant, couleur]) => (
      <div key={titre} className="rounded-xl border bg-card p-3">
        <p className="text-xs text-muted-foreground">{titre}</p>
        <p className={`text-lg font-bold mt-0.5 ${couleur}`}>{fmt(montant)}</p>
      </div>
    ))}
  </div>
);

export const OngletFinances = ({ lignes, classId, nomFormation, finFormation }: {
  lignes: LigneFinancee[]; classId: string; nomFormation: string; finFormation?: string;
}) => {
  const fin = useFinancements();
  const { school } = useAuth();
  const { elementsDe } = useElementsAPayer();
  const auj = aujourdhuiIso();

  // Prise en charge de l'année pour chacun (tarif normal des frais concernés).
  const financeDe = useMemo(() => new Map(lignes.map(l => [
    l.dossier.id, l.organisme ? montantFinance(l.organisme, elementsDe(l.eleve)).finance : 0,
  ])), [lignes, elementsDe]);
  const facturesPromo = useMemo(() => fin.factures.filter(f => f.classId === classId), [fin.factures, classId]);
  const situations = useMemo(() => new Map(lignes.map(l => [
    l.dossier.id, situationFinanciere(l.dossier.id, financeDe.get(l.dossier.id) ?? 0, facturesPromo, fin.versements),
  ])), [lignes, financeDe, facturesPromo, fin.versements]);
  const total = sommeSituations([...situations.values()]);
  const alertes = alertesCohorte({
    dossiers: lignes.map(l => l.dossier), organismes: fin.reglages.organismes, factures: facturesPromo,
    versements: fin.versements, rapports: fin.rapports, classId, finFormation, aujourdhui: auj,
  });
  // Les tranches à afficher : celles des organismes présents dans la promotion.
  const organismes = [...new Map(lignes.filter(l => l.organisme).map(l => [l.organisme!.id, l.organisme!])).values()];

  const [facturer, setFacturer] = useState(false);
  const [ouverte, setOuverte] = useState<FactureFinanceur | null>(null);
  const [impression, setImpression] = useState<FactureFinanceur[] | null>(null);

  if (!fin.suiviDisponible) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Les finances du module ne sont pas encore activées pour la base de données de l'école. Contactez l'assistance SenClass.
      </div>
    );
  }

  const nomOrganisme = (id: string) => fin.organisme(id)?.nom ?? 'Organisme';
  const donneesPdf = (f: FactureFinanceur): DonneesFactureFinanceur => ({ facture: f, organisme: nomOrganisme(f.organismeId), formation: nomFormation });

  return (
    <div className="space-y-5">
      <CartesSituation s={total} />

      {alertes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900 p-3 space-y-1">
          {alertes.map(a => (
            <p key={a.texte} className={`text-sm flex items-center gap-2 ${a.niveau === 'rouge' ? 'text-red-700 dark:text-red-400' : 'text-amber-800 dark:text-amber-300'}`}>
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />{a.texte}
            </p>
          ))}
        </div>
      )}

      {/* Par apprenant */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">Par apprenant</h3>
          <Button size="sm" className="gap-1.5" onClick={() => setFacturer(true)} disabled={lignes.length === 0}>
            <Plus className="h-3.5 w-3.5" />Émettre une facture
          </Button>
        </div>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium min-w-[160px]">Apprenant</th>
                <th className="px-3 py-2 font-medium text-right">Pris en charge</th>
                {organismes.flatMap(o => o.tranches.map(t => (
                  <th key={`${o.id}-${t.id}`} className="px-3 py-2 font-medium text-center whitespace-nowrap">{organismes.length > 1 ? `${o.nom} · ` : ''}{t.libelle}</th>
                )))}
                <th className="px-3 py-2 font-medium text-right">Reçu</th>
                <th className="px-3 py-2 font-medium text-right">Reste dû</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ eleve: e, dossier: d, organisme: o }) => {
                const s = situations.get(d.id)!;
                return (
                  <tr key={d.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium leading-tight">{e.lastName}</div>
                      <div className="text-xs text-muted-foreground">{e.firstName}</div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(s.finance)}</td>
                    {organismes.flatMap(org => org.tranches.map(t => {
                      if (!o || org.id !== o.id) return <td key={`${org.id}-${t.id}`} className="px-3 py-2 text-center text-muted-foreground">·</td>;
                      const f = factureDeLaTranche(facturesPromo, d.id, t.id);
                      const statut = f ? statutFacture(f, fin.versements, auj) : null;
                      return (
                        <td key={`${org.id}-${t.id}`} className="px-3 py-2 text-center">
                          {f && statut ? (
                            <button onClick={() => setOuverte(f)} className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${COULEUR_STATUT_FACTURE[statut]}`}>
                              {LIBELLES_STATUT_FACTURE[statut]}
                            </button>
                          ) : <span className="text-xs text-muted-foreground whitespace-nowrap">À facturer · {fmt(montantTranche(o, t.id, s.finance))}</span>}
                        </td>
                      );
                    }))}
                    <td className="px-3 py-2 text-right whitespace-nowrap text-green-700 dark:text-green-400">{fmt(s.recu)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{fmt(s.finance - s.recu)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Factures émises */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Factures émises</h3>
        {facturesPromo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune facture émise pour cette promotion.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {[...facturesPromo].sort((a, b) => b.dateEmission.localeCompare(a.dateEmission) || b.numero - a.numero).map(f => {
              const statut = statutFacture(f, fin.versements, auj);
              return (
                <button key={f.id} onClick={() => setOuverte(f)} className="w-full text-left px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 hover:bg-muted/30">
                  <span className="font-mono text-xs font-medium w-36">{numeroFacture(nomOrganisme(f.organismeId), f.annee, f.numero)}</span>
                  <span className="text-sm flex-1 min-w-[160px]">
                    {f.trancheLibelle}
                    <span className="text-muted-foreground"> · {f.portee === 'cohorte' ? `cohorte, ${f.lignes.length} apprenant${f.lignes.length > 1 ? 's' : ''}` : f.lignes[0]?.nom}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{jour(f.dateEmission)}</span>
                  <span className="text-sm font-semibold w-28 text-right">{fmt(f.total)}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COULEUR_STATUT_FACTURE[statut]}`}>{LIBELLES_STATUT_FACTURE[statut]}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <DialogFacturer
        ouvert={facturer} lignes={lignes} financeDe={financeDe} classId={classId} factures={facturesPromo}
        onFermer={() => setFacturer(false)} onEmises={f => { setFacturer(false); setImpression(f); }}
      />
      <DialogFacture facture={ouverte} onFermer={() => setOuverte(null)} onImprimer={f => setImpression([f])} />
      {impression && (
        <DocumentDialog
          ouvert onFermer={() => setImpression(null)}
          titre={impression.length === 1 ? `Facture ${numeroFacture(nomOrganisme(impression[0].organismeId), impression[0].annee, impression[0].numero)}` : `${impression.length} factures`}
          description="Imprimez ou téléchargez, puis transmettez à l'organisme."
          nomFichier={impression.length === 1 ? `Facture_${numeroFacture(nomOrganisme(impression[0].organismeId), impression[0].annee, impression[0].numero)}` : 'Factures_financeur'}
          typeDocument="facture"
          generer={async ({ economique }) => {
            const { genererFacturesFinanceurPdf } = await import('@/lib/factureFinanceurPdf');
            return genererFacturesFinanceurPdf(infosEcole(school), impression.map(donneesPdf), { economique });
          }}
        />
      )}
    </div>
  );
};

// ─── Émettre ────────────────────────────────────────────────────────────────

const DialogFacturer = ({ ouvert, lignes, financeDe, classId, factures, onFermer, onEmises }: {
  ouvert: boolean; lignes: LigneFinancee[]; financeDe: Map<string, number>; classId: string; factures: FactureFinanceur[];
  onFermer: () => void; onEmises: (f: FactureFinanceur[]) => void;
}) => {
  const fin = useFinancements();
  const organismes = [...new Map(lignes.filter(l => l.organisme).map(l => [l.organisme!.id, l.organisme!])).values()];
  const [organismeId, setOrganismeId] = useState('');
  const [trancheId, setTrancheId] = useState('');
  const [portee, setPortee] = useState<PorteeFacture>('cohorte');
  const [coches, setCoches] = useState<Set<string> | null>(null);
  const [dateEmission, setDateEmission] = useState(aujourdhuiIso());
  const [echeance, setEcheance] = useState('');
  const [note, setNote] = useState('');
  const [enCours, setEnCours] = useState(false);

  const o = organismes.find(x => x.id === organismeId) ?? organismes[0];
  const tranche = o?.tranches.find(t => t.id === trancheId) ?? o?.tranches.find(t => lignes.some(l => l.organisme?.id === o.id && !factureDeLaTranche(factures, l.dossier.id, t.id))) ?? o?.tranches[0];
  // Les apprenants de cet organisme dont la tranche n'est pas encore facturée.
  const candidats = lignes.filter(l => l.organisme?.id === o?.id && tranche && !factureDeLaTranche(factures, l.dossier.id, tranche.id));
  // Par défaut : ceux qui suivent (ou ont fini) la formation ; un abandon se coche à la main.
  const choisis = coches ?? new Set(candidats.filter(l => l.dossier.situation === 'en_formation' || l.dossier.situation === 'terminee').map(l => l.dossier.id));
  const retenus = candidats.filter(l => choisis.has(l.dossier.id));
  const montant = (l: LigneFinancee) => (o && tranche ? montantTranche(o, tranche.id, financeDe.get(l.dossier.id) ?? 0) : 0);
  const total = retenus.reduce((s, l) => s + montant(l), 0);
  const basculer = (id: string) => { const s = new Set(choisis); if (s.has(id)) s.delete(id); else s.add(id); setCoches(s); };

  const emettre = async () => {
    if (!o || !tranche || retenus.length === 0) return;
    if (retenus.some(l => montant(l) <= 0)) {
      toast({ title: 'Montant nul', description: "Un apprenant n'a aucun frais pris en charge (tarifs pas encore réglés ?). Décochez-le ou réglez ses frais.", variant: 'destructive' });
      return;
    }
    setEnCours(true);
    try {
      const ligne = (l: LigneFinancee) => ({
        dossierId: l.dossier.id, studentEnrollmentId: l.eleve.id, nom: `${l.eleve.lastName} ${l.eleve.firstName}`,
        matricule: l.eleve.studentId, finance: financeDe.get(l.dossier.id) ?? 0, montant: montant(l),
      });
      const base = { organismeId: o.id, trancheId: tranche.id, trancheLibelle: tranche.libelle, tranchePourcentage: tranche.pourcentage, classId, dateEmission, dateEcheance: echeance || undefined, note };
      const creees = await fin.emettreFactures(portee === 'cohorte'
        ? [{ ...base, portee, lignes: retenus.map(ligne) }]
        : retenus.map(l => ({ ...base, portee, lignes: [ligne(l)] })));
      toast({ title: creees.length === 1 ? 'Facture émise' : `${creees.length} factures émises`, description: `${tranche.libelle} · ${fmt(total)}` });
      setCoches(null); setNote(''); setEcheance('');
      onEmises(creees);
    } catch (e) {
      toast({ title: 'Facture non émise', description: messageDe(e), variant: 'destructive' });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Dialog open={ouvert} onOpenChange={v => { if (!v && !enCours) { setCoches(null); onFermer(); } }}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" />Émettre une facture</DialogTitle>
          <DialogDescription>Une tranche (acompte, solde…) pour la cohorte entière, ou une facture par apprenant.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 -mx-1 px-1">
          <div className="grid gap-3 sm:grid-cols-2">
            {organismes.length > 1 && (
              <div className="space-y-1.5">
                <Label>Organisme</Label>
                <Select value={o?.id ?? ''} onValueChange={v => { setOrganismeId(v); setTrancheId(''); setCoches(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{organismes.map(x => <SelectItem key={x.id} value={x.id}>{x.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Tranche</Label>
              <Select value={tranche?.id ?? ''} onValueChange={v => { setTrancheId(v); setCoches(null); }}>
                <SelectTrigger aria-label="Tranche"><SelectValue /></SelectTrigger>
                <SelectContent>{o?.tranches.map(t => <SelectItem key={t.id} value={t.id}>{t.libelle} ({String(t.pourcentage).replace('.', ',')} %)</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Facturer</Label>
            <div className="flex flex-wrap gap-2">
              {([['cohorte', 'Une facture pour la cohorte', Users], ['apprenant', 'Une facture par apprenant', User]] as const).map(([v, libelle, Icone]) => (
                <button key={v} type="button" onClick={() => setPortee(v)} aria-pressed={portee === v}
                  className={`text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${portee === v ? 'border-primary bg-primary/5 text-primary font-medium' : 'hover:bg-muted'}`}>
                  <Icone className="h-4 w-4" />{libelle}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border">
            {candidats.length === 0 ? (
              <p className="p-5 text-center text-sm text-muted-foreground">Cette tranche est déjà facturée pour tous les apprenants.</p>
            ) : candidats.map(l => (
              <label key={l.dossier.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 text-sm cursor-pointer hover:bg-muted/30">
                <Checkbox checked={choisis.has(l.dossier.id)} onCheckedChange={() => basculer(l.dossier.id)} aria-label={`${l.eleve.lastName} ${l.eleve.firstName}`} />
                <span className="flex-1"><span className="font-medium">{l.eleve.lastName}</span> {l.eleve.firstName}
                  {l.dossier.situation !== 'en_formation' && <span className="text-xs text-amber-700 ml-1.5">({l.dossier.situation === 'terminee' ? 'formation terminée' : 'sorti de formation'})</span>}
                </span>
                <span className="font-medium">{fmt(montant(l))}</span>
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="fac-date">Date d'émission</Label>
              <Input id="fac-date" type="date" value={dateEmission} onChange={e => setDateEmission(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="fac-echeance">Échéance (facultative)</Label>
              <Input id="fac-echeance" type="date" value={echeance} onChange={e => setEcheance(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="fac-note">Mention sur la facture (facultative)</Label>
            <Textarea id="fac-note" rows={2} value={note} placeholder="Référence de la convention, coordonnées bancaires…" onChange={e => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter className="items-center gap-2">
          <p className="text-sm mr-auto">
            {retenus.length > 0 && <><span className="font-semibold">{portee === 'cohorte' ? '1 facture' : `${retenus.length} facture${retenus.length > 1 ? 's' : ''}`}</span> · total {fmt(total)}</>}
          </p>
          <Button variant="outline" onClick={onFermer} disabled={enCours}>Annuler</Button>
          <Button onClick={() => void emettre()} disabled={enCours || retenus.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dateEmission)} className="gap-2">
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Émettre et imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Une facture : versements, annulation, historique ───────────────────────

const DialogFacture = ({ facture, onFermer, onImprimer }: { facture: FactureFinanceur | null; onFermer: () => void; onImprimer: (f: FactureFinanceur) => void }) => {
  const fin = useFinancements();
  const { accountRole } = useAuth();
  const auj = aujourdhuiIso();
  const f = facture ? fin.factures.find(x => x.id === facture.id) ?? facture : null;
  const versements = f ? fin.versements.filter(v => v.factureId === f.id).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const verse = f ? totalVerse(f.id, fin.versements) : 0;
  const reste = f ? Math.max(0, f.total - verse) : 0;
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(auj);
  const [reference, setReference] = useState('');
  const [motif, setMotif] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  if (!f) return null;
  const statut = statutFacture(f, fin.versements, auj);
  const nom = fin.organisme(f.organismeId)?.nom ?? 'Organisme';
  const historique = fin.journal.filter(j => j.objet === 'facture' && j.objetId === f.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const enregistrerVersement = async () => {
    const m = Math.round(Number(montant.replace(/\s/g, '').replace(',', '.')));
    if (!(m > 0)) { toast({ title: 'Montant invalide', variant: 'destructive' }); return; }
    if (m > reste) { toast({ title: 'Montant trop élevé', description: `Il ne reste que ${fmt(reste)} à encaisser sur cette facture.`, variant: 'destructive' }); return; }
    setOccupe(true);
    try { await fin.ajouterVersement(f.id, { montant: m, date, reference }); setMontant(''); setReference(''); toast({ title: 'Versement enregistré', description: fmt(m) }); }
    catch (e) { toast({ title: 'Versement non enregistré', description: messageDe(e), variant: 'destructive' }); }
    finally { setOccupe(false); }
  };
  const annuler = async () => {
    if (!motif?.trim()) { toast({ title: "Indiquez le motif de l'annulation", variant: 'destructive' }); return; }
    setOccupe(true);
    try { await fin.annulerFacture(f.id, motif); setMotif(null); toast({ title: 'Facture annulée', description: 'Son numéro reste réservé ; la tranche peut être refacturée.' }); }
    catch (e) { toast({ title: 'Annulation impossible', description: messageDe(e), variant: 'destructive' }); }
    finally { setOccupe(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onFermer(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <FileText className="h-5 w-5 text-primary" /><span className="font-mono">{numeroFacture(nom, f.annee, f.numero)}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COULEUR_STATUT_FACTURE[statut]}`}>{LIBELLES_STATUT_FACTURE[statut]}</span>
          </DialogTitle>
          <DialogDescription>{nom} · {f.trancheLibelle} · émise le {jour(f.dateEmission)}{f.dateEcheance ? ` · échéance ${jour(f.dateEcheance)}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 -mx-1 px-1">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Facturé</p><p className="font-bold">{fmt(f.total)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Reçu</p><p className="font-bold text-green-700 dark:text-green-400">{fmt(verse)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Reste</p><p className="font-bold">{fmt(reste)}</p></div>
          </div>

          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold">{f.lignes.length} apprenant{f.lignes.length > 1 ? 's' : ''}</h3>
            <div className="rounded-lg border divide-y max-h-48 overflow-y-auto text-sm">
              {f.lignes.map(l => (
                <div key={l.dossierId} className="flex justify-between gap-2 px-3 py-1.5"><span>{l.nom} <span className="text-xs text-muted-foreground">{l.matricule}</span></span><span className="font-medium">{fmt(l.montant)}</span></div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Banknote className="h-4 w-4 text-primary" />Versements reçus</h3>
            {versements.length === 0 ? <p className="text-sm text-muted-foreground">Aucun versement pour l'instant.</p> : (
              <div className="rounded-lg border divide-y text-sm">
                {versements.map(v => (
                  <div key={v.id} className="group flex items-center gap-3 px-3 py-1.5">
                    <span className="w-24">{jour(v.date)}</span>
                    <span className="flex-1 text-muted-foreground truncate">{v.reference ? `Réf. ${v.reference}` : ''}</span>
                    <span className="font-medium">{fmt(v.montant)}</span>
                    {accountRole === 'admin' && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" aria-label="Retirer ce versement"
                        onClick={() => void fin.supprimerVersement(v.id).catch(e => toast({ title: 'Versement non retiré', description: messageDe(e), variant: 'destructive' }))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!f.annulee && reste > 0 && (
              <div className="grid gap-2 sm:grid-cols-[1fr_150px_1fr_auto] items-end">
                <div className="space-y-1"><Label htmlFor="v-montant" className="text-xs">Montant reçu</Label>
                  <Input id="v-montant" inputMode="numeric" placeholder={String(reste)} value={montant} onChange={e => setMontant(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="v-date" className="text-xs">Date</Label>
                  <Input id="v-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="v-ref" className="text-xs">Référence (virement, chèque…)</Label>
                  <Input id="v-ref" value={reference} onChange={e => setReference(e.target.value)} /></div>
                <Button onClick={() => void enregistrerVersement()} disabled={occupe} className="gap-1.5">
                  {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Enregistrer
                </Button>
              </div>
            )}
          </section>

          {historique.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><History className="h-4 w-4 text-primary" />Historique</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                {historique.map(h => <li key={h.id}><span className="text-foreground font-medium">{h.action}</span>{h.detail ? ` — ${h.detail}` : ''} · {new Date(h.createdAt).toLocaleString('fr-FR')}{h.parNom ? ` · ${h.parNom}` : ''}</li>)}
              </ul>
            </section>
          )}

          {motif !== null && (
            <div className="rounded-lg border border-destructive/40 p-3 space-y-2">
              <Label htmlFor="f-motif">Motif de l'annulation *</Label>
              <Input id="f-motif" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Erreur de montant, apprenant en trop…" />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setMotif(null)}>Garder la facture</Button>
                <Button variant="destructive" size="sm" onClick={() => void annuler()} disabled={occupe}>Annuler la facture</Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 pt-3 border-t">
          {!f.annulee && verse === 0 && motif === null ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setMotif('')}><Ban className="h-4 w-4" />Annuler la facture</Button>
          ) : <span className="text-xs text-muted-foreground">{f.annulee ? `Annulée${f.note ? ` : ${f.note}` : ''}` : verse > 0 ? 'Une facture déjà payée en partie ne s\'annule pas.' : ''}</span>}
          <Button variant="outline" className="gap-1.5" onClick={() => onImprimer(f)}><Printer className="h-4 w-4" />Imprimer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
