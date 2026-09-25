import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formuleAppliquee, type BaremeCategorie } from '@/lib/formationPro';

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

// ════════════════════════════════════════════════════════════════════════════
// « Préparer les bulletins » : le logiciel dit ce qui n'a pas été fait (son
// poids est réparti) et l'école peut écarter une partie ; le bulletin sort.
// ════════════════════════════════════════════════════════════════════════════

const cats: BaremeCategorie[] = [
  { id: 'cc', formationId: 'f', name: 'Contrôle continu', pourcentage: 30, ordering: 0 },
  { id: 'tp', formationId: 'f', name: 'TP', pourcentage: 30, ordering: 1 },
  { id: 'eb', formationId: 'f', name: 'Examen blanc', pourcentage: 10, ordering: 2, sourceExamen: 'blanc' },
  { id: 'ef', formationId: 'f', name: 'Examen final', pourcentage: 30, ordering: 3, sourceExamen: 'officiel' },
];
// Ce semestre : contrôle continu, TP et examen final faits ; pas d'examen blanc.
const faites = [{ categorieId: 'cc' }, { categorieId: 'cc' }, { categorieId: 'tp' }, { categorieId: 'ef' }];
const bulletins = vi.fn().mockReturnValue({ eleves: [] });

vi.mock('@/hooks/useDocumentsFormation', () => ({
  useDonneesDocuments: () => ({
    formule: (_p: string, _per: string, ecartees: string[] = []) => formuleAppliquee(cats, faites, ecartees),
    bulletins,
  }),
}));
vi.mock('@/components/documents/DocumentDialog', () => ({
  DocumentDialog: ({ ouvert, generer }: { ouvert: boolean; generer: () => Promise<unknown> }) => {
    if (ouvert) void generer().catch(() => {});
    return ouvert ? <div role="dialog" aria-label="aperçu">aperçu</div> : null;
  },
}));
vi.mock('@/lib/documentsFormationProPdf', () => ({ genererBulletinsPdf: vi.fn().mockResolvedValue({}) }));

import { BoutonBulletins } from './BoutonBulletins';

const rendre = () => render(
  <BoutonBulletins promotionId="p1" periodeId="s1" periodeNom="Semestre 1" libelle="Bulletins de la promotion" nomFichier="b" />,
);

describe('Préparer les bulletins', () => {
  it('par défaut : la seule moyenne de chaque partie ; le détail des notes est une option', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Bulletins de la promotion/ }));
    const detail = screen.getByRole('checkbox', { name: 'Afficher le détail des notes' });
    expect(detail).not.toBeChecked();
    await user.click(detail);
    await user.click(screen.getByRole('button', { name: /Générer les bulletins/ }));
    expect(bulletins).toHaveBeenCalledWith('p1', 's1', undefined, [], true);
  });

  beforeEach(() => vi.clearAllMocks());

  it('dit ce qui n\'a pas été fait et montre le poids réparti (30/90 = 33,33 %)', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Bulletins de la promotion/ }));
    expect(screen.getByText(/Non faite ce semestre \(aucun examen blanc rattaché à Semestre 1\)/)).toBeInTheDocument();
    expect(screen.getAllByText('33,33 %')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Compter Examen blanc' })).toBeDisabled();
  });

  it('écarter le TP : le poids passe à 50 / 50 et le bulletin est calculé sans lui', async () => {
    const user = userEvent.setup();
    rendre();
    await user.click(screen.getByRole('button', { name: /Bulletins de la promotion/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Compter TP' }));
    expect(screen.getAllByText('50 %')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /Générer les bulletins/ }));
    expect(bulletins).toHaveBeenCalledWith('p1', 's1', undefined, ['tp'], false);
  });
});
