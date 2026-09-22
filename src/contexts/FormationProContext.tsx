import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { estFormationPro } from '@/lib/modeGestion';
import {
  type Formation, type Niveau, type MatiereCatalogue, type NiveauMatiere, type ChoixGroup, type ChoixOption,
  type NiveauMatiereType, type NiveauMatiereNature,
} from '@/lib/formationPro';

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTE DU CATALOGUE « FORMATION PROFESSIONNELLE »
//
// À part de SchoolContext (comme le reste du module) : il ne se charge QUE
// pour une école en mode formation_pro, et ne touche à aucune des tables
// classiques (filieres, classes, subjects…).
//
// Le catalogue de matières (fp_matieres) est PARTAGÉ par toute l'école :
// `ajouterMatiereANiveau` retrouve ou crée la ligne de catalogue par son nom
// (recherche insensible à la casse), jamais de doublon silencieux.
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapFormation = (r: any): Formation => ({
  id: r.id, name: r.name, diplomaType: r.diploma_type ?? undefined, duration: r.duration ?? undefined,
  entryLevel: r.entry_level ?? undefined, description: r.description ?? undefined,
  active: r.active ?? true, ordering: r.ordering ?? 0, createdAt: r.created_at,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapNiveau = (r: any): Niveau => ({
  id: r.id, formationId: r.formation_id, name: r.name, description: r.description ?? undefined,
  ordering: r.ordering ?? 0, createdAt: r.created_at,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapMatiereCatalogue = (r: any): MatiereCatalogue => ({ id: r.id, name: r.name });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapChoix = (r: any): Omit<ChoixGroup, 'options'> => ({
  id: r.id, niveauId: r.niveau_id, label: r.label, coefficient: Number(r.coefficient), ordering: r.ordering ?? 0,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapOption = (r: any): ChoixOption & { choixId: string } => ({
  id: r.id, choixId: r.choix_id, subjectName: r.subject_name,
});

type DonneesFormation = { name: string; diplomaType?: string; duration?: string; entryLevel?: string; description?: string; active?: boolean };
type DonneesNiveau = { name: string; description?: string };
type DonneesNiveauMatiere = { type: NiveauMatiereType; coefficient: number; volumeHoraire?: number; nature: NiveauMatiereNature; categorie?: string };

interface FormationProContextType {
  loading: boolean;
  formations: Formation[];
  niveaux: Niveau[];
  catalogue: MatiereCatalogue[];
  niveauMatieres: NiveauMatiere[];
  choixGroups: ChoixGroup[];

  addFormation: (data: DonneesFormation) => Promise<Formation>;
  updateFormation: (id: string, data: Partial<DonneesFormation>) => Promise<void>;
  deleteFormation: (id: string) => Promise<void>;
  /** Copie TOUS les niveaux d'une formation (matières, coefficients, choix) vers une formation neuve. */
  duplicateFormation: (sourceFormationId: string, data: DonneesFormation) => Promise<Formation>;

  addNiveau: (formationId: string, data: DonneesNiveau) => Promise<Niveau>;
  updateNiveau: (id: string, data: Partial<DonneesNiveau>) => Promise<void>;
  deleteNiveau: (id: string) => Promise<void>;
  /** Copie le contenu pédagogique d'un niveau (matières, coefficients, choix) vers un niveau neuf du même formulaire. */
  duplicateNiveau: (sourceNiveauId: string, formationId: string, data: DonneesNiveau) => Promise<Niveau>;

  /** Retrouve (ou crée) la matière du catalogue par son nom, puis l'enseigne à ce niveau. */
  addMatiereToNiveau: (niveauId: string, matiereName: string, data: DonneesNiveauMatiere) => Promise<NiveauMatiere>;
  updateNiveauMatiere: (id: string, data: Partial<DonneesNiveauMatiere> & { matiereName?: string }) => Promise<void>;
  deleteNiveauMatiere: (id: string) => Promise<void>;

  addChoixGroup: (niveauId: string, data: { label: string; coefficient: number }) => Promise<ChoixGroup>;
  updateChoixGroup: (id: string, data: Partial<Pick<ChoixGroup, 'label' | 'coefficient'>>) => Promise<void>;
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
  const [formations, setFormations] = useState<Formation[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [catalogue, setCatalogue] = useState<MatiereCatalogue[]>([]);
  const [niveauMatieresBrut, setNiveauMatieresBrut] = useState<{ id: string; niveauId: string; matiereId: string; type: NiveauMatiereType; coefficient: number; volumeHoraire?: number; nature: NiveauMatiereNature; categorie?: string; ordering: number }[]>([]);
  const [choixGroups, setChoixGroups] = useState<ChoixGroup[]>([]);

  useEffect(() => {
    let annule = false;
    if (!schoolId || !actif) {
      setFormations([]); setNiveaux([]); setCatalogue([]); setNiveauMatieresBrut([]); setChoixGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const [fRes, nRes, mRes, nmRes, cRes, oRes] = await Promise.all([
        sb.from('fp_formations').select('*').eq('school_id', schoolId).order('ordering'),
        sb.from('fp_niveaux').select('*').eq('school_id', schoolId).order('ordering'),
        sb.from('fp_matieres').select('*').eq('school_id', schoolId).order('name'),
        sb.from('fp_niveau_matieres').select('*').eq('school_id', schoolId).order('ordering'),
        sb.from('fp_choix').select('*').eq('school_id', schoolId).order('ordering'),
        sb.from('fp_choix_options').select('*').eq('school_id', schoolId).order('ordering'),
      ]);
      if (annule) return;
      const options = (oRes.data ?? []).map(mapOption);
      setFormations((fRes.data ?? []).map(mapFormation));
      setNiveaux((nRes.data ?? []).map(mapNiveau));
      setCatalogue((mRes.data ?? []).map(mapMatiereCatalogue));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNiveauMatieresBrut((nmRes.data ?? []).map((r: any) => ({
        id: r.id, niveauId: r.niveau_id, matiereId: r.matiere_id, type: r.type, coefficient: Number(r.coefficient),
        volumeHoraire: r.volume_horaire == null ? undefined : Number(r.volume_horaire), nature: r.nature,
        categorie: r.categorie ?? undefined, ordering: r.ordering ?? 0,
      })));
      setChoixGroups((cRes.data ?? []).map((r: unknown) => {
        const g = mapChoix(r as Parameters<typeof mapChoix>[0]);
        return { ...g, options: options.filter(o => o.choixId === g.id).map(({ id, subjectName }) => ({ id, subjectName })) };
      }));
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [schoolId, actif]);

  // Vue dénormalisée (avec le nom de la matière) — recalculée seulement quand
  // les lignes brutes ou le catalogue changent, jamais à chaque rendu.
  const niveauMatieres = useMemo<NiveauMatiere[]>(() => {
    const noms = new Map(catalogue.map(m => [m.id, m.name]));
    return niveauMatieresBrut.map(m => ({ ...m, matiereName: noms.get(m.matiereId) ?? '(matière supprimée)' }));
  }, [niveauMatieresBrut, catalogue]);

  const formationsRef = useRef(formations); formationsRef.current = formations;
  const niveauxRef = useRef(niveaux); niveauxRef.current = niveaux;
  const catalogueRef = useRef(catalogue); catalogueRef.current = catalogue;
  const niveauMatieresRef = useRef(niveauMatieresBrut); niveauMatieresRef.current = niveauMatieresBrut;
  const choixRef = useRef(choixGroups); choixRef.current = choixGroups;

  // ── Formations ─────────────────────────────────────────────────────────
  const addFormation = useCallback(async (data: DonneesFormation): Promise<Formation> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = formationsRef.current.length;
    const { data: row, error } = await sb.from('fp_formations').insert({
      school_id: schoolId, name: data.name.trim(), diploma_type: data.diplomaType?.trim() || null,
      duration: data.duration?.trim() || null, entry_level: data.entryLevel?.trim() || null,
      description: data.description?.trim() || null, active: data.active ?? true, ordering,
    }).select().single();
    if (error) throw error;
    const formation = mapFormation(row);
    setFormations(prev => [...prev, formation]);
    return formation;
  }, [schoolId]);

  const updateFormation = useCallback(async (id: string, data: Partial<DonneesFormation>): Promise<void> => {
    if (!schoolId) return;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.diplomaType !== undefined) patch.diploma_type = data.diplomaType.trim() || null;
    if (data.duration !== undefined) patch.duration = data.duration.trim() || null;
    if (data.entryLevel !== undefined) patch.entry_level = data.entryLevel.trim() || null;
    if (data.description !== undefined) patch.description = data.description.trim() || null;
    if (data.active !== undefined) patch.active = data.active;
    const { error } = await sb.from('fp_formations').update(patch).eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setFormations(prev => prev.map(f => f.id === id ? { ...f, ...data } : f));
  }, [schoolId]);

  const deleteFormation = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sb.from('fp_formations').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    const idsNiveaux = new Set(niveauxRef.current.filter(n => n.formationId === id).map(n => n.id));
    setFormations(prev => prev.filter(f => f.id !== id));
    setNiveaux(prev => prev.filter(n => n.formationId !== id));
    setNiveauMatieresBrut(prev => prev.filter(m => !idsNiveaux.has(m.niveauId)));
    setChoixGroups(prev => prev.filter(c => !idsNiveaux.has(c.niveauId)));
  }, [schoolId]);

  // ── Niveaux ────────────────────────────────────────────────────────────
  const addNiveau = useCallback(async (formationId: string, data: DonneesNiveau): Promise<Niveau> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = niveauxRef.current.filter(n => n.formationId === formationId).length;
    const { data: row, error } = await sb.from('fp_niveaux').insert({
      school_id: schoolId, formation_id: formationId, name: data.name.trim(), description: data.description?.trim() || null, ordering,
    }).select().single();
    if (error) throw error;
    const niveau = mapNiveau(row);
    setNiveaux(prev => [...prev, niveau]);
    return niveau;
  }, [schoolId]);

  const updateNiveau = useCallback(async (id: string, data: Partial<DonneesNiveau>): Promise<void> => {
    if (!schoolId) return;
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.description !== undefined) patch.description = data.description.trim() || null;
    const { error } = await sb.from('fp_niveaux').update(patch).eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setNiveaux(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
  }, [schoolId]);

  const deleteNiveau = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sb.from('fp_niveaux').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setNiveaux(prev => prev.filter(n => n.id !== id));
    setNiveauMatieresBrut(prev => prev.filter(m => m.niveauId !== id));
    setChoixGroups(prev => prev.filter(c => c.niveauId !== id));
  }, [schoolId]);

  // ── Catalogue + matières d'un niveau ──────────────────────────────────────
  /** Retrouve la ligne de catalogue par son nom (insensible à la casse), ou la crée. */
  const resoudreMatiereCatalogue = useCallback(async (name: string): Promise<MatiereCatalogue> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const norm = name.trim().toLowerCase();
    const existante = catalogueRef.current.find(m => m.name.trim().toLowerCase() === norm);
    if (existante) return existante;
    const { data: row, error } = await sb.from('fp_matieres').insert({ school_id: schoolId, name: name.trim() }).select().single();
    if (error) throw error;
    const matiere = mapMatiereCatalogue(row);
    setCatalogue(prev => [...prev, matiere]);
    return matiere;
  }, [schoolId]);

  const addMatiereToNiveau = useCallback(async (niveauId: string, matiereName: string, data: DonneesNiveauMatiere): Promise<NiveauMatiere> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const matiere = await resoudreMatiereCatalogue(matiereName);
    const ordering = niveauMatieresRef.current.filter(m => m.niveauId === niveauId).length;
    const { data: row, error } = await sb.from('fp_niveau_matieres').insert({
      school_id: schoolId, niveau_id: niveauId, matiere_id: matiere.id, type: data.type,
      coefficient: data.coefficient, volume_horaire: data.volumeHoraire ?? null, nature: data.nature,
      categorie: data.categorie?.trim() || null, ordering,
    }).select().single();
    if (error) throw error;
    const ligne = {
      id: row.id, niveauId: row.niveau_id, matiereId: row.matiere_id, type: row.type,
      coefficient: Number(row.coefficient), volumeHoraire: row.volume_horaire == null ? undefined : Number(row.volume_horaire),
      nature: row.nature, categorie: row.categorie ?? undefined, ordering: row.ordering ?? ordering,
    };
    setNiveauMatieresBrut(prev => [...prev, ligne]);
    return { ...ligne, matiereName: matiere.name };
  }, [schoolId, resoudreMatiereCatalogue]);

  const updateNiveauMatiere = useCallback(async (id: string, data: Partial<DonneesNiveauMatiere> & { matiereName?: string }): Promise<void> => {
    if (!schoolId) return;
    const patch: Record<string, unknown> = {};
    let nouveauMatiereId: string | undefined;
    if (data.matiereName !== undefined) {
      const matiere = await resoudreMatiereCatalogue(data.matiereName);
      patch.matiere_id = matiere.id;
      nouveauMatiereId = matiere.id;
    }
    if (data.type !== undefined) patch.type = data.type;
    if (data.coefficient !== undefined) patch.coefficient = data.coefficient;
    if (data.volumeHoraire !== undefined) patch.volume_horaire = data.volumeHoraire ?? null;
    if (data.nature !== undefined) patch.nature = data.nature;
    if (data.categorie !== undefined) patch.categorie = data.categorie.trim() || null;
    const { error } = await sb.from('fp_niveau_matieres').update(patch).eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setNiveauMatieresBrut(prev => prev.map(m => m.id === id
      ? { ...m, ...data, matiereId: nouveauMatiereId ?? m.matiereId }
      : m));
  }, [schoolId, resoudreMatiereCatalogue]);

  const deleteNiveauMatiere = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sb.from('fp_niveau_matieres').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setNiveauMatieresBrut(prev => prev.filter(m => m.id !== id));
  }, [schoolId]);

  // ── Créneaux au choix ──────────────────────────────────────────────────
  const addChoixGroup = useCallback(async (niveauId: string, data: { label: string; coefficient: number }): Promise<ChoixGroup> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const ordering = choixRef.current.filter(c => c.niveauId === niveauId).length;
    const { data: row, error } = await sb.from('fp_choix').insert({
      school_id: schoolId, niveau_id: niveauId, label: data.label.trim(), coefficient: data.coefficient, ordering,
    }).select().single();
    if (error) throw error;
    const groupe: ChoixGroup = { ...mapChoix(row), options: [] };
    setChoixGroups(prev => [...prev, groupe]);
    return groupe;
  }, [schoolId]);

  const updateChoixGroup = useCallback(async (id: string, data: Partial<Pick<ChoixGroup, 'label' | 'coefficient'>>): Promise<void> => {
    if (!schoolId) return;
    const patch: Record<string, unknown> = {};
    if (data.label !== undefined) patch.label = data.label.trim();
    if (data.coefficient !== undefined) patch.coefficient = data.coefficient;
    const { error } = await sb.from('fp_choix').update(patch).eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setChoixGroups(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, [schoolId]);

  const deleteChoixGroup = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sb.from('fp_choix').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setChoixGroups(prev => prev.filter(c => c.id !== id));
  }, [schoolId]);

  const addChoixOption = useCallback(async (choixId: string, subjectName: string): Promise<void> => {
    if (!schoolId || !subjectName.trim()) return;
    const ordering = (choixRef.current.find(c => c.id === choixId)?.options.length) ?? 0;
    const { data: row, error } = await sb.from('fp_choix_options').insert({
      school_id: schoolId, choix_id: choixId, subject_name: subjectName.trim(), ordering,
    }).select().single();
    if (error) throw error;
    const option = mapOption(row);
    setChoixGroups(prev => prev.map(c => c.id === choixId ? { ...c, options: [...c.options, { id: option.id, subjectName: option.subjectName }] } : c));
  }, [schoolId]);

  const deleteChoixOption = useCallback(async (id: string): Promise<void> => {
    if (!schoolId) return;
    const { error } = await sb.from('fp_choix_options').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setChoixGroups(prev => prev.map(c => ({ ...c, options: c.options.filter(o => o.id !== id) })));
  }, [schoolId]);

  // ── Duplication ────────────────────────────────────────────────────────
  const duplicateNiveau = useCallback(async (sourceNiveauId: string, formationId: string, data: DonneesNiveau): Promise<Niveau> => {
    const nouveau = await addNiveau(formationId, data);
    const matieresSource = niveauMatieresRef.current.filter(m => m.niveauId === sourceNiveauId).sort((a, b) => a.ordering - b.ordering);
    for (const m of matieresSource) {
      const nomMatiere = catalogueRef.current.find(c => c.id === m.matiereId)?.name;
      if (!nomMatiere) continue;   // matière supprimée entre-temps : rien à copier
      await addMatiereToNiveau(nouveau.id, nomMatiere, {
        type: m.type, coefficient: m.coefficient, volumeHoraire: m.volumeHoraire, nature: m.nature, categorie: m.categorie,
      });
    }
    const choixSource = choixRef.current.filter(c => c.niveauId === sourceNiveauId).sort((a, b) => a.ordering - b.ordering);
    for (const c of choixSource) {
      const groupe = await addChoixGroup(nouveau.id, { label: c.label, coefficient: c.coefficient });
      for (const o of c.options) await addChoixOption(groupe.id, o.subjectName);
    }
    return nouveau;
  }, [addNiveau, addMatiereToNiveau, addChoixGroup, addChoixOption]);

  const duplicateFormation = useCallback(async (sourceFormationId: string, data: DonneesFormation): Promise<Formation> => {
    const nouvelleFormation = await addFormation(data);
    const niveauxSource = niveauxRef.current.filter(n => n.formationId === sourceFormationId).sort((a, b) => a.ordering - b.ordering);
    // Séquentiel : chaque duplicateNiveau lit les refs par effet de bord —
    // les paralléliser mélangerait les `ordering`.
    for (const n of niveauxSource) {
      await duplicateNiveau(n.id, nouvelleFormation.id, { name: n.name, description: n.description });
    }
    return nouvelleFormation;
  }, [addFormation, duplicateNiveau]);

  const value = useMemo<FormationProContextType>(() => ({
    loading, formations, niveaux, catalogue, niveauMatieres, choixGroups,
    addFormation, updateFormation, deleteFormation, duplicateFormation,
    addNiveau, updateNiveau, deleteNiveau, duplicateNiveau,
    addMatiereToNiveau, updateNiveauMatiere, deleteNiveauMatiere,
    addChoixGroup, updateChoixGroup, deleteChoixGroup, addChoixOption, deleteChoixOption,
  }), [loading, formations, niveaux, catalogue, niveauMatieres, choixGroups,
      addFormation, updateFormation, deleteFormation, duplicateFormation,
      addNiveau, updateNiveau, deleteNiveau, duplicateNiveau,
      addMatiereToNiveau, updateNiveauMatiere, deleteNiveauMatiere,
      addChoixGroup, updateChoixGroup, deleteChoixGroup, addChoixOption, deleteChoixOption]);

  return <FormationProContext.Provider value={value}>{children}</FormationProContext.Provider>;
};

export const useFormationPro = (): FormationProContextType => {
  const ctx = useContext(FormationProContext);
  if (!ctx) throw new Error('useFormationPro must be used within FormationProProvider');
  return ctx;
};
