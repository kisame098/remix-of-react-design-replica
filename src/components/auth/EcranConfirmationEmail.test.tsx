import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EcranConfirmationEmail } from './EcranConfirmationEmail';

const monter = (surcharge: Partial<Parameters<typeof EcranConfirmationEmail>[0]> = {}) => {
  const props = {
    email: 'directeur@ecole.sn',
    envoiEnCours: false,
    onRenvoyer: vi.fn(),
    onRetour: vi.fn(),
    ...surcharge,
  };
  render(<MemoryRouter><EcranConfirmationEmail {...props} /></MemoryRouter>);
  return props;
};

describe('écran « Vérifiez votre boîte mail »', () => {
  it('rappelle l\'adresse exacte où le lien a été envoyé', () => {
    monter({ email: 'awa@ecole.sn' });
    expect(screen.getByText('awa@ecole.sn')).toBeInTheDocument();
  });

  it('dit que l\'inscription a bien abouti — personne ne doit croire à un échec', () => {
    monter();
    expect(screen.getByRole('heading')).toHaveTextContent('Vérifiez votre boîte mail');
    expect(screen.getByText(/Votre école est enregistrée/)).toBeInTheDocument();
  });

  it('pense aux spams et propose de renvoyer l\'e-mail', () => {
    const props = monter();
    expect(screen.getByText(/spams/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Renvoyer/ }));
    expect(props.onRenvoyer).toHaveBeenCalledTimes(1);
  });

  it('empêche le double envoi pendant que l\'e-mail part', () => {
    const props = monter({ envoiEnCours: true });
    const bouton = screen.getByRole('button', { name: /Renvoyer/ });
    expect(bouton).toBeDisabled();
    fireEvent.click(bouton);
    expect(props.onRenvoyer).not.toHaveBeenCalled();
  });

  it('laisse toujours une porte de sortie vers la connexion', () => {
    const props = monter();
    fireEvent.click(screen.getByRole('button', { name: 'Retour à la connexion' }));
    expect(props.onRetour).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Garde-fou de branchement : l'écran ne sert à rien s'il n'est pas relié à
// l'inscription. Ces vérifications lisent la page d'inscription plutôt que de
// simuler tout Supabase.
// ════════════════════════════════════════════════════════════════════════════
describe('branchement dans la page d\'inscription', () => {
  const auth = readFileSync(join(process.cwd(), 'src/pages/Auth.tsx'), 'utf8');

  it('la page affiche cet écran quand Supabase attend une confirmation', () => {
    expect(auth).toContain('confirmationRequise');
    expect(auth).toContain('<EcranConfirmationEmail');
  });

  it('elle sait renvoyer l\'e-mail de confirmation', () => {
    expect(auth).toMatch(/auth\.resend\(/);
  });

  it('plus de message « Vérifiez votre email » affiché à tort', () => {
    // L'ancien texte s'affichait même quand aucun e-mail n'était envoyé.
    expect(auth).not.toContain('Vérifiez votre email pour confirmer votre compte.');
  });

  it('une connexion refusée pour e-mail non confirmé mène au même écran', () => {
    expect(auth).toMatch(/Email not confirmed[\s\S]{0,400}setEmailAConfirmer/);
  });
});
