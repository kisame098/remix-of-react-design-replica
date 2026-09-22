import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let school: { name: string; management_mode?: string } = { name: 'Test' };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: { full_name: 'Directeur' }, school, signOut: vi.fn(), accountRole: 'admin', staffPermissions: [] }),
}));
vi.mock('./SchoolYearSelector', () => ({ SchoolYearSelector: () => null }));

import { DashboardSidebar } from './DashboardSidebar';

const rendre = (chemin = '/dashboard') => render(<MemoryRouter initialEntries={[chemin]}><DashboardSidebar /></MemoryRouter>);

describe('DashboardSidebar selon le mode', () => {
  it('école classique : menu habituel, aucune trace du mode formation', () => {
    school = { name: 'Test', management_mode: 'classique' };
    rendre();
    for (const t of ['Gestion Classe', 'Gestion Notes', 'Cursus']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.queryByText('Formations')).not.toBeInTheDocument();
    expect(screen.queryByText('Formation professionnelle')).not.toBeInTheDocument();
  });

  it('école en formation pro : nouvelles rubriques signalées en développement, pages classiques absentes', () => {
    school = { name: 'IFHO', management_mode: 'formation_pro' };
    rendre();
    for (const t of ['Formations', 'Promotions', 'Évaluations', 'Examens', 'Stages', 'Documents']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByText('Formation professionnelle')).toBeInTheDocument();
    expect(screen.getAllByText('En dév.')).toHaveLength(6);
    expect(screen.getByText('Formations')).toBeInTheDocument();
    for (const t of ['Gestion Classe', 'Gestion Notes', 'Cursus']) expect(screen.queryByText(t)).not.toBeInTheDocument();
    // les outils partagés restent
    for (const t of ['Gestion Élèves', 'Gestion Paiements', 'Gestion Présences']) expect(screen.getByText(t)).toBeInTheDocument();
  });

  it('sur une page profonde de Formations, une seule rubrique est allumée (pas « Vue d\'ensemble » en même temps)', () => {
    school = { name: 'IFHO', management_mode: 'formation_pro' };
    rendre('/formation/formations/f1/niveaux/n1');
    const classeDe = (libelle: string) => screen.getByText(libelle).closest('a')?.className ?? '';
    expect(classeDe('Formations')).toContain('bg-primary');
    expect(classeDe("Vue d'ensemble")).not.toContain('bg-primary');
  });
});
