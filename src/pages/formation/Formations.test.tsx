import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ════════════════════════════════════════════════════════════════════════════
// À la demande d'IFHO : le personnel organise les FORMATIONS (créer, renommer,
// dupliquer, supprimer un bloc), mais seul le directeur général
// (accountRole === 'admin') crée, modifie ou supprime une MATIÈRE ou un
// créneau au choix — donc un coefficient. Laisser le personnel créer une
// matière sans pouvoir en fixer le coefficient ne sert à rien : ça ne
// produit que des coefficients à 1 à corriger, la source d'erreurs qu'on
// évite justement.
// ════════════════════════════════════════════════════════════════════════════

let accountRole: string = 'admin';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ accountRole }) }));

const ctx = {
  loading: false,
  blocs: [{ id: 'b1', formationName: 'CAP Restauration', anneeLabel: 'Année 1', ordering: 0, createdAt: '2026-01-01T00:00:00Z' }],
  matieres: [{ id: 'm1', blocId: 'b1', type: 'obligatoire' as const, name: 'TP Cuisine', coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 }],
  choixGroups: [{ id: 'c1', blocId: 'b1', label: 'Spécialité', coefficient: 2, ordering: 0, options: [{ id: 'o1', subjectName: 'Cuisine' }] }],
  addBloc: vi.fn(), updateBloc: vi.fn(), deleteBloc: vi.fn(), duplicateBloc: vi.fn(),
  addMatiere: vi.fn().mockResolvedValue({}), updateMatiere: vi.fn().mockResolvedValue(undefined), deleteMatiere: vi.fn(),
  addChoixGroup: vi.fn(), updateChoixGroup: vi.fn(), deleteChoixGroup: vi.fn(), addChoixOption: vi.fn(), deleteChoixOption: vi.fn(),
};
vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => ctx }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import Formations from './Formations';

describe('Formations — matières et coefficients réservés au directeur général', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('le personnel (staff) ne voit ni « Ajouter une matière », ni Importer/Modèles, ni les icônes modifier/supprimer d\'une matière ou d\'un créneau', () => {
    accountRole = 'staff';
    render(<Formations />);
    expect(screen.queryByRole('button', { name: 'Ajouter une matière' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Importer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Modèles hôtellerie-restauration/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier TP Cuisine' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier Spécialité' })).not.toBeInTheDocument();
    // lecture seule : le personnel voit toujours les matières, coefficients et le total
    expect(screen.getByText('TP Cuisine')).toBeInTheDocument();
    expect(screen.getByText(/coef 4/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exporter/ })).toBeInTheDocument();
  });

  it('le personnel garde la main sur les blocs (créer, modifier, dupliquer, supprimer une formation)', () => {
    accountRole = 'staff';
    render(<Formations />);
    expect(screen.getByRole('button', { name: /Nouveau bloc/ })).toBeInTheDocument();
    expect(screen.getByTitle('Modifier')).toBeInTheDocument();               // bloc
    expect(screen.getByTitle('Dupliquer vers une autre année')).toBeInTheDocument();
    expect(screen.getByTitle('Supprimer ce bloc')).toBeInTheDocument();
  });

  it('le directeur général (admin) peut créer une matière, fixer son coefficient, et voit Importer/Modèles', async () => {
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

  it('le directeur général peut modifier une matière existante, coefficient inclus', async () => {
    accountRole = 'admin';
    render(<Formations />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Modifier TP Cuisine' }));
    expect(screen.getByLabelText(/Coefficient/)).toHaveValue(4);
    expect(screen.getByLabelText(/Coefficient/)).toBeEnabled();
  });
});
