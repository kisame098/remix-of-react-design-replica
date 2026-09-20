import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, ReactNode,
} from 'react';
import { useSchoolYear } from './SchoolYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEnLigne } from '@/hooks/useEnLigne';
import { useInstantaneHorsLigne } from '@/hooks/useInstantaneHorsLigne';
import { supabase } from '@/integrations/supabase/client';
import { createStudentAccount, createTeacherAccount } from '@/lib/accountUtils';
import { fetchAllRows } from '@/lib/fetchAllRows';
import {
  getUnresolvedChoiceGroups as resolveUnresolvedChoiceGroups, occurrencesDeLaMatiere,
  lignesReglageManuel, appliquerReglageLocal,
} from '@/lib/academicProfile';
import {
  NIVEAUX_ELEMENTAIRE, ElementaryDomaine, ElementaryRegistre,
  ELEMENTARY_DEFAULT_LINES, ELEMENTARY_OPTIONAL_CATALOG,
} from '@/lib/elementaryDefaults';

// Tables/RPCs élémentaire ajoutées via une migration collée manuellement par
// l'utilisateur (voir plan) — pas encore dans le Database type généré, donc
// accès non typé ici comme dans fetchAllRows.ts/PayrollContext.tsx.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbElementary = supabase as any;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — Élèves & Classes (Supabase-backed)
// Nommage rigoureux pour faciliter le scaling futur.
// ─────────────────────────────────────────────────────────────────────────────

export interface Tutor {
  fullName?: string;
  phone: string;
  status: string;   // 'pere' | 'mere' | 'oncle' | 'tante' | 'autre'
  email?: string;
}

/**
 * Ligne de la table `student_profiles` — données permanentes de l'élève.
 * Le champ `uniqueId` correspond à student_profiles.unique_id (ETU-YYYY-NNNNN).
 * Les tuteurs sont stockés en colonnes séparées (tutor1_*, tutor2_*).
 */
export interface StudentRecord {
  id: string;                // UUID — student_profiles.id
  schoolId: string;          // UUID — schools.id
  uniqueId: string;          // ETU-YYYY-NNNNN — student_profiles.unique_id
  firstName: string;
  lastName: string;
  dateOfBirth: string;       // ISO date
  placeOfBirth: string;
  sex: 'homme' | 'femme';
  phone?: string;
  email?: string;
  residence: string;
  tutor1: Tutor;
  tutor2?: Tutor;
  photoUrl?: string;
  createdAt: string;         // ISO datetime
}

/**
 * Ligne de la table `student_enrollments` — inscription par année scolaire.
 * `academicYearLabel` est un TEXT (ex: "2024-2025") qui correspond à
 * SchoolYear.id dans le localStorage (SchoolYearContext).
 */
export interface StudentEnrollment {
  id: string;                  // UUID — student_enrollments.id
  studentProfileId: string;    // UUID → student_profiles.id
  classId: string | null;      // UUID → classes.id
  academicYearLabel: string;   // TEXT "2024-2025" → SchoolYear.id
  enrolledAt: string;          // ISO datetime
}

/**
 * Vue combinée (student_profiles + student_enrollments) pour l'UI.
 * Le champ `id` correspond à l'enrollment UUID (stable dans l'année).
 * Le champ `studentId` est l'identifiant métier lisible ETU-YYYY-NNNNN.
 */
export interface Student {
  id: string;              // enrollment.id (UUID)
  studentId: string;       // student_profiles.unique_id (ETU-...)
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: 'homme' | 'femme';
  phone?: string;
  email?: string;
  residence: string;
  tutor1: Tutor;
  tutor2?: Tutor;
  classId: string | null;
  createdAt: Date;
  /** Date d'inscription POUR CETTE ANNÉE (student_enrollments.enrolled_at) —
   *  distincte de createdAt, qui date la création du profil : un élève
   *  réinscrit garde un vieux createdAt mais a un enrolledAt neuf. C'est
   *  enrolledAt qui détermine à partir de quel mois il doit payer. */
  enrolledAt: string;
  photoUrl?: string;
}

/**
 * Classe scolaire (table `classes`).
 * Note : la table `classes` n'a PAS de colonne academic_year_id.
 * Les classes appartiennent à l'école et sont réutilisées d'une année à l'autre.
 */
// Niveaux reconnus pour l'auto-provisionnement (matières par défaut + filtrage
// des filières par niveau). Une classe peut aussi n'avoir aucun niveau
// (maternelle, ou école qui ne veut pas utiliser ce système).
export { NIVEAUX_ELEMENTAIRE };
export const NIVEAUX_COLLEGE = ['6ème', '5ème', '4ème', '3ème'] as const;
export const NIVEAUX_LYCEE = ['2nde', '1ère', 'Tle'] as const;
export const NIVEAUX = [...NIVEAUX_ELEMENTAIRE, ...NIVEAUX_COLLEGE, ...NIVEAUX_LYCEE] as const;
export type Niveau = typeof NIVEAUX[number];

export interface SchoolClass {
  id: string;           // UUID — classes.id
  name: string;
  studentLimit: number;
  niveau?: string;       // '6ème'…'Tle' (voir NIVEAUX) ou libre/absent
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — Enseignants (Supabase-backed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ligne de la table `teacher_profiles` — données permanentes du professeur.
 * Miroir de StudentRecord pour les enseignants.
 */
export interface TeacherRecord {
  id: string;               // UUID — teacher_profiles.id
  schoolId: string;         // UUID — schools.id
  uniqueId: string;         // PROF-YYYY-NNNNN — teacher_profiles.unique_id
  firstName: string;
  lastName: string;
  dateOfBirth: string;      // ISO date
  placeOfBirth: string;
  sex: 'homme' | 'femme';
  phone?: string;
  email?: string;
  residence: string;
  diploma: string;
  emergencyPhone: string;
  photoUrl?: string;
  createdAt: string;        // ISO datetime
}

/**
 * Ligne de la table `teacher_enrollments` — contrat par année scolaire.
 * `academicYearLabel` est un TEXT "2024-2025" aligné sur SchoolYearContext.
 */
export interface TeacherEnrollmentRecord {
  id: string;                  // UUID — teacher_enrollments.id
  teacherProfileId: string;    // UUID → teacher_profiles.id
  academicYearLabel: string;   // TEXT "2024-2025" → SchoolYear.id
  yearsExperience: number;
  contractType: 'cdi' | 'cdd' | 'vacataire' | 'stagiaire';
  paymentType: 'hourly' | 'fixed';
  salaryAmount: number;
  enrolledAt: string;          // ISO datetime
}

/**
 * Vue combinée (teacher_profiles + teacher_enrollments) pour l'UI.
 * `id` = enrollment UUID (stable dans l'année).
 * `teacherId` = teacher_profiles.unique_id (PROF-...).
 */
export interface Teacher {
  id: string;           // enrollment UUID — teacher_enrollments.id
  teacherId: string;    // PROF-YYYY-NNNNN — teacher_profiles.unique_id
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: 'homme' | 'femme';
  phone: string;
  email?: string;
  residence: string;
  diploma: string;
  yearsExperience: number;
  emergencyPhone: string;
  contractType: 'cdi' | 'cdd' | 'vacataire' | 'stagiaire';
  paymentType: 'hourly' | 'fixed';
  salaryAmount: number;
  createdAt: Date;
  photoUrl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — Supabase : Notes, Périodes, Matières, Paramètres
// ─────────────────────────────────────────────────────────────────────────────

export interface GradePeriod {
  id: string;               // UUID → grade_periods.id
  name: string;
  type: 'semester' | 'exam';
  academicYearLabel: string; // ex: "2024-2025"
  ordering: number;
  startDate?: string; // ISO "2024-09-01" — sert à scoper les absences/présences par période
  endDate?: string;   // ISO "2025-01-31"
  createdAt: Date;
}

export type SubjectType = 'obligatoire' | 'choix' | 'facultative';

export interface Subject {
  id: string;          // UUID → subjects.id
  name: string;
  coefficient: number;
  classId: string;     // UUID → classes.id
  periodId: string;    // UUID → grade_periods.id
  ordering: number;
  subjectType: SubjectType;
  teacherId?: string;  // UUID → teacher_enrollments.id — prof assigné (optionnel)
}

export interface Grade {
  id: string;                   // UUID → grades.id
  studentEnrollmentId: string;  // UUID → student_enrollments.id
  subjectId: string;            // UUID → subjects.id
  devoir1?: number;
  devoir2?: number;
  devoir3?: number;
  devoir4?: number;
  devoir5?: number;
  composition?: number;
  note?: number;
}

/** Payload pour upsert par lot des notes d'une matière */
export interface GradeUpsertEntry {
  studentEnrollmentId: string;
  devoir1?: number | null;
  devoir2?: number | null;
  devoir3?: number | null;
  devoir4?: number | null;
  devoir5?: number | null;
  composition?: number | null;
  note?: number | null;
}

export interface StudentSubjectSetting {
  active: boolean;
  customCoef?: string;  // string pour la compatibilité avec les inputs
  // Posé à 'manual' uniquement quand une exception a été saisie à la main sur
  // le profil académique de l'élève (hors flux choix/facultatif) — permet de
  // distinguer une divergence volontaire d'un résidu automatique.
  overrideReason?: string;
}

export interface SubjectSettingsData {
  id: string;        // UUID → subject_settings.id ('' si non encore persisté)
  subjectId: string; // UUID → subjects.id
  devoir1Active: boolean;
  devoir2Active: boolean;
  devoir3Active: boolean;
  devoir4Active: boolean;
  devoir5Active: boolean;
  // Clé = student_enrollment_id (UUID)
  studentSettings: Record<string, StudentSubjectSetting>;
}

// ─── Filières (moteur générique matières obligatoires + créneaux au choix) ────
// Une filière (S, S1, S2, L2, L1a…) est un NOM DE SÉRIE indépendant du niveau —
// elle s'applique à une classe de 2nde, 1ère ou Tle. La plupart de ses matières
// gardent le MÊME coefficient à tous ces niveaux (ex: Français, Maths, SVT en
// S1) — seule une poignée change ou n'existe qu'à un niveau donné (ex: la
// Philosophie n'apparaît qu'en Terminale). Le niveau '' (chaîne vide) désigne
// donc la base "tous niveaux" ; un niveau précis AJOUTE ou REDÉFINIT une
// matière/un groupe (même nom) UNIQUEMENT pour ce niveau-là — voir
// NIVEAU_BASE et materialize_filiere_period (DB) pour la logique de fusion.
// Le collège (6e-3e) n'a PAS de filière — programme identique pour tous, donc
// simple valeur par défaut liée au niveau de la classe (voir
// DEFAULT_NIVEAU_SUBJECTS / table niveau_default_subjects), pas une entité
// "filière" que l'admin choisirait.
export const NIVEAU_BASE = '';

// Matières de collège pré-remplies à la création d'une école, liées au NIVEAU
// de la classe — pas à une filière (le collège n'a pas de série/choix). Lignes
// normales, entièrement éditables/supprimables ensuite comme toute matière.
const DEFAULT_NIVEAU_SUBJECTS: { niveau: string; name: string; coefficient: number }[] = [
  ...['6ème', '5ème'].flatMap(niveau => [
    { niveau, name: 'Français', coefficient: 4 }, { niveau, name: 'Mathématiques', coefficient: 3 },
    { niveau, name: 'Anglais', coefficient: 2 }, { niveau, name: 'Histoire-Géographie', coefficient: 2 },
    { niveau, name: 'Éducation civique', coefficient: 1 }, { niveau, name: 'SVT', coefficient: 2 },
    { niveau, name: 'EPS', coefficient: 2 },
  ]),
  ...['4ème', '3ème'].flatMap(niveau => [
    { niveau, name: 'Français', coefficient: 4 }, { niveau, name: 'Mathématiques', coefficient: 3 },
    { niveau, name: 'Anglais', coefficient: 2 }, { niveau, name: 'Histoire-Géographie', coefficient: 2 },
    { niveau, name: 'Éducation civique', coefficient: 1 }, { niveau, name: 'SVT', coefficient: 2 },
    { niveau, name: 'Sciences Physiques', coefficient: 2 }, { niveau, name: 'Arabe', coefficient: 2 },
    { niveau, name: 'EPS', coefficient: 2 },
  ]),
];

// Filières de lycée pré-remplies. Seules les séries majoritaires aux résultats
// du bac sont préremplies (L'1 ~27%, L2 ~52%, S2 ~16% — à eux trois l'écrasante
// majorité des candidats) ; S1 (~0.05%) et les sous-branches sans apostrophe
// L1/L1a/L1b (~0.03% à eux deux), ainsi que STEG/STIDD/franco-arabe, restent
// à la charge de l'école concernée via le même moteur générique — leur poids
// est trop marginal pour justifier un gabarit nationalement pertinent.
// Basé sur l'analyse de bulletins réels (pas seulement la grille officielle) :
// S/S1/S2/L (2nde) ont un programme fixe, sans matière au choix (hormis la
// langue 2 en 2nde L, voir plus bas). L2 : vrai choix LV1/LV2 (dominante/non-
// dominante, coef 4/2, identique aux deux niveaux) + choix Sciences (SVT ou
// Sciences Physiques, jamais les deux) + Économie qui peut remplacer LV2, mais
// uniquement en 1ère. L'1 : en 1ère, DEUX langues choisies parmi Anglais/Arabe/
// Espagnol (coef 4 chacune, pas de dominante) ; en Tle, Anglais devient fixe et
// il ne reste qu'UN choix entre Arabe/Espagnol.
const DEFAULT_FILIERE_TEMPLATES: {
  name: string; description: string;
  niveaux: string[];
  subjects: { niveau: string; name: string; coefficient: number }[];
  choiceGroups?: { niveau: string; label: string; coefficient: number; options: string[] }[];
  facultativeSubjects?: { niveau: string; name: string; coefficient: number }[];
}[] = [
  {
    // Arabe/Espagnol/Économie existent dans la grille officielle avec un vrai
    // coefficient, mais un bulletin réel (2nde S) montre un élève qui n'en
    // suit AUCUN — ce sont donc des matières facultatives (l'élève les suit ou
    // pas), pas obligatoires pour tous. Coefficient aligné sur la valeur
    // confirmée en 1ère (2) plutôt que la grille (3), jamais recoupée par un
    // bulletin réel pour ce niveau précis.
    name: 'S', description: 'Série scientifique — configurée pour : 2nde. Ajoutez 1ère/Tle si votre école ne sépare pas S1/S2.',
    niveaux: ['2nde'],
    subjects: [
      { niveau: '2nde', name: 'Français', coefficient: 3 }, { niveau: '2nde', name: 'Anglais', coefficient: 3 },
      { niveau: '2nde', name: 'Mathématiques', coefficient: 5 }, { niveau: '2nde', name: 'Histoire-Géographie', coefficient: 2 },
      { niveau: '2nde', name: 'SVT', coefficient: 5 }, { niveau: '2nde', name: 'Sciences Physiques', coefficient: 5 },
      { niveau: '2nde', name: 'EPS', coefficient: 1 },
    ],
    facultativeSubjects: [
      { niveau: '2nde', name: 'Arabe', coefficient: 2 }, { niveau: '2nde', name: 'Espagnol', coefficient: 2 },
      { niveau: '2nde', name: 'Économie', coefficient: 2 },
    ],
  },
  {
    // Le socle (Français/Anglais/Maths/HG/SVT/SP/EPS) est identique en 1ère et
    // en Tle — une seule ligne "base" (niveau '') suffit. Philosophie (Tle
    // uniquement). Arabe/Espagnol : facultatifs en 1ère (un bulletin réel
    // montre un élève sans aucun des deux), absents en Tle.
    name: 'S1', description: 'Série scientifique (dominante Maths-Physique) — configurée pour : 1ère, Tle',
    niveaux: ['1ère', 'Tle'],
    subjects: [
      { niveau: NIVEAU_BASE, name: 'Français', coefficient: 3 }, { niveau: NIVEAU_BASE, name: 'Anglais', coefficient: 2 },
      { niveau: NIVEAU_BASE, name: 'Mathématiques', coefficient: 8 }, { niveau: NIVEAU_BASE, name: 'Histoire-Géographie', coefficient: 2 },
      { niveau: NIVEAU_BASE, name: 'SVT', coefficient: 2 }, { niveau: NIVEAU_BASE, name: 'Sciences Physiques', coefficient: 8 },
      { niveau: NIVEAU_BASE, name: 'EPS', coefficient: 1 },
      { niveau: 'Tle', name: 'Philosophie', coefficient: 2 },
    ],
    facultativeSubjects: [
      { niveau: '1ère', name: 'Arabe', coefficient: 2 }, { niveau: '1ère', name: 'Espagnol', coefficient: 2 },
    ],
  },
  {
    name: 'S2', description: 'Série scientifique (dominante SVT) — configurée pour : 1ère, Tle',
    niveaux: ['1ère', 'Tle'],
    subjects: [
      { niveau: NIVEAU_BASE, name: 'Français', coefficient: 3 }, { niveau: NIVEAU_BASE, name: 'Anglais', coefficient: 2 },
      { niveau: NIVEAU_BASE, name: 'Mathématiques', coefficient: 5 }, { niveau: NIVEAU_BASE, name: 'Histoire-Géographie', coefficient: 2 },
      { niveau: NIVEAU_BASE, name: 'SVT', coefficient: 6 }, { niveau: NIVEAU_BASE, name: 'Sciences Physiques', coefficient: 6 },
      { niveau: NIVEAU_BASE, name: 'EPS', coefficient: 1 },
      { niveau: 'Tle', name: 'Philosophie', coefficient: 2 },
    ],
    facultativeSubjects: [
      { niveau: '1ère', name: 'Arabe', coefficient: 2 }, { niveau: '1ère', name: 'Espagnol', coefficient: 2 },
      { niveau: '1ère', name: 'Économie', coefficient: 2 },
    ],
  },
  {
    name: 'L', description: 'Série littéraire — configurée pour : 2nde. Ajoutez 1ère/Tle si votre école ne sépare pas L2/L\'1.',
    niveaux: ['2nde'],
    subjects: [
      { niveau: '2nde', name: 'Français', coefficient: 4 }, { niveau: '2nde', name: 'Anglais', coefficient: 3 },
      { niveau: '2nde', name: 'Mathématiques', coefficient: 3 }, { niveau: '2nde', name: 'Histoire-Géographie', coefficient: 4 },
      { niveau: '2nde', name: 'SVT', coefficient: 2 }, { niveau: '2nde', name: 'Sciences Physiques', coefficient: 2 },
      { niveau: '2nde', name: 'EPS', coefficient: 1 },
    ],
    choiceGroups: [
      { niveau: '2nde', label: 'Langue 2', coefficient: 3, options: ['Arabe', 'Espagnol'] },
    ],
  },
  {
    // Socle commun 1ère+Tle identique sauf Maths (3→2) et Philosophie (Tle
    // uniquement) — LV1/LV2 (Anglais/Arabe/Espagnol, coef 4/2) sont un vrai
    // choix, identique aux deux niveaux ; SVT/Sciences Physiques sont aussi un
    // choix (jamais les deux ensemble) ; Économie peut remplacer LV2, mais
    // uniquement en 1ère (absent en Tle dans les bulletins réels analysés).
    name: 'L2', description: 'Série littéraire (dominante Langues, choix LV1/LV2 + Sciences) — configurée pour : 1ère, Tle',
    niveaux: ['1ère', 'Tle'],
    subjects: [
      { niveau: NIVEAU_BASE, name: 'Français', coefficient: 5 }, { niveau: NIVEAU_BASE, name: 'Histoire-Géographie', coefficient: 6 },
      { niveau: NIVEAU_BASE, name: 'EPS', coefficient: 1 },
      { niveau: '1ère', name: 'Mathématiques', coefficient: 3 },
      { niveau: 'Tle', name: 'Mathématiques', coefficient: 2 }, { niveau: 'Tle', name: 'Philosophie', coefficient: 6 },
    ],
    choiceGroups: [
      { niveau: NIVEAU_BASE, label: 'LV1', coefficient: 4, options: ['Anglais', 'Arabe', 'Espagnol'] },
      { niveau: NIVEAU_BASE, label: 'LV2', coefficient: 2, options: ['Anglais', 'Arabe', 'Espagnol'] },
      { niveau: '1ère', label: 'LV2', coefficient: 2, options: ['Anglais', 'Arabe', 'Espagnol', 'Économie'] },
      { niveau: NIVEAU_BASE, label: 'Sciences', coefficient: 2, options: ['SVT', 'Sciences Physiques'] },
    ],
  },
  {
    // 1ère : deux langues choisies parmi Anglais/Arabe/Espagnol, coef 4 chacune
    // (pas de dominante/non-dominante ici, contrairement à L2). Tle : Anglais
    // devient une matière fixe, et il ne reste qu'un seul choix entre
    // Arabe/Espagnol. Confirmé sur bulletins réels (même établissement, 1ère
    // et Tle, deux années différentes).
    name: "L'1", description: "Série littéraire (langues) — configurée pour : 1ère, Tle. En 1ère, deux langues au choix parmi Anglais/Arabe/Espagnol (coef 4 chacune) ; en Tle, Anglais devient fixe et un seul choix reste entre Arabe/Espagnol.",
    niveaux: ['1ère', 'Tle'],
    subjects: [
      { niveau: NIVEAU_BASE, name: 'Français', coefficient: 6 }, { niveau: NIVEAU_BASE, name: 'Mathématiques', coefficient: 2 },
      { niveau: NIVEAU_BASE, name: 'Histoire-Géographie', coefficient: 2 }, { niveau: NIVEAU_BASE, name: 'EPS', coefficient: 1 },
      { niveau: 'Tle', name: 'Anglais', coefficient: 4 }, { niveau: 'Tle', name: 'Philosophie', coefficient: 4 },
    ],
    choiceGroups: [
      { niveau: '1ère', label: 'Langue 1', coefficient: 4, options: ['Anglais', 'Arabe', 'Espagnol'] },
      { niveau: '1ère', label: 'Langue 2', coefficient: 4, options: ['Anglais', 'Arabe', 'Espagnol'] },
      { niveau: 'Tle', label: 'Langue 2', coefficient: 4, options: ['Arabe', 'Espagnol'] },
    ],
  },
];

export interface Filiere {
  id: string;           // UUID → filieres.id
  name: string;
  description?: string;
  // Niveaux où cette filière s'applique réellement (ex: ['2nde'] pour "S"/"L",
  // ['1ère','Tle'] pour "S1"/"S2"/"L2"/"L'1" — la 2nde est un tronc commun,
  // les séries précises n'existent qu'à partir de la 1ère). Vide = pas encore
  // configuré. Gouverne quels onglets de niveau l'éditeur affiche.
  niveaux: string[];
}

export interface NiveauDefaultSubject {
  id: string;            // UUID → niveau_default_subjects.id
  niveau: string;
  name: string;
  coefficient: number;
  ordering: number;
  isFacultative: boolean;
}

// ── Élémentaire (CI-CM2) — système à barème de points, pas de coefficients ──
export interface ElementaryDefaultLine {
  id: string;             // UUID → elementary_default_lines.id
  niveau: string;
  domaine: ElementaryDomaine;
  registre: ElementaryRegistre;
  name: string;
  pointMax: number;
  ordering: number;
  isOptional: boolean;
  isActiveByDefault: boolean;
}

export interface ElementaryClassLine {
  id: string;             // UUID → elementary_class_lines.id
  classId: string;
  periodId: string;
  domaine: ElementaryDomaine;
  registre: ElementaryRegistre;
  name: string;
  pointMax: number;
  ordering: number;
  teacherId?: string;
}

// Une note élémentaire = points obtenus sur une ligne (barème), pas de coefficient.
// points_obtenus non défini (undefined) = ligne non saisie pour cet élève → exclue
// du calcul de la moyenne (jamais comptée comme 0), voir useElementaryClassRanking.
export interface ElementaryGrade {
  id: string;                   // UUID → elementary_grades.id
  lineId: string;                // UUID → elementary_class_lines.id
  studentEnrollmentId: string;  // UUID → student_enrollments.id
  pointsObtenus?: number;
}

/** Dispense d'une discipline pour UN élève (ex: inapte EPS) — active=false
 *  sort la discipline de SA moyenne, sans toucher aux autres élèves. */
export interface ElementaryLineSetting {
  id: string;                   // UUID → elementary_student_line_settings.id
  lineId: string;
  studentEnrollmentId: string;
  active: boolean;
  overrideReason?: string;
}

export interface FiliereMandatorySubject {
  id: string;            // UUID → filiere_mandatory_subjects.id
  filiereId: string;
  niveau: string;         // '' = base (tous niveaux) ; '2nde'/'1ère'/'Tle' = ajout/redéfinition pour ce niveau
  name: string;
  coefficient: number;
  ordering: number;
}

// Matière facultative : l'élève peut l'activer ou non, individuellement, sans
// exclusion mutuelle avec quoi que ce soit (ex: Latin, Conduite, Informatique)
// — distincte d'un groupe de choix (qui impose de choisir exactement 1 de N).
export interface FiliereFacultativeSubject {
  id: string;            // UUID → filiere_facultative_subjects.id
  filiereId: string;
  niveau: string;         // '' = base (tous niveaux) ; niveau précis = ajout/redéfinition
  name: string;
  coefficient: number;
  ordering: number;
}

export interface FiliereChoiceOption {
  id: string;            // UUID → filiere_choice_options.id
  choiceGroupId: string;
  subjectName: string;
  ordering: number;
}

export interface FiliereChoiceGroup {
  id: string;            // UUID → filiere_choice_groups.id
  filiereId: string;
  niveau: string;         // '' = base (tous niveaux) ; '2nde'/'1ère'/'Tle' = ajout/redéfinition pour ce niveau
  label: string;         // "LV1", "LV2 non-dominante", ou tout autre nom
  coefficient: number;
  ordering: number;
  options: FiliereChoiceOption[];
}

// ── Fusion base ('') + redéfinition niveau-spécifique ──────────────────────
// Pour un niveau donné, une matière/un groupe défini À CE NIVEAU remplace la
// ligne de base de même nom/label ; sinon la base s'applique telle quelle.
// Utilisé partout où on calcule "les matières effectives d'une filière pour
// telle classe" (assignation, aperçu éditeur, portail élève…).
export function mergeFiliereMandatorySubjects(
  all: FiliereMandatorySubject[], filiereId: string, niveau: string
): FiliereMandatorySubject[] {
  const relevant = all.filter(m => m.filiereId === filiereId && (m.niveau === NIVEAU_BASE || m.niveau === niveau));
  const byName = new Map<string, FiliereMandatorySubject>();
  for (const m of relevant) {
    const existing = byName.get(m.name);
    if (!existing || (m.niveau !== NIVEAU_BASE && existing.niveau === NIVEAU_BASE)) byName.set(m.name, m);
  }
  return [...byName.values()].sort((a, b) => a.ordering - b.ordering);
}

export function mergeFiliereFacultativeSubjects(
  all: FiliereFacultativeSubject[], filiereId: string, niveau: string
): FiliereFacultativeSubject[] {
  const relevant = all.filter(m => m.filiereId === filiereId && (m.niveau === NIVEAU_BASE || m.niveau === niveau));
  const byName = new Map<string, FiliereFacultativeSubject>();
  for (const m of relevant) {
    const existing = byName.get(m.name);
    if (!existing || (m.niveau !== NIVEAU_BASE && existing.niveau === NIVEAU_BASE)) byName.set(m.name, m);
  }
  return [...byName.values()].sort((a, b) => a.ordering - b.ordering);
}

export function mergeFiliereChoiceGroups(
  all: FiliereChoiceGroup[], filiereId: string, niveau: string
): FiliereChoiceGroup[] {
  const relevant = all.filter(g => g.filiereId === filiereId && (g.niveau === NIVEAU_BASE || g.niveau === niveau));
  const byLabel = new Map<string, FiliereChoiceGroup>();
  for (const g of relevant) {
    const existing = byLabel.get(g.label);
    if (!existing || (g.niveau !== NIVEAU_BASE && existing.niveau === NIVEAU_BASE)) byLabel.set(g.label, g);
  }
  return [...byLabel.values()].sort((a, b) => a.ordering - b.ordering);
}

/** Filière suivie par une classe pour une année précise (les classes sont
 *  réutilisées d'une année à l'autre — l'assignation doit rester par année). */
export interface ClassFiliereAssignment {
  id: string;            // UUID → class_filiere_assignments.id
  classId: string;
  academicYearLabel: string;
  filiereId: string;
}

/** Choix résolu d'un élève pour un créneau donné — posé par l'élève lui-même
 *  via son portail, ou par un membre du personnel qui le corrige. */
export interface FiliereStudentChoice {
  id: string;             // UUID → filiere_student_choices.id
  classFiliereAssignmentId: string;
  choiceGroupId: string;
  studentEnrollmentId: string;
  chosenSubjectName: string;
  chosenBy: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACE DU CONTEXTE
// ─────────────────────────────────────────────────────────────────────────────
interface SchoolContextType {
  // Loading
  classesLoading: boolean;
  studentsLoading: boolean;

  // Données Supabase
  classes: SchoolClass[];
  studentRecords: StudentRecord[];
  studentEnrollments: StudentEnrollment[];

  // Loading profs
  teachersLoading: boolean;

  // Données Supabase — profs
  teacherRecords: TeacherRecord[];
  teacherEnrollmentRecords: TeacherEnrollmentRecord[];

  // Loading grades
  gradesLoading: boolean;

  /**
   * Date ISO des données réinstallées depuis l'appareil, hors connexion.
   * `null` quand elles viennent du réseau.
   */
  instantaneLe: string | null;

  // Données Supabase — notes, matières, périodes
  gradePeriods: GradePeriod[];
  /** Classes concernées par chaque période — par défaut toutes, personnalisable (ex: examen interne réservé à certaines classes). */
  isClassInPeriod: (periodId: string, classId: string) => boolean;
  setClassInPeriod: (periodId: string, classId: string, included: boolean) => Promise<void>;
  subjects: Subject[];
  grades: Grade[];
  subjectSettings: SubjectSettingsData[];

  // Vues combinées pour l'année courante
  students: Student[];
  teachers: Teacher[];

  // Données Supabase — filières
  filieres: Filiere[];
  filiereMandatorySubjects: FiliereMandatorySubject[];
  filiereFacultativeSubjects: FiliereFacultativeSubject[];
  filiereChoiceGroups: FiliereChoiceGroup[];
  classFiliereAssignments: ClassFiliereAssignment[];
  filiereStudentChoices: FiliereStudentChoice[];
  /** Matières par défaut liées à un NIVEAU (6e-3e) — pas une filière : le collège n'a pas de série/choix. */
  niveauDefaultSubjects: NiveauDefaultSubject[];
  /** Catalogue des lignes à barème par défaut, par niveau élémentaire (CI-CM2). */
  elementaryDefaultLines: ElementaryDefaultLine[];
  /** Lignes à barème matérialisées par classe+période élémentaire. */
  elementaryClassLines: ElementaryClassLine[];
  /** Notes élémentaires (points obtenus par ligne/élève). */
  elementaryGrades: ElementaryGrade[];
  /** Dispenses par élève (discipline retirée de SA moyenne). */
  elementaryLineSettings: ElementaryLineSetting[];

  // ── Classes (Supabase) ──────────────────────────────────────────────────────
  addClass: (data: { name: string; studentLimit: number; niveau?: string }) => Promise<SchoolClass>;
  updateClass: (id: string, data: { name: string; studentLimit: number; niveau?: string }) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  getStudentCountByClass: (classId: string) => number;

  // ── Élèves (Supabase) ───────────────────────────────────────────────────────
  generateStudentId: () => string;
  addStudent: (student: Omit<Student, 'id' | 'studentId' | 'createdAt' | 'enrolledAt'>) => Promise<Student>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  findStudentByUniqueId: (uniqueId: string) => StudentRecord | undefined;
  reEnrollStudent: (uniqueId: string, classId: string | null) => Promise<Student | null>;

  // ── Profs (Supabase) ────────────────────────────────────────────────────────
  generateTeacherId: () => string;
  addTeacher: (teacher: Omit<Teacher, 'id' | 'teacherId' | 'createdAt'>) => Promise<Teacher>;
  updateTeacher: (id: string, updates: Partial<Teacher>) => Promise<void>;
  findTeacherByUniqueId: (uniqueId: string) => TeacherRecord | undefined;
  reEnrollTeacher: (
    uniqueId: string,
    data: Pick<TeacherEnrollmentRecord, 'yearsExperience' | 'contractType' | 'paymentType' | 'salaryAmount'>
  ) => Promise<Teacher | null>;

  // ── Périodes & Notes (Supabase) ─────────────────────────────────────────────
  addGradePeriod: (data: { name: string; type: 'semester' | 'exam'; startDate?: string; endDate?: string }) => Promise<GradePeriod>;
  updateGradePeriod: (id: string, data: { name?: string; startDate?: string | null; endDate?: string | null }) => Promise<void>;
  deleteGradePeriod: (id: string) => Promise<void>;
  addSubject: (data: { name: string; coefficient: number; classId: string; periodId: string; teacherId?: string }) => Promise<Subject>;
  updateSubject: (id: string, updates: { name?: string; coefficient?: number; teacherId?: string | null }) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  upsertGrades: (subjectId: string, entries: GradeUpsertEntry[]) => Promise<void>;
  updateSubjectSettings: (
    subjectId: string,
    settings: Pick<SubjectSettingsData, 'devoir1Active' | 'devoir2Active' | 'devoir3Active' | 'devoir4Active' | 'devoir5Active'>
  ) => Promise<void>;
  getSubjectSettings: (subjectId: string) => SubjectSettingsData | undefined;
  /** Unique point d'écriture pour une exception manuelle par élève (hors choix/facultatif automatiques). */
  updateStudentSubjectOverride: (studentEnrollmentId: string, subjectId: string, active: boolean, customCoef?: string) => Promise<void>;

  // ── Filières (Supabase) ─────────────────────────────────────────────────────
  addFiliere: (data: { name: string; description?: string }) => Promise<Filiere>;
  updateFiliere: (id: string, updates: { name?: string; description?: string }) => Promise<void>;
  updateFiliereNiveaux: (id: string, niveaux: string[]) => Promise<void>;
  deleteFiliere: (id: string) => Promise<void>;
  addFiliereMandatorySubject: (filiereId: string, data: { niveau: string; name: string; coefficient: number }) => Promise<FiliereMandatorySubject>;
  updateFiliereMandatorySubject: (id: string, updates: { name?: string; coefficient?: number }) => Promise<void>;
  deleteFiliereMandatorySubject: (id: string) => Promise<void>;
  addFiliereFacultativeSubject: (filiereId: string, data: { niveau: string; name: string; coefficient: number }) => Promise<FiliereFacultativeSubject>;
  updateFiliereFacultativeSubject: (id: string, updates: { name?: string; coefficient?: number }) => Promise<void>;
  deleteFiliereFacultativeSubject: (id: string) => Promise<void>;
  addFiliereChoiceGroup: (filiereId: string, data: { niveau: string; label: string; coefficient: number }) => Promise<FiliereChoiceGroup>;
  updateFiliereChoiceGroup: (id: string, updates: { label?: string; coefficient?: number }) => Promise<void>;
  deleteFiliereChoiceGroup: (id: string) => Promise<void>;
  addFiliereChoiceOption: (choiceGroupId: string, subjectName: string) => Promise<FiliereChoiceOption>;
  deleteFiliereChoiceOption: (id: string) => Promise<void>;
  /** Seul point d'écriture pour assigner une filière — passe par la RPC qui matérialise aussi les matières (filtrées par le niveau de la classe). */
  assignClassFiliere: (classId: string, academicYearLabel: string, filiereId: string) => Promise<void>;
  /** Seul point d'écriture du choix d'un élève — appelable par l'élève (portail) ou un membre du personnel (correction). */
  resolveFiliereChoice: (choiceGroupId: string, studentEnrollmentId: string, subjectName: string, actor: string) => Promise<void>;
  getClassFiliereAssignment: (classId: string, academicYearLabel: string) => ClassFiliereAssignment | undefined;
  getStudentFiliereChoice: (studentEnrollmentId: string, choiceGroupId: string) => FiliereStudentChoice | undefined;
  /** Applique les matières par défaut du niveau de la classe (collège) — sans filière, sans lien permanent. */
  applyNiveauDefaultsToClass: (classId: string, academicYearLabel: string) => Promise<void>;
  /** Rattrape les matières ajoutées au programme/cursus après coup, sans toucher aux matières déjà présentes. Retourne le nombre de matières ajoutées. */
  resyncPeriodSubjects: (classId: string, periodId: string, mode: 'college' | 'lycee' | 'elementaire') => Promise<number>;
  /** CRUD du modèle "programme par niveau" (collège) — voir DEFAULT_NIVEAU_SUBJECTS. */
  addNiveauDefaultSubject: (data: { niveau: string; name: string; coefficient: number; isFacultative?: boolean }) => Promise<NiveauDefaultSubject>;
  updateNiveauDefaultSubject: (id: string, updates: { name?: string; coefficient?: number; isFacultative?: boolean }) => Promise<void>;
  deleteNiveauDefaultSubject: (id: string) => Promise<void>;

  // ── Élémentaire (Supabase) — système à barème de points ─────────────────────
  /** Applique les lignes par défaut du niveau élémentaire de la classe. */
  applyElementaryDefaultsToClass: (classId: string, academicYearLabel: string) => Promise<void>;
  addElementaryDefaultLine: (data: { niveau: string; domaine: ElementaryDomaine; registre: ElementaryRegistre; name: string; pointMax: number; isOptional?: boolean }) => Promise<ElementaryDefaultLine>;
  updateElementaryDefaultLine: (id: string, updates: { name?: string; pointMax?: number; isActiveByDefault?: boolean }) => Promise<void>;
  deleteElementaryDefaultLine: (id: string) => Promise<void>;
  addElementaryClassLine: (data: { classId: string; periodId: string; domaine: ElementaryDomaine; registre: ElementaryRegistre; name: string; pointMax: number; teacherId?: string }) => Promise<ElementaryClassLine>;
  updateElementaryClassLine: (id: string, updates: { name?: string; pointMax?: number; teacherId?: string | null }) => Promise<void>;
  deleteElementaryClassLine: (id: string) => Promise<void>;
  /** Upsert par lot des notes (points obtenus) d'une ligne élémentaire pour toute la classe. */
  upsertElementaryGrades: (lineId: string, entries: { studentEnrollmentId: string; pointsObtenus?: number | null }[]) => Promise<void>;
  /** Dispense/réintègre UNE discipline pour UN élève (ex: inapte EPS). */
  setElementaryLineExemption: (studentEnrollmentId: string, lineId: string, active: boolean) => Promise<void>;
  /** Active/désactive une matière facultative pour un élève (opt-in individuel, pas d'exclusion mutuelle). */
  setFacultativeActive: (studentEnrollmentId: string, subjectName: string, active: boolean) => Promise<void>;
  /** Renvoie les groupes de choix de la classe/niveau d'un élève qui n'ont pas encore de choix résolu — pour le filet de sécurité "à finaliser". */
  getUnresolvedChoiceGroups: (studentEnrollmentId: string, classId: string, academicYearLabel: string) => FiliereChoiceGroup[];
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — conversion ligne DB → types frontend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mappe les colonnes tutor1_* / tutor2_* d'une ligne student_profiles
 * vers nos types Tutor frontend.
 */
const mapStudentProfileRow = (r: Record<string, unknown>): Omit<StudentRecord, 'id' | 'schoolId'> => {
  const tutor1: Tutor = {
    fullName: (r.tutor1_full_name as string | null) ?? undefined,
    phone:    (r.tutor1_phone    as string | null) ?? '',
    status:   (r.tutor1_status   as string | null) ?? '',
    email:    (r.tutor1_email    as string | null) ?? undefined,
  };

  const hasTutor2 = !!(r.tutor2_phone as string | null);
  const tutor2: Tutor | undefined = hasTutor2
    ? {
        fullName: (r.tutor2_full_name as string | null) ?? undefined,
        phone:    (r.tutor2_phone    as string) ?? '',
        status:   (r.tutor2_status   as string | null) ?? '',
        email:    (r.tutor2_email    as string | null) ?? undefined,
      }
    : undefined;

  return {
    uniqueId:     (r.unique_id    as string) ?? '',
    firstName:    (r.first_name   as string) ?? '',
    lastName:     (r.last_name    as string) ?? '',
    dateOfBirth:  (r.date_of_birth  as string) ?? '',
    placeOfBirth: (r.place_of_birth as string) ?? '',
    sex:          (r.sex as 'homme' | 'femme') ?? 'homme',
    phone:        (r.phone     as string | null) ?? undefined,
    email:        (r.email     as string | null) ?? undefined,
    residence:    (r.residence as string) ?? '',
    tutor1,
    tutor2,
    photoUrl:     (r.photo_url as string | null) ?? undefined,
    createdAt:    (r.created_at as string) ?? new Date().toISOString(),
  };
};

/**
 * Génère un identifiant métier prévisuel côté client.
 * L'identifiant définitif est généré via RPC generate_student_unique_id()
 * au moment de l'insertion. Cette fonction sert uniquement à l'aperçu UI.
 */
const buildStudentUniqueIdPreview = (existingCount: number): string => {
  const year = new Date().getFullYear();
  const seq  = String(existingCount + 1).padStart(5, '0');
  return `ETU-${year}-${seq}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Note : les fonctions createStudentAccount / createTeacherAccount sont
// importées depuis '@/lib/accountUtils' pour pouvoir être réutilisées
// dans IdentityManagement (rétroactivité des comptes existants).
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────
export const SchoolProvider = ({ children }: { children: ReactNode }) => {
  const { currentYear } = useSchoolYear();
  const { school, accountRole, isSchoolAccessBlocked } = useAuth();
  const enLigne = useEnLigne();

  // schoolId provient exclusivement de school.id, chargé via get_my_school_id()
  // dans AuthContext (fonction SECURITY DEFINER qui bypasse le bug RLS circulaire
  // de school_members).
  const schoolId: string | null = school?.id ?? null;

  // ── State Supabase ──────────────────────────────────────────────────────────
  const [classes, setClasses]                       = useState<SchoolClass[]>([]);
  const [studentRecords, setStudentRecords]         = useState<StudentRecord[]>([]);
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollment[]>([]);
  const [classesLoading, setClassesLoading]         = useState(false);
  const [studentsLoading, setStudentsLoading]       = useState(false);

  // ── State Supabase — profs ──────────────────────────────────────────────────
  const [teacherRecords, setTeacherRecords]                     = useState<TeacherRecord[]>([]);
  const [teacherEnrollmentRecords, setTeacherEnrollmentRecords] = useState<TeacherEnrollmentRecord[]>([]);
  const [teachersLoading, setTeachersLoading]                   = useState(false);

  // ── State Supabase — notes, matières, périodes ─────────────────────────────
  const [gradePeriods, setGradePeriods]       = useState<GradePeriod[]>([]);
  const [periodClasses, setPeriodClasses]     = useState<{ periodId: string; classId: string }[]>([]);
  const [subjects, setSubjects]               = useState<Subject[]>([]);
  const [gradesState, setGradesState]         = useState<Grade[]>([]);
  const [subjectSettings, setSubjectSettings] = useState<SubjectSettingsData[]>([]);
  const [gradesLoading, setGradesLoading]     = useState(false);

  // ── State Supabase — filières ────────────────────────────────────────────────
  // Les filières-modèles ne sont pas liées à une année (comme les classes) —
  // seule leur assignation à une classe (`classFiliereAssignments`) l'est.
  const [filieres, setFilieres]                             = useState<Filiere[]>([]);
  const [filiereMandatorySubjects, setFiliereMandatorySubjects] = useState<FiliereMandatorySubject[]>([]);
  const [filiereFacultativeSubjects, setFiliereFacultativeSubjects] = useState<FiliereFacultativeSubject[]>([]);
  const [filiereChoiceGroups, setFiliereChoiceGroups]       = useState<FiliereChoiceGroup[]>([]);
  const [classFiliereAssignments, setClassFiliereAssignments] = useState<ClassFiliereAssignment[]>([]);
  const [filiereStudentChoices, setFiliereStudentChoices]   = useState<FiliereStudentChoice[]>([]);
  const [niveauDefaultSubjects, setNiveauDefaultSubjects]   = useState<NiveauDefaultSubject[]>([]);
  const [elementaryDefaultLines, setElementaryDefaultLines] = useState<ElementaryDefaultLine[]>([]);
  const [elementaryClassLines, setElementaryClassLines]     = useState<ElementaryClassLine[]>([]);
  const [elementaryGrades, setElementaryGrades]             = useState<ElementaryGrade[]>([]);
  const [elementaryLineSettings, setElementaryLineSettings] = useState<ElementaryLineSetting[]>([]);

  // ── Chargement classes depuis Supabase ─────────────────────────────────────
  // On charge toutes les classes de l'école (les classes ne sont pas liées
  // à une année scolaire — la table `classes` n'a pas de colonne academic_year_id).
  useEffect(() => {
    if (!schoolId) { setClasses([]); return; }
    // Hors connexion, la requête n'aboutirait pas et le voyant de chargement
    // resterait allumé pour toujours : l'instantané prend le relais.
    if (!enLigne) { setClassesLoading(false); return; }
    setClassesLoading(true);
    supabase
      .from('classes')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setClasses(data.map(r => ({
            id:           r.id,
            name:         r.name,
            studentLimit: r.student_limit,
            niveau:       r.niveau ?? undefined,
            createdAt:    new Date(r.created_at ?? Date.now()),
          })));
        }
        setClassesLoading(false);
      });
  }, [schoolId, enLigne]);

  // ── Chargement élèves depuis Supabase ──────────────────────────────────────
  // Table `student_profiles` : données permanentes de l'élève.
  // Table `student_enrollments` : inscription par année scolaire.
  //   - student_profile_id (UUID) → student_profiles.id
  //   - academic_year_label (TEXT "2024-2025") → SchoolYear.id
  useEffect(() => {
    if (!schoolId) {
      setStudentRecords([]);
      setStudentEnrollments([]);
      return;
    }
    if (!enLigne) { setStudentsLoading(false); return; }
    setStudentsLoading(true);

    Promise.all([
      // Tous les profils élèves de l'école — fetchAllRows : au-delà de 1000
      // élèves, un .select('*') direct serait tronqué sans erreur (limite
      // PostgREST par défaut).
      fetchAllRows('student_profiles', q => q
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true })),

      // Toutes les inscriptions de l'école (tous les years)
      fetchAllRows('student_enrollments', q => q.eq('school_id', schoolId)),
    ]).then(([profilesRes, enrollmentsRes]) => {
      if (!profilesRes.error && profilesRes.data) {
        setStudentRecords(profilesRes.data.map(r => ({
          id:       r.id,
          schoolId: r.school_id,
          ...mapStudentProfileRow(r as unknown as Record<string, unknown>),
        })));
      }

      if (!enrollmentsRes.error && enrollmentsRes.data) {
        setStudentEnrollments(enrollmentsRes.data.map(r => ({
          id:               r.id,
          studentProfileId: r.student_profile_id,
          classId:          r.class_id ?? null,
          academicYearLabel: r.academic_year_label,
          enrolledAt:       r.enrolled_at ?? new Date().toISOString(),
        })));
      }

      setStudentsLoading(false);
    });
  }, [schoolId, enLigne]);

  // ── Vue combinée : élèves de l'année courante ──────────────────────────────
  // Filtre les inscriptions dont academicYearLabel correspond à currentYear.id
  // (ex: "2024-2025"), puis joint avec student_profiles.
  const students = useMemo((): Student[] => {
    if (!currentYear) return [];

    const yearEnrollments = studentEnrollments.filter(
      e => e.academicYearLabel === currentYear.id
    );

    return yearEnrollments
      .map(enrollment => {
        const record = studentRecords.find(s => s.id === enrollment.studentProfileId);
        if (!record) return null;
        return {
          id:           enrollment.id,
          studentId:    record.uniqueId,
          firstName:    record.firstName,
          lastName:     record.lastName,
          dateOfBirth:  record.dateOfBirth,
          placeOfBirth: record.placeOfBirth,
          sex:          record.sex,
          phone:        record.phone,
          email:        record.email,
          residence:    record.residence,
          tutor1:       record.tutor1,
          tutor2:       record.tutor2,
          classId:      enrollment.classId,
          createdAt:    new Date(record.createdAt),
          enrolledAt:   enrollment.enrolledAt,
          photoUrl:     record.photoUrl,
        } satisfies Student;
      })
      .filter(Boolean) as Student[];
  }, [currentYear, studentEnrollments, studentRecords]);

  // ── Chargement profs depuis Supabase ──────────────────────────────────────
  // teacher_profiles : données permanentes.
  // teacher_enrollments : contrat par année scolaire (academic_year_label TEXT).
  useEffect(() => {
    if (!schoolId) {
      setTeacherRecords([]);
      setTeacherEnrollmentRecords([]);
      return;
    }
    if (!enLigne) { setTeachersLoading(false); return; }
    setTeachersLoading(true);
    Promise.all([
      fetchAllRows('teacher_profiles', q => q
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true })),
      fetchAllRows('teacher_enrollments', q => q.eq('school_id', schoolId)),
    ]).then(([profilesRes, enrollmentsRes]) => {
      if (!profilesRes.error && profilesRes.data) {
        setTeacherRecords(profilesRes.data.map(r => ({
          id:             r.id,
          schoolId:       r.school_id,
          uniqueId:       r.unique_id,
          firstName:      r.first_name,
          lastName:       r.last_name,
          dateOfBirth:    r.date_of_birth  ?? '',
          placeOfBirth:   r.place_of_birth ?? '',
          sex:            r.sex as 'homme' | 'femme',
          phone:          r.phone           ?? undefined,
          email:          r.email           ?? undefined,
          residence:      r.residence       ?? '',
          diploma:        r.diploma         ?? '',
          emergencyPhone: r.emergency_phone ?? '',
          photoUrl:       r.photo_url       ?? undefined,
          createdAt:      r.created_at      ?? new Date().toISOString(),
        })));
      }
      if (!enrollmentsRes.error && enrollmentsRes.data) {
        setTeacherEnrollmentRecords(enrollmentsRes.data.map(r => ({
          id:               r.id,
          teacherProfileId: r.teacher_profile_id,
          academicYearLabel: r.academic_year_label,
          yearsExperience:  r.years_experience,
          contractType:     r.contract_type as TeacherEnrollmentRecord['contractType'],
          paymentType:      r.payment_type  as TeacherEnrollmentRecord['paymentType'],
          salaryAmount:     Number(r.salary_amount),
          enrolledAt:       r.enrolled_at   ?? new Date().toISOString(),
        })));
      }
      setTeachersLoading(false);
    });
  }, [schoolId, enLigne]);

  // ── Vue combinée : enseignants de l'année courante ─────────────────────────
  // Filtre les enrollments dont academicYearLabel === currentYear.id ("2024-2025").
  const teachers = useMemo((): Teacher[] => {
    if (!currentYear) return [];
    return teacherEnrollmentRecords
      .filter(e => e.academicYearLabel === currentYear.id)
      .map(e => {
        const record = teacherRecords.find(t => t.id === e.teacherProfileId);
        if (!record) return null;
        return {
          id:              e.id,
          teacherId:       record.uniqueId,
          firstName:       record.firstName,
          lastName:        record.lastName,
          dateOfBirth:     record.dateOfBirth,
          placeOfBirth:    record.placeOfBirth,
          sex:             record.sex,
          phone:           record.phone ?? '',
          email:           record.email,
          residence:       record.residence,
          diploma:         record.diploma,
          yearsExperience: e.yearsExperience,
          emergencyPhone:  record.emergencyPhone,
          contractType:    e.contractType,
          paymentType:     e.paymentType,
          salaryAmount:    e.salaryAmount,
          createdAt:       new Date(record.createdAt),
          photoUrl:        record.photoUrl,
        } satisfies Teacher;
      })
      .filter(Boolean) as Teacher[];
  }, [currentYear, teacherEnrollmentRecords, teacherRecords]);

  // ── Chargement données de notes depuis Supabase ────────────────────────────
  // Déclenché à chaque changement d'école ou d'année scolaire.
  // Charge en cascade : périodes → matières → paramètres + notes.
  useEffect(() => {
    if (!schoolId || !currentYear) {
      setGradePeriods([]);
      setPeriodClasses([]);
      setSubjects([]);
      setGradesState([]);
      setSubjectSettings([]);
      return;
    }

    if (!enLigne) { setGradesLoading(false); return; }

    let cancelled = false;
    setGradesLoading(true);

    (async () => {
      // 1. Périodes de l'année courante
      const { data: periodsData } = await supabase
        .from('grade_periods')
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_year_label', currentYear.id)
        .order('ordering', { ascending: true });

      if (cancelled) return;

      const periods: GradePeriod[] = (periodsData ?? []).map(r => ({
        id:                r.id,
        name:              r.name,
        type:              r.type as 'semester' | 'exam',
        academicYearLabel: r.academic_year_label,
        ordering:          r.ordering ?? 0,
        startDate:         r.start_date ?? undefined,
        endDate:           r.end_date ?? undefined,
        createdAt:         new Date(r.created_at),
      }));
      setGradePeriods(periods);

      // Classes concernées par chaque période (par défaut toutes, sauf
      // exclusion manuelle — voir setClassInPeriod).
      const periodIds = periods.map(p => p.id);
      if (periodIds.length > 0) {
        const { data: pcData } = await supabase
          .from('grade_period_classes')
          .select('period_id, class_id')
          .in('period_id', periodIds);
        if (!cancelled) {
          setPeriodClasses((pcData ?? []).map(r => ({ periodId: r.period_id, classId: r.class_id })));
        }
      } else {
        setPeriodClasses([]);
      }

      if (periods.length === 0) {
        setSubjects([]);
        setGradesState([]);
        setSubjectSettings([]);
        setGradesLoading(false);
        return;
      }

      // 2. Matières de ces périodes
      const { data: subjectsData } = await fetchAllRows('subjects', q => q
        .in('period_id', periodIds)
        .order('ordering', { ascending: true }));

      if (cancelled) return;

      const subjectsList: Subject[] = (subjectsData ?? []).map(r => ({
        id:          r.id,
        name:        r.name,
        coefficient: Number(r.coefficient),
        classId:     r.class_id,
        periodId:    r.period_id,
        ordering:    r.ordering ?? 0,
        subjectType: (r.subject_type ?? 'obligatoire') as SubjectType,
        teacherId:   r.teacher_id ?? undefined,
      }));
      setSubjects(subjectsList);

      if (subjectsList.length === 0) {
        setGradesState([]);
        setSubjectSettings([]);
        setGradesLoading(false);
        return;
      }

      // 3. Paramètres matières + paramètres élèves + notes (parallèle)
      // fetchAllRows plutôt que .select('*') direct : PostgREST plafonne
      // silencieusement à 1000 lignes par requête (aucune erreur, juste
      // tronqué) — une grande école dépasse vite ça sur `grades`.
      //
      // Filtré par school_id (indexé) plutôt que `.in('subject_id', subjectIds)` :
      // avec 400+ matières (école de grande taille, plusieurs périodes), la liste
      // IN générait une URL énorme qui ne revenait jamais (requête qui reste
      // indéfiniment en attente côté PostgREST) — la page restait bloquée à 0%
      // sans erreur visible. On filtre ensuite côté client sur l'année courante.
      const subjectIds = subjectsList.map(s => s.id);
      const subjectIdSet = new Set(subjectIds);
      const [ssRes, sssRes, gradesRes] = await Promise.all([
        fetchAllRows('subject_settings', q => q.eq('school_id', schoolId)),
        fetchAllRows('student_subject_settings', q => q.eq('school_id', schoolId)),
        fetchAllRows('grades', q => q.eq('school_id', schoolId)),
      ]);
      ssRes.data = (ssRes.data ?? []).filter((r: { subject_id: string }) => subjectIdSet.has(r.subject_id));
      sssRes.data = (sssRes.data ?? []).filter((r: { subject_id: string }) => subjectIdSet.has(r.subject_id));
      gradesRes.data = (gradesRes.data ?? []).filter((r: { subject_id: string }) => subjectIdSet.has(r.subject_id));

      if (cancelled) return;

      // Construire SubjectSettingsData avec studentSettings embarqués
      const settingsMap = new Map<string, SubjectSettingsData>();

      for (const r of (ssRes.data ?? [])) {
        settingsMap.set(r.subject_id, {
          id:              r.id,
          subjectId:       r.subject_id,
          devoir1Active:   r.devoir1_active,
          devoir2Active:   r.devoir2_active,
          devoir3Active:   r.devoir3_active,
          devoir4Active:   r.devoir4_active,
          devoir5Active:   r.devoir5_active,
          studentSettings: {},
        });
      }

      for (const r of (sssRes.data ?? [])) {
        if (!settingsMap.has(r.subject_id)) {
          settingsMap.set(r.subject_id, {
            id: '', subjectId: r.subject_id,
            devoir1Active: true, devoir2Active: true, devoir3Active: true,
            devoir4Active: false, devoir5Active: false,
            studentSettings: {},
          });
        }
        const ss = settingsMap.get(r.subject_id)!;
        ss.studentSettings[r.student_enrollment_id] = {
          active:         r.active,
          customCoef:     r.custom_coefficient != null ? String(r.custom_coefficient) : '',
          overrideReason: r.override_reason ?? undefined,
        };
      }

      setSubjectSettings(Array.from(settingsMap.values()));

      // Notes
      const gradesList: Grade[] = (gradesRes.data ?? []).map(r => ({
        id:                   r.id,
        studentEnrollmentId:  r.student_enrollment_id,
        subjectId:            r.subject_id,
        devoir1:      r.devoir1      != null ? Number(r.devoir1)      : undefined,
        devoir2:      r.devoir2      != null ? Number(r.devoir2)      : undefined,
        devoir3:      r.devoir3      != null ? Number(r.devoir3)      : undefined,
        devoir4:      r.devoir4      != null ? Number(r.devoir4)      : undefined,
        devoir5:      r.devoir5      != null ? Number(r.devoir5)      : undefined,
        composition:  r.composition  != null ? Number(r.composition)  : undefined,
        note:         r.note         != null ? Number(r.note)         : undefined,
      }));
      setGradesState(gradesList);
      setGradesLoading(false);
    })();

    return () => { cancelled = true; };
  }, [schoolId, currentYear?.id, enLigne]);

  // ── Chargement filières (modèles + assignation/choix de l'année courante) ──
  useEffect(() => {
    if (!schoolId) {
      setFilieres([]);
      setFiliereMandatorySubjects([]);
      setFiliereFacultativeSubjects([]);
      setFiliereChoiceGroups([]);
      setClassFiliereAssignments([]);
      setFiliereStudentChoices([]);
      setNiveauDefaultSubjects([]);
      return;
    }
    if (!enLigne) return;

    let cancelled = false;

    (async () => {
      const [fRes, msRes, ffsRes, cgRes, coRes, ndRes] = await Promise.all([
        supabase.from('filieres').select('*').eq('school_id', schoolId),
        supabase.from('filiere_mandatory_subjects').select('*').eq('school_id', schoolId).order('ordering'),
        supabase.from('filiere_facultative_subjects').select('*').eq('school_id', schoolId).order('ordering'),
        supabase.from('filiere_choice_groups').select('*').eq('school_id', schoolId).order('ordering'),
        supabase.from('filiere_choice_options').select('*').eq('school_id', schoolId).order('ordering'),
        supabase.from('niveau_default_subjects').select('*').eq('school_id', schoolId).order('ordering'),
      ]);
      if (cancelled) return;

      // Première connexion admin d'une école neuve → on pré-remplit les matières
      // par défaut du collège (liées au NIVEAU, pas des filières) et les filières
      // scientifiques de lycée (S/S1/S2, programme fixe). Tout reste éditable/
      // supprimable ensuite. Best-effort : échoue silencieusement pour un compte
      // non-admin (RLS l'empêche de toute façon).
      // `length === 0` ne veut PAS dire « école neuve » quand l'abonnement
      // bloque l'accès : les policies renvoient une liste vide. Amorcer ici
      // déclencherait une rafale d'INSERT tous refusés (403), lente et inutile.
      if ((ndRes.data ?? []).length === 0 && accountRole === 'admin' && !isSchoolAccessBlocked) {
        try {
          await supabase.from('niveau_default_subjects').insert(
            DEFAULT_NIVEAU_SUBJECTS.map((s, i) => ({
              school_id: schoolId, niveau: s.niveau, name: s.name, coefficient: s.coefficient, ordering: i,
            }))
          );
          const ndRes2 = await supabase.from('niveau_default_subjects').select('*').eq('school_id', schoolId).order('ordering');
          ndRes.data = ndRes2.data;
        } catch { /* non-bloquant */ }
      }
      if ((fRes.data ?? []).length === 0 && accountRole === 'admin' && !isSchoolAccessBlocked) {
        try {
          for (const tpl of DEFAULT_FILIERE_TEMPLATES) {
            const { data: fRow, error: fErr } = await supabase
              .from('filieres')
              .insert({ school_id: schoolId, name: tpl.name, description: tpl.description, niveaux: tpl.niveaux })
              .select().single();
            if (fErr || !fRow) continue;
            await supabase.from('filiere_mandatory_subjects').insert(
              tpl.subjects.map((s, i) => ({
                school_id: schoolId, filiere_id: fRow.id, niveau: s.niveau, name: s.name, coefficient: s.coefficient, ordering: i,
              }))
            );
            if (tpl.facultativeSubjects?.length) {
              await supabase.from('filiere_facultative_subjects').insert(
                tpl.facultativeSubjects.map((s, i) => ({
                  school_id: schoolId, filiere_id: fRow.id, niveau: s.niveau, name: s.name, coefficient: s.coefficient, ordering: i,
                }))
              );
            }
            for (const g of tpl.choiceGroups ?? []) {
              const { data: gRow, error: gErr } = await supabase
                .from('filiere_choice_groups')
                .insert({ school_id: schoolId, filiere_id: fRow.id, niveau: g.niveau, label: g.label, coefficient: g.coefficient, ordering: 0 })
                .select().single();
              if (gErr || !gRow) continue;
              await supabase.from('filiere_choice_options').insert(
                g.options.map((name, i) => ({ school_id: schoolId, choice_group_id: gRow.id, subject_name: name, ordering: i }))
              );
            }
          }
          const [fRes2, msRes2, ffsRes2, cgRes2, coRes2] = await Promise.all([
            supabase.from('filieres').select('*').eq('school_id', schoolId),
            supabase.from('filiere_mandatory_subjects').select('*').eq('school_id', schoolId).order('ordering'),
            supabase.from('filiere_facultative_subjects').select('*').eq('school_id', schoolId).order('ordering'),
            supabase.from('filiere_choice_groups').select('*').eq('school_id', schoolId).order('ordering'),
            supabase.from('filiere_choice_options').select('*').eq('school_id', schoolId).order('ordering'),
          ]);
          fRes.data = fRes2.data; msRes.data = msRes2.data; ffsRes.data = ffsRes2.data; cgRes.data = cgRes2.data; coRes.data = coRes2.data;
        } catch { /* non-bloquant */ }
      }

      setNiveauDefaultSubjects((ndRes.data ?? []).map(r => ({
        id: r.id, niveau: r.niveau, name: r.name, coefficient: Number(r.coefficient), ordering: r.ordering ?? 0,
        isFacultative: r.is_facultative ?? false,
      })));

      setFilieres((fRes.data ?? []).map(r => ({ id: r.id, name: r.name, description: r.description ?? undefined, niveaux: r.niveaux ?? [] })));
      setFiliereMandatorySubjects((msRes.data ?? []).map(r => ({
        id: r.id, filiereId: r.filiere_id, niveau: r.niveau, name: r.name,
        coefficient: Number(r.coefficient), ordering: r.ordering ?? 0,
      })));
      setFiliereFacultativeSubjects((ffsRes.data ?? []).map(r => ({
        id: r.id, filiereId: r.filiere_id, niveau: r.niveau, name: r.name,
        coefficient: Number(r.coefficient), ordering: r.ordering ?? 0,
      })));

      const optionsByGroup = new Map<string, FiliereChoiceOption[]>();
      for (const r of (coRes.data ?? [])) {
        const opt: FiliereChoiceOption = { id: r.id, choiceGroupId: r.choice_group_id, subjectName: r.subject_name, ordering: r.ordering ?? 0 };
        if (!optionsByGroup.has(r.choice_group_id)) optionsByGroup.set(r.choice_group_id, []);
        optionsByGroup.get(r.choice_group_id)!.push(opt);
      }
      setFiliereChoiceGroups((cgRes.data ?? []).map(r => ({
        id: r.id, filiereId: r.filiere_id, niveau: r.niveau, label: r.label,
        coefficient: Number(r.coefficient), ordering: r.ordering ?? 0,
        options: optionsByGroup.get(r.id) ?? [],
      })));

      if (!currentYear) {
        setClassFiliereAssignments([]);
        setFiliereStudentChoices([]);
        return;
      }

      const { data: assignData } = await supabase
        .from('class_filiere_assignments').select('*')
        .eq('school_id', schoolId).eq('academic_year_label', currentYear.id);
      if (cancelled) return;

      const assignments: ClassFiliereAssignment[] = (assignData ?? []).map(r => ({
        id: r.id, classId: r.class_id, academicYearLabel: r.academic_year_label, filiereId: r.filiere_id,
      }));
      setClassFiliereAssignments(assignments);

      if (assignments.length === 0) { setFiliereStudentChoices([]); return; }

      const { data: choicesData } = await supabase
        .from('filiere_student_choices').select('*')
        .in('class_filiere_assignment_id', assignments.map(a => a.id));
      if (cancelled) return;

      setFiliereStudentChoices((choicesData ?? []).map(r => ({
        id: r.id, classFiliereAssignmentId: r.class_filiere_assignment_id, choiceGroupId: r.choice_group_id,
        studentEnrollmentId: r.student_enrollment_id, chosenSubjectName: r.chosen_subject_name, chosenBy: r.chosen_by,
      })));
    })();

    return () => { cancelled = true; };
  }, [schoolId, currentYear?.id, accountRole, isSchoolAccessBlocked, enLigne]);

  // ── Chargement élémentaire (CI-CM2) — catalogue de barèmes + lignes matérialisées ──
  useEffect(() => {
    if (!schoolId) {
      setElementaryDefaultLines([]);
      setElementaryClassLines([]);
      setElementaryGrades([]);
      setElementaryLineSettings([]);
      return;
    }
    if (!enLigne) return;

    let cancelled = false;

    (async () => {
      const [dRes, cRes, gRes, sRes] = await Promise.all([
        sbElementary.from('elementary_default_lines').select('*').eq('school_id', schoolId).order('ordering'),
        fetchAllRows('elementary_class_lines', q => q.eq('school_id', schoolId).order('ordering')),
        fetchAllRows('elementary_grades', q => q.eq('school_id', schoolId)),
        fetchAllRows('elementary_student_line_settings', q => q.eq('school_id', schoolId)),
      ]);
      if (cancelled) return;

      // Première fois pour cette école : pré-remplir le catalogue élémentaire
      // (barèmes officiels + catalogue optionnel), entièrement modifiable ensuite.
      // Ne se déclenche QUE si le select a vraiment réussi avec 0 ligne — pas
      // sur une erreur (ex: cache de schéma PostgREST pas encore à jour juste
      // après une migration), pour éviter une tentative de ré-insertion en
      // doublon (409) qui écraserait ensuite l'état avec une liste vide.
      if (!dRes.error && (dRes.data ?? []).length === 0 && accountRole === 'admin' && !isSchoolAccessBlocked) {
        try {
          const seed = [...ELEMENTARY_DEFAULT_LINES, ...ELEMENTARY_OPTIONAL_CATALOG];
          await sbElementary.from('elementary_default_lines').insert(
            seed.map(s => ({
              school_id: schoolId, niveau: s.niveau, domaine: s.domaine, registre: s.registre,
              name: s.name, point_max: s.pointMax, ordering: s.ordering,
              is_optional: s.isOptional ?? false, is_active_by_default: s.isActiveByDefault ?? true,
            }))
          );
          const dRes2 = await sbElementary.from('elementary_default_lines').select('*').eq('school_id', schoolId).order('ordering');
          dRes.data = dRes2.data;
        } catch { /* non-bloquant */ }
      }

      setElementaryDefaultLines((dRes.data ?? []).map(r => ({
        id: r.id, niveau: r.niveau, domaine: r.domaine, registre: r.registre,
        name: r.name, pointMax: Number(r.point_max), ordering: r.ordering ?? 0,
        isOptional: r.is_optional ?? false, isActiveByDefault: r.is_active_by_default ?? true,
      })));

      setElementaryClassLines((cRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string, classId: r.class_id as string, periodId: r.period_id as string,
        domaine: r.domaine as ElementaryDomaine, registre: r.registre as ElementaryRegistre,
        name: r.name as string, pointMax: Number(r.point_max), ordering: (r.ordering as number) ?? 0,
        teacherId: (r.teacher_id as string | null) ?? undefined,
      })));

      setElementaryGrades((gRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string, lineId: r.line_id as string, studentEnrollmentId: r.student_enrollment_id as string,
        pointsObtenus: r.points_obtenus != null ? Number(r.points_obtenus) : undefined,
      })));

      setElementaryLineSettings((sRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string, lineId: r.line_id as string, studentEnrollmentId: r.student_enrollment_id as string,
        active: r.active as boolean, overrideReason: (r.override_reason as string | null) ?? undefined,
      })));
    })();

    return () => { cancelled = true; };
  }, [schoolId, accountRole, isSchoolAccessBlocked, enLigne]);

  // ── Instantané hors connexion ──────────────────────────────────────────────
  // Les écrans de l'école lisent ce contexte, jamais Supabase directement :
  // garder ces tranches suffit à rendre tout le tableau de bord consultable
  // sans réseau. Rien ne s'y enregistre hors connexion — la consultation seule
  // est possible.
  const tranchesHorsLigne = useMemo(() => ({
    classes, studentRecords, studentEnrollments,
    teacherRecords, teacherEnrollmentRecords,
    gradePeriods, periodClasses, subjects, gradesState, subjectSettings,
    filieres, filiereMandatorySubjects, filiereFacultativeSubjects,
    filiereChoiceGroups, classFiliereAssignments, filiereStudentChoices,
    niveauDefaultSubjects,
    elementaryDefaultLines, elementaryClassLines, elementaryGrades, elementaryLineSettings,
  }), [
    classes, studentRecords, studentEnrollments,
    teacherRecords, teacherEnrollmentRecords,
    gradePeriods, periodClasses, subjects, gradesState, subjectSettings,
    filieres, filiereMandatorySubjects, filiereFacultativeSubjects,
    filiereChoiceGroups, classFiliereAssignments, filiereStudentChoices,
    niveauDefaultSubjects,
    elementaryDefaultLines, elementaryClassLines, elementaryGrades, elementaryLineSettings,
  ]);

  const appliquerInstantane = useCallback((t: typeof tranchesHorsLigne) => {
    setClasses(t.classes);
    setStudentRecords(t.studentRecords);
    setStudentEnrollments(t.studentEnrollments);
    setTeacherRecords(t.teacherRecords);
    setTeacherEnrollmentRecords(t.teacherEnrollmentRecords);
    setGradePeriods(t.gradePeriods);
    setPeriodClasses(t.periodClasses);
    setSubjects(t.subjects);
    setGradesState(t.gradesState);
    setSubjectSettings(t.subjectSettings);
    setFilieres(t.filieres);
    setFiliereMandatorySubjects(t.filiereMandatorySubjects);
    setFiliereFacultativeSubjects(t.filiereFacultativeSubjects);
    setFiliereChoiceGroups(t.filiereChoiceGroups);
    setClassFiliereAssignments(t.classFiliereAssignments);
    setFiliereStudentChoices(t.filiereStudentChoices);
    setNiveauDefaultSubjects(t.niveauDefaultSubjects);
    setElementaryDefaultLines(t.elementaryDefaultLines);
    setElementaryClassLines(t.elementaryClassLines);
    setElementaryGrades(t.elementaryGrades);
    setElementaryLineSettings(t.elementaryLineSettings);
  }, []);

  // `pret` : on n'enregistre qu'une fois tout chargé, sinon l'état vide du
  // démarrage remplacerait un bon instantané par un tableau de bord désert.
  const instantaneLe = useInstantaneHorsLigne(
    'ecole-instantane',
    tranchesHorsLigne,
    appliquerInstantane,
    !!schoolId && !classesLoading && !studentsLoading && !teachersLoading && !gradesLoading,
  );


  // ─────────────────────────────────────────────────────────────────────────
  // CLASSES — fonctions Supabase
  // Note : la table `classes` n'a pas de colonne academic_year_id.
  // ─────────────────────────────────────────────────────────────────────────

  const addClass = useCallback(async (data: { name: string; studentLimit: number; niveau?: string }): Promise<SchoolClass> => {
    if (!schoolId) throw new Error('Non connecté à une école');

    const { data: row, error } = await supabase
      .from('classes')
      .insert({
        school_id:     schoolId,
        name:          data.name,
        student_limit: data.studentLimit,
        niveau:        data.niveau ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    const newClass: SchoolClass = {
      id:           row.id,
      name:         row.name,
      studentLimit: row.student_limit,
      niveau:       row.niveau ?? undefined,
      createdAt:    new Date(row.created_at ?? Date.now()),
    };
    setClasses(prev => [...prev, newClass]);

    // Par défaut, une nouvelle classe est concernée par toutes les périodes
    // déjà créées pour l'année en cours (personnalisable ensuite).
    if (gradePeriods.length > 0) {
      const { error: pcError } = await supabase
        .from('grade_period_classes')
        .insert(gradePeriods.map(p => ({ school_id: schoolId, period_id: p.id, class_id: newClass.id })));
      if (pcError) console.error('Erreur association période/nouvelle classe:', pcError);
      else setPeriodClasses(prev => [...prev, ...gradePeriods.map(p => ({ periodId: p.id, classId: newClass.id }))]);
    }

    return newClass;
  }, [schoolId, gradePeriods]);

  const updateClass = useCallback(async (id: string, data: { name: string; studentLimit: number; niveau?: string }): Promise<void> => {
    if (!schoolId) throw new Error('Non connecté à une école');

    const { error } = await supabase
      .from('classes')
      .update({
        name:          data.name,
        student_limit: data.studentLimit,
        niveau:        data.niveau ?? null,
      })
      .eq('id', id)
      .eq('school_id', schoolId);

    if (error) throw error;

    setClasses(prev => prev.map(c => c.id === id
      ? { ...c, name: data.name, studentLimit: data.studentLimit, niveau: data.niveau }
      : c));
  }, [schoolId]);

  const deleteClass = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);
    if (error) throw error;
    setClasses(prev => prev.filter(c => c.id !== id));
  }, [schoolId]);

  const getStudentCountByClass = useCallback(
    (classId: string): number => students.filter(s => s.classId === classId).length,
    [students],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ÉLÈVES — fonctions Supabase
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Génère un identifiant métier prévisuel côté client (aperçu UI uniquement).
   * L'identifiant définitif est généré par la fonction PostgreSQL
   * generate_student_unique_id(p_school_id) lors de l'insertion en DB.
   */
  const generateStudentId = useCallback((): string => {
    const schoolStudents = studentRecords.filter(s => s.schoolId === schoolId);
    return buildStudentUniqueIdPreview(schoolStudents.length);
  }, [studentRecords, schoolId]);

  const findStudentByUniqueId = useCallback(
    (uniqueId: string): StudentRecord | undefined =>
      studentRecords.find(s => s.uniqueId === uniqueId),
    [studentRecords],
  );

  // Matérialise UN élève déjà inscrit dans sa classe (crée les lignes
  // `student_subject_settings` manquantes pour les matières au choix/
  // facultatives déjà matérialisées au niveau classe). Corrige le cas d'un
  // élève qui rejoint une classe APRÈS que sa filière a été assignée — sans
  // cela, il serait compté "actif" par défaut dans toutes les options à la
  // fois. Best-effort, jamais bloquant pour l'inscription elle-même.
  const materializeStudentSubjects = useCallback(async (studentEnrollmentId: string): Promise<void> => {
    try {
      const { error } = await supabase.rpc('materialize_student_subjects', {
        p_student_enrollment_id: studentEnrollmentId,
      });
      if (error) console.error('Erreur matérialisation élève:', error);
    } catch (err) {
      console.error('Erreur matérialisation élève:', err);
    }
  }, []);

  const addStudent = useCallback(async (
    studentData: Omit<Student, 'id' | 'studentId' | 'createdAt' | 'enrolledAt'>
  ): Promise<Student> => {
    if (!schoolId)    throw new Error('Non connecté à une école');
    if (!currentYear) throw new Error('Aucune année scolaire sélectionnée');

    // 1. Générer l'identifiant métier via la fonction SECURITY DEFINER Supabase.
    //    Elle garantit l'unicité même en cas d'insertions concurrentes.
    const { data: generatedUniqueId, error: rpcError } = await supabase
      .rpc('generate_student_unique_id', { p_school_id: schoolId });

    const studentUniqueId: string = (!rpcError && generatedUniqueId)
      ? String(generatedUniqueId)
      : generateStudentId(); // fallback client-side si la RPC échoue

    // 2. Insertion dans student_profiles (données permanentes de l'élève)
    const { data: profileRow, error: profileError } = await supabase
      .from('student_profiles')
      .insert({
        school_id:        schoolId,
        unique_id:        studentUniqueId,
        first_name:       studentData.firstName,
        last_name:        studentData.lastName,
        date_of_birth:    studentData.dateOfBirth,
        place_of_birth:   studentData.placeOfBirth,
        sex:              studentData.sex,
        phone:            studentData.phone    ?? null,
        email:            studentData.email    ?? null,
        residence:        studentData.residence,
        photo_url:        studentData.photoUrl ?? null,
        // Tuteurs — colonnes séparées (pas de JSON tutor_info)
        tutor1_full_name: studentData.tutor1.fullName ?? null,
        tutor1_phone:     studentData.tutor1.phone,
        tutor1_status:    studentData.tutor1.status,
        tutor1_email:     studentData.tutor1.email    ?? null,
        tutor2_full_name: studentData.tutor2?.fullName ?? null,
        tutor2_phone:     studentData.tutor2?.phone    ?? null,
        tutor2_status:    studentData.tutor2?.status   ?? null,
        tutor2_email:     studentData.tutor2?.email    ?? null,
      })
      .select()
      .single();

    if (profileError) throw profileError;

    // 3. Inscription dans student_enrollments (lien élève × année × classe)
    //    academic_year_label est le TEXT "2024-2025" (= SchoolYear.id)
    const { data: enrollmentRow, error: enrollmentError } = await supabase
      .from('student_enrollments')
      .insert({
        school_id:           schoolId,
        student_profile_id:  profileRow.id,
        academic_year_label: currentYear.id,   // TEXT ex: "2024-2025"
        class_id:            studentData.classId ?? null,
        status:              'active',
      })
      .select()
      .single();

    if (enrollmentError) throw enrollmentError;

    // 4. Mise à jour du state local (optimistic)
    const newRecord: StudentRecord = {
      id:           profileRow.id,
      schoolId,
      uniqueId:     studentUniqueId,
      firstName:    studentData.firstName,
      lastName:     studentData.lastName,
      dateOfBirth:  studentData.dateOfBirth,
      placeOfBirth: studentData.placeOfBirth,
      sex:          studentData.sex,
      phone:        studentData.phone,
      email:        studentData.email,
      residence:    studentData.residence,
      tutor1:       studentData.tutor1,
      tutor2:       studentData.tutor2,
      photoUrl:     studentData.photoUrl,
      createdAt:    profileRow.created_at ?? new Date().toISOString(),
    };

    const newEnrollment: StudentEnrollment = {
      id:               enrollmentRow.id,
      studentProfileId: profileRow.id,
      classId:          studentData.classId ?? null,
      academicYearLabel: currentYear.id,
      enrolledAt:       enrollmentRow.enrolled_at ?? new Date().toISOString(),
    };

    setStudentRecords(prev => [...prev, newRecord]);
    setStudentEnrollments(prev => [...prev, newEnrollment]);

    // 5. Matérialiser cet élève dans sa classe (matières au choix/facultatives
    //    déjà assignées) — best-effort (n'échoue jamais l'inscription), mais
    //    ATTENDU : un choix de matière peut être résolu juste après par
    //    l'appelant, et doit trouver la ligne placeholder déjà en place.
    if (studentData.classId) await materializeStudentSubjects(enrollmentRow.id);

    // 6. Créer le compte de connexion (fire-and-forget, non bloquant)
    const className = studentData.classId
      ? classes.find(c => c.id === studentData.classId)?.name ?? ''
      : '';
    createStudentAccount({
      enrollmentId: enrollmentRow.id,
      firstName:    studentData.firstName,
      lastName:     studentData.lastName,
      displayId:    studentUniqueId,
      className,
      schoolId:     schoolId!,
      schoolName:   school?.name ?? '',
    }).catch(() => { /* compte créé en arrière-plan, échec silencieux */ });

    return {
      id:           enrollmentRow.id,
      studentId:    studentUniqueId,
      firstName:    studentData.firstName,
      lastName:     studentData.lastName,
      dateOfBirth:  studentData.dateOfBirth,
      placeOfBirth: studentData.placeOfBirth,
      sex:          studentData.sex,
      phone:        studentData.phone,
      email:        studentData.email,
      residence:    studentData.residence,
      tutor1:       studentData.tutor1,
      tutor2:       studentData.tutor2,
      classId:      studentData.classId ?? null,
      createdAt:    new Date(profileRow.created_at ?? Date.now()),
      enrolledAt:   enrollmentRow.enrolled_at ?? new Date().toISOString(),
      photoUrl:     studentData.photoUrl,
    };
  }, [schoolId, currentYear, generateStudentId, classes, school, materializeStudentSubjects]);

  const updateStudent = useCallback(async (id: string, updates: Partial<Student>): Promise<void> => {
    // `id` = enrollment UUID → trouver le studentRecord correspondant
    const enrollment = studentEnrollments.find(e => e.id === id);
    if (!enrollment) return;

    // Mettre à jour la classe dans student_enrollments
    if (updates.classId !== undefined && updates.classId !== enrollment.classId) {
      await supabase
        .from('student_enrollments')
        .update({ class_id: updates.classId ?? null })
        .eq('id', id);
      setStudentEnrollments(prev =>
        prev.map(e => e.id === id ? { ...e, classId: updates.classId ?? e.classId } : e)
      );
      // Nouvelle classe → matérialiser les matières au choix/facultatives pour cet élève.
      if (updates.classId) await materializeStudentSubjects(id);
    }

    // Mettre à jour les données personnelles dans student_profiles
    const profileUpdates: Record<string, unknown> = {};
    if (updates.firstName    != null) profileUpdates.first_name    = updates.firstName;
    if (updates.lastName     != null) profileUpdates.last_name     = updates.lastName;
    if (updates.dateOfBirth  != null) profileUpdates.date_of_birth = updates.dateOfBirth;
    if (updates.placeOfBirth != null) profileUpdates.place_of_birth = updates.placeOfBirth;
    if (updates.sex          != null) profileUpdates.sex           = updates.sex;
    if (updates.phone        !== undefined) profileUpdates.phone   = updates.phone ?? null;
    if (updates.email        !== undefined) profileUpdates.email   = updates.email ?? null;
    if (updates.residence    != null) profileUpdates.residence     = updates.residence;

    if (Object.keys(profileUpdates).length > 0) {
      await supabase
        .from('student_profiles')
        .update(profileUpdates)
        .eq('id', enrollment.studentProfileId);

      setStudentRecords(prev =>
        prev.map(r =>
          r.id === enrollment.studentProfileId
            ? {
                ...r,
                firstName:    updates.firstName    ?? r.firstName,
                lastName:     updates.lastName     ?? r.lastName,
                dateOfBirth:  updates.dateOfBirth  ?? r.dateOfBirth,
                placeOfBirth: updates.placeOfBirth ?? r.placeOfBirth,
                sex:          updates.sex          ?? r.sex,
                phone:        updates.phone        ?? r.phone,
                email:        updates.email        ?? r.email,
                residence:    updates.residence    ?? r.residence,
              }
            : r
        )
      );
    }
  }, [studentEnrollments, materializeStudentSubjects]);

  const reEnrollStudent = useCallback(async (
    uniqueId: string,
    classId: string | null,
  ): Promise<Student | null> => {
    if (!schoolId || !currentYear) return null;

    const record = findStudentByUniqueId(uniqueId);
    if (!record) return null;

    // Vérifier si l'élève est déjà inscrit pour cette année scolaire
    const alreadyEnrolled = studentEnrollments.some(
      e => e.studentProfileId === record.id && e.academicYearLabel === currentYear.id
    );
    if (alreadyEnrolled) return null;

    const { data: row, error } = await supabase
      .from('student_enrollments')
      .insert({
        school_id:           schoolId,
        student_profile_id:  record.id,
        academic_year_label: currentYear.id,   // TEXT "2024-2025"
        class_id:            classId ?? null,
        status:              'active',
      })
      .select()
      .single();

    if (error) throw error;

    const newEnrollment: StudentEnrollment = {
      id:               row.id,
      studentProfileId: record.id,
      classId:          classId ?? null,
      academicYearLabel: currentYear.id,
      enrolledAt:       row.enrolled_at ?? new Date().toISOString(),
    };
    setStudentEnrollments(prev => [...prev, newEnrollment]);
    if (classId) await materializeStudentSubjects(row.id);

    return {
      id:           row.id,
      studentId:    record.uniqueId,
      firstName:    record.firstName,
      lastName:     record.lastName,
      dateOfBirth:  record.dateOfBirth,
      placeOfBirth: record.placeOfBirth,
      sex:          record.sex,
      phone:        record.phone,
      email:        record.email,
      residence:    record.residence,
      tutor1:       record.tutor1,
      tutor2:       record.tutor2,
      classId:      classId ?? null,
      createdAt:    new Date(record.createdAt),
      enrolledAt:   newEnrollment.enrolledAt,
      photoUrl:     record.photoUrl,
    };
  }, [schoolId, currentYear, findStudentByUniqueId, studentEnrollments, materializeStudentSubjects]);

  // ─────────────────────────────────────────────────────────────────────────
  // ENSEIGNANTS — Supabase (teacher_profiles + teacher_enrollments)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Génère un identifiant prévisuel côté client (aperçu UI uniquement).
   * L'identifiant définitif est généré par la RPC generate_teacher_unique_id()
   * lors de l'insertion en DB.
   */
  const generateTeacherId = useCallback((): string => {
    const year  = new Date().getFullYear();
    const count = teacherRecords.filter(t => t.schoolId === schoolId).length;
    return `PROF-${year}-${String(count + 1).padStart(5, '0')}`;
  }, [teacherRecords, schoolId]);

  const findTeacherByUniqueId = useCallback(
    (uniqueId: string): TeacherRecord | undefined =>
      teacherRecords.find(t => t.uniqueId === uniqueId),
    [teacherRecords],
  );

  const addTeacher = useCallback(async (
    data: Omit<Teacher, 'id' | 'teacherId' | 'createdAt'>
  ): Promise<Teacher> => {
    if (!schoolId)    throw new Error('Non connecté à une école');
    if (!currentYear) throw new Error('Aucune année scolaire sélectionnée');

    // 1. Identifiant unique via RPC SECURITY DEFINER
    const { data: generatedUniqueId, error: rpcError } = await supabase
      .rpc('generate_teacher_unique_id', { p_school_id: schoolId });
    const teacherUniqueId: string = (!rpcError && generatedUniqueId)
      ? String(generatedUniqueId)
      : generateTeacherId(); // fallback client-side

    // 2. Insertion dans teacher_profiles (données permanentes)
    const { data: profileRow, error: profileError } = await supabase
      .from('teacher_profiles')
      .insert({
        school_id:       schoolId,
        unique_id:       teacherUniqueId,
        first_name:      data.firstName,
        last_name:       data.lastName,
        date_of_birth:   data.dateOfBirth   || null,
        place_of_birth:  data.placeOfBirth  || null,
        sex:             data.sex,
        phone:           data.phone         || null,
        email:           data.email         || null,
        residence:       data.residence     || null,
        diploma:         data.diploma       || null,
        emergency_phone: data.emergencyPhone || null,
        photo_url:       data.photoUrl      || null,
      })
      .select()
      .single();
    if (profileError) throw profileError;

    // 3. Insertion dans teacher_enrollments (contrat pour cette année)
    const { data: enrollmentRow, error: enrollmentError } = await supabase
      .from('teacher_enrollments')
      .insert({
        school_id:           schoolId,
        teacher_profile_id:  profileRow.id,
        academic_year_label: currentYear.id,  // TEXT "2024-2025"
        years_experience:    data.yearsExperience,
        contract_type:       data.contractType,
        payment_type:        data.paymentType,
        salary_amount:       data.salaryAmount,
        status:              'active',
      })
      .select()
      .single();
    if (enrollmentError) throw enrollmentError;

    // 4. Mise à jour optimiste du state
    const newRecord: TeacherRecord = {
      id: profileRow.id, schoolId,
      uniqueId:       teacherUniqueId,
      firstName:      data.firstName,
      lastName:       data.lastName,
      dateOfBirth:    data.dateOfBirth,
      placeOfBirth:   data.placeOfBirth,
      sex:            data.sex,
      phone:          data.phone,
      email:          data.email,
      residence:      data.residence,
      diploma:        data.diploma,
      emergencyPhone: data.emergencyPhone,
      photoUrl:       data.photoUrl,
      createdAt:      profileRow.created_at ?? new Date().toISOString(),
    };
    const newEnrollment: TeacherEnrollmentRecord = {
      id:               enrollmentRow.id,
      teacherProfileId: profileRow.id,
      academicYearLabel: currentYear.id,
      yearsExperience:  data.yearsExperience,
      contractType:     data.contractType,
      paymentType:      data.paymentType,
      salaryAmount:     data.salaryAmount,
      enrolledAt:       enrollmentRow.enrolled_at ?? new Date().toISOString(),
    };
    setTeacherRecords(prev => [...prev, newRecord]);
    setTeacherEnrollmentRecords(prev => [...prev, newEnrollment]);

    // 5. Créer le compte de connexion (fire-and-forget, non bloquant)
    createTeacherAccount({
      enrollmentId: enrollmentRow.id,
      firstName:    data.firstName,
      lastName:     data.lastName,
      displayId:    teacherUniqueId,
      schoolId:     schoolId!,
      schoolName:   school?.name ?? '',
    }).catch(() => { /* compte créé en arrière-plan, échec silencieux */ });

    return {
      id:              enrollmentRow.id,
      teacherId:       teacherUniqueId,
      firstName:       data.firstName,
      lastName:        data.lastName,
      dateOfBirth:     data.dateOfBirth,
      placeOfBirth:    data.placeOfBirth,
      sex:             data.sex,
      phone:           data.phone ?? '',
      email:           data.email,
      residence:       data.residence,
      diploma:         data.diploma,
      yearsExperience: data.yearsExperience,
      emergencyPhone:  data.emergencyPhone,
      contractType:    data.contractType,
      paymentType:     data.paymentType,
      salaryAmount:    data.salaryAmount,
      createdAt:       new Date(profileRow.created_at ?? Date.now()),
      photoUrl:        data.photoUrl,
    };
  }, [schoolId, currentYear, generateTeacherId, school]);

  const reEnrollTeacher = useCallback(async (
    uniqueId: string,
    data: Pick<TeacherEnrollmentRecord, 'yearsExperience' | 'contractType' | 'paymentType' | 'salaryAmount'>
  ): Promise<Teacher | null> => {
    if (!schoolId || !currentYear) return null;
    const record = findTeacherByUniqueId(uniqueId);
    if (!record) return null;

    // Vérifier si déjà inscrit cette année
    const alreadyEnrolled = teacherEnrollmentRecords.some(
      e => e.teacherProfileId === record.id && e.academicYearLabel === currentYear.id
    );
    if (alreadyEnrolled) return null;

    const { data: enrollmentRow, error } = await supabase
      .from('teacher_enrollments')
      .insert({
        school_id:           schoolId,
        teacher_profile_id:  record.id,
        academic_year_label: currentYear.id,
        years_experience:    data.yearsExperience,
        contract_type:       data.contractType,
        payment_type:        data.paymentType,
        salary_amount:       data.salaryAmount,
        status:              'active',
      })
      .select()
      .single();
    if (error) throw error;

    const newEnrollment: TeacherEnrollmentRecord = {
      id:               enrollmentRow.id,
      teacherProfileId: record.id,
      academicYearLabel: currentYear.id,
      ...data,
      enrolledAt: enrollmentRow.enrolled_at ?? new Date().toISOString(),
    };
    setTeacherEnrollmentRecords(prev => [...prev, newEnrollment]);

    return {
      id:              enrollmentRow.id,
      teacherId:       record.uniqueId,
      firstName:       record.firstName,
      lastName:        record.lastName,
      dateOfBirth:     record.dateOfBirth,
      placeOfBirth:    record.placeOfBirth,
      sex:             record.sex,
      phone:           record.phone ?? '',
      email:           record.email,
      residence:       record.residence,
      diploma:         record.diploma,
      yearsExperience: data.yearsExperience,
      emergencyPhone:  record.emergencyPhone,
      contractType:    data.contractType,
      paymentType:     data.paymentType,
      salaryAmount:    data.salaryAmount,
      createdAt:       new Date(record.createdAt),
      photoUrl:        record.photoUrl,
    };
  }, [schoolId, currentYear, findTeacherByUniqueId, teacherEnrollmentRecords]);

  const updateTeacher = useCallback(async (id: string, updates: Partial<Teacher>): Promise<void> => {
    // id = enrollment UUID
    const enrollment = teacherEnrollmentRecords.find(e => e.id === id);
    if (!enrollment) return;

    // Mettre à jour le contrat dans teacher_enrollments
    const enrollmentUpdates: Record<string, unknown> = {};
    if (updates.yearsExperience !== undefined) enrollmentUpdates.years_experience = updates.yearsExperience;
    if (updates.contractType    !== undefined) enrollmentUpdates.contract_type    = updates.contractType;
    if (updates.paymentType     !== undefined) enrollmentUpdates.payment_type     = updates.paymentType;
    if (updates.salaryAmount    !== undefined) enrollmentUpdates.salary_amount    = updates.salaryAmount;

    if (Object.keys(enrollmentUpdates).length > 0) {
      await supabase.from('teacher_enrollments').update(enrollmentUpdates).eq('id', id);
      setTeacherEnrollmentRecords(prev => prev.map(e =>
        e.id !== id ? e : {
          ...e,
          yearsExperience: updates.yearsExperience ?? e.yearsExperience,
          contractType:    updates.contractType    ?? e.contractType,
          paymentType:     updates.paymentType     ?? e.paymentType,
          salaryAmount:    updates.salaryAmount    ?? e.salaryAmount,
        }
      ));
    }

    // Mettre à jour le profil dans teacher_profiles
    const profileUpdates: Record<string, unknown> = {};
    if (updates.firstName      !== undefined) profileUpdates.first_name      = updates.firstName;
    if (updates.lastName       !== undefined) profileUpdates.last_name       = updates.lastName;
    if (updates.dateOfBirth    !== undefined) profileUpdates.date_of_birth   = updates.dateOfBirth;
    if (updates.placeOfBirth   !== undefined) profileUpdates.place_of_birth  = updates.placeOfBirth;
    if (updates.sex            !== undefined) profileUpdates.sex             = updates.sex;
    if (updates.phone          !== undefined) profileUpdates.phone           = updates.phone ?? null;
    if (updates.email          !== undefined) profileUpdates.email           = updates.email ?? null;
    if (updates.residence      !== undefined) profileUpdates.residence       = updates.residence;
    if (updates.diploma        !== undefined) profileUpdates.diploma         = updates.diploma;
    if (updates.emergencyPhone !== undefined) profileUpdates.emergency_phone = updates.emergencyPhone;
    if (updates.photoUrl       !== undefined) profileUpdates.photo_url       = updates.photoUrl ?? null;

    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from('teacher_profiles').update(profileUpdates).eq('id', enrollment.teacherProfileId);
      setTeacherRecords(prev => prev.map(r =>
        r.id !== enrollment.teacherProfileId ? r : {
          ...r,
          firstName:      updates.firstName      ?? r.firstName,
          lastName:       updates.lastName       ?? r.lastName,
          dateOfBirth:    updates.dateOfBirth    ?? r.dateOfBirth,
          placeOfBirth:   updates.placeOfBirth   ?? r.placeOfBirth,
          sex:            updates.sex            ?? r.sex,
          phone:          updates.phone          ?? r.phone,
          email:          updates.email          ?? r.email,
          residence:      updates.residence      ?? r.residence,
          diploma:        updates.diploma        ?? r.diploma,
          emergencyPhone: updates.emergencyPhone ?? r.emergencyPhone,
          photoUrl:       updates.photoUrl       ?? r.photoUrl,
        }
      ));
    }
  }, [teacherEnrollmentRecords]);

  // ─────────────────────────────────────────────────────────────────────────
  // PÉRIODES & NOTES — Supabase
  // ─────────────────────────────────────────────────────────────────────────

  const addGradePeriod = useCallback(async (
    data: { name: string; type: 'semester' | 'exam'; startDate?: string; endDate?: string }
  ): Promise<GradePeriod> => {
    if (!schoolId)    throw new Error('Non connecté à une école');
    if (!currentYear) throw new Error('Aucune année scolaire sélectionnée');

    const ordering = gradePeriods.filter(p => p.academicYearLabel === currentYear.id).length;

    const { data: row, error } = await supabase
      .from('grade_periods')
      .insert({
        school_id:           schoolId,
        academic_year_label: currentYear.id,
        name:                data.name,
        type:                data.type,
        ordering,
        start_date:          data.startDate ?? null,
        end_date:            data.endDate ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    const period: GradePeriod = {
      id:                row.id,
      name:              row.name,
      type:              row.type as 'semester' | 'exam',
      academicYearLabel: row.academic_year_label,
      ordering:          row.ordering ?? ordering,
      startDate:         row.start_date ?? undefined,
      endDate:           row.end_date ?? undefined,
      createdAt:         new Date(row.created_at),
    };
    setGradePeriods(prev => [...prev, period]);

    // Par défaut, TOUTES les classes existantes sont concernées par cette
    // nouvelle période (personnalisable ensuite via setClassInPeriod — utile
    // par ex. pour un examen interne réservé à certaines classes).
    if (classes.length > 0) {
      const { error: pcError } = await supabase
        .from('grade_period_classes')
        .insert(classes.map(c => ({ school_id: schoolId, period_id: row.id, class_id: c.id })));
      if (pcError) console.error('Erreur association classes/période:', pcError);
      else setPeriodClasses(prev => [...prev, ...classes.map(c => ({ periodId: row.id, classId: c.id }))]);
    }

    // Trois passes de provisionnement, dans cet ordre (chacune ne recouvre
    // jamais ce que la précédente a posé — "on conflict do nothing" partout) :
    // 1. Filière assignée à la classe pour cette année (obligatoires + choix).
    // 2. Matières par défaut liées au niveau (collège, hors filière).
    // 3. Filet de sécurité : copie telle quelle des matières que CETTE classe
    //    avait déjà dans sa période précédente la plus récente — couvre tout
    //    ce qui a été ajouté à la main et qu'aucun modèle filière/niveau ne
    //    connaît (sinon "0 matière" au 2e/3e semestre pour ces classes-là).
    // Enchaînées (pas en parallèle) pour que 1 et 2 aient toujours priorité
    // sur 3 en cas de conflit sur le nom d'une matière.
    const { error: filiereSyncError } = await supabase.rpc('sync_period_filiere_subjects', { p_period_id: row.id });
    if (filiereSyncError) console.error('Erreur synchro filière/période:', filiereSyncError);
    const { error: niveauSyncError } = await supabase.rpc('sync_period_niveau_defaults', { p_period_id: row.id });
    if (niveauSyncError) console.error('Erreur synchro niveau/période:', niveauSyncError);
    const { error: prevSyncError } = await supabase.rpc('sync_period_from_previous', { p_period_id: row.id });
    if (prevSyncError) console.error('Erreur synchro période précédente:', prevSyncError);

    return period;
  }, [schoolId, currentYear, gradePeriods, classes]);

  const updateGradePeriod = useCallback(async (
    id: string, data: { name?: string; startDate?: string | null; endDate?: string | null }
  ): Promise<void> => {
    if (!schoolId) return;
    const patch: Record<string, string | null> = {};
    if (data.name !== undefined) patch.name = data.name;
    if ('startDate' in data) patch.start_date = data.startDate ?? null;
    if ('endDate' in data) patch.end_date = data.endDate ?? null;

    const { error } = await supabase
      .from('grade_periods')
      .update(patch)
      .eq('id', id)
      .eq('school_id', schoolId);
    if (error) throw error;

    setGradePeriods(prev => prev.map(p => (p.id === id
      ? {
          ...p,
          name:      data.name !== undefined ? data.name : p.name,
          startDate: 'startDate' in data ? (data.startDate ?? undefined) : p.startDate,
          endDate:   'endDate'   in data ? (data.endDate   ?? undefined) : p.endDate,
        }
      : p)));
  }, [schoolId]);

  const deleteGradePeriod = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase
      .from('grade_periods')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);
    if (error) throw error;
    // Cascade : sujets + notes supprimés par la DB
    const deletedSubjectIds = subjects.filter(s => s.periodId === id).map(s => s.id);
    setGradePeriods(prev  => prev.filter(p => p.id !== id));
    setPeriodClasses(prev => prev.filter(pc => pc.periodId !== id));
    setSubjects(prev      => prev.filter(s => s.periodId !== id));
    setGradesState(prev   => prev.filter(g => !deletedSubjectIds.includes(g.subjectId)));
    setSubjectSettings(prev => prev.filter(ss => !deletedSubjectIds.includes(ss.subjectId)));
  }, [schoolId, subjects]);

  const isClassInPeriod = useCallback(
    (periodId: string, classId: string): boolean =>
      periodClasses.some(pc => pc.periodId === periodId && pc.classId === classId),
    [periodClasses],
  );

  const setClassInPeriod = useCallback(async (
    periodId: string, classId: string, included: boolean
  ): Promise<void> => {
    if (!schoolId) return;
    if (included) {
      const { error } = await supabase
        .from('grade_period_classes')
        .upsert({ school_id: schoolId, period_id: periodId, class_id: classId }, { onConflict: 'period_id,class_id' });
      if (error) throw error;
      setPeriodClasses(prev => (prev.some(pc => pc.periodId === periodId && pc.classId === classId)
        ? prev
        : [...prev, { periodId, classId }]));
    } else {
      const { error } = await supabase
        .from('grade_period_classes')
        .delete()
        .eq('period_id', periodId)
        .eq('class_id', classId)
        .eq('school_id', schoolId);
      if (error) throw error;
      setPeriodClasses(prev => prev.filter(pc => !(pc.periodId === periodId && pc.classId === classId)));
    }
  }, [schoolId]);

  const addSubject = useCallback(async (
    data: { name: string; coefficient: number; classId: string; periodId: string; teacherId?: string }
  ): Promise<Subject> => {
    if (!schoolId) throw new Error('Non connecté à une école');

    const ordering = subjects.filter(s => s.periodId === data.periodId && s.classId === data.classId).length;

    const { data: row, error } = await supabase
      .from('subjects')
      .insert({
        school_id:   schoolId,
        period_id:   data.periodId,
        class_id:    data.classId,
        name:        data.name,
        coefficient: data.coefficient,
        teacher_id:  data.teacherId ?? null,
        ordering,
      })
      .select()
      .single();

    if (error) throw error;

    const subject: Subject = {
      id:          row.id,
      name:        row.name,
      coefficient: Number(row.coefficient),
      classId:     row.class_id,
      periodId:    row.period_id,
      ordering:    row.ordering ?? ordering,
      subjectType: (row.subject_type ?? 'obligatoire') as SubjectType,
      teacherId:   row.teacher_id ?? undefined,
    };
    setSubjects(prev => [...prev, subject]);
    return subject;
  }, [schoolId, subjects]);

  const updateSubject = useCallback(async (
    id: string,
    updates: { name?: string; coefficient?: number; teacherId?: string | null }
  ): Promise<void> => {
    if (!schoolId) return;
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name        !== undefined) dbUpdates.name        = updates.name;
    if (updates.coefficient !== undefined) dbUpdates.coefficient = updates.coefficient;
    if (updates.teacherId   !== undefined) dbUpdates.teacher_id  = updates.teacherId;

    const { error } = await supabase
      .from('subjects')
      .update(dbUpdates)
      .eq('id', id)
      .eq('school_id', schoolId);
    if (error) throw error;

    setSubjects(prev => prev.map(s => s.id === id
      ? { ...s, ...updates, teacherId: updates.teacherId !== undefined ? (updates.teacherId ?? undefined) : s.teacherId }
      : s));
  }, [schoolId]);

  const deleteSubject = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);
    if (error) throw error;
    setSubjects(prev        => prev.filter(s => s.id !== id));
    setGradesState(prev     => prev.filter(g => g.subjectId !== id));
    setSubjectSettings(prev => prev.filter(ss => ss.subjectId !== id));
  }, [schoolId]);

  /**
   * Upsert en lot des notes d'une matière.
   * Remplace tous les enregistrements grade pour ce subjectId.
   */
  const upsertGrades = useCallback(async (
    subjectId: string,
    entries: GradeUpsertEntry[]
  ): Promise<void> => {
    if (!schoolId) return;

    const rows = entries.map(e => ({
      school_id:             schoolId,
      subject_id:            subjectId,
      student_enrollment_id: e.studentEnrollmentId,
      devoir1:      e.devoir1      ?? null,
      devoir2:      e.devoir2      ?? null,
      devoir3:      e.devoir3      ?? null,
      devoir4:      e.devoir4      ?? null,
      devoir5:      e.devoir5      ?? null,
      composition:  e.composition  ?? null,
      note:         e.note         ?? null,
      updated_at:   new Date().toISOString(),
    }));

    const { data: upserted, error } = await supabase
      .from('grades')
      .upsert(rows, { onConflict: 'school_id,subject_id,student_enrollment_id' })
      .select();

    if (error) throw error;

    // Mettre à jour le state local
    const newGrades: Grade[] = (upserted ?? []).map(r => ({
      id:                  r.id,
      studentEnrollmentId: r.student_enrollment_id,
      subjectId:           r.subject_id,
      devoir1:     r.devoir1     != null ? Number(r.devoir1)     : undefined,
      devoir2:     r.devoir2     != null ? Number(r.devoir2)     : undefined,
      devoir3:     r.devoir3     != null ? Number(r.devoir3)     : undefined,
      devoir4:     r.devoir4     != null ? Number(r.devoir4)     : undefined,
      devoir5:     r.devoir5     != null ? Number(r.devoir5)     : undefined,
      composition: r.composition != null ? Number(r.composition) : undefined,
      note:        r.note        != null ? Number(r.note)        : undefined,
    }));

    setGradesState(prev => {
      const kept = prev.filter(g => g.subjectId !== subjectId);
      return [...kept, ...newGrades];
    });
  }, [schoolId]);

  /**
   * Upsert des paramètres d'une matière (paramètres globaux + per-élève).
   * La table `subject_settings` gère les flags devoir/LV.
   * La table `student_subject_settings` gère les paramètres élève.
   */
  // Réglages globaux d'une matière (activation des devoirs) UNIQUEMENT — les
  // réglages par élève (actif/coefficient) ne passent plus par ici, pour
  // éviter qu'une sauvegarde globale n'écrase silencieusement un choix résolu
  // ou une exception individuelle. Voir `updateStudentSubjectOverride` pour
  // les ajustements par élève, désormais centralisés dans le profil académique.
  const updateSubjectSettings = useCallback(async (
    subjectId: string,
    settings: Pick<SubjectSettingsData, 'devoir1Active' | 'devoir2Active' | 'devoir3Active' | 'devoir4Active' | 'devoir5Active'>
  ): Promise<void> => {
    if (!schoolId) return;

    const { data: ssRow, error: ssError } = await supabase
      .from('subject_settings')
      .upsert({
        school_id:      schoolId,
        subject_id:     subjectId,
        devoir1_active: settings.devoir1Active,
        devoir2_active: settings.devoir2Active,
        devoir3_active: settings.devoir3Active,
        devoir4_active: settings.devoir4Active,
        devoir5_active: settings.devoir5Active,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'school_id,subject_id' })
      .select()
      .single();

    if (ssError) throw ssError;

    setSubjectSettings(prev => {
      const idx = prev.findIndex(ss => ss.subjectId === subjectId);
      const updated: SubjectSettingsData = {
        id: ssRow?.id ?? '', subjectId,
        studentSettings: idx >= 0 ? prev[idx].studentSettings : {},
        ...settings,
      };
      if (idx >= 0) return prev.map((ss, i) => i === idx ? updated : ss);
      return [...prev, updated];
    });
  }, [schoolId]);

  const getSubjectSettings = useCallback(
    (subjectId: string): SubjectSettingsData | undefined =>
      subjectSettings.find(ss => ss.subjectId === subjectId),
    [subjectSettings],
  );

  // Unique point d'écriture pour une exception individuelle manuelle (ex:
  // dispense d'EPS) posée depuis le profil académique de l'élève — distincte
  // des flux automatiques (resolveFiliereChoice, matérialisation) via
  // override_reason='manual', pour que ces derniers ne l'écrasent jamais en
  // silence.
  const updateStudentSubjectOverride = useCallback(async (
    studentEnrollmentId: string, subjectId: string, active: boolean, customCoef?: string
  ): Promise<void> => {
    if (!schoolId) throw new Error('Non connecté à une école');

    // Une matière existe UNE FOIS PAR PÉRIODE : le réglage doit les atteindre
    // TOUTES. Sinon l'EPS éteinte pour un élève au premier trimestre restait
    // comptée dans ses bulletins suivants — et le profil, qui ne lisait que la
    // première occurrence, ne le montrait même pas.
    const occurrences = occurrencesDeLaMatiere(subjects, gradePeriods, subjectId);
    const ids = occurrences.length > 0 ? occurrences.map(o => o.id) : [subjectId];
    const maintenant = new Date().toISOString();

    const { error } = await supabase
      .from('student_subject_settings')
      .upsert(
        lignesReglageManuel({ schoolId, studentEnrollmentId, occurrenceIds: ids, active, customCoef, maintenant }),
        { onConflict: 'school_id,subject_id,student_enrollment_id' },
      );
    if (error) throw error;

    setSubjectSettings(prev => appliquerReglageLocal(prev, ids, studentEnrollmentId, active, customCoef));
  }, [schoolId, subjects, gradePeriods]);

  // ─────────────────────────────────────────────────────────────────────────
  // FILIÈRES — fonctions Supabase
  // ─────────────────────────────────────────────────────────────────────────

  const addFiliere = useCallback(async (data: { name: string; description?: string }): Promise<Filiere> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const { data: row, error } = await supabase
      .from('filieres')
      .insert({ school_id: schoolId, name: data.name, description: data.description ?? null })
      .select()
      .single();
    if (error) throw error;
    const filiere: Filiere = { id: row.id, name: row.name, description: row.description ?? undefined, niveaux: row.niveaux ?? [] };
    setFilieres(prev => [...prev, filiere]);
    return filiere;
  }, [schoolId]);

  const updateFiliere = useCallback(async (id: string, updates: { name?: string; description?: string }): Promise<void> => {
    if (!schoolId) return;
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description || null;
    const { error } = await supabase.from('filieres').update(dbUpdates).eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFilieres(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, [schoolId]);

  // Déclare à quel(s) niveau(x) une filière s'applique réellement (la 2nde est
  // un tronc commun — seul "S" ou "L" y existe ; les séries précises comme
  // S1/S2/L2/L'1 n'existent qu'à partir de la 1ère). Gouverne les onglets
  // affichés dans l'éditeur.
  const updateFiliereNiveaux = useCallback(async (id: string, niveaux: string[]): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase.from('filieres').update({ niveaux }).eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFilieres(prev => prev.map(f => f.id === id ? { ...f, niveaux } : f));
  }, [schoolId]);

  const deleteFiliere = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase.from('filieres').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFilieres(prev => prev.filter(f => f.id !== id));
    setFiliereMandatorySubjects(prev => prev.filter(m => m.filiereId !== id));
    setFiliereChoiceGroups(prev => prev.filter(g => g.filiereId !== id));
  }, [schoolId]);

  const addFiliereMandatorySubject = useCallback(async (
    filiereId: string, data: { niveau: string; name: string; coefficient: number }
  ): Promise<FiliereMandatorySubject> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = filiereMandatorySubjects.filter(m => m.filiereId === filiereId && m.niveau === data.niveau).length;
    const { data: row, error } = await supabase
      .from('filiere_mandatory_subjects')
      .insert({ school_id: schoolId, filiere_id: filiereId, niveau: data.niveau, name: data.name, coefficient: data.coefficient, ordering })
      .select()
      .single();
    if (error) throw error;
    const subject: FiliereMandatorySubject = {
      id: row.id, filiereId: row.filiere_id, niveau: row.niveau, name: row.name,
      coefficient: Number(row.coefficient), ordering: row.ordering ?? ordering,
    };
    setFiliereMandatorySubjects(prev => [...prev, subject]);
    return subject;
  }, [schoolId, filiereMandatorySubjects]);

  const updateFiliereMandatorySubject = useCallback(async (
    id: string, updates: { name?: string; coefficient?: number }
  ): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase
      .from('filiere_mandatory_subjects')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.coefficient !== undefined && { coefficient: updates.coefficient }),
      })
      .eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFiliereMandatorySubjects(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, [schoolId]);

  const deleteFiliereMandatorySubject = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase.from('filiere_mandatory_subjects').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFiliereMandatorySubjects(prev => prev.filter(m => m.id !== id));
  }, [schoolId]);

  const addFiliereFacultativeSubject = useCallback(async (
    filiereId: string, data: { niveau: string; name: string; coefficient: number }
  ): Promise<FiliereFacultativeSubject> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = filiereFacultativeSubjects.filter(m => m.filiereId === filiereId && m.niveau === data.niveau).length;
    const { data: row, error } = await supabase
      .from('filiere_facultative_subjects')
      .insert({ school_id: schoolId, filiere_id: filiereId, niveau: data.niveau, name: data.name, coefficient: data.coefficient, ordering })
      .select()
      .single();
    if (error) throw error;
    const subject: FiliereFacultativeSubject = {
      id: row.id, filiereId: row.filiere_id, niveau: row.niveau, name: row.name,
      coefficient: Number(row.coefficient), ordering: row.ordering ?? ordering,
    };
    setFiliereFacultativeSubjects(prev => [...prev, subject]);
    return subject;
  }, [schoolId, filiereFacultativeSubjects]);

  const updateFiliereFacultativeSubject = useCallback(async (
    id: string, updates: { name?: string; coefficient?: number }
  ): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase
      .from('filiere_facultative_subjects')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.coefficient !== undefined && { coefficient: updates.coefficient }),
      })
      .eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFiliereFacultativeSubjects(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, [schoolId]);

  const deleteFiliereFacultativeSubject = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase.from('filiere_facultative_subjects').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFiliereFacultativeSubjects(prev => prev.filter(m => m.id !== id));
  }, [schoolId]);

  const addFiliereChoiceGroup = useCallback(async (
    filiereId: string, data: { niveau: string; label: string; coefficient: number }
  ): Promise<FiliereChoiceGroup> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = filiereChoiceGroups.filter(g => g.filiereId === filiereId && g.niveau === data.niveau).length;
    const { data: row, error } = await supabase
      .from('filiere_choice_groups')
      .insert({ school_id: schoolId, filiere_id: filiereId, niveau: data.niveau, label: data.label, coefficient: data.coefficient, ordering })
      .select()
      .single();
    if (error) throw error;
    const group: FiliereChoiceGroup = {
      id: row.id, filiereId: row.filiere_id, niveau: row.niveau, label: row.label,
      coefficient: Number(row.coefficient), ordering: row.ordering ?? ordering, options: [],
    };
    setFiliereChoiceGroups(prev => [...prev, group]);
    return group;
  }, [schoolId, filiereChoiceGroups]);

  const updateFiliereChoiceGroup = useCallback(async (
    id: string, updates: { label?: string; coefficient?: number }
  ): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase
      .from('filiere_choice_groups')
      .update({
        ...(updates.label !== undefined && { label: updates.label }),
        ...(updates.coefficient !== undefined && { coefficient: updates.coefficient }),
      })
      .eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFiliereChoiceGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, [schoolId]);

  const deleteFiliereChoiceGroup = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase.from('filiere_choice_groups').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFiliereChoiceGroups(prev => prev.filter(g => g.id !== id));
  }, [schoolId]);

  const addFiliereChoiceOption = useCallback(async (
    choiceGroupId: string, subjectName: string
  ): Promise<FiliereChoiceOption> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const group = filiereChoiceGroups.find(g => g.id === choiceGroupId);
    const ordering = group?.options.length ?? 0;
    const { data: row, error } = await supabase
      .from('filiere_choice_options')
      .insert({ school_id: schoolId, choice_group_id: choiceGroupId, subject_name: subjectName, ordering })
      .select()
      .single();
    if (error) throw error;
    const option: FiliereChoiceOption = {
      id: row.id, choiceGroupId: row.choice_group_id, subjectName: row.subject_name, ordering: row.ordering ?? ordering,
    };
    setFiliereChoiceGroups(prev => prev.map(g =>
      g.id === choiceGroupId ? { ...g, options: [...g.options, option] } : g
    ));
    return option;
  }, [schoolId, filiereChoiceGroups]);

  const deleteFiliereChoiceOption = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase.from('filiere_choice_options').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFiliereChoiceGroups(prev => prev.map(g => ({ ...g, options: g.options.filter(o => o.id !== id) })));
  }, [schoolId]);

  const assignClassFiliere = useCallback(async (
    classId: string, academicYearLabel: string, filiereId: string
  ): Promise<void> => {
    const { data: row, error } = await supabase.rpc('assign_class_filiere', {
      p_class_id: classId, p_academic_year_label: academicYearLabel, p_filiere_id: filiereId,
    });
    if (error) throw error;
    if (row) {
      const assignment: ClassFiliereAssignment = {
        id: row.id, classId: row.class_id, academicYearLabel: row.academic_year_label, filiereId: row.filiere_id,
      };
      setClassFiliereAssignments(prev => [...prev.filter(a => a.classId !== classId || a.academicYearLabel !== academicYearLabel), assignment]);
    }
    // Les matières nouvellement matérialisées (obligatoires + options) ne sont
    // pas encore dans le state local `subjects` — on force un rechargement
    // simple en relisant celles de la classe pour l'année courante.
    if (currentYear?.id === academicYearLabel) {
      const periodIds = gradePeriods.filter(p => p.academicYearLabel === academicYearLabel).map(p => p.id);
      if (periodIds.length > 0) {
        const { data: subjectsData } = await supabase
          .from('subjects').select('*').eq('class_id', classId).in('period_id', periodIds);
        if (subjectsData) {
          const fresh: Subject[] = subjectsData.map(r => ({
            id: r.id, name: r.name, coefficient: Number(r.coefficient),
            classId: r.class_id, periodId: r.period_id, ordering: r.ordering ?? 0,
            subjectType: (r.subject_type ?? 'obligatoire') as SubjectType,
            teacherId: r.teacher_id ?? undefined,
          }));
          setSubjects(prev => [...prev.filter(s => !(s.classId === classId && periodIds.includes(s.periodId))), ...fresh]);
        }
      }
    }
  }, [currentYear, gradePeriods]);

  const applyNiveauDefaultsToClass = useCallback(async (
    classId: string, academicYearLabel: string
  ): Promise<void> => {
    const { error } = await supabase.rpc('apply_niveau_defaults_to_class', {
      p_class_id: classId, p_academic_year_label: academicYearLabel,
    });
    if (error) throw error;
    // Comme pour assignClassFiliere : recharger les matières fraîchement créées.
    if (currentYear?.id === academicYearLabel) {
      const periodIds = gradePeriods.filter(p => p.academicYearLabel === academicYearLabel).map(p => p.id);
      if (periodIds.length > 0) {
        const { data: subjectsData } = await supabase
          .from('subjects').select('*').eq('class_id', classId).in('period_id', periodIds);
        if (subjectsData) {
          const fresh: Subject[] = subjectsData.map(r => ({
            id: r.id, name: r.name, coefficient: Number(r.coefficient),
            classId: r.class_id, periodId: r.period_id, ordering: r.ordering ?? 0,
            subjectType: (r.subject_type ?? 'obligatoire') as SubjectType,
            teacherId: r.teacher_id ?? undefined,
          }));
          setSubjects(prev => [...prev.filter(s => !(s.classId === classId && periodIds.includes(s.periodId))), ...fresh]);
        }
      }
    }
  }, [currentYear, gradePeriods]);

  /**
   * Rattrape les matières ajoutées au programme/cursus APRÈS que la classe ait
   * déjà été matérialisée pour cette période — sans jamais toucher aux
   * matières déjà présentes (donc sans casser les notes déjà saisies).
   * S'appuie sur les RPC de sync déjà utilisées à la création de période
   * (sync_period_niveau_defaults / sync_period_filiere_subjects), qui font un
   * simple INSERT ... ON CONFLICT (class_id, period_id, name) DO NOTHING.
   * Retourne le nombre de matières nouvellement ajoutées.
   */
  const resyncPeriodSubjects = useCallback(async (
    classId: string, periodId: string, mode: 'college' | 'lycee' | 'elementaire'
  ): Promise<number> => {
    if (mode === 'elementaire') {
      const before = elementaryClassLines.filter(l => l.classId === classId && l.periodId === periodId).length;
      const { error } = await sbElementary.rpc('sync_period_elementary_lines', { p_period_id: periodId });
      if (error) throw error;

      const { data: linesData } = await sbElementary
        .from('elementary_class_lines').select('*').eq('class_id', classId).eq('period_id', periodId);
      if (!linesData) return 0;

      const fresh: ElementaryClassLine[] = linesData.map(r => ({
        id: r.id, classId: r.class_id, periodId: r.period_id,
        domaine: r.domaine, registre: r.registre, name: r.name,
        pointMax: Number(r.point_max), ordering: r.ordering ?? 0,
        teacherId: r.teacher_id ?? undefined,
      }));
      setElementaryClassLines(prev => [...prev.filter(l => !(l.classId === classId && l.periodId === periodId)), ...fresh]);
      return fresh.length - before;
    }

    const before = subjects.filter(s => s.classId === classId && s.periodId === periodId).length;

    const { error } = await supabase.rpc(
      mode === 'college' ? 'sync_period_niveau_defaults' : 'sync_period_filiere_subjects',
      { p_period_id: periodId },
    );
    if (error) throw error;

    const { data: subjectsData } = await supabase
      .from('subjects').select('*').eq('class_id', classId).eq('period_id', periodId);
    if (!subjectsData) return 0;

    const fresh: Subject[] = subjectsData.map(r => ({
      id: r.id, name: r.name, coefficient: Number(r.coefficient),
      classId: r.class_id, periodId: r.period_id, ordering: r.ordering ?? 0,
      subjectType: (r.subject_type ?? 'obligatoire') as SubjectType,
      teacherId: r.teacher_id ?? undefined,
    }));
    setSubjects(prev => [...prev.filter(s => !(s.classId === classId && s.periodId === periodId)), ...fresh]);
    return fresh.length - before;
  }, [subjects, elementaryClassLines]);

  const addNiveauDefaultSubject = useCallback(async (
    data: { niveau: string; name: string; coefficient: number; isFacultative?: boolean }
  ): Promise<NiveauDefaultSubject> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = niveauDefaultSubjects.filter(s => s.niveau === data.niveau).length;
    const { data: row, error } = await supabase
      .from('niveau_default_subjects')
      .insert({
        school_id: schoolId, niveau: data.niveau, name: data.name, coefficient: data.coefficient,
        ordering, is_facultative: data.isFacultative ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    const subject: NiveauDefaultSubject = {
      id: row.id, niveau: row.niveau, name: row.name, coefficient: Number(row.coefficient),
      ordering: row.ordering ?? ordering, isFacultative: row.is_facultative ?? false,
    };
    setNiveauDefaultSubjects(prev => [...prev, subject]);
    return subject;
  }, [schoolId, niveauDefaultSubjects]);

  const updateNiveauDefaultSubject = useCallback(async (
    id: string, updates: { name?: string; coefficient?: number; isFacultative?: boolean }
  ): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase
      .from('niveau_default_subjects')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.coefficient !== undefined && { coefficient: updates.coefficient }),
        ...(updates.isFacultative !== undefined && { is_facultative: updates.isFacultative }),
      })
      .eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setNiveauDefaultSubjects(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, [schoolId]);

  const deleteNiveauDefaultSubject = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await supabase.from('niveau_default_subjects').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setNiveauDefaultSubjects(prev => prev.filter(s => s.id !== id));
  }, [schoolId]);

  // ── Élémentaire (CI-CM2) — barème de points ──────────────────────────────────
  const applyElementaryDefaultsToClass = useCallback(async (
    classId: string, academicYearLabel: string
  ): Promise<void> => {
    const { error } = await sbElementary.rpc('apply_elementary_defaults_to_class', {
      p_class_id: classId, p_academic_year_label: academicYearLabel,
    });
    if (error) throw error;
    if (currentYear?.id === academicYearLabel) {
      const periodIds = gradePeriods.filter(p => p.academicYearLabel === academicYearLabel).map(p => p.id);
      if (periodIds.length > 0) {
        const { data: linesData } = await sbElementary
          .from('elementary_class_lines').select('*').eq('class_id', classId).in('period_id', periodIds);
        if (linesData) {
          const fresh: ElementaryClassLine[] = linesData.map(r => ({
            id: r.id, classId: r.class_id, periodId: r.period_id,
            domaine: r.domaine, registre: r.registre, name: r.name,
            pointMax: Number(r.point_max), ordering: r.ordering ?? 0,
            teacherId: r.teacher_id ?? undefined,
          }));
          setElementaryClassLines(prev => [...prev.filter(l => !(l.classId === classId && periodIds.includes(l.periodId))), ...fresh]);
        }
      }
    }
  }, [currentYear, gradePeriods]);

  const addElementaryDefaultLine = useCallback(async (
    data: { niveau: string; domaine: ElementaryDomaine; registre: ElementaryRegistre; name: string; pointMax: number; isOptional?: boolean }
  ): Promise<ElementaryDefaultLine> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = elementaryDefaultLines.filter(l => l.niveau === data.niveau).length;
    const { data: row, error } = await sbElementary
      .from('elementary_default_lines')
      .insert({
        school_id: schoolId, niveau: data.niveau, domaine: data.domaine, registre: data.registre,
        name: data.name, point_max: data.pointMax, ordering, is_optional: data.isOptional ?? false,
        is_active_by_default: true,
      })
      .select()
      .single();
    if (error) throw error;
    const line: ElementaryDefaultLine = {
      id: row.id, niveau: row.niveau, domaine: row.domaine, registre: row.registre,
      name: row.name, pointMax: Number(row.point_max), ordering: row.ordering ?? ordering,
      isOptional: row.is_optional ?? false, isActiveByDefault: row.is_active_by_default ?? true,
    };
    setElementaryDefaultLines(prev => [...prev, line]);
    return line;
  }, [schoolId, elementaryDefaultLines]);

  const updateElementaryDefaultLine = useCallback(async (
    id: string, updates: { name?: string; pointMax?: number; isActiveByDefault?: boolean }
  ): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sbElementary
      .from('elementary_default_lines')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.pointMax !== undefined && { point_max: updates.pointMax }),
        ...(updates.isActiveByDefault !== undefined && { is_active_by_default: updates.isActiveByDefault }),
      })
      .eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setElementaryDefaultLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, [schoolId]);

  const deleteElementaryDefaultLine = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sbElementary.from('elementary_default_lines').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setElementaryDefaultLines(prev => prev.filter(l => l.id !== id));
  }, [schoolId]);

  const addElementaryClassLine = useCallback(async (
    data: { classId: string; periodId: string; domaine: ElementaryDomaine; registre: ElementaryRegistre; name: string; pointMax: number; teacherId?: string }
  ): Promise<ElementaryClassLine> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = elementaryClassLines.filter(l => l.classId === data.classId && l.periodId === data.periodId).length;
    const { data: row, error } = await sbElementary
      .from('elementary_class_lines')
      .insert({
        school_id: schoolId, class_id: data.classId, period_id: data.periodId,
        domaine: data.domaine, registre: data.registre, name: data.name,
        point_max: data.pointMax, ordering, teacher_id: data.teacherId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    const line: ElementaryClassLine = {
      id: row.id, classId: row.class_id, periodId: row.period_id,
      domaine: row.domaine, registre: row.registre, name: row.name,
      pointMax: Number(row.point_max), ordering: row.ordering ?? ordering,
      teacherId: row.teacher_id ?? undefined,
    };
    setElementaryClassLines(prev => [...prev, line]);
    return line;
  }, [schoolId, elementaryClassLines]);

  const updateElementaryClassLine = useCallback(async (
    id: string, updates: { name?: string; pointMax?: number; teacherId?: string | null }
  ): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sbElementary
      .from('elementary_class_lines')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.pointMax !== undefined && { point_max: updates.pointMax }),
        ...(updates.teacherId !== undefined && { teacher_id: updates.teacherId }),
      })
      .eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setElementaryClassLines(prev => prev.map(l => l.id === id ? { ...l, ...updates, teacherId: updates.teacherId === null ? undefined : (updates.teacherId ?? l.teacherId) } : l));
  }, [schoolId]);

  const deleteElementaryClassLine = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sbElementary.from('elementary_class_lines').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setElementaryClassLines(prev => prev.filter(l => l.id !== id));
  }, [schoolId]);

  // Dispense d'une discipline pour UN élève (ex: inapte EPS). La note
  // éventuellement déjà saisie n'est pas supprimée — la discipline sort
  // simplement du calcul de SA moyenne (ni numérateur, ni dénominateur).
  const setElementaryLineExemption = useCallback(async (
    studentEnrollmentId: string, lineId: string, active: boolean
  ): Promise<void> => {
    if (!schoolId) throw new Error('Non connecté à une école');

    const { data: row, error } = await sbElementary
      .from('elementary_student_line_settings')
      .upsert({
        school_id: schoolId, line_id: lineId, student_enrollment_id: studentEnrollmentId,
        active, override_reason: 'manual', updated_at: new Date().toISOString(),
      }, { onConflict: 'school_id,line_id,student_enrollment_id' })
      .select()
      .single();
    if (error) throw error;

    setElementaryLineSettings(prev => {
      const idx = prev.findIndex(s => s.lineId === lineId && s.studentEnrollmentId === studentEnrollmentId);
      const entry: ElementaryLineSetting = {
        id: row?.id ?? '', lineId, studentEnrollmentId, active, overrideReason: 'manual',
      };
      return idx >= 0 ? prev.map((s, i) => i === idx ? entry : s) : [...prev, entry];
    });
  }, [schoolId]);

  const upsertElementaryGrades = useCallback(async (
    lineId: string,
    entries: { studentEnrollmentId: string; pointsObtenus?: number | null }[]
  ): Promise<void> => {
    if (!schoolId) return;

    const rows = entries.map(e => ({
      school_id:             schoolId,
      line_id:               lineId,
      student_enrollment_id: e.studentEnrollmentId,
      points_obtenus:        e.pointsObtenus ?? null,
      updated_at:             new Date().toISOString(),
    }));

    const { data: upserted, error } = await sbElementary
      .from('elementary_grades')
      .upsert(rows, { onConflict: 'school_id,line_id,student_enrollment_id' })
      .select();

    if (error) throw error;

    const newGrades: ElementaryGrade[] = (upserted ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, lineId: r.line_id as string, studentEnrollmentId: r.student_enrollment_id as string,
      pointsObtenus: r.points_obtenus != null ? Number(r.points_obtenus) : undefined,
    }));

    setElementaryGrades(prev => {
      const kept = prev.filter(g => g.lineId !== lineId);
      return [...kept, ...newGrades];
    });
  }, [schoolId]);

  // Matérialise UN élève déjà inscrit dans sa classe (crée les lignes
  // `student_subject_settings` manquantes pour les matières au choix/
  // facultatives déjà matérialisées au niveau classe). Corrige le cas d'un
  // élève qui rejoint une classe APRÈS que sa filière a été assignée — sans
  // cela, il serait compté "actif" par défaut dans toutes les options à la
  // fois. Best-effort, jamais bloquant pour l'inscription elle-même.
  const setFacultativeActive = useCallback(async (
    studentEnrollmentId: string, subjectName: string, active: boolean
  ): Promise<void> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const { data: enr } = await supabase
      .from('student_enrollments').select('class_id, academic_year_label')
      .eq('id', studentEnrollmentId).single();
    if (!enr?.class_id) throw new Error('Élève introuvable');

    const periodIds = gradePeriods.filter(p => p.academicYearLabel === enr.academic_year_label).map(p => p.id);
    const { data: subjectRows } = await supabase
      .from('subjects').select('id')
      .eq('class_id', enr.class_id).eq('name', subjectName).in('period_id', periodIds);
    if (!subjectRows || subjectRows.length === 0) return;

    const { error } = await supabase.from('student_subject_settings').upsert(
      subjectRows.map(s => ({
        school_id: schoolId, subject_id: s.id, student_enrollment_id: studentEnrollmentId,
        active, updated_at: new Date().toISOString(),
      })),
      { onConflict: 'school_id,subject_id,student_enrollment_id' }
    );
    if (error) throw error;

    setSubjectSettings(prev => {
      const bySubject = new Map(prev.map(s => [s.subjectId, { ...s, studentSettings: { ...s.studentSettings } }]));
      for (const s of subjectRows) {
        let entry = bySubject.get(s.id);
        if (!entry) {
          entry = {
            id: '', subjectId: s.id,
            devoir1Active: true, devoir2Active: true, devoir3Active: true, devoir4Active: false, devoir5Active: false,
            studentSettings: {},
          };
          bySubject.set(s.id, entry);
        }
        entry.studentSettings[studentEnrollmentId] = { active };
      }
      return Array.from(bySubject.values());
    });
  }, [schoolId, gradePeriods]);

  // Calcul pur dans src/lib/academicProfile.ts (couvert par academicProfile.test.ts).
  const getUnresolvedChoiceGroups = useCallback((
    studentEnrollmentId: string, classId: string, academicYearLabel: string
  ): FiliereChoiceGroup[] =>
    resolveUnresolvedChoiceGroups(
      classes, classFiliereAssignments, filiereChoiceGroups, filiereStudentChoices,
      studentEnrollmentId, classId, academicYearLabel),
  [classes, classFiliereAssignments, filiereChoiceGroups, filiereStudentChoices]);

  const resolveFiliereChoice = useCallback(async (
    choiceGroupId: string, studentEnrollmentId: string, subjectName: string, actor: string
  ): Promise<void> => {
    const { data: row, error } = await supabase.rpc('resolve_filiere_choice', {
      p_choice_group_id: choiceGroupId, p_student_enrollment_id: studentEnrollmentId,
      p_subject_name: subjectName, p_actor: actor,
    });
    if (error) throw error;
    if (row) {
      const choice: FiliereStudentChoice = {
        id: row.id, classFiliereAssignmentId: row.class_filiere_assignment_id, choiceGroupId: row.choice_group_id,
        studentEnrollmentId: row.student_enrollment_id, chosenSubjectName: row.chosen_subject_name, chosenBy: row.chosen_by,
      };
      setFiliereStudentChoices(prev => [
        ...prev.filter(c => !(c.studentEnrollmentId === studentEnrollmentId && c.choiceGroupId === choiceGroupId)),
        choice,
      ]);
    }
    // Le coefficient/active résolus par la RPC vivent dans `student_subject_settings`
    // (pas encore reflétés dans le state local `subjectSettings`) — on recharge
    // uniquement les réglages de cet élève pour rester à jour sans tout recharger.
    const { data: sssData } = await supabase
      .from('student_subject_settings').select('*').eq('student_enrollment_id', studentEnrollmentId);
    if (sssData) {
      setSubjectSettings(prev => {
        const bySubject = new Map(prev.map(s => [s.subjectId, { ...s, studentSettings: { ...s.studentSettings } }]));
        for (const r of sssData) {
          let entry = bySubject.get(r.subject_id);
          if (!entry) {
            entry = {
              id: '', subjectId: r.subject_id,
              devoir1Active: true, devoir2Active: true, devoir3Active: true,
              devoir4Active: false, devoir5Active: false,
              studentSettings: {},
            };
            bySubject.set(r.subject_id, entry);
          }
          entry.studentSettings[r.student_enrollment_id] = {
            active: r.active,
            customCoef: r.custom_coefficient != null ? String(r.custom_coefficient) : '',
            overrideReason: r.override_reason ?? undefined,
          };
        }
        return Array.from(bySubject.values());
      });
    }
  }, []);

  const getClassFiliereAssignment = useCallback((classId: string, academicYearLabel: string): ClassFiliereAssignment | undefined =>
    classFiliereAssignments.find(a => a.classId === classId && a.academicYearLabel === academicYearLabel),
  [classFiliereAssignments]);

  const getStudentFiliereChoice = useCallback((studentEnrollmentId: string, choiceGroupId: string): FiliereStudentChoice | undefined =>
    filiereStudentChoices.find(c => c.studentEnrollmentId === studentEnrollmentId && c.choiceGroupId === choiceGroupId),
  [filiereStudentChoices]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SchoolContext.Provider value={{
      classesLoading, studentsLoading, teachersLoading, gradesLoading,
      instantaneLe,
      classes,
      studentRecords, studentEnrollments,
      teacherRecords, teacherEnrollmentRecords,
      gradePeriods, isClassInPeriod, setClassInPeriod, subjects, grades: gradesState, subjectSettings,
      students, teachers,
      filieres, filiereMandatorySubjects, filiereFacultativeSubjects, filiereChoiceGroups, classFiliereAssignments, filiereStudentChoices,
      niveauDefaultSubjects,
      addNiveauDefaultSubject, updateNiveauDefaultSubject, deleteNiveauDefaultSubject,
      elementaryDefaultLines, elementaryClassLines, elementaryGrades, elementaryLineSettings,
      applyElementaryDefaultsToClass,
      addElementaryDefaultLine, updateElementaryDefaultLine, deleteElementaryDefaultLine,
      addElementaryClassLine, updateElementaryClassLine, deleteElementaryClassLine,
      upsertElementaryGrades, setElementaryLineExemption,
      addClass, updateClass, deleteClass, getStudentCountByClass,
      generateStudentId,
      addStudent, updateStudent, findStudentByUniqueId, reEnrollStudent,
      addTeacher, updateTeacher, generateTeacherId, findTeacherByUniqueId, reEnrollTeacher,
      addGradePeriod, updateGradePeriod, deleteGradePeriod,
      addSubject, updateSubject, deleteSubject, upsertGrades,
      updateSubjectSettings, getSubjectSettings, updateStudentSubjectOverride,
      addFiliere, updateFiliere, updateFiliereNiveaux, deleteFiliere,
      addFiliereMandatorySubject, updateFiliereMandatorySubject, deleteFiliereMandatorySubject,
      addFiliereFacultativeSubject, updateFiliereFacultativeSubject, deleteFiliereFacultativeSubject,
      addFiliereChoiceGroup, updateFiliereChoiceGroup, deleteFiliereChoiceGroup,
      addFiliereChoiceOption, deleteFiliereChoiceOption,
      assignClassFiliere, resolveFiliereChoice,
      getClassFiliereAssignment, getStudentFiliereChoice,
      applyNiveauDefaultsToClass, resyncPeriodSubjects, setFacultativeActive, getUnresolvedChoiceGroups,
    }}>
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used within a SchoolProvider');
  return ctx;
};
