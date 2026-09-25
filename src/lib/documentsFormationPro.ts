import type { InfosEcole } from '@/lib/documentsEcole';
import {
  type Examen, type ExamenEpreuve, type ExamenResultat, type ExamenTour, type LigneRecapitulatif, type Mention,
  type NiveauMatiere, type TypeExamen, type BaremeCategorie, type Evaluation, type Note,
  LIBELLES_MENTION, LIBELLES_TYPE_EXAMEN, triEpreuves, triTours, triEvaluationsChronologique, moyenneCategorie, convertirSur20,
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

// ─── Bulletin de période (format IFHO) ───────────────────────────────────────
// Lu sur le bulletin du second semestre 2023-2024 d'IFHO (ligne Français) :
//   DEV 1 18 · DEV 2 16 → MOY DEV 17 ; COMP 16 → MOY GEN (17 + 16) / 2 = 16,50
//   × coef 2 = 33,00 ; total 365,88 / 26 coef. = 14,07 (moyenne du semestre)
//   moyenne générale = (S1 15,55 + S2 14,07) / 2 = 14,81
// Les colonnes suivent la formule de la formation : chaque catégorie donne ses
// évaluations (DEV 1, DEV 2…) puis leur moyenne ; « Devoirs 50 % ·
// Composition 50 % » reproduit exactement ce bulletin.

/** Appréciation d'une moyenne. 12 / 14 / 16 : lues sur le bulletin d'IFHO ; Passable (10) et Insuffisant : supposés. */
export const appreciationMoyenne = (m: number | null): string => {
  if (m === null) return '';
  if (m >= 16) return 'Très bien';
  if (m >= 14) return 'Bien';
  if (m >= 12) return 'Assez bien';
  if (m >= 10) return 'Passable';
  return 'Insuffisant';
};

/**
 * Libellé d'une catégorie en tête de colonne du bulletin. Comme le veut
 * l'école : le contrôle continu s'imprime en devoirs (DEV 1, DEV 2…) et
 * l'examen final en composition (COMP).
 */
export const abregeCategorie = (nom: string): string => {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  const norme = sansAccents(mots[0] ?? '');
  const complet = sansAccents(nom.trim());
  if (complet.startsWith('controle continu')) return 'DEV';
  if (complet.startsWith('examen final')) return 'COMP';
  if (complet.startsWith('examen blanc')) return 'EX. BLANC';
  if (mots.length > 1) return mots.map(m => m[0]).join('').toUpperCase();
  if (norme.startsWith('dev')) return 'DEV';
  if (norme.startsWith('comp')) return 'COMP';
  if (norme.startsWith('interro')) return 'INT';
  return (mots[0] ?? '').slice(0, 4).toUpperCase();
};

export interface ColonneBulletin {
  categorieId: string;
  nom: string;
  abrege: string;
  /** Nombre de colonnes de notes (le maximum d'évaluations d'une matière dans la période). */
  nbNotes: number;
}

export interface CelluleCategorie { notes: string[]; moyenne: number | null }

export interface LigneBulletin {
  matiere: string;
  coefficient: number;
  /** Matière « Stage » : seule la moyenne (note du stage) est remplie. */
  stage: boolean;
  cellules: CelluleCategorie[];
  moyenne: number | null;
  appreciation: string;
}

export interface BulletinEleve {
  studentEnrollmentId: string;
  eleve: { nom: string; prenoms: string; matricule: string; dateNaissance?: string; lieuNaissance?: string };
  lignes: LigneBulletin[];
  moyenneGenerale: number | null;
  rang: number | null;
  /** Coefficients des seules matières notées (celles qui comptent dans la moyenne). */
  totalCoefficients: number;
  totalPoints: number;
  /** Les périodes jusqu'à celle du bulletin, avec la moyenne de l'élève. */
  recapitulatif: { periode: string; moyenne: number | null }[];
  /** Moyenne des périodes (affichée dès la 2e période). */
  moyenneAnnuelle: number | null;
}

export interface DonneesBulletins {
  ecole: InfosEcole;
  formation: string;
  niveau: string;
  promotion: string;
  periode: { nom: string; debut?: string; fin?: string };
  anneeScolaire?: string;
  colonnes: ColonneBulletin[];
  /** « Devoirs 50 % · Composition 50 % » — rappelé en petit. */
  formule: string;
  effectifClasse: number;
  moyennePromotion: number | null;
  eleves: BulletinEleve[];
}

type EleveSource = { id: string; lastName: string; firstName: string; studentId: string; dateOfBirth?: string; placeOfBirth?: string };

const formatNote = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

/**
 * Tous les bulletins d'une promotion pour une période. `evaluations` : celles
 * de la formule pour la promotion et la période (saisies + examens, voir
 * evaluationsDeLaFormule) ; `recaps` : le récapitulatif de chaque période
 * jusqu'à celle-ci incluse (la dernière = la période du bulletin).
 */
export const construireBulletins = (p: {
  matieres: Pick<NiveauMatiere, 'id' | 'matiereName' | 'coefficient' | 'nature' | 'ordering'>[];
  categories: BaremeCategorie[];
  evaluations: Evaluation[];
  notes: Note[];
  eleves: EleveSource[];
  recaps: { periode: string; lignes: LigneRecapitulatif[] }[];
}): { colonnes: ColonneBulletin[]; bulletins: BulletinEleve[]; effectifClasse: number; moyennePromotion: number | null } => {
  const matieres = [...p.matieres].sort((a, b) => a.ordering - b.ordering);
  const categories = [...p.categories].sort((a, b) => a.ordering - b.ordering);
  const evalsDe = (matiereId: string, categorieId: string) =>
    triEvaluationsChronologique(p.evaluations.filter(e => e.niveauMatiereId === matiereId && e.categorieId === categorieId));
  const colonnes = categories.map(c => ({
    categorieId: c.id,
    nom: c.name,
    abrege: abregeCategorie(c.name),
    nbNotes: Math.max(1, ...matieres.map(m => evalsDe(m.id, c.id).length)),
  }));
  const courant = p.recaps[p.recaps.length - 1]?.lignes ?? [];
  const parEleve = new Map(courant.map(l => [l.studentEnrollmentId, l]));
  const classes = courant.filter(l => l.generale !== null);

  const bulletins = [...p.eleves]
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'))
    .map(e => {
      const l = parEleve.get(e.id);
      const lignes: LigneBulletin[] = matieres.map(m => {
        const stage = m.nature === 'stage';
        const moyenne = l?.parMatiere[m.id] ?? null;
        const cellules = colonnes.map(col => {
          if (stage) return { notes: [], moyenne: null };
          const evs = evalsDe(m.id, col.categorieId);
          const notes = evs.map(ev => {
            const n = p.notes.find(x => x.evaluationId === ev.id && x.studentEnrollmentId === e.id);
            if (!n) return '';
            if (n.statut === 'note' && n.valeur != null) return formatNote(convertirSur20(n.valeur, ev.bareme));
            return n.statut === 'non_evalue' ? 'NE' : 'Abs';
          });
          return { notes, moyenne: evs.length ? moyenneCategorie(evs, p.notes, col.categorieId, e.id) : null };
        });
        return { matiere: m.matiereName, coefficient: m.coefficient, stage, cellules, moyenne, appreciation: appreciationMoyenne(moyenne) };
      });
      const notees = lignes.filter(x => x.moyenne !== null);
      const recapitulatif = p.recaps.map(r => ({ periode: r.periode, moyenne: r.lignes.find(x => x.studentEnrollmentId === e.id)?.generale ?? null }));
      const moyennesPeriodes = recapitulatif.map(r => r.moyenne).filter((m): m is number => m !== null);
      return {
        studentEnrollmentId: e.id,
        eleve: { nom: e.lastName, prenoms: e.firstName, matricule: e.studentId, dateNaissance: e.dateOfBirth || undefined, lieuNaissance: e.placeOfBirth || undefined },
        lignes,
        moyenneGenerale: l?.generale ?? null,
        rang: l?.rang ?? null,
        totalCoefficients: notees.reduce((t, x) => t + x.coefficient, 0),
        totalPoints: notees.reduce((t, x) => t + (x.moyenne as number) * x.coefficient, 0),
        recapitulatif,
        moyenneAnnuelle: moyennesPeriodes.length ? moyennesPeriodes.reduce((a, b) => a + b, 0) / moyennesPeriodes.length : null,
      };
    });
  return {
    colonnes, bulletins,
    effectifClasse: classes.length,
    moyennePromotion: classes.length ? classes.reduce((t, x) => t + (x.generale as number), 0) / classes.length : null,
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
