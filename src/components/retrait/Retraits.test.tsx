import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BoutonRetirer, ListeRetires } from './Retraits';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe('Retirer un élève ou un professeur', () => {
  it('rien ne se passe sans confirmation, puis retire après « Retirer »', async () => {
    const onRetirer = vi.fn().mockResolvedValue(undefined);
    const onFait = vi.fn();
    render(<BoutonRetirer genre="eleve" nom="Awa Diop" onRetirer={onRetirer} onFait={onFait} />);
    fireEvent.click(screen.getByRole('button', { name: /Retirer de l'école/ }));
    expect(onRetirer).not.toHaveBeenCalled();
    expect(screen.getByText(/Rien n'est effacé/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Retirer$/ }));
    await waitFor(() => expect(onRetirer).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onFait).toHaveBeenCalled());
  });

  it('la liste des retirés n’apparaît que s’il y en a, et réintègre', async () => {
    const onReintegrer = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<ListeRetires genre="prof" personnes={[]} onReintegrer={onReintegrer} />);
    expect(screen.queryByRole('button', { name: /Retirés/ })).toBeNull();
    rerender(<ListeRetires genre="prof" personnes={[{ id: 'e1', nom: 'Moussa Fall', identifiant: 'PROF-2026-00001' }]} onReintegrer={onReintegrer} />);
    fireEvent.click(screen.getByRole('button', { name: /Retirés \(1\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /Réintégrer/ }));
    await waitFor(() => expect(onReintegrer).toHaveBeenCalledWith('e1'));
  });
});
