import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePayment } from '@/contexts/PaymentContext';
import type { Student } from '@/contexts/SchoolContext';
import { useElementsAPayer } from '@/hooks/useElementsAPayer';
import { estFormationPro } from '@/lib/modeGestion';
import { cleElement } from '@/lib/tarifsEleve';
import {
  TAILLE_MAX_FICHIER, lireReglagesFinancements, lignesDeFinancement, parLots,
  type Dossier, type Organisme, type PieceDossier, type ReglagesFinancements,
} from '@/lib/financements';

// ═══════════════════════════════════════════════════════════════════════════
// DONNÉES DES FINANCEMENTS (3FPT…) — formation professionnelle
//
// Rien n'est chargé tant que l'école n'a pas activé le module (Paramètres →
// Financements). Activer le financement d'un apprenant fait deux choses :
// créer son dossier ET poser les réductions qui ramènent ses frais à sa part
// (src/lib/financements.ts → lignesDeFinancement). Le désactiver retire ces
// réductions sur ce qui n'est pas encore payé — jamais sur un frais soldé.
// ═══════════════════════════════════════════════════════════════════════════

// Table et bucket absents des types générés (docs/sql/financements_dossiers.sql).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
const BUCKET_FINANCEMENTS = 'financements';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lirePieces = (v: any): PieceDossier[] => (Array.isArray(v) ? v : [])
  .filter(p => p && typeof p.piece_id === 'string')
  .map(p => ({
    pieceId: p.piece_id, fournie: !!p.fournie, conforme: !!p.conforme,
    fichier: p.fichier || undefined, commentaire: p.commentaire || undefined,
  }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapDossier = (r: any): Dossier => ({
  id: r.id, studentEnrollmentId: r.student_enrollment_id, organismeId: r.organisme_id, statut: r.statut,
  contratNumero: r.contrat_numero ?? undefined, contratDate: r.contrat_date ?? undefined, contratSigne: !!r.contrat_signe,
  contratFichier: r.contrat_fichier ?? undefined,
  engagementDate: r.engagement_date ?? undefined, engagementSigne: !!r.engagement_signe, engagementFichier: r.engagement_fichier ?? undefined,
  situation: r.situation, situationDate: r.situation_date ?? undefined, situationMotif: r.situation_motif ?? undefined,
  note: r.note ?? undefined, ajustementIds: r.ajustement_ids ?? [], pieces: lirePieces(r.pieces),
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export type ModifDossier = Partial<Omit<Dossier, 'id' | 'studentEnrollmentId' | 'createdAt' | 'updatedAt' | 'ajustementIds'>>;

const texte = (v?: string) => v?.trim() || null;
const versLigne = (d: ModifDossier): Record<string, unknown> => {
  const l: Record<string, unknown> = {};
  if ('organismeId' in d) l.organisme_id = d.organismeId;
  if ('statut' in d) l.statut = d.statut;
  if ('contratNumero' in d) l.contrat_numero = texte(d.contratNumero);
  if ('contratDate' in d) l.contrat_date = d.contratDate || null;
  if ('contratSigne' in d) l.contrat_signe = !!d.contratSigne;
  if ('contratFichier' in d) l.contrat_fichier = d.contratFichier || null;
  if ('engagementDate' in d) l.engagement_date = d.engagementDate || null;
  if ('engagementSigne' in d) l.engagement_signe = !!d.engagementSigne;
  if ('engagementFichier' in d) l.engagement_fichier = d.engagementFichier || null;
  if ('situation' in d) l.situation = d.situation;
  if ('situationDate' in d) l.situation_date = d.situationDate || null;
  if ('situationMotif' in d) l.situation_motif = texte(d.situationMotif);
  if ('note' in d) l.note = texte(d.note);
  if ('pieces' in d) l.pieces = (d.pieces ?? []).map(p => ({
    piece_id: p.pieceId, fournie: p.fournie, conforme: p.conforme, fichier: p.fichier ?? null, commentaire: p.commentaire?.trim() || null,
  }));
  return l;
};

/** Nom de fichier sûr pour le stockage (sans accents ni espaces). */
const nomStockage = (nom: string): string => {
  const point = nom.lastIndexOf('.');
  const ext = point > 0 ? nom.slice(point + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const base = (point > 0 ? nom.slice(0, point) : nom).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'fichier';
  return `${base}-${Date.now().toString(36)}${ext ? `.${ext}` : ''}`;
};

interface FinancementsContextType {
  /** Le module est allumé pour cette école (formation pro + activé dans Paramètres). */
  actif: boolean;
  reglages: ReglagesFinancements;
  loading: boolean;
  /** `false` si la table n'existe pas encore (SQL pas encore appliqué). */
  disponible: boolean;
  dossiers: Dossier[];
  dossierDe: (enrollmentId: string) => Dossier | undefined;
  organisme: (id: string) => Organisme | undefined;

  /**
   * Crée le dossier et pose les réductions de l'apprenant. Renvoie le nombre
   * de frais ramenés à sa part. Exige le droit d'accorder des réductions.
   */
  activer: (eleve: Student, organismeId: string) => Promise<{ dossier: Dossier; fraisReduits: number }>;
  /** Supprime le dossier et retire les réductions encore utiles (frais non payés). */
  desactiver: (eleve: Student) => Promise<void>;
  /** Change d'organisme : retire les anciennes réductions, pose les nouvelles. */
  changerOrganisme: (eleve: Student, organismeId: string) => Promise<void>;
  /** Repose les réductions (frais apparus depuis : nouveau service, nouvelle année…). */
  reappliquer: (eleve: Student) => Promise<number>;
  modifier: (id: string, d: ModifDossier) => Promise<void>;

  /** Envoie un fichier dans le dossier ; renvoie son chemin à enregistrer. */
  televerser: (dossierId: string, fichier: File) => Promise<string>;
  /** Lien temporaire (5 min) pour ouvrir ou télécharger un fichier. */
  lienFichier: (chemin: string) => Promise<string>;
  supprimerFichier: (chemin: string) => Promise<void>;
}

const FinancementsContext = createContext<FinancementsContextType | null>(null);

export const FinancementsProvider = ({ children }: { children: ReactNode }) => {
  const { school, isSchoolAccessBlocked } = useAuth();
  const { getAjustementsEleve, appliquerTarifsEleve, retirerTarifsEleve, hasPaidInscription, hasPaidTuitionMonth, hasPaidService } = usePayment();
  const { elementsDe } = useElementsAPayer();
  const schoolId: string | null = school?.id ?? null;
  const reglages = useMemo(() => lireReglagesFinancements(school?.settings), [school?.settings]);
  const actif = estFormationPro(school) && reglages.actif && !isSchoolAccessBlocked;

  const [loading, setLoading] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);

  useEffect(() => {
    let annule = false;
    if (!schoolId || !actif) { setDossiers([]); setLoading(false); return; }
    setLoading(true);
    (async () => {
      const { data, error } = await sb.from('fin_dossiers').select('*').eq('school_id', schoolId).order('created_at');
      if (annule) return;
      setDisponible(!error);
      setDossiers(((data ?? []) as unknown[]).map(mapDossier));
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [schoolId, actif]);

  const organisme = useCallback((id: string) => reglages.organismes.find(o => o.id === id), [reglages]);
  const dossierDe = useCallback((enrollmentId: string) => dossiers.find(d => d.studentEnrollmentId === enrollmentId), [dossiers]);

  /** Les clés des frais qui portent déjà une réduction de CE financement. */
  const clesPropres = useCallback((eleve: Student, ids: string[]) => new Set(
    [...getAjustementsEleve(eleve.id).values()].filter(a => a.id && ids.includes(a.id)).map(a => cleElement(a)),
  ), [getAjustementsEleve]);

  /**
   * Pose (ou met à jour) les réductions du financement sur les frais concernés
   * encore à payer. Renvoie les identifiants des réductions posées.
   */
  const poserReductions = useCallback(async (eleve: Student, o: Organisme, propres: string[] = []): Promise<string[]> => {
    const lignes = lignesDeFinancement(o, eleve.id, elementsDe(eleve), clesPropres(eleve, propres));
    const ids: string[] = [];
    for (const lot of parLots(lignes)) {
      const posees = await appliquerTarifsEleve(eleve.id, lot);
      ids.push(...posees.map(a => a.id).filter((id): id is string => !!id));
    }
    return ids;
  }, [elementsDe, appliquerTarifsEleve, clesPropres]);

  /** Retire les réductions du financement sur les frais pas encore payés (un frais soldé garde sa trace). */
  const retirerReductions = useCallback(async (eleve: Student, ids: string[]) => {
    const index = getAjustementsEleve(eleve.id);
    const aRetirer = [...index.values()].filter(a => a.id && ids.includes(a.id)).filter(a =>
      a.type === 'inscription' ? !hasPaidInscription(eleve.id)
        : a.type === 'tuition' ? !hasPaidTuitionMonth(eleve.id, a.monthKey ?? '')
        : !hasPaidService(eleve.id, a.serviceId ?? '', a.monthKey),
    ).map(a => a.id as string);
    if (aRetirer.length > 0) await retirerTarifsEleve(aRetirer);
  }, [getAjustementsEleve, hasPaidInscription, hasPaidTuitionMonth, hasPaidService, retirerTarifsEleve]);

  const enregistrerAjustements = useCallback(async (id: string, ids: string[]) => {
    const { error } = await sb.from('fin_dossiers').update({ ajustement_ids: ids, updated_at: new Date().toISOString() })
      .eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setDossiers(prev => prev.map(d => d.id === id ? { ...d, ajustementIds: ids } : d));
  }, [schoolId]);

  const activer = useCallback<FinancementsContextType['activer']>(async (eleve, organismeId) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const o = reglages.organismes.find(x => x.id === organismeId);
    if (!o) throw new Error('Organisme introuvable : vérifiez Paramètres → Financements.');
    const { data: row, error } = await sb.from('fin_dossiers').insert({
      school_id: schoolId, student_enrollment_id: eleve.id, organisme_id: organismeId,
      pieces: o.pieces.map(p => ({ piece_id: p.id, fournie: false, conforme: false })),
    }).select().single();
    if (error) throw error;
    let dossier = mapDossier(row);
    setDossiers(prev => [...prev, dossier]);
    // Le dossier existe : si les réductions échouent (droit manquant), on le
    // dit, et « Réappliquer » dans le dossier permettra de les poser plus tard.
    const ids = await poserReductions(eleve, o);
    if (ids.length > 0) {
      await enregistrerAjustements(dossier.id, ids);
      dossier = { ...dossier, ajustementIds: ids };
    }
    return { dossier, fraisReduits: ids.length };
  }, [schoolId, reglages, poserReductions, enregistrerAjustements]);

  const desactiver = useCallback(async (eleve: Student) => {
    const d = dossiers.find(x => x.studentEnrollmentId === eleve.id);
    if (!d || !schoolId) return;
    await retirerReductions(eleve, d.ajustementIds);
    const fichiers = [d.contratFichier, d.engagementFichier, ...d.pieces.map(p => p.fichier)].filter((f): f is string => !!f);
    const { error } = await sb.from('fin_dossiers').delete().eq('id', d.id).eq('school_id', schoolId);
    if (error) throw error;
    if (fichiers.length > 0) await sb.storage.from(BUCKET_FINANCEMENTS).remove(fichiers);
    setDossiers(prev => prev.filter(x => x.id !== d.id));
  }, [dossiers, schoolId, retirerReductions]);

  const modifier = useCallback(async (id: string, d: ModifDossier) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    const { data: row, error } = await sb.from('fin_dossiers').update({ ...versLigne(d), updated_at: new Date().toISOString() })
      .eq('id', id).eq('school_id', schoolId).select().single();
    if (error) throw error;
    const nouveau = mapDossier(row);
    setDossiers(prev => prev.map(x => x.id === id ? nouveau : x));
  }, [schoolId]);

  const changerOrganisme = useCallback(async (eleve: Student, organismeId: string) => {
    const d = dossiers.find(x => x.studentEnrollmentId === eleve.id);
    const o = reglages.organismes.find(x => x.id === organismeId);
    if (!d || !o || d.organismeId === organismeId) return;
    // Les réductions des frais communs se mettent à jour (nouvelle part) ;
    // celles des frais que le nouvel organisme ne prend pas en charge partent.
    const posees = await poserReductions(eleve, o, d.ajustementIds);
    await retirerReductions(eleve, d.ajustementIds.filter(id => !posees.includes(id)));
    // Les pièces suivent la liste du nouvel organisme ; une pièce commune garde son état.
    const pieces = o.pieces.map(p => d.pieces.find(x => x.pieceId === p.id) ?? { pieceId: p.id, fournie: false, conforme: false });
    await modifier(d.id, { organismeId, pieces });
    await enregistrerAjustements(d.id, posees);
  }, [dossiers, reglages, retirerReductions, modifier, enregistrerAjustements, poserReductions]);

  const reappliquer = useCallback(async (eleve: Student) => {
    const d = dossiers.find(x => x.studentEnrollmentId === eleve.id);
    const o = d ? reglages.organismes.find(x => x.id === d.organismeId) : undefined;
    if (!d || !o) return 0;
    // Met à jour celles déjà posées (part modifiée dans les réglages) et couvre les nouveaux frais.
    const posees = await poserReductions(eleve, o, d.ajustementIds);
    await enregistrerAjustements(d.id, [...new Set([...d.ajustementIds, ...posees])]);
    return posees.length;
  }, [dossiers, reglages, poserReductions, enregistrerAjustements]);

  const televerser = useCallback(async (dossierId: string, fichier: File) => {
    if (!schoolId) throw new Error('Non connecté à une école');
    if (fichier.size > TAILLE_MAX_FICHIER) throw new Error('Fichier trop lourd : 10 Mo au plus.');
    const chemin = `${schoolId}/${dossierId}/${nomStockage(fichier.name)}`;
    const { error } = await sb.storage.from(BUCKET_FINANCEMENTS).upload(chemin, fichier, { upsert: false, contentType: fichier.type || undefined });
    if (error) throw error;
    return chemin;
  }, [schoolId]);

  const lienFichier = useCallback(async (chemin: string) => {
    const { data, error } = await sb.storage.from(BUCKET_FINANCEMENTS).createSignedUrl(chemin, 300);
    if (error || !data?.signedUrl) throw error ?? new Error('Fichier introuvable');
    return data.signedUrl as string;
  }, []);

  const supprimerFichier = useCallback(async (chemin: string) => {
    const { error } = await sb.storage.from(BUCKET_FINANCEMENTS).remove([chemin]);
    if (error) throw error;
  }, []);

  const value = useMemo<FinancementsContextType>(() => ({
    actif, reglages, loading, disponible, dossiers, dossierDe, organisme,
    activer, desactiver, changerOrganisme, reappliquer, modifier, televerser, lienFichier, supprimerFichier,
  }), [actif, reglages, loading, disponible, dossiers, dossierDe, organisme,
      activer, desactiver, changerOrganisme, reappliquer, modifier, televerser, lienFichier, supprimerFichier]);

  return <FinancementsContext.Provider value={value}>{children}</FinancementsContext.Provider>;
};

export const useFinancements = (): FinancementsContextType => {
  const ctx = useContext(FinancementsContext);
  if (!ctx) throw new Error('useFinancements must be used within FinancementsProvider');
  return ctx;
};
