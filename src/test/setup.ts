import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Variables d'environnement Supabase : les tests n'appellent jamais le réseau,
// mais le client est construit au chargement de plusieurs modules métier — il
// lui faut une URL/clé syntaxiquement valides pour ne pas jeter à l'import.
if (!import.meta.env.VITE_SUPABASE_URL) {
  import.meta.env.VITE_SUPABASE_URL = 'http://localhost:54321';
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-anon-key';
}

// Les sections de la page d'accueil s'animent à leur entrée à l'écran
// (framer-motion, `whileInView`), ce qui passe par IntersectionObserver —
// absent de jsdom. Une version inerte suffit : les tests vérifient le
// contenu, pas l'animation.
if (!('IntersectionObserver' in globalThis)) {
  class IntersectionObserverInerte {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IntersectionObserverInerte;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});
