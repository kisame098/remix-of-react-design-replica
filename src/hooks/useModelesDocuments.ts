import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { lireSource, verifierSource, type SourceModele } from '@/lib/modeleDocument';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface ModeleEcole {
  id: string;
  nom: string;
  source: SourceModele;
  updatedAt: string;
}

const COLONNES = 'id, nom, genre, contenu, html, fichier, updated_at';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const versModele = (r: any): ModeleEcole | null => {
  const source = lireSource(r);
  return source ? { id: r.id, nom: r.nom, source, updatedAt: r.updated_at } : null;
};

/** La ligne à écrire : chaque genre remplit SA colonne, les autres restent vides (contrainte SQL). */
const versLigne = (nom: string, s: SourceModele) => ({
  nom: nom.trim(),
  genre: s.genre,
  contenu: s.genre === 'visuel' ? s.contenu : null,
  html: s.genre === 'html' ? s.html : null,
  fichier: s.genre === 'word' ? s.fichier : null,
});

const trier = (l: ModeleEcole[]) => [...l].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

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
      const { data, error } = await sb.from('modeles_documents').select(COLONNES).eq('school_id', schoolId).order('nom');
      if (annule) return;
      setDisponible(!error);
      setModeles(trier(((data ?? []) as unknown[]).map(versModele).filter((m): m is ModeleEcole => m !== null)));
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [schoolId]);

  const controler = (nom: string, source: SourceModele) => {
    if (!nom.trim()) throw new Error('Donnez un nom au modèle.');
    const v = verifierSource(source);
    if (v.erreur) throw new Error(v.erreur);
    if (v.imagesMalPlacees.length > 0 && source.genre === 'word') throw new Error("Le logo ne peut pas être un champ dans un Word : placez-le directement dans votre fichier.");
    if (!v.ok) throw new Error(`Champs inconnus de SenClass : ${v.inconnus.map(c => `{${c}}`).join(', ')}.`);
  };

  const creer = useCallback(async (nom: string, source: SourceModele): Promise<ModeleEcole> => {
    controler(nom, source);
    const { data, error } = await sb.from('modeles_documents')
      .insert({ school_id: schoolId, ...versLigne(nom, source) }).select(COLONNES).single();
    if (error) throw error;
    const m = versModele(data);
    if (!m) throw new Error('Modèle illisible après enregistrement.');
    setModeles(prev => trier([...prev, m]));
    return m;
  }, [schoolId]);

  const modifier = useCallback(async (id: string, nom: string, source: SourceModele): Promise<ModeleEcole> => {
    controler(nom, source);
    const { data, error } = await sb.from('modeles_documents')
      .update(versLigne(nom, source)).eq('id', id).select(COLONNES).single();
    if (error) throw error;
    const m = versModele(data);
    if (!m) throw new Error('Modèle illisible après enregistrement.');
    setModeles(prev => trier(prev.map(x => (x.id === id ? m : x))));
    return m;
  }, []);

  const supprimer = useCallback(async (id: string): Promise<void> => {
    const { error } = await sb.from('modeles_documents').delete().eq('id', id);
    if (error) throw error;
    setModeles(prev => prev.filter(x => x.id !== id));
  }, []);

  return { modeles, loading, disponible, creer, modifier, supprimer };
};
