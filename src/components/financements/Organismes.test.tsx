import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ════════════════════════════════════════════════════════════════════════════
// Financements : Paramètres ne porte que l'interrupteur ; un organisme se crée
// et se modifie dans le module, un à la fois. Activer propose le 3FPT de la
// demande (90 %, 70/30), tout se modifie, rien d'incohérent ne s'enregistre.
// ════════════════════════════════════════════════════════════════════════════

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
const enregistrer = vi.fn().mockResolvedValue(undefined);
let settings: Record<string, unknown> = {};
let role = 'admin';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ school: { settings }, accountRole: role, updateSchoolSettings: enregistrer }) }));
vi.mock('@/contexts/PaymentContext', () => ({ usePayment: () => ({ annexServices: [{ id: 'cantine', name: 'Cantine' }] }) }));

import { ActivationFinancements, DialogOrganisme } from './Organismes';
import { lireReglagesFinancements, organisme3FPT } from '@/lib/financements';

const fpt = () => lireReglagesFinancements(settings).organismes[0];

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

describe('Financements → un organisme', () => {
  it('montre les règles du 3FPT : 90 % pris en charge, acompte 70 %, solde 30 %', () => {
    render(<DialogOrganisme open organisme={fpt()} onOpenChange={() => {}} />);
    expect(screen.getByDisplayValue('3FPT')).toBeInTheDocument();
    expect(screen.getByLabelText('Part prise en charge')).toHaveValue('90');
    expect(screen.getByLabelText('Pourcentage de Acompte')).toHaveValue('70');
    expect(screen.getByLabelText('Pourcentage de Solde')).toHaveValue('30');
    expect(screen.getByText(/l'apprenant en paie 10 % à la caisse/)).toBeInTheDocument();
  });

  it('des tranches qui ne font pas 100 % ne s\'enregistrent pas', async () => {
    render(<DialogOrganisme open organisme={fpt()} onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Pourcentage de Solde'), { target: { value: '20' } });
    expect(screen.getByText(/Total : 90 %/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Organisme incomplet' })));
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('modifier enregistre les frais pris en charge et les pièces exigées, sans toucher aux autres organismes', async () => {
    settings = { financements: { actif: true, organismes: [{ ...organisme3FPT(), id: 'fpt' }, { ...organisme3FPT(), id: 'onfp', nom: 'ONFP' }] } };
    render(<DialogOrganisme open organisme={fpt()} onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cantine' }));
    fireEvent.change(screen.getByPlaceholderText(/Copie de la pièce/), { target: { value: 'Extrait de naissance' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/Copie de la pièce/), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));
    await waitFor(() => expect(enregistrer).toHaveBeenCalledTimes(1));
    const { organismes } = enregistrer.mock.calls[0][0].financements;
    expect(organismes).toHaveLength(2);
    expect(organismes[0]).toMatchObject({
      nom: '3FPT', partFinancee: 90, frais: { inscription: true, mensualites: true, services: ['cantine'] },
      pieces: [{ nom: 'Extrait de naissance' }],
    });
    expect(organismes[1]).toMatchObject({ id: 'onfp', nom: 'ONFP' });
  });

  it('créer ajoute un nouvel organisme à la liste ; un nom déjà pris est refusé', async () => {
    const { unmount } = render(<DialogOrganisme open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: '3fpt' } });
    fireEvent.click(screen.getByRole('button', { name: /Créer/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nom déjà pris' })));
    unmount();
    render(<DialogOrganisme open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'ONFP' } });
    fireEvent.click(screen.getByRole('button', { name: /Créer/ }));
    await waitFor(() => expect(enregistrer).toHaveBeenCalledTimes(1));
    expect(enregistrer.mock.calls[0][0].financements.organismes.map((o: { nom: string }) => o.nom)).toEqual(['3FPT', 'ONFP']);
  });

  it('le personnel consulte sans pouvoir modifier', () => {
    role = 'staff';
    render(<DialogOrganisme open organisme={fpt()} onOpenChange={() => {}} />);
    expect(screen.getByText('Seul le directeur peut modifier ces règles.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enregistrer/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Part prise en charge')).toBeDisabled();
  });
});
