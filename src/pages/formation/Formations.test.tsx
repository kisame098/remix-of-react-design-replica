import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

let accountRole: string = 'admin';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ accountRole }) }));

const ctx = {
  loading: false,
  formations: [
    { id: 'f1', name: 'CAP Restauration', diplomaType: "Diplôme d'État", duration: '3 ans', entryLevel: 'CM2 à 4e secondaire', active: true, ordering: 0, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'f2', name: 'BEP Hôtellerie', active: false, ordering: 1, createdAt: '2026-01-01T00:00:00Z' },
  ],
  niveaux: [
    { id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'n2', formationId: 'f1', name: 'CAP 2', ordering: 1, createdAt: '2026-01-01T00:00:00Z' },
  ],
  catalogue: [{ id: 'm1', name: 'TP Cuisine' }],
  niveauMatieres: [{ id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'TP Cuisine', type: 'obligatoire' as const, coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 }],
  choixGroups: [],
  addFormation: vi.fn().mockResolvedValue({ id: 'fnew', name: 'X' }),
  updateFormation: vi.fn().mockResolvedValue(undefined),
  deleteFormation: vi.fn(),
  duplicateFormation: vi.fn().mockResolvedValue({ id: 'fdup', name: 'DAP Restauration' }),
  addNiveau: vi.fn().mockResolvedValue({ id: 'nnew' }),
  updateNiveau: vi.fn(), deleteNiveau: vi.fn(), duplicateNiveau: vi.fn(),
  addMatiereToNiveau: vi.fn().mockResolvedValue({}), updateNiveauMatiere: vi.fn(), deleteNiveauMatiere: vi.fn(),
  addChoixGroup: vi.fn(), updateChoixGroup: vi.fn(), deleteChoixGroup: vi.fn(), addChoixOption: vi.fn(), deleteChoixOption: vi.fn(),
};
vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => ctx }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import Formations from './Formations';

const rendre = () => render(<MemoryRouter><Formations /></MemoryRouter>);

describe('Formations — liste (une carte par formation, pas par année)', () => {
  beforeEach(() => { vi.clearAllMocks(); accountRole = 'admin'; });

  it('une seule carte « CAP Restauration », avec son résumé (niveaux, matières, heures)', () => {
    rendre();
    expect(screen.getAllByText('CAP Restauration')).toHaveLength(1);
    expect(screen.getByText(/2 niveaux/)).toBeInTheDocument();
    expect(screen.getByText(/1 matière/)).toBeInTheDocument();
    expect(screen.getByText(/150 h/)).toBeInTheDocument();
    expect(screen.getByText(/Diplôme d'État/)).toBeInTheDocument();
    expect(screen.getByText(/CM2 à 4e secondaire/)).toBeInTheDocument();
  });

  it('une formation inactive est signalée', () => {
    rendre();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('personnel (staff) : pas de bouton Importer ni Modèles, mais peut créer/gérer une formation', () => {
    accountRole = 'staff';
    rendre();
    expect(screen.queryByRole('button', { name: /Importer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Modèles hôtellerie-restauration/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ajouter une formation/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Gérer' }).length).toBeGreaterThan(0);
  });

  it('directeur : crée une formation', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Ajouter une formation/ }));
    await user.type(screen.getByLabelText('Nom *'), 'DTS Gestion Hôtelière');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(ctx.addFormation).toHaveBeenCalledWith(expect.objectContaining({ name: 'DTS Gestion Hôtelière' }));
  });

  it('dupliquer une formation demande un nouveau nom et copie tout le contenu', async () => {
    const user = userEvent.setup();
    rendre();
    const carte = screen.getByText('CAP Restauration').closest('.group')!;
    await user.click(within(carte as HTMLElement).getByTitle('Dupliquer'));
    expect(screen.getByText((_, el) =>
      el?.tagName === 'P' && (el.textContent ?? '').includes('Copie tous les niveaux') && (el.textContent ?? '').includes('CAP Restauration'),
    )).toBeInTheDocument();
    const champ = screen.getByLabelText('Nom de la nouvelle formation *');
    await user.type(champ, 'DAP Restauration');
    await user.click(screen.getByRole('button', { name: 'Dupliquer' }));
    expect(ctx.duplicateFormation).toHaveBeenCalledWith('f1', expect.objectContaining({ name: 'DAP Restauration' }));
  });
});
