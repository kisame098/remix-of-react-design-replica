import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { isCashierAccount } from '@/lib/permissions';
import { QrScanner } from '@/components/payment/QrScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  decodePaymentIntent, PaymentIntent, PaymentType,
  PaymentMethod, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS,
  getAcademicMonths, TuitionBillingTiming, DEFAULT_TUITION_BILLING_TIMING,
  Payment,
} from '@/types/payment';
import { Student } from '@/contexts/SchoolContext';
import { useRecus } from '@/hooks/useRecus';
import {
  ScanLine, History, XCircle, CheckCircle2, LogOut, AlertCircle, Loader2, Search, Trash2, Receipt as ReceiptIcon,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
const getInitials = (f: string, l: string) => `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase();
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

interface ResolvedItem {
  type: PaymentType;
  monthKey?: string;
  serviceId?: string;
  amount: number;
  label: string;
  alreadyPaid: boolean;
}

type Tab = 'scan' | 'history' | 'cancel';

// ─── Page ─────────────────────────────────────────────────────────────────────
const Caisse = () => {
  const { school, profile, accountRole, staffPermissions, signOut } = useAuth();
  const { students, studentsLoading } = useSchool();
  const {
    payments, annexServices, getTuitionConfig,
    hasPaidInscription, hasPaidTuitionMonth, hasPaidService,
    addPayment, cancelPayment, paymentLoading,
  } = usePayment();
  const { currentYear } = useSchoolYear();
  const { montrerRecu, dialogueRecu } = useRecus();
  // Tant que les élèves/tarifs ne sont pas encore chargés (réseau mobile lent),
  // un scan valide donnerait à tort "élève introuvable" — on bloque le scan.
  const dataReady = !studentsLoading && !paymentLoading;

  const billingTiming = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
  const academicMonths = useMemo(
    () => currentYear ? getAcademicMonths(currentYear.startDate, currentYear.endDate, billingTiming) : [],
    [currentYear, billingTiming]
  );
  const monthLabel = (key?: string) => (key && academicMonths.find(m => m.key === key)?.label) || key || '';

  const [tab, setTab]         = useState<Tab>('scan');
  const [matched, setMatched] = useState<{ student: Student; item: ResolvedItem } | null>(null);
  const [scanError, setScanError]   = useState<string | null>(null);
  const [method, setMethod]         = useState<PaymentMethod>('especes');
  const [confirming, setConfirming] = useState(false);
  const [justPaid, setJustPaid]     = useState(false);
  const [search, setSearch]         = useState('');

  const METHODS: PaymentMethod[] = ['especes', 'wave', 'orange_money', 'virement', 'cheque'];

  // ── Résoudre le montant exact pour l'intention scannée (jamais depuis le QR) ─
  const resolveItem = (studentId: string, classId: string | null, intent: PaymentIntent): ResolvedItem | null => {
    const cfg = classId ? getTuitionConfig(classId) : undefined;
    if (intent.type === 'inscription') {
      if (!cfg) return null;
      return { type: 'inscription', amount: cfg.inscriptionFee, label: "Frais d'inscription", alreadyPaid: hasPaidInscription(studentId) };
    }
    if (intent.type === 'tuition') {
      if (!cfg || !intent.monthKey) return null;
      return {
        type: 'tuition', monthKey: intent.monthKey, amount: cfg.monthlyFee,
        label: `Scolarité — ${monthLabel(intent.monthKey)}`,
        alreadyPaid: hasPaidTuitionMonth(studentId, intent.monthKey),
      };
    }
    if (intent.type === 'service' && intent.serviceId) {
      const svc = annexServices.find(s => s.id === intent.serviceId);
      if (!svc) return null;
      return {
        type: 'service', serviceId: intent.serviceId, monthKey: intent.monthKey, amount: svc.amount,
        label: svc.name + (intent.monthKey ? ` — ${monthLabel(intent.monthKey)}` : ''),
        alreadyPaid: hasPaidService(studentId, intent.serviceId, intent.monthKey),
      };
    }
    return null;
  };

  const flashError = (msg: string) => {
    setScanError(msg);
    setTimeout(() => setScanError(null), 3000);
  };

  const handleScan = (code: string) => {
    if (matched) return; // déjà en attente de confirmation
    const intent = decodePaymentIntent(code);
    if (!intent) {
      flashError("Ce n'est pas un QR de paiement — l'élève doit d'abord choisir un montant à payer dans son espace élève.");
      return;
    }
    const student = students.find(s => s.id === intent.enrollmentId);
    if (!student) { flashError('Élève introuvable pour ce code.'); return; }
    const item = resolveItem(student.id, student.classId, intent);
    if (!item) { flashError('Impossible de déterminer le montant pour ce paiement.'); return; }
    setMatched({ student, item });
  };

  const resetScan = () => {
    setMatched(null);
    setJustPaid(false);
    setMethod('especes');
  };

  const handleConfirm = async () => {
    if (!matched) return;
    setConfirming(true);
    try {
      const enregistre = await addPayment({
        studentId:       matched.student.id,
        studentUniqueId: matched.student.studentId,
        type:            matched.item.type,
        serviceId:       matched.item.serviceId,
        monthKey:        matched.item.monthKey,
        amount:          matched.item.amount,
        method,
        receivedBy:      profile?.full_name || profile?.email || undefined,
      });
      setJustPaid(true);
      setTimeout(resetScan, 1800);
      // Après l'encaissement, jamais avant : montrerRecu ne lève pas.
      void montrerRecu([enregistre], { apresEncaissement: true });
    } catch (err) {
      const isDup = (err as { code?: string } | null)?.code === '23505';
      flashError(isDup ? 'Déjà payé entre-temps — aucun double paiement enregistré.' : "Erreur : le paiement n'a pas pu être enregistré.");
      resetScan();
    } finally {
      setConfirming(false);
    }
  };

  // ── Historique / Annulation ──────────────────────────────────────────────────
  const getPaymentLabel = (p: Payment) => {
    if (p.type === 'inscription') return "Frais d'inscription";
    if (p.type === 'tuition') return `Scolarité — ${monthLabel(p.monthKey)}`;
    if (p.type === 'service') {
      const svc = annexServices.find(s => s.id === p.serviceId);
      return `${svc?.name ?? 'Service'}${p.monthKey ? ' — ' + monthLabel(p.monthKey) : ''}`;
    }
    return 'Paiement';
  };

  const recent = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...payments]
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
      .filter(p => {
        if (!q) return true;
        const s = students.find(st => st.id === p.studentId);
        const name = s ? `${s.firstName} ${s.lastName}`.toLowerCase() : '';
        return name.includes(q) || p.studentUniqueId.toLowerCase().includes(q);
      })
      .slice(0, 60);
  }, [payments, search, students]);

  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const handleCancel = async (id: string) => {
    setCancelingId(id);
    try {
      await cancelPayment(id);
    } finally {
      setCancelingId(null);
    }
  };

  // ── Accès réservé : admin (pour test) ou staff avec la permission "cashier" ──
  const allowed = accountRole === 'admin' || isCashierAccount(accountRole, staffPermissions);
  if (!allowed) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 h-14">
          <div>
            <p className="font-black text-slate-900 text-sm leading-tight">Caisse mobile</p>
            <p className="text-[11px] text-slate-400 leading-tight truncate max-w-[220px]">{school?.name}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-5 pb-24">
        {tab === 'scan' && (
          <div className="space-y-4">
            {scanError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-3 py-2.5">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{scanError}</span>
              </div>
            )}

            {!dataReady ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-slate-400">Chargement des données de l'école…</p>
              </div>
            ) : !matched ? (
              <>
                <QrScanner onScan={handleScan} />
                <p className="text-xs text-slate-400 text-center px-6">
                  Présentez le QR de paiement affiché sur le téléphone de l'élève (généré depuis son espace élève, pas sa carte).
                </p>
              </>
            ) : justPaid ? (
              <div className="flex flex-col items-center text-center gap-3 py-10">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                </div>
                <p className="font-black text-lg text-slate-800">Payé !</p>
                <p className="text-sm text-slate-500">{matched.item.label} — {fmt(matched.item.amount)}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0 overflow-hidden">
                    {matched.student.photoUrl
                      ? <img src={matched.student.photoUrl} className="w-full h-full object-cover" alt="" />
                      : getInitials(matched.student.firstName, matched.student.lastName)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{matched.student.firstName} {matched.student.lastName}</p>
                    <p className="text-xs text-slate-400 font-mono">{matched.student.studentId}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-700">{matched.item.label}</p>
                  <p className="text-2xl font-black text-slate-900 mt-0.5">{fmt(matched.item.amount)}</p>
                </div>

                {matched.item.alreadyPaid ? (
                  <>
                    <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      Déjà payé — rien à encaisser.
                    </div>
                    <Button variant="outline" className="w-full" onClick={resetScan}>Scanner un autre paiement</Button>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {METHODS.map(m => (
                        <button
                          key={m}
                          onClick={() => setMethod(m)}
                          className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                            method === m ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-500'
                          }`}
                        >
                          <span className="text-base">{PAYMENT_METHOD_ICONS[m]}</span>
                          {PAYMENT_METHOD_LABELS[m]}
                        </button>
                      ))}
                    </div>
                    <Button className="w-full gap-2" size="lg" onClick={handleConfirm} disabled={confirming}>
                      {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Confirmer le paiement — {fmt(matched.item.amount)}
                    </Button>
                    <button onClick={resetScan} className="w-full text-center text-xs text-slate-400 hover:text-slate-600">
                      Annuler / scanner autre chose
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {(tab === 'history' || tab === 'cancel') && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
              <Input
                className="pl-9 bg-white" placeholder="Rechercher un élève…"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            {recent.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">Aucun paiement trouvé</p>
            ) : recent.map(p => {
              const s = students.find(st => st.id === p.studentId);
              const cancelled = p.status === 'cancelled';
              return (
                <div key={p.id} className={`bg-white rounded-2xl border shadow-sm p-3.5 ${cancelled ? 'border-red-100 bg-red-50/40' : 'border-slate-100'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`font-semibold text-sm truncate ${cancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                          {s ? `${s.firstName} ${s.lastName}` : p.studentUniqueId}
                        </p>
                        {cancelled && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0">ANNULÉ</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{getPaymentLabel(p)}</p>
                    </div>
                    <p className={`font-black flex-shrink-0 ${cancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{fmt(p.amount)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-50">
                    <span className="text-[10px] text-slate-400 font-mono">{fmtDateTime(p.paidAt)}</span>
                    <span className="text-[10px] text-slate-400">
                      {PAYMENT_METHOD_LABELS[p.method]} · {p.receivedBy || 'Non renseigné'}
                    </span>
                  </div>
                  {cancelled && (
                    <p className="text-[10px] text-red-500 mt-1">
                      Annulé {p.cancelledAt ? `le ${fmtDateTime(p.cancelledAt)}` : ''} par{' '}
                      <span className="font-semibold">{p.cancelledBy || 'Non renseigné'}</span>
                    </p>
                  )}

                  {/* Reçu : réimpression d'un reçu émis, ou émission pour un paiement
                      antérieur au système de reçus. Un paiement annulé sans reçu
                      n'en a pas : rien à proposer. */}
                  {tab === 'history' && (!cancelled || p.receiptId) && (
                    <Button
                      variant="outline" size="sm" className="w-full mt-3 gap-1.5"
                      onClick={() => void montrerRecu([p], { duplicata: !!p.receiptId })}
                    >
                      <ReceiptIcon className="h-3.5 w-3.5" />
                      {p.receiptId ? 'Voir / réimprimer le reçu' : 'Émettre le reçu'}
                    </Button>
                  )}

                  {tab === 'cancel' && !cancelled && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline" size="sm"
                          className="w-full mt-3 gap-1.5 text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700"
                          disabled={cancelingId === p.id}
                        >
                          {cancelingId === p.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                          Annuler ce paiement
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Annuler ce paiement ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {getPaymentLabel(p)} — {fmt(p.amount)} pour {s ? `${s.firstName} ${s.lastName}` : p.studentUniqueId}.
                            Le paiement reste visible dans l'historique (marqué "Annulé") et redevient dû pour l'élève — cette action ne peut pas être défaite.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Retour</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleCancel(p.id)}
                          >
                            Oui, annuler
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-md mx-auto flex">
          {([
            { key: 'scan' as Tab,    label: 'Scanner',   Icon: ScanLine },
            { key: 'history' as Tab, label: 'Historique', Icon: History },
            { key: 'cancel' as Tab,  label: 'Annuler',    Icon: XCircle },
          ]).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); if (key !== 'scan') resetScan(); }}
              className={`relative flex-1 flex flex-col items-center gap-0.5 py-3 text-[11px] font-semibold transition-colors ${
                tab === key ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab === key && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />}
              <Icon className="h-[22px] w-[22px]" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {dialogueRecu}
    </div>
  );
};

export default Caisse;
