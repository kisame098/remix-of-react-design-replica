import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInstantaneHorsLigne } from './useInstantaneHorsLigne';
import { enregistrer, lire } from '@/lib/cacheHorsLigne';

// ════════════════════════════════════════════════════════════════════════════
// « Les écoles veulent pouvoir ouvrir le site même hors connexion. » Leurs
// écrans lisent les contextes, pas la base : c'est donc l'instantané des
// contextes qui doit survivre à la coupure.
//
// Deux erreurs coûteraient cher :
//   • enregistrer l'état vide du démarrage → l'école perd son instantané et
//     se retrouve devant un tableau de bord désert ;
//   • réinstaller en ligne → un élève supprimé réapparaîtrait sous les yeux
//     du directeur, qui agirait sur une fiche qui n'existe plus.
// ════════════════════════════════════════════════════════════════════════════

const useAuthMock = vi.fn(() => ({ user: { id: 'directeur-1' } as { id: string } | null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => useAuthMock() }));

let enLigne = true;
Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => enLigne });

beforeEach(() => {
  localStorage.clear();
  enLigne = true;
  useAuthMock.mockReturnValue({ user: { id: 'directeur-1' } });
});
afterEach(() => { enLigne = true; });

interface Tranches { eleves: string[] }

/** Monte le hook comme le ferait un contexte : tranches mémorisées. */
const monter = (tranches: Tranches, pret: boolean) => {
  const appliquer = vi.fn();
  const { result, rerender } = renderHook(
    ({ t, p }: { t: Tranches; p: boolean }) =>
      useInstantaneHorsLigne('ecole', t, appliquer, p),
    { initialProps: { t: tranches, p: pret } },
  );
  return { result, rerender, appliquer };
};

describe('en ligne', () => {
  it('enregistre les tranches une fois le chargement terminé', () => {
    monter({ eleves: ['Awa', 'Moussa'] }, true);
    expect(lire<Tranches>('directeur-1', 'ecole')?.donnees).toEqual({ eleves: ['Awa', 'Moussa'] });
  });

  it('n\'écrase RIEN tant que le chargement est en cours', () => {
    enregistrer('directeur-1', 'ecole', { eleves: ['Awa', 'Moussa'] });
    monter({ eleves: [] }, false);   // état vide du démarrage
    expect(lire<Tranches>('directeur-1', 'ecole')?.donnees).toEqual({ eleves: ['Awa', 'Moussa'] });
  });

  it('ne réinstalle pas l\'instantané : le réseau fait foi', () => {
    enregistrer('directeur-1', 'ecole', { eleves: ['Élève supprimé'] });
    const { appliquer } = monter({ eleves: ['Awa'] }, true);
    expect(appliquer).not.toHaveBeenCalled();
  });

  it('réenregistre quand les tranches changent, et pas autrement', () => {
    const { rerender } = monter({ eleves: ['Awa'] }, true);
    const premier = lire<Tranches>('directeur-1', 'ecole')!.enregistreLe;

    rerender({ t: { eleves: ['Awa'] }, p: true });               // même contenu
    expect(lire<Tranches>('directeur-1', 'ecole')!.enregistreLe).toBe(premier);

    rerender({ t: { eleves: ['Awa', 'Fatou'] }, p: true });      // contenu neuf
    expect(lire<Tranches>('directeur-1', 'ecole')!.donnees.eleves).toHaveLength(2);
  });
});

describe('hors connexion', () => {
  it('réinstalle l\'instantané et annonce sa date', () => {
    enregistrer('directeur-1', 'ecole', { eleves: ['Awa'] }, new Date('2026-09-18T10:00:00Z'));
    enLigne = false;

    const { result, appliquer } = monter({ eleves: [] }, false);

    expect(appliquer).toHaveBeenCalledWith({ eleves: ['Awa'] });
    expect(result.current).toBe('2026-09-18T10:00:00.000Z');
  });

  it('n\'enregistre pas : sans réseau, l\'état affiché n\'est pas une vérité neuve', () => {
    enregistrer('directeur-1', 'ecole', { eleves: ['Awa'] }, new Date('2026-09-18T10:00:00Z'));
    enLigne = false;

    monter({ eleves: [] }, true);
    expect(lire<Tranches>('directeur-1', 'ecole')?.donnees).toEqual({ eleves: ['Awa'] });
  });

  it('sans rien d\'enregistré, ne prétend aucune date', () => {
    enLigne = false;
    const { result, appliquer } = monter({ eleves: [] }, false);
    expect(appliquer).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('ne réinstalle jamais l\'instantané d\'un autre compte', () => {
    enregistrer('autre-directeur', 'ecole', { eleves: ['École voisine'] });
    enLigne = false;

    const { appliquer } = monter({ eleves: [] }, false);
    expect(appliquer).not.toHaveBeenCalled();
  });
});

describe('sans compte identifié', () => {
  it('n\'écrit rien : un instantané sans propriétaire serait lisible par le suivant', () => {
    useAuthMock.mockReturnValue({ user: null });
    monter({ eleves: ['Awa'] }, true);
    expect(localStorage.length).toBe(0);
  });
});

describe('retour du réseau', () => {
  it('réinstallé hors ligne puis rafraîchi, l\'instantané est réenregistré', () => {
    enregistrer('directeur-1', 'ecole', { eleves: ['Awa'] });
    enLigne = false;
    const { result, rerender } = monter({ eleves: [] }, false);
    expect(result.current).not.toBeNull();

    act(() => { enLigne = true; window.dispatchEvent(new Event('online')); });
    rerender({ t: { eleves: ['Awa', 'Fatou'] }, p: true });

    expect(lire<Tranches>('directeur-1', 'ecole')!.donnees.eleves).toEqual(['Awa', 'Fatou']);
  });
});
