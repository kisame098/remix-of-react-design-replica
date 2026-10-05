import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BandeauAbonnement } from './BandeauAbonnement';

const session = vi.hoisted(() => ({ school: {} as Record<string, unknown>, accountRole: 'admin' as string }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => session }));

const H = 3_600_000;
const rendre = () => render(<MemoryRouter><BandeauAbonnement /></MemoryRouter>);
const ecole = (statut: string, dansMs: number) => {
  session.school = { subscription_status: statut, subscription_expires_at: new Date(Date.now() + dansMs).toISOString() };
};

afterEach(() => sessionStorage.clear());

describe('bandeau de fin d\'essai / d\'abonnement', () => {
  it('directeur en essai : date, heure, temps restant et bouton pour payer', () => {
    session.accountRole = 'admin';
    ecole('trial', 3 * 24 * H + 2 * H + 60_000);
    rendre();
    expect(screen.getByText(/Votre période d'essai se termine le .+ à \d{2}:\d{2} — dans 3 jours et 2 h/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choisir un abonnement' })).toHaveAttribute('href', '/abonnement');
  });

  it('personnel : invité à prévenir la direction, sans bouton de paiement', () => {
    session.accountRole = 'staff';
    ecole('active', 2 * 24 * H);
    rendre();
    expect(screen.getByText(/Votre abonnement se termine/)).toBeInTheDocument();
    expect(screen.getByText(/Prévenez la direction/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('masquable tant qu\'il reste plus de 24 h', () => {
    session.accountRole = 'admin';
    ecole('trial', 3 * 24 * H);
    rendre();
    fireEvent.click(screen.getByRole('button', { name: /Masquer/ }));
    expect(screen.queryByText(/période d'essai/)).toBeNull();
  });

  it('dernières 24 h : urgent, et plus de bouton pour masquer', () => {
    session.accountRole = 'admin';
    ecole('trial', 5 * H);
    rendre();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Masquer/ })).toBeNull();
  });

  it('abonnement loin de son échéance : rien', () => {
    ecole('active', 30 * 24 * H);
    const { container } = rendre();
    expect(container).toBeEmptyDOMElement();
  });
});
