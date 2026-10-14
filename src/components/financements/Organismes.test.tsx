import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ════════════════════════════════════════════════════════════════════════════
// Financements : Paramètres ne porte que l'interrupteur ; les organismes se
// règlent dans le module (bouton « Organismes »). Activer propose le 3FPT de la
// demande (90 %, 70/30), tout se modifie, rien d'incohérent ne s'enregistre.
// ════════════════════════════════════════════════════════════════════════════

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
const enregistrer = vi.fn().mockResolvedValue(undefined);
let settings: Record<string, unknown> = {};
let role = 'admin';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ school: { settings }, accountRole: role, updateSchoolSettings: enregistrer }) }));
vi.mock('@/contexts/PaymentContext', () => ({ usePayment: () => ({ annexServices: [{ id: 'cantine', name: 'Cantine' }] }) }));

import { ActivationFinancements, DialogOrganismes } from './Organismes';
import { organisme3FPT } from '@/lib/financements';

beforeEach(() => {
  toast.mockClear(); enregistrer.mockClear(); role = 'admin';
  settings = { financements: { actif: true, organismes: [{ ...organisme3FPT(), id: 'fpt' }] } };
});

describe('Paramètres → Financements : seulement l\'interrupteur', () => {
  it('activer enregistre aussitôt le module avec le 3FPT de la demande (90 %, acompte 70 %, solde 30 %)', async () => {
    settings = {};
    render(<ActivationFinancements />);
    expect(screen.queryByLabelText('Part prise en charge')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Activer les financements' }));
    await waitFor(() => expect(enregistrer).toHaveBeenCalledTimes(1));
    const { financements } = enregistrer.mock.calls[0][0];
    expect(financements.actif).toBe(true);
    expect(financements.organismes[0]).toMatchObject({ nom: '3FPT', partFinancee: 90 });
    expect(financements.organismes[0].tranches.map((t: { pourcentage: number }) => t.pourcentage)).toEqual([70, 30]);
  });

  it('désactiver garde les organismes déjà réglés', async () => {
    render(<ActivationFinancements />);
    fireEvent.click(screen.getByRole('switch', { name: 'Activer les financements' }));
    await waitFor(() => expect(enregistrer).toHaveBeenCalled());
    expect(enregistrer.mock.calls[0][0].financements).toMatchObject({ actif: false, organismes: [{ id: 'fpt' }] });
  });
});

describe('Financements → Organismes', () => {
  it('montre les règles du 3FPT : 90 % pris en charge, acompte 70 %, solde 30 %', () => {
    render(<DialogOrganismes open onOpenChange={() => {}} />);
    expect(screen.getByDisplayValue('3FPT')).toBeInTheDocument();
    expect(screen.getByLabelText('Part prise en charge')).toHaveValue('90');
    expect(screen.getByLabelText('Pourcentage de Acompte')).toHaveValue('70');
    expect(screen.getByLabelText('Pourcentage de Solde')).toHaveValue('30');
    expect(screen.getByText(/L'apprenant en paie 10 % à la caisse/)).toBeInTheDocument();
  });

  it('des tranches qui ne font pas 100 % ne s\'enregistrent pas', async () => {
    render(<DialogOrganismes open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Pourcentage de Solde'), { target: { value: '20' } });
    expect(screen.getByText(/Total : 90 %/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Réglages incomplets' })));
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('enregistre les frais pris en charge et les pièces exigées', async () => {
    render(<DialogOrganismes open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cantine' }));
    fireEvent.change(screen.getByPlaceholderText(/Copie de la pièce/), { target: { value: 'Extrait de naissance' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/Copie de la pièce/), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() => expect(enregistrer).toHaveBeenCalledTimes(1));
    expect(enregistrer.mock.calls[0][0].financements.organismes[0]).toMatchObject({
      nom: '3FPT', partFinancee: 90, frais: { inscription: true, mensualites: true, services: ['cantine'] },
      pieces: [{ nom: 'Extrait de naissance' }],
    });
  });

  it('le personnel consulte sans pouvoir modifier', () => {
    role = 'staff';
    render(<DialogOrganismes open onOpenChange={() => {}} />);
    expect(screen.getByText('Seul le directeur peut modifier ces règles.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enregistrer/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Part prise en charge')).toBeDisabled();
  });
});
