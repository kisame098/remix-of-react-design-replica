import { useState } from 'react';
import { BriefcaseBusiness, Clock, Loader2, Plus, Trash2 } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { dateDakar } from '@/lib/documentsEcole';
import {
  ANCIENNETE_INSERTION_JOURS, COULEUR_INSERTION, LIBELLES_INSERTION, SITUATIONS_INSERTION, aujourdhuiIso, estInsere,
  insertionActuelle, joursDepuis, type SituationInsertion,
} from '@/lib/financementsSuivi';
import type { LigneFinancee } from '@/components/financements/OngletFinances';

// ═══════════════════════════════════════════════════════════════════════════
// Onglet « Insertion » : la situation professionnelle de chaque bénéficiaire
// après la formation. Chaque mise à jour est un point daté qui s'ajoute (on ne
// réécrit jamais l'histoire) ; la plus récente fait foi. Une situation non
// mise à jour depuis 90 jours est signalée « à relancer ».
// ═══════════════════════════════════════════════════════════════════════════

const jour = (iso: string) => dateDakar(`${iso}T12:00:00Z`);
const messageDe = (e: unknown) => (e as { message?: string })?.message ?? String(e);

export const OngletInsertion = ({ lignes }: { lignes: LigneFinancee[] }) => {
  const fin = useFinancements();
  const auj = aujourdhuiIso();
  const [ouvert, setOuvert] = useState<LigneFinancee | null>(null);

  if (!fin.suiviDisponible) {
    return <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Le suivi de l'insertion n'est pas encore activé pour la base de données de l'école. Contactez l'assistance SenClass.</div>;
  }
  const actuelles = lignes.map(l => ({ l, p: insertionActuelle(fin.insertions, l.dossier.id) }));
  const inseres = actuelles.filter(x => x.p && estInsere(x.p.situation)).length;
  const recherche = actuelles.filter(x => x.p?.situation === 'recherche').length;
  const sansSuivi = actuelles.filter(x => !x.p).length;
  const aRelancer = actuelles.filter(x => x.p && joursDepuis(x.p.date, auj) > ANCIENNETE_INSERTION_JOURS).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {([
          ['Insérés', inseres, 'text-green-700 dark:text-green-400', 'emploi, à son compte ou en stage'],
          ["En recherche d'emploi", recherche, 'text-amber-700 dark:text-amber-400', ''],
          ['Sans situation saisie', sansSuivi, 'text-muted-foreground', ''],
          ['À relancer', aRelancer, aRelancer ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground', `pas de nouvelles depuis ${ANCIENNETE_INSERTION_JOURS} jours`],
        ] as const).map(([titre, n, couleur, aide]) => (
          <div key={titre} className="rounded-xl border bg-card p-3">
            <p className="text-xs text-muted-foreground">{titre}</p>
            <p className={`text-xl font-bold ${couleur}`}>{n}<span className="text-sm font-normal text-muted-foreground"> / {lignes.length}</span></p>
            {aide && <p className="text-[11px] text-muted-foreground">{aide}</p>}
          </div>
        ))}
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium min-w-[160px]">Bénéficiaire</th>
              <th className="px-3 py-2 font-medium">Situation actuelle</th>
              <th className="px-3 py-2 font-medium min-w-[180px]">Structure · poste</th>
              <th className="px-3 py-2 font-medium">Depuis le</th>
            </tr>
          </thead>
          <tbody>
            {actuelles.map(({ l, p }) => {
              const ancien = p && joursDepuis(p.date, auj) > ANCIENNETE_INSERTION_JOURS;
              return (
                <tr key={l.dossier.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => setOuvert(l)}>
                  <td className="px-3 py-2"><div className="font-medium leading-tight">{l.eleve.lastName}</div><div className="text-xs text-muted-foreground">{l.eleve.firstName}</div></td>
                  <td className="px-3 py-2">
                    {p ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${COULEUR_INSERTION[p.situation]}`}>{LIBELLES_INSERTION[p.situation]}</span>
                      : <span className="text-xs text-primary">+ Saisir la situation</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p ? [p.structure, p.poste].filter(Boolean).join(' · ') || '—' : ''}</td>
                  <td className={`px-3 py-2 text-xs whitespace-nowrap ${ancien ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                    {p ? <span className="flex items-center gap-1">{ancien && <Clock className="h-3 w-3" />}{jour(p.date)}</span> : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DialogInsertion ligne={ouvert} onFermer={() => setOuvert(null)} />
    </div>
  );
};

const DialogInsertion = ({ ligne, onFermer }: { ligne: LigneFinancee | null; onFermer: () => void }) => {
  const fin = useFinancements();
  const [situation, setSituation] = useState<SituationInsertion>('emploi');
  const [date, setDate] = useState(aujourdhuiIso());
  const [structure, setStructure] = useState('');
  const [poste, setPoste] = useState('');
  const [note, setNote] = useState('');
  const [enCours, setEnCours] = useState(false);
  if (!ligne) return null;
  const points = fin.insertions.filter(p => p.dossierId === ligne.dossier.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const avecStructure = situation === 'emploi' || situation === 'auto_emploi' || situation === 'stage' || situation === 'etudes';

  const ajouter = async () => {
    setEnCours(true);
    try {
      await fin.ajouterInsertion({ dossierId: ligne.dossier.id, date, situation, structure: avecStructure ? structure : '', poste: avecStructure ? poste : '', note });
      setStructure(''); setPoste(''); setNote('');
      toast({ title: 'Situation enregistrée', description: LIBELLES_INSERTION[situation] });
    } catch (e) { toast({ title: 'Situation non enregistrée', description: messageDe(e), variant: 'destructive' }); } finally { setEnCours(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) onFermer(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary" />{ligne.eleve.lastName} {ligne.eleve.firstName}</DialogTitle>
          <DialogDescription>Situation professionnelle après la formation. Chaque mise à jour s'ajoute à l'historique.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 -mx-1 px-1">
          <section className="space-y-3 rounded-xl border p-3">
            <h3 className="text-sm font-semibold">Nouvelle situation</h3>
            <div className="flex flex-wrap gap-1.5">
              {SITUATIONS_INSERTION.map(s => (
                <button key={s} type="button" onClick={() => setSituation(s)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${situation === s ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70'}`}>
                  {LIBELLES_INSERTION[s]}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
              <div className="space-y-1"><Label htmlFor="ins-date" className="text-xs">Depuis le</Label>
                <Input id="ins-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              {avecStructure && (
                <div className="space-y-1"><Label htmlFor="ins-structure" className="text-xs">{situation === 'etudes' ? 'Établissement' : situation === 'auto_emploi' ? 'Activité' : 'Entreprise'}</Label>
                  <Input id="ins-structure" value={structure} onChange={e => setStructure(e.target.value)} placeholder={situation === 'auto_emploi' ? 'Restaurant, traiteur…' : 'Hôtel, restaurant…'} /></div>
              )}
            </div>
            {avecStructure && situation !== 'etudes' && (
              <div className="space-y-1"><Label htmlFor="ins-poste" className="text-xs">Poste</Label>
                <Input id="ins-poste" value={poste} onChange={e => setPoste(e.target.value)} placeholder="Commis de cuisine, serveur…" /></div>
            )}
            <div className="space-y-1"><Label htmlFor="ins-note" className="text-xs">Remarque</Label>
              <Textarea id="ins-note" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Type de contrat, comment on a eu l'information…" /></div>
            <div className="flex justify-end">
              <Button onClick={() => void ajouter()} disabled={enCours || !/^\d{4}-\d{2}-\d{2}$/.test(date)} className="gap-1.5">
                {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Enregistrer
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Historique</h3>
            {points.length === 0 ? <p className="text-sm text-muted-foreground">Aucune situation saisie.</p> : (
              <ol className="space-y-2">
                {points.map((p, i) => (
                  <li key={p.id} className="group flex items-start gap-3 rounded-lg border px-3 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 ${COULEUR_INSERTION[p.situation]}`}>{LIBELLES_INSERTION[p.situation]}</span>
                    <div className="flex-1 min-w-0 text-sm">
                      <p>{jour(p.date)}{i === 0 && <span className="text-xs text-primary ml-1.5">actuelle</span>}</p>
                      {(p.structure || p.poste) && <p className="text-xs text-muted-foreground">{[p.structure, p.poste].filter(Boolean).join(' · ')}</p>}
                      {p.note && <p className="text-xs text-muted-foreground italic">{p.note}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" aria-label="Supprimer cette situation"
                      onClick={() => void fin.supprimerInsertion(p.id).catch(e => toast({ title: 'Suppression impossible', description: messageDe(e), variant: 'destructive' }))}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
