// ═══════════════════════════════════════════════════════════════════════════
// LES PÉRIODES D'UN ÉLÈVE — quels trimestres/semestres afficher dans son
// portail.
//
// Une école crée ses périodes au niveau de l'établissement, puis choisit
// QUELLES CLASSES chacune concerne (table grade_period_classes). Le collège
// peut travailler en 3 trimestres pendant que le lycée en fait 2, et une
// période d'examen ne concerner qu'une poignée de classes.
//
// Montrer à un élève une période où sa classe n'est pas inscrite lui affiche
// un écran vide : il croit que ses notes ont disparu, ou que le professeur ne
// les a pas saisies. C'est la même chose pour ses bulletins.
//
// Fonction pure (studentPeriods.test.ts).
// ═══════════════════════════════════════════════════════════════════════════

export interface PeriodeLike {
  id: string;
  name: string;
  ordering: number;
}

export interface LiaisonPeriodeClasse {
  periodId: string;
  classId: string;
}

/**
 * Périodes réellement suivies par la classe de cet élève, dans l'ordre.
 *
 * `classId` inconnu (élève pas encore affecté) → aucune période : mieux vaut
 * un écran qui dit « aucune période » qu'une liste d'onglets tous vides.
 *
 * Si l'école n'a DÉCLARÉ aucune liaison — cas d'une base ancienne, d'avant
 * l'introduction de grade_period_classes — on retombe sur toutes les périodes
 * plutôt que de vider l'écran de tout le monde.
 */
export const periodesDeLEleve = <T extends PeriodeLike>(
  periodes: T[],
  liaisons: LiaisonPeriodeClasse[],
  classId: string | null | undefined,
): T[] => {
  const triees = [...periodes].sort((a, b) => a.ordering - b.ordering);
  if (liaisons.length === 0) return triees;   // base sans liaisons : on n'ampute rien
  if (!classId) return [];

  const siennes = new Set(
    liaisons.filter(l => l.classId === classId).map(l => l.periodId),
  );
  return triees.filter(p => siennes.has(p.id));
};

/**
 * Période à ouvrir par défaut : la DERNIÈRE de la liste.
 *
 * L'élève veut voir ses notes les plus récentes, pas celles de septembre.
 * `undefined` quand il n'en a aucune.
 */
export const periodeParDefaut = <T extends PeriodeLike>(periodes: T[]): T | undefined =>
  periodes.length > 0 ? periodes[periodes.length - 1] : undefined;
