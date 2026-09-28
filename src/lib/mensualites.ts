// ═══════════════════════════════════════════════════════════════════════════
// MENSUALITÉ PAR MOIS — propre à chaque classe (Paiements → Configuration).
//
// La classe a une mensualité de base ; l'école peut en fixer une autre pour
// certains mois (octobre 20 000 F, novembre 15 000 F…). Seuls les mois
// PERSONNALISÉS sont enregistrés (tuition_configs.monthly_fees) : un mois
// absent vaut la mensualité de base. Changer la base change donc tous les mois
// non personnalisés.
//
// Un mois déjà soldé reste payé si son montant change ensuite ; un mois avec un
// acompte affiche le reste calculé sur le nouveau montant.
// Fonctions pures, testées dans mensualites.test.ts.
// ═══════════════════════════════════════════════════════════════════════════

export type MontantsParMois = Record<string, number>;

/** Ce qu'un mois coûte pour cette classe : son montant personnalisé, sinon la mensualité. */
export const mensualiteDuMois = (
  cfg: { monthlyFee: number; montantsParMois?: MontantsParMois | null },
  monthKey: string | undefined,
): number => {
  const perso = monthKey ? cfg.montantsParMois?.[monthKey] : undefined;
  return typeof perso === 'number' && Number.isFinite(perso) && perso >= 0 ? perso : cfg.monthlyFee;
};

/** Lit la colonne jsonb : garde seulement les mois « AAAA-MM » avec un montant valide. */
export const lireMontantsParMois = (brut: unknown): MontantsParMois => {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {};
  const out: MontantsParMois = {};
  for (const [cle, v] of Object.entries(brut as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (/^\d{4}-\d{2}$/.test(cle) && Number.isFinite(n) && n >= 0) out[cle] = n;
  }
  return out;
};

/**
 * Ce qu'on enregistre à partir de la saisie : les mois dont le montant diffère
 * de la mensualité de base. Case vide = mensualité de base.
 * Renvoie une erreur lisible au premier montant invalide.
 */
export const personnalisationsAEnregistrer = (
  mensualite: number,
  saisies: Record<string, string>,
  libelleMois: (cle: string) => string = cle => cle,
): { ok: boolean; montants: MontantsParMois; erreur?: string } => {
  const montants: MontantsParMois = {};
  for (const [cle, texte] of Object.entries(saisies)) {
    const t = texte.replace(/[\s\u00a0\u202f]/g, '');
    if (t === '') continue;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { ok: false, montants: {}, erreur: `${libelleMois(cle)} : montant invalide` };
    }
    if (n !== mensualite) montants[cle] = n;
  }
  return { ok: true, montants };
};
