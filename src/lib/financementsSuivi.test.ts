import { describe, it, expect } from 'vitest';
import {
  alertesCohorte, assiduite, estInsere, factureDeLaTranche, insertionActuelle, montantTranche, numeroFacture, prochainNumero,
  rapportTransmis, repartirVersement, situationFinanciere, sommeSituations, statutFacture, tranchesNonFacturees,
  type FactureFinanceur, type LigneFactureFinanceur, type PointInsertion, type Rapport, type Versement,
} from './financementsSuivi';
import { organisme3FPT, type Dossier } from './financements';

// ════════════════════════════════════════════════════════════════════════════
// Ce que l'organisme doit à l'école : une erreur ici, c'est une facture fausse
// envoyée au 3FPT ou un versement mal attribué. Chaque règle a son test.
// ════════════════════════════════════════════════════════════════════════════

const fpt = { ...organisme3FPT(), id: 'fpt' };
const acompte = fpt.tranches[0];
const solde = fpt.tranches[1];
const ligne = (dossierId: string, montant: number): LigneFactureFinanceur => ({ dossierId, studentEnrollmentId: `e-${dossierId}`, nom: dossierId, matricule: dossierId, finance: 432000, montant });
const facture = (p: Partial<FactureFinanceur>): FactureFinanceur => ({
  id: 'f1', organismeId: 'fpt', numero: 1, annee: 2026, trancheId: acompte.id, trancheLibelle: 'Acompte', tranchePourcentage: 70,
  portee: 'cohorte', classId: 'c1', dateEmission: '2026-10-14', lignes: [], total: 0, annulee: false, createdAt: '', ...p,
});
const versement = (factureId: string, montant: number): Versement => ({ id: `v${montant}`, factureId, montant, date: '2026-11-01' });
const dossier = (id: string, p: Partial<Dossier> = {}): Dossier => ({
  id, studentEnrollmentId: `e-${id}`, organismeId: 'fpt', statut: 'valide', contratSigne: true, engagementSigne: true,
  situation: 'en_formation', ajustementIds: [], pieces: [], createdAt: '', updatedAt: '', ...p,
});

describe('numérotation des factures', () => {
  it('3FPT-2026-0007 ; le compteur repart chaque année et ne réutilise jamais un numéro', () => {
    expect(numeroFacture('3FPT', 2026, 7)).toBe('3FPT-2026-0007');
    expect(numeroFacture('Fonds régional ', 2026, 12)).toBe('FONDSREGIONAL-2026-0012');
    const f = [{ annee: 2026, numero: 3 }, { annee: 2026, numero: 1 }, { annee: 2025, numero: 40 }];
    expect(prochainNumero(f, 2026)).toBe(4);
    expect(prochainNumero(f, 2027)).toBe(1);
  });
});

describe('montant d\'une tranche', () => {
  it('acompte 70 % et solde 30 % de la somme prise en charge, total exact', () => {
    expect(montantTranche(fpt, acompte.id, 432000)).toBe(302400);
    expect(montantTranche(fpt, solde.id, 432000)).toBe(129600);
    expect(montantTranche(fpt, 'inconnue', 432000)).toBe(0);
  });
});

describe('statut d\'une facture', () => {
  const f = facture({ total: 100000, dateEcheance: '2026-11-30' });
  it('en attente, en retard après l\'échéance, payée en partie, payée, annulée', () => {
    expect(statutFacture(f, [], '2026-11-01')).toBe('en_attente');
    expect(statutFacture(f, [], '2026-12-01')).toBe('en_retard');
    expect(statutFacture(f, [versement('f1', 40000)], '2026-12-01')).toBe('partielle');
    expect(statutFacture(f, [versement('f1', 40000), versement('f1', 60000)], '2026-12-01')).toBe('payee');
    expect(statutFacture({ ...f, annulee: true }, [], '2026-12-01')).toBe('annulee');
  });
});

describe('versements', () => {
  it('sur une facture de cohorte, un versement partiel est réparti au prorata, au franc près', () => {
    const lignes = [ligne('a', 302400), ligne('b', 302400), ligne('c', 151200)];
    const parts = repartirVersement(lignes, 500000);
    expect([...parts.values()].reduce((s, v) => s + v, 0)).toBe(500000);
    expect(parts.get('a')).toBe(parts.get('b'));
    expect(parts.get('c')).toBeLessThan(parts.get('a')!);
    // Un versement plus grand que la facture ne crée pas d'argent fantôme.
    expect([...repartirVersement(lignes, 9_999_999).values()].reduce((s, v) => s + v, 0)).toBe(756000);
  });

  it('situation d\'un apprenant : pris en charge, facturé, reçu, restes', () => {
    const f1 = facture({ id: 'f1', lignes: [ligne('a', 302400), ligne('b', 302400)], total: 604800 });
    const annulee = facture({ id: 'f2', annulee: true, lignes: [ligne('a', 129600)], total: 129600 });
    const s = situationFinanciere('a', 432000, [f1, annulee], [versement('f1', 302400)]);
    expect(s).toEqual({ finance: 432000, facture: 302400, recu: 151200, resteAFacturer: 129600, resteAEncaisser: 151200 });
    expect(sommeSituations([s, s]).recu).toBe(302400);
  });

  it('une tranche facturée (non annulée) n\'est plus proposée', () => {
    const f1 = facture({ lignes: [ligne('a', 302400)], total: 302400 });
    expect(factureDeLaTranche([f1], 'a', acompte.id)?.id).toBe('f1');
    expect(tranchesNonFacturees(fpt, 'a', [f1]).map(t => t.libelle)).toEqual(['Solde']);
    expect(tranchesNonFacturees(fpt, 'a', [{ ...f1, annulee: true }]).map(t => t.libelle)).toEqual(['Acompte', 'Solde']);
  });
});

describe('rapports de fin de formation', () => {
  const rapport = (p: Partial<Rapport>): Rapport => ({ id: 'r', organismeId: 'fpt', portee: 'cohorte', classId: 'c1', titre: 'Rapport', statut: 'transmis', createdAt: '', updatedAt: '', ...p });
  it('le rapport de la cohorte vaut pour chacun ; un rapport individuel ne vaut que pour son apprenant', () => {
    expect(rapportTransmis([rapport({})], 'c1', 'a')).toBe(true);
    expect(rapportTransmis([rapport({ statut: 'en_cours' })], 'c1', 'a')).toBe(false);
    expect(rapportTransmis([rapport({ portee: 'apprenant', dossierId: 'b' })], 'c1', 'a')).toBe(false);
    expect(rapportTransmis([rapport({ portee: 'apprenant', dossierId: 'a', statut: 'valide' })], 'c1', 'a')).toBe(true);
  });
});

describe('insertion', () => {
  it('la situation actuelle est la plus récente ; emploi, à son compte et stage comptent comme insérés', () => {
    const points: PointInsertion[] = [
      { id: '1', dossierId: 'a', date: '2027-07-01', situation: 'recherche', createdAt: '1' },
      { id: '2', dossierId: 'a', date: '2027-09-15', situation: 'emploi', structure: 'Hôtel Terrou-Bi', createdAt: '2' },
      { id: '3', dossierId: 'b', date: '2027-09-20', situation: 'stage', createdAt: '3' },
    ];
    expect(insertionActuelle(points, 'a')?.situation).toBe('emploi');
    expect(insertionActuelle(points, 'z')).toBeUndefined();
    expect(['emploi', 'auto_emploi', 'stage', 'recherche'].map(s => estInsere(s as never))).toEqual([true, true, true, false]);
  });
});

describe('assiduité', () => {
  it('un retard compte présent ; aucune séance pointée = pas de taux', () => {
    const a = [
      { studentId: 'a', status: 'present' as const }, { studentId: 'a', status: 'late' as const },
      { studentId: 'a', status: 'absent' as const }, { studentId: 'a', status: 'present' as const }, { studentId: 'b', status: 'absent' as const },
    ];
    expect(assiduite(a, 'a')).toEqual({ seances: 4, presences: 2, retards: 1, absences: 1, taux: 75 });
    expect(assiduite(a, 'z').taux).toBeNull();
  });
});

describe('alertes', () => {
  it('signale dossiers, factures en retard, acompte non facturé et rapport manquant, sans rien bloquer', () => {
    const f = facture({ lignes: [ligne('a', 302400)], total: 302400, dateEcheance: '2026-11-01' });
    const textes = alertesCohorte({
      dossiers: [dossier('a'), dossier('b'), dossier('c', { statut: 'a_regulariser' })], organismes: [fpt],
      factures: [f], versements: [], rapports: [], classId: 'c1', finFormation: '2027-06-30', aujourdhui: '2027-07-10',
    }).map(a => a.texte);
    expect(textes).toEqual([
      '1 dossier à régulariser',
      '1 facture en retard de paiement',
      '3FPT : acompte pas encore facturé pour 1 dossier validé',
      'Formation terminée : rapport de fin de formation pas encore transmis',
    ]);
  });
});
