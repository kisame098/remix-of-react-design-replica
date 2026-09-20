import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, CheckCircle2, PauseCircle, XCircle, Ban, RefreshCw, AlertTriangle, Timer, Trash2, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ilYA, niveauActivite, LIBELLES_NIVEAU } from '@/lib/activiteEcole';
import { SuppressionEcoleDialog } from '@/components/platform/SuppressionEcoleDialog';
import { isExpired, isPaidOverdue, TRIAL_PRESETS, minutesFromNowISO } from '@/lib/subscription';

// Les nouvelles RPCs ne sont pas encore dans les types générés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface VueEcole {
  eleves: number; professeurs: number; personnel: number; classes: number; notes: number;
  derniere_activite: string | null; jours_actifs_30: number;
}
interface EmailsEcole { contact: string | null; admins: string[] }

type SubscriptionStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

interface SchoolRow {
  id: string;
  name: string;
  city: string | null;
  country: string;
  created_at: string;
  subscription_status: SubscriptionStatus;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
}

const STATUS_INFO: Record<SubscriptionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  trial:     { label: "Essai",   variant: 'secondary' },
  active:    { label: 'Actif',    variant: 'default' },
  suspended: { label: 'Suspendu', variant: 'destructive' },
  cancelled: { label: 'Annulé',   variant: 'outline' },
};

type FilterKey = SubscriptionStatus | 'all' | 'attention';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'attention', label: 'À vérifier' },
  { key: 'trial', label: 'Essai' },
  { key: 'active', label: 'Actif' },
  { key: 'suspended', label: 'Suspendu' },
  { key: 'cancelled', label: 'Annulé' },
];

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';

/** Échéance dépassée : essai écoulé (accès déjà coupé) ou abonnement payant en retard (signal seulement). */
const needsAttention = (s: SchoolRow) =>
  (s.subscription_status === 'trial' && isExpired(s.subscription_expires_at)) ||
  isPaidOverdue(s.subscription_status, s.subscription_expires_at);

const PlatformSchools = () => {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [actingId, setActingId] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<SchoolRow | null>(null);
  const [banEmail, setBanEmail] = useState('');
  const [banReason, setBanReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);
  const [trialTarget, setTrialTarget] = useState<SchoolRow | null>(null);
  const [customMinutes, setCustomMinutes] = useState('');
  const [isSettingTrial, setIsSettingTrial] = useState(false);
  const [emails, setEmails] = useState<Record<string, EmailsEcole>>({});
  const [vues, setVues] = useState<Record<string, VueEcole>>({});
  const [deleteTarget, setDeleteTarget] = useState<SchoolRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, city, country, created_at, subscription_status, subscription_plan, subscription_expires_at')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setSchools((data ?? []) as SchoolRow[]);
    }
    setLoading(false);

    // E-mails (contact de l'école + comptes directeur) : `profiles` n'est lisible
    // que par son propriétaire, on passe donc par une fonction du chef du système.
    const { data: em, error: emErr } = await sb.rpc('platform_school_emails');
    if (emErr) {
      toast({ title: 'E-mails indisponibles', description: emErr.message, variant: 'destructive' });
    } else {
      const parEcole: Record<string, EmailsEcole> = {};
      for (const r of (em ?? []) as { school_id: string; contact_email: string | null; admin_emails: string[] }[]) {
        parEcole[r.school_id] = { contact: r.contact_email, admins: r.admin_emails ?? [] };
      }
      setEmails(parEcole);
    }

    // Effectifs et dernière activité : uniquement des comptes et des dates.
    const { data: ov, error: ovErr } = await sb.rpc('platform_schools_overview');
    if (ovErr) {
      toast({ title: 'Effectifs indisponibles', description: ovErr.message, variant: 'destructive' });
    } else {
      const parEcole: Record<string, VueEcole> = {};
      for (const r of (ov ?? []) as (VueEcole & { school_id: string })[]) {
        parEcole[r.school_id] = { ...r, eleves: Number(r.eleves), professeurs: Number(r.professeurs), personnel: Number(r.personnel),
          classes: Number(r.classes), notes: Number(r.notes), jours_actifs_30: Number(r.jours_actifs_30) };
      }
      setVues(parEcole);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (school: SchoolRow, status: SubscriptionStatus) => {
    setActingId(school.id);
    try {
      const { error } = await sb.rpc('platform_update_subscription', {
        p_school_id: school.id, p_status: status, p_plan: null, p_expires_at: null,
      });
      if (error) throw error;
      setSchools(prev => prev.map(s => s.id === school.id ? { ...s, subscription_status: status } : s));
      toast({ title: 'Succès', description: `${school.name} → ${STATUS_INFO[status].label}` });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setActingId(null);
    }
  };

  // Période d'essai personnalisable par école (défaut 7 jours à l'inscription) :
  // repasse l'école en 'trial' avec une nouvelle échéance. 1 minute possible
  // pour tester le comportement de fin d'essai en conditions réelles.
  const applyTrial = async (minutes: number) => {
    if (!trialTarget) return;
    setIsSettingTrial(true);
    try {
      const expiresAt = minutesFromNowISO(minutes);
      const { error } = await sb.rpc('platform_update_subscription', {
        p_school_id: trialTarget.id, p_status: 'trial', p_plan: null, p_expires_at: expiresAt,
      });
      if (error) throw error;
      setSchools(prev => prev.map(s => s.id === trialTarget.id
        ? { ...s, subscription_status: 'trial' as SubscriptionStatus, subscription_expires_at: expiresAt }
        : s));
      toast({ title: 'Essai mis à jour', description: `${trialTarget.name} — essai jusqu'au ${formatDateTime(expiresAt)}` });
      setTrialTarget(null);
      setCustomMinutes('');
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSettingTrial(false);
    }
  };

  const openBanDialog = async (school: SchoolRow) => {
    setBanTarget(school);
    setBanReason('');
    setBanEmail(emails[school.id]?.admins[0] ?? emails[school.id]?.contact ?? '');
  };

  const confirmBan = async () => {
    if (!banTarget || !banEmail.trim()) return;
    setIsBanning(true);
    try {
      const { error } = await sb.rpc('platform_ban_account', {
        p_email: banEmail.trim(), p_reason: banReason.trim() || null, p_school_name: banTarget.name,
      });
      if (error) throw error;
      await setStatus(banTarget, 'cancelled');
      toast({ title: 'Compte banni', description: `${banEmail} ne pourra plus jamais s'inscrire.` });
      setBanTarget(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsBanning(false);
    }
  };

  const filtered = filter === 'all'
    ? schools
    : filter === 'attention'
      ? schools.filter(needsAttention)
      : schools.filter(s => s.subscription_status === filter);

  const attentionCount = schools.filter(needsAttention).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Écoles</h1>
          <p className="text-sm text-muted-foreground">
            {schools.length} école{schools.length !== 1 ? 's' : ''} au total
            {attentionCount > 0 && (
              <span className="text-amber-600 font-medium"> · {attentionCount} à vérifier</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Actualiser
        </Button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <Button
            key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'}
            className={f.key === 'attention' && attentionCount > 0 && filter !== f.key ? 'border-amber-500 text-amber-700' : ''}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key === 'attention' && attentionCount > 0 && ` (${attentionCount})`}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-16 text-muted-foreground text-sm">Aucune école pour ce filtre</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>École</TableHead>
                  <TableHead className="text-right">Élèves</TableHead>
                  <TableHead>Activité</TableHead>
                  <TableHead>E-mails</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(school => {
                  const info = STATUS_INFO[school.subscription_status];
                  const isActing = actingId === school.id;
                  const trialOver = school.subscription_status === 'trial' && isExpired(school.subscription_expires_at);
                  const paidOverdue = isPaidOverdue(school.subscription_status, school.subscription_expires_at);
                  return (
                    <TableRow key={school.id} className={needsAttention(school) ? 'bg-amber-50/50' : undefined}>
                      <TableCell className="font-medium">
                        <Link to={`/platform/ecoles/${school.id}`} className="hover:underline text-primary">{school.name}</Link>
                        <div className="text-xs text-muted-foreground font-normal">{school.city ?? '—'}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-semibold">{vues[school.id]?.eleves ?? '—'}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {vues[school.id] ? `${vues[school.id].professeurs} prof · ${vues[school.id].classes} cl.` : ''}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {(() => {
                          const v = vues[school.id];
                          const niveau = niveauActivite(v?.derniere_activite, Date.now());
                          const n = LIBELLES_NIVEAU[niveau];
                          return (
                            <>
                              <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${n.classe}`}>{n.label}</span>
                              <p className="text-muted-foreground mt-0.5">{v ? ilYA(v.derniere_activite, Date.now()) : ''}</p>
                              {v && <p className="text-muted-foreground">{v.jours_actifs_30} j actifs / 30</p>}
                            </>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs max-w-[240px]">
                        {(() => {
                          const e = emails[school.id];
                          const liste = [...new Set([...(e?.admins ?? []), ...(e?.contact ? [e.contact] : [])])];
                          return liste.length === 0
                            ? <span className="text-muted-foreground">—</span>
                            : liste.map(m => (
                                <a key={m} href={`mailto:${m}`} className="flex items-center gap-1 text-blue-700 hover:underline break-all">
                                  <Mail className="h-3 w-3 flex-shrink-0" />{m}
                                </a>
                              ));
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={info.variant}>{info.label}</Badge>
                          {trialOver && (
                            <span className="flex items-center gap-1 text-[11px] text-amber-700">
                              <AlertTriangle className="h-3 w-3" />Essai terminé
                            </span>
                          )}
                          {paidOverdue && (
                            <span className="flex items-center gap-1 text-[11px] text-amber-700">
                              <AlertTriangle className="h-3 w-3" />Échéance dépassée
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{school.subscription_plan ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(school.subscription_expires_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(school.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {school.subscription_status !== 'active' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Activer" disabled={isActing} onClick={() => setStatus(school, 'active')}>
                              {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                            </Button>
                          )}
                          {school.subscription_status !== 'suspended' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Suspendre" disabled={isActing} onClick={() => setStatus(school, 'suspended')}>
                              <PauseCircle className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          {school.subscription_status !== 'cancelled' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Annuler" disabled={isActing} onClick={() => setStatus(school, 'cancelled')}>
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Définir la période d'essai" onClick={() => { setTrialTarget(school); setCustomMinutes(''); }}>
                            <Timer className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Bannir définitivement" onClick={() => openBanDialog(school)}>
                            <Ban className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Supprimer l'école et toutes ses données" onClick={() => setDeleteTarget(school)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SuppressionEcoleDialog
        ecole={deleteTarget}
        onFermer={() => setDeleteTarget(null)}
        onSupprimee={id => setSchools(prev => prev.filter(x => x.id !== id))}
      />

      <Dialog open={!!trialTarget} onOpenChange={(open) => !open && setTrialTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Période d'essai — {trialTarget?.name}</DialogTitle>
            <DialogDescription>
              L'école repasse en essai jusqu'à la date choisie. C'est le seul cas où l'accès se coupe
              tout seul à l'échéance ; un abonnement payant, lui, n'est jamais désactivé automatiquement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2">
              {TRIAL_PRESETS.map(preset => (
                <Button
                  key={preset.label} variant="outline" size="sm"
                  disabled={isSettingTrial}
                  onClick={() => applyTrial(preset.minutes)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Durée personnalisée (en minutes)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min="1" placeholder="Ex: 20160 (14 jours)"
                  value={customMinutes}
                  onChange={e => setCustomMinutes(e.target.value)}
                />
                <Button
                  disabled={isSettingTrial || !customMinutes || Number(customMinutes) <= 0}
                  onClick={() => applyTrial(Number(customMinutes))}
                >
                  {isSettingTrial ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer'}
                </Button>
              </div>
            </div>
            {trialTarget?.subscription_expires_at && (
              <p className="text-xs text-muted-foreground">
                Échéance actuelle : {formatDateTime(trialTarget.subscription_expires_at)}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bannir {banTarget?.name}</DialogTitle>
            <DialogDescription>
              Irréversible — cet email ne pourra plus jamais créer de compte sur SenClass. L'école est aussi annulée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Email à bannir</Label>
              <Input value={banEmail} onChange={e => setBanEmail(e.target.value)} placeholder="admin@ecole.sn" />
            </div>
            <div className="space-y-2">
              <Label>Motif (optionnel)</Label>
              <Input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Ex: fausse déclaration de paiement" />
            </div>
            <Button
              variant="destructive" className="w-full gap-2"
              disabled={!banEmail.trim() || isBanning}
              onClick={confirmBan}
            >
              {isBanning && <Loader2 className="h-4 w-4 animate-spin" />}
              Bannir définitivement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformSchools;
