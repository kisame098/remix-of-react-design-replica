import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// ════════════════════════════════════════════════════════════════════════════
// Onglet « Réductions » : droits, motif obligatoire, lignes envoyées à la base.
// ════════════════════════════════════════════════════════════════════════════

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));

let auth: { accountRole: string; staffPermissions: string[] } = { accountRole: 'admin', staffPermissions: [] };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ ...auth, school: { settings: {} } }) }));
vi.mock('@/contexts/SchoolYearContext', () => ({
  useSchoolYear: () => ({ currentYear: { id: '2025-2026', startDate: '2025-10-01', endDate: '2025-12-31' } }),
}));

const eleve = { id: 'enr-1', studentId: 'ETU-1', firstName: 'Awa', lastName: 'Diop', classId: 'c1', enrolledAt: '2025-09-01' };
vi.mock('@/contexts/SchoolContext', () => ({
  useSchool: () => ({ students: [eleve], classes: [{ id: 'c1', name: 'CM2 A' }] }),
}));

const appliquer = vi.fn().mockResolvedValue(undefined);
const retirer = vi.fn().mockResolvedValue(undefined);
let ajustements: unknown[] = [];
vi.mock('@/contexts/PaymentContext', () => ({
  usePayment: () => ({
    ajustements,
    getTuitionConfig: () => ({ inscriptionFee: 20_000, monthlyFee: 10_000 }),
    annexServices: [],
    getStudentActiveServices: () => [],
    hasPaidInscription: () => true,
    hasPaidTuitionMonth: (_: string, k: string) => k === '2025-10',
    hasPaidService: () => false,
    isEnrolledInService: () => false,
    getAjustementsEleve: () => new Map(),
    appliquerTarifsEleve: appliquer,
    retirerTarifsEleve: retirer,
  }),
}));

import TarifsEleves from './TarifsEleves';

const ouvrirEleve = () => {
  fireEvent.change(screen.getByLabelText('Chercher un élève'), { target: { value: 'awa' } });
  fireEvent.click(screen.getByRole('button', { name: /Awa Diop/ }));
};

beforeEach(() => {
  auth = { accountRole: 'admin', staffPermissions: [] };
  ajustements = [];
  appliquer.mockClear(); toast.mockClear();
});

describe('Réductions', () => {
  it('sans réduction : total à 0 F et liste vide', () => {
    render(<TarifsEleves />);
    expect(screen.getByText(/Aucun élève n'a de tarif personnalisé/)).toBeInTheDocument();
  });

  it('liste les élèves concernés et l’argent en moins (−50 % sur 10 000 F = 5 000 F)', () => {
    ajustements = [{ id: 'a1', studentId: 'enr-1', type: 'tuition', monthKey: '2025-11', mode: 'pourcentage', valeur: 50, motif: 'Enfant du personnel' }];
    render(<TarifsEleves />);
    expect(screen.getByText('Enfant du personnel')).toBeInTheDocument();
    expect(screen.getAllByText(/5\s000 F/).length).toBeGreaterThan(0);
  });

  it('un mois déjà payé ne peut pas être coché', () => {
    render(<TarifsEleves />);
    ouvrirEleve();
    expect(screen.queryByRole('checkbox', { name: /Octobre 2025/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Novembre 2025/ })).toBeInTheDocument();
  });

  it('motif obligatoire : rien n’est envoyé sans lui', async () => {
    render(<TarifsEleves />);
    ouvrirEleve();
    fireEvent.click(screen.getByRole('checkbox', { name: /Novembre 2025/ }));
    fireEvent.change(screen.getByLabelText('Valeur'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Appliquer aux 1 frais/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/motif/) })));
    expect(appliquer).not.toHaveBeenCalled();
  });

  it('« Tous les mois » + −50 % + motif : une ligne par mois non payé, envoyée à la base', async () => {
    render(<TarifsEleves />);
    ouvrirEleve();
    fireEvent.click(screen.getByRole('button', { name: 'Tous les mois' }));
    fireEvent.change(screen.getByLabelText('Valeur'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Motif'), { target: { value: 'Enfant du personnel' } });
    fireEvent.click(screen.getByRole('button', { name: /Appliquer aux 2 frais/ }));
    await waitFor(() => expect(appliquer).toHaveBeenCalledTimes(1));
    const [id, lignes] = appliquer.mock.calls[0];
    expect(id).toBe('enr-1');
    expect(lignes.map((l: { monthKey: string }) => l.monthKey)).toEqual(['2025-11', '2025-12']);
    expect(lignes.every((l: { mode: string; valeur: number }) => l.mode === 'pourcentage' && l.valeur === 50)).toBe(true);
  });

  it('personnel sans la permission « reductions » : consultation seulement', () => {
    auth = { accountRole: 'staff', staffPermissions: ['payments'] };
    render(<TarifsEleves />);
    ouvrirEleve();
    const dialogue = screen.getByRole('dialog');
    expect(within(dialogue).getByText(/Seuls le directeur et le personnel autorisé/)).toBeInTheDocument();
    expect(within(dialogue).queryByRole('button', { name: /Appliquer/ })).toBeNull();
  });

  it('personnel AVEC la permission « reductions » : peut accorder', () => {
    auth = { accountRole: 'staff', staffPermissions: ['payments', 'reductions'] };
    render(<TarifsEleves />);
    ouvrirEleve();
    expect(screen.getByRole('button', { name: /Appliquer/ })).toBeInTheDocument();
  });
});
