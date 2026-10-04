import { describe, expect, it } from 'vitest';
import type { PayableItem } from '@/lib/dueItems';
import type { AcademicMonth } from '@/types/payment';
import {
  documentDeFacture, etatFacture, finDuMois, jourEnLettres, lignesAFacturer, lignesDeRappel, numeroDeFacture,
  rangDuMoisLimite, restesActuels, totalDesLignes, type FactureEnregistree,
} from '@/lib/facture';

const mois: AcademicMonth[] = ['2026-09', '2026-10', '2026-11', '2026-12'].map((key, index) => ({
  key, index, label: key, dueDate: `${key}-05`,
}));

const el = (id: string, amount: number, extra: Partial<PayableItem> = {}): PayableItem => ({
  id, label: id, amount, dejaVerse: 0, tarifNormal: amount, personnalise: false, paid: false, blocked: false,
  type: 'tuition', ...extra,
});

const elements: PayableItem[] = [
  el('inscription', 30000, { type: 'inscription', dejaVerse: 20000 }),
  el('tuition_2026-09', 25000, { monthKey: '2026-09', overdue: true }),
  el('tuition_2026-10', 25000, { monthKey: '2026-10' }),
  el('tuition_2026-11', 25000, { monthKey: '2026-11', blocked: true }),
  el('service_tenue', 15000, { type: 'service', serviceId: 'tenue' }),
  el('tuition_2026-08x', 25000, { monthKey: '2026-08x', paid: true }),
];

describe('facture : ce qu\'elle réclame', () => {
  it('tout le non-payé jusqu\'au mois de la date limite — pas les mois suivants', () => {
    const l = lignesAFacturer(elements, mois, '2026-10-31');
    expect(l.map(x => x.cle)).toEqual(['inscription', 'tuition_2026-09', 'tuition_2026-10', 'service_tenue']);
  });

  it('le reste d\'un paiement partiel, avec ce qui est déjà versé', () => {
    const insc = lignesAFacturer(elements, mois, '2026-10-31')[0];
    expect(insc).toMatchObject({ montant: 50000, deja_verse: 20000, reste: 30000 });
  });

  it('marque les mois en retard', () => {
    const l = lignesAFacturer(elements, mois, '2026-10-31');
    expect(l.find(x => x.cle === 'tuition_2026-09')?.en_retard).toBe(true);
    expect(l.find(x => x.cle === 'tuition_2026-10')?.en_retard).toBe(false);
  });

  it('un mois verrouillé (mois précédent impayé) reste dû et se facture', () => {
    expect(lignesAFacturer(elements, mois, '2026-11-30').map(x => x.cle)).toContain('tuition_2026-11');
  });

  it('date limite avant l\'année : seulement l\'inscription et les frais uniques ; après : toute l\'année', () => {
    expect(rangDuMoisLimite(mois, '2026-08-15')).toBe(-1);
    expect(lignesAFacturer(elements, mois, '2026-08-15').map(x => x.cle)).toEqual(['inscription', 'service_tenue']);
    expect(rangDuMoisLimite(mois, '2027-06-30')).toBe(3);
  });

  it('un élève à jour n\'a rien à facturer', () => {
    expect(lignesAFacturer([el('x', 25000, { paid: true, monthKey: '2026-09' })], mois, '2026-10-31')).toEqual([]);
  });

  it('total = somme des restes', () => {
    expect(totalDesLignes(lignesAFacturer(elements, mois, '2026-10-31'))).toBe(30000 + 25000 + 25000 + 15000);
  });
});

describe('facture : numéro et dates', () => {
  it('FAC- et RAP-, numérotés sur 5 chiffres', () => {
    expect(numeroDeFacture('facture', '2026-2027', 42)).toBe('FAC-2026-00042');
    expect(numeroDeFacture('rappel', '2026-2027', 7)).toBe('RAP-2026-00007');
  });
  it('dates en toutes lettres et fin de mois', () => {
    expect(jourEnLettres('2026-10-31')).toBe('31 octobre 2026');
    expect(jourEnLettres('2026-11-01')).toBe('1er novembre 2026');
    expect(finDuMois('2026-02-10')).toBe('2026-02-28');
    expect(finDuMois('2028-02-10')).toBe('2028-02-29');
  });
});

const facture = (extra: Partial<FactureEnregistree> = {}): FactureEnregistree => ({
  id: 'f1', type: 'facture', number: 1, academicYearLabel: '2026-2027', studentEnrollmentId: 'e1', factureOrigineId: null,
  dateLimite: '2026-10-31', lignes: lignesAFacturer(elements, mois, '2026-10-31'), total: 95000, createdAt: '2026-10-04T10:00:00Z',
  ...extra,
});

describe('facture : suivi', () => {
  it('en attente avant la date limite, en retard après', () => {
    expect(etatFacture(facture(), elements, '2026-10-20').statut).toBe('en_attente');
    const e = etatFacture(facture(), elements, '2026-11-05');
    expect(e.statut).toBe('en_retard');
    expect(e.joursDeRetard).toBe(5);
  });

  it('payée quand chaque ligne est soldée, même si d\'autres mois restent dus', () => {
    const apres = elements.map(e => (['inscription', 'tuition_2026-09', 'tuition_2026-10', 'service_tenue'].includes(e.id) ? { ...e, paid: true } : e));
    expect(etatFacture(facture(), apres, '2026-11-05')).toMatchObject({ statut: 'payee', resteActuel: 0, joursDeRetard: 0 });
  });

  it('payée en partie : un acompte versé depuis réduit le reste', () => {
    const apres = elements.map(e => (e.id === 'tuition_2026-10' ? { ...e, amount: 5000, dejaVerse: 20000 } : e));
    const etat = etatFacture(facture(), apres, '2026-10-20');
    expect(etat.statut).toBe('partielle');
    expect(etat.resteActuel).toBe(95000 - 20000);
  });

  it('un tarif relevé après coup ne gonfle pas une facture remise', () => {
    const apres = elements.map(e => (e.id === 'tuition_2026-10' ? { ...e, amount: 40000 } : e));
    expect(restesActuels(facture().lignes, apres).find(l => l.cle === 'tuition_2026-10')?.reste).toBe(25000);
  });

  it('le rappel ne réclame que ce qui reste de la facture d\'origine', () => {
    const apres = elements.map(e => (e.id === 'inscription' ? { ...e, paid: true } : e));
    const r = lignesDeRappel(facture(), apres);
    expect(r.map(l => l.cle)).toEqual(['tuition_2026-09', 'tuition_2026-10', 'service_tenue']);
    expect(r.every(l => l.en_retard)).toBe(true);
    expect(r.map(l => l.cle)).not.toContain('tuition_2026-11');
  });

  it('le document d\'un rappel cite la facture d\'origine', () => {
    const origine = facture();
    const rappel = facture({ id: 'r1', type: 'rappel', number: 3, factureOrigineId: 'f1', dateLimite: '2026-11-20' });
    const doc = documentDeFacture(rappel, { nom: 'DIOP Awa', matricule: 'ETU-1' }, origine, true);
    expect(doc.numero).toBe('RAP-2026-00003');
    expect(doc.origine).toEqual({ numero: 'FAC-2026-00001', emiseLe: origine.createdAt, dateLimite: '2026-10-31' });
    expect(doc.duplicata).toBe(true);
  });
});
