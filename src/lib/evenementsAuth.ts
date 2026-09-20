// ═══════════════════════════════════════════════════════════════════════════
// QUE FAIRE D'UN ÉVÉNEMENT D'AUTHENTIFICATION ?
//
// La bibliothèque d'authentification prévient l'application de plusieurs choses :
// une vraie connexion, une déconnexion, un jeton renouvelé… et, surtout, à CHAQUE
// retour sur l'onglet, un SIGNED_IN pour la session qui est déjà ouverte (elle
// « récupère » la session après une absence). Rien n'a changé pour l'utilisateur.
//
// Traiter ce dernier comme une nouvelle connexion était le bug : « chargement en
// cours », l'écran d'attente REMPLAÇAIT toute la page (ProtectedRoute), et une
// fenêtre ouverte, un formulaire à moitié rempli, un PDF à télécharger…
// disparaissaient dès qu'on revenait d'un autre onglet.
//
// La décision est pure — sans réseau ni React — pour se tester exhaustivement.
// ═══════════════════════════════════════════════════════════════════════════

export type ActionAuth =
  /** Plus de session : on vide tout. */
  | 'deconnecter'
  /** Rien à recharger : on note seulement le jeton, l'écran ne bouge pas. */
  | 'noter-le-jeton'
  /** Le rôle n'a jamais pu être chargé : on le charge, sans faire clignoter l'écran d'attente. */
  | 'charger-le-role'
  /** Une vraie nouvelle connexion : on bloque l'écran et on recharge tout. */
  | 'recharger-tout';

export interface ContexteAuth {
  /** Identifiant de l'utilisateur de la session reçue (`null` si aucune). */
  utilisateurRecu: string | null;
  /** Identifiant de l'utilisateur DÉJÀ chargé dans l'application (`null` si aucun). */
  utilisateurCourant: string | null;
  /** Le rôle de l'utilisateur courant a-t-il déjà été chargé ? */
  roleConnu: boolean;
}

export const actionPourEvenement = (evenement: string, c: ContexteAuth): ActionAuth => {
  if (!c.utilisateurRecu) return 'deconnecter';

  const memeUtilisateur = c.utilisateurRecu === c.utilisateurCourant;

  // Renouvellement du jeton, mise à jour du compte : la personne est la même.
  if (evenement === 'TOKEN_REFRESHED' || evenement === 'USER_UPDATED') {
    return c.roleConnu ? 'noter-le-jeton' : 'charger-le-role';
  }

  // Retour sur l'onglet : SIGNED_IN pour la session déjà ouverte. Ne change ni
  // l'utilisateur ni son rôle — on ne touche à rien.
  if (memeUtilisateur) {
    return c.roleConnu ? 'noter-le-jeton' : 'charger-le-role';
  }

  // Un autre utilisateur (ou le premier chargement) : vraie connexion.
  return 'recharger-tout';
};
