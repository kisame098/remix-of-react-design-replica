import { useState } from 'react';
import { FileCheck2, History, Loader2, Plus, Trash2, Users, User } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { dateDakar } from '@/lib/documentsEcole';
import type { Organisme } from '@/lib/financements';
import {
  COULEUR_STATUT_RAPPORT, LIBELLES_STATUT_RAPPORT, STATUTS_RAPPORT, aujourdhuiIso,
  type PorteeFacture, type Rapport, type StatutRapport,
} from '@/lib/financementsSuivi';
import { FichierJoint } from '@/components/financements/FichierJoint';
import { messageDe, nomComplet, promotionsDe, type ApprenantFinance } from '@/components/financements/donneesOrganisme';

// ═══════════════════════════════════════════════════════════════════════════
// Rubrique « Rapports » d'un organisme : les rapports de fin de formation à
// lui remettre — un par promotion, ou un par apprenant (les deux pratiques
// existent) —, leur état (à produire, en cours, transmis, validé), leur
// fichier, et l'historique des transmissions.
// ═══════════════════════════════════════════════════════════════════════════

const jour = (iso?: string) => (iso ? dateDakar(`${iso}T12:00:00Z`) : '');
type Filtre = 'tous' | StatutRapport;

export const RapportsOrganisme = ({ organisme, apprenants }: { organisme: Organisme; apprenants: ApprenantFinance[] }) => {
  const fin = useFinancements();
  const promotions = promotionsDe(apprenants);
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [nouveau, setNouveau] = useState(false);
  const [ouvert, setOuvert] = useState<Rapport | null>(null);

  if (!fin.suiviDisponible) {
    return <div className="p-5"><div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Les rapports ne sont pas encore activés pour la base de données de l'école. Contactez l'assistance SenClass.</div></div>;
  }
  const rapports = fin.rapports.filter(r => r.organismeId === organisme.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const visibles = rapports.filter(r => filtre === 'tous' || r.statut === filtre);
  const nomPromotion = (classId: string) => promotions.find(p => p.classId === classId)?.name ?? 'Promotion';
  const nomApprenant = (r: Rapport) => {
    const a = apprenants.find(x => x.dossier.id === r.dossierId);
    return a ? nomComplet(a.eleve) : 'Apprenant';
  };
  const ids = new Set(rapports.map(r => r.id));
  const historique = fin.journal.filter(j => j.objet === 'rapport' && ids.has(j.objetId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 15);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {(['tous', ...STATUTS_RAPPORT] as Filtre[]).map(s => {
            const n = s === 'tous' ? rapports.length : rapports.filter(r => r.statut === s).length;
            return (
              <button key={s} onClick={() => setFiltre(s)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${filtre === s ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70 text-foreground'}`}>
                {s === 'tous' ? 'Tous' : LIBELLES_STATUT_RAPPORT[s]} <span className="opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setNouveau(true)} disabled={promotions.length === 0}><Plus className="h-3.5 w-3.5" />Nouveau rapport</Button>
      </div>

      {rapports.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aucun rapport pour {organisme.nom}. Créez celui d'une promotion, ou un par apprenant, selon ce que demande l'organisme.
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {visibles.length === 0 ? <p className="p-5 text-center text-sm text-muted-foreground">Aucun rapport dans cet état.</p> : visibles.map(r => (
            <button key={r.id} onClick={() => setOuvert(r)} className="w-full text-left px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 hover:bg-muted/30">
              {r.portee === 'cohorte' ? <Users className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}
              <span className="flex-1 min-w-[180px]">
                <span className="text-sm font-medium">{r.titre}</span>
                <span className="text-xs text-muted-foreground"> · {nomPromotion(r.classId)}{r.portee === 'apprenant' ? ` · ${nomApprenant(r)}` : ''}</span>
              </span>
              {r.fichier && <FileCheck2 className="h-4 w-4 text-green-600" aria-label="Fichier joint" />}
              <span className="text-xs text-muted-foreground">
                {r.statut === 'valide' && r.dateValidation ? `validé le ${jour(r.dateValidation)}` : r.statut === 'transmis' && r.dateTransmission ? `transmis le ${jour(r.dateTransmission)}` : ''}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COULEUR_STATUT_RAPPORT[r.statut]}`}>{LIBELLES_STATUT_RAPPORT[r.statut]}</span>
            </button>
          ))}
        </div>
      )}

      {historique.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-primary" />Historique des transmissions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1.5">
              {historique.map(h => (
                <li key={h.id} className="flex flex-wrap gap-x-2">
                  <span className="text-muted-foreground w-36">{new Date(h.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="font-medium">{h.action}</span>
                  <span className="text-muted-foreground">— {rapports.find(r => r.id === h.objetId)?.titre}{h.parNom ? ` · ${h.parNom}` : ''}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <DialogNouveauRapport ouvert={nouveau} onFermer={() => setNouveau(false)} organisme={organisme} apprenants={apprenants}
        onCree={r => { setNouveau(false); setOuvert(r); }} />
      <DialogRapport rapport={ouvert} onFermer={() => setOuvert(null)} titreApprenant={ouvert?.portee === 'apprenant' ? nomApprenant(ouvert) : undefined} />
    </div>
  );
};

const DialogNouveauRapport = ({ ouvert, onFermer, organisme, apprenants, onCree }: {
  ouvert: boolean; onFermer: () => void; organisme: Organisme; apprenants: ApprenantFinance[]; onCree: (r: Rapport) => void;
}) => {
  const fin = useFinancements();
  const promotions = promotionsDe(apprenants);
  const [portee, setPortee] = useState<PorteeFacture>('cohorte');
  const [promotionId, setPromotionId] = useState('');
  const [dossierId, setDossierId] = useState('');
  const [titre, setTitre] = useState('');
  const [enCours, setEnCours] = useState(false);
  const promotion = promotions.find(p => p.id === promotionId) ?? promotions[0];
  const siens = apprenants.filter(a => a.promotion?.id === promotion?.id);
  const titreParDefaut = portee === 'cohorte' ? `Rapport de fin de formation — ${promotion?.name ?? ''}` : 'Rapport de fin de formation';

  const creer = async () => {
    if (!promotion) return;
    if (portee === 'apprenant' && !dossierId) { toast({ title: "Choisissez l'apprenant", variant: 'destructive' }); return; }
    setEnCours(true);
    try {
      const r = await fin.creerRapport({
        organismeId: organisme.id, portee, classId: promotion.classId,
        dossierId: portee === 'apprenant' ? dossierId : undefined, titre: titre.trim() || titreParDefaut,
      });
      setTitre(''); setDossierId('');
      onCree(r);
    } catch (e) { toast({ title: 'Rapport non créé', description: messageDe(e), variant: 'destructive' }); } finally { setEnCours(false); }
  };

  return (
    <Dialog open={ouvert} onOpenChange={v => { if (!v && !enCours) onFermer(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau rapport de fin de formation</DialogTitle>
          <DialogDescription>Pour une promotion entière, ou pour un apprenant.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([['cohorte', 'La promotion', Users], ['apprenant', 'Un apprenant', User]] as const).map(([v, libelle, Icone]) => (
              <button key={v} type="button" onClick={() => setPortee(v)} aria-pressed={portee === v}
                className={`text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${portee === v ? 'border-primary bg-primary/5 text-primary font-medium' : 'hover:bg-muted'}`}>
                <Icone className="h-4 w-4" />{libelle}
              </button>
            ))}
          </div>
          <div className="space-y-1.5"><Label>Promotion</Label>
            <Select value={promotion?.id ?? ''} onValueChange={v => { setPromotionId(v); setDossierId(''); }}>
              <SelectTrigger aria-label="Promotion"><SelectValue /></SelectTrigger>
              <SelectContent>{promotions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select></div>
          {portee === 'apprenant' && (
            <div className="space-y-1.5"><Label>Apprenant</Label>
              <Select value={dossierId} onValueChange={setDossierId}><SelectTrigger aria-label="Apprenant"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{siens.map(a => <SelectItem key={a.dossier.id} value={a.dossier.id}>{nomComplet(a.eleve)}</SelectItem>)}</SelectContent></Select></div>
          )}
          <div className="space-y-1.5"><Label htmlFor="rap-titre">Titre</Label>
            <Input id="rap-titre" value={titre} placeholder={titreParDefaut} onChange={e => setTitre(e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onFermer} disabled={enCours}>Annuler</Button>
            <Button onClick={() => void creer()} disabled={enCours || !promotion}>{enCours && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Créer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DialogRapport = ({ rapport, onFermer, titreApprenant }: { rapport: Rapport | null; onFermer: () => void; titreApprenant?: string }) => {
  const fin = useFinancements();
  const r = rapport ? fin.rapports.find(x => x.id === rapport.id) : undefined;
  const [note, setNote] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  if (!r) return null;
  const historique = fin.journal.filter(j => j.objet === 'rapport' && j.objetId === r.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const changer = async (statut: StatutRapport) => {
    setOccupe(true);
    try {
      const auj = aujourdhuiIso();
      await fin.modifierRapport(r.id, {
        statut,
        ...(statut === 'transmis' && !r.dateTransmission ? { dateTransmission: auj } : {}),
        ...(statut === 'valide' ? { dateValidation: r.dateValidation ?? auj, ...(!r.dateTransmission ? { dateTransmission: auj } : {}) } : {}),
      });
    } catch (e) { toast({ title: 'État non changé', description: messageDe(e), variant: 'destructive' }); } finally { setOccupe(false); }
  };
  const champDate = async (champ: 'dateTransmission' | 'dateValidation', v: string) => {
    try { await fin.modifierRapport(r.id, { [champ]: v }); } catch (e) { toast({ title: 'Date non enregistrée', description: messageDe(e), variant: 'destructive' }); }
  };

  return (
    <Dialog open onOpenChange={v => { if (!v) { setNote(null); onFermer(); } }}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{r.titre}</DialogTitle>
          <DialogDescription>{r.portee === 'cohorte' ? 'Rapport de la cohorte' : `Rapport de ${titreApprenant ?? "l'apprenant"}`} · {fin.organisme(r.organismeId)?.nom}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-5 -mx-1 px-1">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">État</h3>
            <div className="flex flex-wrap gap-1.5">
              {STATUTS_RAPPORT.map(s => (
                <button key={s} type="button" disabled={occupe} onClick={() => void changer(s)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${r.statut === s ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70'}`}>
                  {LIBELLES_STATUT_RAPPORT[s]}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor="rap-trans" className="text-xs">Transmis le</Label>
                <Input id="rap-trans" type="date" value={r.dateTransmission ?? ''} onChange={e => void champDate('dateTransmission', e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="rap-val" className="text-xs">Validé le</Label>
                <Input id="rap-val" type="date" value={r.dateValidation ?? ''} onChange={e => void champDate('dateValidation', e.target.value)} /></div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Fichier du rapport</h3>
            <FichierJoint dossierId={`rapports/${r.id}`} chemin={r.fichier} libelle="rapport" onChange={c => fin.modifierRapport(r.id, { fichier: c })} />
          </section>

          <section className="space-y-1.5">
            <Label htmlFor="rap-note">Remarques</Label>
            <Textarea id="rap-note" rows={2} value={note ?? r.note ?? ''} placeholder="Retours de l'organisme, corrections demandées…" onChange={e => setNote(e.target.value)}
              onBlur={() => { if (note !== null && note !== (r.note ?? '')) void fin.modifierRapport(r.id, { note }).then(() => setNote(null)); }} />
          </section>

          {historique.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><History className="h-4 w-4 text-primary" />Historique</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                {historique.map(h => <li key={h.id}><span className="text-foreground font-medium">{h.action}</span>{h.detail ? ` ${h.detail}` : ''} · {new Date(h.createdAt).toLocaleString('fr-FR')}{h.parNom ? ` · ${h.parNom}` : ''}</li>)}
              </ul>
            </section>
          )}
        </div>
        <div className="flex justify-between pt-3 border-t">
          <Button variant="ghost" className="text-destructive hover:text-destructive gap-1.5" onClick={() => void fin.supprimerRapport(r.id).then(() => { onFermer(); toast({ title: 'Rapport supprimé' }); }).catch(e => toast({ title: 'Suppression impossible', description: messageDe(e), variant: 'destructive' }))}>
            <Trash2 className="h-4 w-4" />Supprimer
          </Button>
          <Button variant="outline" onClick={onFermer}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
