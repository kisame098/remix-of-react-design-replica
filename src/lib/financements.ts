import type { PayableItem } from '@/lib/dueItems';
import { cleElement, type AjustementTarif } from '@/lib/tarifsEleve';

// ═══════════════════════════════════════════════════════════════════════════
// FINANCEMENTS — apprenants pris en charge par un organisme (3FPT…)
//
// Formation professionnelle seulement. L'école déclare ses organismes
// financeurs dans Paramètres → Financements ; chacun a ses propres règles :
//
//   • PART FINANCÉE (90 % pour le 3FPT) : l'organisme paie cette part des
//     frais concernés, l'apprenant paie le reste (10 %) à la caisse habituelle ;
//   • FRAIS CONCERNÉS : inscription, mensualités, chaque service annexe —
//     cochés un à un (un service de cantine n'est pas forcément financé) ;
//   • TRANCHES de versement de l'organisme (acompte 70 %, solde 30 % pour le
//     3FPT) : libellés et pourcentages libres, leur total fait 100 % ;
//   • PIÈCES du dossier : la liste que l'école exige, saisie par elle.
//
// Les valeurs du 3FPT ci-dessous viennent de la demande de l'école cliente
// (90 % / 10 %, acompte 70 % et solde 30 % des 90 %) : ce sont des valeurs PAR
// DÉFAUT, toutes modifiables.
//
// La part de l'apprenant passe par l'outil « Réductions » déjà en place
// (src/lib/tarifsEleve.ts) : une réduction en % sur chaque frais concerné,
// avec le motif du financement. Caisse, factures aux familles, reçus et suivi
// la voient donc sans rien changer au chemin de l'argent.
// ═══════════════════════════════════════════════════════════════════════════

export interface Tranche {
  id: string;
  libelle: string;
  /** Part de la somme financée, en % (acompte 70 = 70 % des 90 %). */
  pourcentage: number;
}

export interface PieceExigee {
  id: string;
  nom: string;
}

export interface Organisme {
  id: string;
  nom: string;
  /** Part des frais concernés payée par l'organisme, en %. */
  partFinancee: number;
  tranches: Tranche[];
  frais: { inscription: boolean; mensualites: boolean; services: string[] };
  pieces: PieceExigee[];
}

export interface ReglagesFinancements {
  actif: boolean;
  organismes: Organisme[];
}

/** 10 Mo : la limite d'un fichier du dossier (bucket « financements »). */
export const TAILLE_MAX_FICHIER = 10 * 1024 * 1024;

/** Clé de `schools.settings` où l'école garde ses financements. */
export const CLE_FINANCEMENTS = 'financements';

export const nouvelId = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Le 3FPT tel que décrit par l'école cliente : point de départ, tout se modifie. */
export const organisme3FPT = (): Organisme => ({
  id: nouvelId(),
  nom: '3FPT',
  partFinancee: 90,
  tranches: [
    { id: nouvelId(), libelle: 'Acompte', pourcentage: 70 },
    { id: nouvelId(), libelle: 'Solde', pourcentage: 30 },
  ],
  frais: { inscription: true, mensualites: true, services: [] },
  pieces: [],
});

export const organismeVierge = (): Organisme => ({
  id: nouvelId(),
  nom: '',
  partFinancee: 100,
  tranches: [{ id: nouvelId(), libelle: 'Paiement unique', pourcentage: 100 }],
  frais: { inscription: true, mensualites: true, services: [] },
  pieces: [],
});

const nombre = (v: unknown, defaut: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : defaut;
};
const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const lireOrganisme = (brut: unknown): Organisme | null => {
  if (!brut || typeof brut !== 'object') return null;
  const o = brut as Record<string, unknown>;
  const id = texte(o.id);
  if (!id) return null;
  const frais = (o.frais && typeof o.frais === 'object' ? o.frais : {}) as Record<string, unknown>;
  const tranches = Array.isArray(o.tranches) ? o.tranches : [];
  const pieces = Array.isArray(o.pieces) ? o.pieces : [];
  return {
    id,
    nom: texte(o.nom) || 'Organisme',
    // Entier : la base n'accepte qu'un pourcentage entier de réduction.
    partFinancee: Math.round(nombre(o.partFinancee, 100, 0, 100)),
    tranches: tranches
      .map(t => t as Record<string, unknown>)
      .filter(t => texte(t.id))
      .map(t => ({ id: texte(t.id), libelle: texte(t.libelle) || 'Tranche', pourcentage: nombre(t.pourcentage, 0, 0, 100) })),
    frais: {
      inscription: frais.inscription !== false,
      mensualites: frais.mensualites !== false,
      services: Array.isArray(frais.services) ? frais.services.filter((s): s is string => typeof s === 'string') : [],
    },
    pieces: pieces
      .map(p => p as Record<string, unknown>)
      .filter(p => texte(p.id) && texte(p.nom))
      .map(p => ({ id: texte(p.id), nom: texte(p.nom) })),
  };
};

/** Les réglages de l'école, corrigés s'ils sont abîmés ; rien d'enregistré = module éteint. */
export const lireReglagesFinancements = (settings: Record<string, unknown> | null | undefined): ReglagesFinancements => {
  const brut = settings?.[CLE_FINANCEMENTS];
  if (!brut || typeof brut !== 'object') return { actif: false, organismes: [] };
  const r = brut as Record<string, unknown>;
  const organismes = (Array.isArray(r.organismes) ? r.organismes : []).map(lireOrganisme).filter((o): o is Organisme => o !== null);
  return { actif: r.actif === true && organismes.length > 0, organismes };
};

/** Ce qui empêche d'enregistrer un organisme ; null s'il est valide. */
export const erreurOrganisme = (o: Organisme): string | null => {
  if (!o.nom.trim()) return "Donnez un nom à l'organisme.";
  if (!(Number.isInteger(o.partFinancee) && o.partFinancee > 0 && o.partFinancee <= 100)) return `${o.nom} : la part financée doit être un nombre entier entre 1 et 100 %.`;
  if (o.tranches.length === 0) return `${o.nom} : ajoutez au moins une tranche de versement.`;
  if (o.tranches.some(t => !t.libelle.trim())) return `${o.nom} : chaque tranche doit avoir un nom.`;
  const total = Math.round(o.tranches.reduce((s, t) => s + t.pourcentage, 0) * 100) / 100;
  if (total !== 100) return `${o.nom} : les tranches font ${String(total).replace('.', ',')} %, elles doivent faire 100 %.`;
  if (!o.frais.inscription && !o.frais.mensualites && o.frais.services.length === 0) return `${o.nom} : cochez au moins un frais pris en charge.`;
  return null;
};

// ─── Le dossier d'un apprenant ──────────────────────────────────────────────

export type StatutDossier = 'en_attente' | 'complet' | 'valide' | 'a_regulariser';

export const LIBELLES_STATUT_DOSSIER: Record<StatutDossier, string> = {
  en_attente: 'En attente',
  complet: 'Complet',
  valide: 'Validé',
  a_regulariser: 'À régulariser',
};

export const STATUTS_DOSSIER: StatutDossier[] = ['en_attente', 'complet', 'valide', 'a_regulariser'];

export const COULEUR_STATUT_DOSSIER: Record<StatutDossier, string> = {
  en_attente: 'bg-muted text-muted-foreground',
  complet: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  valide: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  a_regulariser: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
};

/** Où en est l'apprenant dans sa formation. */
export type Situation = 'en_formation' | 'abandon' | 'exclusion' | 'changement' | 'terminee';

export const LIBELLES_SITUATION: Record<Situation, string> = {
  en_formation: 'En formation',
  abandon: 'Abandon',
  exclusion: 'Exclusion',
  changement: 'Changement de situation',
  terminee: 'Formation terminée',
};

export const SITUATIONS: Situation[] = ['en_formation', 'abandon', 'exclusion', 'changement', 'terminee'];

/** Une situation qui sort l'apprenant de la formation demande une date et un motif. */
export const situationAvecMotif = (s: Situation): boolean => s === 'abandon' || s === 'exclusion' || s === 'changement';

export interface PieceDossier {
  pieceId: string;
  fournie: boolean;
  conforme: boolean;
  /** Chemin du fichier dans le stockage de l'école. */
  fichier?: string;
  commentaire?: string;
}

export interface Dossier {
  id: string;
  studentEnrollmentId: string;
  organismeId: string;
  statut: StatutDossier;
  contratNumero?: string;
  contratDate?: string;
  contratSigne: boolean;
  contratFichier?: string;
  engagementDate?: string;
  engagementSigne: boolean;
  engagementFichier?: string;
  situation: Situation;
  situationDate?: string;
  situationMotif?: string;
  note?: string;
  /** Réductions posées sur les frais de l'apprenant par ce financement. */
  ajustementIds: string[];
  pieces: PieceDossier[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Ce qui manque au dossier, dans l'ordre où on le traite. Sert d'aide : c'est
 * l'école qui décide du statut (un dossier peut être validé avec une pièce en
 * attente, si le financeur l'accepte).
 */
export const manquesDuDossier = (d: Pick<Dossier, 'contratSigne' | 'engagementSigne' | 'pieces'>, o: Organisme | undefined): string[] => {
  const manques: string[] = [];
  if (!d.contratSigne) manques.push('Contrat de formation non signé');
  if (!d.engagementSigne) manques.push("Lettre d'engagement non signée");
  for (const p of o?.pieces ?? []) {
    const etat = d.pieces.find(x => x.pieceId === p.id);
    if (!etat?.fournie) manques.push(`${p.nom} : à fournir`);
    else if (!etat.conforme) manques.push(`${p.nom} : à vérifier (non conforme)`);
  }
  return manques;
};

// ─── La part de l'apprenant (réductions) ────────────────────────────────────

/** Le motif écrit sur chaque réduction : visible dans Gestion des paiements → Réductions. */
export const motifFinancement = (o: Pick<Organisme, 'nom' | 'partFinancee'>): string =>
  `Financement ${o.nom} (${String(o.partFinancee).replace('.', ',')} % pris en charge)`;

/** Le frais est-il pris en charge par cet organisme ? */
export const fraisFinance = (o: Organisme, e: Pick<PayableItem, 'type' | 'serviceId'>): boolean =>
  e.type === 'inscription' ? o.frais.inscription
    : e.type === 'tuition' ? o.frais.mensualites
    : !!e.serviceId && o.frais.services.includes(e.serviceId);

/**
 * Les réductions à poser pour qu'un apprenant ne paie que sa part. Un frais
 * déjà soldé n'est jamais touché (règle de tarifsEleve.ts) ; un frais qui a
 * déjà un tarif personnalisé d'un autre motif est laissé tel quel — l'école
 * l'a voulu, on ne l'écrase pas en silence (il est signalé à part).
 *
 * `propres` : clés (cleElement) des réductions déjà posées par CE
 * financement — elles se mettent à jour (nouvelle part, nouvel organisme).
 */
export const lignesDeFinancement = (
  o: Organisme, studentId: string, elements: PayableItem[], propres: Set<string> = new Set(),
): AjustementTarif[] =>
  elements
    .filter(e => !e.paid && fraisFinance(o, e) && (!e.personnalise || propres.has(cleElement(e))))
    .map(e => ({
      studentId, type: e.type,
      ...(e.monthKey ? { monthKey: e.monthKey } : {}),
      ...(e.serviceId ? { serviceId: e.serviceId } : {}),
      mode: 'pourcentage' as const, valeur: o.partFinancee, motif: motifFinancement(o),
    }));

/** Frais concernés qui gardent un tarif personnalisé d'un autre motif : à vérifier par l'école. */
export const fraisDejaPersonnalises = (o: Organisme, elements: PayableItem[], propres: Set<string> = new Set()): PayableItem[] =>
  elements.filter(e => !e.paid && fraisFinance(o, e) && e.personnalise && !propres.has(cleElement(e)));

/**
 * Frais pris en charge, pas encore payés, mais au TARIF PLEIN : la part de
 * l'apprenant n'y est pas appliquée (frais apparus depuis l'activation, ou
 * réduction retirée à la main). Tant qu'il y en a, la caisse réclame tout.
 */
export const fraisNonCouverts = (o: Organisme, elements: PayableItem[]): PayableItem[] =>
  elements.filter(e => !e.paid && fraisFinance(o, e) && !e.personnalise);

/** La base n'accepte que 60 frais par appel : les longues années partent en plusieurs fois. */
export const parLots = <T,>(liste: T[], taille = 60): T[][] => {
  const lots: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) lots.push(liste.slice(i, i + taille));
  return lots;
};

/**
 * Ce que l'organisme prend en charge sur l'année, au tarif normal des frais
 * concernés (avant toute réduction) : la base de ses factures.
 */
export const montantFinance = (o: Organisme, elements: PayableItem[]): { base: number; finance: number; partApprenant: number } => {
  const base = elements.filter(e => fraisFinance(o, e)).reduce((s, e) => s + e.tarifNormal, 0);
  const finance = Math.round((base * o.partFinancee) / 100);
  return { base, finance, partApprenant: base - finance };
};

/** Le montant de chaque tranche ; la dernière absorbe l'arrondi pour que le total tombe juste. */
export const montantsDesTranches = (o: Organisme, finance: number): { tranche: Tranche; montant: number }[] => {
  let reste = finance;
  return o.tranches.map((t, i) => {
    const montant = i === o.tranches.length - 1 ? reste : Math.round((finance * t.pourcentage) / 100);
    reste -= montant;
    return { tranche: t, montant };
  });
};
