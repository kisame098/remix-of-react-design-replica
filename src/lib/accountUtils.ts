import { supabase } from '@/integrations/supabase/client';

// ─── Génération d'email et mot de passe ───────────────────────────────────────

const normalizeStr = (s: string): string =>
  s.normalize('NFD')
   .replace(/[̀-ͯ]/g, '')
   .toLowerCase()
   .replace(/[^a-z0-9]/g, '');

/**
 * Génère une adresse de connexion unique :
 * prenom.nom.XXXXX@senclass.com  (5 chiffres aléatoires)
 * L'unicité définitive est garantie par la contrainte UNIQUE(school_id, email) en DB.
 */
/**
 * Domaine des adresses de connexion générées.
 *
 * Les comptes créés avant le changement de nom gardent leur adresse
 * @terranga.com : leurs identifiants ont déjà été remis aux élèves et aux
 * professeurs, et la connexion se fait avec l'adresse complète. Les deux
 * domaines doivent donc rester reconnus par handle_new_user() côté base
 * (docs/sql/domaine_senclass.sql) — sinon un nouvel élève serait pris pour
 * un directeur qui s'inscrit, et se verrait créer une fausse école.
 *
 * Pourquoi quitter terranga.com : ce domaine appartient à un tiers et
 * reçoit du courrier. Un « mot de passe oublié » demandé pour un élève y
 * enverrait le lien de réinitialisation.
 */
export const DOMAINE_COMPTES = 'senclass.com';
export const ANCIEN_DOMAINE_COMPTES = 'terranga.com';

export const generateLoginEmail = (firstName: string, lastName: string): string => {
  const f      = normalizeStr(firstName)  || 'user';
  const l      = normalizeStr(lastName)   || 'account';
  const suffix = Math.floor(10000 + Math.random() * 90000).toString();
  return `${f}.${l}.${suffix}@${DOMAINE_COMPTES}`;
};

/**
 * Génère un identifiant lisible pour un membre du personnel : PERS-AAAA-NNNNN.
 */
export const generateStaffDisplayId = (): string => {
  const year   = new Date().getFullYear();
  const suffix = Math.floor(10000 + Math.random() * 90000).toString();
  return `PERS-${year}-${suffix}`;
};

/**
 * Génère un mot de passe fort de 10 caractères.
 * Pas de caractères ambigus (O/0, I/l).
 */
export const generatePassword = (): string => {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower  = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all    = upper + lower + digits;

  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];

  const chars = [
    pick(upper), pick(upper),
    pick(lower), pick(lower),
    pick(digits), pick(digits),
    pick(all), pick(all), pick(all), pick(all),
  ];

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

// ─── Création de compte Supabase Auth ─────────────────────────────────────────

interface StudentAccountOpts {
  enrollmentId: string;
  firstName:    string;
  lastName:     string;
  displayId:    string;
  className:    string;
  schoolId:     string;
  schoolName:   string;
}

interface TeacherAccountOpts {
  enrollmentId: string;
  firstName:    string;
  lastName:     string;
  displayId:    string;
  schoolId:     string;
  schoolName:   string;
}

/**
 * Crée un compte de connexion pour un élève.
 * 1. Insère dans school_accounts (email + password_plain + snapshot)
 * 2. Appelle l'Edge Function pour créer l'utilisateur Supabase Auth
 *
 * Cette fonction est idempotente : si un compte existe déjà pour cet enrollment,
 * la contrainte UNIQUE(school_id, email) générera un nouvel email différent —
 * mais la contrainte UNIQUE(student_enrollment_id) bloquera l'insertion.
 * Dans ce cas, elle retourne silencieusement.
 */
export const createStudentAccount = async (opts: StudentAccountOpts): Promise<void> => {
  const email    = generateLoginEmail(opts.firstName, opts.lastName);
  const password = generatePassword();

  const { data: acct, error } = await supabase
    .from('school_accounts')
    .insert({
      school_id:              opts.schoolId,
      role:                   'student',
      student_enrollment_id:  opts.enrollmentId,
      email,
      password_plain:         password,
      display_name:           `${opts.firstName} ${opts.lastName}`,
      display_id:             opts.displayId,
      class_name:             opts.className || null,
      school_name:            opts.schoolName,
    })
    .select('id')
    .single();

  // Si UNIQUE violation (compte déjà existant) → on ignore silencieusement
  if (error || !acct) return;

  // Appeler l'Edge Function pour créer l'utilisateur Supabase Auth
  await supabase.functions.invoke('create-school-account', {
    body: { email, password, accountId: acct.id },
  });
};

/**
 * Crée un compte de connexion pour un professeur.
 */
export const createTeacherAccount = async (opts: TeacherAccountOpts): Promise<void> => {
  const email    = generateLoginEmail(opts.firstName, opts.lastName);
  const password = generatePassword();

  const { data: acct, error } = await supabase
    .from('school_accounts')
    .insert({
      school_id:              opts.schoolId,
      role:                   'teacher',
      teacher_enrollment_id:  opts.enrollmentId,
      email,
      password_plain:         password,
      display_name:           `${opts.firstName} ${opts.lastName}`,
      display_id:             opts.displayId,
      class_name:             null,
      school_name:            opts.schoolName,
    })
    .select('id')
    .single();

  if (error || !acct) return;

  await supabase.functions.invoke('create-school-account', {
    body: { email, password, accountId: acct.id },
  });
};
