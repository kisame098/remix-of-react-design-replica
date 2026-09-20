import type { Payment, PaymentType, Receipt } from '@/types/payment';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { InfosEcole } from '@/lib/documentsEcole';

// ═══════════════════════════════════════════════════════════════════════════
// DONNÉES D'UN REÇU — pur, sans PDF ni réseau : tout ce qui s'imprime se
// vérifie ici. Un reçu couvre UN encaissement (plusieurs lignes de paiement).
// ═══════════════════════════════════════════════════════════════════════════

export interface LigneRecu {
  designation: string;
  montant: number;
  /** Ligne annulée depuis : affichée barrée-comme, exclue du total. */
  annulee: boolean;
}

export interface RecuData {
  ecole: InfosEcole;
  /** « REC-2026-00042 » */
  numero: string;
  /** ISO — moment du dernier paiement couvert par ce reçu. */
  date: string;
  eleve: { nom: string; matricule: string; classe?: string };
  anneeScolaire: string;
  lignes: LigneRecu[];
  /** Somme des lignes NON annulées. */
  total: number;
  /** « Espèces », « Wave », ou « Espèces, Wave » si l'encaissement mêlait plusieurs modes. */
  mode: string;
  reference?: string;
  encaissePar?: string;
  /** Tous les paiements du reçu sont annulés : le document est marqué ANNULÉ. */
  annule: { le?: string; par?: string } | null;
  /** Réédition d'un reçu déjà remis : marqué DUPLICATA. */
  duplicata: boolean;
}

/** « REC-2026-00042 » : année de début de l'année scolaire + numéro sur 5 chiffres. */
export const numeroDeRecu = (anneeScolaire: string, numero: number): string => {
  const annee = /^\d{4}/.exec(anneeScolaire)?.[0] ?? anneeScolaire;
  return `REC-${annee}-${String(numero).padStart(5, '0')}`;
};

/** Ce que paie une ligne : « Frais d'inscription », « Scolarité — Septembre 2026 », « Cantine — … ». */
export const libelleDuPaiement = (
  p: Pick<Payment, 'type' | 'serviceId' | 'monthKey'>,
  services: { id: string; name: string }[],
  libelleMois: (cle?: string) => string,
): string => {
  const mois = p.monthKey ? libelleMois(p.monthKey) : '';
  const types: Record<PaymentType, () => string> = {
    inscription: () => "Frais d'inscription",
    tuition: () => (mois ? `Scolarité — ${mois}` : 'Scolarité'),
    service: () => {
      const nom = services.find(s => s.id === p.serviceId)?.name ?? 'Service annexe';
      return mois ? `${nom} — ${mois}` : nom;
    },
  };
  return (types[p.type] ?? (() => 'Paiement'))();
};

const uniques = (valeurs: (string | undefined)[]): string[] =>
  [...new Set(valeurs.filter((v): v is string => !!v && v.trim().length > 0).map(v => v.trim()))];

interface EntreeRecu {
  ecole: InfosEcole;
  recu: Receipt;
  paiements: Payment[];
  eleve: { nom: string; matricule: string; classe?: string };
  services: { id: string; name: string }[];
  libelleMois: (cle?: string) => string;
  duplicata: boolean;
}

export const construireRecu = ({
  ecole, recu, paiements, eleve, services, libelleMois, duplicata,
}: EntreeRecu): RecuData => {
  if (paiements.length === 0) throw new Error('Un reçu sans paiement n\'a pas de sens');

  // Ordre stable : inscription d'abord, puis par mois, puis par libellé.
  const ordre: Record<PaymentType, number> = { inscription: 0, tuition: 1, service: 2 };
  const tries = [...paiements].sort((a, b) =>
    ordre[a.type] - ordre[b.type] || (a.monthKey ?? '').localeCompare(b.monthKey ?? ''));

  const lignes: LigneRecu[] = tries.map(p => ({
    designation: libelleDuPaiement(p, services, libelleMois),
    montant: p.amount,
    annulee: p.status === 'cancelled',
  }));

  const toutesAnnulees = lignes.every(l => l.annulee);
  const annulations = paiements.filter(p => p.status === 'cancelled');

  return {
    ecole,
    numero: numeroDeRecu(recu.academicYearLabel, recu.number),
    date: paiements.reduce((max, p) => (p.paidAt > max ? p.paidAt : max), paiements[0].paidAt),
    eleve,
    anneeScolaire: recu.academicYearLabel,
    lignes,
    total: lignes.filter(l => !l.annulee).reduce((s, l) => s + l.montant, 0),
    mode: uniques(paiements.map(p => PAYMENT_METHOD_LABELS[p.method])).join(', '),
    reference: uniques(paiements.map(p => p.reference)).join(', ') || undefined,
    encaissePar: uniques(paiements.map(p => p.receivedBy))[0],
    annule: toutesAnnulees
      ? { le: annulations[0]?.cancelledAt, par: annulations[0]?.cancelledBy }
      : null,
    duplicata,
  };
};
