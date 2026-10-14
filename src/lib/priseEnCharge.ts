import type { PaymentType } from '@/types/payment';

// ═══════════════════════════════════════════════════════════════════════════
// PRISE EN CHARGE PAR UN ORGANISME (3FPT…) — ce n'est PAS une réduction.
//
// Le frais reste dû EN ENTIER à l'école. Il est partagé en deux :
//   • la PART DE L'APPRENANT (10 % pour le 3FPT), encaissée à la caisse
//     comme d'habitude — c'est elle qui solde le frais côté famille ;
//   • la PART DE L'ORGANISME (90 %), que l'école lui facture et suit dans le
//     module Financements : une créance, jamais un manque à gagner.
//
// Une réduction, elle (src/lib/tarifsEleve.ts), est de l'argent auquel
// l'école RENONCE. Les deux se combinent : une bourse de l'école s'applique
// d'abord, la prise en charge partage ensuite ce qui reste dû.
//
// Fonctions pures, testées dans priseEnCharge.test.ts.
// ═══════════════════════════════════════════════════════════════════════════

export interface PriseEnCharge {
  /** Nom de l'organisme (« 3FPT »), pour l'affichage. */
  organisme: string;
  /** Part payée par l'organisme, en % (entier). */
  pourcentage: number;
  frais: { inscription: boolean; mensualites: boolean; services: string[] };
}

/** Le frais est-il pris en charge ? */
export const fraisCouvert = (p: PriseEnCharge | undefined, e: { type: PaymentType; serviceId?: string }): boolean =>
  !!p && (e.type === 'inscription' ? p.frais.inscription
    : e.type === 'tuition' ? p.frais.mensualites
    : !!e.serviceId && p.frais.services.includes(e.serviceId));

/**
 * Partage ce qui est dû sur un frais. L'organisme paie sa part arrondie au
 * franc ; l'apprenant le reste — la somme fait toujours exactement `du`.
 */
export const partager = (
  du: number, p: PriseEnCharge | undefined, e: { type: PaymentType; serviceId?: string },
): { apprenant: number; organisme: number } => {
  const total = Math.max(0, Math.round(du));
  if (!p || !fraisCouvert(p, e)) return { apprenant: total, organisme: 0 };
  const pct = Math.min(100, Math.max(0, p.pourcentage));
  const organisme = Math.round((total * pct) / 100);
  return { apprenant: total - organisme, organisme };
};
