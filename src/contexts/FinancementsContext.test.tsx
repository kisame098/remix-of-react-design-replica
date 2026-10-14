import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// ════════════════════════════════════════════════════════════════════════════
// Activer / retirer un financement. La prise en charge n'est PAS une
// réduction : activer ouvre un dossier, rien d'autre ne s'écrit sur les frais
// de l'élève — le partage se calcule à la caisse à partir du dossier.
// Base simulée ; on vérifie ce qui part vers elle.
// ════════════════════════════════════════════════════════════════════════════

const appels: { table: string; op: string; args: unknown[] }[] = [];
let lignesEnBase: Record<string, unknown>[] = [];
let facturesEnBase: Record<string, unknown>[] = [];
/** Simule un numéro déjà pris par quelqu'un d'autre au premier essai. */
let conflitAuPremierEssai = false;
const retireFichiers = vi.fn().mockResolvedValue({ error: null });

const chaine = (table: string) => {
  let op = 'select';
  let charge: Record<string, unknown> = {};
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'single', 'insert', 'update', 'delete']) {
    c[m] = (...args: unknown[]) => {
      if (m === 'insert' || m === 'update' || m === 'delete') { op = m; charge = (args[0] ?? {}) as Record<string, unknown>; }
      if (m === 'insert' && Array.isArray(args[0])) charge = args[0] as unknown as Record<string, unknown>;
      appels.push({ table, op: m, args });
      return c;
    };
  }
  c.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve((() => {
    if (table === 'fin_factures') {
      if (op === 'insert') {
        if (conflitAuPremierEssai) {
          conflitAuPremierEssai = false;
          facturesEnBase.push({ id: 'autre', organisme_id: 'fpt', numero: 1, annee: 2026, lignes: [], total: 0, created_at: '0' });
          return { data: null, error: { code: '23505', message: 'doublon' } };
        }
        const lignes = (Array.isArray(charge) ? charge : [charge]).map((l, i) => ({ id: `f-${facturesEnBase.length + i + 1}`, created_at: 'x', annulee: false, ...l }));
        facturesEnBase.push(...lignes);
        return { data: lignes, error: null };
      }
      return { data: facturesEnBase, error: null };
    }
    if (table === 'fin_journal' && op === 'insert') return { data: { id: 'j', created_at: 'x', ...charge }, error: null };
    if (table !== 'fin_dossiers') return { data: [], error: null };
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

import { FinancementsProvider, useFinancements } from './FinancementsContext';

const enveloppe = ({ children }: { children: ReactNode }) => <FinancementsProvider>{children}</FinancementsProvider>;
const eleve = { id: 'enr-1', studentId: 'ETU-1', firstName: 'Awa', lastName: 'DIOP', classId: 'c1' } as never;

beforeEach(() => {
  appels.length = 0; lignesEnBase = []; facturesEnBase = []; conflitAuPremierEssai = false; mode = 'formation_pro';
  retireFichiers.mockClear();
});

describe('activer un financement', () => {
  it('ouvre le dossier avec les pièces exigées, sans toucher aux frais de l\'élève', async () => {
    const { result } = renderHook(() => useFinancements(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.priseEnChargeDe('enr-1')).toBeUndefined();

    await act(async () => { await result.current.activer(eleve, 'fpt'); });

    const insertion = appels.find(a => a.op === 'insert');
    expect(insertion?.args[0]).toMatchObject({
      school_id: 'ecole-1', student_enrollment_id: 'enr-1', organisme_id: 'fpt',
      pieces: [{ piece_id: 'cni', fournie: false, conforme: false }],
    });
    // Aucune réduction : seule la table des dossiers est écrite.
    expect(appels.filter(a => ['insert', 'update', 'delete'].includes(a.op)).every(a => a.table === 'fin_dossiers' || a.table === 'fin_journal')).toBe(true);
    // Dossier en attente : la prise en charge ne s'applique pas encore.
    expect(result.current.priseEnChargeDe('enr-1')).toBeUndefined();
  });

  it('la prise en charge ne s\'applique qu\'une fois le dossier validé', async () => {
    const { result } = renderHook(() => useFinancements(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.activer(eleve, 'fpt'); });
    await act(async () => { await result.current.modifier('dos-1', { statut: 'complet' }); });
    expect(result.current.priseEnChargeDe('enr-1')).toBeUndefined();
    await act(async () => { await result.current.modifier('dos-1', { statut: 'valide' }); });
    // La caisse lit alors le partage dans le dossier.
    expect(result.current.priseEnChargeDe('enr-1')).toEqual({ organisme: '3FPT', pourcentage: 90, frais: organisme.frais });
  });

  it('retirer : le dossier part, l\'élève repaie ses frais en entier', async () => {
    const { result } = renderHook(() => useFinancements(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.activer(eleve, 'fpt'); });
    await act(async () => { await result.current.desactiver(eleve); });

    expect(appels.some(a => a.table === 'fin_dossiers' && a.op === 'delete')).toBe(true);
    expect(result.current.dossierDe('enr-1')).toBeUndefined();
    expect(result.current.priseEnChargeDe('enr-1')).toBeUndefined();
  });

  it('factures au financeur : numérotées par organisme et par année ; un numéro pris entre-temps est renuméroté', async () => {
    const { result } = renderHook(() => useFinancements(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const brouillon = (nom: string) => ({
      organismeId: 'fpt', trancheId: 'a', trancheLibelle: 'Acompte', tranchePourcentage: 70, portee: 'apprenant' as const,
      classId: 'c1', dateEmission: '2026-10-14', lignes: [{ dossierId: nom, studentEnrollmentId: nom, nom, matricule: nom, finance: 432000, montant: 302400 }],
    });
    conflitAuPremierEssai = true;
    let creees: { numero: number; total: number }[] = [];
    await act(async () => { creees = await result.current.emettreFactures([brouillon('a'), brouillon('b')]); });
    // Le n° 1 a été pris par un autre poste : on relit et on repart de 2.
    expect(creees.map(f => f.numero)).toEqual([2, 3]);
    expect(creees.every(f => f.total === 302400)).toBe(true);
    expect(result.current.factures.map(f => f.numero).sort()).toEqual([1, 2, 3]);
  });

  it('école classique : rien n\'est chargé', async () => {
    mode = 'classique';
    const { result } = renderHook(() => useFinancements(), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.actif).toBe(false);
    expect(appels).toEqual([]);
  });
});
