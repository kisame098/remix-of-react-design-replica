// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITÉ DES ÉCOLES — logique pure, partagée par la liste et la fiche du
// chef du système, et par le ping de l'application.
// ═══════════════════════════════════════════════════════════════════════════

/** Au plus un ping toutes les 5 minutes par onglet : assez pour « qui s'est servi de l'appli aujourd'hui ». */
export const INTERVALLE_PING_MS = 5 * 60 * 1000;

export const doitPinger = (dernierPing: number | null, maintenant: number, intervalle = INTERVALLE_PING_MS): boolean =>
  dernierPing === null || maintenant - dernierPing >= intervalle || maintenant < dernierPing;

export type NiveauActivite = 'en_ligne' | 'active' | 'calme' | 'inactive' | 'jamais';

const MIN = 60_000, HEURE = 60 * MIN, JOUR = 24 * HEURE;

/**
 * Lecture rapide de l'état d'une école d'après sa dernière trace :
 *   en_ligne  < 15 min · active ≤ 3 jours · calme ≤ 14 jours · inactive au-delà.
 */
export const niveauActivite = (derniere: string | null | undefined, maintenant: number): NiveauActivite => {
  if (!derniere) return 'jamais';
  const t = new Date(derniere).getTime();
  if (Number.isNaN(t)) return 'jamais';
  const age = maintenant - t;
  if (age < 15 * MIN) return 'en_ligne';
  if (age <= 3 * JOUR) return 'active';
  if (age <= 14 * JOUR) return 'calme';
  return 'inactive';
};

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** « il y a 5 min », « il y a 3 h », « il y a 12 jours », « il y a 2 mois ». */
export const ilYA = (iso: string | null | undefined, maintenant: number): string => {
  if (!iso) return 'Jamais';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Jamais';
  const age = Math.max(0, maintenant - t);
  if (age < MIN) return "à l'instant";
  if (age < HEURE) return `il y a ${Math.floor(age / MIN)} min`;
  if (age < JOUR) return `il y a ${Math.floor(age / HEURE)} h`;
  if (age < 60 * JOUR) return `il y a ${pluriel(Math.floor(age / JOUR), 'jour', 'jours')}`;
  return `il y a ${Math.floor(age / (30 * JOUR))} mois`;
};

export const LIBELLES_NIVEAU: Record<NiveauActivite, { label: string; classe: string }> = {
  en_ligne: { label: 'En ligne',  classe: 'bg-emerald-100 text-emerald-700' },
  active:   { label: 'Active',    classe: 'bg-green-100 text-green-700' },
  calme:    { label: 'Calme',     classe: 'bg-amber-100 text-amber-700' },
  inactive: { label: 'Inactive',  classe: 'bg-red-100 text-red-700' },
  jamais:   { label: 'Aucune activité', classe: 'bg-slate-100 text-slate-600' },
};

export interface JourHistorique {
  jour: string;
  connectes: number;
  notes: number;
  seances: number;
  paiements: number;
  inscriptions: number;
}

/** Un jour compte comme « actif » dès qu'il s'est passé quelque chose. */
export const jourActif = (j: JourHistorique): boolean =>
  j.connectes + j.notes + j.seances + j.paiements + j.inscriptions > 0;

/**
 * Série continue d'inactivité : nombre de jours consécutifs SANS aucune trace,
 * en partant d'aujourd'hui (l'historique est trié du plus récent au plus ancien).
 */
export const joursSansActivite = (historique: JourHistorique[]): number => {
  let n = 0;
  for (const j of historique) {
    if (jourActif(j)) break;
    n++;
  }
  return n;
};
