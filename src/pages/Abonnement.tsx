import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, CheckCircle2, Clock, RefreshCw, AlertTriangle, Image as ImageIcon, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  FORMULES, FORMULE_PAR_DEFAUT, trouverFormule, nomDuPlan,
  remisePourcent, prixParMois, prixPlein, economie,
} from '@/lib/subscriptionPlans';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const WHATSAPP_NUMBER = '221706811277';
const WHATSAPP_MESSAGE = "Bonjour, je souhaite activer/renouveler l'abonnement SenClass de mon établissement.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
// Grille et remises dans src/lib/subscriptionPlans.ts (couverte par
// subscriptionPlans.test.ts) : les prix y sont écrits en dur pour rester ronds,
// et la remise affichée en est déduite — elle ne peut donc pas mentir.
const WAVE_PAY_NUMBER = '+221 70 681 12 77';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  trial:     { label: 'Période d\'essai', variant: 'secondary' },
  active:    { label: 'Actif',            variant: 'default' },
  suspended: { label: 'Suspendu (impayé)', variant: 'destructive' },
  cancelled: { label: 'Annulé',           variant: 'destructive' },
};

interface BillingTx {
  id: string;
  plan: string;
  amount: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

const AbonnementPage = () => {
  const { school } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BillingTx[]>([]);
  const [loading, setLoading] = useState(true);

  const [waveNumber, setWaveNumber] = useState('');
  const [waveAccountName, setWaveAccountName] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moisChoisis, setMoisChoisis] = useState<number>(FORMULE_PAR_DEFAUT);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    const [{ data: schoolRow }, { data: txRows }] = await Promise.all([
      supabase.from('schools').select('subscription_status, subscription_plan, subscription_expires_at').eq('id', school.id).single(),
      supabase.from('billing_transactions').select('id, plan, amount, status, created_at, completed_at').eq('school_id', school.id).order('created_at', { ascending: false }).limit(10),
    ]);
    setStatus(schoolRow?.subscription_status ?? null);
    setPlan(schoolRow?.subscription_plan ?? null);
    setExpiresAt(schoolRow?.subscription_expires_at ?? null);
    setTransactions((txRows as BillingTx[]) ?? []);
    setLoading(false);
  }, [school?.id]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const hasPendingClaim = transactions.some(t => t.status === 'pending');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressing(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      const compressed = await compressImage(ev.target?.result as string, 1000, 'jpeg');
      setScreenshot(compressed);
      setIsCompressing(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmitClaim = async () => {
    if (!waveNumber.trim() || !waveAccountName.trim() || !screenshot) {
      toast({ title: 'Erreur', description: 'Numéro Wave, nom sur Wave et capture d\'écran sont obligatoires.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const formule = trouverFormule(moisChoisis);
      if (!formule) throw new Error('Durée d\'abonnement inconnue');
      const { error } = await sb.rpc('submit_payment_claim', {
        p_plan: nomDuPlan(formule),
        p_amount: formule.prix,
        p_months: formule.mois,
        p_wave_number: waveNumber.trim(),
        p_wave_account_name: waveAccountName.trim(),
        p_proof_screenshot: screenshot,
      });
      if (error) throw error;
      toast({ title: 'Déclaration envoyée', description: `Abonnement de ${formule.libelle} activé. Nous vérifions le paiement sous peu.` });
      setWaveNumber(''); setWaveAccountName(''); setScreenshot(null);
      await loadStatus();
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusInfo = status ? STATUS_LABELS[status] : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Abonnement</h1>
          <p className="text-sm text-muted-foreground">Gérez l'abonnement SenClass de votre établissement.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStatus} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Statut actuel</CardTitle>
            {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {plan && <p>Plan : <span className="font-medium text-foreground">{plan}</span></p>}
          {expiresAt && (
            <p>
              {status === 'active' ? 'Renouvellement le' : 'Expire le'} :{' '}
              <span className="font-medium text-foreground">{new Date(expiresAt).toLocaleDateString('fr-FR')}</span>
            </p>
          )}
          {status === 'trial' && (
            <p className="flex items-center gap-2 text-amber-600 pt-1">
              <AlertTriangle className="h-4 w-4" />
              Aucun abonnement payant actif pour le moment.
            </p>
          )}
          {hasPendingClaim && (
            <p className="flex items-center gap-2 text-blue-600 pt-1">
              <Clock className="h-4 w-4" />
              Déclaration de paiement en cours de vérification — votre accès est déjà actif.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="text-lg">Abonnement SenClass</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Choix de la durée ─────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-xs">Durée de l'abonnement</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {FORMULES.map(f => {
                const choisi = f.mois === moisChoisis;
                const remise = remisePourcent(f);
                return (
                  <button
                    key={f.mois}
                    type="button"
                    onClick={() => setMoisChoisis(f.mois)}
                    aria-pressed={choisi}
                    className={`relative rounded-lg border px-2 py-2.5 text-center transition-colors ${
                      choisi ? 'border-primary bg-primary/5 ring-1 ring-primary'
                             : 'border-border hover:border-primary/40'}`}
                  >
                    <p className="text-sm font-semibold text-foreground">{f.libelle}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {prixParMois(f).toLocaleString('fr-FR')} F/mois
                    </p>
                    {remise > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        −{remise}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Ce que l'école va payer ───────────────────────────────── */}
          {(() => {
            const f = trouverFormule(moisChoisis);
            if (!f) return null;
            return (
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <p className="text-2xl font-bold text-foreground">
                  {f.prix.toLocaleString('fr-FR')} FCFA
                  <span className="text-base font-normal text-muted-foreground"> pour {f.libelle}</span>
                </p>
                {economie(f) > 0 && (
                  <p className="text-sm text-emerald-700 mt-0.5">
                    Vous économisez {economie(f).toLocaleString('fr-FR')} FCFA
                    <span className="text-muted-foreground">
                      {' '}(au lieu de {prixPlein(f.mois).toLocaleString('fr-FR')} FCFA)
                    </span>
                  </p>
                )}
              </div>
            );
          })()}

          <div className="px-3 py-2.5 rounded-lg bg-muted/50 text-sm space-y-1">
            <p className="font-medium text-foreground">1. Payez par Wave au {WAVE_PAY_NUMBER}</p>
            <p className="text-muted-foreground">2. Renseignez ci-dessous le numéro et le nom utilisés pour payer, avec une capture d'écran de la confirmation</p>
            <p className="text-muted-foreground">3. Votre compte est activé immédiatement — nous vérifions ensuite</p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Numéro Wave utilisé pour payer</Label>
              <Input placeholder="Ex: 77 123 45 67" value={waveNumber} onChange={e => setWaveNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nom sur le compte Wave</Label>
              <Input placeholder="Ex: Mamadou Diallo" value={waveAccountName} onChange={e => setWaveAccountName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Capture d'écran du paiement</Label>
              {screenshot ? (
                <div className="relative rounded-lg overflow-hidden border">
                  <img src={screenshot} alt="Capture du paiement" className="w-full max-h-56 object-contain bg-muted" />
                  <Button
                    variant="secondary" size="sm" className="absolute top-2 right-2"
                    onClick={() => fileRef.current?.click()}
                  >
                    Changer
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-28 rounded-lg border border-dashed flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:bg-muted/50 transition-colors"
                  disabled={isCompressing}
                >
                  {isCompressing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                  <span className="text-xs">{isCompressing ? 'Traitement…' : 'Choisir une capture d\'écran'}</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>

            <Button
              className="w-full gap-2"
              disabled={isSubmitting || isCompressing || !waveNumber.trim() || !waveAccountName.trim() || !screenshot}
              onClick={handleSubmitClaim}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              J'ai payé — Activer mon compte
            </Button>
          </div>

          <Button className="w-full gap-2" variant="outline" asChild>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Une question ? Nous contacter sur WhatsApp
            </a>
          </Button>
        </CardContent>
      </Card>

      {transactions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Historique des paiements</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-2">
                <div className="flex items-center gap-2">
                  {tx.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span className="capitalize">{tx.plan}</span>
                  <span className="text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{tx.amount.toLocaleString('fr-FR')} FCFA</span>
                  <Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'pending' ? 'secondary' : 'destructive'}>
                    {tx.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AbonnementPage;
