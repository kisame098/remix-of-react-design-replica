import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  numeroDocument, accord, estDiplomeDEtat, titreDiplome, raisonNonEmettable, bulletinsDepuisRecapitulatif,
  rangOrdinal, planningExamen,
} from './documentsFormationPro';

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

describe('bulletins — à partir du récapitulatif de la période', () => {
  const matieres = [
    { id: 'b', matiereName: 'Stage', coefficient: 3, nature: 'stage' as const, ordering: 1 },
    { id: 'a', matiereName: 'Français', coefficient: 2, nature: 'theorique' as const, ordering: 0 },
  ];
  const eleves = [
    { id: 's2', lastName: 'Fall', firstName: 'Moussa', studentId: 'ETU-2' },
    { id: 's1', lastName: 'Diop', firstName: 'Awa', studentId: 'ETU-1', dateOfBirth: '2005-03-02' },
    { id: 's3', lastName: 'Sy', firstName: 'Ali', studentId: 'ETU-3' },
  ];
  const recap = [
    { studentEnrollmentId: 's1', parMatiere: { a: 12, b: 16 }, generale: 14.4, rang: 1 },
    { studentEnrollmentId: 's2', parMatiere: { a: 10, b: null }, generale: 10, rang: 2 },
    { studentEnrollmentId: 's3', parMatiere: { a: null, b: null }, generale: null, rang: null },
  ];
  const r = bulletinsDepuisRecapitulatif(recap, matieres, eleves);

  it('un bulletin par élève, par ordre alphabétique, matières dans l\'ordre du programme', () => {
    expect(r.bulletins.map(b => b.eleve.nom)).toEqual(['Diop', 'Fall', 'Sy']);
    expect(r.bulletins[0].lignes.map(l => l.matiere)).toEqual(['Français', 'Stage']);
    expect(r.bulletins[0].lignes[1].stage).toBe(true);
  });
  it('le total des coefficients ne compte que les matières notées', () => {
    expect(r.bulletins[0].totalCoefficients).toBe(5);
    expect(r.bulletins[1].totalCoefficients).toBe(2);
  });
  it('effectif classé et moyenne de la promotion : les élèves sans note n\'y entrent pas', () => {
    expect(r.effectifClasse).toBe(2);
    expect(r.moyennePromotion).toBeCloseTo(12.2);
    expect(r.bulletins[2].rang).toBeNull();
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
