// ═══════════════════════════════════════════════════════════════════════════
// PROSPECTS DU CHEF DU SYSTÈME — règles sans écran (testées)
// Tables : docs/sql/platform_prospects.sql ; envoi : fonction `envoyer-email`.
// ═══════════════════════════════════════════════════════════════════════════

export type StatutProspect = 'nouveau' | 'contacte' | 'demo' | 'interesse' | 'client' | 'perdu';

export const STATUTS_PROSPECT: StatutProspect[] = ['nouveau', 'contacte', 'demo', 'interesse', 'client', 'perdu'];

export const LIBELLES_STATUT_PROSPECT: Record<StatutProspect, string> = {
  nouveau: 'Nouveau', contacte: 'Contacté', demo: 'Démo prévue', interesse: 'Intéressé', client: 'Client', perdu: 'Perdu',
};

export const COULEURS_STATUT_PROSPECT: Record<StatutProspect, string> = {
  nouveau: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  contacte: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  demo: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  interesse: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  client: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  perdu: 'bg-muted text-muted-foreground',
};

export type TypeEchange = 'email' | 'appel' | 'whatsapp' | 'rendez_vous' | 'note';

export const LIBELLES_TYPE_ECHANGE: Record<TypeEchange, string> = {
  email: 'E-mail', appel: 'Appel', whatsapp: 'WhatsApp', rendez_vous: 'Rendez-vous', note: 'Note',
};

export interface Prospect {
  id: string;
  ecole: string;
  responsable?: string;
  telephone?: string;
  email?: string;
  ville?: string;
  source?: string;
  statut: StatutProspect;
  relanceLe?: string;
  notes?: string;
  schoolId?: string;
  createdAt: string;
}

export interface Echange {
  id: string;
  prospectId?: string;
  schoolId?: string;
  type: TypeEchange;
  objet?: string;
  contenu?: string;
  destinataire?: string;
  statutEnvoi?: 'envoye' | 'echec';
  erreur?: string;
  createdAt: string;
}

export interface ModeleEmail { id: string; nom: string; objet: string; contenu: string; ordre: number }

/** Une relance est à faire si sa date est aujourd'hui ou passée — jamais pour un client ou un prospect perdu. */
export const relanceAFaire = (p: Pick<Prospect, 'statut' | 'relanceLe'>, aujourdhui: string): boolean =>
  !!p.relanceLe && p.relanceLe <= aujourdhui && p.statut !== 'client' && p.statut !== 'perdu';

export const emailValide = (e: string | undefined): boolean => !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** Numéro sénégalais pour WhatsApp : « 77 123 45 67 » → 221771234567 ; déjà international → gardé. */
export const numeroWhatsApp = (tel: string | undefined): string | null => {
  const chiffres = (tel ?? '').replace(/\D/g, '');
  if (chiffres.length === 9 && /^[37]/.test(chiffres)) return `221${chiffres}`;
  if (chiffres.startsWith('00')) return chiffres.slice(2).length >= 11 ? chiffres.slice(2) : null;
  return chiffres.length >= 11 ? chiffres : null;
};

export type FiltreProspects = 'tous' | 'a_relancer' | StatutProspect;

export const filtrerProspects = (liste: Prospect[], filtre: FiltreProspects, recherche: string, aujourdhui: string): Prospect[] => {
  const q = recherche.trim().toLowerCase();
  return liste
    .filter(p => filtre === 'tous' || (filtre === 'a_relancer' ? relanceAFaire(p, aujourdhui) : p.statut === filtre))
    .filter(p => !q || [p.ecole, p.responsable, p.ville, p.email, p.telephone].some(v => v?.toLowerCase().includes(q)))
    // Les relances en retard d'abord, puis les plus récents.
    .sort((a, b) => Number(relanceAFaire(b, aujourdhui)) - Number(relanceAFaire(a, aujourdhui))
      || (a.relanceLe ?? '9999').localeCompare(b.relanceLe ?? '9999') || b.createdAt.localeCompare(a.createdAt));
};

/** Aperçu d'un message pour un destinataire : mêmes remplacements que la fonction d'envoi. */
export const apercuMessage = (texte: string, ecole?: string, responsable?: string): string =>
  texte
    .replace(/\{\{\s*responsable\s*\}\}/g, responsable?.trim() || 'Madame, Monsieur')
    .replace(/\{\{\s*ecole\s*\}\}/g, ecole?.trim() || 'votre école');
