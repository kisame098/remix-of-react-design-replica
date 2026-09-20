import { useMemo, useState } from 'react';
import { useSchool } from '@/contexts/SchoolContext';
import { usePayment } from '@/contexts/PaymentContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRecus } from '@/hooks/useRecus';
import { useAnnulerPaiement } from '@/hooks/useAnnulerPaiement';
import {
  DEFAULT_TUITION_BILLING_TIMING, getAcademicMonths, PAYMENT_METHOD_LABELS,
  type TuitionBillingTiming,
} from '@/types/payment';
import {
  filtrerHistorique, libellePaiement, numeroRecuDuPaiement, type FiltreStatut,
} from '@/lib/historiquePaiements';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Receipt as ReceiptIcon, Search, XCircle } from 'lucide-react';

const PAGE = 50;

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Dakar',
  });

const FILTRES: { id: FiltreStatut; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'valides', label: 'Valides' },
  { id: 'annules', label: 'Annulés' },
];

/**
 * Historique général des paiements de l'année : tout ce qui a été encaissé, y
 * compris ce qui a été annulé (qui reste, marqué, avec qui/quand). C'est aussi
 * ici que le directeur ou un comptable annule un paiement.
 */
export default function PaymentHistory() {
  const { school } = useAuth();
  const { students, classes } = useSchool();
  const { payments, receipts, annexServices, paymentLoading } = usePayment();
  const { currentYear } = useSchoolYear();
  const { montrerRecu, dialogueRecu } = useRecus();
  const { annuler, enCours } = useAnnulerPaiement(montrerRecu);

  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState<FiltreStatut>('tous');
  const [visibles, setVisibles] = useState(PAGE);

  const billingTiming = (school?.settings?.tuitionBillingTiming as TuitionBillingTiming) ?? DEFAULT_TUITION_BILLING_TIMING;
  const mois = useMemo(
    () => currentYear ? getAcademicMonths(currentYear.startDate, currentYear.endDate, billingTiming) : [],
    [currentYear, billingTiming],
  );
  const libelleMois = (cle?: string) => (cle && mois.find(m => m.key === cle)?.label) || cle || '';

  const liste = useMemo(
    () => filtrerHistorique(payments, students, receipts, { recherche, statut }),
    [payments, students, receipts, recherche, statut],
  );

  const nbAnnules = useMemo(() => payments.filter(p => p.status === 'cancelled').length, [payments]);
  const total = useMemo(
    () => liste.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.amount, 0),
    [liste],
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-6 py-4 border-b flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9" placeholder="Élève, matricule ou n° de reçu…"
            value={recherche} onChange={e => { setRecherche(e.target.value); setVisibles(PAGE); }}
          />
        </div>
        <div className="flex rounded-lg border p-0.5 bg-muted/30">
          {FILTRES.map(f => (
            <button
              key={f.id} type="button"
              onClick={() => { setStatut(f.id); setVisibles(PAGE); }}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                statut === f.id ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}{f.id === 'annules' && nbAnnules > 0 ? ` (${nbAnnules})` : ''}
            </button>
          ))}
        </div>
        <p className="ml-auto text-sm text-muted-foreground">
          {liste.length} opération{liste.length > 1 ? 's' : ''} · encaissé <span className="font-semibold text-foreground">{fmt(total)}</span>
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
        {paymentLoading && payments.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : liste.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">Aucun paiement trouvé.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Objet</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Encaissé par</TableHead>
                  <TableHead>N° de reçu</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.slice(0, visibles).map(p => {
                  const eleve = students.find(s => s.id === p.studentId);
                  const classe = eleve?.classId ? classes.find(c => c.id === eleve.classId)?.name : undefined;
                  const annule = p.status === 'cancelled';
                  const numero = numeroRecuDuPaiement(p, receipts);
                  const objet = libellePaiement(p, annexServices, libelleMois);
                  const nom = eleve ? `${eleve.firstName} ${eleve.lastName}` : p.studentUniqueId;
                  return (
                    <TableRow key={p.id} className={annule ? 'bg-red-50/50 dark:bg-red-950/10' : undefined}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(p.paidAt)}</TableCell>
                      <TableCell>
                        <p className={`font-medium ${annule ? 'line-through text-muted-foreground' : ''}`}>{nom}</p>
                        <p className="text-xs text-muted-foreground">{p.studentUniqueId}{classe ? ` · ${classe}` : ''}</p>
                      </TableCell>
                      <TableCell>
                        <p className={annule ? 'line-through text-muted-foreground' : ''}>{objet}</p>
                        {annule && (
                          <p className="text-xs text-red-600">
                            <span className="font-bold">ANNULÉ</span>
                            {p.cancelledAt ? ` le ${fmtDateTime(p.cancelledAt)}` : ''} par {p.cancelledBy || 'non renseigné'}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={`text-right whitespace-nowrap font-semibold ${annule ? 'line-through text-muted-foreground' : ''}`}>
                        {fmt(p.amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{PAYMENT_METHOD_LABELS[p.method]}</TableCell>
                      <TableCell className="text-sm">{p.receivedBy || 'Non renseigné'}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">{numero ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {(!annule || p.receiptId) && (
                          <Button
                            variant="ghost" size="sm" className="gap-1.5"
                            onClick={() => void montrerRecu([p], { duplicata: !!p.receiptId })}
                          >
                            <ReceiptIcon className="h-3.5 w-3.5" />
                            {p.receiptId ? 'Reçu' : 'Émettre le reçu'}
                          </Button>
                        )}
                        {!annule && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost" size="sm" disabled={enCours === p.id}
                                className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                {enCours === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                Annuler
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Annuler ce paiement ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {objet} — {fmt(p.amount)} pour {nom}.
                                  {numero ? ` Reçu ${numero}.` : ''} Le paiement reste dans l'historique, marqué « Annulé »
                                  (avec votre nom et l'heure), et redevient dû pour l'élève.
                                  {numero ? ' Le reçu garde son numéro et sera marqué ANNULÉ.' : ''} Cette action ne peut pas être défaite.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Retour</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => void annuler(p)}
                                >
                                  Oui, annuler le paiement
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {liste.length > visibles && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => setVisibles(v => v + PAGE)}>
                  Afficher plus ({liste.length - visibles} restants)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {dialogueRecu}
    </div>
  );
}
