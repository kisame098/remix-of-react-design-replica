import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Payment } from '@/types/payment';

let payments: Payment[] = [];
const cancelPayment = vi.fn();
vi.mock('@/contexts/PaymentContext', () => ({ usePayment: () => ({ payments, cancelPayment }) }));
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));

import { useAnnulerPaiement } from './useAnnulerPaiement';

const paiement = (o: Partial<Payment> = {}): Payment => ({
  id: 'p1', studentId: 'e', studentUniqueId: 'ETU', academicYearLabel: '2026-2027', type: 'inscription',
  amount: 1000, method: 'especes', paidAt: '2026-09-01T00:00:00Z', status: 'confirmed', ...o,
});

describe('useAnnulerPaiement', () => {
  beforeEach(() => { payments = []; cancelPayment.mockReset(); toast.mockReset(); });

  it('ouvre le reçu ANNULÉ seulement une fois le paiement revu comme annulé', async () => {
    const montrerRecu = vi.fn().mockResolvedValue(true);
    const p = paiement({ receiptId: 'r1' });
    payments = [p];
    cancelPayment.mockResolvedValue(undefined);
    const { result, rerender } = renderHook(() => useAnnulerPaiement(montrerRecu));

    await act(async () => { await result.current.annuler(p); });
    expect(montrerRecu).not.toHaveBeenCalled();          // l'écran n'a pas encore le nouvel état

    payments = [{ ...p, status: 'cancelled', cancelledBy: 'Directeur' }];
    rerender();
    expect(montrerRecu).toHaveBeenCalledTimes(1);
    expect(montrerRecu.mock.calls[0][0][0].status).toBe('cancelled');
    expect(montrerRecu.mock.calls[0][1]).toMatchObject({ annulation: true });

    rerender();
    expect(montrerRecu).toHaveBeenCalledTimes(1);        // pas de réouverture
  });

  it('sans reçu émis : annulation confirmée, aucun reçu ouvert', async () => {
    const montrerRecu = vi.fn();
    const p = paiement();
    payments = [p];
    cancelPayment.mockResolvedValue(undefined);
    const { result, rerender } = renderHook(() => useAnnulerPaiement(montrerRecu));
    await act(async () => { await result.current.annuler(p); });
    payments = [{ ...p, status: 'cancelled' }];
    rerender();
    expect(montrerRecu).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Paiement annulé' }));
  });

  it('échec : message clair, rien ne s\'ouvre, le bouton se libère', async () => {
    const montrerRecu = vi.fn();
    const p = paiement({ receiptId: 'r1' });
    payments = [p];
    cancelPayment.mockRejectedValue(new Error('Non autorisé'));
    const { result } = renderHook(() => useAnnulerPaiement(montrerRecu));
    let ok = true;
    await act(async () => { ok = await result.current.annuler(p); });
    expect(ok).toBe(false);
    expect(result.current.enCours).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(montrerRecu).not.toHaveBeenCalled();
  });
});
