import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { estFormationPro } from '@/lib/modeGestion';
import type {
  Examen, ExamenTour, ExamenEpreuve, ExamenNote, ExamenResultat, TypeExamen, StatutNoteExamen, Decision, Mention,
} from '@/lib/formationPro';

// ═══════════════════════════════════════════════════════════════════════════
// DONNÉES DES EXAMENS (formation professionnelle, étape 4)
//
// À part de FormationProContext : ces six tables ne sont lues que sur les
// pages Examens (le fournisseur enveloppe leurs routes, voir App.tsx), pas à
// chaque écran du tableau de bord.
//
// Le verrouillage est tenu par la base (docs/sql/formation_pro_examens.sql) :
// si l'écran se trompe, l'écriture est refusée — l'erreur remonte telle quelle.
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapExamen = (r: any): Examen => ({
  id: r.id, promotionId: r.promotion_id, name: r.name, type: r.type, reference: r.reference ?? undefined,
  seuilAdmission: Number(r.seuil_admission), dateDebut: r.date_debut ?? undefined, dateFin: r.date_fin ?? undefined,
  verrouille: !!r.verrouille, verrouilleLe: r.verrouille_le ?? undefined, createdAt: r.created_at,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapTour = (r: any): ExamenTour => ({ id: r.id, examenId: r.examen_id, name: r.name, ordering: r.ordering ?? 0 });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapEpreuve = (r: any): ExamenEpreuve => ({
  id: r.id, tourId: r.tour_id, niveauMatiereId: r.niveau_matiere_id ?? undefined, nom: r.nom,
  coefficient: Number(r.coefficient), bareme: Number(r.bareme),
  seuilEliminatoire: r.seuil_eliminatoire == null ? undefined : Number(r.seuil_eliminatoire),
  date: r.date ?? undefined, heure: r.heure ? String(r.heure).slice(0, 5) : undefined,
  salle: r.salle ?? undefined, examinateurs: r.examinateurs ?? undefined, ordering: r.ordering ?? 0,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapNote = (r: any): ExamenNote => ({
  id: r.id, epreuveId: r.epreuve_id, studentEnrollmentId: r.student_enrollment_id,
  valeur: r.valeur == null ? undefined : Number(r.valeur), statut: r.statut,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapResultat = (r: any): ExamenResultat => ({
  id: r.id, examenId: r.examen_id, studentEnrollmentId: r.student_enrollment_id,
  decision: r.decision ?? undefined, mention: r.mention ?? undefined,
  moyenne: r.moyenne == null ? undefined : Number(r.moyenne), elimine: !!r.elimine,
});

export type DonneesExamen = {
  name: string; type: TypeExamen; reference?: string; seuilAdmission: number; dateDebut?: string; dateFin?: string;
};
export type DonneesEpreuve = {
  nom: string; coefficient: number; bareme: number; seuilEliminatoire?: number; niveauMatiereId?: string;
  date?: string; heure?: string; salle?: string; examinateurs?: string;
};
/** Ce qui est figé pour chaque candidat au moment du verrouillage. */
export type ResultatAFiger = {
  studentEnrollmentId: string; decision: Decision; mention: Mention | null; moyenne: number | null; elimine: boolean;
};

const epreuveVersLigne = (data: Partial<DonneesEpreuve>): Record<string, unknown> => {
  const l: Record<string, unknown> = {};
  if (data.nom !== undefined) l.nom = data.nom.trim();
  if (data.coefficient !== undefined) l.coefficient = data.coefficient;
  if (data.bareme !== undefined) l.bareme = data.bareme;
  if ('seuilEliminatoire' in data) l.seuil_eliminatoire = data.seuilEliminatoire ?? null;
  if ('niveauMatiereId' in data) l.niveau_matiere_id = data.niveauMatiereId ?? null;
  if ('date' in data) l.date = data.date || null;
  if ('heure' in data) l.heure = data.heure || null;
  if ('salle' in data) l.salle = data.salle?.trim() || null;
  if ('examinateurs' in data) l.examinateurs = data.examinateurs?.trim() || null;
  return l;
};

interface ExamensContextType {
  loading: boolean;
  /** `false` si les tables n'existent pas encore (SQL pas encore appliqué). */
  disponible: boolean;
  examens: Examen[];
  tours: ExamenTour[];
  epreuves: ExamenEpreuve[];
  candidats: { examenId: string; studentEnrollmentId: string }[];
  notes: ExamenNote[];
  resultats: ExamenResultat[];

  /** Crée l'examen, ses candidats (les élèves donnés) et, si fournies, ses épreuves par tour. */
  addExamen: (
    promotionId: string, data: DonneesExamen, candidats: string[],
    structure?: { tour: string; epreuves: DonneesEpreuve[] }[],
  ) => Promise<Examen>;
  updateExamen: (id: string, data: Partial<DonneesExamen>) => Promise<void>;
  deleteExamen: (id: string) => Promise<void>;

  addTour: (examenId: string, name: string) => Promise<ExamenTour>;
  updateTour: (id: string, name: string) => Promise<void>;
  deleteTour: (id: string) => Promise<void>;

  addEpreuve: (tourId: string, data: DonneesEpreuve) => Promise<ExamenEpreuve>;
  updateEpreuve: (id: string, data: Partial<DonneesEpreuve>) => Promise<void>;
  deleteEpreuve: (id: string) => Promise<void>;

  ajouterCandidat: (examenId: string, studentEnrollmentId: string) => Promise<void>;
  retirerCandidat: (examenId: string, studentEnrollmentId: string) => Promise<void>;

  saisirNote: (epreuveId: string, studentEnrollmentId: string, data: { valeur?: number; statut: StatutNoteExamen }) => Promise<void>;
  supprimerNote: (epreuveId: string, studentEnrollmentId: string) => Promise<void>;

  /** Décision / mention choisies par le jury (`null` : revenir à la proposition). */
  choisirDecision: (examenId: string, studentEnrollmentId: string, data: { decision?: Decision | null; mention?: Mention | null }) => Promise<void>;
  /** Fige moyenne, élimination, décision et mention de chaque candidat, puis verrouille (directeur). */
  verrouiller: (examenId: string, resultats: ResultatAFiger[]) => Promise<void>;
  deverrouiller: (examenId: string) => Promise<void>;
}

const ExamensContext = createContext<ExamensContextType | null>(null);

export const ExamensProvider = ({ children }: { children?: ReactNode }) => {
  const { school, isSchoolAccessBlocked } = useAuth();
  const schoolId: string | null = school?.id ?? null;
  const actif = estFormationPro(school) && !isSchoolAccessBlocked;

  const [loading, setLoading] = useState(true);
  const [disponible, setDisponible] = useState(true);
  const [examens, setExamens] = useState<Examen[]>([]);
  const [tours, setTours] = useState<ExamenTour[]>([]);
  const [epreuves, setEpreuves] = useState<ExamenEpreuve[]>([]);
  const [candidats, setCandidats] = useState<{ examenId: string; studentEnrollmentId: string }[]>([]);
  const [notes, setNotes] = useState<ExamenNote[]>([]);
  const [resultats, setResultats] = useState<ExamenResultat[]>([]);

  useEffect(() => {
    let annule = false;
    if (!schoolId || !actif) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const [eRes, tRes, epRes, cRes, nRes, rRes] = await Promise.all([
        sb.from('fp_examens').select('*').eq('school_id', schoolId).order('created_at'),
        sb.from('fp_examen_tours').select('*').eq('school_id', schoolId).order('ordering'),
        sb.from('fp_examen_epreuves').select('*').eq('school_id', schoolId).order('ordering'),
        sb.from('fp_examen_candidats').select('examen_id, student_enrollment_id').eq('school_id', schoolId),
        sb.from('fp_examen_notes').select('*').eq('school_id', schoolId),
        sb.from('fp_examen_resultats').select('*').eq('school_id', schoolId),
      ]);
      if (annule) return;
      setDisponible(!eRes.error);
      setExamens((eRes.data ?? []).map(mapExamen));
      setTours((tRes.data ?? []).map(mapTour));
      setEpreuves((epRes.data ?? []).map(mapEpreuve));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCandidats((cRes.data ?? []).map((r: any) => ({ examenId: r.examen_id, studentEnrollmentId: r.student_enrollment_id })));
      setNotes((nRes.data ?? []).map(mapNote));
      setResultats((rRes.data ?? []).map(mapResultat));
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [schoolId, actif]);

  const toursRef = useRef(tours); toursRef.current = tours;
  const epreuvesRef = useRef(epreuves); epreuvesRef.current = epreuves;
  const notesRef = useRef(notes); notesRef.current = notes;
  const resultatsRef = useRef(resultats); resultatsRef.current = resultats;

  // ── Examens ───────────────────────────────────────────────────────────────
  const addExamen = useCallback<ExamensContextType['addExamen']>(async (promotionId, data, eleves, structure) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const { data: row, error } = await sb.from('fp_examens').insert({
      school_id: sid, promotion_id: promotionId, name: data.name.trim(), type: data.type,
      reference: data.reference?.trim() || null, seuil_admission: data.seuilAdmission,
      date_debut: data.dateDebut || null, date_fin: data.dateFin || null,
    }).select().single();
    if (error) throw error;
    const examen = mapExamen(row);
    setExamens(prev => [...prev, examen]);

    if (eleves.length > 0) {
      const { error: errC } = await sb.from('fp_examen_candidats').insert(
        eleves.map(id => ({ school_id: sid, examen_id: examen.id, student_enrollment_id: id })),
      );
      if (errC) throw errC;
      setCandidats(prev => [...prev, ...eleves.map(id => ({ examenId: examen.id, studentEnrollmentId: id }))]);
    }

    for (const [i, bloc] of (structure ?? []).entries()) {
      const { data: tRow, error: errT } = await sb.from('fp_examen_tours').insert({
        school_id: sid, examen_id: examen.id, name: bloc.tour, ordering: i,
      }).select().single();
      if (errT) throw errT;
      const tour = mapTour(tRow);
      setTours(prev => [...prev, tour]);
      if (bloc.epreuves.length === 0) continue;
      const { data: epRows, error: errE } = await sb.from('fp_examen_epreuves').insert(
        bloc.epreuves.map((ep, j) => ({ school_id: sid, tour_id: tour.id, ordering: j, ...epreuveVersLigne(ep) })),
      ).select();
      if (errE) throw errE;
      setEpreuves(prev => [...prev, ...(epRows ?? []).map(mapEpreuve)]);
    }
    return examen;
  }, [schoolId]);

  const updateExamen = useCallback(async (id: string, data: Partial<DonneesExamen>) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.type !== undefined) patch.type = data.type;
    if ('reference' in data) patch.reference = data.reference?.trim() || null;
    if (data.seuilAdmission !== undefined) patch.seuil_admission = data.seuilAdmission;
    if ('dateDebut' in data) patch.date_debut = data.dateDebut || null;
    if ('dateFin' in data) patch.date_fin = data.dateFin || null;
    const { error } = await sb.from('fp_examens').update(patch).eq('id', id).eq('school_id', sid);
    if (error) throw error;
    setExamens(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  }, [schoolId]);

  const deleteExamen = useCallback(async (id: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const { error } = await sb.from('fp_examens').delete().eq('id', id).eq('school_id', sid);
    if (error) throw error;
    const idsTours = new Set(toursRef.current.filter(t => t.examenId === id).map(t => t.id));
    const idsEpreuves = new Set(epreuvesRef.current.filter(e => idsTours.has(e.tourId)).map(e => e.id));
    setExamens(prev => prev.filter(e => e.id !== id));
    setTours(prev => prev.filter(t => t.examenId !== id));
    setEpreuves(prev => prev.filter(e => !idsTours.has(e.tourId)));
    setNotes(prev => prev.filter(n => !idsEpreuves.has(n.epreuveId)));
    setCandidats(prev => prev.filter(c => c.examenId !== id));
    setResultats(prev => prev.filter(r => r.examenId !== id));
  }, [schoolId]);

  // ── Tours ─────────────────────────────────────────────────────────────────
  const addTour = useCallback(async (examenId: string, name: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const ordering = toursRef.current.filter(t => t.examenId === examenId).length;
    const { data: row, error } = await sb.from('fp_examen_tours').insert({ school_id: sid, examen_id: examenId, name: name.trim(), ordering }).select().single();
    if (error) throw error;
    const tour = mapTour(row);
    setTours(prev => [...prev, tour]);
    return tour;
  }, [schoolId]);

  const updateTour = useCallback(async (id: string, name: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const { error } = await sb.from('fp_examen_tours').update({ name: name.trim() }).eq('id', id).eq('school_id', sid);
    if (error) throw error;
    setTours(prev => prev.map(t => t.id === id ? { ...t, name: name.trim() } : t));
  }, [schoolId]);

  const deleteTour = useCallback(async (id: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const { error } = await sb.from('fp_examen_tours').delete().eq('id', id).eq('school_id', sid);
    if (error) throw error;
    const idsEpreuves = new Set(epreuvesRef.current.filter(e => e.tourId === id).map(e => e.id));
    setTours(prev => prev.filter(t => t.id !== id));
    setEpreuves(prev => prev.filter(e => e.tourId !== id));
    setNotes(prev => prev.filter(n => !idsEpreuves.has(n.epreuveId)));
  }, [schoolId]);

  // ── Épreuves ──────────────────────────────────────────────────────────────
  const addEpreuve = useCallback(async (tourId: string, data: DonneesEpreuve) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const ordering = epreuvesRef.current.filter(e => e.tourId === tourId).length;
    const { data: row, error } = await sb.from('fp_examen_epreuves').insert({
      school_id: sid, tour_id: tourId, ordering, ...epreuveVersLigne(data),
    }).select().single();
    if (error) throw error;
    const ep = mapEpreuve(row);
    setEpreuves(prev => [...prev, ep]);
    return ep;
  }, [schoolId]);

  const updateEpreuve = useCallback(async (id: string, data: Partial<DonneesEpreuve>) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const { error } = await sb.from('fp_examen_epreuves').update(epreuveVersLigne(data)).eq('id', id).eq('school_id', sid);
    if (error) throw error;
    setEpreuves(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  }, [schoolId]);

  const deleteEpreuve = useCallback(async (id: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const { error } = await sb.from('fp_examen_epreuves').delete().eq('id', id).eq('school_id', sid);
    if (error) throw error;
    setEpreuves(prev => prev.filter(e => e.id !== id));
    setNotes(prev => prev.filter(n => n.epreuveId !== id));
  }, [schoolId]);

  // ── Candidats ─────────────────────────────────────────────────────────────
  const ajouterCandidat = useCallback(async (examenId: string, studentEnrollmentId: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const { error } = await sb.from('fp_examen_candidats').insert({ school_id: sid, examen_id: examenId, student_enrollment_id: studentEnrollmentId });
    if (error) throw error;
    setCandidats(prev => [...prev, { examenId, studentEnrollmentId }]);
  }, [schoolId]);

  const retirerCandidat = useCallback(async (examenId: string, studentEnrollmentId: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const { error } = await sb.from('fp_examen_candidats').delete()
      .eq('examen_id', examenId).eq('student_enrollment_id', studentEnrollmentId).eq('school_id', sid);
    if (error) throw error;
    // Ses notes restent en base : réintégré, il les retrouve.
    setCandidats(prev => prev.filter(c => !(c.examenId === examenId && c.studentEnrollmentId === studentEnrollmentId)));
  }, [schoolId]);

  // ── Notes ─────────────────────────────────────────────────────────────────
  const saisirNote = useCallback<ExamensContextType['saisirNote']>(async (epreuveId, studentEnrollmentId, data) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const valeur = data.statut === 'note' ? (data.valeur ?? null) : null;
    const existante = notesRef.current.find(n => n.epreuveId === epreuveId && n.studentEnrollmentId === studentEnrollmentId);
    if (existante) {
      if (existante.statut === data.statut && (existante.valeur ?? null) === valeur) return;
      const { error } = await sb.from('fp_examen_notes').update({ valeur, statut: data.statut, updated_at: new Date().toISOString() })
        .eq('id', existante.id).eq('school_id', sid);
      if (error) throw error;
      const maj: ExamenNote = { ...existante, valeur: valeur ?? undefined, statut: data.statut };
      notesRef.current = notesRef.current.map(n => n.id === existante.id ? maj : n);
      setNotes(prev => prev.map(n => n.id === existante.id ? maj : n));
    } else {
      const { data: row, error } = await sb.from('fp_examen_notes').insert({
        school_id: sid, epreuve_id: epreuveId, student_enrollment_id: studentEnrollmentId, valeur, statut: data.statut,
      }).select().single();
      if (error) throw error;
      const note = mapNote(row);
      notesRef.current = [...notesRef.current, note];
      setNotes(prev => [...prev, note]);
    }
  }, [schoolId]);

  const supprimerNote = useCallback(async (epreuveId: string, studentEnrollmentId: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const existante = notesRef.current.find(n => n.epreuveId === epreuveId && n.studentEnrollmentId === studentEnrollmentId);
    if (!existante) return;
    const { error } = await sb.from('fp_examen_notes').delete().eq('id', existante.id).eq('school_id', sid);
    if (error) throw error;
    notesRef.current = notesRef.current.filter(n => n.id !== existante.id);
    setNotes(prev => prev.filter(n => n.id !== existante.id));
  }, [schoolId]);

  // ── Décisions du jury et verrouillage ────────────────────────────────────
  const choisirDecision = useCallback<ExamensContextType['choisirDecision']>(async (examenId, studentEnrollmentId, data) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const existant = resultatsRef.current.find(r => r.examenId === examenId && r.studentEnrollmentId === studentEnrollmentId);
    const suite = {
      decision: 'decision' in data ? data.decision ?? undefined : existant?.decision,
      mention: 'mention' in data ? data.mention ?? undefined : existant?.mention,
    };
    const { data: row, error } = await sb.from('fp_examen_resultats').upsert({
      school_id: sid, examen_id: examenId, student_enrollment_id: studentEnrollmentId,
      decision: suite.decision ?? null, mention: suite.mention ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: 'examen_id,student_enrollment_id' }).select().single();
    if (error) throw error;
    const r = mapResultat(row);
    resultatsRef.current = [...resultatsRef.current.filter(x => x.id !== r.id), r];
    setResultats(prev => [...prev.filter(x => x.id !== r.id), r]);
  }, [schoolId]);

  const verrouiller = useCallback(async (examenId: string, aFiger: ResultatAFiger[]) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    // D'abord les résultats (tant que l'examen est ouvert), puis le verrou.
    if (aFiger.length > 0) {
      const { data: rows, error } = await sb.from('fp_examen_resultats').upsert(aFiger.map(r => ({
        school_id: sid, examen_id: examenId, student_enrollment_id: r.studentEnrollmentId,
        decision: r.decision, mention: r.decision === 'admis' ? r.mention : null,
        moyenne: r.moyenne == null ? null : Math.round(r.moyenne * 100) / 100, elimine: r.elimine,
        updated_at: new Date().toISOString(),
      })), { onConflict: 'examen_id,student_enrollment_id' }).select();
      if (error) throw error;
      const figes = (rows ?? []).map(mapResultat);
      const ids = new Set(figes.map(r => r.id));
      setResultats(prev => [...prev.filter(r => !ids.has(r.id)), ...figes]);
    }
    const maintenant = new Date().toISOString();
    const { error } = await sb.from('fp_examens').update({ verrouille: true, verrouille_le: maintenant }).eq('id', examenId).eq('school_id', sid);
    if (error) throw error;
    setExamens(prev => prev.map(e => e.id === examenId ? { ...e, verrouille: true, verrouilleLe: maintenant } : e));
  }, [schoolId]);

  const deverrouiller = useCallback(async (examenId: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const sid = schoolId;
    const { error } = await sb.from('fp_examens').update({ verrouille: false, verrouille_le: null }).eq('id', examenId).eq('school_id', sid);
    if (error) throw error;
    setExamens(prev => prev.map(e => e.id === examenId ? { ...e, verrouille: false, verrouilleLe: undefined } : e));
  }, [schoolId]);

  const value = useMemo<ExamensContextType>(() => ({
    loading, disponible, examens, tours, epreuves, candidats, notes, resultats,
    addExamen, updateExamen, deleteExamen, addTour, updateTour, deleteTour,
    addEpreuve, updateEpreuve, deleteEpreuve, ajouterCandidat, retirerCandidat,
    saisirNote, supprimerNote, choisirDecision, verrouiller, deverrouiller,
  }), [loading, disponible, examens, tours, epreuves, candidats, notes, resultats,
      addExamen, updateExamen, deleteExamen, addTour, updateTour, deleteTour,
      addEpreuve, updateEpreuve, deleteEpreuve, ajouterCandidat, retirerCandidat,
      saisirNote, supprimerNote, choisirDecision, verrouiller, deverrouiller]);

  return <ExamensContext.Provider value={value}>{children ?? <Outlet />}</ExamensContext.Provider>;
};

export const useExamens = (): ExamensContextType => {
  const ctx = useContext(ExamensContext);
  if (!ctx) throw new Error('useExamens must be used within ExamensProvider');
  return ctx;
};
