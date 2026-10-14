import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { PayableItem } from '@/lib/dueItems';
import type { AjustementTarif } from '@/lib/tarifsEleve';

// ════════════════════════════════════════════════════════════════════════════
// Activer / retirer un financement : c'est ce qui change ce que paie
// l'apprenant. Base simulée ; on vérifie ce qui part vers elle.
// ════════════════════════════════════════════════════════════════════════════

const appels: { table: string; op: string; args: unknown[] }[] = [];
let lignesEnBase: Record<string, unknown>[] = [];
const retireFichiers = vi.fn().mockResolvedValue({ error: null });

const chaine = (table: string) => {
  let op = 'select';
  let charge: Record<string, unknown> = {};
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'single', 'insert', 'update', 'delete']) {
    c[m] = (...args: unknown[]) => {
      if (m === 'insert' || m === 'update' || m === 'delete') { op = m; charge = (args[0] ?? {}) as Record<string, unknown>; }
      appels.push({ table, op: m, args });
      return c;
    };
  }
  c.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve((() => {
    if (op === 'insert') {
      const ligne = { id: 'dos-1', created_at: 'x', updated_at: 'x', statut: 'en_attente', situation: 'en_formation', ajustement_ids: [], ...charge };
      lignesEnBase.push(ligne);
      return { data: ligne, error: null };
    }
    if (op === 'update') {
      const ligne = { ...lignesEnBase[0], ...charge };
      lignesEnBase = [ligne];
      return { data: ligne, error: null };
    }
    if (op === 'delete') { lignesEnBase = []; return { error: null }; }
    return { data: lignesEnBase, error: null };
  })()).then(ok, ko);
  return c;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => chaine(t), storage: { from: () => ({ remove: retireFichiers }) } },
}));

const organisme = {
  id: 'fpt', nom: '3FPT', partFinancee: 90,
  tranches: [{ id: 'a', libelle: 'Acompte', pourcentage: 70 }, { id: 's', libelle: 'Solde', pourcentage: 30 }],
  frais: { inscription: true, mensualites: true, services: [] },
  pieces: [{ id: 'cni', nom: 'CNI' }],
};
let mode = 'formation_pro';
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ school: { id: 'ecole-1', management_mode: mode, settings: { financements: { actif: true, organismes: [organisme] } } }, isSchoolAccessBlocked: false }),
}));

let elements: PayableItem[] = [];
vi.mock('@/hooks/useElementsAPayer', () => ({ useElementsAPayer: () => ({ mois: [], elementsDe: () => elements }) }));

let compteur = 0;
const appliquer = vi.fn(async (_: string, lignes: AjustementTarif[]) => lignes.map(l => ({ ...l, id: `aj-${++compteur}` })));
const retirer = vi.fn().mockResolvedValue(undefined);
let index = new Map<string, AjustementTarif>();
let payes = new Set<string>();
vi.mock('@/contexts/PaymentContext', () => ({
  usePayment: () => ({
    getAjustementsEleve: () => index,
    appliquerTarifsEleve: appliquer,
    retirerTarifsEleve: retirer,
    hasPaidInscription: () => payes.has('inscription'),
    hasPaidTuitionMonth: (_: string, k: string) => payes.has(`tuition:${k}`),
    hasPaidService: () => false,
  }),
}));

import { FinancementsProvider, useFinancements } from './FinancementsContext';

const enveloppe = ({ children }: { children: ReactNode }) => <FinancementsProvider>{children}</FinancementsProvider>;
const eleve = { id: 'enr-1', studentId: 'ETU-1', firstName: 'Awa', lastName: 'DIOP', classId: 'c1' } as never;
const element = (p: Partial<PayableItem> & Pick<PayableItem, 'id' | 'type'>): PayableItem => ({
  label: p.id, amount: 10000, dejaVerse: 0, tarifNormal: 10000, personnalise: false, paid: false, blocked: false, ...p,
});

beforeEach(() => {
  appels.length = 0; lignesEnBase = []; compteur = 0; mode = 'formation_pro';
  appliquer.mockClear(); retirer.mockClear(); retireFichiers.mockClear();
  index = new Map(); payes = new Set();
  elements = [
    element({ id: 'inscription', type: 'inscription' }),
    element({ id: 'tuition_2026-10', type: 'tuition', monthKey: '2026-10' }),
    element({ id: 'tuition_2026-09', type: 'tuition', monthKey: '2026-09', paid: true }),
  ];
});

describe('activer un financement', () => {
  it('ouvre le dossier (avec les pièces exigées) puis réduit les frais non payés à la part de l\'apprenant', async () => {
    const { result } = renderHook(() => useFinancements(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let reduits = 0;
    await act(async () => { reduits = (await result.current.activer(eleve, 'fpt')).fraisReduits; });

    const insertion = appels.find(a => a.op === 'insert');
    expect(insertion?.args[0]).toMatchObject({
      school_id: 'ecole-1', student_enrollment_id: 'enr-1', organisme_id: 'fpt',
      pieces: [{ piece_id: 'cni', fournie: false, conforme: false }],
    });
    // Le mois déjà payé n'est jamais touché.
    expect(appliquer).toHaveBeenCalledTimes(1);
    expect(appliquer.mock.calls[0][1].map((l: AjustementTarif) => [l.type, l.monthKey, l.mode, l.valeur]))
      .toEqual([['inscription', undefined, 'pourcentage', 90], ['tuition', '2026-10', 'pourcentage', 90]]);
    expect(reduits).toBe(2);
    // Le dossier garde la trace des réductions qu'il a posées.
    expect(appels.filter(a => a.op === 'update').at(-1)?.args[0]).toMatchObject({ ajustement_ids: ['aj-1', 'aj-2'] });
    expect(result.current.dossierDe('enr-1')?.ajustementIds).toEqual(['aj-1', 'aj-2']);
  });

  it('une longue année part en plusieurs appels (60 frais au plus par appel)', async () => {
    elements = Array.from({ length: 70 }, (_, i) => element({ id: `t${i}`, type: 'tuition', monthKey: `m${i}` }));
    const { result } = renderHook(() => useFinancements(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.activer(eleve, 'fpt'); });
    expect(appliquer.mock.calls.map(c => c[1].length)).toEqual([60, 10]);
  });

  it('retirer : les réductions des frais non payés partent, celles des frais payés restent (trace)', async () => {
    const { result } = renderHook(() => useFinancements(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.activer(eleve, 'fpt'); });

    // Entre-temps, l'inscription a été payée (avec la réduction).
    index = new Map([
      ['inscription', { id: 'aj-1', studentId: 'enr-1', type: 'inscription', mode: 'pourcentage', valeur: 90, motif: 'm' }],
      ['tuition:2026-10', { id: 'aj-2', studentId: 'enr-1', type: 'tuition', monthKey: '2026-10', mode: 'pourcentage', valeur: 90, motif: 'm' }],
    ]);
    payes = new Set(['inscription']);
    const { result: r2 } = renderHook(() => useFinancements(), { wrapper: enveloppe });
    await waitFor(() => expect(r2.current.dossierDe('enr-1')).toBeDefined());
    await act(async () => { await r2.current.desactiver(eleve); });

    expect(retirer).toHaveBeenCalledWith(['aj-2']);
    expect(appels.some(a => a.op === 'delete')).toBe(true);
    expect(r2.current.dossierDe('enr-1')).toBeUndefined();
  });

  it('école classique : rien n\'est chargé', async () => {
    mode = 'classique';
    const { result } = renderHook(() => useFinancements(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.actif).toBe(false);
    expect(appels).toEqual([]);
  });
});
