import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditeurVisuel } from './EditeurVisuel';
import { documentVierge, nouvelElement, type DocumentVisuel, type ElementTexte } from '@/lib/documentVisuel';
import { contexteExemple } from '@/lib/modelesDocuments';
import { MODELES_PAR_DEFAUT } from '@/lib/modelesDocumentsParDefaut';

const exemple = contexteExemple({ nom: 'Les Roses' }, '2026-2027');

const ouvrir = (contenu: DocumentVisuel, nom = 'Certificat') => {
  const onEnregistrer = vi.fn().mockResolvedValue(undefined);
  const onFermer = vi.fn();
  render(<EditeurVisuel ouvert onFermer={onFermer} initial={{ nom, contenu }} exemple={exemple} onEnregistrer={onEnregistrer} />);
  return { onEnregistrer, onFermer };
};

const bouton = (nom: string) => screen.getByRole('button', { name: nom });
const elements = () => Array.from(screen.getByTestId('feuille').querySelectorAll('[data-element]'));

describe('éditeur visuel', () => {
  it('ouvre un modèle fourni : ses éléments sont sur la feuille, le document est valide', () => {
    ouvrir(structuredClone(MODELES_PAR_DEFAUT[0].contenu));
    expect(elements().length).toBe(MODELES_PAR_DEFAUT[0].contenu.elements.length);
    expect(screen.getByText('Document valide')).toBeInTheDocument();
    expect(bouton('Enregistrer')).toBeEnabled();
  });

  it('un champ inconnu dans un texte bloque l\'enregistrement et est nommé', () => {
    const doc = documentVierge();
    doc.elements = [{ ...nouvelElement('texte', 'portrait'), html: 'Tél. {TÉLÉPHONE 2}' } as ElementTexte];
    ouvrir(doc);
    expect(screen.getByText(/Champs inconnus de SenClass/)).toBeInTheDocument();
    expect(screen.getByText('{TÉLÉPHONE 2}')).toBeInTheDocument();
    expect(bouton('Enregistrer')).toBeDisabled();
  });

  it('ajouter un rectangle, annuler, rétablir, puis enregistrer : le document enregistré contient le rectangle', async () => {
    const { onEnregistrer } = ouvrir(documentVierge());
    fireEvent.click(bouton('Rectangle'));
    expect(elements()).toHaveLength(1);
    fireEvent.click(bouton('Annuler'));
    expect(elements()).toHaveLength(0);
    fireEvent.click(bouton('Rétablir'));
    expect(elements()).toHaveLength(1);
    fireEvent.click(bouton('Enregistrer'));
    await waitFor(() => expect(onEnregistrer).toHaveBeenCalled());
    const [nom, contenu] = onEnregistrer.mock.calls[0];
    expect(nom).toBe('Certificat');
    expect(contenu.elements).toMatchObject([{ type: 'forme', forme: 'rectangle' }]);
  });

  it('Suppr efface l\'élément choisi ; le panneau montre ses dimensions', () => {
    ouvrir(documentVierge());
    fireEvent.click(bouton('Trait'));
    expect(screen.getByLabelText('Largeur (mm)')).toHaveValue(120);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(elements()).toHaveLength(0);
  });

  it('sans nom, impossible d\'enregistrer ; fermer après une modification demande confirmation', () => {
    const { onFermer } = ouvrir(documentVierge(), '');
    expect(bouton('Enregistrer')).toBeDisabled();
    fireEvent.click(bouton('Cercle'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Fermer sans enregistrer ?')).toBeInTheDocument();
    expect(onFermer).not.toHaveBeenCalled();
  });
});
