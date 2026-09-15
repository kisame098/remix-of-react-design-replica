import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Loader2, CheckCircle2, XCircle, ZoomIn, RefreshCw, Phone, User, Trash2, ImageOff, Clock,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// 'failed' et 'cancelled' viennent de l'ancienne intégration de paiement
// (déclarations de septembre 2026, antérieures à Wave). Elles restent en base —
// une écriture comptable ne se réécrit pas — donc cet écran doit savoir les
// afficher. Les ignorer faisait planter l'onglet « Tout l'historique ».
type ClaimStatus = 'pending' | 'completed' | 'rejected' | 'failed' | 'cancelled';
type FilterKey = 'pending' | 'completed' | 'rejected' | 'all';

interface ClaimRow {
  id: string;
  school_id: string | null;
  school_name: string | null;
  status: ClaimStatus;
  plan: string;
  amount: number;
  currency: string;
  ref_command: string;
  wave_number: string | null;
  wave_account_name: string | null;
  proof_screenshot_url: string | null;
  screenshot_deleted_at: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

type StatusInfo = { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };

const STATUS_INFO: Record<ClaimStatus, StatusInfo> = {
  pending:   { label: 'En attente', variant: 'secondary' },
  completed: { label: 'Confirmé',   variant: 'default' },
  rejected:  { label: 'Rejeté',     variant: 'destructive' },
  failed:    { label: 'Échouée (ancien système)',  variant: 'outline' },
  cancelled: { label: 'Annulée (ancien système)',  variant: 'outline' },
};

/** Jamais indéfini : un statut inconnu s'affiche tel quel plutôt que de faire
 *  planter tout l'écran. L'historique doit rester consultable quoi qu'il
 *  contienne. */
const statusInfo = (statut: string): StatusInfo =>
  STATUS_INFO[statut as ClaimStatus] ?? { label: statut || 'Inconnu', variant: 'outline' };

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'pending', label: 'En attente' },
  { key: 'completed', label: 'Confirmés' },
  { key: 'rejected', label: 'Rejetés' },
  { key: 'all', label: 'Tout l\'historique' },
];

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const PlatformPaymentClaims = () => {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ClaimRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<ClaimRow | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Tout l'historique est chargé d'un coup : il ne doit jamais disparaître,
    // c'est une trace comptable (aucune policy DELETE n'existe sur la table).
    const { data, error } = await sb
      .from('billing_transactions')
      .select('id, school_id, school_name, status, plan, amount, currency, ref_command, wave_number, wave_account_name, proof_screenshot_url, screenshot_deleted_at, rejection_reason, reviewed_at, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setClaims((data ?? []) as ClaimRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = async (claim: ClaimRow, approve: boolean, reason?: string) => {
    const { error } = await sb.rpc('platform_review_payment_claim', {
      p_transaction_id: claim.id, p_approve: approve, p_rejection_reason: reason ?? null,
    });
    if (error) throw error;
    setClaims(prev => prev.map(c => c.id === claim.id
      ? { ...c, status: approve ? 'completed' : 'rejected', reviewed_at: new Date().toISOString(), rejection_reason: reason ?? null }
      : c));
  };

  const approve = async (claim: ClaimRow) => {
    setActingId(claim.id);
    try {
      await review(claim, true);
      toast({ title: 'Confirmé', description: `${claim.school_name ?? 'École'} — abonnement prolongé d'1 mois.` });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setActingId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setIsRejecting(true);
    try {
      await review(rejectTarget, false, rejectReason.trim() || undefined);
      toast({ title: 'Rejeté', description: `${rejectTarget.school_name ?? 'École'} repasse en suspendu.` });
      setRejectTarget(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsRejecting(false);
    }
  };

  // Supprime UNIQUEMENT l'image — la ligne (montant, date, numéro Wave, nom,
  // verdict) reste pour toujours.
  const confirmPurge = async () => {
    if (!purgeTarget) return;
    setIsPurging(true);
    try {
      const { error } = await sb.rpc('platform_delete_payment_screenshot', { p_transaction_id: purgeTarget.id });
      if (error) throw error;
      const now = new Date().toISOString();
      setClaims(prev => prev.map(c => c.id === purgeTarget.id
        ? { ...c, proof_screenshot_url: null, screenshot_deleted_at: now }
        : c));
      toast({ title: 'Capture supprimée', description: 'La trace écrite du paiement est conservée.' });
      setPurgeTarget(null);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsPurging(false);
    }
  };

  const filtered = filter === 'all' ? claims : claims.filter(c => c.status === filter);
  const pendingCount = claims.filter(c => c.status === 'pending').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Paiements</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount} déclaration{pendingCount !== 1 ? 's' : ''} à vérifier — l'école est déjà active (bénéfice du doute)
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
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.key === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            Aucune déclaration dans cette catégorie
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(claim => {
            const isActing = actingId === claim.id;
            const info = statusInfo(claim.status);
            return (
              <Card key={claim.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {claim.school_name ?? 'École supprimée'}
                        {!claim.school_id && <span className="text-xs font-normal text-muted-foreground"> (compte supprimé)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(claim.created_at)}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{claim.ref_command}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant={info.variant}>{info.label}</Badge>
                      <span className="text-sm font-medium">{claim.amount.toLocaleString('fr-FR')} {claim.currency}</span>
                    </div>
                  </div>

                  <div className="text-sm space-y-1 bg-muted/30 rounded-lg p-2.5">
                    <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {claim.wave_number || '—'}</p>
                    <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" /> {claim.wave_account_name || '—'}</p>
                  </div>

                  {claim.proof_screenshot_url ? (
                    <button
                      className="block w-full relative group rounded-lg overflow-hidden border"
                      onClick={() => setZoomUrl(claim.proof_screenshot_url)}
                    >
                      <img src={claim.proof_screenshot_url} alt="Preuve de paiement" className="w-full max-h-52 object-contain bg-muted" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                      </div>
                    </button>
                  ) : claim.screenshot_deleted_at ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg p-2.5 bg-muted/20">
                      <ImageOff className="h-3.5 w-3.5" />
                      Capture supprimée le {formatDateTime(claim.screenshot_deleted_at)} — trace écrite conservée
                    </p>
                  ) : null}

                  {claim.status === 'pending' ? (
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" className="flex-1 gap-1.5" disabled={isActing} onClick={() => approve(claim)}>
                        {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Confirmer
                      </Button>
                      <Button
                        size="sm" variant="outline" className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                        disabled={isActing}
                        onClick={() => { setRejectTarget(claim); setRejectReason(''); }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Rejeter
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Vérifié le {formatDateTime(claim.reviewed_at)}
                      </p>
                      {claim.rejection_reason && (
                        <p className="text-xs text-destructive">Motif : {claim.rejection_reason}</p>
                      )}
                      {claim.proof_screenshot_url && (
                        <Button
                          size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-muted-foreground"
                          onClick={() => setPurgeTarget(claim)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer la capture
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!zoomUrl} onOpenChange={(open) => !open && setZoomUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Preuve de paiement</DialogTitle></DialogHeader>
          {zoomUrl && <img src={zoomUrl} alt="Preuve de paiement agrandie" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la déclaration de {rejectTarget?.school_name ?? 'cette école'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              L'école repassera en statut "Suspendu" immédiatement. La déclaration reste dans l'historique.
            </p>
            <div className="space-y-2">
              <Label>Motif (optionnel)</Label>
              <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Ex: aucun paiement retrouvé sur ce numéro" />
            </div>
            <Button variant="destructive" className="w-full gap-2" disabled={isRejecting} onClick={confirmReject}>
              {isRejecting && <Loader2 className="h-4 w-4 animate-spin" />}
              Rejeter et suspendre
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!purgeTarget} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la capture d'écran</DialogTitle>
            <DialogDescription>
              Seule l'image est effacée. Le montant, la date, le numéro Wave, le nom et le verdict
              restent dans l'historique — définitivement.
            </DialogDescription>
          </DialogHeader>
          <Button variant="destructive" className="w-full gap-2 mt-2" disabled={isPurging} onClick={confirmPurge}>
            {isPurging && <Loader2 className="h-4 w-4 animate-spin" />}
            Supprimer la capture
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformPaymentClaims;
