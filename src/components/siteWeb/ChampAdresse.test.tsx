import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const verifierAdresse = vi.fn();
vi.mock('@/lib/siteWeb', () => ({ verifierAdresse: (a: string) => verifierAdresse(a) }));

import { ChampAdresse } from './ChampAdresse';

describe('ChampAdresse — choisir <adresse>.senclass.com', () => {
  it('propose l\'adresse suggérée et la dit disponible après vérification par le serveur', async () => {
    verifierAdresse.mockResolvedValue('libre');
    const onChange = vi.fn();
    render(<ChampAdresse actuelle={null} suggestion="groupe-scolaire-excellence" onChange={onChange} />);
    expect(screen.getByRole('textbox')).toHaveValue('groupe-scolaire-excellence');
    expect(await screen.findByText('Disponible')).toBeInTheDocument();
    expect(verifierAdresse).toHaveBeenCalledWith('groupe-scolaire-excellence');
    expect(onChange).toHaveBeenLastCalledWith('groupe-scolaire-excellence', true);
  });

  it('nettoie la frappe et refuse une adresse déjà prise : la publication reste bloquée', async () => {
    verifierAdresse.mockReset();
    verifierAdresse.mockImplementation(async (a: string) => (a === 'gs-excellence' ? 'prise' : 'libre'));
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ChampAdresse actuelle={null} suggestion="x-ecole" onChange={onChange} />);
    const champ = screen.getByRole('textbox');
    await user.clear(champ);
    await user.type(champ, 'GS Excellence');
    expect(champ).toHaveValue('gs-excellence');
    expect(await screen.findByText(/Déjà prise par une autre école/)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith('gs-excellence', false);
  });

  it('refuse une adresse réservée sans même interroger le serveur', async () => {
    verifierAdresse.mockReset();
    render(<ChampAdresse actuelle={null} suggestion="admin" onChange={vi.fn()} />);
    expect(await screen.findByText(/Réservée à SenClass/)).toBeInTheDocument();
    expect(verifierAdresse).not.toHaveBeenCalled();
  });

  it('changer une adresse déjà publiée prévient que l\'ancienne ne fonctionnera plus', async () => {
    verifierAdresse.mockReset();
    verifierAdresse.mockResolvedValue('libre');
    const user = userEvent.setup();
    render(<ChampAdresse actuelle="ancienne-adresse" suggestion="ancienne-adresse" onChange={vi.fn()} />);
    const champ = screen.getByRole('textbox');
    await user.clear(champ);
    await user.type(champ, 'nouvelle');
    expect(await screen.findByText(/ancienne-adresse\.senclass\.com/)).toBeInTheDocument();
  });
});
