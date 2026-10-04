// ═══════════════════════════════════════════════════════════════════════════
// FICHE DE PAIEMENT — le relevé de l'année d'un élève.
//
// Pour chaque frais de l'année (inscription, chaque mois de scolarité, chaque
// service) : ce qui était dû, ce qui a été payé, ce qui reste, l'état, et les
// reçus qui en font foi. Puis le bilan : soldé, ou reste à payer.
//
// Une PHOTOGRAPHIE à la date d'impression — ni numérotée ni enregistrée : les
// pièces comptables restent les reçus et les factures. Calcul à partir de
// buildPayableItems (la vue caisse) : la fiche ne peut pas contredire la caisse.
// ═══════════════════════════════════════════════════════════════════════════

import type { PayableItem } from '@/lib/dueItems';
import type { AcademicMonth } from '@/types/payment';

export type EtatLigneFiche = 'solde' | 'partiel' | 'impaye' | 'a_venir';

export interface LigneFiche {
  designation: string;
  du: number;
  paye: number;
  reste: number;
  etat: EtatLigneFiche;
  /** Mois dont l'échéance n'est pas encore arrivée. */
  aVenir: boolean;
  /** Numéros des reçus des paiements de ce frais (« REC-2026-00012 »). */
  recus: string[];
}

export interface BilanFiche {
  du: number;
  paye: number;
  reste: number;
  /** Part du reste déjà exigible (hors mois à venir). */
  resteEchu: number;
  solde: boolean;
}

/** Le strict nécessaire d'un paiement pour retrouver ses reçus. */
export interface PaiementFiche {
  type: string;
  monthKey?: string | null;
  serviceId?: string | null;
  status: string;
  receiptId?: string | null;
}

export const LIBELLES_ETAT_FICHE: Record<EtatLigneFiche, string> = {
  solde: 'Soldé',
  partiel: 'Partiel',
  impaye: 'Impayé',
  a_venir: 'À venir',
};

const concerne = (e: PayableItem, p: PaiementFiche): boolean =>
  p.type === e.type
  && (p.monthKey ?? undefined) === e.monthKey
  && (e.type !== 'service' || p.serviceId === e.serviceId);

export const lignesDeFiche = (
  elements: PayableItem[],
  paiements: PaiementFiche[],
  numeroDuRecu: (receiptId: string) => string | undefined,
  mois: AcademicMonth[],
  aujourdhui: string,
): LigneFiche[] => {
  const echeance = new Map(mois.map(m => [m.key, m.dueDate.slice(0, 10)]));
  return elements.map(e => {
    // Un élément soldé porte son dû dans `amount` ; sinon `amount` est le reste.
    const du = e.paid ? e.amount : e.amount + e.dejaVerse;
    const reste = e.paid ? 0 : e.amount;
    const paye = du - reste;
    const aVenir = !!e.monthKey && (echeance.get(e.monthKey) ?? '') > aujourdhui;
    const etat: EtatLigneFiche = reste === 0 ? 'solde' : paye > 0 ? 'partiel' : aVenir ? 'a_venir' : 'impaye';
    const recus = [...new Set(paiements
      .filter(p => p.status !== 'cancelled' && p.receiptId && concerne(e, p))
      .map(p => numeroDuRecu(p.receiptId!))
      .filter((n): n is string => !!n))];
    return {
      designation: e.label,
      du, paye, reste, etat, aVenir, recus,
    };
  });
};

export const bilanFiche = (lignes: LigneFiche[]): BilanFiche => {
  const du = lignes.reduce((s, l) => s + l.du, 0);
  const paye = lignes.reduce((s, l) => s + l.paye, 0);
  const reste = lignes.reduce((s, l) => s + l.reste, 0);
  const resteEchu = lignes.filter(l => !l.aVenir).reduce((s, l) => s + l.reste, 0);
  return { du, paye, reste, resteEchu, solde: reste === 0 };
};
