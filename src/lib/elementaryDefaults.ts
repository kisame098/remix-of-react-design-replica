// ─── Élémentaire (CI-CM2) — constantes et contenu par défaut ──────────────
// Système de notation par barème de points (pas de coefficients) : chaque
// discipline = un domaine + un registre (Ressources ou Compétence) + un
// barème fixe. On additionne les points obtenus et on ramène sur 10.
// Voir le plan de cette fonctionnalité pour la recherche de vérification.

export const NIVEAUX_ELEMENTAIRE = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'] as const;
export type NiveauElementaire = typeof NIVEAUX_ELEMENTAIRE[number];

export type ElementaryDomaine = 'LC' | 'MATH' | 'ESVS' | 'EPSA';
export type ElementaryRegistre = 'RESSOURCES' | 'COMPETENCE';

export const DOMAINE_LABELS: Record<ElementaryDomaine, string> = {
  LC:   'Langue et Communication',
  MATH: 'Mathématiques',
  ESVS: 'Éducation à la Science et à la Vie Sociale',
  EPSA: 'Éducation Physique, Sportive et Artistique',
};

export const REGISTRE_LABELS: Record<ElementaryRegistre, string> = {
  RESSOURCES: 'Ressources',
  COMPETENCE: 'Compétence',
};

export type Etape = 1 | 2 | 3;

export const etapeForNiveau = (niveau: string): Etape | undefined => {
  if (niveau === 'CI' || niveau === 'CP') return 1;
  if (niveau === 'CE1' || niveau === 'CE2') return 2;
  if (niveau === 'CM1' || niveau === 'CM2') return 3;
  return undefined;
};

// Total de points et diviseur par étape — total = 10 × diviseur, toujours.
export const ETAPE_TOTALS: Record<Etape, { total: number; diviseur: number; competence: number; ressources: number }> = {
  1: { total: 200, diviseur: 20, competence: 70,  ressources: 130 },
  2: { total: 250, diviseur: 25, competence: 110, ressources: 140 },
  3: { total: 300, diviseur: 30, competence: 162, ressources: 138 },
};

interface DefaultLineSeed {
  domaine: ElementaryDomaine;
  registre: ElementaryRegistre;
  name: string;
  pointMax: number;
}

// Une étape = un même barème pour les deux niveaux qui la composent (seul le
// niveau de difficulté des exercices diffère, pas la grille) — mais chaque
// niveau reçoit sa PROPRE copie éditable, jamais une référence partagée.
const ETAPE_1_LINES: DefaultLineSeed[] = [
  { domaine: 'LC',   registre: 'COMPETENCE', name: 'Lecture — Compréhension / Fluidité',            pointMax: 20 },
  { domaine: 'LC',   registre: 'COMPETENCE', name: "Production d'écrits",                           pointMax: 10 },
  { domaine: 'MATH', registre: 'COMPETENCE', name: 'Mathématiques',                                  pointMax: 20 },
  { domaine: 'ESVS', registre: 'COMPETENCE', name: 'Découverte du Monde',                            pointMax: 10 },
  { domaine: 'ESVS', registre: 'COMPETENCE', name: 'Éducation au Développement Durable',             pointMax: 10 },
  { domaine: 'LC',   registre: 'RESSOURCES', name: 'Écriture / Copie',                               pointMax: 10 },
  { domaine: 'LC',   registre: 'RESSOURCES', name: 'Lecture de mots (identification et CGP)',        pointMax: 10 },
  { domaine: 'LC',   registre: 'RESSOURCES', name: 'Lecture : Vocabulaire',                          pointMax: 10 },
  { domaine: 'LC',   registre: 'RESSOURCES', name: 'Dictée de mots',                                 pointMax: 10 },
  { domaine: 'MATH', registre: 'RESSOURCES', name: 'Mathématiques',                                  pointMax: 40 },
  { domaine: 'ESVS', registre: 'RESSOURCES', name: 'Découverte du Monde',                            pointMax: 20 },
  { domaine: 'ESVS', registre: 'RESSOURCES', name: 'Éducation au Développement Durable',             pointMax: 20 },
  { domaine: 'EPSA', registre: 'RESSOURCES', name: 'Arts Plastiques',                                pointMax: 10 },
];

const ETAPE_2_LINES: DefaultLineSeed[] = [
  { domaine: 'LC',   registre: 'COMPETENCE', name: 'Lecture — Compréhension / Fluidité',            pointMax: 20 },
  { domaine: 'LC',   registre: 'COMPETENCE', name: "Production d'écrits",                           pointMax: 30 },
  { domaine: 'MATH', registre: 'COMPETENCE', name: 'Mathématiques',                                  pointMax: 20 },
  { domaine: 'ESVS', registre: 'COMPETENCE', name: 'Découverte du Monde',                            pointMax: 20 },
  { domaine: 'ESVS', registre: 'COMPETENCE', name: 'Éducation au Développement Durable',             pointMax: 20 },
  { domaine: 'LC',   registre: 'RESSOURCES', name: 'Écriture / Copie',                               pointMax: 10 },
  { domaine: 'LC',   registre: 'RESSOURCES', name: 'Lecture de mots (identification et CGP)',        pointMax: 10 },
  { domaine: 'LC',   registre: 'RESSOURCES', name: 'Exploitation de textes',                         pointMax: 20 },
  { domaine: 'MATH', registre: 'RESSOURCES', name: 'Mathématiques',                                  pointMax: 40 },
  { domaine: 'ESVS', registre: 'RESSOURCES', name: 'Découverte du Monde',                            pointMax: 30 },
  { domaine: 'ESVS', registre: 'RESSOURCES', name: 'Éducation au Développement Durable',             pointMax: 20 },
  { domaine: 'EPSA', registre: 'RESSOURCES', name: 'Arts Plastiques',                                pointMax: 10 },
];

const ETAPE_3_LINES: DefaultLineSeed[] = [
  { domaine: 'LC',   registre: 'COMPETENCE', name: "Production d'écrits",                           pointMax: 60 },
  { domaine: 'MATH', registre: 'COMPETENCE', name: 'Mathématiques',                                  pointMax: 60 },
  { domaine: 'ESVS', registre: 'COMPETENCE', name: 'Découverte du Monde',                            pointMax: 16 },
  { domaine: 'ESVS', registre: 'COMPETENCE', name: 'Éducation au Développement Durable',             pointMax: 16 },
  { domaine: 'EPSA', registre: 'COMPETENCE', name: 'Éducation physique et sportive',                 pointMax: 10 },
  { domaine: 'LC',   registre: 'RESSOURCES', name: 'Exploitation de textes',                         pointMax: 40 },
  { domaine: 'MATH', registre: 'RESSOURCES', name: 'Mathématiques',                                  pointMax: 40 },
  { domaine: 'ESVS', registre: 'RESSOURCES', name: 'Découverte du Monde',                            pointMax: 24 },
  { domaine: 'ESVS', registre: 'RESSOURCES', name: 'Éducation au Développement Durable',             pointMax: 24 },
  { domaine: 'EPSA', registre: 'RESSOURCES', name: 'Arts Plastiques',                                pointMax: 10 },
];

const LINES_BY_NIVEAU: Record<NiveauElementaire, DefaultLineSeed[]> = {
  CI: ETAPE_1_LINES, CP: ETAPE_1_LINES,
  CE1: ETAPE_2_LINES, CE2: ETAPE_2_LINES,
  CM1: ETAPE_3_LINES, CM2: ETAPE_3_LINES,
};

export interface ElementaryDefaultLineSeed extends DefaultLineSeed {
  niveau: NiveauElementaire;
  ordering: number;
  isOptional?: boolean;
  isActiveByDefault?: boolean;
}

// Disciplines de base — actives par défaut, une copie indépendante par niveau.
export const ELEMENTARY_DEFAULT_LINES: ElementaryDefaultLineSeed[] = NIVEAUX_ELEMENTAIRE.flatMap(niveau =>
  LINES_BY_NIVEAU[niveau].map((line, i) => ({ ...line, niveau, ordering: i }))
);

// Catalogue de disciplines optionnelles — inactives tant que l'école ne les active
// pas, jamais comptées dans le total par défaut ("liberté de personnalisation").
export const ELEMENTARY_OPTIONAL_CATALOG: ElementaryDefaultLineSeed[] = [
  { niveau: 'CE1', domaine: 'LC', registre: 'COMPETENCE', name: 'Récitation', pointMax: 10, ordering: 100, isOptional: true, isActiveByDefault: false },
  { niveau: 'CE2', domaine: 'LC', registre: 'COMPETENCE', name: 'Récitation', pointMax: 10, ordering: 100, isOptional: true, isActiveByDefault: false },
  ...NIVEAUX_ELEMENTAIRE.map((niveau): ElementaryDefaultLineSeed => ({
    niveau, domaine: 'LC', registre: 'COMPETENCE', name: 'Arabe', pointMax: 20, ordering: 101, isOptional: true, isActiveByDefault: false,
  })),
  ...NIVEAUX_ELEMENTAIRE.map((niveau): ElementaryDefaultLineSeed => ({
    niveau, domaine: 'ESVS', registre: 'COMPETENCE', name: 'Éducation religieuse', pointMax: 10, ordering: 102, isOptional: true, isActiveByDefault: false,
  })),
  { niveau: 'CM1', domaine: 'LC', registre: 'COMPETENCE', name: 'Anglais', pointMax: 10, ordering: 103, isOptional: true, isActiveByDefault: false },
  { niveau: 'CM2', domaine: 'LC', registre: 'COMPETENCE', name: 'Anglais', pointMax: 10, ordering: 103, isOptional: true, isActiveByDefault: false },
  ...NIVEAUX_ELEMENTAIRE.map((niveau): ElementaryDefaultLineSeed => ({
    niveau, domaine: 'EPSA', registre: 'COMPETENCE', name: 'Éducation musicale', pointMax: 10, ordering: 104, isOptional: true, isActiveByDefault: false,
  })),
  { niveau: 'CI', domaine: 'LC', registre: 'COMPETENCE', name: 'Langue nationale', pointMax: 10, ordering: 105, isOptional: true, isActiveByDefault: false },
  { niveau: 'CP', domaine: 'LC', registre: 'COMPETENCE', name: 'Langue nationale', pointMax: 10, ordering: 105, isOptional: true, isActiveByDefault: false },
];
