import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { estFormationPro } from '@/lib/modeGestion';
import { type Entreprise, type Stage, type VisiteStage, trouverEntreprise } from '@/lib/formationPro';

// ═══════════════════════════════════════════════════════════════════════════
// DONNÉES DES STAGES (formation professionnelle, étape 5)
//
// Chargées seulement sur les pages qui en ont besoin (Stages, et Évaluations
// puisque la note d'un stage remplit la matière « Stage ») — voir App.tsx.
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapEntreprise = (r: any): Entreprise => ({
  id: r.id, nom: r.nom, secteur: r.secteur ?? undefined, adresse: r.adresse ?? undefined,
  telephone: r.telephone ?? undefined, email: r.email ?? undefined, contact: r.contact ?? undefined,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapStage = (r: any): Stage => ({
  id: r.id, promotionId: r.promotion_id, studentEnrollmentId: r.student_enrollment_id,
  entrepriseId: r.entreprise_id ?? undefined, poste: r.poste ?? undefined, tuteur: r.tuteur ?? undefined,
  tuteurTelephone: r.tuteur_telephone ?? undefined, dateDebut: r.date_debut ?? undefined, dateFin: r.date_fin ?? undefined,
  conventionSignee: !!r.convention_signee, abandonne: !!r.abandonne,
  niveauMatiereId: r.niveau_matiere_id ?? undefined, periodeId: r.periode_id ?? undefined,
  note: r.note == null ? undefined : Number(r.note), appreciation: r.appreciation ?? undefined, createdAt: r.created_at,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapVisite = (r: any): VisiteStage => ({
  id: r.id, stageId: r.stage_id, date: r.date, visiteur: r.visiteur ?? undefined, observation: r.observation ?? undefined,
});

export type DonneesEntreprise = Omit<Entreprise, 'id'>;
export type DonneesStage = Omit<Stage, 'id' | 'promotionId' | 'createdAt'>;

const texte = (v?: string) => v?.trim() || null;
const entrepriseVersLigne = (d: Partial<DonneesEntreprise>): Record<string, unknown> => {
  const l: Record<string, unknown> = {};
  if (d.nom !== undefined) l.nom = d.nom.trim();
  for (const k of ['secteur', 'adresse', 'telephone', 'email', 'contact'] as const) if (k in d) l[k] = texte(d[k]);
  return l;
};
const stageVersLigne = (d: Partial<DonneesStage>): Record<string, unknown> => {
  const l: Record<string, unknown> = {};
  if ('studentEnrollmentId' in d) l.student_enrollment_id = d.studentEnrollmentId;
  if ('entrepriseId' in d) l.entreprise_id = d.entrepriseId || null;
  if ('poste' in d) l.poste = texte(d.poste);
  if ('tuteur' in d) l.tuteur = texte(d.tuteur);
  if ('tuteurTelephone' in d) l.tuteur_telephone = texte(d.tuteurTelephone);
  if ('dateDebut' in d) l.date_debut = d.dateDebut || null;
  if ('dateFin' in d) l.date_fin = d.dateFin || null;
  if ('conventionSignee' in d) l.convention_signee = !!d.conventionSignee;
  if ('abandonne' in d) l.abandonne = !!d.abandonne;
  if ('niveauMatiereId' in d) l.niveau_matiere_id = d.niveauMatiereId || null;
  if ('periodeId' in d) l.periode_id = d.periodeId || null;
  if ('note' in d) l.note = d.note ?? null;
  if ('appreciation' in d) l.appreciation = texte(d.appreciation);
  return l;
};

interface StagesContextType {
  loading: boolean;
  /** `false` si les tables n'existent pas encore (SQL pas encore appliqué). */
  disponible: boolean;
  entreprises: Entreprise[];
  stages: Stage[];
  visites: VisiteStage[];

  /** Retrouve l'entreprise par son nom (casse ignorée) ou l'ajoute au carnet. */
  entrepriseParNom: (nom: string) => Promise<Entreprise>;
  updateEntreprise: (id: string, data: Partial<DonneesEntreprise>) => Promise<void>;
  /** Refusé par la base si un stage l'utilise encore. */
  deleteEntreprise: (id: string) => Promise<void>;

  addStage: (promotionId: string, data: Partial<DonneesStage> & { studentEnrollmentId: string }) => Promise<Stage>;
  updateStage: (id: string, data: Partial<DonneesStage>) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;

  addVisite: (stageId: string, data: Omit<VisiteStage, 'id' | 'stageId'>) => Promise<void>;
  deleteVisite: (id: string) => Promise<void>;
}

const StagesContext = createContext<StagesContextType | null>(null);

export const StagesProvider = ({ children }: { children?: ReactNode }) => {
  const { school, isSchoolAccessBlocked } = useAuth();
  const schoolId: string | null = school?.id ?? null;
  const actif = estFormationPro(school) && !isSchoolAccessBlocked;

  const [loading, setLoading] = useState(true);
  const [disponible, setDisponible] = useState(true);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [visites, setVisites] = useState<VisiteStage[]>([]);

  useEffect(() => {
    let annule = false;
    if (!schoolId || !actif) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const [eRes, sRes, vRes] = await Promise.all([
        sb.from('fp_entreprises').select('*').eq('school_id', schoolId).order('nom'),
        sb.from('fp_stages').select('*').eq('school_id', schoolId).order('date_debut', { ascending: false }),
        sb.from('fp_stage_visites').select('*').eq('school_id', schoolId).order('date'),
      ]);
      if (annule) return;
      setDisponible(!sRes.error);
      setEntreprises((eRes.data ?? []).map(mapEntreprise));
      setStages((sRes.data ?? []).map(mapStage));
      setVisites((vRes.data ?? []).map(mapVisite));
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [schoolId, actif]);

  const entreprisesRef = useRef(entreprises); entreprisesRef.current = entreprises;

  const entrepriseParNom = useCallback(async (nom: string): Promise<Entreprise> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const existante = trouverEntreprise(entreprisesRef.current, nom);
    if (existante) return existante;
    const { data: row, error } = await sb.from('fp_entreprises').insert({ school_id: schoolId, nom: nom.trim() }).select().single();
    if (error) throw error;
    const e = mapEntreprise(row);
    entreprisesRef.current = [...entreprisesRef.current, e];
    setEntreprises(prev => [...prev, e].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
    return e;
  }, [schoolId]);

  const updateEntreprise = useCallback(async (id: string, data: Partial<DonneesEntreprise>) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const { error } = await sb.from('fp_entreprises').update(entrepriseVersLigne(data)).eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setEntreprises(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  }, [schoolId]);

  const deleteEntreprise = useCallback(async (id: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const { error } = await sb.from('fp_entreprises').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setEntreprises(prev => prev.filter(e => e.id !== id));
  }, [schoolId]);

  const addStage = useCallback<StagesContextType['addStage']>(async (promotionId, data) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const { data: row, error } = await sb.from('fp_stages').insert({
      school_id: schoolId, promotion_id: promotionId, ...stageVersLigne(data),
    }).select().single();
    if (error) throw error;
    const s = mapStage(row);
    setStages(prev => [s, ...prev]);
    return s;
  }, [schoolId]);

  const updateStage = useCallback(async (id: string, data: Partial<DonneesStage>) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const { data: row, error } = await sb.from('fp_stages').update({ ...stageVersLigne(data), updated_at: new Date().toISOString() })
      .eq('id', id).eq('school_id', schoolId).select().single();
    if (error) throw error;
    const s = mapStage(row);
    setStages(prev => prev.map(x => x.id === id ? s : x));
  }, [schoolId]);

  const deleteStage = useCallback(async (id: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const { error } = await sb.from('fp_stages').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setStages(prev => prev.filter(s => s.id !== id));
    setVisites(prev => prev.filter(v => v.stageId !== id));
  }, [schoolId]);

  const addVisite = useCallback(async (stageId: string, data: Omit<VisiteStage, 'id' | 'stageId'>) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const { data: row, error } = await sb.from('fp_stage_visites').insert({
      school_id: schoolId, stage_id: stageId, date: data.date, visiteur: texte(data.visiteur), observation: texte(data.observation),
    }).select().single();
    if (error) throw error;
    setVisites(prev => [...prev, mapVisite(row)].sort((a, b) => a.date.localeCompare(b.date)));
  }, [schoolId]);

  const deleteVisite = useCallback(async (id: string) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const { error } = await sb.from('fp_stage_visites').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setVisites(prev => prev.filter(v => v.id !== id));
  }, [schoolId]);

  const value = useMemo<StagesContextType>(() => ({
    loading, disponible, entreprises, stages, visites,
    entrepriseParNom, updateEntreprise, deleteEntreprise, addStage, updateStage, deleteStage, addVisite, deleteVisite,
  }), [loading, disponible, entreprises, stages, visites,
      entrepriseParNom, updateEntreprise, deleteEntreprise, addStage, updateStage, deleteStage, addVisite, deleteVisite]);

  return <StagesContext.Provider value={value}>{children ?? <Outlet />}</StagesContext.Provider>;
};

export const useStages = (): StagesContextType => {
  const ctx = useContext(StagesContext);
  if (!ctx) throw new Error('useStages must be used within StagesProvider');
  return ctx;
};
