import type { StudentAttendance } from '@/types/attendance';
import { montantsDesTranches, type Dossier, type Organisme, type Tranche } from '@/lib/financements';

// ═══════════════════════════════════════════════════════════════════════════
// FINANCEMENTS — finances, rapports de fin de formation, insertion (étapes 2 à 5)
//
// Fonctions pures : tout ce qui touche à l'argent dû par l'organisme se
// calcule ici et se teste dans financementsSuivi.test.ts.
//
// FACTURES AU FINANCEUR. Une facture porte sur UNE tranche de l'organisme
// (acompte, solde…) et sur des apprenants : toute une cohorte d'un coup, ou un
// seul apprenant — l'école choisit à chaque émission (les deux pratiques
// existent). Chaque ligne = la part de la tranche pour un apprenant. Le
// solde se facture quand l'école le décide ; SenClass signale seulement ce qui
// manque (rapport final non transmis…), sans bloquer.
//
// VERSEMENTS. L'organisme paie une facture, en une ou plusieurs fois. Sur une
// facture de cohorte, un versement partiel est réparti entre les apprenants
// au prorata de leur ligne : c'est ce qui donne la situation par apprenant.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Factures ───────────────────────────────────────────────────────────────

export type PorteeFacture = 'cohorte' | 'apprenant';

export interface LigneFactureFinanceur {
  dossierId: string;
  studentEnrollmentId: string;
  nom: string;
  matricule: string;
  /** Somme prise en charge sur l'année pour cet apprenant. */
  finance: number;
  /** Ce que la tranche réclame pour lui. */
  montant: number;
}

export interface FactureFinanceur {
  id: string;
  organismeId: string;
  numero: number;
  /** Année de la numérotation (2026) : 3FPT-2026-0001. */
  annee: number;
  trancheId: string;
  trancheLibelle: string;
  tranchePourcentage: number;
  portee: PorteeFacture;
  /** La classe de la promotion (une facture ne mélange jamais deux promotions). */
  classId?: string;
  dateEmission: string;
  dateEcheance?: string;
  lignes: LigneFactureFinanceur[];
  total: number;
  annulee: boolean;
  note?: string;
  creePar?: string;
  createdAt: string;
}

export interface Versement {
  id: string;
  factureId: string;
  montant: number;
  date: string;
  reference?: string;
  note?: string;
  creePar?: string;
}

export type StatutFacture = 'payee' | 'partielle' | 'en_attente' | 'en_retard' | 'annulee';

export const LIBELLES_STATUT_FACTURE: Record<StatutFacture, string> = {
  payee: 'Payée',
  partielle: 'Payée en partie',
  en_attente: 'En attente',
  en_retard: 'En retard',
  annulee: 'Annulée',
};

export const COULEUR_STATUT_FACTURE: Record<StatutFacture, string> = {
  payee: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  partielle: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  en_attente: 'bg-muted text-muted-foreground',
  en_retard: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  annulee: 'bg-muted text-muted-foreground line-through',
};

/** « 3FPT-2026-0007 » : le nom de l'organisme sans espace, l'année, le rang. */
export const numeroFacture = (organisme: string, annee: number, numero: number): string =>
  `${organisme.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase() || 'FIN'}-${annee}-${String(numero).padStart(4, '0')}`;

/** Le prochain numéro de l'année (les annulées gardent leur numéro : il n'est jamais réattribué). */
export const prochainNumero = (factures: Pick<FactureFinanceur, 'annee' | 'numero'>[], annee: number): number =>
  factures.filter(f => f.annee === annee).reduce((m, f) => Math.max(m, f.numero), 0) + 1;

export const totalVerse = (factureId: string, versements: Versement[]): number =>
  versements.filter(v => v.factureId === factureId).reduce((s, v) => s + v.montant, 0);

export const statutFacture = (f: FactureFinanceur, versements: Versement[], aujourdhui: string): StatutFacture => {
  if (f.annulee) return 'annulee';
  const verse = totalVerse(f.id, versements);
  if (verse >= f.total) return 'payee';
  if (verse > 0) return 'partielle';
  return f.dateEcheance && f.dateEcheance < aujourdhui ? 'en_retard' : 'en_attente';
};

/** Montant de la tranche pour un apprenant dont l'organisme finance `finance`. */
export const montantTranche = (o: Organisme, trancheId: string, finance: number): number =>
  montantsDesTranches(o, finance).find(t => t.tranche.id === trancheId)?.montant ?? 0;

/** La tranche est-elle déjà facturée pour ce dossier (facture non annulée) ? */
export const factureDeLaTranche = (factures: FactureFinanceur[], dossierId: string, trancheId: string): FactureFinanceur | undefined =>
  factures.find(f => !f.annulee && f.trancheId === trancheId && f.lignes.some(l => l.dossierId === dossierId));

/**
 * Ce qu'un versement couvre pour chaque ligne : au prorata des montants, la
 * dernière ligne absorbant l'arrondi pour que la somme tombe juste.
 */
export const repartirVersement = (lignes: LigneFactureFinanceur[], montant: number): Map<string, number> => {
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  const parts = new Map<string, number>();
  if (total <= 0 || lignes.length === 0) return parts;
  let reste = Math.min(montant, total);
  lignes.forEach((l, i) => {
    const part = i === lignes.length - 1 ? reste : Math.round((Math.min(montant, total) * l.montant) / total);
    parts.set(l.dossierId, (parts.get(l.dossierId) ?? 0) + part);
    reste -= part;
  });
  return parts;
};

export interface SituationFinanciere {
  finance: number;
  facture: number;
  recu: number;
  /** Pris en charge mais pas encore facturé. */
  resteAFacturer: number;
  /** Facturé mais pas encore reçu. */
  resteAEncaisser: number;
}

/** La situation d'UN apprenant : ce que l'organisme doit, ce qui est facturé, ce qui est reçu. */
export const situationFinanciere = (
  dossierId: string, finance: number, factures: FactureFinanceur[], versements: Versement[],
): SituationFinanciere => {
  let facture = 0;
  let recu = 0;
  for (const f of factures) {
    if (f.annulee) continue;
    const ligne = f.lignes.find(l => l.dossierId === dossierId);
    if (!ligne) continue;
    facture += ligne.montant;
    recu += repartirVersement(f.lignes, totalVerse(f.id, versements)).get(dossierId) ?? 0;
  }
  return { finance, facture, recu, resteAFacturer: Math.max(0, finance - facture), resteAEncaisser: Math.max(0, facture - recu) };
};

/** Additionne des situations (une cohorte, une formation, l'école). */
export const sommeSituations = (s: SituationFinanciere[]): SituationFinanciere => s.reduce((a, x) => ({
  finance: a.finance + x.finance, facture: a.facture + x.facture, recu: a.recu + x.recu,
  resteAFacturer: a.resteAFacturer + x.resteAFacturer, resteAEncaisser: a.resteAEncaisser + x.resteAEncaisser,
}), { finance: 0, facture: 0, recu: 0, resteAFacturer: 0, resteAEncaisser: 0 });

/** Les tranches pas encore facturées pour un dossier, dans l'ordre de l'organisme. */
export const tranchesNonFacturees = (o: Organisme, dossierId: string, factures: FactureFinanceur[]): Tranche[] =>
  o.tranches.filter(t => !factureDeLaTranche(factures, dossierId, t.id));

// ─── Rapports de fin de formation ───────────────────────────────────────────

export type StatutRapport = 'a_produire' | 'en_cours' | 'transmis' | 'valide';

export const LIBELLES_STATUT_RAPPORT: Record<StatutRapport, string> = {
  a_produire: 'À produire',
  en_cours: 'En cours',
  transmis: 'Transmis',
  valide: 'Validé',
};
export const STATUTS_RAPPORT: StatutRapport[] = ['a_produire', 'en_cours', 'transmis', 'valide'];
export const COULEUR_STATUT_RAPPORT: Record<StatutRapport, string> = {
  a_produire: 'bg-muted text-muted-foreground',
  en_cours: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  transmis: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  valide: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
};

export interface Rapport {
  id: string;
  organismeId: string;
  /** Pour toute la cohorte, ou pour un apprenant (les deux existent). */
  portee: PorteeFacture;
  classId: string;
  dossierId?: string;
  titre: string;
  statut: StatutRapport;
  fichier?: string;
  dateTransmission?: string;
  dateValidation?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/** Une ligne d'historique : qui a fait quoi, quand (rapports, factures, transmissions). */
export interface EvenementJournal {
  id: string;
  objet: 'rapport' | 'facture' | 'dossier';
  objetId: string;
  action: string;
  detail?: string;
  parNom?: string;
  createdAt: string;
}

/** Le rapport final d'un apprenant est-il transmis (le sien, ou celui de sa cohorte) ? */
export const rapportTransmis = (rapports: Rapport[], classId: string, dossierId: string): boolean =>
  rapports.some(r => (r.statut === 'transmis' || r.statut === 'valide')
    && r.classId === classId && (r.portee === 'cohorte' || r.dossierId === dossierId));

// ─── Insertion professionnelle ──────────────────────────────────────────────

export type SituationInsertion = 'emploi' | 'auto_emploi' | 'stage' | 'etudes' | 'recherche' | 'sans_nouvelles';

export const LIBELLES_INSERTION: Record<SituationInsertion, string> = {
  emploi: 'En emploi (salarié)',
  auto_emploi: 'À son compte',
  stage: 'En stage',
  etudes: 'Poursuit ses études',
  recherche: "En recherche d'emploi",
  sans_nouvelles: 'Sans nouvelles',
};
export const SITUATIONS_INSERTION: SituationInsertion[] = ['emploi', 'auto_emploi', 'stage', 'etudes', 'recherche', 'sans_nouvelles'];
/** Inséré = a une activité professionnelle (emploi, à son compte, stage). */
export const estInsere = (s: SituationInsertion): boolean => s === 'emploi' || s === 'auto_emploi' || s === 'stage';
export const COULEUR_INSERTION: Record<SituationInsertion, string> = {
  emploi: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  auto_emploi: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  stage: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  etudes: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  recherche: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  sans_nouvelles: 'bg-muted text-muted-foreground',
};

export interface PointInsertion {
  id: string;
  dossierId: string;
  /** Date de la situation (pas de la saisie). */
  date: string;
  situation: SituationInsertion;
  structure?: string;
  poste?: string;
  note?: string;
  creePar?: string;
  createdAt: string;
}

/** La situation actuelle = le point le plus récent (à date égale, le dernier saisi). */
export const insertionActuelle = (points: PointInsertion[], dossierId: string): PointInsertion | undefined =>
  points.filter(p => p.dossierId === dossierId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];

/** Nombre de jours depuis la dernière mise à jour (pour relancer les situations anciennes). */
export const joursDepuis = (date: string, aujourdhui: string): number =>
  Math.round((Date.parse(aujourdhui) - Date.parse(date)) / 86_400_000);

/** Une situation non mise à jour depuis plus de 90 jours est à relancer. */
export const ANCIENNETE_INSERTION_JOURS = 90;

// ─── Suivi pédagogique ──────────────────────────────────────────────────────

export interface Assiduite { seances: number; presences: number; retards: number; absences: number; taux: number | null }

/** Présences d'un apprenant sur les séances déjà pointées. Retard = présent ; exclu de cours = absent. */
export const assiduite = (attendances: Pick<StudentAttendance, 'studentId' | 'status'>[], studentId: string): Assiduite => {
  const siennes = attendances.filter(a => a.studentId === studentId);
  const presences = siennes.filter(a => a.status === 'present').length;
  const retards = siennes.filter(a => a.status === 'late').length;
  const absences = siennes.length - presences - retards;
  return { seances: siennes.length, presences, retards, absences, taux: siennes.length ? Math.round(((presences + retards) / siennes.length) * 100) : null };
};

// ─── Alertes ────────────────────────────────────────────────────────────────

export interface Alerte { niveau: 'rouge' | 'orange'; texte: string }

/** Une promotion où l'organisme a des apprenants : ce qu'il faut pour les alertes de fin de formation. */
export interface PromotionFinancee { classId: string; nom: string; finFormation?: string }

/**
 * Ce qui demande l'attention chez UN organisme : dossiers pas encore validés
 * (la prise en charge ne s'applique pas tant qu'ils ne le sont pas),
 * factures en retard ou en attente, première tranche pas encore facturée,
 * promotion terminée sans rapport de fin transmis. Aucune ne bloque rien.
 */
export const alertesOrganisme = (p: {
  organisme: Organisme;
  dossiers: Dossier[];
  factures: FactureFinanceur[];
  versements: Versement[];
  rapports: Rapport[];
  /** Pour chaque dossier, la classe de sa promotion. */
  classeDe: (d: Dossier) => string | undefined;
  promotions: PromotionFinancee[];
  aujourdhui: string;
}): Alerte[] => {
  const alertes: Alerte[] = [];
  const s = (n: number) => (n > 1 ? 's' : '');
  const dossiers = p.dossiers.filter(d => d.organismeId === p.organisme.id);
  const aRegulariser = dossiers.filter(d => d.statut === 'a_regulariser').length;
  const aValider = dossiers.filter(d => d.statut === 'en_attente' || d.statut === 'complet').length;
  if (aRegulariser) alertes.push({ niveau: 'rouge', texte: `${aRegulariser} dossier${s(aRegulariser)} à régulariser` });
  if (aValider) alertes.push({ niveau: 'orange', texte: `${aValider} dossier${s(aValider)} à valider : d'ici là, l'apprenant paie tout` });

  const factures = p.factures.filter(f => f.organismeId === p.organisme.id);
  const retard = factures.filter(f => statutFacture(f, p.versements, p.aujourdhui) === 'en_retard').length;
  if (retard) alertes.push({ niveau: 'rouge', texte: `${retard} facture${s(retard)} en retard de paiement` });
  const attente = factures.filter(f => ['en_attente', 'partielle'].includes(statutFacture(f, p.versements, p.aujourdhui))).length;
  if (attente) alertes.push({ niveau: 'orange', texte: `${attente} facture${s(attente)} en attente de paiement` });

  const premiere = p.organisme.tranches[0];
  if (premiere) {
    const sans = dossiers.filter(d => d.statut === 'valide' && !factureDeLaTranche(factures, d.id, premiere.id)).length;
    if (sans) alertes.push({ niveau: 'orange', texte: `${premiere.libelle} pas encore facturé pour ${sans} dossier${s(sans)} validé${s(sans)}` });
  }

  for (const promo of p.promotions) {
    if (!promo.finFormation || promo.finFormation >= p.aujourdhui) continue;
    const siens = dossiers.filter(d => p.classeDe(d) === promo.classId);
    if (siens.length > 0 && !siens.every(d => rapportTransmis(p.rapports, promo.classId, d.id))) {
      alertes.push({ niveau: 'orange', texte: `${promo.nom} : formation terminée, rapport de fin pas encore transmis` });
    }
  }
  return alertes;
};

/** N° du reçu remis à l'organisme : celui de la facture suivi du rang du versement (3FPT-2026-0001-2). */
export const numeroRecuFinanceur = (numeroDeLaFacture: string, rang: number): string => `${numeroDeLaFacture}-${rang}`;

/** Aujourd'hui à Dakar, AAAA-MM-JJ. */
export const aujourdhuiIso = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar' }).format(new Date());
