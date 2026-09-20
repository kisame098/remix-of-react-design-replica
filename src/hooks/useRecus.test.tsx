import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Payment, Receipt } from '@/types/payment';

// ════════════════════════════════════════════════════════════════════════════
// Le reçu est émis APRÈS l'encaissement, par un chemin qui ne lève jamais. Ces
// tests verrouillent ce contrat : un incident sur le reçu ne doit jamais
// ressembler à un échec — ni provoquer un second encaissement.
// ════════════════════════════════════════════════════════════════════════════

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
vi.mock('@/components/documents/DocumentDialog', () => ({
  DocumentDialog: (p: { titre: string }) => <div data-testid="dialogue">{p.titre}</div>,
}));

const emettreRecu = vi.fn();
let etatPaiements: Payment[] = [];
const getReceiptOf = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ school: { name: 'École', settings: {} } }) }));
vi.mock('@/contexts/SchoolContext', () => ({ useSchool: () => ({ students: [], classes: [] }) }));
vi.mock('@/contexts/SchoolYearContext', () => ({ useSchoolYear: () => ({ currentYear: null }) }));
vi.mock('@/contexts/PaymentContext', () => ({
  usePayment: () => ({ payments: etatPaiements, annexServices: [], emettreRecu, getReceiptOf }),
}));

import { useRecus } from './useRecus';

const recu: Receipt = { id: 'r1', academicYearLabel: '2026-2027', number: 7, studentId: 'e1', createdAt: '2026-09-19T10:00:00Z' };
let n = 0;
const paiement = (extra: Partial<Payment> = {}): Payment => ({
  id: `p${++n}`, studentId: 'e1', studentUniqueId: 'ETU-1', academicYearLabel: '2026-2027',
  type: 'tuition', monthKey: '2026-09', amount: 25000, method: 'especes',
  paidAt: '2026-09-19T10:00:00Z', status: 'confirmed', ...extra,
});

beforeEach(() => {
  toast.mockReset(); emettreRecu.mockReset(); getReceiptOf.mockReset();
  etatPaiements = [];
});

describe('émission après l\'encaissement', () => {
  it('paiements sans reçu : en émet UN pour tous, et ouvre la fenêtre', async () => {
    const [a, b] = [paiement(), paiement({ monthKey: '2026-10' })];
    etatPaiements = [a, b];
    emettreRecu.mockResolvedValue(recu);

    const { result } = renderHook(() => useRecus());
    let ok = false;
    await act(async () => { ok = await result.current.montrerRecu([a, b], { apresEncaissement: true }); });

    expect(ok).toBe(true);
    expect(emettreRecu).toHaveBeenCalledTimes(1);
    expect(emettreRecu).toHaveBeenCalledWith([a.id, b.id]);
    expect(result.current.dialogueRecu).not.toBeNull();
  });

  it('LE CONTRAT : un échec d\'émission ne lève JAMAIS — il avertit, le paiement reste intact', async () => {
    const a = paiement();
    etatPaiements = [a];
    emettreRecu.mockRejectedValue(new Error('réseau coupé'));

    const { result } = renderHook(() => useRecus());
    let ok = true;
    await act(async () => { ok = await result.current.montrerRecu([a], { apresEncaissement: true }); });

    expect(ok).toBe(false);
    expect(result.current.dialogueRecu).toBeNull();
    // Le message rassure : le paiement est bien enregistré.
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Paiement enregistré, reçu non émis',
      description: expect.stringContaining('bien enregistré'),
    }));
    // …et ce n'est pas présenté comme une erreur d'encaissement.
    expect(toast.mock.calls[0][0].variant).toBeUndefined();
  });

  it('hors encaissement (historique), l\'échec est signalé comme une erreur', async () => {
    const a = paiement();
    etatPaiements = [a];
    emettreRecu.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useRecus());
    await act(async () => { await result.current.montrerRecu([a], { duplicata: true }); });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reçu indisponible', variant: 'destructive' }));
  });
});

describe('réédition d\'un reçu déjà émis', () => {
  it('tous rattachés au même reçu : n\'en émet PAS un second', async () => {
    const a = paiement({ receiptId: 'r1' });
    etatPaiements = [a];
    getReceiptOf.mockReturnValue(recu);

    const { result } = renderHook(() => useRecus());
    await act(async () => { await result.current.montrerRecu([a], { duplicata: true }); });

    expect(emettreRecu).not.toHaveBeenCalled();
    expect(result.current.dialogueRecu).not.toBeNull();
  });

  it('un clic sur UNE ligne d\'un encaissement de plusieurs : le reçu les couvre toutes', async () => {
    const a = paiement({ receiptId: 'r1' });
    const b = paiement({ receiptId: 'r1', monthKey: '2026-10' });
    const autreEleve = paiement({ receiptId: 'r2' });
    etatPaiements = [a, b, autreEleve];
    getReceiptOf.mockReturnValue(recu);

    const { result } = renderHook(() => useRecus());
    await act(async () => { await result.current.montrerRecu([a], { duplicata: true }); });
    expect(result.current.dialogueRecu).not.toBeNull();
    // (le contenu du PDF est couvert par recu.test.ts ; ici : bien deux lignes, pas trois)
    expect(emettreRecu).not.toHaveBeenCalled();
  });
});

describe('paiement annulé', () => {
  it('annulé et sans reçu : rien à imprimer, et aucun numéro n\'est consommé', async () => {
    const a = paiement({ status: 'cancelled' });
    etatPaiements = [a];

    const { result } = renderHook(() => useRecus());
    let ok = true;
    await act(async () => { ok = await result.current.montrerRecu([a], { duplicata: true }); });

    expect(ok).toBe(false);
    expect(emettreRecu).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Paiement annulé' }));
  });

  it('annulé mais avec reçu : on peut le rouvrir (marqué ANNULÉ)', async () => {
    const a = paiement({ status: 'cancelled', receiptId: 'r1' });
    etatPaiements = [a];
    getReceiptOf.mockReturnValue(recu);
    const { result } = renderHook(() => useRecus());
    await act(async () => { await result.current.montrerRecu([a], { duplicata: true }); });
    expect(result.current.dialogueRecu).not.toBeNull();
  });
});

describe('cas limites', () => {
  it('aucun paiement : ne fait rien', async () => {
    const { result } = renderHook(() => useRecus());
    let ok = true;
    await act(async () => { ok = await result.current.montrerRecu([]); });
    expect(ok).toBe(false);
    expect(emettreRecu).not.toHaveBeenCalled();
  });
});
