import { NIVEAUX, NIVEAUX_COLLEGE, NIVEAUX_ELEMENTAIRE, type Filiere, type NiveauDefaultSubject, type ElementaryDefaultLine } from '@/contexts/SchoolContext';

// ─── Blocs du programme/cursus ───────────────────────────────────────────────
// Source UNIQUE de vérité pour "quels blocs existent dans Cursus" — utilisée à
// la fois par la page Cursus (Filieres.tsx) pour l'affichage, et par la
// création de classe (ClassManagement.tsx) pour le choix du bloc. Les garder
// séparées avait créé exactement le problème signalé : une classe créée sans
// passer par cette liste pouvait finir avec un niveau/cursus qui n'existe pas
// vraiment dans Cursus, ou l'inverse.

export const niveauOrder = (n: string): number => {
  const i = NIVEAUX.indexOf(n as typeof NIVEAUX[number]);
  return i === -1 ? 99 : i;
};

/** Un cursus "compagnon" d'un niveau (voir Filieres.tsx) — jamais un bloc à part. */
export const isCompanionFiliere = (f: { name: string; niveaux: string[] }): boolean =>
  f.niveaux.length === 1 && f.name === f.niveaux[0];

export type ProgrammeCard =
  | { type: 'niveau'; niveau: string }
  | { type: 'filiere'; filiereId: string; filiereName: string; niveau: string };

export const buildProgrammeCards = (
  filieres: Filiere[],
  niveauDefaultSubjects: NiveauDefaultSubject[],
  elementaryDefaultLines: ElementaryDefaultLine[] = [],
): ProgrammeCard[] => {
  const collegeNiveaux = Array.from(new Set<string>([...NIVEAUX_COLLEGE, ...niveauDefaultSubjects.map(s => s.niveau)]));
  const elementaireNiveaux = Array.from(new Set<string>([...NIVEAUX_ELEMENTAIRE, ...elementaryDefaultLines.map(l => l.niveau)]));

  const filiereCards = filieres
    .filter(f => !isCompanionFiliere(f))
    .flatMap(f => f.niveaux.map(niveau => ({
      type: 'filiere' as const, filiereId: f.id, filiereName: f.name, niveau,
    })));

  return [
    ...elementaireNiveaux.map(niveau => ({ type: 'niveau' as const, niveau })),
    ...collegeNiveaux.map(niveau => ({ type: 'niveau' as const, niveau })),
    ...filiereCards,
  ].sort((a, b) => {
    const byNiveau = niveauOrder(a.niveau) - niveauOrder(b.niveau);
    if (byNiveau !== 0) return byNiveau;
    if (a.type === 'niveau') return -1;
    if (b.type === 'niveau') return 1;
    return a.filiereName.localeCompare(b.filiereName);
  });
};

// ─── Nom personnalisé d'un niveau (collège) ─────────────────────────────────
// L'école reste libre de renommer l'affichage d'un niveau fixe (ex: "6ème" →
// "Sixième", ou tout autre nom) — stocké dans schools.settings.niveauLabels
// (clé = niveau technique inchangé, utilisé partout ailleurs pour le matching
// classes/matières ; valeur = le nom que l'école veut voir affiché). Fusion
// superficielle (voir updateSchoolSettings) : on relit toujours la map
// existante avant d'écrire une seule clé.
export const getNiveauLabels = (settings: Record<string, unknown> | undefined | null): Record<string, string> =>
  (settings?.niveauLabels as Record<string, string> | undefined) ?? {};

export const resolveNiveauLabel = (niveauLabels: Record<string, string>, niveau: string): string =>
  niveauLabels[niveau]?.trim() || niveau;

export const programmeCardLabel = (card: ProgrammeCard, niveauLabels: Record<string, string> = {}): string =>
  card.type === 'niveau'
    ? resolveNiveauLabel(niveauLabels, card.niveau)
    : `${resolveNiveauLabel(niveauLabels, card.niveau)} ${card.filiereName}`;

/** Identifiant stable pour value= d'un <Select> — encode assez pour retrouver le bloc. */
export const programmeCardKey = (card: ProgrammeCard): string =>
  card.type === 'niveau' ? `niveau:${card.niveau}` : `filiere:${card.filiereId}:${card.niveau}`;
