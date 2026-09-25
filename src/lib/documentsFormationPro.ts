import type { InfosEcole } from '@/lib/documentsEcole';
import {
  type Examen, type ExamenEpreuve, type ExamenResultat, type ExamenTour, type LigneRecapitulatif, type Mention,
  type NiveauMatiere, type TypeExamen, LIBELLES_MENTION, LIBELLES_TYPE_EXAMEN, triEpreuves, triTours,
} from '@/lib/formationPro';

// ═══════════════════════════════════════════════════════════════════════════
// DOCUMENTS DE LA FORMATION PROFESSIONNELLE — règles et données, sans dessin
//
// Documents ne stocke aucune note : il met en page ce qui existe (Évaluations,
// Examens, Stages). Les PDF sont dessinés dans documentsFormationProPdf.ts.
//
//   Fabriqués à la demande : bulletin de période, convocation d'examen,
//                            attestation de stage.
//   Numérotés et figés     : attestation d'inscription, attestation de
//                            réussite, diplôme (docs/sql/formation_pro_documents.sql).
// ═══════════════════════════════════════════════════════════════════════════

export type TypeDocumentOfficiel = 'attestation_inscription' | 'attestation_reussite' | 'diplome';

export const LIBELLES_DOCUMENT_OFFICIEL: Record<TypeDocumentOfficiel, string> = {
  attestation_inscription: "Attestation d'inscription",
  attestation_reussite: 'Attestation de réussite',
  diplome: 'Diplôme',
};

/** Préfixe du numéro — même forme que les reçus (REC-AAAA-NNNNN). Proposition, modifiable. */
export const PREFIXES_DOCUMENT: Record<TypeDocumentOfficiel, string> = {
  attestation_inscription: 'INS',
  attestation_reussite: 'REU',
  diplome: 'DIP',
};

/** « DIP-2026-00003 ». */
export const numeroDocument = (type: TypeDocumentOfficiel, annee: number, numero: number): string =>
  `${PREFIXES_DOCUMENT[type]}-${annee}-${String(numero).padStart(5, '0')}`;

/** Accord au féminin : « inscrit » → « inscrite » pour une élève. */
export const accord = (sexe: string | undefined, masculin: string): string =>
  sexe === 'femme' ? `${masculin}e` : masculin;

const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Un diplôme d'État est délivré par l'État, pas par l'école : pour ces
 * formations, l'école émet l'attestation de réussite, jamais le diplôme.
 */
export const estDiplomeDEtat = (typeDiplome: string | undefined): boolean =>
  !!typeDiplome && sansAccents(typeDiplome).includes("diplome d'etat");

/** Titre porté par le diplôme de l'établissement : « Certificat » si c'est le type de la formation, sinon « Diplôme ». */
export const titreDiplome = (typeDiplome: string | undefined): string =>
  typeDiplome && sansAccents(typeDiplome).includes('certificat') ? 'Certificat' : 'Diplôme';

/**
 * Pourquoi un document officiel ne peut PAS encore être émis (affiché au
 * survol du bouton), ou `null` s'il peut l'être.
 */
export const raisonNonEmettable = (
  type: TypeDocumentOfficiel,
  p: { estDirecteur: boolean; typeDiplome?: string; examen?: Pick<Examen, 'verrouille'>; resultat?: Pick<ExamenResultat, 'decision'> },
): string | null => {
  if (type === 'attestation_inscription') return null;
  if (!p.estDirecteur) return 'Réservé au directeur.';
  if (type === 'diplome' && estDiplomeDEtat(p.typeDiplome)) {
    return "Un diplôme d'État est délivré par l'État : l'école émet l'attestation de réussite.";
  }
  if (!p.examen) return 'Aucun examen verrouillé pour cet élève.';
  if (!p.examen.verrouille) return "L'examen doit d'abord être verrouillé (résultats définitifs).";
  if (p.resultat?.decision !== 'admis') return "L'élève n'est pas admis à cet examen.";
  return null;
};

// ─── Contenu figé d'un document officiel ─────────────────────────────────────

export interface ContenuDocumentOfficiel {
  /** Sans le logo (trop lourd à archiver) : le logo actuel est repris à l'impression. */
  ecole: Omit<InfosEcole, 'logo'>;
  eleve: { nom: string; prenoms: string; matricule: string; sexe?: string; dateNaissance?: string; lieuNaissance?: string };
  formation: {
    nom: string; niveau: string; promotion: string; typeDiplome?: string;
    rythme?: string; dateDebut?: string; dateFin?: string;
  };
  examen?: {
    nom: string; type: TypeExamen; reference?: string; dateDebut?: string; dateFin?: string;
    moyenne?: number; mention?: Mention;
  };
}

export interface DocumentOfficiel {
  id: string;
  type: TypeDocumentOfficiel;
  annee: number;
  numero: number;
  studentEnrollmentId: string;
  promotionId?: string;
  examenId?: string;
  contenu: ContenuDocumentOfficiel;
  emisLe: string;
}

export const libelleMention = (m?: Mention) => (m ? LIBELLES_MENTION[m] : undefined);
export const libelleTypeExamen = (t: TypeExamen) => LIBELLES_TYPE_EXAMEN[t];

// ─── Bulletin de période ─────────────────────────────────────────────────────

export interface LigneBulletin { matiere: string; coefficient: number; moyenne: number | null; stage: boolean }

export interface BulletinEleve {
  studentEnrollmentId: string;
  eleve: { nom: string; prenoms: string; matricule: string; dateNaissance?: string };
  lignes: LigneBulletin[];
  moyenneGenerale: number | null;
  rang: number | null;
  /** Coefficients des seules matières notées (celles qui comptent dans la moyenne). */
  totalCoefficients: number;
}

export interface DonneesBulletins {
  ecole: InfosEcole;
  formation: string;
  niveau: string;
  promotion: string;
  periode: { nom: string; debut?: string; fin?: string };
  /** « Contrôle continu 30 % · TP 30 % · … » — rappelé en bas du bulletin. */
  formule: string;
  /** Nombre d'élèves classés (ayant au moins une note). */
  effectifClasse: number;
  moyennePromotion: number | null;
  eleves: BulletinEleve[];
}

/** Un bulletin par élève, dans l'ordre alphabétique, à partir du récapitulatif de la période. */
export const bulletinsDepuisRecapitulatif = (
  recap: LigneRecapitulatif[],
  matieres: Pick<NiveauMatiere, 'id' | 'matiereName' | 'coefficient' | 'nature' | 'ordering'>[],
  eleves: { id: string; lastName: string; firstName: string; studentId: string; dateOfBirth?: string }[],
): { bulletins: BulletinEleve[]; effectifClasse: number; moyennePromotion: number | null } => {
  const triees = [...matieres].sort((a, b) => a.ordering - b.ordering);
  const parEleve = new Map(recap.map(l => [l.studentEnrollmentId, l]));
  const classes = recap.filter(l => l.generale !== null);
  const bulletins = [...eleves]
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'))
    .map(e => {
      const l = parEleve.get(e.id);
      const lignes = triees.map(m => ({ matiere: m.matiereName, coefficient: m.coefficient, moyenne: l?.parMatiere[m.id] ?? null, stage: m.nature === 'stage' }));
      return {
        studentEnrollmentId: e.id,
        eleve: { nom: e.lastName, prenoms: e.firstName, matricule: e.studentId, dateNaissance: e.dateOfBirth || undefined },
        lignes,
        moyenneGenerale: l?.generale ?? null,
        rang: l?.rang ?? null,
        totalCoefficients: lignes.filter(x => x.moyenne !== null).reduce((t, x) => t + x.coefficient, 0),
      };
    });
  return {
    bulletins,
    effectifClasse: classes.length,
    moyennePromotion: classes.length ? classes.reduce((t, l) => t + (l.generale as number), 0) / classes.length : null,
  };
};

/** « 1er », « 2e », « 3e ». */
export const rangOrdinal = (rang: number): string => (rang === 1 ? '1er' : `${rang}e`);

// ─── Convocation d'examen ────────────────────────────────────────────────────

export interface LigneConvocation { tour: string; epreuve: string; date?: string; heure?: string; salle?: string }

/** Le planning d'un examen, dans l'ordre des dates puis des tours. */
export const planningExamen = (examenId: string, tours: ExamenTour[], epreuves: ExamenEpreuve[]): LigneConvocation[] => {
  const siens = triTours(tours.filter(t => t.examenId === examenId));
  const lignes = siens.flatMap(t => triEpreuves(epreuves.filter(e => e.tourId === t.id))
    .map(e => ({ tour: t.name, epreuve: e.nom, date: e.date, heure: e.heure, salle: e.salle })));
  // Tri stable : sans date, l'ordre des tours est gardé et l'épreuve va à la fin.
  return lignes
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.date ?? '9999').localeCompare(b.l.date ?? '9999') || (a.l.heure ?? '').localeCompare(b.l.heure ?? '') || a.i - b.i)
    .map(x => x.l);
};
