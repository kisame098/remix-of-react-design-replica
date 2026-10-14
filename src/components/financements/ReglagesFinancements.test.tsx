import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ════════════════════════════════════════════════════════════════════════════
// Paramètres → Financements : activer propose le 3FPT de la demande (90 %,
// 70/30), tout se modifie, et rien d'incohérent ne s'enregistre.
// ════════════════════════════════════════════════════════════════════════════

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
const enregistrer = vi.fn().mockResolvedValue(undefined);
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ school: { settings: {} }, updateSchoolSettings: enregistrer }) }));
vi.mock('@/contexts/PaymentContext', () => ({ usePayment: () => ({ annexServices: [{ id: 'cantine', name: 'Cantine' }] }) }));

import { ReglagesFinancements } from './ReglagesFinancements';

beforeEach(() => { toast.mockClear(); enregistrer.mockClear(); });

describe('Paramètres → Financements', () => {
  it('activer propose le 3FPT : 90 % pris en charge, acompte 70 % et solde 30 %', () => {
    render(<ReglagesFinancements />);
    fireEvent.click(screen.getByRole('switch', { name: 'Activer les financements' }));
    expect(screen.getByDisplayValue('3FPT')).toBeInTheDocument();
    expect(screen.getByLabelText('Part prise en charge')).toHaveValue('90');
    expect(screen.getByLabelText('Pourcentage de Acompte')).toHaveValue('70');
    expect(screen.getByLabelText('Pourcentage de Solde')).toHaveValue('30');
    expect(screen.getByText(/L'apprenant paie le reste \(10 %\)/)).toBeInTheDocument();
  });

  it('des tranches qui ne font pas 100 % ne s\'enregistrent pas', async () => {
    render(<ReglagesFinancements />);
    fireEvent.click(screen.getByRole('switch', { name: 'Activer les financements' }));
    fireEvent.change(screen.getByLabelText('Pourcentage de Solde'), { target: { value: '20' } });
    expect(screen.getByText(/Total : 90 %/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Réglages incomplets' })));
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('enregistre l\'organisme avec ses frais, ses tranches et ses pièces', async () => {
    render(<ReglagesFinancements />);
    fireEvent.click(screen.getByRole('switch', { name: 'Activer les financements' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cantine' }));
    fireEvent.change(screen.getByPlaceholderText(/Copie de la pièce/), { target: { value: 'Extrait de naissance' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/Copie de la pièce/), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() => expect(enregistrer).toHaveBeenCalledTimes(1));
    const { financements } = enregistrer.mock.calls[0][0];
    expect(financements.actif).toBe(true);
    expect(financements.organismes[0]).toMatchObject({
      nom: '3FPT', partFinancee: 90, frais: { inscription: true, mensualites: true, services: ['cantine'] },
      pieces: [{ nom: 'Extrait de naissance' }],
    });
  });
});
