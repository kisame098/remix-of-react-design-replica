import {
  type BaremeCategorie, type Evaluation, type Examen, type ExamenEpreuve, type ExamenNote, type ExamenTour,
  type NiveauMatiere, type Note, type Periode, type Stage,
  evaluationsDeLaFormule, evaluationsDepuisExamens, recapitulatifComplet, triPeriodes,
} from '@/lib/formationPro';

// ═══════════════════════════════════════════════════════════════════════════
// PORTAIL ÉLÈVE — notes d'une école de formation professionnelle
//
// L'élève ne lit que SES notes (docs/sql/formation_pro_portail_notes.sql) ;
// ses moyennes sont calculées par `recapitulatifComplet`, le même calcul que
// la rubrique Évaluations et les bulletins — jamais une formule à part.
// ═══════════════════════════════════════════════════════════════════════════

export interface DonneesNotesFormation {
  promotionId: string;
  eleveId: string;
  periodes: Periode[];
  matieres: Pick<NiveauMatiere, 'id' | 'matiereName' | 'coefficient' | 'nature' | 'ordering'>[];
  categories: BaremeCategorie[];
  evaluations: Evaluation[];
  notes: Note[];
  examens: Examen[];
  tours: ExamenTour[];
  epreuves: ExamenEpreuve[];
  notesExamen: ExamenNote[];
  stages: Stage[];
}

export interface LigneEvaluationEleve {
  evaluation: Evaluation;
  categorieName: string;
  note?: Note;
}

export interface MatiereEleve {
  id: string;
  name: string;
  coefficient: number;
  nature: NiveauMatiere['nature'];
  moyenne: number | null;
  evaluations: LigneEvaluationEleve[];
  /** Matière « Stage » : sa note vient du stage, pas d'évaluations. */
  noteDuStage: boolean;
}

export interface PeriodeEleve {
  generale: number | null;
  matieres: MatiereEleve[];
}

/** Période affichée d'abord : celle en cours ; sinon la dernière commencée ; sinon la première. */
export const periodeEnCours = (periodes: Periode[], aujourdhui: string): Periode | undefined => {
  const tries = triPeriodes(periodes);
  const enCours = tries.find(p => p.startDate && p.endDate && p.startDate <= aujourdhui && aujourdhui <= p.endDate);
  if (enCours) return enCours;
  const commencees = tries.filter(p => p.startDate && p.startDate <= aujourdhui);
  return commencees[commencees.length - 1] ?? tries[0];
};

export const notesDeLaPeriode = (d: DonneesNotesFormation, periodeId: string): PeriodeEleve => {
  const depuisExamens = evaluationsDepuisExamens(d.promotionId, d.categories, d.examens, d.tours, d.epreuves, d.notesExamen);
  const [ligne] = recapitulatifComplet({
    promotionId: d.promotionId, periodeId, eleveIds: [d.eleveId], matieres: d.matieres,
    categories: d.categories, evaluations: d.evaluations, notes: d.notes, depuisExamens, stages: d.stages,
  });
  // Mêmes évaluations que celles qui entrent dans la moyenne (une catégorie
  // alimentée par les examens ne montre pas d'anciennes saisies à la main).
  const formule = evaluationsDeLaFormule(d.evaluations.filter(e => e.promotionId === d.promotionId), d.notes, d.categories, depuisExamens);
  const nomCategorie = new Map(d.categories.map(c => [c.id, c.name]));

  const matieres = [...d.matieres].sort((a, b) => a.ordering - b.ordering).map(m => ({
    id: m.id,
    name: m.matiereName,
    coefficient: m.coefficient,
    nature: m.nature,
    moyenne: ligne?.parMatiere[m.id] ?? null,
    noteDuStage: m.nature === 'stage',
    evaluations: m.nature === 'stage' ? [] : formule.evaluations
      .filter(e => e.periodeId === periodeId && e.niveauMatiereId === m.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fr'))
      .map(e => ({
        evaluation: e,
        categorieName: nomCategorie.get(e.categorieId) ?? '',
        note: formule.notes.find(n => n.evaluationId === e.id && n.studentEnrollmentId === d.eleveId),
      })),
  }));
  return { generale: ligne?.generale ?? null, matieres };
};

// ─── Portail du formateur ───────────────────────────────────────────────────
export interface InscriptionPromotion {
  id: string;
  academicYearLabel: string;
  status?: string | null;
  firstName: string;
  lastName: string;
}

/**
 * Les élèves à noter dans une promotion : les inscrits actifs de sa classe,
 * pour l'année la plus récente où elle a des inscrits — une promotion qui
 * court sur deux années scolaires ne montre pas deux fois le même élève.
 */
export const elevesDeLaPromotion = (inscriptions: InscriptionPromotion[]): InscriptionPromotion[] => {
  const actives = inscriptions.filter(i => i.status !== 'withdrawn');
  const annee = actives.map(i => i.academicYearLabel).sort().pop();
  return actives
    .filter(i => i.academicYearLabel === annee)
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'));
};
