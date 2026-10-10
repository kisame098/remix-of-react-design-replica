import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Cible } from '@/lib/modelesDocuments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/** Une ligne du registre des documents délivrés (sans son contenu, lu à la demande). */
export interface DocumentDelivre {
  id: string;
  numero: string;
  seq: number;
  modeleNom: string;
  personneNom: string;
  personneType: Cible;
  creeLe: string;
}

const COLONNES = 'id, numero, numero_seq, modele_nom, personne_nom, personne_type, created_at';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const versDocument = (r: any): DocumentDelivre => ({
  id: r.id, numero: r.numero, seq: r.numero_seq, modeleNom: r.modele_nom, personneNom: r.personne_nom,
  personneType: r.personne_type, creeLe: r.created_at,
});

export interface DemandeDelivrance {
  anneeScolaire: string;
  prefixe: string;
  modeleNom: string;
  modeleRef: string;
  cible: Cible;
  personnes: { id: string | null; nom: string }[];
}

/**
 * Le registre des documents délivrés (docs/sql/documents_delivres.sql).
 * Les numéros sont attribués par la base, sous verrou : jamais deux fois le même.
 */
export const useDocumentsDelivres = (charger = true) => {
  const { school } = useAuth();
  const schoolId = school?.id ?? null;
  const [documents, setDocuments] = useState<DocumentDelivre[]>([]);
  const [loading, setLoading] = useState(charger);

  const recharger = useCallback(async () => {
    if (!schoolId) { setDocuments([]); setLoading(false); return; }
    const { data } = await sb.from('documents_delivres').select(COLONNES)
      .eq('school_id', schoolId).order('created_at', { ascending: false }).limit(1000);
    setDocuments(((data ?? []) as unknown[]).map(versDocument));
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { if (charger) void recharger(); }, [charger, recharger]);

  /** Attribue un numéro par personne, dans l'ordre de la liste. */
  const delivrer = useCallback(async (d: DemandeDelivrance): Promise<DocumentDelivre[]> => {
    const { data, error } = await sb.rpc('delivrer_documents', {
      p_annee: d.anneeScolaire, p_prefixe: d.prefixe, p_modele_nom: d.modeleNom, p_modele_ref: d.modeleRef,
      p_personne_type: d.cible, p_personnes: d.personnes,
    });
    if (error) throw error;
    return ((data ?? []) as unknown[]).map(versDocument).sort((a, b) => a.seq - b.seq);
  }, []);

  /** Le contenu exact, gardé pour la réimpression (une seule fois par document). */
  const conserverContenu = useCallback(async (id: string, html: string): Promise<void> => {
    const { error } = await sb.from('documents_delivres').update({ contenu_html: html }).eq('id', id);
    if (error) throw error;
  }, []);

  const lireContenu = useCallback(async (id: string): Promise<string | null> => {
    const { data, error } = await sb.from('documents_delivres').select('contenu_html').eq('id', id).single();
    if (error) throw error;
    return (data?.contenu_html as string | null) ?? null;
  }, []);

  return { documents, loading, recharger, delivrer, conserverContenu, lireContenu };
};
