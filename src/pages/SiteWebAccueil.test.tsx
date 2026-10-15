import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const etatDuSite = vi.fn();
const depublierSite = vi.fn();
const publierSite = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ school: { id: 's1', name: 'Groupe Scolaire Excellence', beta_testeur: true }, accountRole: 'admin' }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/siteWeb', async () => {
  const vrai = await vi.importActual<typeof import('@/lib/siteWeb')>('@/lib/siteWeb');
  return {
    ...vrai,
    etatDuSite: (...a: unknown[]) => etatDuSite(...a),
    slugDeLEcole: async () => 'gse',
    depublierSite: () => depublierSite(),
    publierSite: (...a: unknown[]) => publierSite(...a),
    verifierAdresse: async () => 'actuelle',
  };
});
// L'aperçu réel du site est lourd et sans intérêt ici.
vi.mock('@/siteEcole/ChoixModele', () => ({ ApercuModele: () => <div>aperçu</div> }));

import SiteWebAccueil from './SiteWebAccueil';

const BROUILLON = { identite: { modele: 'campus', nom: 'Groupe Scolaire Excellence' } };
const ouvrir = () => render(<MemoryRouter><SiteWebAccueil /></MemoryRouter>);

describe('Page « Site web »', () => {
  beforeEach(() => { etatDuSite.mockReset(); depublierSite.mockReset(); publierSite.mockReset(); });

  it('sans site : propose de le créer (ouvre l\'éditeur)', async () => {
    etatDuSite.mockResolvedValue(null);
    ouvrir();
    const lien = await screen.findByRole('link', { name: /Créer mon site/ });
    expect(lien).toHaveAttribute('href', '/site-web/editeur');
  });

  it('site en ligne : interrupteur activé, adresse, bouton de l\'éditeur', async () => {
    etatDuSite.mockResolvedValue({ brouillon: BROUILLON, publie: BROUILLON, publie_le: '2026-10-15T10:00:00Z' });
    ouvrir();
    const inter = await screen.findByRole('switch', { name: 'Mettre le site hors ligne' });
    expect(inter).toBeChecked();
    expect(screen.getByText(/Visible par tous depuis le 15 octobre 2026/)).toBeInTheDocument();
    // L'aperçu et le bouton mènent tous deux à l'éditeur.
    for (const lien of screen.getAllByRole('link', { name: /Ouvrir l'éditeur/ })) expect(lien).toHaveAttribute('href', '/site-web/editeur');
    expect(screen.queryByText(/pas encore visibles en ligne/)).not.toBeInTheDocument();
  });

  it('signale les modifications pas encore en ligne', async () => {
    etatDuSite.mockResolvedValue({ brouillon: { ...BROUILLON, x: 1 }, publie: BROUILLON, publie_le: '2026-10-15T10:00:00Z' });
    ouvrir();
    expect(await screen.findByText(/pas encore visibles en ligne/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mettre à jour le site/ })).toBeInTheDocument();
  });

  it('désactiver : demande confirmation, puis retire le site', async () => {
    etatDuSite.mockResolvedValue({ brouillon: BROUILLON, publie: BROUILLON, publie_le: '2026-10-15T10:00:00Z' });
    depublierSite.mockResolvedValue(undefined);
    ouvrir();
    await userEvent.click(await screen.findByRole('switch'));
    expect(screen.getByText('Mettre le site hors ligne ?')).toBeInTheDocument();
    expect(depublierSite).not.toHaveBeenCalled();
    etatDuSite.mockResolvedValue({ brouillon: BROUILLON, publie: null, publie_le: null });
    await userEvent.click(screen.getByRole('button', { name: 'Mettre hors ligne' }));
    await waitFor(() => expect(depublierSite).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Hors ligne : les visiteurs voient/)).toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('activer : confirme l\'adresse, puis met en ligne', async () => {
    etatDuSite.mockResolvedValue({ brouillon: BROUILLON, publie: null, publie_le: null });
    publierSite.mockResolvedValue('gse');
    ouvrir();
    await userEvent.click(await screen.findByRole('switch', { name: 'Mettre le site en ligne' }));
    expect(screen.getByText('Mettre votre site en ligne')).toBeInTheDocument();
    const valider = screen.getByRole('button', { name: 'Mettre en ligne' });
    await waitFor(() => expect(valider).toBeEnabled());
    await userEvent.click(valider);
    await waitFor(() => expect(publierSite).toHaveBeenCalledWith('gse'));
  });
});
