import type { AnnexService, Payment, Receipt } from '@/types/payment';
import { numeroDeRecu } from '@/lib/recu';

// ═══════════════════════════════════════════════════════════════════════════
// HISTORIQUE GÉNÉRAL DES PAIEMENTS — logique commune au tableau du directeur
// (Paiements → Historique) et à la Caisse mobile.
//
// Un paiement annulé n'est JAMAIS retiré de la liste : il reste, marqué
// « Annulé » avec qui/quand, et garde le numéro de son reçu. C'est la trace
// qui départage une école et une famille en cas de litige.
// ═══════════════════════════════════════════════════════════════════════════

export type FiltreStatut = 'tous' | 'valides' | 'annules';

export const libellePaiement = (
  p: Pick<Payment, 'type' | 'serviceId' | 'monthKey'>,
  services: Pick<AnnexService, 'id' | 'name'>[],
  libelleMois: (cle?: string) => string,
): string => {
  if (p.type === 'inscription') return "Frais d'inscription";
  if (p.type === 'tuition') return `Scolarité — ${libelleMois(p.monthKey)}`;
  if (p.type === 'service') {
    const svc = services.find(s => s.id === p.serviceId);
    return `${svc?.name ?? 'Service'}${p.monthKey ? ' — ' + libelleMois(p.monthKey) : ''}`;
  }
  return 'Paiement';
};

/**
 * Numéro du reçu d'un paiement, tel qu'imprimé sur le PDF et affiché à la
 * famille (REC-2026-00012). Une seule fonction pour tous les écrans : le
 * numéro que voit le caissier est, par construction, celui que voit l'élève.
 */
export const numeroRecuDuPaiement = (p: Pick<Payment, 'receiptId'>, recus: Receipt[]): string | null => {
  if (!p.receiptId) return null;
  const r = recus.find(x => x.id === p.receiptId);
  return r ? numeroDeRecu(r.academicYearLabel, r.number) : null;
};

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface EleveRecherche { id: string; firstName: string; lastName: string }

/** Plus récent d'abord ; recherche par nom, matricule ou numéro de reçu (« 00012 » suffit). */
export const filtrerHistorique = (
  paiements: Payment[], eleves: EleveRecherche[], recus: Receipt[],
  { recherche, statut }: { recherche: string; statut: FiltreStatut },
): Payment[] => {
  const q = sansAccent(recherche.trim());
  const parId = new Map(eleves.map(e => [e.id, e]));
  return [...paiements]
    .filter(p => statut === 'tous' || (statut === 'annules') === (p.status === 'cancelled'))
    .filter(p => {
      if (!q) return true;
      const e = parId.get(p.studentId);
      const nom = e ? sansAccent(`${e.firstName} ${e.lastName} ${e.lastName} ${e.firstName}`) : '';
      const numero = (numeroRecuDuPaiement(p, recus) ?? '').toLowerCase();
      return nom.includes(q) || sansAccent(p.studentUniqueId).includes(q) || numero.includes(q);
    })
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
};

/** Message montré au caissier quand l'annulation échoue — jamais un « Error: … » brut. */
export const messageErreurAnnulation = (e: unknown): string => {
  const brut = e instanceof Error ? e.message : typeof (e as { message?: unknown } | null)?.message === 'string' ? (e as { message: string }).message : '';
  if (/déjà annulé/i.test(brut)) return 'Ce paiement était déjà annulé.';
  if (/non autoris/i.test(brut)) return "Votre compte n'a pas le droit d'annuler un paiement.";
  if (/introuvable/i.test(brut)) return 'Paiement introuvable : rechargez la page.';
  return "L'annulation n'a pas pu être enregistrée. Vérifiez la connexion et réessayez : rien n'a été modifié.";
};
