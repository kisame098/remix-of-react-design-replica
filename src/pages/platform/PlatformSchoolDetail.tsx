import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert, Repeat } from 'lucide-react';
import { LIBELLES_MODE, type ModeGestion } from '@/lib/modeGestion';
import { toast } from '@/hooks/use-toast';
import {
  ilYA, jourActif, joursSansActivite, LIBELLES_NIVEAU, niveauActivite, type JourHistorique,
} from '@/lib/activiteEcole';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface Detail {
  ecole: { id: string; nom: string; ville: string | null; pays: string; creee_le: string; statut: string; plan: string | null; expire_le: string | null };
  effectifs: {
    eleves: number; eleves_par_annee: { annee: string; eleves: number }[]; professeurs: number; directeurs: number;
    personnel: number; caisses: number; classes: number; matieres: number; creneaux_emploi_du_temps: number;
  };
  comptes: { eleves: number; eleves_connectes: number; professeurs: number; professeurs_connectes: number };
  saisie: {
    notes: number; notes_elementaire: number; seances_presence: number; presences_eleves: number;
    paiements: number; paiements_annules: number; total_encaisse: number; recus: number; bulletins_publies: number;
  };
  dates: {
    derniere_activite: string | null; derniere_connexion: string | null; derniere_presence_appli: string | null;
    derniere_saisie_notes: string | null; derniere_saisie_presences: string | null; dernier_paiement: string | null;
    premiere_activite: string | null; suivi_appli_depuis: string | null; jours_actifs_30: number; jours_actifs_90: number;
  };
  historique: JourHistorique[];
}

const nf = (n: number) => new Intl.NumberFormat('fr-FR').format(Number(n));
const dt = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Dakar' })
  : '—';
const jourFr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });

const Kpi = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <Card>
    <CardContent className="p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {hint && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{hint}</p>}
    </CardContent>
  </Card>
);

const Ligne = ({ label, valeur, sous }: { label: string; valeur: string; sous?: string }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5 border-b last:border-0 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{valeur}{sous && <span className="block text-[11px] font-normal text-muted-foreground">{sous}</span>}</span>
  </div>
);

const PlatformSchoolDetail = () => {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeGestion | null>(null);
  const [confirmerMode, setConfirmerMode] = useState<ModeGestion | null>(null);
  const [changementMode, setChangementMode] = useState(false);

  const charger = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true); setErreur(null);
    const { data, error } = await sb.rpc('platform_school_detail', { p_school_id: schoolId });
    if (error) {
      setErreur(error.message);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setD(data as Detail);
      const { data: m } = await sb.rpc('platform_school_mode', { p_school_id: schoolId });
      if (m === 'classique' || m === 'formation_pro') setMode(m);
    }
    setLoading(false);
  }, [schoolId]);

  const appliquerMode = async (cible: ModeGestion) => {
    if (!schoolId) return;
    setChangementMode(true);
    try {
      const { error } = await sb.rpc('platform_set_school_mode', { p_school_id: schoolId, p_mode: cible });
      if (error) throw error;
      setMode(cible);
      toast({ title: 'Mode de gestion modifié', description: `${d?.ecole.nom} est maintenant en mode « ${LIBELLES_MODE[cible]} ».` });
    } catch (e) {
      toast({ title: 'Mode non modifié', description: (e as { message?: string })?.message ?? 'Erreur inconnue', variant: 'destructive' });
    } finally {
      setChangementMode(false);
      setConfirmerMode(null);
    }
  };

  useEffect(() => { void charger(); }, [charger]);

  const maintenant = Date.now();
  const serie = useMemo(() => d ? [...d.historique].reverse().map(j => ({ ...j, label: jourFr(j.jour) })) : [], [d]);
  const sansActivite = useMemo(() => d ? joursSansActivite(d.historique) : 0, [d]);
  const niveau = d ? LIBELLES_NIVEAU[niveauActivite(d.dates.derniere_activite, maintenant)] : null;

  if (loading && !d) {
    return <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>;
  }
  if (erreur || !d) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/platform/ecoles" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="h-4 w-4" />Écoles</Link>
        <p className="text-destructive text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" />{erreur ?? 'École introuvable.'}</p>
      </div>
    );
  }

  const { effectifs: e, comptes: c, saisie: s, dates: t } = d;
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '—');
  const notesTotal = s.notes + s.notes_elementaire;

  return (
    <div className="p-6 space-y-6">
      <Link to="/platform/ecoles" className="text-sm text-primary flex items-center gap-1 w-fit"><ArrowLeft className="h-4 w-4" />Écoles</Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{d.ecole.nom}</h1>
          <p className="text-sm text-muted-foreground">
            {d.ecole.ville ?? '—'}, {d.ecole.pays} · inscrite le {new Date(d.ecole.creee_le).toLocaleDateString('fr-FR')}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary">{d.ecole.statut}</Badge>
            {d.ecole.plan && <Badge variant="outline">{d.ecole.plan}</Badge>}
            {niveau && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${niveau.classe}`}>{niveau.label}</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void charger()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Actualiser
        </Button>
      </div>

      <p className="text-xs text-muted-foreground -mt-3">
        Cette page ne montre que des totaux et des dates : aucun nom, note ou montant individuel d'élève.
      </p>

      {/* ── Mode de gestion ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Mode de gestion</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm">
            <p>
              Mode actuel : <span className="font-semibold">{mode ? LIBELLES_MODE[mode] : '—'}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Le mode « Formation professionnelle » change le menu de l'école (formations, promotions, examens, stages…).
              Aucune donnée n'est supprimée : basculer ne fait que changer les écrans, et le retour au mode classique est possible à tout moment.
            </p>
          </div>
          {mode && (
            <Button
              variant="outline" className="gap-2" disabled={changementMode}
              onClick={() => setConfirmerMode(mode === 'classique' ? 'formation_pro' : 'classique')}
            >
              <Repeat className="h-4 w-4" />
              {mode === 'classique' ? 'Passer en Formation professionnelle' : 'Revenir au mode classique'}
            </Button>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmerMode} onOpenChange={o => { if (!o && !changementMode) setConfirmerMode(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmerMode === 'formation_pro' ? 'Passer' : 'Revenir'} {d.ecole.nom} en mode « {confirmerMode && LIBELLES_MODE[confirmerMode]} » ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmerMode === 'formation_pro'
                ? "Le menu de cette école va changer : « Gestion Classe », « Gestion Notes » et « Cursus » sont remplacés par les rubriques Formation professionnelle (en cours de développement). Ses données ne sont ni modifiées ni supprimées."
                : "Le menu classique de l'école (Gestion Classe, Gestion Notes, Cursus) revient. Les rubriques Formation professionnelle disparaissent, sans perte de données."}
              {' '}Ce changement est enregistré dans le journal de la plateforme.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changementMode}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={changementMode} onClick={e => { e.preventDefault(); if (confirmerMode) void appliquerMode(confirmerMode); }}>
              {changementMode && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Effectifs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi label="Élèves inscrits" value={nf(e.eleves)} hint={e.eleves_par_annee.map(a => `${a.annee} : ${nf(a.eleves)}`).join(' · ')} />
        <Kpi label="Professeurs" value={nf(e.professeurs)} />
        <Kpi label="Personnel" value={nf(e.personnel)} hint={e.caisses ? `dont ${e.caisses} caisse(s)` : undefined} />
        <Kpi label="Directeurs" value={nf(e.directeurs)} />
        <Kpi label="Classes" value={nf(e.classes)} hint={`${nf(e.matieres)} matières`} />
        <Kpi label="Créneaux emploi du temps" value={nf(e.creneaux_emploi_du_temps)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ── Ce qui a été saisi ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Ce que l'école a saisi</CardTitle></CardHeader>
          <CardContent>
            <Ligne label="Notes saisies" valeur={nf(notesTotal)} sous={s.notes_elementaire > 0 ? `dont ${nf(s.notes_elementaire)} en élémentaire` : undefined} />
            <Ligne label="Séances de présence" valeur={nf(s.seances_presence)} sous={`${nf(s.presences_eleves)} présences d'élèves relevées`} />
            <Ligne label="Paiements encaissés" valeur={nf(s.paiements)} sous={s.paiements_annules ? `${nf(s.paiements_annules)} annulé(s)` : undefined} />
            <Ligne label="Total encaissé" valeur={`${nf(s.total_encaisse)} FCFA`} />
            <Ligne label="Reçus émis" valeur={nf(s.recus)} />
            <Ligne label="Bulletins publiés" valeur={nf(s.bulletins_publies)} />
          </CardContent>
        </Card>

        {/* ── Adoption ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Utilisation par les familles et les professeurs</CardTitle></CardHeader>
          <CardContent>
            <Ligne label="Comptes élèves créés" valeur={nf(c.eleves)} />
            <Ligne label="Élèves déjà connectés" valeur={`${nf(c.eleves_connectes)} (${pct(c.eleves_connectes, c.eleves)})`} />
            <Ligne label="Comptes professeurs" valeur={nf(c.professeurs)} />
            <Ligne label="Professeurs déjà connectés" valeur={`${nf(c.professeurs_connectes)} (${pct(c.professeurs_connectes, c.professeurs)})`} />
          </CardContent>
        </Card>
      </div>

      {/* ── Activité ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Activité</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-x-8">
            <div>
              <Ligne label="Dernière activité (toutes sources)" valeur={dt(t.derniere_activite)} sous={ilYA(t.derniere_activite, maintenant)} />
              <Ligne label="Dernière connexion d'un compte" valeur={dt(t.derniere_connexion)} sous={ilYA(t.derniere_connexion, maintenant)} />
              <Ligne label="Dernière ouverture de l'appli" valeur={dt(t.derniere_presence_appli)} sous={t.suivi_appli_depuis ? `suivi depuis le ${new Date(t.suivi_appli_depuis).toLocaleDateString('fr-FR')}` : 'suivi pas encore alimenté'} />
            </div>
            <div>
              <Ligne label="Dernière saisie de notes" valeur={dt(t.derniere_saisie_notes)} />
              <Ligne label="Dernier relevé de présence" valeur={dt(t.derniere_saisie_presences)} />
              <Ligne label="Dernier paiement" valeur={dt(t.dernier_paiement)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Kpi label="Jours actifs (30 j)" value={t.jours_actifs_30} />
            <Kpi label="Jours actifs (90 j)" value={t.jours_actifs_90} />
            <Kpi
              label="Actif depuis"
              value={t.premiere_activite ? new Date(t.premiere_activite).toLocaleDateString('fr-FR') : '—'}
              hint={sansActivite > 0 ? `aucune trace depuis ${sansActivite} jour${sansActivite > 1 ? 's' : ''}` : "trace aujourd'hui"}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Historique ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Historique des 90 derniers jours</CardTitle>
          <p className="text-xs text-muted-foreground">
            « Connectés » = personnes distinctes ayant ouvert l'appli ce jour-là (suivi depuis la mise en service). Les autres colonnes viennent des données saisies, y compris avant.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={13} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="connectes" name="Connectés" fill="#2563eb" stackId="a" />
                <Bar dataKey="seances" name="Séances de présence" fill="#f59e0b" stackId="a" />
                <Bar dataKey="paiements" name="Paiements" fill="#10b981" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="max-h-96 overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jour</TableHead>
                  <TableHead className="text-right">Connectés</TableHead>
                  <TableHead className="text-right">Notes</TableHead>
                  <TableHead className="text-right">Séances</TableHead>
                  <TableHead className="text-right">Paiements</TableHead>
                  <TableHead className="text-right">Inscriptions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.historique.filter(jourActif).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune activité sur 90 jours.</TableCell></TableRow>
                ) : d.historique.filter(jourActif).map(j => (
                  <TableRow key={j.jour}>
                    <TableCell className="whitespace-nowrap">{jourFr(j.jour)}</TableCell>
                    <TableCell className="text-right">{j.connectes || '—'}</TableCell>
                    <TableCell className="text-right">{j.notes || '—'}</TableCell>
                    <TableCell className="text-right">{j.seances || '—'}</TableCell>
                    <TableCell className="text-right">{j.paiements || '—'}</TableCell>
                    <TableCell className="text-right">{j.inscriptions || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformSchoolDetail;
