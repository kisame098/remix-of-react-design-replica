// ═══════════════════════════════════════════════════════════════════════════
// APRÈS UNE MISE EN LIGNE : FAUT-IL RECHARGER LA PAGE D'OFFICE ?
//
// Les écrans et les générateurs de PDF sont chargés à la demande. Un onglet resté
// ouvert pendant une mise en ligne réclame parfois un fichier de l'ANCIENNE version,
// qui n'existe plus sur le serveur. L'application recharge alors la page, une fois.
//
// C'est acceptable quand l'utilisateur CHANGE DE PAGE : son état local est perdu de
// toute façon. C'est destructeur quand il est au milieu d'un travail et clique sur
// « Imprimer le reçu » : la page se rechargeait d'office, le formulaire à moitié
// rempli et la fenêtre ouverte disparaissaient.
//
// Pour ces fichiers d'ACTION (chargés depuis une page qui reste affichée), on ne
// recharge donc pas : l'erreur remonte, la fenêtre concernée l'explique et propose
// de recharger quand l'utilisateur est prêt.
// ═══════════════════════════════════════════════════════════════════════════

/** Fichiers chargés au clic, depuis une page qui reste à l'écran. */
export const FICHIERS_D_ACTION = /assets\/(recuPdf|ficheInscriptionPdf|documentsFormationProPdf)-/;

const message = (erreur: unknown): string =>
  erreur instanceof Error ? erreur.message
    : typeof erreur === 'string' ? erreur
    : (erreur as { message?: unknown } | null)?.message ? String((erreur as { message: unknown }).message) : '';

/**
 * L'erreur signale-t-elle un fichier de l'application introuvable (ancienne
 * version, réseau coupé pendant le chargement) ?
 */
export const estUneErreurDeChargement = (erreur: unknown): boolean =>
  /dynamically imported module|Importing a module script failed|Unable to preload|Failed to fetch dynamically/i
    .test(message(erreur));

/**
 * Recharger d'office ? Oui par défaut (on change de page : rien à perdre) ; non
 * quand le fichier manquant est un fichier d'ACTION, que l'utilisateur vient de
 * demander depuis une page où il travaille.
 *
 * Certains navigateurs (Safari, Firefox) ne disent pas QUEL fichier manque : on ne
 * peut pas classer l'erreur, et on garde le comportement historique.
 */
export const doitRechargerDOffice = (erreur: unknown): boolean => !FICHIERS_D_ACTION.test(message(erreur));
