import { describe, it, expect } from 'vitest';
import { actionPourEvenement, type ContexteAuth } from './evenementsAuth';

// ════════════════════════════════════════════════════════════════════════════
// La décision qui a manqué : à quoi correspond chaque événement d'authentification ?
// Se tromper en faisant « recharger-tout » à tort remet l'application à zéro sous
// les doigts de l'utilisateur ; se tromper dans l'autre sens laisse un compte
// changé sans que l'écran suive.
// ════════════════════════════════════════════════════════════════════════════

const charge: ContexteAuth = { utilisateurRecu: 'u1', utilisateurCourant: 'u1', roleConnu: true };

describe('retour sur l\'onglet — la session est DÉJÀ ouverte', () => {
  it('SIGNED_IN pour le même utilisateur, rôle connu : on ne recharge rien', () => {
    expect(actionPourEvenement('SIGNED_IN', charge)).toBe('noter-le-jeton');
  });

  it('INITIAL_SESSION, dans le même cas : pareil', () => {
    expect(actionPourEvenement('INITIAL_SESSION', charge)).toBe('noter-le-jeton');
  });

  it('SIGNED_IN, même utilisateur, rôle pas encore chargé : on le charge, sans écran d\'attente', () => {
    expect(actionPourEvenement('SIGNED_IN', { ...charge, roleConnu: false })).toBe('charger-le-role');
  });
});

describe('jeton renouvelé et compte mis à jour', () => {
  it.each(['TOKEN_REFRESHED', 'USER_UPDATED'])('%s, rôle connu : on note seulement le jeton', (e) => {
    expect(actionPourEvenement(e, charge)).toBe('noter-le-jeton');
  });

  it.each(['TOKEN_REFRESHED', 'USER_UPDATED'])('%s, rôle jamais chargé (ouvert hors connexion) : on le charge', (e) => {
    expect(actionPourEvenement(e, { ...charge, roleConnu: false })).toBe('charger-le-role');
  });
});

describe('les vrais changements de compte rechargent bien', () => {
  it('premier chargement (personne n\'est encore chargé) : on recharge tout', () => {
    expect(actionPourEvenement('SIGNED_IN', { utilisateurRecu: 'u1', utilisateurCourant: null, roleConnu: false })).toBe('recharger-tout');
    expect(actionPourEvenement('INITIAL_SESSION', { utilisateurRecu: 'u1', utilisateurCourant: null, roleConnu: false })).toBe('recharger-tout');
  });

  it('un AUTRE utilisateur (bascule entre comptes liés, nouvelle connexion) : on recharge tout', () => {
    expect(actionPourEvenement('SIGNED_IN', { utilisateurRecu: 'u2', utilisateurCourant: 'u1', roleConnu: true })).toBe('recharger-tout');
  });

  it('même identifiant mais rôle inconnu APRÈS une déconnexion : rechargé', () => {
    // Après SIGNED_OUT l'utilisateur courant est vidé : la reconnexion est un premier chargement.
    expect(actionPourEvenement('SIGNED_IN', { utilisateurRecu: 'u1', utilisateurCourant: null, roleConnu: false })).toBe('recharger-tout');
  });
});

describe('déconnexion', () => {
  it.each(['SIGNED_OUT', 'TOKEN_REFRESHED', 'SIGNED_IN'])('%s sans session : on vide tout', (e) => {
    expect(actionPourEvenement(e, { utilisateurRecu: null, utilisateurCourant: 'u1', roleConnu: true })).toBe('deconnecter');
  });
});
