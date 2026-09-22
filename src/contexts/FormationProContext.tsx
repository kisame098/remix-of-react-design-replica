import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { estFormationPro } from '@/lib/modeGestion';
import {
  type FormationBloc, type FormationMatiere, type FormationChoixGroup, type FormationChoixOption,
  type FormationMatiereType, type FormationMatiereNature,
} from '@/lib/formationPro';

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTE DU CATALOGUE « FORMATION PROFESSIONNELLE »
//
// Volontairement à part de SchoolContext (comme le reste du module) : il ne se
// charge QUE pour une école en mode formation_pro, et ne touche à aucune des
// tables classiques (filieres, classes, subjects…).
//
// Écriture calquée sur la partie Cursus de SchoolContext.tsx : état local mis
// à jour après le succès de l'écriture en base, jamais de rechargement complet.
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type DonneesBloc = { formationName: string; anneeLabel: string; diplome?: string; duree?: string; niveauEntree?: string; description?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapBloc = (r: any): FormationBloc => ({
  id: r.id, formationName: r.formation_name, anneeLabel: r.annee_label,
  diplome: r.diplome ?? undefined, duree: r.duree ?? undefined, niveauEntree: r.niveau_entree ?? undefined,
  description: r.description ?? undefined, ordering: r.ordering ?? 0, createdAt: r.created_at,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapMatiere = (r: any): FormationMatiere => ({
  id: r.id, blocId: r.bloc_id, type: r.type, name: r.name, coefficient: Number(r.coefficient),
  volumeHoraire: r.volume_horaire == null ? undefined : Number(r.volume_horaire),
  nature: r.nature, ordering: r.ordering ?? 0,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapChoix = (r: any): Omit<FormationChoixGroup, 'options'> => ({
  id: r.id, blocId: r.bloc_id, label: r.label, coefficient: Number(r.coefficient), ordering: r.ordering ?? 0,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapOption = (r: any): FormationChoixOption & { choixId: string } => ({
  id: r.id, choixId: r.choix_id, subjectName: r.subject_name,
});

interface FormationProContextType {
  loading: boolean;
  blocs: FormationBloc[];
  matieres: FormationMatiere[];
  choixGroups: FormationChoixGroup[];

  addBloc: (data: DonneesBloc) => Promise<FormationBloc>;
  updateBloc: (id: string, data: Partial<DonneesBloc>) => Promise<void>;
  deleteBloc: (id: string) => Promise<void>;
  /** Copie matières et créneaux au choix d'un bloc vers un bloc neuf — le bloc source n'est jamais modifié. */
  duplicateBloc: (sourceId: string, data: DonneesBloc) => Promise<FormationBloc>;
  /**
   * Copie TOUS les blocs d'une formation (CAP 1, 2, 3…) vers une formation
   * neuve en une seule fois — ex : « CAP Restauration » → « DAP
   * Restauration ». `overrides` s'applique à chaque bloc copié ; ce qui n'y
   * est pas précisé reprend la valeur du bloc source (l'année, elle, n'est
   * jamais réécrite : Année 1 reste Année 1).
   */
  duplicateFormation: (
    sourceFormationName: string,
    overrides: { formationName: string; diplome?: string; duree?: string; niveauEntree?: string; description?: string },
  ) => Promise<FormationBloc[]>;

  addMatiere: (blocId: string, data: { type: FormationMatiereType; name: string; coefficient: number; volumeHoraire?: number; nature: FormationMatiereNature }) => Promise<FormationMatiere>;
  updateMatiere: (id: string, data: Partial<Pick<FormationMatiere, 'type' | 'name' | 'coefficient' | 'volumeHoraire' | 'nature'>>) => Promise<void>;
  deleteMatiere: (id: string) => Promise<void>;

  addChoixGroup: (blocId: string, data: { label: string; coefficient: number }) => Promise<FormationChoixGroup>;
  updateChoixGroup: (id: string, data: Partial<Pick<FormationChoixGroup, 'label' | 'coefficient'>>) => Promise<void>;
  deleteChoixGroup: (id: string) => Promise<void>;
  addChoixOption: (choixId: string, subjectName: string) => Promise<void>;
  deleteChoixOption: (id: string) => Promise<void>;
}

const FormationProContext = createContext<FormationProContextType | null>(null);

export const FormationProProvider = ({ children }: { children: ReactNode }) => {
  const { school, isSchoolAccessBlocked } = useAuth();
  const schoolId: string | null = school?.id ?? null;
  const actif = estFormationPro(school) && !isSchoolAccessBlocked;

  const [loading, setLoading] = useState(true);
  const [blocs, setBlocs] = useState<FormationBloc[]>([]);
  const [matieres, setMatieres] = useState<FormationMatiere[]>([]);
  const [choixGroups, setChoixGroups] = useState<FormationChoixGroup[]>([]);

  useEffect(() => {
    let annule = false;
    if (!schoolId || !actif) {
      setBlocs([]); setMatieres([]); setChoixGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const [bRes, mRes, cRes, oRes] = await Promise.all([
        sb.from('fp_blocs').select('*').eq('school_id', schoolId).order('ordering'),
        sb.from('fp_bloc_matieres').select('*').eq('school_id', schoolId).order('ordering'),
        sb.from('fp_bloc_choix').select('*').eq('school_id', schoolId).order('ordering'),
        sb.from('fp_bloc_choix_options').select('*').eq('school_id', schoolId).order('ordering'),
      ]);
      if (annule) return;
      const options = (oRes.data ?? []).map(mapOption);
      setBlocs((bRes.data ?? []).map(mapBloc));
      setMatieres((mRes.data ?? []).map(mapMatiere));
      setChoixGroups((cRes.data ?? []).map((r: unknown) => {
        const g = mapChoix(r as Parameters<typeof mapChoix>[0]);
        return { ...g, options: options.filter(o => o.choixId === g.id).map(({ id, subjectName }) => ({ id, subjectName })) };
      }));
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [schoolId, actif]);

  // Prochain `ordering` — même logique que Cursus : la position suivante dans
  // le même regroupement (bloc pour les matières/choix, école pour les blocs).
  const blocsRef = useRef(blocs); blocsRef.current = blocs;
  const matieresRef = useRef(matieres); matieresRef.current = matieres;
  const choixRef = useRef(choixGroups); choixRef.current = choixGroups;

  const addBloc = useCallback(async (data: DonneesBloc): Promise<FormationBloc> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = blocsRef.current.length;
    const { data: row, error } = await sb.from('fp_blocs').insert({
      school_id: schoolId, formation_name: data.formationName.trim(), annee_label: data.anneeLabel.trim(),
      diplome: data.diplome?.trim() || null, duree: data.duree?.trim() || null,
      niveau_entree: data.niveauEntree?.trim() || null, description: data.description?.trim() || null,
      ordering,
    }).select().single();
    if (error) throw error;
    const bloc = mapBloc(row);
    setBlocs(prev => [...prev, bloc]);
    return bloc;
  }, [schoolId]);

  const updateBloc = useCallback(async (id: string, data: Partial<DonneesBloc>): Promise<void> => {
    if (!schoolId) return;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.formationName !== undefined) patch.formation_name = data.formationName.trim();
    if (data.anneeLabel !== undefined) patch.annee_label = data.anneeLabel.trim();
    if (data.diplome !== undefined) patch.diplome = data.diplome.trim() || null;
    if (data.duree !== undefined) patch.duree = data.duree.trim() || null;
    if (data.niveauEntree !== undefined) patch.niveau_entree = data.niveauEntree.trim() || null;
    if (data.description !== undefined) patch.description = data.description.trim() || null;
    const { error } = await sb.from('fp_blocs').update(patch).eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setBlocs(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
  }, [schoolId]);

  const deleteBloc = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sb.from('fp_blocs').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setBlocs(prev => prev.filter(b => b.id !== id));
    setMatieres(prev => prev.filter(m => m.blocId !== id));
    setChoixGroups(prev => prev.filter(c => c.blocId !== id));
  }, [schoolId]);

  const addMatiere = useCallback(async (blocId: string, data: { type: FormationMatiereType; name: string; coefficient: number; volumeHoraire?: number; nature: FormationMatiereNature }): Promise<FormationMatiere> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = matieresRef.current.filter(m => m.blocId === blocId).length;
    const { data: row, error } = await sb.from('fp_bloc_matieres').insert({
      school_id: schoolId, bloc_id: blocId, type: data.type, name: data.name.trim(),
      coefficient: data.coefficient, volume_horaire: data.volumeHoraire ?? null, nature: data.nature, ordering,
    }).select().single();
    if (error) throw error;
    const matiere = mapMatiere(row);
    setMatieres(prev => [...prev, matiere]);
    return matiere;
  }, [schoolId]);

  const updateMatiere = useCallback(async (id: string, data: Partial<Pick<FormationMatiere, 'type' | 'name' | 'coefficient' | 'volumeHoraire' | 'nature'>>): Promise<void> => {
    if (!schoolId) return;
    const patch: Record<string, unknown> = {};
    if (data.type !== undefined) patch.type = data.type;
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.coefficient !== undefined) patch.coefficient = data.coefficient;
    if (data.volumeHoraire !== undefined) patch.volume_horaire = data.volumeHoraire ?? null;
    if (data.nature !== undefined) patch.nature = data.nature;
    const { error } = await sb.from('fp_bloc_matieres').update(patch).eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setMatieres(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
  }, [schoolId]);

  const deleteMatiere = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sb.from('fp_bloc_matieres').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setMatieres(prev => prev.filter(m => m.id !== id));
  }, [schoolId]);

  const addChoixGroup = useCallback(async (blocId: string, data: { label: string; coefficient: number }): Promise<FormationChoixGroup> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = choixRef.current.filter(c => c.blocId === blocId).length;
    const { data: row, error } = await sb.from('fp_bloc_choix').insert({
      school_id: schoolId, bloc_id: blocId, label: data.label.trim(), coefficient: data.coefficient, ordering,
    }).select().single();
    if (error) throw error;
    const groupe: FormationChoixGroup = { ...mapChoix(row), options: [] };
    setChoixGroups(prev => [...prev, groupe]);
    return groupe;
  }, [schoolId]);

  const updateChoixGroup = useCallback(async (id: string, data: Partial<Pick<FormationChoixGroup, 'label' | 'coefficient'>>): Promise<void> => {
    if (!schoolId) return;
    const patch: Record<string, unknown> = {};
    if (data.label !== undefined) patch.label = data.label.trim();
    if (data.coefficient !== undefined) patch.coefficient = data.coefficient;
    const { error } = await sb.from('fp_bloc_choix').update(patch).eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setChoixGroups(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, [schoolId]);

  const deleteChoixGroup = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sb.from('fp_bloc_choix').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setChoixGroups(prev => prev.filter(c => c.id !== id));
  }, [schoolId]);

  const addChoixOption = useCallback(async (choixId: string, subjectName: string): Promise<void> => {
    if (!schoolId || !subjectName.trim()) return;
    const ordering = (choixRef.current.find(c => c.id === choixId)?.options.length) ?? 0;
    const { data: row, error } = await sb.from('fp_bloc_choix_options').insert({
      school_id: schoolId, choix_id: choixId, subject_name: subjectName.trim(), ordering,
    }).select().single();
    if (error) throw error;
    const option = mapOption(row);
    setChoixGroups(prev => prev.map(c => c.id === choixId ? { ...c, options: [...c.options, { id: option.id, subjectName: option.subjectName }] } : c));
  }, [schoolId]);

  const deleteChoixOption = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sb.from('fp_bloc_choix_options').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setChoixGroups(prev => prev.map(c => ({ ...c, options: c.options.filter(o => o.id !== id) })));
  }, [schoolId]);

  const duplicateBloc = useCallback(async (sourceId: string, data: DonneesBloc): Promise<FormationBloc> => {
    const nouveau = await addBloc(data);
    const matieresSource = matieresRef.current.filter(m => m.blocId === sourceId).sort((a, b) => a.ordering - b.ordering);
    for (const m of matieresSource) {
      await addMatiere(nouveau.id, { type: m.type, name: m.name, coefficient: m.coefficient, volumeHoraire: m.volumeHoraire, nature: m.nature });
    }
    const choixSource = choixRef.current.filter(c => c.blocId === sourceId).sort((a, b) => a.ordering - b.ordering);
    for (const c of choixSource) {
      const groupe = await addChoixGroup(nouveau.id, { label: c.label, coefficient: c.coefficient });
      for (const o of c.options) await addChoixOption(groupe.id, o.subjectName);
    }
    return nouveau;
  }, [addBloc, addMatiere, addChoixGroup, addChoixOption]);

  const duplicateFormation = useCallback(async (
    sourceFormationName: string,
    overrides: { formationName: string; diplome?: string; duree?: string; niveauEntree?: string; description?: string },
  ): Promise<FormationBloc[]> => {
    const sourceBlocs = blocsRef.current
      .filter(b => b.formationName === sourceFormationName)
      .sort((a, b) => a.ordering - b.ordering);
    const crees: FormationBloc[] = [];
    // Séquentiel, pas Promise.all : chaque duplicateBloc lit blocsRef/matieresRef
    // par effet de bord (setState) — les paralléliser mélangerait les `ordering`.
    for (const source of sourceBlocs) {
      const nouveau = await duplicateBloc(source.id, {
        formationName: overrides.formationName,
        anneeLabel: source.anneeLabel,   // l'année de chaque bloc ne change jamais : Année 1 reste Année 1
        diplome: overrides.diplome ?? source.diplome,
        duree: overrides.duree ?? source.duree,
        niveauEntree: overrides.niveauEntree ?? source.niveauEntree,
        description: overrides.description ?? source.description,
      });
      crees.push(nouveau);
    }
    return crees;
  }, [duplicateBloc]);

  const value = useMemo<FormationProContextType>(() => ({
    loading, blocs, matieres, choixGroups,
    addBloc, updateBloc, deleteBloc, duplicateBloc, duplicateFormation,
    addMatiere, updateMatiere, deleteMatiere,
    addChoixGroup, updateChoixGroup, deleteChoixGroup, addChoixOption, deleteChoixOption,
  }), [loading, blocs, matieres, choixGroups, addBloc, updateBloc, deleteBloc, duplicateBloc, duplicateFormation,
      addMatiere, updateMatiere, deleteMatiere, addChoixGroup, updateChoixGroup, deleteChoixGroup, addChoixOption, deleteChoixOption]);

  return <FormationProContext.Provider value={value}>{children}</FormationProContext.Provider>;
};

export const useFormationPro = (): FormationProContextType => {
  const ctx = useContext(FormationProContext);
  if (!ctx) throw new Error('useFormationPro must be used within FormationProProvider');
  return ctx;
};
