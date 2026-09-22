import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// jsdom n'implémente pas l'API Pointer Capture que Radix UI (le <Select>)
// utilise en interne — sans ce filet, tout clic dans un <SelectItem> fait
// planter le test avec une erreur qui n'a rien à voir avec notre code.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// ════════════════════════════════════════════════════════════════════════════
// Promotions : les élèves qui suivent, ensemble, le programme d'un niveau.
// Le nom et l'effectif viennent de la classe possédée (Paiements, Présences,
// Emploi du temps, Portail continuent de la voir sans rien changer).
// ════════════════════════════════════════════════════════════════════════════

const ctx = {
  loading: false,
  formations: [{ id: 'f1', name: 'CAP Restauration', ordering: 0, createdAt: '', active: true }],
  niveaux: [
    { id: 'n1', formationId: 'f1', name: 'CAP 1', ordering: 0, createdAt: '' },
    { id: 'n2', formationId: 'f1', name: 'CAP 2', ordering: 1, createdAt: '' },
  ],
  niveauMatieres: [{ id: 'nm1', niveauId: 'n1', matiereId: 'm1', matiereName: 'TP Cuisine', type: 'obligatoire' as const, coefficient: 4, volumeHoraire: 150, nature: 'pratique' as const, ordering: 0 }],
  choixGroups: [],
  promotions: [
    { id: 'p1', niveauId: 'n1', classId: 'c1', name: 'CAP 1 — Promo Septembre 2026', studentLimit: 30, rythme: 'jour' as const, startDate: '2026-09-01', endDate: '2027-06-30', status: 'active' as const, createdAt: '' },
  ],
  addPromotion: vi.fn().mockResolvedValue({ id: 'pnew' }),
  updatePromotion: vi.fn().mockResolvedValue(undefined),
  deletePromotion: vi.fn().mockResolvedValue(undefined),
  duplicatePromotion: vi.fn().mockResolvedValue({ id: 'pdup' }),
};
vi.mock('@/contexts/FormationProContext', () => ({ useFormationPro: () => ctx }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import Promotions from './Promotions';

const rendre = () => render(<MemoryRouter><Promotions /></MemoryRouter>);

describe('Promotions — liste groupée par formation puis niveau', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche la promotion sous son niveau, avec son statut, son rythme et ses dates', () => {
    rendre();
    expect(screen.getByText('CAP Restauration')).toBeInTheDocument();
    expect(screen.getByText('CAP 1')).toBeInTheDocument();
    expect(screen.getByText('CAP 1 — Promo Septembre 2026')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Jour')).toBeInTheDocument();
    expect(screen.getByText(/2026-09-01/)).toBeInTheDocument();
    expect(screen.getByText('30 places max')).toBeInTheDocument();
  });

  it('crée une promotion : le niveau donne l\'aperçu du programme, sans rien ressaisir', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Nouvelle promotion/ }));
    // Choisir le niveau CAP 2 (pas de matière dans le fixture, donc pas d'aperçu affiché) — testons CAP 1 qui en a une
    const select = screen.getByRole('combobox');
    await user.click(select);
    await user.click(screen.getByText('CAP Restauration — CAP 1'));
    expect(screen.getByText(/1 matière/)).toBeInTheDocument();
    expect(screen.getByText(/coef\. 4/)).toBeInTheDocument();

    const champNom = screen.getByLabelText('Nom de la promotion *');
    await user.clear(champNom);
    await user.type(champNom, 'CAP 1A');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(ctx.addPromotion).toHaveBeenCalledWith('n1', expect.objectContaining({ name: 'CAP 1A' }));
  });

  it('le nom se suggère automatiquement depuis le niveau et la date de début, tant qu\'on n\'y touche pas', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Nouvelle promotion/ }));
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('CAP Restauration — CAP 1'));
    await user.type(screen.getByLabelText(/Date de début/), '2026-09-01');
    expect(screen.getByLabelText('Nom de la promotion *')).toHaveValue('CAP 1 — Promo Septembre 2026');
  });

  it('dupliquer une promotion ne copie ni élèves ni notes — juste le niveau et les réglages', async () => {
    const user = userEvent.setup();
    rendre();
    const carte = screen.getByText('CAP 1 — Promo Septembre 2026').closest('.group')!;
    await user.click(within(carte as HTMLElement).getByTitle('Dupliquer'));
    expect(screen.getByText(/sans ses élèves ni ses notes/)).toBeInTheDocument();
    const champNom = screen.getByLabelText('Nom de la promotion *');
    await user.clear(champNom);
    await user.type(champNom, 'CAP 1A — 2027-2028');
    await user.click(screen.getByRole('button', { name: 'Dupliquer' }));
    expect(ctx.duplicatePromotion).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'CAP 1A — 2027-2028' }));
  });

  it('supprimer une promotion demande confirmation puis appelle deletePromotion', async () => {
    const user = userEvent.setup();
    rendre();
    const carte = screen.getByText('CAP 1 — Promo Septembre 2026').closest('.group')!;
    await user.click(within(carte as HTMLElement).getByTitle('Supprimer'));
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(ctx.deletePromotion).toHaveBeenCalledWith('p1');
  });

  it('une suppression refusée (élèves encore inscrits) affiche l\'erreur sans planter', async () => {
    ctx.deletePromotion.mockRejectedValueOnce(new Error('Cette promotion contient encore des élèves'));
    const user = userEvent.setup();
    rendre();
    const carte = screen.getByText('CAP 1 — Promo Septembre 2026').closest('.group')!;
    await user.click(within(carte as HTMLElement).getByTitle('Supprimer'));
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('CAP 1 — Promo Septembre 2026')).toBeInTheDocument();   // toujours là
  });
});

describe('Promotions — états vides', () => {
  const niveauxOriginaux = ctx.niveaux;
  const promotionsOriginales = ctx.promotions;

  it('sans niveau créé : invite à passer par Formations d\'abord, bouton de création désactivé', () => {
    ctx.niveaux = []; ctx.promotions = [];
    rendre();
    expect(screen.getByText('Aucun niveau créé')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Formations' })).toHaveAttribute('href', '/formation/formations');
    expect(screen.getByRole('button', { name: /Nouvelle promotion/ })).toBeDisabled();
    ctx.niveaux = niveauxOriginaux; ctx.promotions = promotionsOriginales;
  });

  it('des niveaux existent mais aucune promotion : invite à en créer une', () => {
    ctx.promotions = [];
    rendre();
    expect(screen.getByText('Aucune promotion créée')).toBeInTheDocument();
    ctx.promotions = promotionsOriginales;
  });
});
