import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ toast: (...a: unknown[]) => toast(...a) }));

import { SuppressionEcoleDialog } from './SuppressionEcoleDialog';

const APERCU = { eleves: 12, professeurs: 3, classes: 4, paiements: 80, recus: 8, bulletins: 0, comptes: 20, compte_chef_conserve: false };
const ecole = { id: 'school-1', name: 'Collège Sainte-Anne' };

const ouvrir = () => {
  const onFermer = vi.fn(); const onSupprimee = vi.fn();
  render(<SuppressionEcoleDialog ecole={ecole} onFermer={onFermer} onSupprimee={onSupprimee} />);
  return { onFermer, onSupprimee };
};

describe('SuppressionEcoleDialog — trois confirmations', () => {
  beforeEach(() => {
    rpc.mockReset(); toast.mockReset();
    rpc.mockImplementation(async (fn: string) =>
      fn === 'platform_school_deletion_preview' ? { data: APERCU, error: null } : { data: {}, error: null });
  });

  it('ne supprime qu\'après les trois étapes, avec le nom et le mot envoyés au serveur', async () => {
    const user = userEvent.setup();
    const { onSupprimee } = ouvrir();

    expect(await screen.findByText('12')).toBeInTheDocument();          // aperçu affiché
    const continuer = screen.getByRole('button', { name: 'Continuer' });
    expect(continuer).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(continuer);

    // étape 2 : « supprimer » en minuscules ne passe pas
    const mot = screen.getByLabelText(/Tapez/);
    await user.type(mot, 'supprimer');
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
    await user.clear(mot);
    await user.type(mot, 'SUPPRIMER');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    // étape 3 : mauvais nom refusé, bon nom accepté
    const nom = screen.getByLabelText(/Retapez le nom/);
    const final = screen.getByRole('button', { name: /Supprimer définitivement/ });
    await user.type(nom, 'college sainte-anne');
    expect(final).toBeDisabled();
    await user.clear(nom);
    await user.type(nom, 'Collège Sainte-Anne');
    expect(final).toBeEnabled();
    expect(rpc).not.toHaveBeenCalledWith('platform_delete_school', expect.anything());

    await user.click(final);
    await waitFor(() => expect(onSupprimee).toHaveBeenCalledWith('school-1'));
    expect(rpc).toHaveBeenCalledWith('platform_delete_school', {
      p_school_id: 'school-1', p_confirm_name: 'Collège Sainte-Anne', p_confirm_word: 'SUPPRIMER',
    });
  });

  it('un échec du serveur ne retire pas l\'école et le dit', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'platform_school_deletion_preview'
        ? { data: APERCU, error: null }
        : { data: null, error: { message: 'boom réseau' } });
    const user = userEvent.setup();
    const { onSupprimee } = ouvrir();
    await screen.findByText('12');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.type(screen.getByLabelText(/Tapez/), 'SUPPRIMER');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.type(screen.getByLabelText(/Retapez le nom/), 'Collège Sainte-Anne');
    await user.click(screen.getByRole('button', { name: /Supprimer définitivement/ }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(onSupprimee).not.toHaveBeenCalled();
  });

  it('« Annuler » ferme sans rien supprimer', async () => {
    const user = userEvent.setup();
    const { onFermer, onSupprimee } = ouvrir();
    await screen.findByText('12');
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onFermer).toHaveBeenCalled();
    expect(onSupprimee).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith('platform_delete_school', expect.anything());
  });
});
