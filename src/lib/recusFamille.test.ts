import { describe, it, expect, vi } from 'vitest';

const sb = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: sb }));

import { chargerRecusEleve } from './recusFamille';

describe('chargerRecusEleve — le portail ne doit jamais dépendre des reçus', () => {
  it('rattache chaque paiement à son reçu', async () => {
    sb.from.mockImplementation((table: string) => table === 'payments'
      ? { select: () => ({ eq: () => ({ not: () => Promise.resolve({ data: [{ id: 'p1', receipt_id: 'r1' }, { id: 'p2', receipt_id: 'r1' }] }) }) }) }
      : { select: () => ({ eq: () => Promise.resolve({ data: [{ id: 'r1', academic_year_label: '2026-2027', number: 3, created_at: '2026-09-19T10:00:00Z' }] }) }) });

    const r = await chargerRecusEleve('e1');
    expect(r.parPaiement).toEqual({ p1: 'r1', p2: 'r1' });
    expect(r.recus).toEqual([{ id: 'r1', academicYearLabel: '2026-2027', number: 3, createdAt: '2026-09-19T10:00:00Z' }]);
  });

  it('NE LÈVE JAMAIS : une erreur donne « aucun reçu », la page s\'affiche comme avant', async () => {
    sb.from.mockImplementation(() => { throw new Error('table absente'); });
    await expect(chargerRecusEleve('e1')).resolves.toEqual({ parPaiement: {}, recus: [] });
  });

  it('réponse vide ou absente : aucun reçu', async () => {
    sb.from.mockImplementation((table: string) => table === 'payments'
      ? { select: () => ({ eq: () => ({ not: () => Promise.resolve({ data: null }) }) }) }
      : { select: () => ({ eq: () => Promise.resolve({ data: null }) }) });
    await expect(chargerRecusEleve('e1')).resolves.toEqual({ parPaiement: {}, recus: [] });
  });
});
