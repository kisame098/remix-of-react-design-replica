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
import {
  prochainNumero,
  type EvenementJournal, type FactureFinanceur, type LigneFactureFinanceur, type PointInsertion, type PorteeFacture,
  type Rapport, type StatutRapport, type Versement,
} from '@/lib/financementsSuivi';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapFacture = (r: any): FactureFinanceur => ({
  id: r.id, organismeId: r.organisme_id, numero: Number(r.numero), annee: Number(r.annee),
  trancheId: r.tranche_id, trancheLibelle: r.tranche_libelle, tranchePourcentage: Number(r.tranche_pourcentage),
  portee: r.portee, classId: r.class_id ?? undefined, dateEmission: r.date_emission, dateEcheance: r.date_echeance ?? undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lignes: (Array.isArray(r.lignes) ? r.lignes : []).map((l: any) => ({
    dossierId: l.dossier_id, studentEnrollmentId: l.student_enrollment_id, nom: l.nom ?? '', matricule: l.matricule ?? '',
    finance: Number(l.finance ?? 0), montant: Number(l.montant ?? 0),
  })),
  total: Number(r.total), annulee: !!r.annulee, note: r.note ?? undefined, creePar: r.cree_par ?? undefined, createdAt: r.created_at,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapVersement = (r: any): Versement => ({
  id: r.id, factureId: r.facture_id, montant: Number(r.montant), date: r.date,
  reference: r.reference ?? undefined, note: r.note ?? undefined, creePar: r.cree_par ?? undefined,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapRapport = (r: any): Rapport => ({
  id: r.id, organismeId: r.organisme_id, portee: r.portee, classId: r.class_id, dossierId: r.dossier_id ?? undefined,
  titre: r.titre, statut: r.statut, fichier: r.fichier ?? undefined, dateTransmission: r.date_transmission ?? undefined,
  dateValidation: r.date_validation ?? undefined, note: r.note ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapJournal = (r: any): EvenementJournal => ({
  id: r.id, objet: r.objet, objetId: r.objet_id, action: r.action, detail: r.detail ?? undefined, parNom: r.par_nom ?? undefined, createdAt: r.created_at,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapInsertion = (r: any): PointInsertion => ({
  id: r.id, dossierId: r.dossier_id, date: r.date, situation: r.situation, structure: r.structure ?? undefined,
  poste: r.poste ?? undefined, note: r.note ?? undefined, creePar: r.cree_par ?? undefined, createdAt: r.created_at,
});

/** « 2026-10-14 » → « 14/10/2026 » pour l'historique. */
const dateFr = (iso?: string) => { if (!iso) return ''; const [a, m, j] = iso.split('-'); return j && m ? `${j}/${m}/${a}` : iso; };

/** Ce que l'historique écrit quand un rapport change d'état. */
const ACTION_RAPPORT: Record<StatutRapport, string> = { a_produire: 'Remis à produire', en_cours: 'En cours de rédaction', transmis: 'Transmis', valide: 'Validé' };

/** Une facture à émettre : tout sauf ce que la base attribue (numéro, dates de création). */
export interface BrouillonFacture {
  organismeId: string;
  trancheId: string;
  trancheLibelle: string;
  tranchePourcentage: number;
  portee: PorteeFacture;
  classId: string;
  dateEmission: string;
  dateEcheance?: string;
  lignes: LigneFactureFinanceur[];
  note?: string;
}

export type DonneesRapport = Pick<Rapport, 'organismeId' | 'portee' | 'classId' | 'dossierId' | 'titre'> & Partial<Pick<Rapport, 'statut' | 'note'>>;
export type ModifRapport = Partial<Pick<Rapport, 'titre' | 'statut' | 'fichier' | 'dateTransmission' | 'dateValidation' | 'note'>>;

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

  // ── Étapes 2 à 5 : finances, rapports, insertion ──
  /** `false` si les tables du suivi n'existent pas encore (financements_suivi.sql). */
  suiviDisponible: boolean;
  factures: FactureFinanceur[];
  versements: Versement[];
  rapports: Rapport[];
  journal: EvenementJournal[];
  insertions: PointInsertion[];
  /** Numérote (par organisme et par année) et enregistre ; renvoie les factures créées. */
  emettreFactures: (brouillons: BrouillonFacture[]) => Promise<FactureFinanceur[]>;
  annulerFacture: (id: string, motif: string) => Promise<void>;
  ajouterVersement: (factureId: string, v: Omit<Versement, 'id' | 'factureId' | 'creePar'>) => Promise<void>;
  /** Directeur seulement (vérifié par la base). */
  supprimerVersement: (id: string) => Promise<void>;
  creerRapport: (d: DonneesRapport) => Promise<Rapport>;
  modifierRapport: (id: string, d: ModifRapport) => Promise<void>;
  supprimerRapport: (id: string) => Promise<void>;
  ajouterInsertion: (p: Omit<PointInsertion, 'id' | 'createdAt' | 'creePar'>) => Promise<void>;
  supprimerInsertion: (id: string) => Promise<void>;
}

const FinancementsContext = createContext<FinancementsContextType | null>(null);

export const FinancementsProvider = ({ children }: { children: ReactNode }) => {
  const { school, isSchoolAccessBlocked, profile } = useAuth();
  const parNom = profile?.full_name || profile?.email || undefined;
  const { getAjustementsEleve, appliquerTarifsEleve, retirerTarifsEleve, hasPaidInscription, hasPaidTuitionMonth, hasPaidService } = usePayment();
  const { elementsDe } = useElementsAPayer();
  const schoolId: string | null = school?.id ?? null;
  const reglages = useMemo(() => lireReglagesFinancements(school?.settings), [school?.settings]);
  const actif = estFormationPro(school) && reglages.actif && !isSchoolAccessBlocked;

  const [loading, setLoading] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [suiviDisponible, setSuiviDisponible] = useState(true);
  const [factures, setFactures] = useState<FactureFinanceur[]>([]);
  const [versements, setVersements] = useState<Versement[]>([]);
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [journal, setJournal] = useState<EvenementJournal[]>([]);
  const [insertions, setInsertions] = useState<PointInsertion[]>([]);

  const chargerFactures = useCallback(async () => {
    const { data, error } = await sb.from('fin_factures').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
    if (!error) setFactures(((data ?? []) as unknown[]).map(mapFacture));
    return error ? null : ((data ?? []) as unknown[]).map(mapFacture);
  }, [schoolId]);

  useEffect(() => {
    let annule = false;
    if (!schoolId || !actif) {
      setDossiers([]); setFactures([]); setVersements([]); setRapports([]); setJournal([]); setInsertions([]);
      setLoading(false); return;
    }
    setLoading(true);
    (async () => {
      const lire = (table: string, ordre = 'created_at') => sb.from(table).select('*').eq('school_id', schoolId).order(ordre);
      const [dRes, fRes, vRes, rRes, jRes, iRes] = await Promise.all([
        lire('fin_dossiers'), lire('fin_factures'), lire('fin_versements', 'date'), lire('fin_rapports'), lire('fin_journal'), lire('fin_insertions', 'date'),
      ]);
      if (annule) return;
      setDisponible(!dRes.error);
      setDossiers(((dRes.data ?? []) as unknown[]).map(mapDossier));
      // Le suivi (étapes 2 à 5) a ses propres tables : leur absence ne gêne pas les dossiers.
      setSuiviDisponible(!fRes.error && !rRes.error && !iRes.error);
      setFactures(((fRes.data ?? []) as unknown[]).map(mapFacture).reverse());
      setVersements(((vRes.data ?? []) as unknown[]).map(mapVersement));
      setRapports(((rRes.data ?? []) as unknown[]).map(mapRapport));
      setJournal(((jRes.data ?? []) as unknown[]).map(mapJournal));
      setInsertions(((iRes.data ?? []) as unknown[]).map(mapInsertion));
      setLoading(false);
    })();
    return () => { annule = true; };
  }, [schoolId, actif]);

  /** Une ligne d'historique ; son échec n'annule jamais l'action qu'elle raconte. */
  const journaliser = useCallback(async (objet: EvenementJournal['objet'], objetId: string, action: string, detail?: string) => {
    const { data } = await sb.from('fin_journal').insert({ school_id: schoolId, objet, objet_id: objetId, action, detail: detail ?? null, par_nom: parNom ?? null })
      .select().single();
    if (data) setJournal(prev => [...prev, mapJournal(data)]);
  }, [schoolId, parNom]);

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
    // Met à jour celles déjà posées (part modifiée dans les réglages) et couvre
    // les frais au tarif plein (nouveaux, ou réduction retirée à la main).
    const posees = await poserReductions(eleve, o, d.ajustementIds);
    const encore = new Set([...getAjustementsEleve(eleve.id).values()].map(a => a.id));
    await enregistrerAjustements(d.id, [...new Set([...d.ajustementIds.filter(id => encore.has(id)), ...posees])]);
    return posees.length;
  }, [dossiers, reglages, poserReductions, enregistrerAjustements, getAjustementsEleve]);

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

  // ── Factures ──
  const emettreFactures = useCallback(async (brouillons: BrouillonFacture[]): Promise<FactureFinanceur[]> => {
    if (!schoolId) throw new Error('Non connecté à une école');
    // Deux essais : si quelqu'un a émis une facture entre-temps, le numéro
    // est déjà pris (contrainte unique) ; on relit et on renumérote.
    for (let essai = 0; essai < 2; essai++) {
      const base = essai === 0 ? factures : (await chargerFactures()) ?? factures;
      const suivants = new Map<string, number>();
      const lignes = brouillons.map(b => {
        const annee = Number(b.dateEmission.slice(0, 4));
        const cle = `${b.organismeId}:${annee}`;
        const numero = suivants.get(cle) ?? prochainNumero(base.filter(f => f.organismeId === b.organismeId), annee);
        suivants.set(cle, numero + 1);
        return {
          school_id: schoolId, organisme_id: b.organismeId, numero, annee,
          tranche_id: b.trancheId, tranche_libelle: b.trancheLibelle, tranche_pourcentage: b.tranchePourcentage,
          portee: b.portee, class_id: b.classId, date_emission: b.dateEmission, date_echeance: b.dateEcheance || null,
          lignes: b.lignes.map(l => ({ dossier_id: l.dossierId, student_enrollment_id: l.studentEnrollmentId, nom: l.nom, matricule: l.matricule, finance: l.finance, montant: l.montant })),
          total: b.lignes.reduce((s, l) => s + l.montant, 0), note: b.note?.trim() || null, cree_par: parNom ?? null,
        };
      });
      const { data, error } = await sb.from('fin_factures').insert(lignes).select();
      if (error?.code === '23505' && essai === 0) continue;
      if (error) throw error;
      const creees = ((data ?? []) as unknown[]).map(mapFacture);
      setFactures(prev => [...prev, ...creees]);
      for (const f of creees) void journaliser('facture', f.id, 'Émise', `${f.trancheLibelle} — ${f.lignes.length} apprenant${f.lignes.length > 1 ? 's' : ''}`);
      return creees;
    }
    throw new Error('Numérotation impossible : réessayez.');
  }, [schoolId, factures, chargerFactures, parNom, journaliser]);

  const annulerFacture = useCallback(async (id: string, motif: string) => {
    const { data, error } = await sb.from('fin_factures')
      .update({ annulee: true, annulee_le: new Date().toISOString(), annulee_par: parNom ?? null, note: motif.trim() || null })
      .eq('id', id).eq('school_id', schoolId).select().single();
    if (error) throw error;
    setFactures(prev => prev.map(f => f.id === id ? mapFacture(data) : f));
    void journaliser('facture', id, 'Annulée', motif.trim() || undefined);
  }, [schoolId, parNom, journaliser]);

  const ajouterVersement = useCallback(async (factureId: string, v: Omit<Versement, 'id' | 'factureId' | 'creePar'>) => {
    const { data, error } = await sb.from('fin_versements').insert({
      school_id: schoolId, facture_id: factureId, montant: v.montant, date: v.date,
      reference: v.reference?.trim() || null, note: v.note?.trim() || null, cree_par: parNom ?? null,
    }).select().single();
    if (error) throw error;
    setVersements(prev => [...prev, mapVersement(data)]);
    void journaliser('facture', factureId, 'Versement reçu', `${new Intl.NumberFormat('fr-FR').format(v.montant)} F le ${dateFr(v.date)}${v.reference ? ` (réf. ${v.reference})` : ''}`);
  }, [schoolId, parNom, journaliser]);

  const supprimerVersement = useCallback(async (id: string) => {
    const v = versements.find(x => x.id === id);
    const { error } = await sb.from('fin_versements').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    // Une suppression refusée par la base (droit) ne renvoie pas d'erreur : on relit.
    const { data } = await sb.from('fin_versements').select('id').eq('id', id);
    if ((data ?? []).length > 0) throw new Error('Seul le directeur peut retirer un versement.');
    setVersements(prev => prev.filter(x => x.id !== id));
    if (v) void journaliser('facture', v.factureId, 'Versement retiré', `${new Intl.NumberFormat('fr-FR').format(v.montant)} F du ${dateFr(v.date)}`);
  }, [schoolId, versements, journaliser]);

  // ── Rapports ──
  const creerRapport = useCallback(async (d: DonneesRapport): Promise<Rapport> => {
    const { data, error } = await sb.from('fin_rapports').insert({
      school_id: schoolId, organisme_id: d.organismeId, portee: d.portee, class_id: d.classId,
      dossier_id: d.portee === 'apprenant' ? d.dossierId : null, titre: d.titre.trim(), statut: d.statut ?? 'a_produire', note: d.note?.trim() || null,
    }).select().single();
    if (error) throw error;
    const r = mapRapport(data);
    setRapports(prev => [...prev, r]);
    void journaliser('rapport', r.id, 'Créé', r.titre);
    return r;
  }, [schoolId, journaliser]);

  const modifierRapport = useCallback(async (id: string, d: ModifRapport) => {
    const avant = rapports.find(r => r.id === id);
    const ligne: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('titre' in d) ligne.titre = d.titre?.trim();
    if ('statut' in d) ligne.statut = d.statut;
    if ('fichier' in d) ligne.fichier = d.fichier || null;
    if ('dateTransmission' in d) ligne.date_transmission = d.dateTransmission || null;
    if ('dateValidation' in d) ligne.date_validation = d.dateValidation || null;
    if ('note' in d) ligne.note = d.note?.trim() || null;
    const { data, error } = await sb.from('fin_rapports').update(ligne).eq('id', id).eq('school_id', schoolId).select().single();
    if (error) throw error;
    const r = mapRapport(data);
    setRapports(prev => prev.map(x => x.id === id ? r : x));
    if (avant && d.statut && d.statut !== avant.statut) {
      const date = d.statut === 'transmis' ? r.dateTransmission : d.statut === 'valide' ? r.dateValidation : undefined;
      void journaliser('rapport', id, ACTION_RAPPORT[d.statut], date ? `le ${dateFr(date)}` : undefined);
    }
    if (avant && 'fichier' in d && d.fichier !== avant.fichier) void journaliser('rapport', id, d.fichier ? 'Fichier joint' : 'Fichier retiré');
  }, [schoolId, rapports, journaliser]);

  const supprimerRapport = useCallback(async (id: string) => {
    const r = rapports.find(x => x.id === id);
    const { error } = await sb.from('fin_rapports').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    if (r?.fichier) await sb.storage.from(BUCKET_FINANCEMENTS).remove([r.fichier]);
    setRapports(prev => prev.filter(x => x.id !== id));
  }, [schoolId, rapports]);

  // ── Insertion ──
  const ajouterInsertion = useCallback(async (p: Omit<PointInsertion, 'id' | 'createdAt' | 'creePar'>) => {
    const { data, error } = await sb.from('fin_insertions').insert({
      school_id: schoolId, dossier_id: p.dossierId, date: p.date, situation: p.situation,
      structure: p.structure?.trim() || null, poste: p.poste?.trim() || null, note: p.note?.trim() || null, cree_par: parNom ?? null,
    }).select().single();
    if (error) throw error;
    setInsertions(prev => [...prev, mapInsertion(data)]);
  }, [schoolId, parNom]);

  const supprimerInsertion = useCallback(async (id: string) => {
    const { error } = await sb.from('fin_insertions').delete().eq('id', id).eq('school_id', schoolId);
    if (error) throw error;
    setInsertions(prev => prev.filter(x => x.id !== id));
  }, [schoolId]);

  const value = useMemo<FinancementsContextType>(() => ({
    actif, reglages, loading, disponible, dossiers, dossierDe, organisme,
    activer, desactiver, changerOrganisme, reappliquer, modifier, televerser, lienFichier, supprimerFichier,
    suiviDisponible, factures, versements, rapports, journal, insertions,
    emettreFactures, annulerFacture, ajouterVersement, supprimerVersement,
    creerRapport, modifierRapport, supprimerRapport, ajouterInsertion, supprimerInsertion,
  }), [suiviDisponible, factures, versements, rapports, journal, insertions,
      emettreFactures, annulerFacture, ajouterVersement, supprimerVersement,
      creerRapport, modifierRapport, supprimerRapport, ajouterInsertion, supprimerInsertion,
      actif, reglages, loading, disponible, dossiers, dossierDe, organisme,
      activer, desactiver, changerOrganisme, reappliquer, modifier, televerser, lienFichier, supprimerFichier]);

  return <FinancementsContext.Provider value={value}>{children}</FinancementsContext.Provider>;
};

export const useFinancements = (): FinancementsContextType => {
  const ctx = useContext(FinancementsContext);
  if (!ctx) throw new Error('useFinancements must be used within FinancementsProvider');
  return ctx;
};
