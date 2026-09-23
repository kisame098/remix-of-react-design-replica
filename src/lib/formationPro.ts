// ═══════════════════════════════════════════════════════════════════════════
// FORMATION PROFESSIONNELLE — Catalogue des formations (étape 1)
//
// La hiérarchie colle à la façon dont une école pense sa propre organisation :
//
//   FORMATION (« CAP Restauration »)
//     └─ NIVEAU (« CAP 1 », « CAP 2 »… ou « Cycle unique » pour un cursus qui
//        n'a qu'une seule étape)
//          └─ MATIÈRE DU NIVEAU : coefficient, volume horaire, nature, type,
//             catégorie — pointe vers le CATALOGUE de matières de l'école
//             (fp_matieres), pour ne jamais retaper « Anglais » deux fois
//             avec une faute qui le dédouble silencieusement dans les
//             statistiques.
//          └─ CRÉNEAU AU CHOIX (spécialité Cuisine/Pâtisserie/Bar…), avec ses
//             options.
//
// Personne n'inscrit un élève en « CAP Restauration Année 2 » : on dit
// « il est en CAP 2 ». On clique une fois sur la formation, puis on choisit
// le niveau — deux écrans, pas une liste plate de blocs qui se ressemblent.
// ═══════════════════════════════════════════════════════════════════════════

export interface Formation {
  id: string;
  name: string;
  /** Texte libre, suggéré par une liste de valeurs à l'écran — jamais imposé. */
  diplomaType?: string;
  duration?: string;
  entryLevel?: string;
  description?: string;
  active: boolean;
  ordering: number;
  createdAt: string;
}

export const TYPES_DIPLOME_SUGGERES = [
  "Diplôme d'État",
  "Diplôme de l'établissement",
  'Attestation',
  'Certificat',
  'Autre',
] as const;

export interface Niveau {
  id: string;
  formationId: string;
  name: string;
  description?: string;
  ordering: number;
  createdAt: string;
}

/** Une ligne du catalogue de matières de l'école — un nom, rien d'autre. */
export interface MatiereCatalogue {
  id: string;
  name: string;
}

export type NiveauMatiereType = 'obligatoire' | 'facultative';
export type NiveauMatiereNature = 'theorique' | 'pratique' | 'stage' | 'projet';

export const NATURE_LABELS: Record<NiveauMatiereNature, string> = {
  theorique: 'Théorique',
  pratique: 'Pratique',
  stage: 'Stage',
  projet: 'Projet',
};

/** Une matière ENSEIGNÉE à un niveau donné — le contenu pédagogique proprement dit. */
export interface NiveauMatiere {
  id: string;
  niveauId: string;
  matiereId: string;
  /** Dénormalisé à la lecture pour l'affichage — jamais retapé à la main. */
  matiereName: string;
  type: NiveauMatiereType;
  coefficient: number;
  volumeHoraire?: number;
  nature: NiveauMatiereNature;
  /** Regroupement libre affiché à l'écran (« Enseignement général »…). */
  categorie?: string;
  ordering: number;
}

export interface ChoixOption {
  id: string;
  subjectName: string;
}

export interface ChoixGroup {
  id: string;
  niveauId: string;
  label: string;
  coefficient: number;
  ordering: number;
  options: ChoixOption[];
}

// ─── Totaux d'un niveau ─────────────────────────────────────────────────────
export interface TotauxNiveau {
  nbMatieres: number;
  totalCoef: number;
  totalHeures: number;
  /** `true` si au moins une matière n'a pas de volume horaire renseigné. */
  heuresIncompletes: boolean;
}

export const totauxNiveau = (matieres: NiveauMatiere[], choix: ChoixGroup[]): TotauxNiveau => {
  const heuresRenseignees = matieres.filter(m => m.volumeHoraire != null);
  return {
    nbMatieres: matieres.length + choix.length,
    totalCoef: matieres.reduce((s, m) => s + m.coefficient, 0) + choix.reduce((s, c) => s + c.coefficient, 0),
    totalHeures: heuresRenseignees.reduce((s, m) => s + (m.volumeHoraire ?? 0), 0),
    heuresIncompletes: heuresRenseignees.length < matieres.length,
  };
};

/** Résumé d'une formation, tous niveaux confondus — affiché sur sa carte. */
export interface ResumeFormation {
  nbNiveaux: number;
  nbMatieres: number;
  totalHeures: number;
}

export const resumeFormation = (
  niveaux: Niveau[], matieresParNiveau: NiveauMatiere[], choixParNiveau: ChoixGroup[],
): ResumeFormation => {
  const idsNiveaux = new Set(niveaux.map(n => n.id));
  const mats = matieresParNiveau.filter(m => idsNiveaux.has(m.niveauId));
  const choix = choixParNiveau.filter(c => idsNiveaux.has(c.niveauId));
  return {
    nbNiveaux: niveaux.length,
    nbMatieres: mats.length + choix.length,
    totalHeures: mats.reduce((s, m) => s + (m.volumeHoraire ?? 0), 0),
  };
};

// ─── Validation ─────────────────────────────────────────────────────────────

export const nomFormationValide = (name: string): boolean => name.trim() !== '';
export const nomNiveauValide = (name: string): boolean => name.trim() !== '';
export const coefficientValide = (v: number): boolean => Number.isFinite(v) && v > 0;
export const volumeHoraireValide = (v: number | undefined): boolean =>
  v === undefined || (Number.isFinite(v) && v >= 0);

/** Le catalogue de l'école ne prend jamais deux fois le même nom (insensible à la casse/aux espaces). */
export const nomMatiereCatalogueDejaPris = (
  catalogue: MatiereCatalogue[], name: string, excludeId?: string,
): boolean => {
  const norm = name.trim().toLowerCase();
  return catalogue.some(m => m.id !== excludeId && m.name.trim().toLowerCase() === norm);
};

/** Une matière ne peut pas être enseignée deux fois au même niveau. */
export const matiereDejaAuNiveau = (
  matieres: NiveauMatiere[], matiereId: string, niveauId: string, excludeId?: string,
): boolean => matieres.some(m => m.id !== excludeId && m.niveauId === niveauId && m.matiereId === matiereId);

// ─── Tri et regroupement ────────────────────────────────────────────────────

export const triFormations = (formations: Formation[]): Formation[] =>
  [...formations].sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.ordering - b.ordering);

export const triNiveaux = (niveaux: Niveau[]): Niveau[] =>
  [...niveaux].sort((a, b) => a.ordering - b.ordering);

/** Les catégories dans l'ordre où elles apparaissent (première matière rencontrée). */
export const regrouperParCategorie = (matieres: NiveauMatiere[]): { categorie: string; matieres: NiveauMatiere[] }[] => {
  const tries = [...matieres].sort((a, b) => a.ordering - b.ordering);
  const groupes: { categorie: string; matieres: NiveauMatiere[] }[] = [];
  for (const m of tries) {
    const cle = m.categorie?.trim() || 'Sans catégorie';
    const dernier = groupes.find(g => g.categorie === cle);
    if (dernier) dernier.matieres.push(m);
    else groupes.push({ categorie: cle, matieres: [m] });
  }
  return groupes;
};

// ─── Autocomplétion des noms de matières (le catalogue lui-même) ───────────
export const nomsDuCatalogue = (catalogue: MatiereCatalogue[]): string[] =>
  [...catalogue].map(m => m.name).sort((a, b) => a.localeCompare(b, 'fr'));

// ─── Export / import ────────────────────────────────────────────────────────
// Une formation complète : ses niveaux, chacun avec ses matières (par NOM —
// portable d'une école à l'autre, aucun identifiant interne) et ses créneaux
// au choix.

export interface FormationExport {
  type: 'senclass_formation_pro_export';
  version: 2;
  exportedAt: string;
  formations: {
    name: string;
    diplomaType?: string;
    duration?: string;
    entryLevel?: string;
    description?: string;
    niveaux: {
      name: string;
      description?: string;
      matieres: { name: string; type: NiveauMatiereType; coefficient: number; volumeHoraire?: number; nature: NiveauMatiereNature; categorie?: string }[];
      choixGroups: { label: string; coefficient: number; options: string[] }[];
    }[];
  }[];
}

export const construireExport = (
  formations: Formation[], niveaux: Niveau[], matieres: NiveauMatiere[], choixGroups: ChoixGroup[],
  maintenant: Date = new Date(),
): FormationExport => ({
  type: 'senclass_formation_pro_export',
  version: 2,
  exportedAt: maintenant.toISOString(),
  formations: triFormations(formations).map(f => ({
    name: f.name, diplomaType: f.diplomaType, duration: f.duration, entryLevel: f.entryLevel, description: f.description,
    niveaux: triNiveaux(niveaux.filter(n => n.formationId === f.id)).map(n => ({
      name: n.name, description: n.description,
      matieres: matieres.filter(m => m.niveauId === n.id).sort((a, b) => a.ordering - b.ordering)
        .map(m => ({ name: m.matiereName, type: m.type, coefficient: m.coefficient, volumeHoraire: m.volumeHoraire, nature: m.nature, categorie: m.categorie })),
      choixGroups: choixGroups.filter(c => c.niveauId === n.id).sort((a, b) => a.ordering - b.ordering)
        .map(c => ({ label: c.label, coefficient: c.coefficient, options: c.options.map(o => o.subjectName) })),
    })),
  })),
});

/** Ne lève jamais : renvoie `null` sur un fichier qui n'est manifestement pas un export de ce type. */
export const analyserImport = (brut: unknown): FormationExport | null => {
  if (!brut || typeof brut !== 'object') return null;
  const o = brut as Record<string, unknown>;
  if (o.type !== 'senclass_formation_pro_export' || !Array.isArray(o.formations)) return null;
  return o as unknown as FormationExport;
};

// ─── Coefficients (donc les matières) : réservés au directeur général ──────
// À la demande d'IFHO : laisser le personnel CRÉER une matière sans pouvoir en
// fixer le coefficient ne sert à rien — ça ne produit que des coefficients à 1
// que le directeur doit ensuite corriger un par un, la source d'erreurs qu'on
// cherche justement à éviter. Le personnel organise donc les FORMATIONS et
// leurs NIVEAUX (créer, renommer, dupliquer, supprimer), mais tout ce qui
// porte un coefficient — matière d'un niveau, créneau au choix, import qui en
// fixe en bloc — est réservé au seul compte admin_school (directeur général).
export const peutGererMatieres = (accountRole: string | null | undefined): boolean => accountRole === 'admin';

// ═══════════════════════════════════════════════════════════════════════════
// PROMOTIONS (étape 2)
//
// Une promotion représente les élèves qui suivent, ensemble, le programme
// d'UN niveau. Plutôt que reconstruire à côté l'inscription, les paiements,
// les présences, l'emploi du temps et le portail élève — qui marchent déjà
// très bien sans rien savoir de Cursus, juste à partir d'une classe —, une
// promotion EN CRÉE une et la possède (`classId`). C'est cette classe que ces
// modules continuent d'utiliser, sans changement.
// ═══════════════════════════════════════════════════════════════════════════

export type RythmePromotion = 'jour' | 'soir';
export type StatutPromotion = 'a_venir' | 'active' | 'terminee' | 'archivee';

export const LIBELLES_RYTHME: Record<RythmePromotion, string> = { jour: 'Jour', soir: 'Soir' };

export const LIBELLES_STATUT_PROMOTION: Record<StatutPromotion, string> = {
  a_venir: 'À venir',
  active: 'Active',
  terminee: 'Terminée',
  archivee: 'Archivée',
};

export interface Promotion {
  id: string;
  niveauId: string;
  /** La classe qui porte réellement l'effectif, les paiements, les présences, l'emploi du temps. */
  classId: string;
  /** Dénormalisés à la lecture, pour l'affichage — jamais retapés à la main. */
  name: string;
  studentLimit: number;
  rythme: RythmePromotion;
  startDate?: string;
  endDate?: string;
  status: StatutPromotion;
  description?: string;
  createdAt: string;
}

export const nomPromotionValide = (name: string): boolean => name.trim() !== '';

/** La fin ne peut pas précéder le début — silencieux si l'une des deux dates manque. */
export const datesPromotionValides = (startDate?: string, endDate?: string): boolean =>
  !startDate || !endDate || startDate <= endDate;

const MOIS_COURTS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « CAP 1 — Promo Septembre 2026 » à partir du niveau et d'une date de début — juste une suggestion, l'école la modifie. */
export const suggererNomPromotion = (niveauName: string, startDate?: string): string => {
  if (!startDate) return niveauName;
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(startDate);
  if (!m) return niveauName;
  const mois = MOIS_COURTS[Number(m[2]) - 1];
  if (!mois) return niveauName;
  return `${niveauName} — Promo ${mois.charAt(0).toUpperCase()}${mois.slice(1)} ${m[1]}`;
};

export const triPromotions = (promotions: Promotion[]): Promotion[] =>
  [...promotions].sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '') || a.name.localeCompare(b.name, 'fr'));

// ─── Regroupement pour l'écran (formation → niveau → promotions) ──────────
export interface GroupeNiveauPromotions {
  niveau: Niveau;
  promotions: Promotion[];
}
export interface GroupeFormationPromotions {
  formation: Formation;
  niveaux: GroupeNiveauPromotions[];
}

export const grouperPromotions = (
  promotions: Promotion[], niveaux: Niveau[], formations: Formation[],
): GroupeFormationPromotions[] => {
  const parNiveauId = new Map<string, Promotion[]>();
  for (const p of triPromotions(promotions)) {
    parNiveauId.set(p.niveauId, [...(parNiveauId.get(p.niveauId) ?? []), p]);
  }
  const niveauxAvecPromotion = triNiveaux(niveaux.filter(n => parNiveauId.has(n.id)));

  const parFormationId = new Map<string, Niveau[]>();
  for (const n of niveauxAvecPromotion) {
    parFormationId.set(n.formationId, [...(parFormationId.get(n.formationId) ?? []), n]);
  }

  return triFormations(formations.filter(f => parFormationId.has(f.id))).map(formation => ({
    formation,
    niveaux: (parFormationId.get(formation.id) ?? []).map(niveau => ({
      niveau, promotions: parNiveauId.get(niveau.id) ?? [],
    })),
  }));
};

// ═══════════════════════════════════════════════════════════════════════════
// ÉVALUATIONS (étape 3)
//
// Une évaluation est une activité notée (« Contrôle pratique n°1 », /20, le
// 18/09/2026) — jamais un seul chiffre agrégé par catégorie : un professeur
// donne plusieurs contrôles dans l'année, chacun garde son titre et sa date.
//
// Le calcul se fait à trois étages, jamais recalculé à la main :
//   1. dans une catégorie   : moyenne des évaluations, pondérée par leur poids
//   2. entre catégories     : pondérée par le pourcentage du barème
//   3. entre matières       : pondérée par le coefficient de la matière
//
// À chaque étage, ce qui n'a pas encore de note n'est jamais compté comme 0 :
// on ignore et on redistribue le poids sur ce qui est effectivement noté —
// exactement comme la moyenne pondérée du système classique
// (src/pages/portal/portalHelpers.ts::weightedAvg).
// ═══════════════════════════════════════════════════════════════════════════

export interface BaremeCategorie {
  id: string;
  formationId: string;
  name: string;
  pourcentage: number;
  ordering: number;
}

export const nomCategorieValide = (name: string): boolean => name.trim() !== '';
export const pourcentageValide = (v: number): boolean => Number.isFinite(v) && v > 0 && v <= 100;

/**
 * Formule par défaut appliquée à toute nouvelle formation — jamais un barème
 * vide à définir de zéro. Reprend la répartition la plus courante en
 * hôtellerie-restauration (contrôle continu / TP / examen blanc / examen
 * final) ; le directeur la personnalise ensuite si besoin, formation par
 * formation — jamais un barème partagé entre formations.
 */
export const DEFAUT_BAREME_CATEGORIES: readonly { name: string; pourcentage: number }[] = [
  { name: 'Contrôle continu', pourcentage: 30 },
  { name: 'TP', pourcentage: 30 },
  { name: 'Examen blanc', pourcentage: 10 },
  { name: 'Examen final', pourcentage: 30 },
];

export const sommeBareme = (categories: BaremeCategorie[]): number =>
  Math.round(categories.reduce((s, c) => s + c.pourcentage, 0) * 100) / 100;

/** `true` si les pourcentages du barème font exactement 100 (tolérance d'arrondi). */
export const baremeComplet = (categories: BaremeCategorie[]): boolean =>
  categories.length > 0 && Math.abs(sommeBareme(categories) - 100) < 0.01;

export interface Periode {
  id: string;
  promotionId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  ordering: number;
}

export const nomPeriodeValide = (name: string): boolean => name.trim() !== '';

export type StatutNote = 'note' | 'absent' | 'absent_justifie' | 'non_evalue';

export const LIBELLES_STATUT_NOTE: Record<StatutNote, string> = {
  note: 'Note',
  absent: 'Absent',
  absent_justifie: 'Absent justifié',
  non_evalue: 'Non évalué',
};

export interface Evaluation {
  id: string;
  promotionId: string;
  niveauMatiereId: string;
  periodeId: string;
  categorieId: string;
  type: string;
  title: string;
  date: string;
  bareme: number;
  poids: number;
  description?: string;
  createdAt: string;
}

export const TYPES_EVALUATION_SUGGERES = [
  'Contrôle continu', 'Devoir', 'Interrogation', 'TP / Évaluation pratique', 'Projet', 'Oral', 'Test', 'Autre',
] as const;

export const titreEvaluationValide = (title: string): boolean => title.trim() !== '';
export const baremeValide = (v: number): boolean => Number.isFinite(v) && v > 0;
export const poidsValide = (v: number): boolean => Number.isFinite(v) && v > 0;

export interface Note {
  id: string;
  evaluationId: string;
  studentEnrollmentId: string;
  /** `undefined` sauf si `statut === 'note'` — jamais un 0 qui se lirait comme une vraie note. */
  valeur?: number;
  statut: StatutNote;
  observation?: string;
}

/** Ramène une note sur 20, quel que soit le barème de l'évaluation (/10, /5, /100…). */
export const convertirSur20 = (valeur: number, bareme: number): number => bareme > 0 ? (valeur * 20) / bareme : 0;

// ─── Le calcul, à trois étages ──────────────────────────────────────────────

/**
 * Moyenne (sur 20) d'un élève dans UNE catégorie, pour une matière et une
 * période : moyenne des évaluations de cette catégorie, pondérée par leur
 * poids. Les notes « absent »/« non évalué » sont exclues, pas comptées 0.
 * `null` si l'élève n'a encore aucune note notée dans cette catégorie.
 */
export const moyenneCategorie = (
  evaluations: Evaluation[], notes: Note[], categorieId: string, studentEnrollmentId: string,
): number | null => {
  const evalsCategorie = evaluations.filter(e => e.categorieId === categorieId);
  let total = 0, poidsTotal = 0;
  for (const ev of evalsCategorie) {
    const note = notes.find(n => n.evaluationId === ev.id && n.studentEnrollmentId === studentEnrollmentId);
    if (!note || note.statut !== 'note' || note.valeur == null) continue;
    total += convertirSur20(note.valeur, ev.bareme) * ev.poids;
    poidsTotal += ev.poids;
  }
  return poidsTotal > 0 ? total / poidsTotal : null;
};

/**
 * Moyenne (sur 20) d'un élève dans UNE matière, pour une période : moyenne
 * des catégories du barème, pondérée par leur pourcentage — une catégorie
 * sans aucune note (l'examen final pas encore passé, par exemple) est
 * ignorée, son poids redistribué sur les catégories déjà notées, jamais
 * comptée 0. `null` si rien n'est encore noté du tout.
 */
export const moyenneMatiere = (
  categories: BaremeCategorie[], evaluations: Evaluation[], notes: Note[], studentEnrollmentId: string,
): number | null => {
  let total = 0, pourcentageTotal = 0;
  for (const cat of categories) {
    const moyenne = moyenneCategorie(evaluations, notes, cat.id, studentEnrollmentId);
    if (moyenne === null) continue;
    total += moyenne * cat.pourcentage;
    pourcentageTotal += cat.pourcentage;
  }
  return pourcentageTotal > 0 ? total / pourcentageTotal : null;
};

export interface MoyenneParMatiere {
  niveauMatiereId: string;
  coefficient: number;
  moyenne: number | null;
}

/**
 * Moyenne générale (sur 20) d'un élève pour une promotion et une période :
 * moyenne des matières, pondérée par leur coefficient — même règle : une
 * matière pas encore notée n'est jamais comptée 0, elle est simplement
 * ignorée tant qu'elle n'a rien.
 */
export const moyenneGenerale = (moyennesMatieres: MoyenneParMatiere[]): number | null => {
  let total = 0, coefTotal = 0;
  for (const m of moyennesMatieres) {
    if (m.moyenne === null || m.coefficient <= 0) continue;
    total += m.moyenne * m.coefficient;
    coefTotal += m.coefficient;
  }
  return coefTotal > 0 ? total / coefTotal : null;
};

// ─── Résumé d'une évaluation (pour sa carte dans la liste) ─────────────────
export interface ResumeEvaluation {
  nbAttendus: number;
  nbNotes: number;
  nbAbsents: number;
  moyenne: number | null;
}

export const resumeEvaluation = (evaluation: Evaluation, notes: Note[], effectif: number): ResumeEvaluation => {
  const notesDeLEvaluation = notes.filter(n => n.evaluationId === evaluation.id);
  const notees = notesDeLEvaluation.filter(n => n.statut === 'note' && n.valeur != null);
  const absents = notesDeLEvaluation.filter(n => n.statut === 'absent' || n.statut === 'absent_justifie');
  const total20 = notees.reduce((s, n) => s + convertirSur20(n.valeur as number, evaluation.bareme), 0);
  return {
    nbAttendus: effectif,
    nbNotes: notesDeLEvaluation.length,
    nbAbsents: absents.length,
    moyenne: notees.length > 0 ? total20 / notees.length : null,
  };
};

export const triEvaluations = (evaluations: Evaluation[]): Evaluation[] =>
  [...evaluations].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'fr'));

export const triPeriodes = (periodes: Periode[]): Periode[] =>
  [...periodes].sort((a, b) => a.ordering - b.ordering);

// ─── Grille de saisie : une colonne par évaluation, groupées par catégorie ──
// Dans la grille, les évaluations d'une catégorie se lisent de gauche à
// droite dans l'ordre où elles ont eu lieu (CC 1, CC 2…) — l'inverse de la
// liste « la plus récente d'abord ».
export const triEvaluationsChronologique = (evaluations: Evaluation[]): Evaluation[] =>
  [...evaluations].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

/** « Contrôle continu 3 » : le premier numéro libre de la catégorie — jamais deux colonnes au même nom. */
export const titreNouvelleEvaluation = (categorieName: string, titresExistants: string[]): string => {
  const pris = new Set(titresExistants.map(t => t.trim().toLowerCase()));
  let n = titresExistants.length + 1;
  while (pris.has(`${categorieName} ${n}`.toLowerCase())) n++;
  return `${categorieName} ${n}`;
};

// Une case de la grille accepte une note OU un code de statut — un statut
// n'est jamais une note de 0.
export const CODES_STATUT_NOTE: Record<string, Exclude<StatutNote, 'note'>> = {
  A: 'absent',
  AJ: 'absent_justifie',
  NE: 'non_evalue',
};
const CODE_PAR_STATUT: Record<Exclude<StatutNote, 'note'>, string> = {
  absent: 'A', absent_justifie: 'AJ', non_evalue: 'NE',
};

export type SaisieNote =
  | { kind: 'vide' }
  | { kind: 'note'; valeur: number }
  | { kind: 'statut'; statut: Exclude<StatutNote, 'note'> }
  | { kind: 'invalide'; raison: string };

/** Lit ce qui est tapé dans une case : « 12,5 », « 12.5 », « A », « aj », « NE » ou rien. */
export const analyserSaisieNote = (texte: string, bareme: number): SaisieNote => {
  const t = texte.trim();
  if (t === '') return { kind: 'vide' };
  const code = CODES_STATUT_NOTE[t.toUpperCase()];
  if (code) return { kind: 'statut', statut: code };
  if (!/^\d+([.,]\d+)?$/.test(t)) return { kind: 'invalide', raison: 'Note ou code (A, AJ, NE) attendu' };
  const valeur = Number(t.replace(',', '.'));
  if (valeur > bareme) return { kind: 'invalide', raison: `La note ne peut pas dépasser ${bareme}` };
  return { kind: 'note', valeur };
};

/** Ce qu'affiche une case pour une note enregistrée (vide si aucune). */
export const texteDeLaNote = (note: Pick<Note, 'statut' | 'valeur'> | undefined): string => {
  if (!note) return '';
  if (note.statut === 'note') return note.valeur == null ? '' : String(note.valeur).replace('.', ',');
  return CODE_PAR_STATUT[note.statut];
};

// ─── Récapitulatif d'une période : moyennes par matière, générale, rang ─────
export interface LigneRecapitulatif {
  studentEnrollmentId: string;
  /** Moyenne sur 20 de chaque matière (clé : id de la matière du niveau), `null` si rien de noté. */
  parMatiere: Record<string, number | null>;
  generale: number | null;
  /** `null` pour un élève qui n'a encore aucune note — il n'est jamais classé dernier par défaut. */
  rang: number | null;
}

/**
 * Tableau récapitulatif d'une promotion pour UNE période : `evaluations`
 * doit déjà être restreint à cette période. Les ex æquo partagent le même
 * rang (1, 2, 2, 4) ; triés du meilleur au moins bon, les non-classés à la fin.
 */
export const recapitulatifPeriode = (
  studentEnrollmentIds: string[],
  matieres: Pick<NiveauMatiere, 'id' | 'coefficient'>[],
  categories: BaremeCategorie[],
  evaluations: Evaluation[],
  notes: Note[],
): LigneRecapitulatif[] => {
  const lignes = studentEnrollmentIds.map(sid => {
    const parMatiere: Record<string, number | null> = {};
    for (const m of matieres) {
      parMatiere[m.id] = moyenneMatiere(categories, evaluations.filter(e => e.niveauMatiereId === m.id), notes, sid);
    }
    const generale = moyenneGenerale(matieres.map(m => ({ niveauMatiereId: m.id, coefficient: m.coefficient, moyenne: parMatiere[m.id] })));
    return { studentEnrollmentId: sid, parMatiere, generale, rang: null as number | null };
  });
  const classes = lignes.filter(l => l.generale !== null).sort((a, b) => (b.generale as number) - (a.generale as number));
  classes.forEach((l, i) => {
    l.rang = i > 0 && Math.abs((classes[i - 1].generale as number) - (l.generale as number)) < 1e-9 ? classes[i - 1].rang : i + 1;
  });
  return [...classes, ...lignes.filter(l => l.generale === null)];
};

// ═══════════════════════════════════════════════════════════════════════════
// EXAMENS (étape 4)
//
// Un examen (blanc ou officiel) appartient à UNE promotion. Ses épreuves sont
// rangées en tours (Écrit, Pratique…) — un regroupement d'affichage, jamais
// une pondération. Le calcul est volontairement simple et transparent :
//   moyenne = Σ(note sur 20 × coefficient) / Σ(coefficients des épreuves notées)
// Le logiciel PROPOSE une décision et une mention ; le jury les retient ou les
// corrige, puis le directeur verrouille (règle tenue par la base de données,
// docs/sql/formation_pro_examens.sql).
// ═══════════════════════════════════════════════════════════════════════════

export type TypeExamen = 'blanc' | 'officiel';
export const LIBELLES_TYPE_EXAMEN: Record<TypeExamen, string> = { blanc: 'Examen blanc', officiel: 'Examen officiel' };

export type Decision = 'admis' | 'ajourne' | 'refuse';
export const LIBELLES_DECISION: Record<Decision, string> = { admis: 'Admis', ajourne: 'Ajourné', refuse: 'Refusé' };

export type Mention = 'passable' | 'assez_bien' | 'bien' | 'tres_bien';
export const LIBELLES_MENTION: Record<Mention, string> = {
  passable: 'Passable', assez_bien: 'Assez bien', bien: 'Bien', tres_bien: 'Très bien',
};

export interface Examen {
  id: string;
  promotionId: string;
  name: string;
  type: TypeExamen;
  reference?: string;
  seuilAdmission: number;
  dateDebut?: string;
  dateFin?: string;
  verrouille: boolean;
  verrouilleLe?: string;
  createdAt: string;
}

export interface ExamenTour {
  id: string;
  examenId: string;
  name: string;
  ordering: number;
}

export interface ExamenEpreuve {
  id: string;
  tourId: string;
  niveauMatiereId?: string;
  nom: string;
  coefficient: number;
  bareme: number;
  /** Sur le barème de l'épreuve. `undefined` : l'épreuve n'est pas éliminatoire. */
  seuilEliminatoire?: number;
  date?: string;
  heure?: string;
  salle?: string;
  examinateurs?: string;
  ordering: number;
}

export type StatutNoteExamen = 'note' | 'absent' | 'absent_justifie';

export interface ExamenNote {
  id: string;
  epreuveId: string;
  studentEnrollmentId: string;
  valeur?: number;
  statut: StatutNoteExamen;
}

export interface ExamenResultat {
  id: string;
  examenId: string;
  studentEnrollmentId: string;
  decision?: Decision;
  mention?: Mention;
  /** Figés au verrouillage. */
  moyenne?: number;
  elimine: boolean;
}

export const nomExamenValide = (name: string): boolean => name.trim() !== '';
export const nomTourValide = (name: string): boolean => name.trim() !== '';
export const nomEpreuveValide = (nom: string): boolean => nom.trim() !== '';
export const seuilAdmissionValide = (v: number): boolean => Number.isFinite(v) && v > 0 && v <= 20;
/** Le seuil éliminatoire est facultatif ; s'il est donné, il est entre 0 et le barème (exclu). */
export const seuilEliminatoireValide = (v: number | undefined, bareme: number): boolean =>
  v === undefined || (Number.isFinite(v) && v >= 0 && v < bareme);

/** Pas de « non évalué » à un examen : on y est noté, absent, ou absent justifié. */
export const analyserSaisieNoteExamen = (texte: string, bareme: number): SaisieNote => {
  const s = analyserSaisieNote(texte, bareme);
  if (s.kind === 'statut' && s.statut === 'non_evalue') return { kind: 'invalide', raison: 'À un examen : une note, A ou AJ' };
  return s;
};

// ─── Le calcul ──────────────────────────────────────────────────────────────

export interface EtatCandidat {
  /** Sur 20, sur les seules épreuves notées — `null` si aucune. */
  moyenne: number | null;
  /** Épreuves où la note est sous le seuil éliminatoire. */
  epreuvesEliminatoires: string[];
  /** Épreuves sans note ni absence saisie. */
  epreuvesManquantes: string[];
  /** Épreuves où le candidat est absent (A ou AJ). */
  epreuvesAbsent: string[];
}

export const etatCandidat = (epreuves: ExamenEpreuve[], notes: ExamenNote[], studentEnrollmentId: string): EtatCandidat => {
  let total = 0, coefs = 0;
  const etat: EtatCandidat = { moyenne: null, epreuvesEliminatoires: [], epreuvesManquantes: [], epreuvesAbsent: [] };
  for (const ep of epreuves) {
    const n = notes.find(x => x.epreuveId === ep.id && x.studentEnrollmentId === studentEnrollmentId);
    if (!n) { etat.epreuvesManquantes.push(ep.id); continue; }
    if (n.statut !== 'note' || n.valeur == null) { etat.epreuvesAbsent.push(ep.id); continue; }
    total += convertirSur20(n.valeur, ep.bareme) * ep.coefficient;
    coefs += ep.coefficient;
    if (ep.seuilEliminatoire != null && n.valeur < ep.seuilEliminatoire) etat.epreuvesEliminatoires.push(ep.id);
  }
  etat.moyenne = coefs > 0 ? total / coefs : null;
  return etat;
};

/** Bandes habituelles (10–12 passable, 12–14 assez bien, 14–16 bien, 16 et plus très bien). */
export const mentionPourMoyenne = (moyenne: number | null): Mention | null => {
  if (moyenne === null || moyenne < 10) return null;
  if (moyenne < 12) return 'passable';
  if (moyenne < 14) return 'assez_bien';
  if (moyenne < 16) return 'bien';
  return 'tres_bien';
};

export interface Proposition {
  decision: Decision | null;
  mention: Mention | null;
  /** Pourquoi il n'y a pas de proposition, ou ce qui l'a dictée — affiché au jury. */
  motif?: string;
}

/**
 * Ce que le logiciel propose au jury — jamais une décision imposée :
 *   - une note éliminatoire → Refusé, quel que soit le reste ;
 *   - une épreuve pas encore saisie → aucune proposition (le calcul serait faux) ;
 *   - une absence → aucune proposition : c'est au jury de trancher ;
 *   - sinon : Admis si la moyenne atteint le seuil (mention selon la moyenne), Ajourné sinon.
 */
export const propositionJury = (etat: EtatCandidat, seuilAdmission: number): Proposition => {
  if (etat.epreuvesEliminatoires.length > 0) {
    return { decision: 'refuse', mention: null, motif: 'Note éliminatoire' };
  }
  if (etat.epreuvesManquantes.length > 0) {
    return { decision: null, mention: null, motif: `${etat.epreuvesManquantes.length} épreuve${etat.epreuvesManquantes.length > 1 ? 's' : ''} sans note` };
  }
  if (etat.epreuvesAbsent.length > 0) {
    return { decision: null, mention: null, motif: `Absent à ${etat.epreuvesAbsent.length} épreuve${etat.epreuvesAbsent.length > 1 ? 's' : ''} — au jury de décider` };
  }
  if (etat.moyenne === null) return { decision: null, mention: null };
  return etat.moyenne >= seuilAdmission
    ? { decision: 'admis', mention: mentionPourMoyenne(etat.moyenne) }
    : { decision: 'ajourne', mention: null };
};

/** Décision retenue : celle choisie par le jury, sinon la proposition. */
export const decisionRetenue = (resultat: Pick<ExamenResultat, 'decision'> | undefined, proposition: Proposition): Decision | null =>
  resultat?.decision ?? proposition.decision;

/** Mention retenue : seulement pour un admis — celle du jury, sinon la proposition. */
export const mentionRetenue = (
  resultat: Pick<ExamenResultat, 'decision' | 'mention'> | undefined, proposition: Proposition,
): Mention | null => {
  if (decisionRetenue(resultat, proposition) !== 'admis') return null;
  return resultat?.mention ?? proposition.mention;
};

export interface BilanExamen { candidats: number; admis: number; ajournes: number; refuses: number; sansDecision: number; tauxReussite: number | null }

export const bilanExamen = (decisions: (Decision | null)[]): BilanExamen => {
  const b = { candidats: decisions.length, admis: 0, ajournes: 0, refuses: 0, sansDecision: 0 };
  for (const d of decisions) {
    if (d === 'admis') b.admis++;
    else if (d === 'ajourne') b.ajournes++;
    else if (d === 'refuse') b.refuses++;
    else b.sansDecision++;
  }
  const decides = b.admis + b.ajournes + b.refuses;
  return { ...b, tauxReussite: decides > 0 ? (b.admis / decides) * 100 : null };
};

export const triEpreuves = (epreuves: ExamenEpreuve[]): ExamenEpreuve[] => [...epreuves].sort((a, b) => a.ordering - b.ordering);
export const triTours = (tours: ExamenTour[]): ExamenTour[] => [...tours].sort((a, b) => a.ordering - b.ordering);
export const triExamens = (examens: Examen[]): Examen[] =>
  [...examens].sort((a, b) => (a.dateDebut ?? a.createdAt).localeCompare(b.dateDebut ?? b.createdAt));

/**
 * Épreuves proposées à la création d'un examen, à partir du programme du
 * niveau : les matières théoriques en « Écrit », les pratiques et projets en
 * « Pratique », chacune avec SON coefficient (fixé par le directeur dans le
 * programme — jamais retapé). Les stages ont leur propre module.
 */
export const epreuvesDepuisProgramme = (
  matieres: Pick<NiveauMatiere, 'id' | 'matiereName' | 'coefficient' | 'nature' | 'ordering'>[],
): { tour: string; epreuves: { niveauMatiereId: string; nom: string; coefficient: number }[] }[] => {
  const tries = [...matieres].sort((a, b) => a.ordering - b.ordering);
  const ecrit = tries.filter(m => m.nature === 'theorique');
  const pratique = tries.filter(m => m.nature === 'pratique' || m.nature === 'projet');
  return [
    { tour: 'Écrit', epreuves: ecrit.map(m => ({ niveauMatiereId: m.id, nom: m.matiereName, coefficient: m.coefficient })) },
    { tour: 'Pratique', epreuves: pratique.map(m => ({ niveauMatiereId: m.id, nom: m.matiereName, coefficient: m.coefficient })) },
  ].filter(t => t.epreuves.length > 0);
};
