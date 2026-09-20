import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════
// REÇUS D'UN ÉLÈVE — lecture côté portail des familles.
//
// La colonne `payments.receipt_id` et la table `receipts` sont trop récentes
// pour les types générés : accès non typé, comme SchoolContext le fait déjà pour
// les tables élémentaire. La règle d'accès (RLS) ne laisse voir à un élève que
// SES reçus, sans contrôle d'abonnement de l'école.
// ═══════════════════════════════════════════════════════════════════════════

export interface RecuEleve {
  id: string;
  academicYearLabel: string;
  number: number;
  createdAt: string;
}

export interface RecusEleve {
  /** paymentId → receiptId */
  parPaiement: Record<string, string>;
  recus: RecuEleve[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/** Ne lève jamais : sans reçus, le portail fonctionne comme avant. */
export const chargerRecusEleve = async (inscriptionId: string): Promise<RecusEleve> => {
  try {
    const [pay, rec] = await Promise.all([
      sb.from('payments').select('id, receipt_id').eq('student_enrollment_id', inscriptionId).not('receipt_id', 'is', null),
      sb.from('receipts').select('id, academic_year_label, number, created_at').eq('student_enrollment_id', inscriptionId),
    ]);
    const parPaiement: Record<string, string> = {};
    for (const p of (pay.data ?? []) as { id: string; receipt_id: string }[]) parPaiement[p.id] = p.receipt_id;
    return {
      parPaiement,
      recus: ((rec.data ?? []) as { id: string; academic_year_label: string; number: number; created_at: string }[])
        .map(r => ({ id: r.id, academicYearLabel: r.academic_year_label, number: Number(r.number), createdAt: r.created_at })),
    };
  } catch {
    return { parPaiement: {}, recus: [] };
  }
};
