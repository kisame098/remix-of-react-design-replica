import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const auth = vi.hoisted(() => ({
  user: { id: 'u1', user_metadata: {} as Record<string, unknown> }, school: { id: 's', name: 'École Test', beta_testeur: true },
  accountRole: 'admin', staffPermissions: [] as string[],
}));
const updateUser = vi.hoisted(() => vi.fn(() => Promise.resolve({})));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { updateUser } } }));

import Guide from './Guide';
import { ouvrirGuide, signalerGuide } from '@/lib/signauxGuide';

const CLE = 'senclass:guide:u1';
const enregistre = () => JSON.parse(localStorage.getItem(CLE) ?? '{}');
const commencerA = (chapitre: string, etape: string) =>
  localStorage.setItem(CLE, JSON.stringify({ choix: 'accepte', actif: true, chapitre, etape, termines: [], maj: 5 }));

// Un écran de classes comme le vrai : menu, bouton, fenêtre, champs.
const Ecran = () => {
  const navigate = useNavigate();
  const [nom, setNom] = useState('');
  return (
    <>
      <button data-guide="menu:/classes" onClick={() => navigate('/classes')}>Gestion Classe</button>
      <Routes>
        <Route path="/classes" element={
          <Dialog>
            <DialogTrigger asChild><button data-guide="classe:nouvelle">Nouvelle Classe</button></DialogTrigger>
            <DialogContent aria-describedby={undefined}>
              <DialogTitle>Créer</DialogTitle>
              <div data-guide="classe:nom"><input aria-label="nom" value={nom} onChange={e => setNom(e.target.value)} /></div>
              <div data-guide="classe:limite"><input aria-label="limite" defaultValue="30" /></div>
              <button data-guide="classe:creer" onClick={() => signalerGuide('classe-creee')}>Créer la classe</button>
            </DialogContent>
          </Dialog>
        } />
        <Route path="*" element={<p>Ailleurs</p>} />
      </Routes>
    </>
  );
};
const monter = (depart = '/dashboard') => render(<MemoryRouter initialEntries={[depart]}><Ecran /><Guide /></MemoryRouter>);

beforeEach(() => {
  // jsdom ne dessine rien : tout élément présent est considéré visible.
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  Element.prototype.scrollIntoView = vi.fn();
  auth.user = { id: 'u1', user_metadata: {} };
  updateUser.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe('la proposition de départ', () => {
  it('« Oui » lance le premier chapitre ; la réponse est gardée dans le compte', async () => {
    monter();
    await userEvent.click(await screen.findByRole('button', { name: /Oui, guidez-moi/ }));
    expect(await screen.findByText('Voici votre tableau de bord')).toBeInTheDocument();
    expect(enregistre()).toMatchObject({ choix: 'accepte', actif: true, chapitre: 'reperes' });
    expect(updateUser).toHaveBeenCalledWith({ data: { guide: expect.objectContaining({ choix: 'accepte' }) } });
  });
  it('« Non » : plus jamais proposé, mais toujours disponible', async () => {
    const { unmount } = monter();
    await userEvent.click(await screen.findByRole('button', { name: /Non merci/ }));
    unmount();
    monter();
    expect(screen.queryByText('Voulez-vous être guidé ?')).not.toBeInTheDocument();
    act(() => ouvrirGuide());
    expect(await screen.findByText('Apprendre SenClass')).toBeInTheDocument();
    expect(screen.getByText(/1\. Premiers repères/)).toBeInTheDocument();
  });
  it('répondu sur un autre ordinateur : pas reproposé ici', () => {
    auth.user = { id: 'u1', user_metadata: { guide: { choix: 'refuse', actif: false, termines: [], maj: 10 } } };
    monter();
    expect(screen.queryByText('Voulez-vous être guidé ?')).not.toBeInTheDocument();
  });
});

describe('à faire ou à lire : cela se voit', () => {
  it('à lire : ni étiquette ni bloc bleu, un bouton « J\'ai compris »', async () => {
    commencerA('classes', 'cla-liste');
    monter('/classes');
    expect(await screen.findByText('Terminer')).toBeInTheDocument();
    expect(screen.queryByText('À vous de le faire')).not.toBeInTheDocument();
    expect(screen.queryByText('Cliquez ici')).not.toBeInTheDocument();
  });
  it('cliquer à côté fait insister, sans bloquer le clic', async () => {
    commencerA('classes', 'cla-nouvelle');
    monter('/classes');
    const etiquette = await screen.findByText('Cliquez ici');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 500, top: 300, right: 600, bottom: 340, width: 100, height: 40, x: 500, y: 300, toJSON() {} });
    await waitFor(() => expect(etiquette.closest('.fixed')).toHaveStyle({ left: '550px' }));
    await userEvent.click(screen.getByText('Gestion Classe'));
    await waitFor(() => expect(screen.getByText('Cliquez ici').className).toContain('guide-secousse'));
  });
});

describe('déjà fait', () => {
  it('une étape dont le résultat existe déjà est sautée toute seule', async () => {
    localStorage.setItem(CLE, JSON.stringify({ choix: 'accepte', actif: true, chapitre: 'evaluations', etape: 'eva-periode', termines: [], maj: 5 }));
    const avant = auth.school;
    auth.school = { ...avant, management_mode: 'formation_pro' } as typeof auth.school;
    render(<MemoryRouter initialEntries={['/formation/evaluations/p1']}>
      <Routes><Route path="*" element={<div data-guide="evaluations:periodes">Semestre 1</div>} /></Routes><Guide />
    </MemoryRouter>);
    await waitFor(() => expect(enregistre().etape).toBe('eva-periodes'));
    auth.school = avant;
  });
});

describe('la personne pratique, le guide suit', () => {
  it('menu → fenêtre → champ → création, sans jamais agir à sa place', async () => {
    commencerA('classes', 'cla-ouvrir');
    monter();
    expect(await screen.findByText('Ouvrez « Gestion Classe »')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Gestion Classe'));
    expect(await screen.findByText('Cliquez sur « Nouvelle Classe »')).toBeInTheDocument();
    expect(screen.queryByLabelText('nom')).not.toBeInTheDocument();   // rien ne s'ouvre tout seul
    expect(screen.getByText('Cliquez ici')).toBeInTheDocument();
    expect(screen.getByText('À vous de le faire')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Nouvelle Classe'));
    expect(await screen.findByText('Le nom de la classe')).toBeInTheDocument();
    // Tant que c'est vide : l'ordre est sur le champ, et aucun bouton pour continuer.
    expect(await screen.findByText('Écrivez ici')).toBeInTheDocument();
    expect(screen.getByText('Écrivez : Nom de la classe')).toBeInTheDocument();
    expect(screen.queryByText('Continuer')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('nom'), '6ème A');
    const continuer = async () => (await screen.findByText('Continuer')).closest('button')!;
    expect(await continuer()).toBeEnabled();
    await waitFor(() => expect(screen.queryByText('Écrivez ici')).not.toBeInTheDocument());

    // Cliquer dans la bulle ne referme pas la fenêtre qu'elle explique.
    await userEvent.click(await continuer(), { pointerEventsCheck: 0 });
    expect(await screen.findByText('La limite d\'élèves')).toBeInTheDocument();
    expect(screen.getByLabelText('nom')).toHaveValue('6ème A');

    // Plus rapide que le guide : il reprend après l'enregistrement.
    await userEvent.click(screen.getByText('Créer la classe'));
    expect(await screen.findByText('Bravo, c\'est enregistré !')).toBeInTheDocument();
    expect(await screen.findByText('Vos classes', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(enregistre().etape).toBe('cla-liste');
  });

  it('fenêtre refermée en route : on revient à l\'étape qui l\'ouvre', async () => {
    commencerA('classes', 'cla-nom');
    monter('/classes');
    expect(await screen.findByText('Cliquez sur « Nouvelle Classe »', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('sur une autre page : propose d\'y retourner', async () => {
    commencerA('classes', 'cla-nouvelle');
    monter('/dashboard');
    await userEvent.click(await screen.findByText('Y retourner'));
    expect(await screen.findByText('Nouvelle Classe')).toBeInTheDocument();
  });

  it('un signal attendu nulle part ne fait rien', async () => {
    commencerA('classes', 'cla-nouvelle');
    monter('/classes');
    await screen.findByText('Cliquez sur « Nouvelle Classe »');
    act(() => signalerGuide('prof-inscrit'));
    expect(screen.queryByText('Bravo, c\'est enregistré !')).not.toBeInTheDocument();
    expect(enregistre().etape).toBe('cla-nouvelle');
  });

  it('fin de chapitre : marqué terminé, la suite est proposée', async () => {
    commencerA('classes', 'cla-liste');
    monter('/classes');
    await userEvent.click(await screen.findByText('Terminer'));
    expect(await screen.findByText('Chapitre terminé !')).toBeInTheDocument();
    expect(enregistre()).toMatchObject({ termines: ['classes'], actif: false });
    expect(screen.getByText(/La suite : « Inscrire un élève »/)).toBeInTheDocument();
  });

  it('pause : la bulle disparaît, l\'étape est retenue', async () => {
    commencerA('classes', 'cla-nouvelle');
    monter('/classes');
    await userEvent.click(await screen.findByLabelText('Mettre le guide en pause'));
    expect(screen.queryByLabelText('Guide SenClass')).not.toBeInTheDocument();
    expect(enregistre()).toMatchObject({ actif: false, chapitre: 'classes', etape: 'cla-nouvelle' });
  });
});
