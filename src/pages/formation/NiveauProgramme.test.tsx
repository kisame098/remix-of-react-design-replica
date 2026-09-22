import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// ════════════════════════════════════════════════════════════════════════════
// Le programme pédagogique d'UN niveau : ses matières (groupées par
// catégorie), ses créneaux au choix, les totaux. Coefficients réservés au
// directeur général (accountRole === 'admin') — suite au retour d'IFHO.
// ════════════════════════════════════════════════════════════════════════════

let accountRole: string = 'admin';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ accountRole }) }));

const ctx = {
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', ordering: 0, createdAt: '2026-01-01T00:00:00Z', active: true }],
  niveaux: [{ id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '2026-01-01T00:00:00Z' }],
  catalogue: [{ id: 'm1', name: 'Anglais' }, { id: 'm2', name: 'TP Cuisine' }],
  niveauMatieres: [
    { id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'Anglais', type: 'obligatoire' as const, coefficient: 1, volumeHoraire: 45, nature: 'theorique' as const, categorie: 'Enseignement général', ordering: 0 },
    { id: 'nm2', niveauId: 'n1', matiereId: 'm2', matiereName: 'TP Cuisine', type: 'obligatoire' as const, coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, categorie: 'Enseignement professionnel', ordering: 1 },
  ],
  choixGroups: [{ id: 'c1', niveauId: 'n1', label: 'Spécialité', coefficient: 2, ordering: 0, options: [{ id: 'o1', subjectName: 'Cuisine' }] }],
  addMatiereToNiveau: vi.fn().mockResolvedValue({}),
  updateNiveauMatiere: vi.fn().mockResolvedValue(undefined),
  deleteNiveauMatiere: vi.fn(),
  addChoixGroup: vi.fn(), updateChoixGroup: vi.fn(), deleteChoixGroup: vi.fn(), addChoixOption: vi.fn(), deleteChoixOption: vi.fn(),
};
vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => ctx }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import NiveauProgramme from './NiveauProgramme';

const rendre = () => render(
  <MemoryRouter initialEntries={['/formation/formations/f1/niveaux/n1']}>
    <Routes><Route path="/formation/formations/:formationId/niveaux/:niveauId" element={<NiveauProgramme />} /></Routes>
  </MemoryRouter>,
);

describe('NiveauProgramme — matières groupées par catégorie et totaux', () => {
  beforeEach(() => { vi.clearAllMocks(); accountRole = 'admin'; });

  it('affiche les matières sous leur catégorie, et les totaux (matières, coefficients, heures)', () => {
    rendre();
    expect(screen.getByText('Enseignement général')).toBeInTheDocument();
    expect(screen.getByText('Enseignement professionnel')).toBeInTheDocument();
    expect(screen.getByText('Anglais')).toBeInTheDocument();
    expect(screen.getByText('TP Cuisine')).toBeInTheDocument();
    expect(screen.getByText('Spécialité')).toBeInTheDocument();
    expect(screen.getByText('Matières').nextElementSibling).toHaveTextContent('3');   // 2 matières + 1 créneau au choix
    expect(screen.getByText('Coefficient total').nextElementSibling).toHaveTextContent('7');   // 1 + 4 + 2
    expect(screen.getByText(/Volume horaire/).nextElementSibling).toHaveTextContent('195 h');   // 45 + 150
  });

  it('le personnel (staff) voit tout, mais ne peut ni ajouter ni modifier ni supprimer une matière', () => {
    accountRole = 'staff';
    rendre();
    expect(screen.queryByRole('button', { name: /Ajouter une matière/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier Anglais' })).not.toBeInTheDocument();
    expect(screen.getByText('Anglais')).toBeInTheDocument();   // lecture seule conservée
  });

  it('le directeur ajoute une matière, avec suggestion du catalogue déjà utilisé dans l\'école', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Ajouter une matière/ }));
    const champNom = screen.getByLabelText(/Nom de la matière/) as HTMLInputElement;
    expect(champNom.getAttribute('list')).toBe('matieres-catalogue');
    expect(document.getElementById('matieres-catalogue')?.querySelector('option[value="Anglais"]')).toBeTruthy();

    await user.type(champNom, 'Mathématiques');
    await user.clear(screen.getByLabelText(/Coefficient/));
    await user.type(screen.getByLabelText(/Coefficient/), '1');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(ctx.addMatiereToNiveau).toHaveBeenCalledWith('n1', 'Mathématiques', expect.objectContaining({ coefficient: 1 }));
  });

  it('refuse une matière déjà enseignée à ce niveau (même nom = même ligne de catalogue)', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Ajouter une matière/ }));
    await user.type(screen.getByLabelText(/Nom de la matière/), 'Anglais');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(ctx.addMatiereToNiveau).not.toHaveBeenCalled();
  });

  it('modifier une matière existante pré-remplit son coefficient, modifiable par le directeur', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: 'Modifier TP Cuisine' }));
    const champCoef = screen.getByLabelText(/Coefficient/);
    expect(champCoef).toHaveValue(4);
    expect(champCoef).toBeEnabled();
  });
});
