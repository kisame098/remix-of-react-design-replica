import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({ school: { id: 's1' } as object | null, accountRole: 'admin' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));

import { AnnonceSiteWeb, FIN_ANNONCE_SITE_WEB, annonceSiteWebVisible } from './AnnonceSiteWeb';

describe('annonce du Site web', () => {
  const avant = FIN_ANNONCE_SITE_WEB - 60_000;

  it('pour le directeur, pendant l\'annonce, hors de la rubrique Site web', () => {
    expect(annonceSiteWebVisible({}, 'admin', '/dashboard', avant)).toBe(true);
    expect(annonceSiteWebVisible({}, 'staff', '/dashboard', avant)).toBe(false);
    expect(annonceSiteWebVisible({}, 'teacher', '/dashboard', avant)).toBe(false);
    expect(annonceSiteWebVisible(null, 'admin', '/dashboard', avant)).toBe(false);
    expect(annonceSiteWebVisible({}, 'admin', '/site-web', avant)).toBe(false);
    expect(annonceSiteWebVisible({}, 'admin', '/dashboard', FIN_ANNONCE_SITE_WEB)).toBe(false);
  });

  it('mène à la rubrique, et la croix la ferme pour la page en cours seulement', async () => {
    vi.useFakeTimers({ now: avant, toFake: ['Date'] });
    const { unmount } = render(<MemoryRouter initialEntries={['/dashboard']}><AnnonceSiteWeb /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Créer mon site/ })).toHaveAttribute('href', '/site-web');
    await userEvent.click(screen.getByRole('button', { name: 'Fermer l\'annonce' }));
    expect(screen.queryByText(/Créez le site internet/)).not.toBeInTheDocument();
    unmount();
    // Rechargement de la page : elle revient.
    render(<MemoryRouter initialEntries={['/dashboard']}><AnnonceSiteWeb /></MemoryRouter>);
    expect(screen.getByText(/Créez le site internet/)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
