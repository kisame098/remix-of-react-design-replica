// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION SCOLAIRE PAR CYCLE (Paramètres → Scolarité)
//
// Pour chaque cycle, l'école règle :
//   • le découpage de l'année : 3 trimestres ou 2 semestres ;
//   • la moyenne de passage en classe supérieure.
//
// Valeurs par défaut (demandées par le directeur de SenClass) :
//   élémentaire : 3 trimestres, passage à 5/10
//   collège     : 2 semestres,  passage à 10/20
//   lycée       : 2 semestres,  passage à 10/20
//
// Sert aux bulletins : connaissant le nombre de périodes, SenClass sait que
// le 3e trimestre (ou le 2e semestre) d'une classe est le DERNIER de l'année,
// et n'imprime la décision finale (Admis / Redouble) que sur celui-là.
//
// Rangé dans schools.settings, clé `configScolarite`. Fonctions pures
// (configScolarite.test.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { NIVEAUX_ELEMENTAIRE } from '@/lib/elementaryDefaults';
import { estPrescolaire } from '@/lib/prescolaire';

export type Cycle = 'elementaire' | 'college' | 'lycee';
export type NombrePeriodes = 2 | 3;

export interface ReglageCycle {
  /** 3 = trimestres, 2 = semestres. */
  periodes: NombrePeriodes;
  /** Moyenne annuelle minimale pour passer (sur le barème du cycle). */
  seuil: number;
}

export type ConfigScolarite = Record<Cycle, ReglageCycle>;

export const CLE_CONFIG_SCOLARITE = 'configScolarite';

export const CYCLES: { cycle: Cycle; libelle: string; bareme: number }[] = [
  { cycle: 'elementaire', libelle: 'Élémentaire', bareme: 10 },
  { cycle: 'college', libelle: 'Collège', bareme: 20 },
  { cycle: 'lycee', libelle: 'Lycée', bareme: 20 },
];

export const CONFIG_PAR_DEFAUT: ConfigScolarite = {
  elementaire: { periodes: 3, seuil: 5 },
  college: { periodes: 2, seuil: 10 },
  lycee: { periodes: 2, seuil: 10 },
};

const NIVEAUX_LYCEE = ['2nde', '1ère', 'Tle'];

/** Cycle d'un niveau de classe. Niveau libre (hors listes) : traité comme le collège (barème sur 20).
 *  La maternelle n'a pas de cycle noté : ni périodes, ni seuil de passage. */
export const cycleDuNiveau = (niveau: string | undefined): Cycle | undefined => {
  if (!niveau || estPrescolaire(niveau)) return undefined;
  if ((NIVEAUX_ELEMENTAIRE as readonly string[]).includes(niveau)) return 'elementaire';
  if (NIVEAUX_LYCEE.includes(niveau)) return 'lycee';
  return 'college';
};

export const baremeDuCycle = (cycle: Cycle): number => CYCLES.find(c => c.cycle === cycle)!.bareme;

/** Lit la configuration enregistrée ; toute valeur absente ou invalide reprend sa valeur par défaut. */
export const lireConfigScolarite = (settings: Record<string, unknown> | null | undefined): ConfigScolarite => {
  const brut = settings?.[CLE_CONFIG_SCOLARITE];
  const source = brut && typeof brut === 'object' ? brut as Record<string, unknown> : {};
  const config = {} as ConfigScolarite;
  for (const { cycle, bareme } of CYCLES) {
    const r = source[cycle] && typeof source[cycle] === 'object' ? source[cycle] as Record<string, unknown> : {};
    const defaut = CONFIG_PAR_DEFAUT[cycle];
    const periodes = r.periodes === 2 || r.periodes === 3 ? r.periodes : defaut.periodes;
    const seuil = typeof r.seuil === 'number' && Number.isFinite(r.seuil) && r.seuil > 0 && r.seuil <= bareme ? r.seuil : defaut.seuil;
    config[cycle] = { periodes, seuil };
  }
  return config;
};

/** « trimestre » ou « semestre » selon le découpage. */
export const nomPeriode = (periodes: NombrePeriodes): string => (periodes === 3 ? 'trimestre' : 'semestre');

export interface PeriodeClasse { id: string; ordering: number }

/**
 * Rang (1, 2, 3…) de la période parmi les périodes de notes de la classe,
 * dans l'ordre de l'année. `undefined` si la période n'en fait pas partie.
 */
export const rangDeLaPeriode = (periodId: string, periodesDeLaClasse: PeriodeClasse[]): number | undefined => {
  const triees = [...periodesDeLaClasse].sort((a, b) => a.ordering - b.ordering);
  const i = triees.findIndex(p => p.id === periodId);
  return i < 0 ? undefined : i + 1;
};

/**
 * Ce bulletin est-il celui de la fin de l'année ? Oui quand la période est la
 * N-ième de la classe, N étant le nombre de périodes réglé pour son cycle (ou
 * au-delà, si l'école a créé une période de plus que prévu).
 */
export const estDernierePeriodeDeLAnnee = (
  rang: number | undefined, niveau: string | undefined, config: ConfigScolarite,
): boolean => {
  const cycle = cycleDuNiveau(niveau);
  if (!cycle || rang === undefined) return false;
  return rang >= config[cycle].periodes;
};
