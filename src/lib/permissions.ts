// ─────────────────────────────────────────────────────────────────────────────
// Permissions du personnel — définit ce à quoi une section du dashboard
// correspond. Un compte admin_school a toujours accès à tout ; un compte
// "staff" (personnel) n'a accès qu'aux sections explicitement cochées par
// l'admin lors de sa création (ou modifiées ensuite).
// ─────────────────────────────────────────────────────────────────────────────

export type PermissionKey =
  | 'students'
  | 'teachers'
  | 'classes'
  | 'grades'
  | 'schedule'
  | 'attendance'
  | 'payments'
  | 'credentials'
  | 'bulletins'
  | 'cashier'
  | 'payroll';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  students:    'Élèves (inscription, gestion)',
  teachers:    'Professeurs (inscription, gestion)',
  classes:     'Classes',
  grades:      'Notes',
  schedule:    'Emploi du temps',
  attendance:  'Présences',
  payments:    'Paiements',
  credentials: 'Identifiants (mots de passe)',
  bulletins:   'Publier les bulletins au portail élève',
  cashier:     '📱 Caisse mobile (scanner & confirmer un paiement uniquement)',
  payroll:     'Gestion des salaires',
};

/**
 * Un compte "caisse mobile" est un compte staff dont l'unique rôle est de
 * scanner/confirmer un paiement sur téléphone — il n'a accès à AUCUNE autre
 * section du dashboard, même si d'autres permissions sont cochées par erreur.
 */
export const isCashierAccount = (
  accountRole: string | null | undefined,
  staffPermissions: string[] | null | undefined,
): boolean => accountRole === 'staff' && !!staffPermissions?.includes('cashier');

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

// Route → permission requise. Une route absente de cette table est accessible
// à tout membre du dashboard (ex: /dashboard).
export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  '/inscription':      'students',
  '/eleves':            'students',
  '/inscription-prof':  'teachers',
  '/professeurs':       'teachers',
  '/classes':           'classes',
  '/notes':             'grades',
  '/emplois-du-temps':  'schedule',
  '/presences':         'attendance',
  '/paiements':         'payments',
  '/salaires':          'payroll',
  '/identifiants':      'credentials',
};

/**
 * Vérifie si le rôle/permissions courants donnent accès à une clé donnée.
 * `admin` a toujours accès à tout ; `staff` doit avoir la permission cochée.
 */
export const hasPermission = (
  accountRole: string | null | undefined,
  staffPermissions: string[] | null | undefined,
  key: PermissionKey,
): boolean => {
  if (accountRole === 'admin') return true;
  if (accountRole !== 'staff') return false;
  return (staffPermissions ?? []).includes(key);
};
