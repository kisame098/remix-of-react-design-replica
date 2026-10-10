import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { verifierModele } from '@/lib/modelesDocuments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface ModeleEcole {
  id: string;
  nom: string;
  html: string;
  updatedAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const versModele = (r: any): ModeleEcole => ({ id: r.id, nom: r.nom, html: r.html, updatedAt: r.updated_at });

/**
 * Les modèles de documents de l'école (table `modeles_documents`).
 * `disponible = false` : le SQL docs/sql/modeles_documents.sql n'est pas encore
 * appliqué — l'écran le dit, les modèles fournis par SenClass restent utilisables.
 *
 * Un modèle n'est JAMAIS enregistré s'il contient un champ inconnu : la
 * vérification est refaite ici, quel que soit l'écran qui appelle.
 */
export const useModelesDocuments = () => {
  const { school } = useAuth();
  const schoolId = school?.id ?? null;
  const [modeles, setModeles] = useState<ModeleEcole[]>([]);
  const [loading, setLoading] = useState(true);
  const [disponible, setDisponible] = useState(true);

  useEffect(() => {
    let annule = false;
    if (!schoolId) { setModeles([]); setLoading(false); return; }
    (async () => {
      const { data, error } = await sb.from('modeles_documents').select('id, nom, html, updated_at')
        .eq('school_id', schoolId).order('nom');
      if (annule) return;
      setDisponible(!error);
      setModeles((data ?? []).map(versModele));
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [schoolId]);

  const controler = (nom: string, html: string) => {
    if (!nom.trim()) throw new Error('Donnez un nom au modèle.');
    const v = verifierModele(html);
    if (v.erreur) throw new Error(v.erreur);
    if (!v.ok) throw new Error('Le modèle contient des champs inconnus de SenClass.');
  };

  const creer = useCallback(async (nom: string, html: string): Promise<ModeleEcole> => {
    controler(nom, html);
    const { data, error } = await sb.from('modeles_documents')
      .insert({ school_id: schoolId, nom: nom.trim(), html }).select('id, nom, html, updated_at').single();
    if (error) throw error;
    const m = versModele(data);
    setModeles(prev => [...prev, m].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
    return m;
  }, [schoolId]);

  const modifier = useCallback(async (id: string, nom: string, html: string): Promise<ModeleEcole> => {
    controler(nom, html);
    const { data, error } = await sb.from('modeles_documents')
      .update({ nom: nom.trim(), html }).eq('id', id).select('id, nom, html, updated_at').single();
    if (error) throw error;
    const m = versModele(data);
    setModeles(prev => prev.map(x => (x.id === id ? m : x)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
    return m;
  }, []);

  const supprimer = useCallback(async (id: string): Promise<void> => {
    const { error } = await sb.from('modeles_documents').delete().eq('id', id);
    if (error) throw error;
    setModeles(prev => prev.filter(x => x.id !== id));
  }, []);

  return { modeles, loading, disponible, creer, modifier, supprimer };
};
