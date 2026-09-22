// ═══════════════════════════════════════════════════════════════════════════
// FORMATION PROFESSIONNELLE — Catalogue des formations (étape 1)
//
// Un « bloc » est le programme d'UNE année d'UNE formation (ex: « CAP
// Restauration — Année 1 »), jamais partagé entre années — exactement comme un
// bloc de lycée en Cursus (src/lib/programmeCards.ts) : pour créer l'année
// suivante, on duplique le bloc.
//
// Tout est délibérément du texte libre (formation, année, diplôme, durée) :
// le métier de chaque école n'est pas le nôtre, à elle de nommer ses choses.
// ═══════════════════════════════════════════════════════════════════════════

export interface FormationBloc {
  id: string;
  formationName: string;
  anneeLabel: string;
  diplome?: string;
  duree?: string;
  description?: string;
  ordering: number;
  createdAt: string;
}

export type FormationMatiereType = 'obligatoire' | 'facultative';
export type FormationMatiereNature = 'theorique' | 'pratique' | 'stage';

export interface FormationMatiere {
  id: string;
  blocId: string;
  type: FormationMatiereType;
  name: string;
  coefficient: number;
  volumeHoraire?: number;
  nature: FormationMatiereNature;
  ordering: number;
}

export interface FormationChoixOption {
  id: string;
  subjectName: string;
}

export interface FormationChoixGroup {
  id: string;
  blocId: string;
  label: string;
  coefficient: number;
  ordering: number;
  options: FormationChoixOption[];
}

export const NATURE_LABELS: Record<FormationMatiereNature, string> = {
  theorique: 'Théorique',
  pratique: 'Pratique',
  stage: 'Stage',
};

// ─── Totaux d'un bloc ───────────────────────────────────────────────────────
// Coefficients des matières obligatoires ET facultatives (une facultative
// activée compte comme les autres — la distinction ne sert qu'à l'affichage),
// des créneaux au choix (un seul coefficient par créneau, quel que soit le
// nombre d'options), et somme des volumes horaires renseignés (un volume
// vide ne compte pas comme zéro, il est simplement absent du total).
export interface TotauxBloc {
  nbMatieres: number;
  totalCoef: number;
  totalHeures: number;
  /** `true` si au moins une matière n'a pas de volume horaire renseigné. */
  heuresIncompletes: boolean;
}

export const totauxBloc = (matieres: FormationMatiere[], choix: FormationChoixGroup[]): TotauxBloc => {
  const heuresRenseignees = matieres.filter(m => m.volumeHoraire != null);
  return {
    nbMatieres: matieres.length + choix.length,
    totalCoef: matieres.reduce((s, m) => s + m.coefficient, 0) + choix.reduce((s, c) => s + c.coefficient, 0),
    totalHeures: heuresRenseignees.reduce((s, m) => s + (m.volumeHoraire ?? 0), 0),
    heuresIncompletes: heuresRenseignees.length < matieres.length,
  };
};

// ─── Validation ─────────────────────────────────────────────────────────────

export const nomBlocValide = (formationName: string, anneeLabel: string): boolean =>
  formationName.trim() !== '' && anneeLabel.trim() !== '';

export const coefficientValide = (v: number): boolean => Number.isFinite(v) && v > 0;

export const volumeHoraireValide = (v: number | undefined): boolean =>
  v === undefined || (Number.isFinite(v) && v >= 0);

// ─── Coefficients : réservés au directeur général ──────────────────────────
// À la demande d'IFHO : n'importe quel membre du personnel ayant accès à
// Formations (permission « Notes ») peut créer des matières et organiser le
// programme, mais SEUL le compte admin_school (directeur général) peut fixer
// ou modifier un coefficient — celui d'une matière comme d'un créneau au
// choix. Un import (fichier ou modèle) fixe aussi des coefficients : il est
// donc réservé au même titre, pour qu'un import ne serve pas à contourner la
// restriction du formulaire.
export const peutModifierCoefficients = (accountRole: string | null | undefined): boolean => accountRole === 'admin';

/** Deux matières ne peuvent pas porter le même nom dans le même bloc (insensible à la casse/aux espaces). */
export const nomMatiereDejaPris = (
  matieres: FormationMatiere[], name: string, blocId: string, excludeId?: string,
): boolean => {
  const norm = name.trim().toLowerCase();
  return matieres.some(m => m.blocId === blocId && m.id !== excludeId && m.name.trim().toLowerCase() === norm);
};

// ─── Libellé d'une carte de bloc ────────────────────────────────────────────
export const libelleBloc = (bloc: Pick<FormationBloc, 'formationName' | 'anneeLabel'>): string =>
  `${bloc.formationName} — ${bloc.anneeLabel}`;

export const triBlocs = (blocs: FormationBloc[]): FormationBloc[] =>
  [...blocs].sort((a, b) =>
    a.formationName.localeCompare(b.formationName, 'fr') || a.ordering - b.ordering);

// ─── Export / import (même esprit que le programme de Cursus) ─────────────

export interface FormationExport {
  type: 'senclass_formation_pro_export';
  version: 1;
  exportedAt: string;
  blocs: {
    formationName: string;
    anneeLabel: string;
    diplome?: string;
    duree?: string;
    description?: string;
    matieres: { type: FormationMatiereType; name: string; coefficient: number; volumeHoraire?: number; nature: FormationMatiereNature }[];
    choixGroups: { label: string; coefficient: number; options: string[] }[];
  }[];
}

export const construireExport = (
  blocs: FormationBloc[], matieres: FormationMatiere[], choixGroups: FormationChoixGroup[],
  maintenant: Date = new Date(),
): FormationExport => ({
  type: 'senclass_formation_pro_export',
  version: 1,
  exportedAt: maintenant.toISOString(),
  blocs: triBlocs(blocs).map(b => ({
    formationName: b.formationName, anneeLabel: b.anneeLabel, diplome: b.diplome, duree: b.duree, description: b.description,
    matieres: matieres.filter(m => m.blocId === b.id).sort((a, c) => a.ordering - c.ordering)
      .map(m => ({ type: m.type, name: m.name, coefficient: m.coefficient, volumeHoraire: m.volumeHoraire, nature: m.nature })),
    choixGroups: choixGroups.filter(c => c.blocId === b.id).sort((a, c) => a.ordering - c.ordering)
      .map(c => ({ label: c.label, coefficient: c.coefficient, options: c.options.map(o => o.subjectName) })),
  })),
});

/** Ne lève jamais : renvoie `null` sur un fichier qui n'est manifestement pas un export de ce type. */
export const analyserImport = (brut: unknown): FormationExport | null => {
  if (!brut || typeof brut !== 'object') return null;
  const o = brut as Record<string, unknown>;
  if (o.type !== 'senclass_formation_pro_export' || !Array.isArray(o.blocs)) return null;
  return o as unknown as FormationExport;
};
