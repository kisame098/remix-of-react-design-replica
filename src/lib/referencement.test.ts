import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { referencementDe, TITRE_ACCUEIL, PREFIXES_PRIVES } from './referencement';

// ════════════════════════════════════════════════════════════════════════════
// UNE SEULE PAGE SUR GOOGLE : L'ACCUEIL.
// Les autres sont derrière une connexion — indexées, elles ne montreraient
// qu'un écran de connexion et dilueraient l'accueil dans les résultats.
// ════════════════════════════════════════════════════════════════════════════

describe('referencementDe', () => {
  it('l\'accueil est indexé, avec le titre à mot-clé', () => {
    expect(referencementDe('/')).toEqual({ titre: TITRE_ACCUEIL, indexer: true });
  });

  it('le titre de l\'accueil commence par le mot-clé et tient dans Google (≤ 60 caractères)', () => {
    expect(TITRE_ACCUEIL.startsWith('Logiciel de gestion scolaire')).toBe(true);
    expect(TITRE_ACCUEIL.length).toBeLessThanOrEqual(60);
  });

  it('la connexion n\'est pas indexée', () => {
    expect(referencementDe('/auth').indexer).toBe(false);
    expect(referencementDe('/reset-password').indexer).toBe(false);
  });

  it.each(PREFIXES_PRIVES)('%s : jamais indexé, mais un titre lisible dans l\'onglet', (prefixe) => {
    const r = referencementDe(prefixe);
    expect(r.indexer).toBe(false);
    expect(r.titre).not.toContain('introuvable');
    expect(r.titre).toMatch(/\| SenClass$/);
  });

  it('le préfixe le plus précis l\'emporte', () => {
    expect(referencementDe('/portail/notes/42').titre).toBe('Mes notes | SenClass');
    expect(referencementDe('/inscription-prof').titre).toBe('Inscription des professeurs | SenClass');
    expect(referencementDe('/inscription').titre).toBe('Inscription des élèves | SenClass');
    expect(referencementDe('/notes/p1/c1/s1/settings').titre).toBe('Notes | SenClass');
  });

  it('une adresse inconnue n\'est jamais indexée (fausse page 200)', () => {
    expect(referencementDe('/nimporte-quoi')).toEqual({ titre: 'Page introuvable | SenClass', indexer: false });
    // « /dashboardx » ne doit pas passer pour le tableau de bord.
    expect(referencementDe('/dashboardx').titre).toContain('introuvable');
  });

  it('chaque route privée d\'App.tsx a un titre (aucune oubliée)', () => {
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    const routes = [...app.matchAll(/path="([^"]+)"/g)].map(m => m[1])
      .filter(r => !['/', '/auth', '/reset-password', '*'].includes(r));
    expect(routes.length).toBeGreaterThan(20);
    for (const route of routes) {
      const chemin = route.replace(/:[^/]+/g, 'x');
      expect(referencementDe(chemin).titre, route).not.toContain('introuvable');
    }
  });
});
