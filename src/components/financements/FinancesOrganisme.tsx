import { useMemo, useState } from 'react';
import {
  AlertTriangle, Ban, Banknote, FileText, GraduationCap, History, Layers, Loader2, Plus, Printer, Receipt, Trash2, User, Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancements } from '@/contexts/FinancementsContext';
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
import type { Organisme } from '@/lib/financements';
import {
  COULEUR_STATUT_FACTURE, LIBELLES_STATUT_FACTURE, alertesOrganisme, aujourdhuiIso, factureDeLaTranche, montantTranche,
  numeroFacture, situationFinanciere, sommeSituations, statutFacture, totalVerse,
  type FactureFinanceur, type SituationFinanciere, type StatutFacture, type Versement,
} from '@/lib/financementsSuivi';
import {
  fmt, formationsDe, messageDe, nomComplet, promotionsDe, type ApprenantFinance,
} from '@/components/financements/donneesOrganisme';

// ═══════════════════════════════════════════════════════════════════════════
// Rubrique « Gestion financière » d'un organisme : ses factures (acompte,
// solde…) pour un apprenant, une promotion, une formation ou tous ses
// apprenants ; les paiements reçus, confirmés avec un reçu ; la situation par
// apprenant, promotion et formation ; les alertes. Seuls les dossiers VALIDÉS
// se facturent.
// ═══════════════════════════════════════════════════════════════════════════

const F = (n: number) => `${fmt(n)} F`;
const jour = (iso?: string) => (iso ? dateDakar(`${iso}T12:00:00Z`) : '—');

type Portee = 'apprenant' | 'promotion' | 'formation' | 'tous';
type FiltreFacture = 'toutes' | StatutFacture;
type Regroupement = 'apprenant' | 'promotion' | 'formation';

/** Ce que couvre une facture, en clair : un apprenant, une promotion, une formation, ou tous. */
const useObjetFacture = (apprenants: ApprenantFinance[]) => {
  const promotions = promotionsDe(apprenants);
  const formationDe = new Map(apprenants.map(a => [a.eleve.id, a.formation]));
  return (f: FactureFinanceur): { court: string; long: string } => {
    if (f.portee === 'apprenant') {
      const formation = formationDe.get(f.lignes[0]?.studentEnrollmentId ?? '');
      return { court: f.lignes[0]?.nom ?? 'Apprenant', long: [formation?.name, f.lignes[0]?.nom].filter(Boolean).join(' · ') };
    }
    const promo = f.classId ? promotions.find(p => p.classId === f.classId) : undefined;
    if (promo) {
      const formation = apprenants.find(a => a.promotion?.id === promo.id)?.formation;
      return { court: promo.name, long: [formation?.name, promo.name].filter(Boolean).join(' · ') };
    }
    const formations = [...new Set(f.lignes.map(l => formationDe.get(l.studentEnrollmentId)?.name).filter(Boolean))];
    return formations.length === 1 ? { court: formations[0]!, long: formations[0]! } : { court: 'Tous les apprenants', long: 'Toutes formations' };
  };
};

export const FinancesOrganisme = ({ organisme, apprenants }: { organisme: Organisme; apprenants: ApprenantFinance[] }) => {
  const fin = useFinancements();
  const { school } = useAuth();
  const auj = aujourdhuiIso();
  const objet = useObjetFacture(apprenants);
  const factures = useMemo(() => fin.factures.filter(f => f.organismeId === organisme.id), [fin.factures, organisme.id]);
  const situations = useMemo(
    () => new Map(apprenants.map(a => [a.dossier.id, situationFinanciere(a.dossier.id, a.finance, factures, fin.versements)])),
    [apprenants, factures, fin.versements],
  );
  const total = sommeSituations([...situations.values()]);
  const promotions = promotionsDe(apprenants);
  const alertes = alertesOrganisme({
    organisme, dossiers: apprenants.map(a => a.dossier), factures, versements: fin.versements, rapports: fin.rapports,
    classeDe: d => apprenants.find(a => a.dossier.id === d.id)?.eleve.classId ?? undefined,
    promotions: promotions.map(p => ({ classId: p.classId, nom: p.name, finFormation: p.endDate })), aujourdhui: auj,
  });

  const [vue, setVue] = useState<'factures' | 'situation'>('factures');
  const [filtre, setFiltre] = useState<FiltreFacture>('toutes');
  const [regroupement, setRegroupement] = useState<Regroupement>('apprenant');
  const [facturer, setFacturer] = useState(false);
  const [ouverte, setOuverte] = useState<FactureFinanceur | null>(null);
  const [impression, setImpression] = useState<FactureFinanceur | null>(null);
  const [recu, setRecu] = useState<{ facture: FactureFinanceur; versement: Versement } | null>(null);

  if (!fin.suiviDisponible) {
    return (
      <div className="p-5">
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          La gestion financière n'est pas encore activée pour la base de données de l'école. Contactez l'assistance SenClass.
        </div>
      </div>
    );
  }

  const statutDe = (f: FactureFinanceur) => statutFacture(f, fin.versements, auj);
  const filtres: FiltreFacture[] = ['toutes', 'en_attente', 'en_retard', 'partielle', 'payee', 'annulee'];
  const visibles = [...factures]
    .filter(f => filtre === 'toutes' || statutDe(f) === filtre)
    .sort((a, b) => b.dateEmission.localeCompare(a.dateEmission) || b.numero - a.numero);

  const lignesSituation: { cle: string; nom: string; detail?: string; s: SituationFinanciere }[] = regroupement === 'apprenant'
    ? apprenants.map(a => ({ cle: a.dossier.id, nom: nomComplet(a.eleve), detail: a.dossier.statut === 'valide' ? a.promotion?.name : 'dossier non validé', s: situations.get(a.dossier.id)! }))
    : (regroupement === 'promotion' ? promotions.map(p => ({ id: p.id, nom: p.name, siens: apprenants.filter(a => a.promotion?.id === p.id) }))
      : formationsDe(apprenants).map(f => ({ id: f.id, nom: f.name, siens: apprenants.filter(a => a.formation?.id === f.id) })))
      .map(g => ({ cle: g.id, nom: g.nom, detail: `${g.siens.length} apprenant${g.siens.length > 1 ? 's' : ''}`, s: sommeSituations(g.siens.map(a => situations.get(a.dossier.id)!)) }));

  const versementsDe = (f: FactureFinanceur) => fin.versements.filter(v => v.factureId === f.id).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  return (
    <div className="p-5 space-y-5">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {([
          ['Pris en charge', total.finance, 'text-foreground'],
          ['Facturé', total.facture, 'text-foreground'],
          ['Reçu', total.recu, 'text-green-700 dark:text-green-400'],
          ['Reste à encaisser', total.finance - total.recu, total.finance - total.recu > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'],
        ] as const).map(([titre, montant, couleur]) => (
          <div key={titre} className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground">{titre}</p>
            <p className={`text-lg font-bold mt-0.5 ${couleur}`}>{fmt(montant)} <span className="text-xs font-normal text-muted-foreground">FCFA</span></p>
          </div>
        ))}
      </div>

      {alertes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900 p-3 space-y-1">
          {alertes.map(a => (
            <p key={a.texte} className={`text-sm flex items-center gap-2 ${a.niveau === 'rouge' ? 'text-red-700 dark:text-red-400' : 'text-amber-800 dark:text-amber-300'}`}>
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />{a.texte}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button variant={vue === 'factures' ? 'default' : 'ghost'} size="sm" onClick={() => setVue('factures')} className="gap-2"><FileText className="w-4 h-4" />Factures</Button>
          <Button variant={vue === 'situation' ? 'default' : 'ghost'} size="sm" onClick={() => setVue('situation')} className="gap-2"><Layers className="w-4 h-4" />Situation</Button>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setFacturer(true)} disabled={apprenants.length === 0}>
          <Plus className="h-3.5 w-3.5" />Émettre une facture
        </Button>
      </div>

      {vue === 'factures' ? (
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {filtres.map(fl => {
              const n = fl === 'toutes' ? factures.length : factures.filter(f => statutDe(f) === fl).length;
              if (fl !== 'toutes' && n === 0) return null;
              return (
                <button key={fl} onClick={() => setFiltre(fl)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${filtre === fl ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70 text-foreground'}`}>
                  {fl === 'toutes' ? 'Toutes' : LIBELLES_STATUT_FACTURE[fl]} <span className="opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          {factures.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aucune facture émise pour {organisme.nom}. Commencez par l'{organisme.tranches[0]?.libelle.toLowerCase() ?? 'acompte'} des dossiers validés.
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {visibles.map(f => {
                const statut = statutDe(f);
                return (
                  <button key={f.id} onClick={() => setOuverte(f)} className="w-full text-left px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 hover:bg-muted/30">
                    <span className="font-mono text-xs font-medium w-36">{numeroFacture(organisme.nom, f.annee, f.numero)}</span>
                    <span className="text-sm flex-1 min-w-[160px]">
                      {f.trancheLibelle}<span className="text-muted-foreground"> · {objet(f).court}{f.portee !== 'apprenant' ? ` (${f.lignes.length})` : ''}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{jour(f.dateEmission)}</span>
                    <span className="text-sm font-semibold w-28 text-right">{F(f.total)}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COULEUR_STATUT_FACTURE[statut]}`}>{LIBELLES_STATUT_FACTURE[statut]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <Select value={regroupement} onValueChange={v => setRegroupement(v as Regroupement)}>
            <SelectTrigger className="w-52" aria-label="Regrouper"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apprenant">Par apprenant</SelectItem>
              <SelectItem value="promotion">Par promotion</SelectItem>
              <SelectItem value="formation">Par formation</SelectItem>
            </SelectContent>
          </Select>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium min-w-[180px]">{regroupement === 'apprenant' ? 'Apprenant' : regroupement === 'promotion' ? 'Promotion' : 'Formation'}</th>
                  <th className="px-3 py-2 font-medium text-right">Pris en charge</th>
                  <th className="px-3 py-2 font-medium text-right">Facturé</th>
                  <th className="px-3 py-2 font-medium text-right">Reçu</th>
                  <th className="px-3 py-2 font-medium text-right">Reste</th>
                </tr>
              </thead>
              <tbody>
                {lignesSituation.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Aucun apprenant.</td></tr>
                ) : lignesSituation.map(l => (
                  <tr key={l.cle} className="border-t">
                    <td className="px-3 py-2"><div className="font-medium leading-tight">{l.nom}</div>{l.detail && <div className="text-xs text-muted-foreground">{l.detail}</div>}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{F(l.s.finance)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{F(l.s.facture)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap text-green-700 dark:text-green-400">{F(l.s.recu)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{F(l.s.finance - l.s.recu)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <DialogFacturer
        ouvert={facturer} organisme={organisme} apprenants={apprenants} factures={factures}
        onFermer={() => setFacturer(false)} onEmise={f => { setFacturer(false); setImpression(f); }}
      />
      <DialogFacture
        facture={ouverte} organisme={organisme} objet={ouverte ? objet(ouverte).long : ''} versementsDe={versementsDe}
        onFermer={() => setOuverte(null)} onImprimer={setImpression} onRecu={(facture, versement) => setRecu({ facture, versement })}
      />
      {impression && (
        <DocumentDialog
          ouvert onFermer={() => setImpression(null)}
          titre={`Facture ${numeroFacture(organisme.nom, impression.annee, impression.numero)}`}
          description="Imprimez ou téléchargez, puis transmettez à l'organisme."
          nomFichier={`Facture_${numeroFacture(organisme.nom, impression.annee, impression.numero)}`}
          typeDocument="facture"
          generer={async ({ economique }) => {
            const { genererFacturesFinanceurPdf } = await import('@/lib/factureFinanceurPdf');
            return genererFacturesFinanceurPdf(infosEcole(school), [{ facture: impression, organisme: organisme.nom, formation: objet(impression).long }], { economique });
          }}
        />
      )}
      {recu && (() => {
        const rang = versementsDe(recu.facture).findIndex(v => v.id === recu.versement.id) + 1;
        const n = `${numeroFacture(organisme.nom, recu.facture.annee, recu.facture.numero)}-${rang}`;
        return (
          <DocumentDialog
            ouvert onFermer={() => setRecu(null)}
            titre={`Reçu ${n}`}
            description={`Le reçu du versement de ${organisme.nom}, à lui remettre.`}
            nomFichier={`Recu_${n}`}
            typeDocument="recu"
            generer={async ({ economique }) => {
              const { genererRecuFinanceurPdf } = await import('@/lib/factureFinanceurPdf');
              const recuTotal = versementsDe(recu.facture).slice(0, rang).reduce((s, v) => s + v.montant, 0);
              return genererRecuFinanceurPdf(infosEcole(school), {
                facture: recu.facture, organisme: organisme.nom, formation: objet(recu.facture).long, versement: recu.versement, rang, recuTotal,
              }, { economique });
            }}
          />
        );
      })()}
    </div>
  );
};

// ─── Émettre une facture ────────────────────────────────────────────────────

const PORTEES: [Portee, string, React.ElementType][] = [
  ['apprenant', 'Un apprenant', User],
  ['promotion', 'Une promotion', Users],
  ['formation', 'Une formation', GraduationCap],
  ['tous', 'Tous', Layers],
];

const DialogFacturer = ({ ouvert, organisme, apprenants, factures, onFermer, onEmise }: {
  ouvert: boolean; organisme: Organisme; apprenants: ApprenantFinance[]; factures: FactureFinanceur[];
  onFermer: () => void; onEmise: (f: FactureFinanceur) => void;
}) => {
  const fin = useFinancements();
  const promotions = promotionsDe(apprenants);
  const formations = formationsDe(apprenants);
  const [portee, setPortee] = useState<Portee>('promotion');
  const [cible, setCible] = useState('');
  const [trancheId, setTrancheId] = useState('');
  const [coches, setCoches] = useState<Set<string> | null>(null);
  const [dateEmission, setDateEmission] = useState(aujourdhuiIso());
  const [echeance, setEcheance] = useState('');
  const [note, setNote] = useState('');
  const [enCours, setEnCours] = useState(false);

  const options = portee === 'apprenant' ? apprenants.map(a => ({ id: a.dossier.id, nom: nomComplet(a.eleve) }))
    : portee === 'promotion' ? promotions.map(p => ({ id: p.id, nom: p.name }))
    : portee === 'formation' ? formations.map(f => ({ id: f.id, nom: f.name })) : [];
  const choix = options.find(o => o.id === cible) ?? options[0];
  const dansLaPortee = apprenants.filter(a => portee === 'tous' ? true
    : portee === 'apprenant' ? a.dossier.id === choix?.id
    : portee === 'promotion' ? a.promotion?.id === choix?.id
    : a.formation?.id === choix?.id);
  const valides = dansLaPortee.filter(a => a.dossier.statut === 'valide');
  const nonValides = dansLaPortee.length - valides.length;
  const tranche = organisme.tranches.find(t => t.id === trancheId)
    ?? organisme.tranches.find(t => valides.some(a => !factureDeLaTranche(factures, a.dossier.id, t.id))) ?? organisme.tranches[0];
  const candidats = valides.filter(a => tranche && !factureDeLaTranche(factures, a.dossier.id, tranche.id));
  // Par défaut : ceux qui suivent (ou ont fini) la formation ; un abandon se coche à la main.
  const choisis = coches ?? new Set(candidats.filter(a => a.dossier.situation === 'en_formation' || a.dossier.situation === 'terminee').map(a => a.dossier.id));
  const retenus = candidats.filter(a => choisis.has(a.dossier.id));
  const montant = (a: ApprenantFinance) => (tranche ? montantTranche(organisme, tranche.id, a.finance) : 0);
  const total = retenus.reduce((s, a) => s + montant(a), 0);
  const basculer = (id: string) => { const s = new Set(choisis); if (s.has(id)) s.delete(id); else s.add(id); setCoches(s); };
  const changerPortee = (p: Portee) => { setPortee(p); setCible(''); setCoches(null); };

  const fermer = () => { if (!enCours) { setCoches(null); onFermer(); } };
  const emettre = async () => {
    if (!tranche || retenus.length === 0) return;
    if (retenus.some(a => montant(a) <= 0)) {
      toast({ title: 'Montant nul', description: "Un apprenant n'a aucun frais pris en charge (tarifs pas encore réglés ?). Décochez-le ou réglez ses frais.", variant: 'destructive' });
      return;
    }
    // Une promotion : sa classe. Un apprenant : la sienne. Une formation ou tous : aucune.
    const classId = portee === 'promotion' ? promotions.find(p => p.id === choix?.id)?.classId
      : portee === 'apprenant' ? retenus[0].eleve.classId ?? undefined : undefined;
    setEnCours(true);
    try {
      const [f] = await fin.emettreFactures([{
        organismeId: organisme.id, trancheId: tranche.id, trancheLibelle: tranche.libelle, tranchePourcentage: tranche.pourcentage,
        portee: portee === 'apprenant' ? 'apprenant' : 'cohorte', classId, dateEmission, dateEcheance: echeance || undefined, note,
        lignes: retenus.map(a => ({
          dossierId: a.dossier.id, studentEnrollmentId: a.eleve.id, nom: nomComplet(a.eleve), matricule: a.eleve.studentId, finance: a.finance, montant: montant(a),
        })),
      }]);
      toast({ title: 'Facture émise', description: `${tranche.libelle} · ${F(total)}` });
      setCoches(null); setNote(''); setEcheance('');
      onEmise(f);
    } catch (e) {
      toast({ title: 'Facture non émise', description: messageDe(e), variant: 'destructive' });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Dialog open={ouvert} onOpenChange={v => { if (!v) fermer(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" />Émettre une facture à {organisme.nom}</DialogTitle>
          <DialogDescription>Seuls les dossiers validés se facturent.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 -mx-1 px-1">
          <div className="space-y-1.5">
            <Label>Pour</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PORTEES.map(([v, libelle, Icone]) => (
                <button key={v} type="button" onClick={() => changerPortee(v)} aria-pressed={portee === v}
                  className={`text-sm px-3 py-2 rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${portee === v ? 'border-primary bg-primary/5 text-primary font-medium' : 'hover:bg-muted'}`}>
                  <Icone className="h-4 w-4" />{libelle}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {portee !== 'tous' && (
              <div className="space-y-1.5">
                <Label>{portee === 'apprenant' ? 'Apprenant' : portee === 'promotion' ? 'Promotion' : 'Formation'}</Label>
                <Select value={choix?.id ?? ''} onValueChange={v => { setCible(v); setCoches(null); }}>
                  <SelectTrigger aria-label="Cible de la facture"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{options.map(o => <SelectItem key={o.id} value={o.id}>{o.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Tranche</Label>
              <Select value={tranche?.id ?? ''} onValueChange={v => { setTrancheId(v); setCoches(null); }}>
                <SelectTrigger aria-label="Tranche"><SelectValue /></SelectTrigger>
                <SelectContent>{organisme.tranches.map(t => <SelectItem key={t.id} value={t.id}>{t.libelle} ({String(t.pourcentage).replace('.', ',')} %)</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border">
            {candidats.length === 0 ? (
              <p className="p-5 text-center text-sm text-muted-foreground">
                {valides.length === 0 ? 'Aucun dossier validé ici.' : 'Cette tranche est déjà facturée pour tous.'}
              </p>
            ) : candidats.map(a => (
              <label key={a.dossier.id} className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 text-sm cursor-pointer hover:bg-muted/30">
                <Checkbox checked={choisis.has(a.dossier.id)} onCheckedChange={() => basculer(a.dossier.id)} aria-label={nomComplet(a.eleve)} />
                <span className="flex-1"><span className="font-medium">{a.eleve.lastName}</span> {a.eleve.firstName}
                  {a.dossier.situation !== 'en_formation' && <span className="text-xs text-amber-700 ml-1.5">({a.dossier.situation === 'terminee' ? 'formation terminée' : 'sorti de formation'})</span>}
                </span>
                <span className="font-medium">{F(montant(a))}</span>
              </label>
            ))}
          </div>
          {nonValides > 0 && (
            <p className="text-xs text-muted-foreground">{nonValides} dossier{nonValides > 1 ? 's' : ''} pas encore validé{nonValides > 1 ? 's' : ''} : non facturable{nonValides > 1 ? 's' : ''}.</p>
          )}

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
          <p className="text-sm mr-auto">{retenus.length > 0 && <>{retenus.length} apprenant{retenus.length > 1 ? 's' : ''} · total <span className="font-semibold">{F(total)}</span></>}</p>
          <Button variant="outline" onClick={fermer} disabled={enCours}>Annuler</Button>
          <Button onClick={() => void emettre()} disabled={enCours || retenus.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dateEmission)} className="gap-2">
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Émettre et imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Une facture : paiements reçus, reçus, annulation, historique ───────────

const DialogFacture = ({ facture, organisme, objet, versementsDe, onFermer, onImprimer, onRecu }: {
  facture: FactureFinanceur | null; organisme: Organisme; objet: string; versementsDe: (f: FactureFinanceur) => Versement[];
  onFermer: () => void; onImprimer: (f: FactureFinanceur) => void; onRecu: (f: FactureFinanceur, v: Versement) => void;
}) => {
  const fin = useFinancements();
  const { accountRole } = useAuth();
  const auj = aujourdhuiIso();
  const f = facture ? fin.factures.find(x => x.id === facture.id) ?? facture : null;
  const [saisie, setSaisie] = useState(false);
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(auj);
  const [reference, setReference] = useState('');
  const [motif, setMotif] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  if (!f) return null;
  const versements = versementsDe(f);
  const verse = totalVerse(f.id, fin.versements);
  const reste = Math.max(0, f.total - verse);
  const statut = statutFacture(f, fin.versements, auj);
  const historique = fin.journal.filter(j => j.objet === 'facture' && j.objetId === f.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const fermer = () => { setSaisie(false); setMotif(null); onFermer(); };

  const confirmer = async () => {
    const m = Math.round(Number(montant.replace(/\s/g, '').replace(',', '.') || reste));
    if (!(m > 0)) { toast({ title: 'Montant invalide', variant: 'destructive' }); return; }
    if (m > reste) { toast({ title: 'Montant trop élevé', description: `Il ne reste que ${F(reste)} à recevoir sur cette facture.`, variant: 'destructive' }); return; }
    setOccupe(true);
    try {
      const v = await fin.ajouterVersement(f.id, { montant: m, date, reference });
      setMontant(''); setReference(''); setSaisie(false);
      toast({ title: 'Paiement confirmé', description: F(m) });
      onRecu(f, v);
    } catch (e) { toast({ title: 'Paiement non enregistré', description: messageDe(e), variant: 'destructive' }); } finally { setOccupe(false); }
  };
  const annuler = async () => {
    if (!motif?.trim()) { toast({ title: "Indiquez le motif de l'annulation", variant: 'destructive' }); return; }
    setOccupe(true);
    try { await fin.annulerFacture(f.id, motif); setMotif(null); toast({ title: 'Facture annulée', description: 'Son numéro reste réservé ; la tranche peut être refacturée.' }); }
    catch (e) { toast({ title: 'Annulation impossible', description: messageDe(e), variant: 'destructive' }); } finally { setOccupe(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) fermer(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <FileText className="h-5 w-5 text-primary" /><span className="font-mono">{numeroFacture(organisme.nom, f.annee, f.numero)}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COULEUR_STATUT_FACTURE[statut]}`}>{LIBELLES_STATUT_FACTURE[statut]}</span>
          </DialogTitle>
          <DialogDescription>{f.trancheLibelle} · {objet} · émise le {jour(f.dateEmission)}{f.dateEcheance ? ` · échéance ${jour(f.dateEcheance)}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 -mx-1 px-1">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Facturé</p><p className="font-bold">{F(f.total)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Reçu</p><p className="font-bold text-green-700 dark:text-green-400">{F(verse)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Reste</p><p className="font-bold">{F(reste)}</p></div>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Banknote className="h-4 w-4 text-primary" />Paiements reçus</h3>
              {!f.annulee && reste > 0 && !saisie && (
                <Button size="sm" className="gap-1.5 h-8" onClick={() => { setDate(auj); setSaisie(true); }}><Plus className="h-3.5 w-3.5" />Confirmer un paiement</Button>
              )}
            </div>
            {saisie && (
              <div className="rounded-xl border p-3 space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1"><Label htmlFor="v-montant" className="text-xs">Montant reçu</Label>
                    <Input id="v-montant" inputMode="numeric" placeholder={String(reste)} value={montant} onChange={e => setMontant(e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="v-date" className="text-xs">Date</Label>
                    <Input id="v-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                  <div className="space-y-1"><Label htmlFor="v-ref" className="text-xs">Référence (virement, chèque…)</Label>
                    <Input id="v-ref" value={reference} onChange={e => setReference(e.target.value)} /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSaisie(false)} disabled={occupe}>Annuler</Button>
                  <Button size="sm" onClick={() => void confirmer()} disabled={occupe} className="gap-1.5">
                    {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}Confirmer et imprimer le reçu
                  </Button>
                </div>
              </div>
            )}
            {versements.length === 0 ? (!saisie && <p className="text-sm text-muted-foreground">Aucun paiement reçu pour l'instant.</p>) : (
              <div className="rounded-lg border divide-y text-sm">
                {versements.map(v => (
                  <div key={v.id} className="group flex items-center gap-3 px-3 py-1.5">
                    <span className="w-24">{jour(v.date)}</span>
                    <span className="flex-1 text-muted-foreground truncate">{v.reference ? `Réf. ${v.reference}` : ''}</span>
                    <span className="font-medium">{F(v.montant)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Imprimer le reçu" aria-label="Imprimer le reçu" onClick={() => onRecu(f, v)}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    {accountRole === 'admin' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" aria-label="Retirer ce paiement"
                        onClick={() => void fin.supprimerVersement(v.id).catch(e => toast({ title: 'Paiement non retiré', description: messageDe(e), variant: 'destructive' }))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold">{f.lignes.length} apprenant{f.lignes.length > 1 ? 's' : ''}</h3>
            <div className="rounded-lg border divide-y max-h-48 overflow-y-auto text-sm">
              {f.lignes.map(l => (
                <div key={l.dossierId} className="flex justify-between gap-2 px-3 py-1.5"><span>{l.nom} <span className="text-xs text-muted-foreground">{l.matricule}</span></span><span className="font-medium">{F(l.montant)}</span></div>
              ))}
            </div>
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
          <Button variant="outline" className="gap-1.5" onClick={() => onImprimer(f)}><Printer className="h-4 w-4" />Imprimer la facture</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
