import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// L'écran « d'où vient l'argent » s'ouvre, répartit et filtre (classe × rubrique).
beforeAll(() => { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as never; });

const pay = (id: string, eleve: string, type: string, amount: number, extra: object = {}) =>
  ({ id, studentId: eleve, type, amount, method: 'especes', paidAt: '2026-10-05T10:00:00Z', status: 'confirmed', ...extra });
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ school: { settings: {}, management_mode: 'classique' } }) }));
vi.mock('@/contexts/SchoolContext', () => ({ useSchool: () => ({
  tousLesEleves: [{ id: 'a', classId: 'c6' }, { id: 'b', classId: 'cT' }],
  classes: [{ id: 'c6', name: '6ème A', niveau: '6ème' }, { id: 'cT', name: 'Tle S', niveau: 'Tle' }],
}) }));
vi.mock('@/contexts/PaymentContext', () => ({ usePayment: () => ({
  payments: [pay('1', 'a', 'inscription', 25000), pay('2', 'a', 'tuition', 15000, { monthKey: '2026-10' }), pay('3', 'b', 'tuition', 20000, { monthKey: '2026-10' })],
  annexServices: [],
}) }));
vi.mock('@/contexts/SchoolYearContext', () => ({ useSchoolYear: () => ({ currentYear: { startDate: '2026-10-01', endDate: '2027-06-30' } }) }));
vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => ({ promotions: [], niveaux: [], formations: [] }) }));

import { DetailEncaissements } from './DetailEncaissements';

describe('détail des encaissements', () => {
  it('répartit par rubrique puis filtre une classe', () => {
    render(<DetailEncaissements onRetour={() => {}} />);
    expect(screen.getByText('Total encaissé :').textContent).toContain('60');
    expect(screen.getAllByText('Mensualités').length).toBeGreaterThan(0);
    // Clic sur la carte Mensualités : le résultat ne garde que les mensualités.
    fireEvent.click(screen.getAllByText('Mensualités')[0].closest('[role="button"]')!);
    expect(screen.getByText('Résultat du filtre').nextElementSibling?.textContent?.replace(/\s/g, '')).toBe('35000FCFA');
  });
});
