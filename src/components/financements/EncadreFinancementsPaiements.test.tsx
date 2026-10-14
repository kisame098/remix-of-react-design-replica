import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ════════════════════════════════════════════════════════════════════════════
// Gestion des paiements → Vue d'ensemble : l'argent attendu des organismes
// financeurs, à côté de celui des familles. Invisible sans apprenant financé.
// ════════════════════════════════════════════════════════════════════════════

const organisme = { id: 'fpt', nom: '3FPT', partFinancee: 90, tranches: [{ id: 'a', libelle: 'Acompte', pourcentage: 100 }], frais: { inscription: true, mensualites: true, services: [] }, pieces: [] };
let fin: Record<string, unknown> = {};
vi.mock('@/contexts/FinancementsContext', () => ({ useFinancements: () => fin }));
vi.mock('@/contexts/SchoolContext', () => ({ useSchool: () => ({ students: [{ id: 'e1' }, { id: 'e2' }] }) }));
vi.mock('@/hooks/useElementsAPayer', () => ({
  useElementsAPayer: () => ({ elementsDe: () => [{ id: 'inscription', type: 'inscription', tarifNormal: 100000, amount: 10000, paid: false, personnalise: true, dejaVerse: 0, blocked: false, label: '' }] }),
}));

import { EncadreFinancementsPaiements } from './EncadreFinancementsPaiements';

const dossier = (id: string, e: string, statut = 'valide') => ({ id, studentEnrollmentId: e, organismeId: 'fpt', statut });
beforeEach(() => {
  fin = {
    actif: true, suiviDisponible: true, dossiers: [dossier('d1', 'e1'), dossier('d2', 'e2')], organisme: () => organisme,
    factures: [{ id: 'f1', annulee: false, total: 90000, lignes: [{ dossierId: 'd1', montant: 90000 }] }],
    versements: [{ id: 'v', factureId: 'f1', montant: 90000, date: '2026-10-14' }],
  };
});

describe('Vue d\'ensemble des paiements → Financements', () => {
  it('attendu, facturé, reçu et reste de l\'organisme', () => {
    render(<MemoryRouter><EncadreFinancementsPaiements /></MemoryRouter>);
    expect(screen.getByText('Financements (3FPT)')).toBeInTheDocument();
    expect(screen.getByText(/2 apprenants financés/)).toBeInTheDocument();
    // 2 × 90 % de 100 000 = 180 000 attendus ; 90 000 facturés et reçus.
    const valeur = (titre: string) => screen.getByText(titre).nextElementSibling?.textContent?.replace(/\s/g, '');
    expect(valeur("Attendu de l'organisme")).toBe('180000FCFA');
    expect(valeur('Facturé')).toBe('90000FCFA');
    expect(valeur('Reçu')).toBe('90000FCFA');
    expect(valeur('Reste à encaisser')).toBe('90000FCFA');
    expect(screen.getByRole('link', { name: /Ouvrir Financements/ })).toHaveAttribute('href', '/formation/financements');
  });

  it('un dossier pas encore validé n\'attend rien de l\'organisme', () => {
    fin = { ...fin, dossiers: [dossier('d1', 'e1'), dossier('d2', 'e2', 'en_attente')] };
    render(<MemoryRouter><EncadreFinancementsPaiements /></MemoryRouter>);
    const valeur = (titre: string) => screen.getByText(titre).nextElementSibling?.textContent?.replace(/\s/g, '');
    expect(valeur("Attendu de l'organisme")).toBe('90000FCFA');
  });

  it('rien quand le module est éteint ou sans apprenant financé', () => {
    fin = { ...fin, dossiers: [] };
    const { container } = render(<MemoryRouter><EncadreFinancementsPaiements /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
