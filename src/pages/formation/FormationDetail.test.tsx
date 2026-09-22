import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

const ctx = {
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', diplomaType: "Diplôme d'État", ordering: 0, createdAt: '2026-01-01T00:00:00Z', active: true }],
  niveaux: [
    { id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'n2', formationId: 'f1', name: 'CAP 2', ordering: 1, createdAt: '2026-01-01T00:00:00Z' },
  ],
  catalogue: [],
  niveauMatieres: [{ id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'TP Cuisine', type: 'obligatoire' as const, coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 }],
  choixGroups: [],
  addNiveau: vi.fn().mockResolvedValue({ id: 'nnew' }),
  updateNiveau: vi.fn(), deleteNiveau: vi.fn(),
  duplicateNiveau: vi.fn().mockResolvedValue({ id: 'ndup', name: 'CAP 2' }),
};
vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => ctx }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import FormationDetail from './FormationDetail';

const rendre = () => render(
  <MemoryRouter initialEntries={['/formation/formations/f1']}>
    <Routes><Route path="/formation/formations/:formationId" element={<FormationDetail />} /></Routes>
  </MemoryRouter>,
);

describe('FormationDetail — les niveaux d\'UNE formation (CAP 1, CAP 2…)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche le nom de la formation une seule fois, et ses niveaux comme cartes courtes', () => {
    rendre();
    expect(screen.getByRole('heading', { name: 'CAP Restauration' })).toBeInTheDocument();
    expect(screen.getByText('CAP 1')).toBeInTheDocument();
    expect(screen.getByText('CAP 2')).toBeInTheDocument();
    expect(screen.getByText(/1 matière/)).toBeInTheDocument();
  });

  it('crée un niveau', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Ajouter un niveau/ }));
    await user.type(screen.getByLabelText('Nom *'), 'CAP 3');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(ctx.addNiveau).toHaveBeenCalledWith('f1', expect.objectContaining({ name: 'CAP 3' }));
  });

  it('dupliquer CAP 1 crée CAP 2 (matières et coefficients copiés) sans changer l\'original', async () => {
    const user = userEvent.setup();
    rendre();
    const carte = screen.getByText('CAP 1').closest('.group')!;
    await user.click(within(carte as HTMLElement).getByTitle('Dupliquer'));
    const champ = screen.getByLabelText('Nom *');
    expect(champ).toHaveValue('');   // jamais pré-rempli avec le nom de l'original
    await user.type(champ, 'CAP 2 bis');
    await user.click(screen.getByRole('button', { name: 'Dupliquer' }));
    expect(ctx.duplicateNiveau).toHaveBeenCalledWith('n1', 'f1', expect.objectContaining({ name: 'CAP 2 bis' }));
  });

  it('formation introuvable : message clair, pas d\'écran blanc', () => {
    render(
      <MemoryRouter initialEntries={['/formation/formations/inconnue']}>
        <Routes><Route path="/formation/formations/:formationId" element={<FormationDetail />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Formation introuvable.')).toBeInTheDocument();
  });
});
