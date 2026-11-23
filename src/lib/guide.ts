import type { ModeGestion } from '@/lib/modeGestion';
import { hasPermission, isCashierAccount, type PermissionKey } from '@/lib/permissions';
import type { SignalGuide } from '@/lib/signauxGuide';

// ═══════════════════════════════════════════════════════════════════════════
// MODE GUIDÉ — les règles, sans React
//
// Le guide MONTRE où agir et ATTEND : c'est la personne qui clique, écrit et
// enregistre, sur sa vraie école. Aucune étape ne fait le travail à sa place.
//
// Réservé pour l'instant aux écoles bêta-testeuses (schools.beta_testeur).
// ═══════════════════════════════════════════════════════════════════════════

/** Le guide est-il proposé à ce compte ? (écoles bêta ; directeur et personnel, jamais la caisse mobile) */
export const accesGuide = (
  school: { beta_testeur?: boolean | null } | null | undefined,
  accountRole: string | null | undefined,
  staffPermissions: string[] | null | undefined,
): boolean =>
  school?.beta_testeur === true
  && (accountRole === 'admin' || accountRole === 'staff')
  && !isCashierAccount(accountRole, staffPermissions);

/** Élément désigné : la valeur de l'attribut data-guide posé dans l'écran. */
export interface Champ {
  cible: string;
  /** Nom affiché dans la liste de contrôle de la bulle. */
  libelle?: string;
}

export type Condition =
  /** On lit, puis « Continuer ». */
  | { type: 'lire' }
  /** Tous les champs désignés sont remplis, puis « Continuer ». */
  | { type: 'rempli' }
  /** La personne arrive sur cette page (avance toute seule). */
  | { type: 'page'; chemin: string | RegExp }
  /** Cet élément apparaît : onglet ouvert, fenêtre ouverte… (avance toute seule). */
  | { type: 'visible'; cible: string }
  /** L'écran confirme l'enregistrement (avance toute seule). */
  | { type: 'signal'; nom: SignalGuide };

export type Importance = 'obligatoire' | 'conseille' | 'facultatif';

export interface Etape {
  id: string;
  titre: string;
  texte: string;
  astuce?: string;
  /** L'ordre affiché sur l'écran, quand « Cliquez ici » ne suffit pas. */
  action?: string;
  champs?: Champ[];
  /** Page où se passe l'étape ; ailleurs, la bulle propose d'y retourner. */
  page?: string | RegExp;
  condition: Condition;
  importance?: Importance;
  /** Étape à reprendre si l'élément n'est plus là (fenêtre refermée). */
  siAbsent?: string;
  /** Ce qu'on dit quand l'élément n'existe pas (aucune classe, aucun élève…). */
  absence?: string;
  /** « Passer » saute jusqu'à cette étape (par-dessus toute une création) ; 'fin' = fin du chapitre. */
  passerVers?: string;
  permission?: PermissionKey;
  adminOnly?: boolean;
  mode?: ModeGestion;
}

export type IconeChapitre =
  | 'reperes' | 'parametres' | 'cursus' | 'classes' | 'formations' | 'eleve' | 'eleves' | 'prof' | 'profs'
  | 'notes' | 'emploi' | 'presences' | 'paiements' | 'autres';

export interface Chapitre {
  id: string;
  titre: string;
  description: string;
  icone: IconeChapitre;
  permission?: PermissionKey;
  adminOnly?: boolean;
  mode?: ModeGestion;
  etapes: Etape[];
}

// ─── Le parcours de CE compte ───────────────────────────────────────────────

export interface ProfilGuide {
  mode: ModeGestion;
  accountRole: string | null | undefined;
  staffPermissions: string[] | null | undefined;
}

const concerne = (e: { permission?: PermissionKey; adminOnly?: boolean; mode?: ModeGestion }, p: ProfilGuide): boolean =>
  (!e.mode || e.mode === p.mode)
  && (!e.adminOnly || p.accountRole === 'admin')
  && (!e.permission || hasPermission(p.accountRole, p.staffPermissions, e.permission));

/** Ne garde que ce que le compte peut réellement ouvrir. */
export const parcoursPour = (chapitres: Chapitre[], profil: ProfilGuide): Chapitre[] =>
  chapitres
    .filter(c => concerne(c, profil))
    .map(c => ({ ...c, etapes: c.etapes.filter(e => concerne(e, profil)) }))
    .filter(c => c.etapes.length > 0);

// ─── Où en est-on sur l'écran ? ─────────────────────────────────────────────

export const correspond = (attendu: string | RegExp, chemin: string): boolean =>
  typeof attendu === 'string' ? chemin === attendu : attendu.test(chemin);

/** La page où aller quand on s'est perdu ; null si l'adresse dépend d'un choix (classe, période…). */
export const pageOuAller = (etape: Etape): string | null => {
  if (etape.condition.type === 'page' && typeof etape.condition.chemin === 'string') return etape.condition.chemin;
  return typeof etape.page === 'string' ? etape.page : null;
};

export const estVisible = (el: Element): boolean => el.getClientRects().length > 0;

export const trouver = (cible: string, visible: (el: Element) => boolean = estVisible): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-guide="${cible}"]`)).find(visible) ?? null;

const CHAMPS_SAISIE = 'input:not([type="file"]):not([type="hidden"]), textarea, [role="combobox"]';

/** Tous les champs de saisie de l'élément désigné ont-ils une valeur ? */
export const estRempli = (el: HTMLElement): boolean => {
  const champs = el.matches(CHAMPS_SAISIE) ? [el] : Array.from(el.querySelectorAll<HTMLElement>(CHAMPS_SAISIE));
  if (champs.length === 0) return false;
  return champs.every(c => c instanceof HTMLInputElement || c instanceof HTMLTextAreaElement
    ? c.value.trim() !== ''
    : !c.hasAttribute('data-placeholder'));
};

/** Ce que la personne doit faire maintenant, et sur quel élément. */
export interface Geste {
  type: 'cliquer' | 'ecrire' | 'choisir';
  /** Étiquette posée sur l'élément : « Cliquez ici ». */
  etiquette: string;
  element: HTMLElement | null;
  /** Le champ concerné (« Nom de l'école »). */
  libelle: string;
}

export interface EtatEtape {
  /** On n'est pas sur la page de l'étape. */
  horsPage: boolean;
  elements: HTMLElement[];
  /** L'étape désigne un élément, et il n'est pas à l'écran. */
  absente: boolean;
  /** Pour « rempli » : un état par champ désigné. */
  champs: { libelle: string; rempli: boolean }[];
  /** null = rien à faire, seulement à lire (ou déjà fait). */
  geste: Geste | null;
  satisfaite: boolean;
}

const ETIQUETTES: Record<Geste['type'], string> = { cliquer: 'Cliquez ici', ecrire: 'Écrivez ici', choisir: 'Choisissez ici' };

const gesteAFaire = (etape: Etape, cibles: { libelle: string; el: HTMLElement | null }[]): Geste | null => {
  if (etape.condition.type === 'lire') return null;
  if (etape.condition.type !== 'rempli') {
    return { type: 'cliquer', etiquette: etape.action ?? ETIQUETTES.cliquer, element: cibles.find(c => c.el)?.el ?? null, libelle: '' };
  }
  // Un champ à la fois : le premier qui reste à remplir.
  const reste = cibles.find(c => c.el && !estRempli(c.el));
  if (!reste?.el) return null;
  const liste = reste.el.matches('[role="combobox"]') || (!reste.el.querySelector('input, textarea') && reste.el.querySelector('[role="combobox"]') !== null);
  const type = liste ? 'choisir' : 'ecrire';
  return { type, etiquette: etape.action ?? ETIQUETTES[type], element: reste.el, libelle: reste.libelle };
};

/** Un signal n'est jamais « satisfait » ici : il arrive par un événement (etapeApresSignal). */
export const lireEtat = (
  etape: Etape, chemin: string, visible: (el: Element) => boolean = estVisible,
): EtatEtape => {
  const trouves = (etape.champs ?? []).map(c => ({ c, el: trouver(c.cible, visible) }));
  const elements = trouves.flatMap(t => (t.el ? [t.el] : []));
  const horsPage = etape.page !== undefined && !correspond(etape.page, chemin);
  const absente = !horsPage && trouves.length > 0 && elements.length === 0;
  const champs = etape.condition.type === 'rempli'
    ? trouves.map(t => ({ libelle: t.c.libelle ?? '', rempli: !!t.el && estRempli(t.el) }))
    : [];
  const cond = etape.condition;
  const satisfaite =
    cond.type === 'lire' ? true
    : cond.type === 'rempli' ? champs.length > 0 && champs.every(c => c.rempli)
    : cond.type === 'page' ? correspond(cond.chemin, chemin)
    : cond.type === 'visible' ? trouver(cond.cible, visible) !== null
    : false;
  return { horsPage, elements, absente, champs, satisfaite, geste: satisfaite || horsPage ? null : gesteAFaire(etape, trouves.map(t => ({ libelle: t.c.libelle ?? '', el: t.el }))) };
};

/** « lire » et « rempli » attendent le bouton Continuer ; le reste avance tout seul. */
export const avanceSeule = (etape: Etape): boolean => etape.condition.type !== 'lire' && etape.condition.type !== 'rempli';

// ─── Se déplacer dans un chapitre ───────────────────────────────────────────

export const rang = (c: Chapitre, etapeId: string | null | undefined): number =>
  Math.max(0, c.etapes.findIndex(e => e.id === etapeId));

export const etapeSuivante = (c: Chapitre, etapeId: string): Etape | null => c.etapes[rang(c, etapeId) + 1] ?? null;
export const etapePrecedente = (c: Chapitre, etapeId: string): Etape | null => c.etapes[rang(c, etapeId) - 1] ?? null;

/** Où mène « Passer ». null = fin du chapitre. */
export const etapeApresPasser = (c: Chapitre, etapeId: string): Etape | null => {
  const e = c.etapes[rang(c, etapeId)];
  if (e?.passerVers === 'fin') return null;
  return c.etapes.find(x => x.id === e?.passerVers) ?? etapeSuivante(c, etapeId);
};

/**
 * Un enregistrement vient de réussir. S'il est attendu à cette étape OU plus
 * loin dans le chapitre (la personne est allée plus vite que le guide), on
 * reprend juste après. undefined = ce signal ne concerne pas la suite.
 */
export const etapeApresSignal = (c: Chapitre, etapeId: string, signal: SignalGuide): Etape | null | undefined => {
  const depart = rang(c, etapeId);
  const i = c.etapes.findIndex((e, n) => n >= depart && e.condition.type === 'signal' && e.condition.nom === signal);
  if (i === -1) return undefined;
  return c.etapes[i + 1] ?? null;
};

/** Perdu sur une page qui dépend d'un choix (classe, période) : la dernière étape d'où l'on sait repartir. */
export const etapeDeReprise = (c: Chapitre, etapeId: string): Etape | null => {
  for (let i = rang(c, etapeId) - 1; i >= 0; i--) if (pageOuAller(c.etapes[i]) !== null) return c.etapes[i];
  return null;
};

// ─── Où poser la bulle ──────────────────────────────────────────────────────

export interface Boite { left: number; top: number; width: number; height: number }

export const reunir = (boites: Boite[]): Boite | null => {
  if (boites.length === 0) return null;
  const left = Math.min(...boites.map(b => b.left));
  const top = Math.min(...boites.map(b => b.top));
  return {
    left, top,
    width: Math.max(...boites.map(b => b.left + b.width)) - left,
    height: Math.max(...boites.map(b => b.top + b.height)) - top,
  };
};

/** Hauteur de l'étiquette « Cliquez ici » et de sa pointe. */
export const HAUTEUR_ETIQUETTE = 48;
/** Au-dessus de l'élément, ou dessous s'il touche le haut de l'écran. */
export const etiquetteDessus = (b: Boite): boolean => b.top - HAUTEUR_ETIQUETTE >= 10;

const MARGE = 16;

/** À côté de l'élément, jamais dessus ; s'il n'y a la place nulle part, au bas de l'écran. */
export const placerBulle = (
  cible: Boite | null, bulle: { width: number; height: number }, vue: { width: number; height: number },
): { left: number; top: number } => {
  const borne = (v: number, taille: number, max: number) => Math.max(MARGE, Math.min(v, max - taille - MARGE));
  const enBas = { left: borne((vue.width - bulle.width) / 2, bulle.width, vue.width), top: borne(vue.height, bulle.height, vue.height) };
  if (!cible) return enBas;
  // Élément sorti de l'écran (on a fait défiler la page) : la bulle, elle, y reste.
  const sorti = cible.top + cible.height < 0 || cible.top > vue.height || cible.left + cible.width < 0 || cible.left > vue.width;
  if (sorti) return enBas;
  const droite = cible.left + cible.width;
  const bas = cible.top + cible.height;
  const left = borne(cible.left, bulle.width, vue.width);
  const top = borne(cible.top, bulle.height, vue.height);
  if (droite + MARGE * 2 + bulle.width <= vue.width) return { left: droite + MARGE, top };
  if (cible.left - MARGE * 2 - bulle.width >= 0) return { left: cible.left - MARGE - bulle.width, top };
  if (bas + MARGE * 2 + bulle.height <= vue.height) return { left, top: borne(bas + MARGE, bulle.height, vue.height) };
  if (cible.top - MARGE * 2 - bulle.height >= 0) return { left, top: cible.top - MARGE - bulle.height };
  return enBas;
};

// ─── Progression ────────────────────────────────────────────────────────────

export interface Progression {
  /** Réponse à la proposition de départ ; absente = jamais répondu. */
  choix?: 'accepte' | 'refuse';
  /** Le guide accompagne la personne en ce moment. */
  actif: boolean;
  chapitre?: string;
  etape?: string;
  termines: string[];
  /** Dernière écriture (ms) : départage l'appareil et le compte. */
  maj: number;
}

export const PROGRESSION_VIDE: Progression = { actif: false, termines: [], maj: 0 };

/** Tolérant : tout ce qui ne ressemble pas à une progression repart de zéro. */
export const lireProgression = (brut: unknown): Progression => {
  if (!brut || typeof brut !== 'object') return PROGRESSION_VIDE;
  const o = brut as Record<string, unknown>;
  return {
    choix: o.choix === 'accepte' || o.choix === 'refuse' ? o.choix : undefined,
    actif: o.actif === true,
    chapitre: typeof o.chapitre === 'string' ? o.chapitre : undefined,
    etape: typeof o.etape === 'string' ? o.etape : undefined,
    termines: Array.isArray(o.termines) ? o.termines.filter((t): t is string => typeof t === 'string') : [],
    maj: typeof o.maj === 'number' && Number.isFinite(o.maj) ? o.maj : 0,
  };
};

export const plusRecente = (a: Progression, b: Progression): Progression => (b.maj > a.maj ? b : a);

export const marquerTermine = (p: Progression, chapitreId: string): Progression =>
  p.termines.includes(chapitreId) ? p : { ...p, termines: [...p.termines, chapitreId] };

/** Le premier chapitre pas encore terminé APRÈS celui-ci, sinon le premier qui reste. */
export const chapitreSuivant = (chapitres: Chapitre[], termines: string[], apres?: string): Chapitre | null => {
  const i = chapitres.findIndex(c => c.id === apres);
  const restants = (liste: Chapitre[]) => liste.find(c => !termines.includes(c.id) && c.id !== apres);
  return restants(chapitres.slice(i + 1)) ?? restants(chapitres) ?? null;
};

export type StatutChapitre = 'a-faire' | 'commence' | 'termine';
export const statutChapitre = (c: Chapitre, p: Progression): StatutChapitre =>
  p.chapitre === c.id && p.etape !== undefined && p.etape !== c.etapes[0]?.id ? 'commence'
  : p.termines.includes(c.id) ? 'termine'
  : 'a-faire';
