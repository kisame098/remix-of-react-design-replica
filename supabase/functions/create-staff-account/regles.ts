// Règles pures des comptes du personnel — testées depuis src (comptePersonnel.test.ts).
// Aucune dépendance Deno ni réseau ici.

/** Minimum imposé par Supabase Auth (réglage par défaut du projet). */
export const MIN_MOT_DE_PASSE = 6;

export const normaliserEmail = (email: string): string => email.trim().toLowerCase();

export const emailValide = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Erreurs de saisie d'un compte du personnel (vide si tout va bien). */
export const verifierComptePersonnel = (c: { nom?: string; email?: string; motDePasse?: string }): string[] => {
  const erreurs: string[] = [];
  if (!c.nom?.trim()) erreurs.push('Le nom complet est obligatoire');
  if (!c.email?.trim()) erreurs.push("L'adresse e-mail est obligatoire");
  else if (!emailValide(c.email)) erreurs.push("L'adresse e-mail n'est pas valide");
  if (!c.motDePasse) erreurs.push('Le mot de passe est obligatoire');
  else if (c.motDePasse.length < MIN_MOT_DE_PASSE) erreurs.push(`Le mot de passe doit contenir au moins ${MIN_MOT_DE_PASSE} caractères`);
  else if (/^\s|\s$/.test(c.motDePasse)) erreurs.push("Le mot de passe ne doit pas commencer ni finir par un espace");
  return erreurs;
};

/** Message d'erreur de Supabase Auth, en français. */
export const messageErreurCompte = (message: string | undefined): string => {
  const m = (message ?? '').toLowerCase();
  if (m.includes('already') && (m.includes('registered') || m.includes('exists'))) {
    return 'Cette adresse e-mail est déjà utilisée sur SenClass. Choisissez-en une autre.';
  }
  if (m.includes('password')) return `Mot de passe refusé : au moins ${MIN_MOT_DE_PASSE} caractères.`;
  if (m.includes('email')) return "L'adresse e-mail n'est pas valide.";
  return message || 'Erreur de création du compte';
};
