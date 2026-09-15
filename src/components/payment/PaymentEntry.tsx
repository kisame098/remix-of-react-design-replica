import { useState, useMemo, useEffect } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, CreditCard, CheckCircle2, Circle, User, Lock,
  AlertCircle, Loader2, QrCode, ScanLine,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  PaymentMethod, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS,
  getAcademicMonths, isMonthOverdue, MonthKey, PaymentType,
  TuitionBillingTiming, DEFAULT_TUITION_BILLING_TIMING,
  decodePaymentIntent, paymentIntentToItemId,
  getBillableMonthsFor, readBillingRules,
} from '@/types/payment';
import { QrScanner } from '@/components/payment/QrScanner';
import { buildPayableItems, type PayableItem } from '@/lib/dueItems';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
const getInitials = (f: string, l: string) => `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase();

// ─── Method button ────────────────────────────────────────────────────────────
const MethodButton = ({ method, selected, onSelect }: { method: PaymentMethod; selected: boolean; onSelect: () => void }) => (
  <button
    onClick={onSelect}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
      selected
        ? 'border-primary bg-primary/5 text-primary font-medium shadow-sm'
        : 'border-border hover:border-primary/40 hover:bg-muted/50'
    }`}
  >
    <span>{PAYMENT_METHOD_ICONS[method]}</span>
    <span>{PAYMENT_METHOD_LABELS[method]}</span>
  </button>
);


const PaymentRow = ({ item, selected, onToggle }: { item: PayableItem; selected: boolean; onToggle: () => void }) => {
  if (item.paid) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-950/20">
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-800 dark:text-green-400">{item.label}</p>
          {item.sublabel && <p className="text-xs text-green-600">{item.sublabel}</p>}
        </div>
        <span className="text-sm text-green-700 dark:text-green-400 font-medium">{fmt(item.amount)}</span>
        <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30">Payé</Badge>
      </div>
    );
  }
  if (item.blocked) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 opacity-55">
        <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{item.label}</p>
          {item.sublabel && <p className="text-xs text-muted-foreground">{item.sublabel}</p>}
        </div>
        <span className="text-sm text-muted-foreground">{fmt(item.amount)}</span>
        <span className="text-xs text-muted-foreground italic">mois précédent requis</span>
      </div>
    );
  }
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-transparent hover:border-primary/30 hover:bg-muted/40'
      }`}
    >
      {selected
        ? <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
        : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.label}</p>
        {item.sublabel && <p className="text-xs text-muted-foreground">{item.sublabel}</p>}
      </div>
      {item.overdue && (
        <Badge variant="destructive" className="text-xs gap-1">
          <AlertCircle className="h-3 w-3" /> En retard
        </Badge>
      )}
      <span className="text-sm font-semibold">{fmt(item.amount)}</span>
    </button>
  );
};


// ─── Main PaymentEntry ────────────────────────────────────────────────────────
const PaymentEntry = ({ initialMode = 'search' }: { initialMode?: 'search' | 'scan' }) => {
  const { students, classes } = useSchool();
  const {
    getTuitionConfig,
    getStudentActiveServices,
    hasPaidInscription, hasPaidTuitionMonth, hasPaidService,
    isEnrolledInService,
    addPayment,
  } = usePayment();
  const { currentYear } = useSchoolYear();
  const { school, profile } = useAuth();
  const billingTiming = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
  const academicMonths = useMemo(
    () => currentYear ? getAcademicMonths(currentYear.startDate, currentYear.endDate, billingTiming) : [],
    [currentYear, billingTiming]
  );
  const billingRules = useMemo(() => readBillingRules(school?.settings), [school]);

  const [search, setSearch]                   = useState('');
  const [mode, setMode]                       = useState<'search' | 'scan'>(initialMode);
  const [scanFeedback, setScanFeedback]       = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems]     = useState<Set<string>>(new Set());
  const [method, setMethod]                   = useState<PaymentMethod>('especes');
  const [reference, setReference]             = useState('');
  const [note, setNote]                       = useState('');
  const [processing, setProcessing]           = useState(false);

  const METHODS: PaymentMethod[] = ['especes', 'wave', 'orange_money', 'virement', 'cheque'];

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    return students.filter(s =>
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, students]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const selectedClass   = selectedStudent?.classId ? classes.find(c => c.id === selectedStudent.classId) : null;
  const tuitionConfig   = selectedStudent?.classId ? getTuitionConfig(selectedStudent.classId) : undefined;

  // Only services the student is actually part of (enrolled optional + obligatory)
  const studentServices = useMemo(
    () => selectedStudent ? getStudentActiveServices(selectedStudent.id, selectedStudent.classId) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedStudent, getStudentActiveServices, selectedStudentId]
  );

  // ── Build payable items ─────────────────────────────────────────────────────
  // Le calcul lui-même vit dans src/lib/dueItems.ts (fonction pure, couverte
  // par dueItems.test.ts) — ici on ne fait que lui brancher le contexte.
  const payableItems = useMemo((): PayableItem[] => {
    if (!selectedStudent) return [];
    return buildPayableItems({
      academicMonths,
      billableKeys: new Set(
        getBillableMonthsFor(academicMonths, billingRules, selectedStudent.enrolledAt).map(m => m.key)
      ),
      tuitionConfig,
      className: selectedClass?.name,
      services: studentServices,
      hasPaidInscription: () => hasPaidInscription(selectedStudent.id),
      hasPaidTuitionMonth: (key) => hasPaidTuitionMonth(selectedStudent.id, key),
      hasPaidService: (serviceId, monthKey) => hasPaidService(selectedStudent.id, serviceId, monthKey),
      isEnrolledInService: (serviceId, monthIndex) =>
        isEnrolledInService(selectedStudent.id, selectedStudent.classId, serviceId, monthIndex),
    });
  }, [selectedStudent, tuitionConfig, studentServices, hasPaidInscription, hasPaidTuitionMonth, hasPaidService, isEnrolledInService, selectedClass, academicMonths, billingRules]);

  const selectedTotal = useMemo(() =>
    payableItems.filter(i => selectedItems.has(i.id) && !i.paid && !i.blocked).reduce((s, i) => s + i.amount, 0),
  [payableItems, selectedItems]);

  const unpaidCount = payableItems.filter(i => !i.paid && !i.blocked).length;

  const toggleItem = (id: string) =>
    setSelectedItems(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const selectStudent = (id: string) => {
    setSelectedStudentId(id);
    setSelectedItems(new Set());
    setSearch('');
    setReference('');
    setNote('');
  };

  const handleScan = (code: string) => {
    // ── Cas 1 : QR de paiement direct généré par l'élève pour un élément précis ──
    const intent = decodePaymentIntent(code);
    if (intent) {
      const match = students.find(s => s.id === intent.enrollmentId);
      if (!match) {
        setScanFeedback({ type: 'error', text: 'Élève introuvable pour ce code de paiement' });
        setTimeout(() => setScanFeedback(null), 2500);
        return;
      }
      selectStudent(match.id);
      setPendingItemId(paymentIntentToItemId(intent));
      setScanFeedback({ type: 'ok', text: `${match.firstName} ${match.lastName} — paiement demandé` });
      setMode('search');
      return;
    }

    // ── Cas 2 : QR/carte d'identité (juste l'ID de l'élève) ──
    const match = students.find(s => s.studentId.toLowerCase() === code.trim().toLowerCase());
    if (match) {
      selectStudent(match.id);
      setScanFeedback({ type: 'ok', text: `${match.firstName} ${match.lastName}` });
      setMode('search');
    } else {
      setScanFeedback({ type: 'error', text: `Aucun élève pour le code "${code}"` });
      setTimeout(() => setScanFeedback(null), 2500);
    }
  };

  // Dès que la liste des éléments à payer du student sélectionné est prête,
  // pré-sélectionne automatiquement l'élément demandé par le QR scanné.
  useEffect(() => {
    if (!pendingItemId) return;
    const target = payableItems.find(i => i.id === pendingItemId);
    if (!target) return; // items pas encore recalculés pour ce student — on attend le prochain rendu
    if (!target.paid && !target.blocked) {
      setSelectedItems(new Set([pendingItemId]));
    } else if (target.paid) {
      setScanFeedback({ type: 'error', text: 'Cet élément est déjà payé' });
      setTimeout(() => setScanFeedback(null), 2500);
    }
    setPendingItemId(null);
  }, [payableItems, pendingItemId]);

  const handlePay = async () => {
    if (!selectedStudent || selectedItems.size === 0) return;
    const needsRef = method === 'virement' || method === 'cheque';
    if (needsRef && !reference.trim()) {
      toast({ title: 'Référence requise', description: 'Saisissez une référence pour ce mode de paiement', variant: 'destructive' });
      return;
    }
    setProcessing(true);
    try {
      const itemsToPay = payableItems.filter(i => selectedItems.has(i.id) && !i.paid && !i.blocked);
      // Process payments sequentially to avoid race conditions on unique constraints
      for (const item of itemsToPay) {
        await addPayment({
          studentId:      selectedStudent.id,
          studentUniqueId: selectedStudent.studentId,
          type:           item.type,
          serviceId:      item.serviceId,
          monthKey:       item.monthKey,
          amount:         item.amount,
          method,
          reference:      reference.trim() || undefined,
          note:           note.trim() || undefined,
          receivedBy:     profile?.full_name || profile?.email || undefined,
        });
      }
      const total = new Intl.NumberFormat('fr-FR').format(selectedTotal);
      toast({
        title: 'Paiement enregistré ✓',
        description: `${itemsToPay.length} élément(s) — ${total} FCFA via ${PAYMENT_METHOD_LABELS[method]}`,
      });
      setSelectedItems(new Set());
      setReference('');
      setNote('');
    } catch (err) {
      // Code Postgres 23505 = contrainte d'unicité violée : cet élément a déjà
      // été payé entre-temps (double scan, deux membres du personnel en même
      // temps) — la base a bloqué le double encaissement, on informe clairement
      // plutôt que d'accuser la connexion.
      const isDuplicate = (err as { code?: string } | null)?.code === '23505';
      toast({
        title: isDuplicate ? 'Déjà payé' : 'Erreur',
        description: isDuplicate
          ? "Cet élément a déjà été encaissé entre-temps (peut-être par quelqu'un d'autre). Rechargez la page pour voir l'état à jour — aucun double paiement n'a été enregistré."
          : 'Un paiement n\'a pas pu être enregistré. Vérifiez la connexion.',
        variant: 'destructive',
      });
      if (isDuplicate) setSelectedItems(new Set());
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0">
      {/* ── Left: Student search ──────────────────────────────────────────────── */}
      <div className="w-72 border-r flex-shrink-0 flex flex-col p-4 gap-3 bg-muted/5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Trouver l'élève</h3>
          <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setMode('search')}
              className={cn('p-1.5 rounded-md transition-colors', mode === 'search' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}
              title="Rechercher"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setMode('scan'); setScanFeedback(null); }}
              className={cn('p-1.5 rounded-md transition-colors', mode === 'scan' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}
              title="Scanner"
            >
              <ScanLine className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {mode === 'scan' ? (
          <div className="space-y-3">
            <QrScanner onScan={handleScan} />
            {scanFeedback && (
              <div className={cn(
                'flex items-center gap-2 text-xs px-3 py-2 rounded-lg',
                scanFeedback.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-destructive/10 text-destructive',
              )}>
                {scanFeedback.type === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {scanFeedback.text}
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <QrCode className="h-3.5 w-3.5" /> Présentez la carte d'élève face caméra
            </p>
          </div>
        ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9" placeholder="Nom, prénom ou ID…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        )}

        {/* Results */}
        {mode === 'search' && filteredStudents.length > 0 && (
          <div className="space-y-0.5">
            {filteredStudents.map(s => {
              const cls = s.classId ? classes.find(c => c.id === s.classId) : null;
              const sel = selectedStudentId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => selectStudent(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                    sel ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={s.photoUrl} className="object-cover" />
                    <AvatarFallback className={`text-xs font-semibold ${sel ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                      {getInitials(s.firstName, s.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${sel ? 'text-primary-foreground' : ''}`}>
                      {s.firstName} {s.lastName}
                    </p>
                    <p className={`text-xs truncate ${sel ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {s.studentId}{cls ? ` · ${cls.name}` : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {mode === 'search' && search && filteredStudents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun élève trouvé</p>
        )}

        {/* Selected student chip */}
        {mode === 'search' && selectedStudent && !search && (
          <Card className="border-primary/30 bg-primary/5 mt-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedStudent.photoUrl} className="object-cover" />
                  <AvatarFallback className="bg-primary/20 text-primary font-semibold text-sm">
                    {getInitials(selectedStudent.firstName, selectedStudent.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                  <p className="text-xs text-muted-foreground">{selectedStudent.studentId}</p>
                  {selectedClass && <Badge variant="outline" className="text-xs mt-0.5">{selectedClass.name}</Badge>}
                </div>
              </div>
              <button
                onClick={() => { setSelectedStudentId(null); setSelectedItems(new Set()); }}
                className="text-xs text-muted-foreground hover:text-foreground mt-2 w-full text-center"
              >
                Changer d'élève
              </button>
            </CardContent>
          </Card>
        )}

        {mode === 'search' && !selectedStudent && !search && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-8">
            <User className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">Recherchez un élève</p>
          </div>
        )}
      </div>

      {/* ── Right: Payment area ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!selectedStudent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <CreditCard className="h-16 w-16 mb-4 opacity-20" />
            <p className="font-medium">Sélectionnez un élève</p>
            <p className="text-sm mt-1 opacity-70">Recherchez et sélectionnez un élève pour gérer ses paiements</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Payment items */}
            <div className="flex-1 overflow-y-auto px-5 pt-3 pb-2 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">
                  Éléments à régler
                  {unpaidCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">{unpaidCount} en attente</Badge>
                  )}
                </h3>
                {unpaidCount > 0 && (
                  <Button
                    variant="outline" size="sm" className="text-xs h-7"
                    onClick={() => setSelectedItems(new Set(payableItems.filter(i => !i.paid && !i.blocked).map(i => i.id)))}
                  >
                    Tout sélectionner
                  </Button>
                )}
              </div>

              {payableItems.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucune configuration de frais pour cette classe</p>
                  <p className="text-xs mt-1">Configurez les tarifs dans l'onglet Configuration</p>
                </div>
              ) : (
                payableItems.map(item => (
                  <PaymentRow
                    key={item.id}
                    item={item}
                    selected={selectedItems.has(item.id)}
                    onToggle={() => !item.paid && !item.blocked && toggleItem(item.id)}
                  />
                ))
              )}
            </div>

            {/* Payment panel */}
            {selectedItems.size > 0 && selectedTotal > 0 && (
              <div className="flex-shrink-0 border-t p-5 space-y-4 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total à encaisser</span>
                  <span className="text-xl font-bold text-primary">{fmt(selectedTotal)}</span>
                </div>

                {/* Method */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mode de paiement</Label>
                  <div className="flex flex-wrap gap-2">
                    {METHODS.map(m => (
                      <MethodButton key={m} method={m} selected={method === m} onSelect={() => setMethod(m)} />
                    ))}
                  </div>
                </div>

                {/* Reference */}
                {(method === 'virement' || method === 'cheque') && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      {method === 'cheque' ? 'N° de chèque *' : 'Référence virement *'}
                    </Label>
                    <Input
                      placeholder={method === 'cheque' ? 'Ex: CHQ-0012345' : 'Ex: VIR-2024-001'}
                      value={reference} onChange={e => setReference(e.target.value)}
                    />
                  </div>
                )}

                {/* Note */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Note (optionnel)</Label>
                  <Input placeholder="Remarque interne…" value={note} onChange={e => setNote(e.target.value)} />
                </div>

                <Button className="w-full gap-2" size="lg" onClick={handlePay} disabled={processing}>
                  {processing
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <CheckCircle2 className="h-4 w-4" />}
                  Valider le paiement — {fmt(selectedTotal)}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentEntry;
