import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Search, Mail, MessageCircle, Loader2, Trash2, FileText, Send, CalendarClock, Phone, Users, School,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type Prospect, type Echange, type ModeleEmail, type StatutProspect, type TypeEchange, type FiltreProspects,
  STATUTS_PROSPECT, LIBELLES_STATUT_PROSPECT, COULEURS_STATUT_PROSPECT, LIBELLES_TYPE_ECHANGE,
  relanceAFaire, filtrerProspects, numeroWhatsApp, emailValide, apercuMessage,
} from '@/lib/prospects';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dateFr = (iso?: string) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('fr-FR') : '');
const texte = (v?: string) => v?.trim() || null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapProspect = (r: any): Prospect => ({
  id: r.id, ecole: r.ecole, responsable: r.responsable ?? undefined, telephone: r.telephone ?? undefined,
  email: r.email ?? undefined, ville: r.ville ?? undefined, source: r.source ?? undefined, statut: r.statut,
  relanceLe: r.relance_le ?? undefined, notes: r.notes ?? undefined, schoolId: r.school_id ?? undefined, createdAt: r.created_at,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapEchange = (r: any): Echange => ({
  id: r.id, prospectId: r.prospect_id ?? undefined, schoolId: r.school_id ?? undefined, type: r.type,
  objet: r.objet ?? undefined, contenu: r.contenu ?? undefined, destinataire: r.destinataire ?? undefined,
  statutEnvoi: r.statut_envoi ?? undefined, erreur: r.erreur ?? undefined, createdAt: r.created_at,
});

/** Un destinataire d'e-mail : un prospect, ou une école cliente. */
interface Cible { cle: string; email: string; ecole: string; responsable?: string; prospectId?: string; schoolId?: string }

/**
 * Chef du système — les écoles à démarcher : statut, relances, historique des
 * échanges, WhatsApp, et e-mails envoyés depuis contact@senclass.com (Resend,
 * fonction `envoyer-email`). Tout est réservé au chef du système (RLS).
 */
const PlatformProspects = () => {
  const [loading, setLoading] = useState(true);
  const [disponible, setDisponible] = useState(true);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [derniers, setDerniers] = useState<Record<string, string>>({});
  const [modeles, setModeles] = useState<ModeleEmail[]>([]);

  const charger = useCallback(async () => {
    const [pRes, eRes, mRes] = await Promise.all([
      sb.from('platform_prospects').select('*').order('created_at', { ascending: false }),
      sb.from('platform_echanges').select('prospect_id, created_at').not('prospect_id', 'is', null).order('created_at', { ascending: false }).limit(2000),
      sb.from('platform_modeles_email').select('*').order('ordre'),
    ]);
    setDisponible(!pRes.error);
    setProspects((pRes.data ?? []).map(mapProspect));
    const der: Record<string, string> = {};
    for (const r of (eRes.data ?? []) as { prospect_id: string; created_at: string }[]) if (!der[r.prospect_id]) der[r.prospect_id] = r.created_at;
    setDerniers(der);
    setModeles((mRes.data ?? []).map((r: ModeleEmail) => r));
    setLoading(false);
  }, []);
  useEffect(() => { void charger(); }, [charger]);

  const auj = aujourdhui();
  const [filtre, setFiltre] = useState<FiltreProspects>('tous');
  const [recherche, setRecherche] = useState('');
  const visibles = useMemo(() => filtrerProspects(prospects, filtre, recherche, auj), [prospects, filtre, recherche, auj]);
  const aRelancer = prospects.filter(p => relanceAFaire(p, auj)).length;
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const [fiche, setFiche] = useState<Prospect | 'nouveau' | null>(null);
  const [composer, setComposer] = useState<Cible[] | null>(null);
  const [gererModeles, setGererModeles] = useState(false);

  const changerStatut = async (p: Prospect, statut: StatutProspect) => {
    const { error } = await sb.from('platform_prospects').update({ statut, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    setProspects(prev => prev.map(x => x.id === p.id ? { ...x, statut } : x));
  };

  const cibleDe = (p: Prospect): Cible => ({ cle: `p:${p.id}`, email: p.email ?? '', ecole: p.ecole, responsable: p.responsable, prospectId: p.id });
  const ecrireASelection = () => {
    const cibles = prospects.filter(p => selection.has(p.id) && emailValide(p.email)).map(cibleDe);
    setComposer(cibles);
  };

  const whatsapp = async (p: Prospect) => {
    const numero = numeroWhatsApp(p.telephone);
    if (!numero) { toast({ title: 'Numéro de téléphone manquant ou incomplet', variant: 'destructive' }); return; }
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(apercuMessage('Bonjour {{responsable}}, ', p.ecole, p.responsable))}`, '_blank', 'noopener');
    await sb.from('platform_echanges').insert({ prospect_id: p.id, type: 'whatsapp', contenu: 'Conversation WhatsApp ouverte', destinataire: p.telephone });
    setDerniers(prev => ({ ...prev, [p.id]: new Date().toISOString() }));
  };

  if (loading) return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;

  const filtres: FiltreProspects[] = ['tous', 'a_relancer', ...STATUTS_PROSPECT];
  const libelleFiltre = (f: FiltreProspects) => f === 'tous' ? 'Tous' : f === 'a_relancer' ? 'À relancer' : LIBELLES_STATUT_PROSPECT[f];
  const nbFiltre = (f: FiltreProspects) => f === 'tous' ? prospects.length : f === 'a_relancer' ? aRelancer : prospects.filter(p => p.statut === f).length;
  const nbSelectionAvecEmail = prospects.filter(p => selection.has(p.id) && emailValide(p.email)).length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prospects</h1>
          <p className="text-sm text-muted-foreground">
            Les écoles à démarcher. Les e-mails partent de <strong>contact@senclass.com</strong> ; les réponses arrivent dans votre boîte habituelle.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setGererModeles(true)}><FileText className="h-3.5 w-3.5" />Modèles</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setComposer([])}><School className="h-3.5 w-3.5" />Écrire aux écoles clientes</Button>
          <Button size="sm" className="gap-1.5" onClick={() => setFiche('nouveau')} disabled={!disponible}><Plus className="h-3.5 w-3.5" />Nouveau prospect</Button>
        </div>
      </div>

      {!disponible ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">La rubrique Prospects n'est pas encore activée dans la base de données.</div>
      ) : (
        <>
          {aRelancer > 0 && (
            <button onClick={() => setFiltre('a_relancer')} className="w-full text-left rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-700" />
              <span><strong>{aRelancer}</strong> prospect{aRelancer > 1 ? 's' : ''} à relancer aujourd'hui</span>
            </button>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {filtres.map(f => (
                <button key={f} onClick={() => setFiltre(f)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${filtre === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/70 text-foreground'}`}>
                  {libelleFiltre(f)} <span className="opacity-70">{nbFiltre(f)}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {selection.size > 0 && (
                <Button size="sm" className="gap-1.5" disabled={nbSelectionAvecEmail === 0} onClick={ecrireASelection}>
                  <Mail className="h-3.5 w-3.5" />Écrire à la sélection ({nbSelectionAvecEmail})
                </Button>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="École, responsable, ville…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8 w-56 h-8 text-sm" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left text-muted-foreground">
                  <th className="px-3 py-2 w-8">
                    <Checkbox aria-label="Tout sélectionner" checked={visibles.length > 0 && visibles.every(p => selection.has(p.id))}
                      onCheckedChange={v => setSelection(v === true ? new Set(visibles.map(p => p.id)) : new Set())} />
                  </th>
                  <th className="px-3 py-2 font-medium">École</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium">Relance</th>
                  <th className="px-3 py-2 font-medium">Dernier échange</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    {prospects.length === 0 ? 'Aucun prospect pour l\'instant — ajoutez la première école à démarcher.' : 'Aucun prospect pour ce filtre.'}
                  </td></tr>
                ) : visibles.map(p => {
                  const enRetard = relanceAFaire(p, auj);
                  return (
                    <tr key={p.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <Checkbox aria-label={`Sélectionner ${p.ecole}`} checked={selection.has(p.id)}
                          onCheckedChange={v => setSelection(prev => { const s = new Set(prev); if (v === true) s.add(p.id); else s.delete(p.id); return s; })} />
                      </td>
                      <td className="px-3 py-2">
                        <button className="font-medium hover:underline text-left" onClick={() => setFiche(p)}>{p.ecole}</button>
                        <div className="text-xs text-muted-foreground">{[p.responsable, p.ville].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {p.telephone && <div>{p.telephone}</div>}
                        {p.email && <div className="truncate max-w-[200px]">{p.email}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <Select value={p.statut} onValueChange={v => void changerStatut(p, v as StatutProspect)}>
                          <SelectTrigger className={`h-7 w-[130px] text-xs border-0 ${COULEURS_STATUT_PROSPECT[p.statut]}`} aria-label={`Statut de ${p.ecole}`}><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUTS_PROSPECT.map(s => <SelectItem key={s} value={s}>{LIBELLES_STATUT_PROSPECT[s]}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className={`px-3 py-2 text-xs whitespace-nowrap ${enRetard ? 'text-amber-700 font-semibold' : 'text-muted-foreground'}`}>
                        {p.relanceLe ? dateFr(p.relanceLe) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{derniers[p.id] ? dateFr(derniers[p.id]) : '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="WhatsApp" aria-label={`WhatsApp — ${p.ecole}`} disabled={!numeroWhatsApp(p.telephone)} onClick={() => void whatsapp(p)}>
                            <MessageCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="E-mail" aria-label={`E-mail — ${p.ecole}`} disabled={!emailValide(p.email)} onClick={() => setComposer([cibleDe(p)])}>
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {fiche && (
        <FicheProspect
          prospect={fiche === 'nouveau' ? null : fiche}
          onFermer={() => setFiche(null)}
          onEnregistre={p => { setProspects(prev => prev.some(x => x.id === p.id) ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev]); }}
          onSupprime={id => { setProspects(prev => prev.filter(x => x.id !== id)); setFiche(null); }}
          onEcrire={p => setComposer([cibleDe(p)])}
          onWhatsApp={p => void whatsapp(p)}
        />
      )}
      {composer && (
        <ComposerEmail
          initiales={composer} modeles={modeles} onFermer={() => setComposer(null)}
          onEnvoye={() => { void charger(); }}
        />
      )}
      {gererModeles && <GererModeles modeles={modeles} onFermer={() => setGererModeles(false)} onChange={setModeles} />}
    </div>
  );
};

// ─── Fiche d'un prospect : coordonnées, statut, relance, historique ──────────
const FicheProspect = ({ prospect, onFermer, onEnregistre, onSupprime, onEcrire, onWhatsApp }: {
  prospect: Prospect | null; onFermer: () => void; onEnregistre: (p: Prospect) => void; onSupprime: (id: string) => void;
  onEcrire: (p: Prospect) => void; onWhatsApp: (p: Prospect) => void;
}) => {
  const [f, setF] = useState({
    ecole: prospect?.ecole ?? '', responsable: prospect?.responsable ?? '', telephone: prospect?.telephone ?? '',
    email: prospect?.email ?? '', ville: prospect?.ville ?? '', source: prospect?.source ?? '',
    statut: prospect?.statut ?? 'nouveau' as StatutProspect, relanceLe: prospect?.relanceLe ?? '', notes: prospect?.notes ?? '',
  });
  const [enregistrement, setEnregistrement] = useState(false);
  const [echanges, setEchanges] = useState<Echange[]>([]);
  const [nouvelEchange, setNouvelEchange] = useState<{ type: TypeEchange; contenu: string }>({ type: 'appel', contenu: '' });
  const [confirmer, setConfirmer] = useState(false);

  useEffect(() => {
    if (!prospect) return;
    void sb.from('platform_echanges').select('*').eq('prospect_id', prospect.id).order('created_at', { ascending: false })
      .then(({ data }: { data: unknown[] | null }) => setEchanges((data ?? []).map(mapEchange)));
  }, [prospect]);

  const enregistrer = async () => {
    if (!f.ecole.trim()) { toast({ title: 'Le nom de l\'école est obligatoire', variant: 'destructive' }); return; }
    if (f.email.trim() && !emailValide(f.email)) { toast({ title: 'Adresse e-mail invalide', variant: 'destructive' }); return; }
    setEnregistrement(true);
    const ligne = {
      ecole: f.ecole.trim(), responsable: texte(f.responsable), telephone: texte(f.telephone), email: texte(f.email),
      ville: texte(f.ville), source: texte(f.source), statut: f.statut, relance_le: f.relanceLe || null, notes: texte(f.notes),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = prospect
      ? await sb.from('platform_prospects').update(ligne).eq('id', prospect.id).select().single()
      : await sb.from('platform_prospects').insert(ligne).select().single();
    setEnregistrement(false);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    onEnregistre(mapProspect(data));
    toast({ title: prospect ? 'Prospect enregistré' : 'Prospect ajouté' });
    if (!prospect) onFermer();
  };

  const ajouterEchange = async () => {
    if (!prospect || !nouvelEchange.contenu.trim()) return;
    const { data, error } = await sb.from('platform_echanges').insert({ prospect_id: prospect.id, type: nouvelEchange.type, contenu: nouvelEchange.contenu.trim() }).select().single();
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    setEchanges(prev => [mapEchange(data), ...prev]);
    setNouvelEchange(n => ({ ...n, contenu: '' }));
  };

  const supprimer = async () => {
    if (!prospect) return;
    const { error } = await sb.from('platform_prospects').delete().eq('id', prospect.id);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    onSupprime(prospect.id);
  };

  const champ = (cle: 'ecole' | 'responsable' | 'telephone' | 'email' | 'ville' | 'source', label: string, placeholder = '') => (
    <div className="space-y-1.5">
      <Label htmlFor={`prospect-${cle}`}>{label}</Label>
      <Input id={`prospect-${cle}`} placeholder={placeholder} value={f[cle]} onChange={e => setF({ ...f, [cle]: e.target.value })} />
    </div>
  );

  return (
    <>
      <Dialog open onOpenChange={o => !o && onFermer()}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{prospect ? prospect.ecole : 'Nouveau prospect'}</DialogTitle>
            <DialogDescription>Visible uniquement par le chef du système.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-5 -mx-1 px-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {champ('ecole', 'École *', 'Ex : Collège Sainte-Marie')}
              {champ('responsable', 'Responsable', 'Ex : M. Diallo, directeur')}
              {champ('telephone', 'Téléphone', 'Ex : 77 123 45 67')}
              {champ('email', 'E-mail', 'Ex : direction@ecole.sn')}
              {champ('ville', 'Ville')}
              {champ('source', 'Source', 'Ex : salon, recommandation, Facebook…')}
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={f.statut} onValueChange={v => setF({ ...f, statut: v as StatutProspect })}>
                  <SelectTrigger aria-label="Statut"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUTS_PROSPECT.map(s => <SelectItem key={s} value={s}>{LIBELLES_STATUT_PROSPECT[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prospect-relance">Relancer le</Label>
                <Input id="prospect-relance" type="date" value={f.relanceLe} onChange={e => setF({ ...f, relanceLe: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prospect-notes">Notes</Label>
              <Textarea id="prospect-notes" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
            </div>

            {prospect && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold">Historique des échanges</h3>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1.5 h-8" disabled={!numeroWhatsApp(prospect.telephone)} onClick={() => onWhatsApp(prospect)}>
                      <MessageCircle className="h-3.5 w-3.5 text-green-600" />WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 h-8" disabled={!emailValide(prospect.email)} onClick={() => onEcrire(prospect)}>
                      <Mail className="h-3.5 w-3.5" />E-mail
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select value={nouvelEchange.type} onValueChange={v => setNouvelEchange(n => ({ ...n, type: v as TypeEchange }))}>
                    <SelectTrigger className="w-36 h-9" aria-label="Type d'échange"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(['appel', 'rendez_vous', 'whatsapp', 'note'] as TypeEchange[]).map(t => <SelectItem key={t} value={t}>{LIBELLES_TYPE_ECHANGE[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Ce qui s'est dit…" aria-label="Compte rendu" value={nouvelEchange.contenu} onChange={e => setNouvelEchange(n => ({ ...n, contenu: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && void ajouterEchange()} />
                  <Button size="sm" className="h-9" onClick={() => void ajouterEchange()}>Ajouter</Button>
                </div>
                {echanges.length === 0 ? <p className="text-sm text-muted-foreground">Aucun échange noté.</p> : (
                  <ul className="space-y-2">
                    {echanges.map(e => (
                      <li key={e.id} className="rounded-md border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium flex items-center gap-1.5">
                            {e.type === 'email' ? <Mail className="h-3.5 w-3.5" /> : e.type === 'appel' ? <Phone className="h-3.5 w-3.5" /> : e.type === 'whatsapp' ? <MessageCircle className="h-3.5 w-3.5 text-green-600" /> : <Users className="h-3.5 w-3.5" />}
                            {LIBELLES_TYPE_ECHANGE[e.type]}{e.objet ? ` — ${e.objet}` : ''}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(e.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        {e.statutEnvoi === 'echec' && <p className="text-xs text-destructive mt-0.5">Échec de l'envoi : {e.erreur}</p>}
                        {e.contenu && <p className="text-muted-foreground mt-1 whitespace-pre-line line-clamp-4">{e.contenu}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-3 border-t">
            {prospect ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setConfirmer(true)}><Trash2 className="h-4 w-4" />Supprimer</Button>
            ) : <span />}
            <Button onClick={() => void enregistrer()} disabled={enregistrement}>
              {enregistrement && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{prospect ? 'Enregistrer' : 'Ajouter le prospect'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmer} onOpenChange={setConfirmer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {prospect?.ecole} » ?</AlertDialogTitle>
            <AlertDialogDescription>Le prospect et tout son historique d'échanges seront supprimés. Cette action ne peut pas être défaite.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void supprimer()}>Supprimer</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ─── Écrire un e-mail : prospects choisis, ou écoles clientes ────────────────
const ComposerEmail = ({ initiales, modeles, onFermer, onEnvoye }: {
  initiales: Cible[]; modeles: ModeleEmail[]; onFermer: () => void; onEnvoye: () => void;
}) => {
  // Aucune cible au départ : c'est « Écrire aux écoles clientes ».
  const versClients = initiales.length === 0;
  const [cibles, setCibles] = useState<Cible[]>(initiales);
  const [clients, setClients] = useState<Cible[]>([]);
  const [chargementClients, setChargementClients] = useState(versClients);
  const [rechercheClient, setRechercheClient] = useState('');
  const [objet, setObjet] = useState('');
  const [contenu, setContenu] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!versClients) return;
    void (async () => {
      const [ecoles, emails] = await Promise.all([
        sb.from('schools').select('id, name').order('name'),
        sb.rpc('platform_school_emails'),
      ]);
      const parEcole = new Map((emails.data ?? []).map((r: { school_id: string; contact_email: string | null; admin_emails: string[] }) => [r.school_id, r]));
      const liste: Cible[] = [];
      for (const e of (ecoles.data ?? []) as { id: string; name: string }[]) {
        const em = parEcole.get(e.id) as { contact_email: string | null; admin_emails: string[] } | undefined;
        const email = em?.contact_email || em?.admin_emails?.[0];
        if (email && emailValide(email)) liste.push({ cle: `s:${e.id}`, email, ecole: e.name, schoolId: e.id });
      }
      setClients(liste);
      setChargementClients(false);
    })();
  }, [versClients]);

  const appliquerModele = (id: string) => {
    const m = modeles.find(x => x.id === id);
    if (m) { setObjet(m.objet); setContenu(m.contenu); }
  };

  const envoyer = async () => {
    if (cibles.length === 0 || !objet.trim() || !contenu.trim()) {
      toast({ title: 'Il manque un destinataire, l\'objet ou le message', variant: 'destructive' }); return;
    }
    setEnvoi(true);
    const { data, error } = await supabase.functions.invoke('envoyer-email', {
      body: {
        objet, contenu,
        destinataires: cibles.map(c => ({ email: c.email, ecole: c.ecole, responsable: c.responsable, prospectId: c.prospectId, schoolId: c.schoolId })),
      },
    });
    setEnvoi(false);
    if (error) {
      // Le corps de la réponse porte l'explication (clé manquante, accès refusé…).
      let message = error.message;
      try { const corps = await (error as { context?: Response }).context?.json(); if (corps?.erreur) message = corps.erreur; } catch { /* message par défaut */ }
      toast({ title: 'Envoi impossible', description: message, variant: 'destructive' }); return;
    }
    const r = data as { envoyes: number; echecs: number };
    toast({
      title: `${r.envoyes} e-mail${r.envoyes > 1 ? 's' : ''} envoyé${r.envoyes > 1 ? 's' : ''}`,
      description: r.echecs ? `${r.echecs} échec(s) : voir l'historique.` : 'Depuis contact@senclass.com.',
      variant: r.echecs && !r.envoyes ? 'destructive' : undefined,
    });
    onEnvoye();
    onFermer();
  };

  const clientsVisibles = clients.filter(c => !rechercheClient.trim() || c.ecole.toLowerCase().includes(rechercheClient.trim().toLowerCase()));
  const premier = cibles[0];

  return (
    <Dialog open onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{versClients ? 'Écrire aux écoles clientes' : 'Écrire un e-mail'}</DialogTitle>
          <DialogDescription>Envoyé depuis contact@senclass.com. {'{{ecole}}'} et {'{{responsable}}'} sont remplacés pour chaque destinataire.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 -mx-1 px-1">
          {versClients ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Écoles clientes ({cibles.length} choisie{cibles.length > 1 ? 's' : ''})</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCibles(clientsVisibles.slice(0, 50))}>Tout choisir</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCibles([])}>Aucune</Button>
                </div>
              </div>
              <Input placeholder="Rechercher une école…" value={rechercheClient} onChange={e => setRechercheClient(e.target.value)} className="h-8 text-sm" />
              <div className="rounded-md border max-h-40 overflow-y-auto divide-y">
                {chargementClients ? <p className="p-3 text-sm text-muted-foreground">Chargement…</p> : clientsVisibles.map(c => (
                  <label key={c.cle} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer">
                    <Checkbox checked={cibles.some(x => x.cle === c.cle)}
                      onCheckedChange={v => setCibles(prev => v === true ? [...prev, c] : prev.filter(x => x.cle !== c.cle))} />
                    <span className="flex-1 truncate">{c.ecole}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{c.email}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm">
              <span className="text-muted-foreground">À : </span>
              {cibles.map(c => `${c.ecole} <${c.email}>`).join(', ')}
            </p>
          )}

          {modeles.length > 0 && (
            <div className="space-y-1.5">
              <Label>Partir d'un modèle</Label>
              <Select onValueChange={appliquerModele}>
                <SelectTrigger aria-label="Modèle"><SelectValue placeholder="Choisir un modèle…" /></SelectTrigger>
                <SelectContent>{modeles.map(m => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email-objet">Objet</Label>
            <Input id="email-objet" value={objet} onChange={e => setObjet(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-contenu">Message</Label>
            <Textarea id="email-contenu" rows={9} value={contenu} onChange={e => setContenu(e.target.value)} />
          </div>
          {premier && contenu && (
            <div className="rounded-md bg-muted/40 p-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Aperçu pour {premier.ecole}</p>
              <p className="font-medium">{apercuMessage(objet, premier.ecole, premier.responsable)}</p>
              <p className="whitespace-pre-line text-muted-foreground mt-1">{apercuMessage(contenu, premier.ecole, premier.responsable)}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="ghost" onClick={onFermer}>Annuler</Button>
          <Button className="gap-1.5" disabled={envoi || cibles.length === 0} onClick={() => void envoyer()}>
            {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer{cibles.length > 1 ? ` (${cibles.length})` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Modèles de messages ─────────────────────────────────────────────────────
const GererModeles = ({ modeles, onFermer, onChange }: { modeles: ModeleEmail[]; onFermer: () => void; onChange: (m: ModeleEmail[]) => void }) => {
  const [edition, setEdition] = useState<ModeleEmail | null>(null);

  const enregistrer = async () => {
    if (!edition || !edition.nom.trim() || !edition.objet.trim() || !edition.contenu.trim()) {
      toast({ title: 'Nom, objet et message sont obligatoires', variant: 'destructive' }); return;
    }
    const ligne = { nom: edition.nom.trim(), objet: edition.objet.trim(), contenu: edition.contenu, ordre: edition.ordre, updated_at: new Date().toISOString() };
    const { data, error } = edition.id
      ? await sb.from('platform_modeles_email').update(ligne).eq('id', edition.id).select().single()
      : await sb.from('platform_modeles_email').insert(ligne).select().single();
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    onChange(edition.id ? modeles.map(m => m.id === data.id ? data : m) : [...modeles, data]);
    setEdition(null);
  };
  const supprimer = async (id: string) => {
    const { error } = await sb.from('platform_modeles_email').delete().eq('id', id);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    onChange(modeles.filter(m => m.id !== id));
  };

  return (
    <Dialog open onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Modèles de messages</DialogTitle>
          <DialogDescription>{'{{ecole}}'} et {'{{responsable}}'} sont remplacés à l'envoi.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
          {edition ? (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="modele-nom">Nom du modèle</Label><Input id="modele-nom" value={edition.nom} onChange={e => setEdition({ ...edition, nom: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="modele-objet">Objet</Label><Input id="modele-objet" value={edition.objet} onChange={e => setEdition({ ...edition, objet: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="modele-contenu">Message</Label><Textarea id="modele-contenu" rows={10} value={edition.contenu} onChange={e => setEdition({ ...edition, contenu: e.target.value })} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEdition(null)}>Annuler</Button>
                <Button onClick={() => void enregistrer()}>Enregistrer</Button>
              </div>
            </div>
          ) : (
            <>
              {modeles.map(m => (
                <div key={m.id} className="group flex items-start justify-between gap-2 rounded-md border px-3 py-2">
                  <button className="text-left min-w-0" onClick={() => setEdition(m)}>
                    <p className="text-sm font-medium">{m.nom}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.objet}</p>
                  </button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" title="Supprimer" onClick={() => void supprimer(m.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEdition({ id: '', nom: '', objet: '', contenu: '', ordre: modeles.length })}>
                <Plus className="h-3.5 w-3.5" />Nouveau modèle
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlatformProspects;
