import { describe, it, expect } from 'vitest';
import { estReinscription } from './useFicheInscription';

// Réédition d'une fiche : un élève réinscrit garde son profil (createdAt ancien)
// mais reçoit une nouvelle inscription pour l'année. Se tromper met « Réinscription »
// sur la fiche d'un nouvel élève, ou l'inverse.
describe('estReinscription', () => {
  const profil = new Date('2025-09-10T09:00:00Z');

  it('inscription le jour même de la création du profil : nouvelle inscription', () => {
    expect(estReinscription({ createdAt: profil, enrolledAt: '2025-09-10T09:00:02Z' })).toBe(false);
    expect(estReinscription({ createdAt: profil, enrolledAt: '2025-09-10T20:00:00Z' })).toBe(false);
  });

  it('inscription un an plus tard : réinscription', () => {
    expect(estReinscription({ createdAt: profil, enrolledAt: '2026-09-15T09:00:00Z' })).toBe(true);
  });

  it('dates illisibles : nouvelle inscription, jamais une erreur', () => {
    expect(estReinscription({ createdAt: profil, enrolledAt: 'n\'importe quoi' })).toBe(false);
    expect(estReinscription({ createdAt: new Date('invalide'), enrolledAt: '2026-09-15T09:00:00Z' })).toBe(false);
  });
});
