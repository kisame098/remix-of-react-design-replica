import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  filtrerHistorique, libellePaiement, messageErreurAnnulation, numeroRecuDuPaiement,
} from './historiquePaiements';
import { numeroDeRecu } from './recu';
import type { Payment, Receipt } from '@/types/payment';

const p = (o: Partial<Payment>): Payment => ({
  id: 'p', studentId: 'e1', studentUniqueId: 'ETU-001', academicYearLabel: '2026-2027',
  type: 'tuition', monthKey: '2026-09', amount: 25000, method: 'especes',
  paidAt: '2026-09-10T10:00:00Z', status: 'confirmed', ...o,
});
const recus: Receipt[] = [{ id: 'r12', academicYearLabel: '2026-2027', number: 12, studentId: 'e1', createdAt: '' }];
const eleves = [{ id: 'e1', firstName: 'Fatou', lastName: 'Sène' }, { id: 'e2', firstName: 'Moussa', lastName: 'Diop' }];
const tous = { recherche: '', statut: 'tous' as const };

describe('historique des paiements', () => {
  it('un paiement annulé RESTE dans la liste (la trace ne disparaît jamais)', () => {
    const liste = filtrerHistorique([p({ id: 'a' }), p({ id: 'b', status: 'cancelled' })], eleves, recus, tous);
    expect(liste.map(x => x.id).sort()).toEqual(['a', 'b']);
  });

  it('filtre valides / annulés', () => {
    const l = [p({ id: 'a' }), p({ id: 'b', status: 'cancelled' })];
    expect(filtrerHistorique(l, eleves, recus, { recherche: '', statut: 'valides' }).map(x => x.id)).toEqual(['a']);
    expect(filtrerHistorique(l, eleves, recus, { recherche: '', statut: 'annules' }).map(x => x.id)).toEqual(['b']);
  });

  it('plus récent d\'abord', () => {
    const l = [p({ id: 'vieux', paidAt: '2026-09-01T00:00:00Z' }), p({ id: 'neuf', paidAt: '2026-10-01T00:00:00Z' })];
    expect(filtrerHistorique(l, eleves, recus, tous).map(x => x.id)).toEqual(['neuf', 'vieux']);
  });

  it('recherche par nom sans tenir compte des accents, par matricule et par numéro de reçu', () => {
    const l = [p({ id: 'a', receiptId: 'r12' }), p({ id: 'b', studentId: 'e2', studentUniqueId: 'ETU-002' })];
    const ids = (recherche: string) => filtrerHistorique(l, eleves, recus, { recherche, statut: 'tous' }).map(x => x.id);
    expect(ids('sene')).toEqual(['a']);
    expect(ids('etu-002')).toEqual(['b']);
    expect(ids('00012')).toEqual(['a']);
    expect(ids(numeroDeRecu('2026-2027', 12))).toEqual(['a']);
    expect(ids('zzz')).toEqual([]);
  });

  it('le numéro de reçu est celui du PDF et de l\'espace élève (une seule fonction)', () => {
    expect(numeroRecuDuPaiement(p({ receiptId: 'r12' }), recus)).toBe(numeroDeRecu('2026-2027', 12));
    expect(numeroRecuDuPaiement(p({}), recus)).toBeNull();
  });

  it('libellés', () => {
    const mois = (k?: string) => k ?? '';
    expect(libellePaiement(p({ type: 'inscription' }), [], mois)).toBe("Frais d'inscription");
    expect(libellePaiement(p({ type: 'service', serviceId: 's', monthKey: '2026-09' }), [{ id: 's', name: 'Cantine' }], mois)).toBe('Cantine — 2026-09');
  });

  it('messages d\'erreur d\'annulation lisibles', () => {
    expect(messageErreurAnnulation(new Error('Paiement déjà annulé ou introuvable'))).toMatch(/déjà annulé/);
    expect(messageErreurAnnulation({ message: 'Non autorisé' })).toMatch(/pas le droit/);
    expect(messageErreurAnnulation(new Error('fetch failed'))).toMatch(/rien n'a été modifié/);
    expect(messageErreurAnnulation(null)).toMatch(/rien n'a été modifié/);
  });
});

describe('garde-fous — annulation et reçus', () => {
  const lire = (f: string) => readFileSync(f, 'utf8');
  it('le tableau du directeur offre l\'historique ET l\'annulation', () => {
    expect(lire('src/pages/PaymentManagement.tsx')).toContain('<PaymentHistory />');
    expect(lire('src/components/payment/PaymentHistory.tsx')).toContain('useAnnulerPaiement');
  });
  it('aucun écran n\'appelle cancelPayment en direct (toujours avec message d\'erreur et reçu annulé)', () => {
    for (const f of ['src/pages/Caisse.tsx', 'src/components/payment/PaymentHistory.tsx']) {
      expect(lire(f)).not.toMatch(/cancelPayment\s*\(/);
    }
  });
  it('les deux côtés fabriquent le numéro avec numeroDeRecu', () => {
    for (const f of ['src/hooks/useRecus.tsx', 'src/components/portal/RecuFamille.tsx', 'src/lib/historiquePaiements.ts']) {
      expect(lire(f)).toContain('numeroDeRecu(');
    }
  });
  it('un paiement n\'est jamais supprimé de la base', () => {
    expect(lire('src/contexts/PaymentContext.tsx')).not.toMatch(/from\('payments'\)\s*\.delete/);
  });
});
