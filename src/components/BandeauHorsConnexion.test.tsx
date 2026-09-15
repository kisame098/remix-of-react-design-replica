import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BandeauHorsConnexion } from './BandeauHorsConnexion';
import { EcranHorsConnexion } from './EcranHorsConnexion';

// ════════════════════════════════════════════════════════════════════════════
// HORS CONNEXION : l'application s'ouvre sans réseau, mais rien ne
// s'enregistre. L'utilisateur doit le savoir AVANT de remplir un formulaire.
// ════════════════════════════════════════════════════════════════════════════

let enLigne = true;
Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => enLigne });

const basculer = (valeur: boolean) => act(() => {
  enLigne = valeur;
  window.dispatchEvent(new Event(valeur ? 'online' : 'offline'));
});

afterEach(() => { enLigne = true; });

describe('BandeauHorsConnexion', () => {
  it('reste invisible tant que le réseau est là', () => {
    const { container } = render(<BandeauHorsConnexion />);
    expect(container).toBeEmptyDOMElement();
  });

  it('s\'affiche dès que le réseau tombe', () => {
    enLigne = false;
    render(<BandeauHorsConnexion />);
    expect(screen.getByRole('status')).toHaveTextContent('Hors connexion');
  });

  it('prévient que RIEN ne sera enregistré', () => {
    enLigne = false;
    render(<BandeauHorsConnexion />);
    expect(screen.getByRole('status')).toHaveTextContent(/ne peuvent pas être enregistrées/);
  });

  it('suit la connexion EN DIRECT, sans recharger la page', () => {
    render(<BandeauHorsConnexion />);
    expect(screen.queryByRole('status')).toBeNull();

    basculer(false);
    expect(screen.getByRole('status')).toBeInTheDocument();

    basculer(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ne s\'imprime pas sur les bulletins et cartes', () => {
    enLigne = false;
    render(<BandeauHorsConnexion />);
    expect(screen.getByRole('status').className).toContain('print:hidden');
  });
});

describe('EcranHorsConnexion', () => {
  it('dit ce qui se passe au lieu de faire tourner une roue', () => {
    render(<EcranHorsConnexion />);
    expect(screen.getByRole('heading')).toHaveTextContent('Vous êtes hors connexion');
  });

  it('annonce la reprise automatique et propose de réessayer', () => {
    render(<EcranHorsConnexion />);
    expect(screen.getByText(/reprendra toute seule/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réessayer/ })).toBeInTheDocument();
  });
});
