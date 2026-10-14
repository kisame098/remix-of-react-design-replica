import { describe, it, expect } from 'vitest';
import {
  CLE_FINANCEMENTS, erreurOrganisme, fraisDejaPersonnalises, fraisNonCouverts, lignesDeFinancement, lireReglagesFinancements, manquesDuDossier,
  montantFinance, montantsDesTranches, motifFinancement, organisme3FPT, parLots, type Organisme,
} from './financements';
import type { PayableItem } from './dueItems';

// ════════════════════════════════════════════════════════════════════════════
// Financements : la part de l'apprenant passe par des réductions sur ses frais.
// Une erreur ici fait payer trop (ou trop peu) une famille : chaque règle a
// son test.
// ════════════════════════════════════════════════════════════════════════════

const element = (p: Partial<PayableItem> & Pick<PayableItem, 'id' | 'type'>): PayableItem => ({
  label: p.id, amount: p.tarifNormal ?? 10000, dejaVerse: 0, tarifNormal: 10000, personnalise: false,
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

describe('part de l\'apprenant (réductions)', () => {
  it('une réduction de la part financée sur chaque frais pris en charge, avec le motif du financement', () => {
    const lignes = lignesDeFinancement(fpt(), 'e1', elements);
    expect(lignes.map(l => `${l.type}:${l.monthKey ?? l.serviceId ?? ''}`)).toEqual(['inscription:', 'tuition:2026-10', 'tuition:2026-11', 'service:cantine']);
    expect(lignes.every(l => l.mode === 'pourcentage' && l.valeur === 90 && l.studentId === 'e1')).toBe(true);
    expect(lignes[0].motif).toBe(motifFinancement(fpt()));
  });

  it('un frais déjà payé ne change jamais', () => {
    const lignes = lignesDeFinancement(fpt(), 'e1', elements.map(e => e.id === 'inscription' ? { ...e, paid: true } : e));
    expect(lignes.some(l => l.type === 'inscription')).toBe(false);
  });

  it('une réduction accordée à la main n\'est pas écrasée en silence : elle est signalée', () => {
    const avecBourse = elements.map(e => e.id === 'tuition_2026-10' ? { ...e, personnalise: true } : e);
    expect(lignesDeFinancement(fpt(), 'e1', avecBourse).some(l => l.monthKey === '2026-10')).toBe(false);
    expect(fraisDejaPersonnalises(fpt(), avecBourse).map(e => e.id)).toEqual(['tuition_2026-10']);
  });

  it('les réductions posées par CE financement se mettent à jour (part modifiée, autre organisme)', () => {
    const dejaFinance = elements.map(e => e.id === 'tuition_2026-10' ? { ...e, personnalise: true } : e);
    const propres = new Set(['tuition:2026-10']);
    expect(lignesDeFinancement({ ...fpt(), partFinancee: 80 }, 'e1', dejaFinance, propres).find(l => l.monthKey === '2026-10')?.valeur).toBe(80);
    expect(fraisDejaPersonnalises(fpt(), dejaFinance, propres)).toEqual([]);
  });

  it('seuls les frais cochés comptent : un service non pris en charge reste au tarif plein', () => {
    const sansMois = { ...fpt(), frais: { inscription: true, mensualites: false, services: [] } };
    expect(lignesDeFinancement(sansMois, 'e1', elements).map(l => l.type)).toEqual(['inscription']);
  });

  it('frais pris en charge restés au tarif plein (réduction retirée à la main) : détectés, pour ne pas encaisser 100 %', () => {
    const reduits = elements.map(e => ({ ...e, personnalise: true }));
    expect(fraisNonCouverts(fpt(), reduits)).toEqual([]);
    const unRetire = reduits.map(e => e.id === 'tuition_2026-11' ? { ...e, personnalise: false } : e);
    expect(fraisNonCouverts(fpt(), unRetire).map(e => e.id)).toEqual(['tuition_2026-11']);
    // Un frais payé, ou non pris en charge (tenue), n'est jamais signalé.
    expect(fraisNonCouverts(fpt(), elements.map(e => ({ ...e, paid: true })))).toEqual([]);
    expect(fraisNonCouverts(fpt(), elements).map(e => e.id)).not.toContain('service_tenue');
  });

  it('les longues listes partent en lots de 60 (limite de la base)', () => {
    expect(parLots(Array.from({ length: 125 }, (_, i) => i)).map(l => l.length)).toEqual([60, 60, 5]);
    expect(parLots([])).toEqual([]);
  });
});

describe('montants pris en charge', () => {
  it('au tarif normal des frais concernés : base, part de l\'organisme, part de l\'apprenant', () => {
    // 50 000 + 25 000 + 25 000 + 15 000 (la tenue n'est pas prise en charge)
    expect(montantFinance(fpt(), elements)).toEqual({ base: 115000, finance: 103500, partApprenant: 11500 });
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
