import { describe, it, expect } from 'vitest';
import { nomDuCompte } from '@/lib/nomCompte';

describe('nomDuCompte — « Encaissé par » jamais vide', () => {
  it('prend le nom de la fiche profil', () => {
    expect(nomDuCompte({ full_name: 'MADAME MANE', email: 'm@senclass.com' }, { email: 'm@senclass.com' })).toBe('MADAME MANE');
  });

  it("sans nom, prend l'e-mail de la fiche", () => {
    expect(nomDuCompte({ full_name: null, email: 'directeur@ecole.sn' }, { email: 'autre@ecole.sn' })).toBe('directeur@ecole.sn');
  });

  it("fiche profil non lue : prend l'e-mail de connexion (cas des reçus 266, 300, 301)", () => {
    expect(nomDuCompte(null, { email: 'gsrecherche@gmail.com' })).toBe('gsrecherche@gmail.com');
  });

  it('ignore les noms faits d\'espaces', () => {
    expect(nomDuCompte({ full_name: '   ', email: ' ' }, { email: 'x@y.sn' })).toBe('x@y.sn');
  });

  it('ne retourne vide que si personne n\'est connecté', () => {
    expect(nomDuCompte(null, null)).toBeUndefined();
  });
});
