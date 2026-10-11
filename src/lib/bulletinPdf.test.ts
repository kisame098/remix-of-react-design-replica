import { describe, it, expect } from 'vitest';
import { choisirGabarit, generateBulletinsPdf, type Gabarit, type BulletinPdfData } from './bulletinPdf';

// ════════════════════════════════════════════════════════════════════════════
// Bulletin collège/lycée : au dernier semestre, la moyenne de chaque période
// et la moyenne annuelle — et TOUT doit tenir sur une page A4, même avec 14
// matières (le bas de page débordait sur les QR codes).
// ════════════════════════════════════════════════════════════════════════════

/** Le PDF brut, lisible en latin1 : jsPDF n'y compresse pas le texte par défaut. */
const texte = (doc: { output: (t: 'arraybuffer') => ArrayBuffer }) => Buffer.from(doc.output('arraybuffer')).toString('latin1');

describe('choisirGabarit', () => {
  const gabarits: Gabarit[] = [
    { rowH: 6, gap: 8, lineGap: 7, blocH: 38 },
    { rowH: 5, gap: 5, lineGap: 6, blocH: 33 },
  ];
  const horsTableau = (g: Gabarit) => g.gap + g.lineGap + g.blocH;

  it('garde la mise en page d\'origine quand elle tient', () => {
    expect(choisirGabarit(gabarits, 10, horsTableau, 200)).toBe(gabarits[0]);
  });

  it('passe au gabarit plus serré quand la page déborderait', () => {
    // 20 × 6 + 53 = 173 > 160 ; 20 × 5 + 44 = 144 ≤ 160
    expect(choisirGabarit(gabarits, 20, horsTableau, 160)).toBe(gabarits[1]);
  });

  it('au-delà, réduit les lignes juste assez pour tenir, sans passer sous le minimum', () => {
    const g = choisirGabarit(gabarits, 30, horsTableau, 150);
    expect(30 * g.rowH + horsTableau(g)).toBeCloseTo(150, 6);
    expect(choisirGabarit(gabarits, 80, horsTableau, 150).rowH).toBe(3.4);
  });
});

describe('PDF — récapitulatif annuel', () => {
  const donnees = (periodes?: { periodName: string; average?: number; rank?: number; classSize: number }[]): BulletinPdfData => {
    const subjectDetails = Array.from({ length: 14 }, (_, i) => ({
      subjectName: `Matiere ${i + 1}`, muDev: 12, composition: 13, muMat: 12.5, coef: 2, pPond: 25,
    }));
    const ranking = { studentId: 'e1', studentCode: 'M1', firstName: 'Awa', lastName: 'Diop', averageGeneral: 13.42, totalCoef: 28, rank: 3, subjectDetails };
    return {
      school: { name: 'Lycee Test' }, yearLabel: '2025-2026', periodName: 'Second Semestre', className: 'Tle S2', effectif: 45,
      student: { firstName: 'Awa', lastName: 'Diop', studentId: 'M1' },
      ranking, classRankings: [ranking], classAverage: 11.2, isExam: false,
      absencesCount: 0, justifiedAbsencesCount: 0, retardsCount: 0,
      annualAverage: { label: 'Moyenne Annuelle', average: 12.96, rank: 4, classSize: 45, periodes },
    };
  };

  it('imprime la moyenne de chaque semestre puis la moyenne annuelle, sur UNE page', async () => {
    const doc = await generateBulletinsPdf([donnees([
      { periodName: 'Premier Semestre', average: 12.5, rank: 6, classSize: 45 },
      { periodName: 'Second Semestre', average: 13.42, rank: 3, classSize: 45 },
    ])]);
    const t = texte(doc);
    expect(t).toContain('Moyenne Premier Semestre');
    expect(t).toContain('12.50');
    expect(t).toContain('Moyenne Second Semestre');
    expect(t).toContain('Moyenne Annuelle');
    expect(t).toContain('12.96');
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('un bulletin publié avant le récapitulatif garde l\'ancienne ligne', async () => {
    const t = texte(await generateBulletinsPdf([donnees(undefined)]));
    expect(t).toContain('Moyenne Annuelle');
    expect(t).not.toContain('Moyenne Premier Semestre');
  });
});
