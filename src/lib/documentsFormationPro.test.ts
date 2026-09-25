import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  numeroDocument, accord, estDiplomeDEtat, titreDiplome, raisonNonEmettable, construireBulletins,
  rangOrdinal, planningExamen, appreciationMoyenne, abregeCategorie,
} from './documentsFormationPro';
import { recapitulatifPeriode, type BaremeCategorie, type Evaluation, type Note } from './formationPro';

describe('documents officiels — numéro et accords', () => {
  it('même forme que les reçus : préfixe, année, 5 chiffres', () => {
    expect(numeroDocument('attestation_inscription', 2026, 12)).toBe('INS-2026-00012');
    expect(numeroDocument('attestation_reussite', 2026, 1)).toBe('REU-2026-00001');
    expect(numeroDocument('diplome', 2027, 3)).toBe('DIP-2027-00003');
  });
  it('accorde au féminin pour une élève', () => {
    expect(accord('femme', 'inscrit')).toBe('inscrite');
    expect(accord('homme', 'inscrit')).toBe('inscrit');
    expect(accord(undefined, 'admis')).toBe('admis');
  });
  it('rang : 1er, 2e…', () => {
    expect(rangOrdinal(1)).toBe('1er');
    expect(rangOrdinal(2)).toBe('2e');
  });
});

describe('documents officiels — qui peut être émis, et quand', () => {
  const admis = { decision: 'admis' as const };
  it('l\'attestation d\'inscription est toujours possible', () => {
    expect(raisonNonEmettable('attestation_inscription', { estDirecteur: false })).toBeNull();
  });
  it('réussite et diplôme : directeur, examen verrouillé, candidat admis', () => {
    expect(raisonNonEmettable('attestation_reussite', { estDirecteur: false, examen: { verrouille: true }, resultat: admis })).toMatch(/directeur/);
    expect(raisonNonEmettable('attestation_reussite', { estDirecteur: true })).toMatch(/Aucun examen/);
    expect(raisonNonEmettable('attestation_reussite', { estDirecteur: true, examen: { verrouille: false }, resultat: admis })).toMatch(/verrouillé/);
    expect(raisonNonEmettable('attestation_reussite', { estDirecteur: true, examen: { verrouille: true }, resultat: { decision: 'ajourne' } })).toMatch(/pas admis/);
    expect(raisonNonEmettable('attestation_reussite', { estDirecteur: true, examen: { verrouille: true }, resultat: admis })).toBeNull();
    expect(raisonNonEmettable('diplome', { estDirecteur: true, typeDiplome: "Diplôme de l'établissement", examen: { verrouille: true }, resultat: admis })).toBeNull();
  });
  it('pas de diplôme de l\'école pour une formation « Diplôme d\'État »', () => {
    expect(estDiplomeDEtat("Diplôme d'État")).toBe(true);
    expect(estDiplomeDEtat("diplome d'etat")).toBe(true);
    expect(estDiplomeDEtat("Diplôme de l'établissement")).toBe(false);
    expect(raisonNonEmettable('diplome', { estDirecteur: true, typeDiplome: "Diplôme d'État", examen: { verrouille: true }, resultat: admis }))
      .toMatch(/attestation de réussite/);
  });
  it('le diplôme d\'une formation « Certificat » s\'intitule Certificat', () => {
    expect(titreDiplome('Certificat')).toBe('Certificat');
    expect(titreDiplome("Diplôme de l'établissement")).toBe('Diplôme');
    expect(titreDiplome(undefined)).toBe('Diplôme');
  });
});

describe('bulletin — vérifié sur le bulletin de composition d\'IFHO (S2 2023-2024)', () => {
  const cats: BaremeCategorie[] = [
    { id: 'dev', formationId: 'f', name: 'Devoirs', pourcentage: 50, ordering: 0 },
    { id: 'comp', formationId: 'f', name: 'Composition', pourcentage: 50, ordering: 1 },
  ];
  const ev = (id: string, matiere: string, categorieId: string, date: string): Evaluation => ({
    id, promotionId: 'p', niveauMatiereId: matiere, periodeId: 's2', categorieId, type: '', title: id, date, bareme: 20, poids: 1, createdAt: date,
  });
  const matieres = [
    { id: 'fr', matiereName: 'Français', coefficient: 2, nature: 'theorique' as const, ordering: 0 },
    { id: 'cond', matiereName: 'Conduite', coefficient: 1, nature: 'theorique' as const, ordering: 1 },
    { id: 'stg', matiereName: 'Stage', coefficient: 3, nature: 'stage' as const, ordering: 2 },
  ];
  const evaluations = [ev('d1', 'fr', 'dev', '2024-03-01'), ev('d2', 'fr', 'dev', '2024-04-01'), ev('c', 'fr', 'comp', '2024-05-01'), ev('cc', 'cond', 'comp', '2024-05-02')];
  const n = (evaluationId: string, valeur: number): Note => ({ id: evaluationId, evaluationId, studentEnrollmentId: 's1', valeur, statut: 'note' });
  const notes = [n('d1', 18), n('d2', 16), n('c', 16), n('cc', 18)];
  const eleves = [{ id: 's1', lastName: 'Niang', firstName: 'Sokhna', studentId: 'M1', dateOfBirth: '1997-12-21', placeOfBirth: 'Médina Gounass' }];
  const recapS2 = recapitulatifPeriode(['s1'], matieres.slice(0, 2), cats, evaluations, notes);
  const r = construireBulletins({
    matieres, categories: cats, evaluations, notes, eleves,
    recaps: [
      { periode: 'Semestre 1', lignes: [{ studentEnrollmentId: 's1', parMatiere: {}, generale: 15.55, rang: 1 }] },
      { periode: 'Semestre 2', lignes: recapS2 },
    ],
  });
  const b = r.bulletins[0];

  it('colonnes : DEV 1, DEV 2 (+ MOY DEV) puis COMP', () => {
    expect(r.colonnes.map(c => [c.abrege, c.nbNotes])).toEqual([['DEV', 2], ['COMP', 1]]);
  });
  it('ligne Français : 18 et 16 → moy dev 17 ; comp 16 → moyenne 16,50 ; × 2 = 33 ; Très bien', () => {
    const fr = b.lignes[0];
    expect(fr.cellules[0]).toEqual({ notes: ['18,00', '16,00'], moyenne: 17 });
    expect(fr.cellules[1]).toEqual({ notes: ['16,00'], moyenne: 16 });
    expect(fr.moyenne).toBe(16.5);
    expect(fr.moyenne! * fr.coefficient).toBe(33);
    expect(fr.appreciation).toBe('Très bien');
  });
  it('« Conduite » : une seule note, elle est la moyenne', () => {
    expect(b.lignes[1].moyenne).toBe(18);
  });
  it('matière Stage sans note : pas comptée dans les coefficients', () => {
    expect(b.lignes[2].stage).toBe(true);
    expect(b.totalCoefficients).toBe(3);
    expect(b.totalPoints).toBe(51);
  });
  it('rappel des semestres et moyenne générale = moyenne des semestres', () => {
    expect(b.recapitulatif).toEqual([{ periode: 'Semestre 1', moyenne: 15.55 }, { periode: 'Semestre 2', moyenne: 17 }]);
    expect(b.moyenneAnnuelle).toBeCloseTo(16.275);
    // Sur le bulletin d'IFHO : (15,55 + 14,07) / 2 = 14,81
    expect((15.55 + 14.07) / 2).toBeCloseTo(14.81, 2);
  });
  it('appréciations : 12 / 14 / 16 lues sur le bulletin', () => {
    expect(appreciationMoyenne(12.5)).toBe('Assez bien');
    expect(appreciationMoyenne(14.25)).toBe('Bien');
    expect(appreciationMoyenne(16.5)).toBe('Très bien');
    expect(appreciationMoyenne(null)).toBe('');
  });
  it('abréviations des catégories', () => {
    expect(abregeCategorie('Devoirs')).toBe('DEV');
    expect(abregeCategorie('Composition')).toBe('COMP');
    expect(abregeCategorie('Contrôle continu')).toBe('CC');
    expect(abregeCategorie('Examen final')).toBe('EF');
    expect(abregeCategorie('Examen blanc')).toBe('EB');
    expect(abregeCategorie('TP')).toBe('TP');
  });
});

describe('convocation — planning de l\'examen', () => {
  it('dans l\'ordre des dates et des heures ; une épreuve sans date va à la fin', () => {
    const tours = [{ id: 't1', examenId: 'x', name: 'Écrit', ordering: 0 }, { id: 't2', examenId: 'x', name: 'Pratique', ordering: 1 }];
    const eps = [
      { id: 'e1', tourId: 't1', nom: 'Français', coefficient: 1, bareme: 20, ordering: 0, date: '2027-06-10', heure: '14:00' },
      { id: 'e2', tourId: 't1', nom: 'Anglais', coefficient: 1, bareme: 20, ordering: 1, date: '2027-06-10', heure: '08:00' },
      { id: 'e3', tourId: 't2', nom: 'Cuisine', coefficient: 1, bareme: 20, ordering: 0 },
      { id: 'e4', tourId: 't2', nom: 'Pâtisserie', coefficient: 1, bareme: 20, ordering: 1, date: '2027-06-09' },
    ];
    expect(planningExamen('x', tours, eps).map(l => l.epreuve)).toEqual(['Pâtisserie', 'Anglais', 'Français', 'Cuisine']);
  });
});

describe('garde-fous — documents officiels', () => {
  const sql = readFileSync('docs/sql/formation_pro_documents.sql', 'utf8');
  it('numéro unique par école, type et année ; pas de doublon même à deux au même instant', () => {
    expect(sql).toContain('unique (school_id, type, annee, numero)');
    expect(sql).toContain('pg_advisory_xact_lock');
  });
  it('un document émis ne se modifie ni ne se supprime (lecture seule, émission par la fonction)', () => {
    expect(sql).not.toMatch(/for (insert|update|delete)/);
    expect(sql).toContain('security definer');
  });
  it('réussite et diplôme : directeur, examen verrouillé, candidat admis — vérifié par la base', () => {
    expect(sql).toContain("p_type in ('attestation_reussite', 'diplome') and not is_school_admin()");
    expect(sql).toContain("x.verrouille");
    expect(sql).toContain("r.decision = 'admis'");
  });
});
