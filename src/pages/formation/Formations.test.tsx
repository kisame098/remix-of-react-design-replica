import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ════════════════════════════════════════════════════════════════════════════
// À la demande d'IFHO : n'importe quel membre du personnel peut construire le
// catalogue (créer des blocs, ajouter des matières), mais SEUL le directeur
// général (accountRole === 'admin') peut fixer ou modifier un coefficient —
// à la main comme par import.
// ════════════════════════════════════════════════════════════════════════════

let accountRole: string = 'admin';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ accountRole }) }));

const ctx = {
  loading: false,
  blocs: [{ id: 'b1', formationName: 'CAP Restauration', anneeLabel: 'Année 1', ordering: 0, createdAt: '2026-01-01T00:00:00Z' }],
  matieres: [{ id: 'm1', blocId: 'b1', type: 'obligatoire' as const, name: 'TP Cuisine', coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 }],
  choixGroups: [],
  addBloc: vi.fn(), updateBloc: vi.fn(), deleteBloc: vi.fn(), duplicateBloc: vi.fn(),
  addMatiere: vi.fn().mockResolvedValue({}), updateMatiere: vi.fn().mockResolvedValue(undefined), deleteMatiere: vi.fn(),
  addChoixGroup: vi.fn(), updateChoixGroup: vi.fn(), deleteChoixGroup: vi.fn(), addChoixOption: vi.fn(), deleteChoixOption: vi.fn(),
};
vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => ctx }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import Formations from './Formations';

describe('Formations — coefficients réservés au directeur général', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('le personnel (staff) voit le coefficient verrouillé, sans les boutons Importer/Modèles', async () => {
    accountRole = 'staff';
    render(<Formations />);
    expect(screen.queryByRole('button', { name: /Importer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Modèles hôtellerie-restauration/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exporter/ })).toBeInTheDocument();   // lecture seule : autorisée

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ajouter une matière' }));
    const champCoef = screen.getByLabelText(/Coefficient/);
    expect(champCoef).toBeDisabled();
    expect(screen.getByText('Réservé au directeur général.')).toBeInTheDocument();
  });

  it('modifier une matière existante en tant que staff garde le coefficient d\'origine, verrouillé', async () => {
    accountRole = 'staff';
    render(<Formations />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Modifier TP Cuisine' }));
    expect(screen.getByLabelText(/Coefficient/)).toHaveValue(4);
    expect(screen.getByLabelText(/Coefficient/)).toBeDisabled();
  });

  it('le directeur général (admin) peut modifier le coefficient et voit Importer/Modèles', async () => {
    accountRole = 'admin';
    render(<Formations />);
    expect(screen.getByRole('button', { name: /Importer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Modèles hôtellerie-restauration/ })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ajouter une matière' }));
    const champCoef = screen.getByLabelText(/Coefficient/);
    expect(champCoef).toBeEnabled();
    await user.clear(champCoef);
    await user.type(champCoef, '3');
    expect(champCoef).toHaveValue(3);
  });
});
