import { describe, it, expect } from 'vitest';
import { genererFacturesFinanceurPdf } from './factureFinanceurPdf';
import type { FactureFinanceur } from './financementsSuivi';

// ════════════════════════════════════════════════════════════════════════════
// La facture au financeur se fabrique (jsPDF en mémoire) : une page par
// facture, une longue cohorte continue sur la page suivante.
// ════════════════════════════════════════════════════════════════════════════

const ecole = { nom: 'Institut Hôtelier de Dakar', ville: 'Dakar', telephone: '33 820 00 00', directeurGeneral: 'M. Ibrahima FALL', logo: null };
const facture = (n: number, apprenants: number): FactureFinanceur => ({
  id: `f${n}`, organismeId: 'fpt', numero: n, annee: 2026, trancheId: 'a', trancheLibelle: 'Acompte', tranchePourcentage: 70,
  portee: 'cohorte', classId: 'c1', dateEmission: '2026-10-14', dateEcheance: '2026-11-30', annulee: false, createdAt: '',
  lignes: Array.from({ length: apprenants }, (_, i) => ({ dossierId: `d${i}`, studentEnrollmentId: `e${i}`, nom: `APPRENANT ${i + 1}`, matricule: `ETU-${i}`, finance: 432000, montant: 302400 })),
  total: apprenants * 302400,
});
const donnees = (f: FactureFinanceur) => ({ facture: f, organisme: '3FPT', formation: 'BEP Restauration · Promo 2026' });

describe('PDF — facture au financeur', () => {
  it('une page par facture', async () => {
    const doc = await genererFacturesFinanceurPdf(ecole, [donnees(facture(1, 3)), donnees(facture(2, 1))]);
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('une cohorte de 40 apprenants continue sur une seconde page, sans rien perdre', async () => {
    const doc = await genererFacturesFinanceurPdf(ecole, [donnees(facture(1, 40))]);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it('refuse une liste vide', async () => {
    await expect(genererFacturesFinanceurPdf(ecole, [])).rejects.toThrow();
  });
});
