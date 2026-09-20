import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type jsPDF from 'jspdf';

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));
const imprimerPdf = vi.fn();
const telechargerPdf = vi.fn();
vi.mock('@/lib/documentsEcole', () => ({
  imprimerPdf: (...a: unknown[]) => imprimerPdf(...a),
  telechargerPdf: (...a: unknown[]) => telechargerPdf(...a),
}));

import { DocumentDialog } from './DocumentDialog';

const fauxPdf = () => ({ output: vi.fn().mockReturnValue('blob:pdf-1') }) as unknown as jsPDF;

beforeEach(() => { toast.mockReset(); imprimerPdf.mockReset(); telechargerPdf.mockReset(); });

const monter = (generer: () => Promise<jsPDF>, ouvert = true) =>
  render(<DocumentDialog ouvert={ouvert} onFermer={vi.fn()} titre="Reçu REC-2026-00001" nomFichier="Recu_1" generer={generer} />);

describe('DocumentDialog', () => {
  it('ne fabrique RIEN tant qu\'il est fermé (jsPDF pèse lourd)', () => {
    const generer = vi.fn();
    monter(generer, false);
    expect(generer).not.toHaveBeenCalled();
  });

  it('fabrique le document à l\'ouverture, puis active Imprimer et Télécharger', async () => {
    monter(() => Promise.resolve(fauxPdf()));
    const imprimer = screen.getByRole('button', { name: /Imprimer/ });
    expect(imprimer).toBeDisabled();                       // pas prêt : pas de clic dans le vide
    await waitFor(() => expect(imprimer).toBeEnabled());
    expect(screen.getByRole('button', { name: /Télécharger/ })).toBeEnabled();
  });

  it('Imprimer ouvre l\'impression', async () => {
    imprimerPdf.mockReturnValue(true);
    monter(() => Promise.resolve(fauxPdf()));
    await waitFor(() => expect(screen.getByRole('button', { name: /Imprimer/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Imprimer/ }));
    expect(imprimerPdf).toHaveBeenCalledTimes(1);
    expect(telechargerPdf).not.toHaveBeenCalled();
  });

  it('fenêtre bloquée par le navigateur : télécharge à la place, et prévient', async () => {
    imprimerPdf.mockReturnValue(false);
    monter(() => Promise.resolve(fauxPdf()));
    await waitFor(() => expect(screen.getByRole('button', { name: /Imprimer/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Imprimer/ }));
    expect(telechargerPdf).toHaveBeenCalledWith(expect.anything(), 'Recu_1');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Impression bloquée' }));
  });

  it('Télécharger enregistre le PDF sous le nom donné', async () => {
    monter(() => Promise.resolve(fauxPdf()));
    await waitFor(() => expect(screen.getByRole('button', { name: /Télécharger/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Télécharger/ }));
    expect(telechargerPdf).toHaveBeenCalledWith(expect.anything(), 'Recu_1');
  });

  it('échec de fabrication : le dit, et laisse les boutons inactifs', async () => {
    monter(() => Promise.reject(new Error('boum')));
    expect(await screen.findByRole('alert')).toHaveTextContent('n\'a pas pu être généré');
    expect(screen.getByRole('button', { name: /Imprimer/ })).toBeDisabled();
  });

  it('NOUVELLE VERSION installée pendant que la page restait ouverte : l\'explique, sans recharger d\'office', async () => {
    const recharger = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload: recharger } });

    monter(() => Promise.reject(new Error('Failed to fetch dynamically imported module: https://senclass.com/assets/recuPdf-old.js')));

    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent('nouvelle version');
    expect(alerte).toHaveTextContent('Terminez et enregistrez');
    // Rien ne se recharge tout seul : le travail en cours est préservé.
    expect(recharger).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Recharger la page/ }));
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('une autre erreur reste un simple « réessayez », sans proposer de recharger', async () => {
    monter(() => Promise.reject(new Error('boum')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Réessayez');
    expect(screen.queryByRole('button', { name: /Recharger la page/ })).toBeNull();
  });

  it('Fermer est toujours possible, même pendant la fabrication', () => {
    monter(() => new Promise(() => undefined));
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeEnabled();
  });
});
