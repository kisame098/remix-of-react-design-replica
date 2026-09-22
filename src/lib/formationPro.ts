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
