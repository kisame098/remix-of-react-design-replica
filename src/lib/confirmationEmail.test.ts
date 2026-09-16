import { describe, it, expect } from 'vitest';
import { confirmationRequise, adresseRetourConfirmation } from './confirmationEmail';

// ════════════════════════════════════════════════════════════════════════════
// Se tromper ici a deux conséquences opposées, toutes deux mauvaises :
//   • croire à tort qu'une confirmation est attendue → le directeur reste sur
//     un écran d'attente alors que son compte est déjà ouvert ;
//   • ne pas la voir → il retombe sur le formulaire sans explication, persuadé
//     que son inscription a échoué.
// ════════════════════════════════════════════════════════════════════════════

describe('confirmationRequise', () => {
  it('utilisateur SANS session : Supabase attend la confirmation', () => {
    expect(confirmationRequise({ user: { id: 'u1' }, session: null })).toBe(true);
  });

  it('utilisateur AVEC session : le compte est ouvert, on entre directement', () => {
    expect(confirmationRequise({ user: { id: 'u1' }, session: { access_token: 'x' } })).toBe(false);
  });

  it('inscription échouée (aucun utilisateur) : rien à confirmer', () => {
    expect(confirmationRequise({ user: null, session: null })).toBe(false);
    expect(confirmationRequise(null)).toBe(false);
    expect(confirmationRequise(undefined)).toBe(false);
    expect(confirmationRequise({})).toBe(false);
  });

  it('la session absente mais la clé manquante se traite comme une confirmation attendue', () => {
    // Supabase omet parfois la clé plutôt que de la mettre à null.
    expect(confirmationRequise({ user: { id: 'u1' } })).toBe(true);
  });
});

describe('adresseRetourConfirmation', () => {
  it('le lien de l\'e-mail ramène sur le tableau de bord du site', () => {
    expect(adresseRetourConfirmation('https://senclass.com')).toBe('https://senclass.com/dashboard');
  });

  it('suit l\'adresse du site où l\'on se trouve (développement compris)', () => {
    expect(adresseRetourConfirmation('http://localhost:8080')).toBe('http://localhost:8080/dashboard');
  });
});
