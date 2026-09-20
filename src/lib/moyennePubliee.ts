// ═══════════════════════════════════════════════════════════════════════════
// MOYENNE AFFICHÉE SUR L'ACCUEIL DU COMPTE ÉLÈVE
//
// Elle vient UNIQUEMENT du bulletin publié par l'école (l'instantané figé de
// `published_bulletins`), jamais d'un calcul sur les notes en cours de saisie :
// tant que l'école n'a pas publié les bulletins de la classe, l'élève ne voit
// aucune moyenne, et ce qu'il voit ensuite est exactement ce que dit son
// bulletin (même formule, même arrondi, même classement).
// ═══════════════════════════════════════════════════════════════════════════

export interface BulletinPublieBrut {
  periodId: string;
  /** Instantané : bulletin du collège (`ranking.averageGeneral`, sur 20)
   *  ou de l'élémentaire (`ranking.average`, sur 10). */
  data: unknown;
}

export interface PeriodeOrdonnee {
  id: string;
  name: string;
  ordering: number;
}

export interface MoyennePubliee {
  moyenne: number;
  /** Barème : 20 au collège/lycée, 10 à l'élémentaire. */
  sur: 10 | 20;
  periodName: string;
}

const nombreFini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Lit la moyenne d'un instantané ; `null` si elle n'y est pas (élémentaire sans discipline saisie, donnée abîmée). */
const lireMoyenne = (data: unknown): { moyenne: number; sur: 10 | 20 } | null => {
  const ranking = (data as { ranking?: Record<string, unknown> } | null)?.ranking;
  if (!ranking || typeof ranking !== 'object') return null;
  if (nombreFini(ranking.averageGeneral)) return { moyenne: ranking.averageGeneral, sur: 20 };
  if (nombreFini(ranking.average))        return { moyenne: ranking.average,        sur: 10 };
  return null;
};

/**
 * Moyenne du bulletin publié de la période la plus récente (ordre des
 * périodes, pas ordre de publication : republier le 1er trimestre après coup
 * ne doit pas le faire passer devant le 2e). `null` = rien de publié.
 */
export function moyennePubliee(
  bulletins: BulletinPublieBrut[], periodes: PeriodeOrdonnee[],
): MoyennePubliee | null {
  for (const p of [...periodes].sort((a, b) => b.ordering - a.ordering)) {
    const bulletin = bulletins.find(b => b.periodId === p.id);
    const lue = bulletin ? lireMoyenne(bulletin.data) : null;
    if (lue) return { ...lue, periodName: p.name };
  }
  return null;
}
