import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ════════════════════════════════════════════════════════════════════════════
// NOUVELLE VERSION : annoncée, jamais imposée. Un rechargement d'office ferait
// perdre à un caissier l'encaissement qu'il est en train de saisir.
// ════════════════════════════════════════════════════════════════════════════

const etat = vi.hoisted(() => ({
  besoin: false,
  masquer: vi.fn(),
  mettreAJour: vi.fn(),
  options: null as null | { onRegisteredSW?: (url: string, r: unknown) => void },
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: typeof etat.options) => {
    etat.options = options;
    return {
      needRefresh: [etat.besoin, etat.masquer],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: etat.mettreAJour,
    };
  },
}));

import { MiseAJourApplication, INTERVALLE_VERIFICATION } from './MiseAJourApplication';

beforeEach(() => {
  etat.besoin = false;
  etat.masquer.mockReset();
  etat.mettreAJour.mockReset();
  etat.options = null;
});

describe('MiseAJourApplication', () => {
  it('ne montre rien quand l\'application est à jour', () => {
    const { container } = render(<MiseAJourApplication />);
    expect(container).toBeEmptyDOMElement();
  });

  it('annonce une nouvelle version', () => {
    etat.besoin = true;
    render(<MiseAJourApplication />);
    expect(screen.getByRole('status')).toHaveTextContent('Nouvelle version disponible');
  });

  it('invite à enregistrer la saisie en cours AVANT de mettre à jour', () => {
    etat.besoin = true;
    render(<MiseAJourApplication />);
    expect(screen.getByRole('status')).toHaveTextContent(/Enregistrez votre saisie/);
  });

  it('ne recharge QUE sur action de l\'utilisateur', () => {
    etat.besoin = true;
    render(<MiseAJourApplication />);
    expect(etat.mettreAJour).not.toHaveBeenCalled();   // rien d'imposé

    fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }));
    expect(etat.mettreAJour).toHaveBeenCalledWith(true);
  });

  it('« Plus tard » écarte le bandeau sans rien recharger', () => {
    etat.besoin = true;
    render(<MiseAJourApplication />);
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(etat.masquer).toHaveBeenCalledWith(false);
    expect(etat.mettreAJour).not.toHaveBeenCalled();
  });

  it('cherche une nouvelle version toutes les heures — un onglet de caisse reste ouvert toute la journée', () => {
    vi.useFakeTimers();
    render(<MiseAJourApplication />);
    const update = vi.fn().mockResolvedValue(undefined);
    etat.options!.onRegisteredSW!('/sw.js', { update });

    vi.advanceTimersByTime(INTERVALLE_VERIFICATION - 1);
    expect(update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(INTERVALLE_VERIFICATION);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('une vérification échouée (hors ligne) ne fait pas planter l\'application', async () => {
    vi.useFakeTimers();
    render(<MiseAJourApplication />);
    const update = vi.fn().mockRejectedValue(new Error('hors ligne'));
    etat.options!.onRegisteredSW!('/sw.js', { update });
    vi.advanceTimersByTime(INTERVALLE_VERIFICATION);
    await Promise.resolve();
    expect(update).toHaveBeenCalled();
  });

  it('reste au-dessus de la barre de navigation basse du portail sur téléphone', () => {
    etat.besoin = true;
    render(<MiseAJourApplication />);
    expect(screen.getByRole('status').className).toContain('bottom-24');
  });
});
