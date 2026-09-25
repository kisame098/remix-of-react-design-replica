import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let detecte: string | null = 'mac-arm';
vi.mock('@/lib/telechargement', async () => {
  const vrai = await vi.importActual<typeof import('@/lib/telechargement')>('@/lib/telechargement');
  return { ...vrai, detecterOrdinateur: vi.fn(async () => detecte), indicesDuNavigateur: () => ({ userAgent: '' }) };
});

import Telecharger from './Telecharger';

const rendre = () => render(<MemoryRouter><Telecharger /></MemoryRouter>);

describe('Page Télécharger', () => {
  beforeEach(() => { detecte = 'mac-arm'; });

  it('propose la bonne version en grand, et signale « Votre ordinateur »', async () => {
    rendre();
    const liens = await screen.findAllByRole('link', { name: 'Télécharger pour Mac puce Apple' });
    expect(liens[0]).toHaveAttribute('href', 'https://maj.senclass.com/telecharger/SenClass-Mac-Apple-Silicon.dmg');
    expect(screen.getByText('Votre ordinateur')).toBeInTheDocument();
  });

  it('les trois versions restent toujours proposées, en vrais liens', async () => {
    rendre();
    await screen.findByText('Votre ordinateur');
    expect(screen.getByRole('link', { name: 'Télécharger pour Windows' })).toHaveAttribute('href', 'https://maj.senclass.com/telecharger/SenClass-Windows.exe');
    expect(screen.getByRole('link', { name: 'Télécharger pour Mac Intel' })).toHaveAttribute('href', 'https://maj.senclass.com/telecharger/SenClass-Mac-Intel.dmg');
  });

  it('ordinateur non reconnu (téléphone) : pas de bouton principal, un message', async () => {
    detecte = null;
    rendre();
    expect(await screen.findByText(/s'installe sur un ordinateur Windows ou Mac/)).toBeInTheDocument();
    expect(screen.queryByText('Votre ordinateur')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Télécharger pour/ })).toHaveLength(3);
  });

  it('marche à suivre et activation', async () => {
    rendre();
    expect(screen.getByText('« Exécuter quand même »')).toBeInTheDocument();
    expect(screen.getByText('« Ouvrir quand même »')).toBeInTheDocument();
    expect(screen.getByText("identifiant d'installation")).toBeInTheDocument();
  });
});
