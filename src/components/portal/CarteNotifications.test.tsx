import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NotificationsPush } from '@/hooks/useNotificationsPush';

const hook = vi.fn<() => NotificationsPush>();
vi.mock('@/hooks/useNotificationsPush', () => ({ useNotificationsPush: () => hook() }));

import CarteNotifications from './CarteNotifications';
import { TEXTES_NOTIFICATIONS } from '@/lib/notificationsPush';

const etat = (surcharge: Partial<NotificationsPush>): NotificationsPush => ({
  etat: 'inactives', occupe: false, erreur: null,
  activer: vi.fn().mockResolvedValue(undefined), desactiver: vi.fn().mockResolvedValue(undefined),
  ...surcharge,
});

beforeEach(() => hook.mockReset());

describe('carte Notifications', () => {
  it('inactives : bouton « Activer », qui appelle activer()', () => {
    const h = etat({});
    hook.mockReturnValue(h);
    render(<CarteNotifications />);

    fireEvent.click(screen.getByRole('button', { name: 'Activer les notifications' }));
    expect(h.activer).toHaveBeenCalledTimes(1);
  });

  it('actives : le dit, et propose de désactiver', () => {
    const h = etat({ etat: 'actives' });
    hook.mockReturnValue(h);
    render(<CarteNotifications />);

    expect(screen.getByText('Notifications activées')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }));
    expect(h.desactiver).toHaveBeenCalledTimes(1);
  });

  it('actives : rappelle que c\'est propre à ce compte (comptes liés)', () => {
    hook.mockReturnValue(etat({ etat: 'actives' }));
    render(<CarteNotifications />);
    expect(screen.getByText(/pour ce compte uniquement/)).toBeInTheDocument();
  });

  it('occupé : empêche le double clic', () => {
    hook.mockReturnValue(etat({ occupe: true }));
    render(<CarteNotifications />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it.each(['refusees', 'a-installer-ios', 'non-supporte'] as const)(
    '%s : explique quoi faire, sans bouton qui ne mènerait nulle part', (cle) => {
      hook.mockReturnValue(etat({ etat: cle }));
      render(<CarteNotifications />);
      expect(screen.getByText(TEXTES_NOTIFICATIONS[cle])).toBeInTheDocument();
      expect(screen.queryByRole('button')).toBeNull();
    });

  it('état inconnu (hors connexion) : ne prétend pas « désactivées »', () => {
    hook.mockReturnValue(etat({ etat: null }));
    render(<CarteNotifications />);
    expect(screen.getByText(TEXTES_NOTIFICATIONS.inconnu)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('affiche l\'erreur, annoncée aux lecteurs d\'écran', () => {
    hook.mockReturnValue(etat({ erreur: 'Impossible d\'activer.' }));
    render(<CarteNotifications />);
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible d\'activer.');
  });

  it('les textes ne promettent que ce qui existe : notes, bulletins, paiements', () => {
    expect(TEXTES_NOTIFICATIONS.inactives).toMatch(/note/);
    expect(TEXTES_NOTIFICATIONS.inactives).toMatch(/bulletin/);
    expect(TEXTES_NOTIFICATIONS.inactives).toMatch(/paiement/);
    // Les rappels d'échéance arrivent dans une seconde tranche : ne pas les annoncer d'avance.
    expect(TEXTES_NOTIFICATIONS.inactives).not.toMatch(/échéance/i);
  });
});
