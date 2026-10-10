import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditeurModele } from './EditeurModele';
import { contexteExemple } from '@/lib/modelesDocuments';

const exemple = contexteExemple({ nom: 'Les Roses', ville: 'Thiès' }, '2026-2027');
const page = (corps: string) => `<!DOCTYPE html><html><head><title>Certificat</title></head><body>${corps}</body></html>`;

const ouvrir = (html = '', nom = '') => {
  const onEnregistrer = vi.fn().mockResolvedValue(undefined);
  const onFermer = vi.fn();
  render(
    <EditeurModele ouvert onFermer={onFermer} titre="Nouveau modèle" initial={{ nom, html }} exemple={exemple} onEnregistrer={onEnregistrer} />,
  );
  return { onEnregistrer, onFermer };
};

const bouton = () => screen.getByRole('button', { name: /Enregistrer le modèle/ });

describe('éditeur de modèle', () => {
  it('un champ inconnu de SenClass est affiché et empêche d\'enregistrer', async () => {
    ouvrir(page('<p>[NOM DE L\'ÉLÈVE] — [TÉLÉPHONE 2]</p>'), 'Certificat');
    expect(await screen.findByText(/Champs inconnus de SenClass/)).toBeInTheDocument();
    expect(screen.getByText('[TÉLÉPHONE 2]')).toBeInTheDocument();
    expect(bouton()).toBeDisabled();
  });

  it('corrigé (texte écrit en clair), le modèle s\'enregistre', async () => {
    const { onEnregistrer, onFermer } = ouvrir(page('<p>[NOM DE L\'ÉLÈVE] — [TÉLÉPHONE 2]</p>'), 'Certificat');
    fireEvent.change(screen.getByLabelText('HTML'), { target: { value: page('<p>[NOM DE L\'ÉLÈVE] — 77 111 22 33</p>') } });
    await waitFor(() => expect(bouton()).toBeEnabled());
    fireEvent.click(bouton());
    await waitFor(() => expect(onEnregistrer).toHaveBeenCalledWith('Certificat', page('<p>[NOM DE L\'ÉLÈVE] — 77 111 22 33</p>')));
    expect(onFermer).toHaveBeenCalled();
  });

  it('sans nom, impossible d\'enregistrer', async () => {
    ouvrir(page('<p>[CLASSE]</p>'), '');
    expect(await screen.findByText(/Modèle valide/)).toBeInTheDocument();
    expect(bouton()).toBeDisabled();
  });

  it('un fichier HTML importé remplit l\'éditeur, prend son <title> comme nom, et est vérifié', async () => {
    ouvrir();
    const fichier = new File([page('<p>[CLASSE] [INVENTÉ]</p>')], 'certificat.html', { type: 'text/html' });
    fireEvent.change(screen.getByTestId('fichier-modele'), { target: { files: [fichier] } });
    await waitFor(() => expect(screen.getByLabelText('Nom du modèle')).toHaveValue('Certificat'));
    expect(await screen.findByText('[INVENTÉ]')).toBeInTheDocument();
    expect(bouton()).toBeDisabled();
  });

  it('cliquer un champ de la liste l\'insère dans le HTML', async () => {
    ouvrir(page('<p></p>'), 'X');
    fireEvent.click(screen.getByRole('button', { name: '[MATRICULE]' }));
    expect((screen.getByLabelText('HTML') as HTMLTextAreaElement).value).toContain('[MATRICULE]');
  });
});
