import type { PermissionKey } from '@/lib/permissions';

// ═══════════════════════════════════════════════════════════════════════════
// MODE DE GESTION D'UNE ÉCOLE
//
//   classique      : le système actuel (classes, notes, cursus…). Par défaut.
//   formation_pro  : gestion d'un centre de formation professionnelle
//                    (formations, promotions, examens à tours, stages…).
//
// Le mode est choisi par le chef du système (jamais par l'école) et ne change
// que les ÉCRANS : aucune donnée n'est modifiée ni supprimée en basculant.
// ═══════════════════════════════════════════════════════════════════════════

export type ModeGestion = 'classique' | 'formation_pro';

export const LIBELLES_MODE: Record<ModeGestion, string> = {
  classique: 'Classique',
  formation_pro: 'Formation professionnelle',
};

/** Tolérant : une école sans colonne (ancienne réponse en cache) reste classique. */
export const modeDeLEcole = (school: { management_mode?: string | null } | null | undefined): ModeGestion =>
  school?.management_mode === 'formation_pro' ? 'formation_pro' : 'classique';

export const estFormationPro = (school: { management_mode?: string | null } | null | undefined): boolean =>
  modeDeLEcole(school) === 'formation_pro';

export type IconeMenu =
  | 'dashboard' | 'inscription' | 'eleves' | 'profs' | 'classes' | 'notes' | 'cursus' | 'emploi'
  | 'presences' | 'paiements' | 'salaires' | 'identifiants'
  | 'apercu' | 'formations' | 'promotions' | 'evaluations' | 'examens' | 'stages' | 'documents';

export interface ItemMenu {
  title: string;
  url: string;
  icon: IconeMenu;
  permission?: PermissionKey;
  /** Rubrique annoncée mais pas encore développée. */
  bientot?: boolean;
  /** Regroupe visuellement les rubriques du mode formation. */
  groupe?: 'formation_pro';
}

const DASHBOARD: ItemMenu = { title: 'Dashboard', url: '/dashboard', icon: 'dashboard' };
const INSCRIPTION_ELEVES: ItemMenu = { title: 'Inscription Élèves', url: '/inscription', icon: 'inscription', permission: 'students' };
const GESTION_ELEVES: ItemMenu = { title: 'Gestion Élèves', url: '/eleves', icon: 'eleves', permission: 'students' };
const INSCRIPTION_PROFS: ItemMenu = { title: 'Inscription Profs', url: '/inscription-prof', icon: 'profs', permission: 'teachers' };
const GESTION_PROFS: ItemMenu = { title: 'Gestion Profs', url: '/professeurs', icon: 'profs', permission: 'teachers' };
const GESTION_CLASSE: ItemMenu = { title: 'Gestion Classe', url: '/classes', icon: 'classes', permission: 'classes' };
const GESTION_NOTES: ItemMenu = { title: 'Gestion Notes', url: '/notes', icon: 'notes', permission: 'grades' };
const CURSUS: ItemMenu = { title: 'Cursus', url: '/filieres', icon: 'cursus', permission: 'grades' };
const EMPLOIS: ItemMenu = { title: 'Emplois du Temps', url: '/emplois-du-temps', icon: 'emploi', permission: 'schedule' };
const PRESENCES: ItemMenu = { title: 'Gestion Présences', url: '/presences', icon: 'presences', permission: 'attendance' };
const PAIEMENTS: ItemMenu = { title: 'Gestion Paiements', url: '/paiements', icon: 'paiements', permission: 'payments' };
const SALAIRES: ItemMenu = { title: 'Gestion Salaires', url: '/salaires', icon: 'salaires', permission: 'payroll' };
const IDENTIFIANTS: ItemMenu = { title: 'Gestion Identifiants', url: '/identifiants', icon: 'identifiants', permission: 'credentials' };

/**
 * Rubriques propres au mode formation professionnelle. Pour l'instant, chacune
 * ouvre une page « en cours de développement » ; `description` dit ce qu'elle
 * contiendra. Elles réutilisent la permission « Notes » du personnel.
 */
export const RUBRIQUES_FORMATION_PRO: (ItemMenu & { description: string })[] = [
  { title: "Vue d'ensemble", url: '/formation', icon: 'apercu', permission: 'grades', bientot: true, groupe: 'formation_pro',
    description: "Effectifs par formation et par promotion, stages en cours, examens à venir." },
  { title: 'Formations', url: '/formation/formations', icon: 'formations', permission: 'grades', groupe: 'formation_pro',
    description: "Le catalogue de l'école : formations, années, options et matières avec coefficients et volumes horaires. Modèles hôtellerie-restauration fournis." },
  { title: 'Promotions', url: '/formation/promotions', icon: 'promotions', permission: 'grades', bientot: true, groupe: 'formation_pro',
    description: "Les groupes d'élèves d'une formation, avec leurs dates de début et de fin, en cours du jour ou du soir." },
  { title: 'Évaluations', url: '/formation/evaluations', icon: 'evaluations', permission: 'grades', bientot: true, groupe: 'formation_pro',
    description: "La formule de notation de l'année (contrôle continu, TP, examens…) et la saisie des notes par matière." },
  { title: 'Examens', url: '/formation/examens', icon: 'examens', permission: 'grades', bientot: true, groupe: 'formation_pro',
    description: "Examens blancs et officiels à un ou plusieurs tours : épreuves, notes éliminatoires, décisions, mentions et relevés." },
  { title: 'Stages', url: '/formation/stages', icon: 'stages', permission: 'grades', bientot: true, groupe: 'formation_pro',
    description: "Le suivi des stages en entreprise : établissement d'accueil, dates, encadrant, appréciation et note." },
  { title: 'Documents', url: '/formation/documents', icon: 'documents', permission: 'grades', bientot: true, groupe: 'formation_pro',
    description: "Relevés, bulletins, attestations et diplômes de l'école, avec son identité (autorisation, NINEA, RC…)." },
];

/** Pages du mode classique qui n'existent plus dans le mode formation professionnelle. */
export const URLS_CLASSIQUES_MASQUEES = ['/classes', '/notes', '/filieres'] as const;

export const menuPourMode = (mode: ModeGestion): ItemMenu[] => {
  if (mode === 'formation_pro') {
    return [
      DASHBOARD, INSCRIPTION_ELEVES, GESTION_ELEVES, INSCRIPTION_PROFS, GESTION_PROFS,
      ...RUBRIQUES_FORMATION_PRO,
      EMPLOIS, PRESENCES, PAIEMENTS, SALAIRES, IDENTIFIANTS,
    ];
  }
  return [
    DASHBOARD, INSCRIPTION_ELEVES, GESTION_ELEVES, INSCRIPTION_PROFS, GESTION_PROFS,
    GESTION_CLASSE, GESTION_NOTES, CURSUS, EMPLOIS, PRESENCES, PAIEMENTS, SALAIRES, IDENTIFIANTS,
  ];
};
