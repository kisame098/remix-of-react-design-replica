import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useExamens } from '@/contexts/ExamensContext';
import { useStages } from '@/contexts/StagesContext';
import { useSchool } from '@/contexts/SchoolContext';
import { infosEcole, type EcoleSource } from '@/lib/documentsEcole';
import {
  recapitulatifComplet, evaluationsDepuisExamens, dureeStageJours, libelleDuree, triPeriodes, LIBELLES_RYTHME,
} from '@/lib/formationPro';
import {
  bulletinsDepuisRecapitulatif, planningExamen, libelleTypeExamen,
  type DonneesBulletins, type DocumentOfficiel, type TypeDocumentOfficiel, type ContenuDocumentOfficiel,
} from '@/lib/documentsFormationPro';
import type { DonneesConvocations, DonneesAttestationStage } from '@/lib/documentsFormationProPdf';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/**
 * Rassemble, à partir des données déjà chargées (formations, évaluations,
 * examens, stages), ce que chaque document imprime. Aucun calcul propre :
 * les moyennes sont celles du récapitulatif d'Évaluations.
 */
export const useDonneesDocuments = () => {
  const { school } = useAuth();
  const fp = useFormationPro();
  const ex = useExamens();
  const st = useStages();
  const { students } = useSchool();
  const ecole = infosEcole(school as EcoleSource | null);

  const contexte = (promotionId: string) => {
    const promotion = fp.promotions.find(p => p.id === promotionId);
    const niveau = promotion ? fp.niveaux.find(n => n.id === promotion.niveauId) : undefined;
    const formation = niveau ? fp.formations.find(f => f.id === niveau.formationId) : undefined;
    return { promotion, niveau, formation };
  };

  const bulletins = (promotionId: string, periodeId: string, eleveIds?: string[]): DonneesBulletins | null => {
    const { promotion, niveau, formation } = contexte(promotionId);
    const periode = fp.periodes.find(p => p.id === periodeId);
    if (!promotion || !niveau || !formation || !periode) return null;
    const matieres = fp.niveauMatieres.filter(m => m.niveauId === niveau.id);
    const categories = fp.baremeCategories.filter(c => c.formationId === formation.id).sort((a, b) => a.ordering - b.ordering);
    const eleves = students.filter(s => s.classId === promotion.classId);
    const depuisExamens = evaluationsDepuisExamens(promotionId, categories, ex.examens, ex.tours, ex.epreuves, ex.notes);
    const recap = recapitulatifComplet({
      promotionId, periodeId, eleveIds: eleves.map(s => s.id), matieres, categories,
      evaluations: fp.evaluations, notes: fp.notes, depuisExamens, stages: st.stages,
    });
    const r = bulletinsDepuisRecapitulatif(recap, matieres, eleves);
    return {
      ecole, formation: formation.name, niveau: niveau.name, promotion: promotion.name,
      periode: { nom: periode.name, debut: periode.startDate, fin: periode.endDate },
      formule: categories.map(c => `${c.name} ${c.pourcentage} %`).join(' · '),
      effectifClasse: r.effectifClasse, moyennePromotion: r.moyennePromotion,
      eleves: eleveIds ? r.bulletins.filter(b => eleveIds.includes(b.studentEnrollmentId)) : r.bulletins,
    };
  };

  const convocations = (examenId: string, eleveIds?: string[]): DonneesConvocations | null => {
    const examen = ex.examens.find(x => x.id === examenId);
    if (!examen) return null;
    const { promotion, niveau, formation } = contexte(examen.promotionId);
    const ids = new Set(ex.candidats.filter(c => c.examenId === examenId).map(c => c.studentEnrollmentId));
    const candidats = students
      .filter(s => ids.has(s.id) && (!eleveIds || eleveIds.includes(s.id)))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr'))
      .map(s => ({ nom: s.lastName, prenoms: s.firstName, matricule: s.studentId, sexe: s.sex }));
    return {
      ecole,
      examen: { nom: examen.name, typeLibelle: libelleTypeExamen(examen.type), reference: examen.reference, dateDebut: examen.dateDebut, dateFin: examen.dateFin },
      formation: formation?.name ?? '', niveau: niveau?.name ?? '', promotion: promotion?.name ?? '',
      planning: planningExamen(examenId, ex.tours, ex.epreuves),
      candidats,
    };
  };

  const attestationStage = (stageId: string): DonneesAttestationStage | null => {
    const stage = st.stages.find(s => s.id === stageId);
    const eleve = stage ? students.find(s => s.id === stage.studentEnrollmentId) : undefined;
    if (!stage || !eleve) return null;
    const { promotion, niveau, formation } = contexte(stage.promotionId);
    return {
      ecole,
      eleve: { nom: eleve.lastName, prenoms: eleve.firstName, matricule: eleve.studentId, sexe: eleve.sex },
      formation: formation?.name ?? '', niveau: niveau?.name ?? '', promotion: promotion?.name ?? '',
      entreprise: st.entreprises.find(e => e.id === stage.entrepriseId)?.nom ?? 'l\'entreprise d\'accueil',
      poste: stage.poste, dateDebut: stage.dateDebut, dateFin: stage.dateFin,
      duree: libelleDuree(dureeStageJours(stage.dateDebut, stage.dateFin)) || undefined,
    };
  };

  /** Ce qui sera FIGÉ dans un document officiel au moment de son émission. */
  const contenuOfficiel = (eleveId: string, promotionId: string, examenId?: string): ContenuDocumentOfficiel | null => {
    const eleve = students.find(s => s.id === eleveId);
    const { promotion, niveau, formation } = contexte(promotionId);
    if (!eleve || !promotion || !niveau || !formation) return null;
    const ecoleSansLogo = { ...ecole, logo: undefined };
    const examen = examenId ? ex.examens.find(x => x.id === examenId) : undefined;
    const resultat = examen ? ex.resultats.find(r => r.examenId === examen.id && r.studentEnrollmentId === eleveId) : undefined;
    return {
      ecole: ecoleSansLogo,
      eleve: {
        nom: eleve.lastName, prenoms: eleve.firstName, matricule: eleve.studentId, sexe: eleve.sex,
        dateNaissance: eleve.dateOfBirth || undefined, lieuNaissance: eleve.placeOfBirth || undefined,
      },
      formation: {
        nom: formation.name, niveau: niveau.name, promotion: promotion.name, typeDiplome: formation.diplomaType,
        rythme: LIBELLES_RYTHME[promotion.rythme], dateDebut: promotion.startDate, dateFin: promotion.endDate,
      },
      examen: examen ? {
        nom: examen.name, type: examen.type, reference: examen.reference, dateDebut: examen.dateDebut, dateFin: examen.dateFin,
        moyenne: resultat?.moyenne, mention: resultat?.mention,
      } : undefined,
    };
  };

  return { ecole, bulletins, convocations, attestationStage, contenuOfficiel, periodesDe: (promotionId: string) => triPeriodes(fp.periodes.filter(p => p.promotionId === promotionId)) };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapDocument = (r: any): DocumentOfficiel => ({
  id: r.id, type: r.type, annee: r.annee, numero: r.numero, studentEnrollmentId: r.student_enrollment_id,
  promotionId: r.promotion_id ?? undefined, examenId: r.examen_id ?? undefined, contenu: r.contenu, emisLe: r.emis_le,
});

/** Les documents officiels déjà émis pour un élève, et l'émission d'un nouveau (numéro attribué par la base). */
export const useDocumentsOfficiels = (studentEnrollmentId: string | null) => {
  const [documents, setDocuments] = useState<DocumentOfficiel[]>([]);
  const [loading, setLoading] = useState(false);
  const [disponible, setDisponible] = useState(true);

  useEffect(() => {
    let annule = false;
    if (!studentEnrollmentId) { setDocuments([]); return; }
    setLoading(true);
    (async () => {
      const { data, error } = await sb.from('fp_documents_officiels').select('*')
        .eq('student_enrollment_id', studentEnrollmentId).order('emis_le', { ascending: false });
      if (annule) return;
      setDisponible(!error);
      setDocuments((data ?? []).map(mapDocument));
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [studentEnrollmentId]);

  const emettre = useCallback(async (
    type: TypeDocumentOfficiel, eleveId: string, promotionId: string, examenId: string | null, contenu: ContenuDocumentOfficiel,
  ): Promise<DocumentOfficiel> => {
    const { data, error } = await sb.rpc('fp_emettre_document', {
      p_type: type, p_student_enrollment_id: eleveId, p_promotion_id: promotionId, p_examen_id: examenId, p_contenu: contenu,
    });
    if (error) throw error;
    const doc = mapDocument(data);
    setDocuments(prev => [doc, ...prev]);
    return doc;
  }, []);

  return { documents, loading, disponible, emettre };
};
