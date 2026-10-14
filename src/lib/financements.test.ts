import { describe, it, expect } from 'vitest';
import {
  CLE_FINANCEMENTS, erreurOrganisme, fraisFinance, lireReglagesFinancements, manquesDuDossier,
  montantFinance, montantsDesTranches, organisme3FPT, priseEnChargeDe, type Organisme,
} from './financements';
import type { PayableItem } from './dueItems';

// ════════════════════════════════════════════════════════════════════════════
// Financements : le frais reste dû en entier, partagé entre l'apprenant
// (caisse) et l'organisme (facture). Jamais une réduction.
// Une erreur ici fait payer trop (ou trop peu) une famille : chaque règle a
// son test.
// ════════════════════════════════════════════════════════════════════════════

const element = (p: Partial<PayableItem> & Pick<PayableItem, 'id' | 'type'>): PayableItem => ({
  label: p.id, amount: p.tarifNormal ?? 10000, dejaVerse: 0, tarifNormal: 10000, du: p.tarifNormal ?? 10000, partOrganisme: 0, priseEnChargeTotale: false, personnalise: false,
  paid: false, blocked: false, ...p,
});

const fpt = (): Organisme => ({ ...organisme3FPT(), id: 'fpt', frais: { inscription: true, mensualites: true, services: ['cantine'] } });

const elements: PayableItem[] = [
  element({ id: 'inscription', type: 'inscription', tarifNormal: 50000 }),
  element({ id: 'tuition_2026-10', type: 'tuition', monthKey: '2026-10', tarifNormal: 25000 }),
  element({ id: 'tuition_2026-11', type: 'tuition', monthKey: '2026-11', tarifNormal: 25000 }),
  element({ id: 'service_cantine', type: 'service', serviceId: 'cantine', tarifNormal: 15000 }),
  element({ id: 'service_tenue', type: 'service', serviceId: 'tenue', tarifNormal: 8000 }),
];

describe('réglages', () => {
  it('rien d\'enregistré : module éteint', () => {
    expect(lireReglagesFinancements(null)).toEqual({ actif: false, organismes: [] });
    expect(lireReglagesFinancements({ [CLE_FINANCEMENTS]: { actif: true, organismes: [] } }).actif).toBe(false);
  });

  it('le 3FPT par défaut reprend la demande : 90 % pris en charge, acompte 70 % puis solde 30 %', () => {
    const o = organisme3FPT();
    expect(o.nom).toBe('3FPT');
    expect(o.partFinancee).toBe(90);
    expect(o.tranches.map(t => [t.libelle, t.pourcentage])).toEqual([['Acompte', 70], ['Solde', 30]]);
    expect(erreurOrganisme(o)).toBeNull();
  });

  it('relit ce qui est enregistré et corrige ce qui est abîmé', () => {
    const r = lireReglagesFinancements({ [CLE_FINANCEMENTS]: { actif: true, organismes: [
      { id: 'a', nom: ' 3FPT ', partFinancee: '90.4', tranches: [{ id: 't', libelle: 'Unique', pourcentage: 100 }], frais: { mensualites: false, services: ['s', 3] }, pieces: [{ id: 'p', nom: 'CNI' }, { id: '', nom: 'x' }] },
      { nom: 'sans id' },
    ] } });
    expect(r.actif).toBe(true);
    expect(r.organismes).toHaveLength(1);
    expect(r.organismes[0]).toMatchObject({ nom: '3FPT', partFinancee: 90, frais: { inscription: true, mensualites: false, services: ['s'] }, pieces: [{ id: 'p', nom: 'CNI' }] });
  });

  it('refuse un organisme incohérent, avec la raison', () => {
    expect(erreurOrganisme({ ...fpt(), nom: ' ' })).toMatch(/nom/);
    expect(erreurOrganisme({ ...fpt(), partFinancee: 0 })).toMatch(/entre 1 et 100/);
    expect(erreurOrganisme({ ...fpt(), partFinancee: 90.5 })).toMatch(/entier/);
    expect(erreurOrganisme({ ...fpt(), tranches: [{ id: 'a', libelle: 'Acompte', pourcentage: 70 }] })).toMatch(/70 %.*100 %/);
    expect(erreurOrganisme({ ...fpt(), frais: { inscription: false, mensualites: false, services: [] } })).toMatch(/au moins un frais/);
  });
});

describe('prise en charge (pas une réduction)', () => {
  it('reprend la part et les frais cochés de l\'organisme', () => {
    expect(priseEnChargeDe(fpt())).toEqual({ organisme: '3FPT', pourcentage: 90, frais: { inscription: true, mensualites: true, services: ['cantine'] } });
  });

  it('seuls les frais cochés sont pris en charge', () => {
    const sansMois = { ...fpt(), frais: { inscription: true, mensualites: false, services: [] } };
    expect(elements.filter(e => fraisFinance(sansMois, e)).map(e => e.id)).toEqual(['inscription']);
  });
});

describe('montants pris en charge', () => {
  it('au tarif normal des frais concernés : base, part de l\'organisme, part de l\'apprenant', () => {
    // 50 000 + 25 000 + 25 000 + 15 000 (la tenue n'est pas prise en charge)
    expect(montantFinance(fpt(), elements)).toEqual({ base: 115000, finance: 103500, partApprenant: 11500 });
  });

  it('part de l\'organisme calculée sur ce qui est dû (après une bourse de l\'école)', () => {
    const avecBourse = elements.map(e => e.id === 'inscription' ? { ...e, du: 40000, personnalise: true } : e);
    expect(montantFinance(fpt(), avecBourse)).toEqual({ base: 105000, finance: 94500, partApprenant: 10500 });
  });

  it('les tranches font toujours le total exact, même avec un arrondi', () => {
    const t = montantsDesTranches(fpt(), 103500);
    expect(t.map(x => x.montant)).toEqual([72450, 31050]);
    const tiers = { ...fpt(), tranches: [1, 2, 3].map(i => ({ id: `t${i}`, libelle: `T${i}`, pourcentage: 100 / 3 })) };
    const m = montantsDesTranches(tiers, 100000).map(x => x.montant);
    expect(m.reduce((a, b) => a + b, 0)).toBe(100000);
  });
});

describe('dossier', () => {
  it('liste ce qui manque : contrat, lettre, pièces non fournies ou non conformes', () => {
    const o = { ...fpt(), pieces: [{ id: 'cni', nom: 'CNI' }, { id: 'dip', nom: 'Diplôme' }, { id: 'photo', nom: 'Photo' }] };
    const manques = manquesDuDossier({
      contratSigne: false, engagementSigne: true,
      pieces: [{ pieceId: 'cni', fournie: true, conforme: true }, { pieceId: 'dip', fournie: true, conforme: false }],
    }, o);
    expect(manques).toEqual(['Contrat de formation non signé', 'Diplôme : à vérifier (non conforme)', 'Photo : à fournir']);
    expect(manquesDuDossier({ contratSigne: true, engagementSigne: true, pieces: [] }, { ...fpt(), pieces: [] })).toEqual([]);
  });
});
