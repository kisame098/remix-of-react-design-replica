// ═══════════════════════════════════════════════════════════════════════════
// CONFIRMATION DE L'ADRESSE E-MAIL — DIRECTEURS D'ÉCOLE UNIQUEMENT
//
// Seule l'inscription d'un directeur par le formulaire public passe par
// Supabase Auth avec envoi d'e-mail. Les comptes élèves, professeurs et
// personnel sont créés par les fonctions Supabase (create-school-account,
// create-staff-account) avec `email_confirm: true` : ils sont confirmés
// d'office, aucun e-mail n'est envoyé, et leurs adresses @senclass.com ne
// reçoivent d'ailleurs pas de courrier.
//
// Comment savoir si Supabase attend une confirmation ? Son contrat est clair :
//   • confirmation DÉSACTIVÉE → il renvoie un utilisateur ET une session ;
//   • confirmation ACTIVÉE    → il renvoie un utilisateur SANS session.
// C'est cette absence de session qui déclenche l'écran « vérifiez votre boîte
// mail ». Le réglage vit dans Supabase, pas dans le code : l'application
// s'adapte à l'un comme à l'autre, sans nouveau déploiement.
// ═══════════════════════════════════════════════════════════════════════════

export interface ReponseInscription {
  user?: { id?: string } | null;
  session?: unknown | null;
}

/**
 * Supabase a-t-il créé le compte en exigeant une confirmation par e-mail ?
 *
 * `false` en cas d'échec d'inscription (aucun utilisateur) : il n'y a alors
 * rien à confirmer, c'est l'erreur qu'il faut montrer.
 */
export const confirmationRequise = (reponse: ReponseInscription | null | undefined): boolean =>
  !!reponse?.user && !reponse?.session;

/** Adresse ouverte par le lien de confirmation reçu par e-mail. */
export const adresseRetourConfirmation = (origine: string): string => `${origine}/dashboard`;
