import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDonneesHorsLigne } from './useDonneesHorsLigne';
import { enregistrer, lire } from '@/lib/cacheHorsLigne';

// ════════════════════════════════════════════════════════════════════════════
// « Les élèves et les profs doivent pouvoir consulter leurs données sans
// internet. » Ce chargeur est ce qui le permet : il enregistre ce qu'il
// rapporte, et le ressert quand le réseau manque — sans jamais mélanger les
// comptes d'un même téléphone.
// ════════════════════════════════════════════════════════════════════════════

const utilisateur = { id: 'eleve-1' };
const useAuthMock = vi.fn(() => ({ user: utilisateur }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => useAuthMock() }));

let enLigne = true;
Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => enLigne });
const basculer = (valeur: boolean) => act(() => {
  enLigne = valeur;
  window.dispatchEvent(new Event(valeur ? 'online' : 'offline'));
});

beforeEach(() => { localStorage.clear(); enLigne = true; useAuthMock.mockReturnValue({ user: utilisateur }); });
afterEach(() => { enLigne = true; });

describe('en ligne', () => {
  it('charge depuis le réseau et enregistre pour plus tard', async () => {
    const chargeur = vi.fn().mockResolvedValue({ moyenne: 14 });
    const { result } = renderHook(() => useDonneesHorsLigne('notes', chargeur));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.donnees).toEqual({ moyenne: 14 });
    expect(result.current.depuisLeCache).toBe(false);
    expect(lire<{ moyenne: number }>('eleve-1', 'notes')?.donnees).toEqual({ moyenne: 14 });
  });

  it('affiche d\'abord les données enregistrées, puis les fraîches', async () => {
    enregistrer('eleve-1', 'notes', { moyenne: 11 });
    const chargeur = vi.fn().mockResolvedValue({ moyenne: 14 });
    const { result } = renderHook(() => useDonneesHorsLigne('notes', chargeur));

    // L'écran n'est jamais vide en attendant le réseau.
    expect(result.current.donnees).toEqual({ moyenne: 11 });
    await waitFor(() => expect(result.current.donnees).toEqual({ moyenne: 14 }));
  });

  it('requête échouée : on garde l\'affichage enregistré plutôt que de vider l\'écran', async () => {
    enregistrer('eleve-1', 'notes', { moyenne: 11 });
    const chargeur = vi.fn().mockRejectedValue(new Error('réseau'));
    const { result } = renderHook(() => useDonneesHorsLigne('notes', chargeur));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.donnees).toEqual({ moyenne: 11 });
  });
});

describe('hors connexion', () => {
  it('ressert les données enregistrées, avec leur date, sans appeler le réseau', async () => {
    enregistrer('eleve-1', 'notes', { moyenne: 11 }, new Date('2026-09-19T11:20:00Z'));
    enLigne = false;
    const chargeur = vi.fn();
    const { result } = renderHook(() => useDonneesHorsLigne('notes', chargeur));

    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.donnees).toEqual({ moyenne: 11 });
    expect(result.current.depuisLeCache).toBe(true);
    expect(result.current.enregistreLe).toBe('2026-09-19T11:20:00.000Z');
    expect(chargeur).not.toHaveBeenCalled();
  });

  it('sans rien d\'enregistré : écran vide mais pas de chargement sans fin', async () => {
    enLigne = false;
    const { result } = renderHook(() => useDonneesHorsLigne('notes', vi.fn()));
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.donnees).toBeNull();
  });

  it('au retour du réseau, les données se rafraîchissent toutes seules', async () => {
    enregistrer('eleve-1', 'notes', { moyenne: 11 });
    enLigne = false;
    const chargeur = vi.fn().mockResolvedValue({ moyenne: 14 });
    const { result } = renderHook(() => useDonneesHorsLigne('notes', chargeur));
    await waitFor(() => expect(result.current.donnees).toEqual({ moyenne: 11 }));

    basculer(true);
    await waitFor(() => expect(result.current.donnees).toEqual({ moyenne: 14 }));
  });
});

describe('cloisonnement', () => {
  it('un autre compte sur le même téléphone ne voit pas ces données', async () => {
    enregistrer('eleve-1', 'notes', { moyenne: 11 });
    useAuthMock.mockReturnValue({ user: { id: 'eleve-2' } });
    enLigne = false;

    const { result } = renderHook(() => useDonneesHorsLigne('notes', vi.fn()));
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(result.current.donnees).toBeNull();
  });

  it('écran inactif (rôle sans cette donnée) : aucun chargement, aucune écriture', async () => {
    const chargeur = vi.fn();
    const { result } = renderHook(() => useDonneesHorsLigne('notes', chargeur, [], false));
    await waitFor(() => expect(result.current.chargement).toBe(false));
    expect(chargeur).not.toHaveBeenCalled();
    expect(lire('eleve-1', 'notes')).toBeNull();
  });
});
