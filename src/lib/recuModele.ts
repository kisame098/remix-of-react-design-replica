import type jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import type { RecuData } from '@/lib/recu';
import { eleveDocument, type ContexteDocument, type EleveSource } from '@/lib/modelesDocuments';
import { lireSource, produire } from '@/lib/modeleDocument';
import { recuSurDemiFeuille } from '@/lib/deuxParFeuille';
import { fabriquerPdfHtml } from '@/lib/modelesDocumentsPdf';

// ═══════════════════════════════════════════════════════════════════════════
// REÇU AU MODÈLE DE L'ÉCOLE (Documents → Reçus)
//
// Les mêmes données que le reçu SenClass (src/lib/recu.ts), posées dans le
// modèle choisi par le directeur. Chargé seulement au clic. Toute erreur est
// LEVÉE : l'appelant revient alors au reçu SenClass, pour qu'un encaissement
// ne reste jamais sans reçu.
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export const genererRecuModele = async (
  modeleId: string, data: RecuData, eleve: EleveSource | null, o: { deuxParFeuille?: boolean } = {},
): Promise<jsPDF> => {
  const { data: ligne, error } = await sb.from('modeles_documents')
    .select('genre, contenu, html, fichier').eq('id', modeleId).single();
  if (error || !ligne) throw new Error('Modèle de reçu introuvable.');
  const source = lireSource(ligne);
  if (!source || source.genre === 'word') throw new Error('Modèle de reçu illisible.');

  const contexte: ContexteDocument = {
    ecole: data.ecole,
    anneeScolaire: data.anneeScolaire,
    date: new Date().toISOString(),
    eleve: eleve
      ? eleveDocument(eleve, data.eleve.classe)
      : { matricule: data.eleve.matricule, nom: data.eleve.nom, prenom: '', tuteurs: [], classe: data.eleve.classe },
    recu: {
      numero: data.numero, date: data.date, lignes: data.lignes, total: data.total, mode: data.mode,
      reference: data.reference, encaissePar: data.encaissePar, annule: data.annule !== null, duplicata: data.duplicata,
    },
  };
  const p = await produire(source, [contexte]);
  if (p.refus) throw new Error('Le modèle de reçu contient des champs inconnus.');
  return fabriquerPdfHtml(o.deuxParFeuille ? recuSurDemiFeuille(p.html) : p.html);
};
