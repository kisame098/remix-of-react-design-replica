import { describe, expect, it } from 'vitest';
import type { PayableItem } from '@/lib/dueItems';
import type { AcademicMonth } from '@/types/payment';
import { bilanFiche, lignesDeFiche, type PaiementFiche } from '@/lib/fichePaiement';
import { genererFichesPaiementPdf, type FichePaiementDoc } from '@/lib/fichePaiementPdf';

const mois: AcademicMonth[] = ['2026-10', '2026-11', '2026-12'].map((key, index) => ({ key, index, label: key, dueDate: `${key}-05` }));
const el = (id: string, amount: number, extra: Partial<PayableItem> = {}): PayableItem => ({
  id, label: id, amount, dejaVerse: 0, tarifNormal: amount, personnalise: false, paid: false, blocked: false, type: 'tuition', ...extra,
});

const elements: PayableItem[] = [
  el('inscription', 30000, { type: 'inscription', paid: true }),
  el('tuition_2026-10', 25000, { monthKey: '2026-10', paid: true }),
  el('tuition_2026-11', 15000, { monthKey: '2026-11', dejaVerse: 10000 }),
  el('tuition_2026-12', 25000, { monthKey: '2026-12' }),
  el('service_tenue', 15000, { type: 'service', serviceId: 'tenue' }),
];
const paiements: PaiementFiche[] = [
  { type: 'inscription', status: 'paid', receiptId: 'r1' },
  { type: 'tuition', monthKey: '2026-10', status: 'paid', receiptId: 'r2' },
  { type: 'tuition', monthKey: '2026-10', status: 'cancelled', receiptId: 'r9' },
  { type: 'tuition', monthKey: '2026-11', status: 'paid', receiptId: 'r3' },
];
const numero = (id: string) => ({ r1: 'REC-2026-00001', r2: 'REC-2026-00002', r3: 'REC-2026-00003', r9: 'REC-2026-00009' } as Record<string, string>)[id];
const lignes = lignesDeFiche(elements, paiements, numero, mois, '2026-11-20');

describe('fiche de paiement : chaque frais de l\'année', () => {
  it('dû, payé et reste, frais par frais', () => {
    expect(lignes.map(l => [l.du, l.paye, l.reste])).toEqual([
      [30000, 30000, 0], [25000, 25000, 0], [25000, 10000, 15000], [25000, 0, 25000], [15000, 0, 15000],
    ]);
  });

  it('état : soldé, partiel, à venir, impayé', () => {
    expect(lignes.map(l => l.etat)).toEqual(['solde', 'solde', 'partiel', 'a_venir', 'impaye']);
  });

  it('les reçus de chaque frais, sans ceux des paiements annulés', () => {
    expect(lignes[0].recus).toEqual(['REC-2026-00001']);
    expect(lignes[1].recus).toEqual(['REC-2026-00002']);
    expect(lignes[2].recus).toEqual(['REC-2026-00003']);
    expect(lignes[3].recus).toEqual([]);
  });

  it('bilan : reste total, et la part déjà exigible', () => {
    expect(bilanFiche(lignes)).toEqual({ du: 120000, paye: 65000, reste: 55000, resteEchu: 30000, solde: false });
  });

  it('soldé quand plus rien ne reste', () => {
    const tout = elements.map(e => ({ ...e, paid: true, amount: e.amount + e.dejaVerse, dejaVerse: 0 }));
    expect(bilanFiche(lignesDeFiche(tout, [], numero, mois, '2026-11-20')).solde).toBe(true);
  });
});

const textePdf = (brut: string): string => [...brut.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map(m => m[1]).join('');
const fiche = (l = lignes): FichePaiementDoc => ({
  anneeScolaire: '2026-2027', situationAu: '2026-11-20T10:00:00Z',
  eleve: { nom: 'ÉLÈVE Exemple', matricule: 'ETU-1', classe: 'CM2' }, tuteur: { nom: 'Parent', telephone: '77' }, lignes: l,
});

describe('fiche de paiement PDF', () => {
  it('une page A4 par élève, dans un seul PDF', async () => {
    const doc = await genererFichesPaiementPdf({ nom: 'École' }, [fiche(), fiche()], { couleur: null });
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('écrit le reste, la date de situation et les numéros de reçus', async () => {
    const doc = await genererFichesPaiementPdf({ nom: 'École' }, [fiche()], { couleur: null });
    const texte = textePdf(Buffer.from(doc.output('arraybuffer')).toString('latin1'));
    for (const attendu of ['FICHE DE PAIEMENT', 'RESTE À PAYER', '55 000', '20 novembre 2026', 'REC-2026-00003', 'Partiel', 'À venir']) {
      expect(texte).toContain(attendu);
    }
  });

  it('une fiche soldée porte le tampon SOLDÉ', async () => {
    const soldees = lignes.map(l => ({ ...l, paye: l.du, reste: 0, etat: 'solde' as const }));
    const doc = await genererFichesPaiementPdf({ nom: 'École' }, [fiche(soldees)], { economique: true });
    expect(textePdf(Buffer.from(doc.output('arraybuffer')).toString('latin1'))).toContain('SOLDÉ');
  });
});
