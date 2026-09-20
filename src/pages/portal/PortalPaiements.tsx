import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { supabase } from '@/integrations/supabase/client';
import { useDonneesHorsLigne } from '@/hooks/useDonneesHorsLigne';
import { BandeauDonneesEnregistrees } from '@/components/BandeauDonneesEnregistrees';
import { cn } from '@/lib/utils';
import {
  CreditCard, Loader2, CheckCircle2, AlertCircle,
  HandCoins, Smartphone, Building2, Banknote, QrCode, X, ChevronRight, Lock, CalendarPlus,
  XCircle as XCircleIcon, Receipt as ReceiptIcon,
} from 'lucide-react';
import {
  Payment, AnnexSvc,
  MONTHS_FULL,
  fmtAmount, fmtDateTimeFull, paymentRef,
  paymentLabel, methodKey, methodLabel, methodColorCls,
} from './portalHelpers';
import {
  AcademicMonth, TuitionBillingTiming, DEFAULT_TUITION_BILLING_TIMING,
  getAcademicMonths, getCurrentMonthIndex, encodePaymentIntent, PaymentIntent,
  getBillableMonthsFor, readBillingRules,
} from '@/types/payment';
import { computeDueItems, totalExigible, type DueItem } from '@/lib/dueItems';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { chargerRecusEleve, type RecusEleve } from '@/lib/recusFamille';
import { numeroDeRecu } from '@/lib/recu';
import { useRecuFamille } from '@/components/portal/RecuFamille';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TuitionCfg {
  classId:        string;
  inscriptionFee: number;
  monthlyFee:     number;
  yearLabel:      string;
}

interface ServiceEnr {
  id:              string;
  serviceId:       string;
  startMonthIndex: number;
  endMonthIndex:   number | null;
}

// ─── Calcul des éléments non payés ───────────────────────────────────────────
// Le calcul vit dans src/lib/dueItems.ts (fonction pure, couverte par
// dueItems.test.ts), à côté de celui de la caisse : les deux vues du même
// « que doit cet élève ? » doivent rester lisibles ensemble.

// ─── Method icon ──────────────────────────────────────────────────────────────

const MethodIcon = ({ method }: { method: string }) => {
  const k = methodKey(method);
  if (k === 'cash')   return <HandCoins   className="h-3.5 w-3.5" />;
  if (k === 'mobile') return <Smartphone  className="h-3.5 w-3.5" />;
  if (k === 'bank')   return <Building2   className="h-3.5 w-3.5" />;
  if (k === 'cheque') return <Banknote    className="h-3.5 w-3.5" />;
  return <CreditCard className="h-3.5 w-3.5" />;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalPaiements() {
  const { schoolAccount, accountRole, school } = useAuth();
  const { currentYear } = useSchoolYear();

  const billingTiming = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
  const academicMonths = useMemo(
    () => currentYear ? getAcademicMonths(currentYear.startDate, currentYear.endDate, billingTiming) : [],
    [currentYear, billingTiming]
  );
  const currentIdx = getCurrentMonthIndex(academicMonths);

  // Paiements enregistrés sur l'appareil : consultables sans réseau.
  // `payments` reste modifiable : la liste se rafraîchit après un règlement.
  const eleveId = schoolAccount?.studentEnrollmentId ?? '';
  const ecoleId = schoolAccount?.schoolId ?? '';

  const { donnees, chargement: loading, enregistreLe } = useDonneesHorsLigne<{
    payments: Payment[];
    services: AnnexSvc[];
    enrs: ServiceEnr[];
    tuition: TuitionCfg | null;
    classId: string | null;
    enrolledAt: string | null;
    recus: RecusEleve;
  }>(
    'portail-paiements',
    async () => {
      const [payR, srvR, enrR, tcR, seR, recus] = await Promise.all([
        supabase.from('payments')
          .select('id,type,service_id,month_key,amount,paid_at,method,reference,note,received_by,status,cancelled_at,cancelled_by')
          .eq('student_enrollment_id', eleveId)
          .order('paid_at', { ascending: false }),

        supabase.from('annex_services')
          .select('id,name,amount,frequency')
          .eq('school_id', ecoleId),

        supabase.from('service_enrollments')
          .select('id,service_id,start_month_index,end_month_index')
          .eq('student_enrollment_id', eleveId),

        supabase.from('tuition_configs')
          .select('id,class_id,inscription_fee,monthly_fee,academic_year_label')
          .eq('school_id', ecoleId),

        supabase.from('student_enrollments')
          .select('class_id, enrolled_at')
          .eq('id', eleveId)
          .single(),

        // Les reçus ne doivent jamais empêcher la page de s'afficher : cette
        // lecture ne lève pas (voir recusFamille.ts).
        chargerRecusEleve(eleveId),
      ]);

      const classeId = seR.data?.class_id ?? null;
      // Le tarif qui correspond à la classe de l'élève.
      const cfg = classeId ? (tcR.data ?? []).find(c => c.class_id === classeId) ?? (tcR.data ?? [])[0] : null;

      return {
        payments: (payR.data ?? []).map(p => ({
          id: p.id, type: p.type,
          serviceId: p.service_id ?? null,
          monthKey:  p.month_key  ?? null,
          amount:    p.amount ?? 0,
          paidAt:    p.paid_at,
          method:    p.method    ?? '',
          reference: p.reference ?? null,
          note:      p.note      ?? null,
          receivedBy: p.received_by ?? null,
          status:      (p.status as 'confirmed' | 'cancelled') ?? 'confirmed',
          cancelledAt: p.cancelled_at ?? null,
          cancelledBy: p.cancelled_by ?? null,
        })),

        services: (srvR.data ?? []).map(s => ({
          id: s.id, name: s.name,
          amount:    s.amount ?? 0,
          frequency: s.frequency,
        })),

        enrs: (enrR.data ?? []).map(e => ({
          id:              e.id,
          serviceId:       e.service_id,
          startMonthIndex: e.start_month_index,
          endMonthIndex:   e.end_month_index ?? null,
        })),

        tuition: cfg ? {
          classId:        cfg.class_id,
          inscriptionFee: cfg.inscription_fee ?? 0,
          monthlyFee:     cfg.monthly_fee ?? 0,
          yearLabel:      cfg.academic_year_label,
        } : null,

        classId: classeId,
        enrolledAt: seR.data?.enrolled_at ?? null,
        recus,
      };
    },
    [eleveId, ecoleId],
    accountRole === 'student' && !!eleveId,
  );

  const services   = donnees?.services   ?? [];
  const enrs       = donnees?.enrs       ?? [];
  const tuition    = donnees?.tuition    ?? null;
  const classId    = donnees?.classId    ?? null;
  const enrolledAt = donnees?.enrolledAt ?? null;


  const [payments, setPayments] = useState<Payment[]>([]);
  // Rattachements paiement → reçu. Un instantané enregistré avant l'arrivée des
  // reçus n'en contient pas : on repart alors d'un ensemble vide.
  const [recusEleve, setRecusEleve] = useState<RecusEleve>({ parPaiement: {}, recus: [] });
  useEffect(() => {
    if (!donnees) return;
    setPayments(donnees.payments);
    setRecusEleve(donnees.recus ?? { parPaiement: {}, recus: [] });
  }, [donnees]);

  const libelleMois = useCallback(
    (cle?: string) => (cle && academicMonths.find(m => m.key === cle)?.label) || cle || '',
    [academicMonths],
  );
  const { ouvrirRecu, dialogueRecu } = useRecuFamille({ services, libelleMois });

  // ── Derived ────────────────────────────────────────────────────────────────

  // Mois réellement dus par CET élève : mois décochés par l'école retirés, et
  // rien avant son mois d'inscription (arrivé en janvier → il ne doit pas
  // septembre→décembre). Les mois déjà payés restent visibles via l'historique.
  const billableMonths = useMemo(
    () => getBillableMonthsFor(academicMonths, readBillingRules(school?.settings), enrolledAt),
    [academicMonths, school, enrolledAt],
  );

  const dueItems = useMemo(() =>
    computeDueItems(payments, tuition, services, enrs, classId ?? '', billableMonths, currentIdx),
    [payments, tuition, services, enrs, classId, billableMonths, currentIdx],
  );

  // Ce qui est exigible aujourd'hui vs ce que la famille peut régler à
  // l'avance. Le montant affiché en rouge ne compte QUE l'échu : montrer toute
  // l'année comme une dette alarmerait une famille parfaitement à jour.
  const itemsEchus   = dueItems.filter(i => i.echeance === 'du');
  const itemsAvance  = dueItems.filter(i => i.echeance === 'avance');
  const totalDue     = totalExigible(dueItems);
  const totalPaid = payments.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.amount, 0);
  const confirmedCount = payments.filter(p => p.status !== 'cancelled').length;

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; ps: Payment[] }>();
    for (const p of payments) {
      const d   = new Date(p.paidAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lbl = `${MONTHS_FULL[d.getMonth()].charAt(0).toUpperCase()}${MONTHS_FULL[d.getMonth()].slice(1)} ${d.getFullYear()}`;
      if (!map.has(key)) map.set(key, { label: lbl, ps: [] });
      map.get(key)!.ps.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([, v]) => v);
  }, [payments]);

  // ── QR de paiement direct ────────────────────────────────────────────────────
  const [qrItem,    setQrItem]    = useState<DueItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [justPaid,  setJustPaid]  = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refetchPayments = async () => {
    if (!schoolAccount?.studentEnrollmentId) return;
    // Le reçu est émis un instant APRÈS l'encaissement : on relit aussi les reçus.
    void chargerRecusEleve(schoolAccount.studentEnrollmentId).then(setRecusEleve);
    const { data } = await supabase.from('payments')
      .select('id,type,service_id,month_key,amount,paid_at,method,reference,note,received_by,status,cancelled_at,cancelled_by')
      .eq('student_enrollment_id', schoolAccount.studentEnrollmentId)
      .order('paid_at', { ascending: false });
    if (data) setPayments(data.map(p => ({
      id: p.id, type: p.type,
      serviceId: p.service_id ?? null,
      monthKey:  p.month_key  ?? null,
      amount:    p.amount ?? 0,
      paidAt:    p.paid_at,
      method:    p.method    ?? '',
      reference: p.reference ?? null,
      note:      p.note      ?? null,
      receivedBy: p.received_by ?? null,
      status:      (p.status as 'confirmed' | 'cancelled') ?? 'confirmed',
      cancelledAt: p.cancelled_at ?? null,
      cancelledBy: p.cancelled_by ?? null,
    })));
  };

  const openQr = async (item: DueItem) => {
    if (!schoolAccount?.studentEnrollmentId) return;
    // La scolarité se règle dans l'ordre : inutile de produire un QR que la
    // caisse refusera.
    if (item.verrouille) return;
    setQrItem(item);
    setQrDataUrl(null);
    setJustPaid(false);
    const intent: PaymentIntent = {
      enrollmentId: schoolAccount.studentEnrollmentId,
      type: item.type,
      serviceId: item.serviceId,
      monthKey: item.monthKey,
    };
    try {
      const url = await QRCode.toDataURL(encodePaymentIntent(intent), { margin: 1, width: 320 });
      setQrDataUrl(url);
    } catch { /* ignore */ }
  };

  const closeQr = () => {
    setQrItem(null);
    setQrDataUrl(null);
    setJustPaid(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // Rafraîchit les paiements toutes les 2,5s tant que le QR est affiché
  useEffect(() => {
    if (!qrItem) return;
    pollRef.current = setInterval(refetchPayments, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrItem]);

  // Dès que l'élément scanné disparaît de la liste "à régler" → c'est payé
  useEffect(() => {
    if (qrItem && !justPaid && !dueItems.some(d => d.key === qrItem.key)) {
      setJustPaid(true);
      if (pollRef.current) clearInterval(pollRef.current);
      const t = setTimeout(closeQr, 2000);
      return () => clearTimeout(t);
    }
  }, [dueItems, qrItem, justPaid]);

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f0f4f8] pb-10">
      <div className="px-4 pt-5 space-y-4">

        <BandeauDonneesEnregistrees enregistreLe={enregistreLe} />

        {/* ══ À RÉGLER ══════════════════════════════════════════ */}
        {itemsEchus.length > 0 && (
          <section>
            {/* Header card */}
            <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg shadow-red-200 mb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-red-100" />
                    <p className="text-sm font-bold text-red-100">Montants à régler</p>
                  </div>
                  <p className="text-3xl font-black">{fmtAmount(totalDue)}</p>
                  <p className="text-red-100 text-sm mt-1">
                    {itemsEchus.length} élément{itemsEchus.length > 1 ? 's' : ''} en attente
                  </p>
                </div>
                <div className="bg-white/20 rounded-xl p-2.5">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Due items list */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-rose-100">
              {itemsEchus.map((item, i) => (
                <button
                  key={item.key}
                  onClick={() => openQr(item)}
                  disabled={item.verrouille}
                  title={item.verrouille ? 'Réglez d\'abord le mois précédent' : undefined}
                  className={cn(
                    'w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors',
                    i > 0 && 'border-t border-slate-50',
                    item.verrouille ? 'opacity-50 cursor-not-allowed' : 'active:bg-slate-50',
                  )}
                >
                  {/* Type indicator */}
                  <div className={cn(
                    'w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-[10px] font-black',
                    item.type === 'inscription' ? 'bg-violet-100 text-violet-600' :
                    item.type === 'tuition'     ? 'bg-blue-100   text-blue-600'   :
                                                  'bg-amber-100  text-amber-600'  ,
                  )}>
                    {item.type === 'inscription' ? 'INS' : item.type === 'tuition' ? 'SCO' : 'SVC'}
                  </div>

                  {/* Label */}
                  <p className="flex-1 text-sm font-semibold text-slate-800 truncate">{item.label}</p>

                  {/* Amount */}
                  <p className="flex-shrink-0 text-sm font-black text-red-600">{fmtAmount(item.amount)}</p>
                  {item.verrouille
                    ? <Lock className="h-4 w-4 text-slate-300 flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />}
                </button>
              ))}
            </div>

            {/* Info note */}
            <div className="flex items-start gap-2 mt-2 px-1">
              <QrCode className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">
                Touchez un élément pour générer un QR code et le régler instantanément à la caisse.
                {itemsEchus.some(i => i.verrouille) && ' La scolarité se règle mois par mois, dans l\'ordre.'}
              </p>
            </div>
          </section>
        )}

        {/* ══ PAYER D'AVANCE ═══════════════════════════════════ */}
        {/* Une famille qui en a les moyens règle plusieurs mois au guichet.
            Ces mois ne sont PAS une dette — d'où les couleurs calmes et un
            total séparé, distinct du rouge de la section précédente. */}
        {itemsAvance.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <CalendarPlus className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-600">Payer à l'avance</h2>
              <span className="text-xs text-slate-400">
                {itemsAvance.length} mois à venir
              </span>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
              {itemsAvance.map((item, i) => (
                <button
                  key={item.key}
                  onClick={() => openQr(item)}
                  disabled={item.verrouille}
                  title={item.verrouille ? 'Réglez d\'abord le mois précédent' : undefined}
                  className={cn(
                    'w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors',
                    i > 0 && 'border-t border-slate-50',
                    item.verrouille ? 'opacity-50 cursor-not-allowed' : 'active:bg-slate-50',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-[10px] font-black',
                    item.type === 'tuition' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600',
                  )}>
                    {item.type === 'tuition' ? 'SCO' : 'SVC'}
                  </div>
                  <p className="flex-1 text-sm font-medium text-slate-600 truncate">{item.label}</p>
                  <p className="flex-shrink-0 text-sm font-bold text-slate-500">{fmtAmount(item.amount)}</p>
                  {item.verrouille
                    ? <Lock className="h-4 w-4 text-slate-300 flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />}
                </button>
              ))}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mt-2 px-1">
              Ces mois ne sont pas encore dus. Vous pouvez les régler par anticipation,
              dans l'ordre : chaque mois payé ouvre le suivant.
            </p>
          </section>
        )}

        {/* ══ DÉJÀ PAYÉ ════════════════════════════════════════ */}
        {payments.length === 0 && dueItems.length === 0 ? (
          <div className="bg-white rounded-2xl py-16 flex flex-col items-center gap-3 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-slate-300" />
            </div>
            <p className="font-bold text-slate-600">Aucun mouvement financier</p>
            <p className="text-sm text-slate-400 max-w-[200px] leading-relaxed">
              Vos paiements apparaîtront ici dès leur enregistrement.
            </p>
          </div>
        ) : payments.length > 0 && (
          <section>
            {/* Summary paid */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-100 mb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-100" />
                    <p className="text-sm font-bold text-emerald-100">Total réglé</p>
                  </div>
                  <p className="text-3xl font-black">{fmtAmount(totalPaid)}</p>
                  <p className="text-emerald-100 text-sm mt-1">
                    {confirmedCount} transaction{confirmedCount > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="bg-white/20 rounded-xl p-2.5">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>

            {/* Transactions grouped by month */}
            {grouped.map(group => (
              <div key={group.label} className="mb-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                  {group.label}
                </p>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                  {group.ps.map((p, i) => {
                    const label     = paymentLabel(p, services);
                    const mLabel    = methodLabel(p.method);
                    const mCls      = methodColorCls(p.method);
                    const cancelled = p.status === 'cancelled';

                    return (
                      <div key={p.id} className={cn('px-4 py-4', i > 0 && 'border-t border-slate-50', cancelled && 'bg-red-50/40')}>
                        {/* Label + amount */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 flex items-center gap-2 flex-wrap">
                            <p className={cn('font-semibold text-sm', cancelled ? 'text-slate-400 line-through' : 'text-slate-800')}>
                              {label}
                            </p>
                            {cancelled && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                <XCircleIcon className="h-3 w-3" /> ANNULÉ
                              </span>
                            )}
                          </div>
                          <p className={cn('font-black text-base flex-shrink-0', cancelled ? 'text-slate-400 line-through' : 'text-slate-900')}>
                            {fmtAmount(p.amount)}
                          </p>
                        </div>

                        {/* Date + heure exacte */}
                        <p className="text-xs text-slate-400 mt-1">{fmtDateTimeFull(p.paidAt)}</p>

                        {/* Badges */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={cn(
                            'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border',
                            mCls,
                          )}>
                            <MethodIcon method={p.method} />
                            {mLabel}
                          </span>
                          {p.reference && (
                            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">
                              Réf. {p.reference}
                            </span>
                          )}
                          {p.note && (
                            <span className="text-xs text-slate-400 italic">{p.note}</span>
                          )}
                        </div>

                        {/* Audit : identifiant unique + qui a encaissé */}
                        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-slate-50">
                          <span className="text-[10px] font-mono text-slate-300 tracking-wide">
                            N° {paymentRef(p.id)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Encaissé par <span className="font-semibold text-slate-500">{p.receivedBy || 'Non renseigné'}</span>
                          </span>
                        </div>

                        {/* Reçu : copie à télécharger ou imprimer (émis à l'encaissement) */}
                        {(() => {
                          const recuId = recusEleve.parPaiement[p.id];
                          const recu = recuId ? recusEleve.recus.find(r => r.id === recuId) : undefined;
                          if (!recu) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => ouvrirRecu(recu, payments, recusEleve.parPaiement)}
                              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200
                                         bg-slate-50 py-2.5 text-xs font-semibold text-slate-600 active:bg-slate-100"
                            >
                              <ReceiptIcon className="h-4 w-4" />
                              Voir le reçu · {numeroDeRecu(recu.academicYearLabel, recu.number)}
                            </button>
                          );
                        })()}

                        {/* Trace d'annulation — visible par l'élève, transparence oblige */}
                        {cancelled && (
                          <div className="mt-1.5 text-[10px] text-red-500">
                            Annulé {p.cancelledAt ? `le ${fmtDateTimeFull(p.cancelledAt)}` : ''} par{' '}
                            <span className="font-semibold">{p.cancelledBy || 'Non renseigné'}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* ── QR de paiement direct ─────────────────────────────────────── */}
      <Dialog open={!!qrItem} onOpenChange={(open) => { if (!open) closeQr(); }}>
        <DialogContent className="max-w-xs">
          <DialogTitle className="sr-only">Payer {qrItem?.label}</DialogTitle>
          {qrItem && (
            <div className="flex flex-col items-center text-center gap-3 py-2">
              {justPaid ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                  </div>
                  <p className="font-black text-lg text-slate-800">Payé !</p>
                  <p className="text-sm text-slate-500">{qrItem.label} — {fmtAmount(qrItem.amount)}</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-800">{qrItem.label}</p>
                  <p className="text-2xl font-black text-slate-900">{fmtAmount(qrItem.amount)}</p>

                  <div className="w-56 h-56 rounded-xl border border-slate-100 bg-white flex items-center justify-center p-2">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="QR de paiement" className="w-full h-full" />
                    ) : (
                      <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    En attente de confirmation à la caisse…
                  </div>
                  <p className="text-xs text-slate-400 max-w-[220px]">
                    Présentez ce code à l'administration — cette page se met à jour automatiquement dès le paiement confirmé.
                  </p>

                  <button
                    onClick={closeQr}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mt-1"
                  >
                    <X className="h-3.5 w-3.5" /> Annuler
                  </button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {dialogueRecu}
    </div>
  );
}
