import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, BriefcaseBusiness, Loader2, Plus, Trash2 } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useStages } from '@/contexts/StagesContext';
import type { Student } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { dateDakar } from '@/lib/documentsEcole';
import { LIBELLES_STATUT_STAGE, statutStage } from '@/lib/formationPro';
import {
  COULEUR_INSERTION, LIBELLES_INSERTION, SITUATIONS_INSERTION, aujourdhuiIso, type SituationInsertion,
} from '@/lib/financementsSuivi';
import { messageDe } from '@/components/financements/donneesOrganisme';

// ═══════════════════════════════════════════════════════════════════════════
// L'insertion professionnelle d'un apprenant financé : ses stages (saisis
// dans la rubrique Stages, repris ici sans rien ressaisir) puis sa situation
// après la formation. Chaque situation est un point daté qui s'ajoute à
// l'historique ; la plus récente fait foi.
// ═══════════════════════════════════════════════════════════════════════════

const jour = (iso?: string) => (iso ? dateDakar(`${iso}T12:00:00Z`) : '…');

export const DialogInsertion = ({ eleve, onFermer }: { eleve: Student | null; onFermer: () => void }) => {
  const fin = useFinancements();
  const st = useStages();
  const { promotions } = useFormationPro();
  const [nouvelle, setNouvelle] = useState(false);
  const [situation, setSituation] = useState<SituationInsertion>('emploi');
  const [date, setDate] = useState(aujourdhuiIso());
  const [structure, setStructure] = useState('');
  const [poste, setPoste] = useState('');
  const [note, setNote] = useState('');
  const [enCours, setEnCours] = useState(false);

  const dossier = eleve ? fin.dossierDe(eleve.id) : undefined;
  if (!eleve || !dossier) return null;
  const auj = aujourdhuiIso();
  const promotion = promotions.find(p => p.classId === eleve.classId);
  const stages = st.stages.filter(s => s.studentEnrollmentId === eleve.id).sort((a, b) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? ''));
  const entreprise = (id?: string) => st.entreprises.find(e => e.id === id)?.nom;
  const points = fin.insertions.filter(p => p.dossierId === dossier.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const avecStructure = situation === 'emploi' || situation === 'auto_emploi' || situation === 'stage' || situation === 'etudes';

  const fermer = () => { setNouvelle(false); onFermer(); };
  const ajouter = async () => {
    setEnCours(true);
    try {
      await fin.ajouterInsertion({ dossierId: dossier.id, date, situation, structure: avecStructure ? structure : '', poste: avecStructure ? poste : '', note });
      setStructure(''); setPoste(''); setNote(''); setNouvelle(false);
      toast({ title: 'Situation enregistrée', description: LIBELLES_INSERTION[situation] });
    } catch (e) { toast({ title: 'Situation non enregistrée', description: messageDe(e), variant: 'destructive' }); } finally { setEnCours(false); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) fermer(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-primary" />{eleve.lastName} {eleve.firstName}</DialogTitle>
          <DialogDescription>Insertion professionnelle</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 -mx-1 px-1">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Stages</h3>
              {promotion && <Link to={`/formation/stages/${promotion.id}`} className="text-xs text-primary hover:underline">Ouvrir Stages →</Link>}
            </div>
            {stages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun stage enregistré dans la rubrique Stages.</p>
            ) : (
              <div className="rounded-lg border divide-y">
                {stages.map(s => (
                  <div key={s.id} className="px-3 py-2 flex items-start gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entreprise(s.entrepriseId) ?? 'Entreprise à préciser'}{s.poste ? <span className="font-normal text-muted-foreground"> · {s.poste}</span> : null}</p>
                      <p className="text-xs text-muted-foreground">{jour(s.dateDebut)} → {jour(s.dateFin)}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {s.note != null ? `${String(s.note).replace('.', ',')}/20` : LIBELLES_STATUT_STAGE[statutStage(s, auj)]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Situation après la formation</h3>
              {fin.suiviDisponible && !nouvelle && (
                <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => { setDate(aujourdhuiIso()); setNouvelle(true); }}>
                  <Plus className="h-3.5 w-3.5" />Nouvelle situation
                </Button>
              )}
            </div>

            {!fin.suiviDisponible ? (
              <p className="text-sm text-muted-foreground">Le suivi de l'insertion n'est pas encore activé pour la base de données de l'école.</p>
            ) : (
              <>
                {nouvelle && (
                  <div className="space-y-3 rounded-xl border p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {SITUATIONS_INSERTION.map(s => (
                        <button key={s} type="button" onClick={() => setSituation(s)} aria-pressed={situation === s}
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
                          <Input id="ins-structure" value={structure} onChange={e => setStructure(e.target.value)} /></div>
                      )}
                    </div>
                    {avecStructure && situation !== 'etudes' && (
                      <div className="space-y-1"><Label htmlFor="ins-poste" className="text-xs">Poste</Label>
                        <Input id="ins-poste" value={poste} onChange={e => setPoste(e.target.value)} /></div>
                    )}
                    <div className="space-y-1"><Label htmlFor="ins-note" className="text-xs">Remarque</Label>
                      <Textarea id="ins-note" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Type de contrat, source de l'information…" /></div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setNouvelle(false)} disabled={enCours}>Annuler</Button>
                      <Button onClick={() => void ajouter()} disabled={enCours || !/^\d{4}-\d{2}-\d{2}$/.test(date)} className="gap-1.5">
                        {enCours && <Loader2 className="h-4 w-4 animate-spin" />}Enregistrer
                      </Button>
                    </div>
                  </div>
                )}

                {points.length === 0 ? (
                  !nouvelle && <p className="text-sm text-muted-foreground">Aucune situation saisie.</p>
                ) : (
                  <ol className="space-y-2">
                    {points.map((p, i) => (
                      <li key={p.id} className="group flex items-start gap-3 rounded-lg border px-3 py-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 ${COULEUR_INSERTION[p.situation]}`}>{LIBELLES_INSERTION[p.situation]}</span>
                        <div className="flex-1 min-w-0 text-sm">
                          <p>Depuis le {jour(p.date)}{i === 0 && <span className="text-xs text-primary ml-1.5">actuelle</span>}</p>
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
              </>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
