import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import PlatformSitesWeb, { filtrerSites, type SiteEcoleLigne } from './PlatformSitesWeb';

const ligne = (x: Partial<SiteEcoleLigne>): SiteEcoleLigne => ({
  school_id: 's', ecole: 'École', ville: null, slug: null, modele: 'campus', nom_site: null,
  en_ligne: false, publie_le: null, modifie_le: null, modifications_en_attente: false, ...x,
});
const SITES = [
  ligne({ school_id: 's1', ecole: 'TEST 23 SENCLASS', ville: 'Dakar', slug: 'groupescolairesenclass', modele: 'baobab', en_ligne: true,
    publie_le: '2026-10-17T16:03:47Z', modifie_le: '2026-10-17T16:03:47Z', modifications_en_attente: true }),
  ligne({ school_id: 's2', ecole: 'Groupe Scolaire Kambal', ville: 'Thiès', modele: 'prestige' }),
];

describe('Plateforme — Sites web', () => {
  it('filtre par état et cherche par école, adresse ou ville', () => {
    expect(filtrerSites(SITES, 'en_ligne', '').map(s => s.school_id)).toEqual(['s1']);
    expect(filtrerSites(SITES, 'hors_ligne', '').map(s => s.school_id)).toEqual(['s2']);
    expect(filtrerSites(SITES, 'tous', 'thiès').map(s => s.school_id)).toEqual(['s2']);
    expect(filtrerSites(SITES, 'tous', 'GROUPESCOLAIRE').map(s => s.school_id)).toEqual(['s1']);
  });

  it('liste les sites avec leurs chiffres, l\'adresse cliquable seulement pour un site en ligne', async () => {
    rpc.mockResolvedValue({ data: SITES, error: null });
    render(<MemoryRouter><PlatformSitesWeb /></MemoryRouter>);
    const lien = await screen.findByRole('link', { name: /groupescolairesenclass\.senclass\.com/ });
    expect(rpc).toHaveBeenCalledWith('platform_sites_ecoles');
    expect(screen.getByRole('link', { name: 'Groupe Scolaire Kambal' })).toHaveAttribute('href', '/platform/ecoles/s2');
    expect(screen.getByText('Baobab')).toBeInTheDocument();
    expect(screen.getByText('Modifications à publier', { selector: 'p.inline-flex' })).toBeInTheDocument();
    expect(screen.getByText('Pas encore choisie')).toBeInTheDocument();
    expect(lien).toHaveAttribute('target', '_blank');

    await userEvent.click(screen.getByRole('button', { name: 'Pas en ligne' }));
    const tableau = screen.getByRole('table');
    expect(within(tableau).queryByText('TEST 23 SENCLASS')).not.toBeInTheDocument();
    expect(within(tableau).getByText('Groupe Scolaire Kambal')).toBeInTheDocument();
  });
});
