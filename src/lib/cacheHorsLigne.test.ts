import { describe, it, expect, beforeEach } from 'vitest';
import {
  cleDeCache, enregistrer, lire, effacerUtilisateur, effacerTout, dateLisible,
} from './cacheHorsLigne';

// ════════════════════════════════════════════════════════════════════════════
// LA RÈGLE QUI PROTÈGE LES FAMILLES.
//
// Plusieurs comptes cohabitent sur un même téléphone. Si les données d'un
// élève pouvaient être relues par le compte suivant, le portail deviendrait
// une fuite d'informations. D'où : un espace par compte, jamais d'écriture
// sans propriétaire, effacement à la déconnexion.
// ════════════════════════════════════════════════════════════════════════════

beforeEach(() => localStorage.clear());

describe('cloisonnement par compte', () => {
  it('chaque compte lit SES données, pas celles du voisin', () => {
    enregistrer('eleve-1', 'notes', [{ note: 18 }]);
    enregistrer('eleve-2', 'notes', [{ note: 7 }]);

    expect(lire<{ note: number }[]>('eleve-1', 'notes')?.donnees).toEqual([{ note: 18 }]);
    expect(lire<{ note: number }[]>('eleve-2', 'notes')?.donnees).toEqual([{ note: 7 }]);
  });

  it('un compte qui n\'a rien enregistré ne voit rien', () => {
    enregistrer('eleve-1', 'notes', [{ note: 18 }]);
    expect(lire('eleve-3', 'notes')).toBeNull();
  });

  it('SANS identifiant de compte, on n\'écrit rien', () => {
    expect(enregistrer(null, 'notes', [{ note: 18 }])).toBe(false);
    expect(enregistrer(undefined, 'notes', [{ note: 18 }])).toBe(false);
    expect(enregistrer('', 'notes', [{ note: 18 }])).toBe(false);
    expect(Object.keys(localStorage).length).toBe(0);
  });

  it('sans identifiant, on ne lit rien non plus', () => {
    enregistrer('eleve-1', 'notes', [{ note: 18 }]);
    expect(lire(null, 'notes')).toBeNull();
  });

  it('la clé porte le compte et l\'écran', () => {
    expect(cleDeCache('u1', 'notes')).toBe('senclass.horsligne.v1.u1.notes');
  });
});

describe('déconnexion', () => {
  it('efface TOUT ce qui appartient au compte qui part', () => {
    enregistrer('eleve-1', 'notes', [1]);
    enregistrer('eleve-1', 'emploi', [2]);
    enregistrer('eleve-2', 'notes', [3]);

    expect(effacerUtilisateur('eleve-1')).toBe(2);
    expect(lire('eleve-1', 'notes')).toBeNull();
    expect(lire('eleve-1', 'emploi')).toBeNull();
  });

  it('ne touche PAS aux autres comptes de l\'appareil', () => {
    // Le frère ou la sœur reste connecté : ses données lui appartiennent.
    enregistrer('eleve-1', 'notes', [1]);
    enregistrer('eleve-2', 'notes', [3]);
    effacerUtilisateur('eleve-1');
    expect(lire<number[]>('eleve-2', 'notes')?.donnees).toEqual([3]);
  });

  it('ne touche pas au reste du stockage (session, comptes liés…)', () => {
    localStorage.setItem('teranga_linked_accounts', '[]');
    enregistrer('eleve-1', 'notes', [1]);
    effacerUtilisateur('eleve-1');
    expect(localStorage.getItem('teranga_linked_accounts')).toBe('[]');
  });

  it('effacerTout vide les espaces de tous les comptes', () => {
    enregistrer('eleve-1', 'notes', [1]);
    enregistrer('eleve-2', 'notes', [3]);
    localStorage.setItem('autre-chose', 'x');
    expect(effacerTout()).toBe(2);
    expect(localStorage.getItem('autre-chose')).toBe('x');
  });
});

describe('datation', () => {
  it('chaque enregistrement est daté', () => {
    enregistrer('u1', 'notes', [1], new Date('2026-09-19T11:20:00Z'));
    expect(lire('u1', 'notes')?.enregistreLe).toBe('2026-09-19T11:20:00.000Z');
  });

  it('un contenu corrompu est ignoré plutôt que de faire planter l\'écran', () => {
    localStorage.setItem(cleDeCache('u1', 'notes'), '{ pas du json');
    expect(lire('u1', 'notes')).toBeNull();
  });

  it('un paquet sans date est refusé', () => {
    localStorage.setItem(cleDeCache('u1', 'notes'), JSON.stringify({ donnees: [1] }));
    expect(lire('u1', 'notes')).toBeNull();
  });

  it('la date affichée est lisible en français', () => {
    expect(dateLisible('2026-09-19T11:20:00Z')).toMatch(/19 septembre à \d{2}:\d{2}/);
    expect(dateLisible('pas une date')).toBe('');
  });
});
