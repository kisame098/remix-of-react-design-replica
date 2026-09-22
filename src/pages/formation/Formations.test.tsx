import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
  blocs: [
    { id: 'b1', formationName: 'CAP Restauration', anneeLabel: 'Année 1', diplome: "Diplôme d'État", niveauEntree: 'CM2 à 4e secondaire', ordering: 0, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b2', formationName: 'CAP Restauration', anneeLabel: 'Année 2', diplome: "Diplôme d'État", niveauEntree: 'CM2 à 4e secondaire', ordering: 1, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b3', formationName: 'BEP Hôtellerie', anneeLabel: 'Cycle unique', ordering: 2, createdAt: '2026-01-01T00:00:00Z' },
  ],
  matieres: [{ id: 'm1', blocId: 'b1', type: 'obligatoire' as const, name: 'TP Cuisine', coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 }],
  choixGroups: [{ id: 'c1', blocId: 'b1', label: 'Spécialité', coefficient: 2, ordering: 0, options: [{ id: 'o1', subjectName: 'Cuisine' }] }],
  addBloc: vi.fn(), updateBloc: vi.fn(), deleteBloc: vi.fn(), duplicateBloc: vi.fn(),
  duplicateFormation: vi.fn().mockResolvedValue([
    { id: 'n1', formationName: 'DAP Restauration', anneeLabel: 'Année 1', ordering: 0, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'n2', formationName: 'DAP Restauration', anneeLabel: 'Année 2', ordering: 1, createdAt: '2026-01-01T00:00:00Z' },
  ]),
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
    expect(screen.getAllByTitle('Modifier').length).toBeGreaterThan(0);               // bloc
    expect(screen.getAllByTitle('Dupliquer vers une autre année').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Supprimer ce bloc').length).toBeGreaterThan(0);
  });

  it('le directeur général (admin) peut créer une matière, fixer son coefficient, et voit Importer/Modèles', async () => {
    accountRole = 'admin';
    render(<Formations />);
    expect(screen.getByRole('button', { name: /Importer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Modèles hôtellerie-restauration/ })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Ajouter une matière' })[0]);
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

describe('Formations — lisibilité (regroupement par formation) et « Dupliquer toute la formation »', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('regroupe les blocs d\'une même formation sous un seul en-tête, avec diplôme et niveau d\'entrée', () => {
    accountRole = 'admin';
    render(<Formations />);
    // un seul en-tête « CAP Restauration », pas un par bloc (avant : deux cartes identiques dans le titre)
    expect(screen.getAllByText('CAP Restauration')).toHaveLength(1);
    expect(screen.getByText(/2 niveaux/)).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && /Diplôme d'État/.test(el.textContent ?? ''))).toBeInTheDocument();
    expect(screen.getAllByText(/CM2 à 4e secondaire/).length).toBeGreaterThan(0);
    expect(screen.getByText('BEP Hôtellerie')).toBeInTheDocument();
    expect(screen.getByText(/1 niveau\b/)).toBeInTheDocument();
    // les cartes elles-mêmes portent le libellé d'année, pas le nom de la formation en double
    expect(screen.getByText('Année 1')).toBeInTheDocument();
    expect(screen.getByText('Année 2')).toBeInTheDocument();
    expect(screen.getByText('Cycle unique')).toBeInTheDocument();
  });

  it('« Dupliquer toute la formation » copie tous les niveaux en un clic (personnel : invisible)', async () => {
    accountRole = 'staff';
    render(<Formations />);
    expect(screen.queryByRole('button', { name: /Dupliquer toute la formation/ })).not.toBeInTheDocument();
  });

  it('le directeur peut dupliquer toute la formation CAP (2 niveaux) vers une nouvelle formation', async () => {
    accountRole = 'admin';
    render(<Formations />);
    const user = userEvent.setup();
    const section = screen.getByText('CAP Restauration').closest('section')!;
    await user.click(within(section).getByRole('button', { name: /Dupliquer toute la formation/ }));

    expect(screen.getByText((_, el) =>
      el?.tagName === 'P' && (el.textContent ?? '').includes('Copie les') && (el.textContent ?? '').includes('CAP Restauration'),
    )).toBeInTheDocument();
    const champNom = screen.getByLabelText('Nom de la nouvelle formation *');
    await user.clear(champNom);
    await user.type(champNom, 'DAP Restauration');
    await user.click(screen.getByRole('button', { name: 'Dupliquer' }));

    expect(ctx.duplicateFormation).toHaveBeenCalledWith('CAP Restauration', expect.objectContaining({ formationName: 'DAP Restauration' }));
  });
});

describe('Formations — niveau d\'entrée et suggestion des noms de matières', () => {
  beforeEach(() => { vi.clearAllMocks(); accountRole = 'admin'; });

  it('le bloc a un champ « Niveau d\'entrée », repris dans l\'export/import', async () => {
    render(<Formations />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Nouveau bloc/ }));
    expect(screen.getByLabelText(/Niveau d'entrée/)).toBeInTheDocument();
  });

  it('le nom de matière propose les noms déjà utilisés dans l\'école (autocomplétion, sans nouvel écran)', async () => {
    render(<Formations />);
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button', { name: 'Ajouter une matière' })[0]);
    const champNom = screen.getByLabelText(/Nom de la matière/) as HTMLInputElement;
    expect(champNom.getAttribute('list')).toBe('matieres-connues');
    const datalist = document.getElementById('matieres-connues');
    expect(datalist?.querySelector('option[value="TP Cuisine"]')).toBeTruthy();
  });
});
