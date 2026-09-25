import { describe, it, expect } from 'vitest';
import {
  genererBulletinsPdf, genererConvocationsPdf, genererAttestationStagePdf, genererDocumentOfficielPdf, dateEnLettres,
} from './documentsFormationProPdf';
import type { DocumentOfficiel } from './documentsFormationPro';

// ════════════════════════════════════════════════════════════════════════════
// Les PDF se fabriquent vraiment (jsPDF en mémoire) et portent ce qu'ils
// doivent porter. Le texte brut d'un PDF échappe les parenthèses : on cherche
// des morceaux sans parenthèses.
// ════════════════════════════════════════════════════════════════════════════

const ecole = { nom: 'IFHO Test', ville: 'Dakar', pays: 'Sénégal', ninea: '123456', autorisation: 'AUT-42', rc: 'SN-DKR-2020-B-1', logo: null };
/** Le PDF brut, lisible en latin1 : jsPDF n'y compresse pas le texte par défaut (comme les tests des reçus). */
const texte = (doc: { output: (t: 'arraybuffer') => ArrayBuffer }) => Buffer.from(doc.output('arraybuffer')).toString('latin1');

describe('dateEnLettres', () => {
  it('écrit la date en toutes lettres', () => {
    expect(dateEnLettres('2026-09-01')).toBe('1er septembre 2026');
    expect(dateEnLettres('2027-06-15')).toBe('15 juin 2027');
    expect(dateEnLettres(undefined)).toBe('');
  });
});

describe('PDF — bulletins', () => {
  it('une page par élève, avec la moyenne générale et le rang', async () => {
    const doc = await genererBulletinsPdf({
      ecole, formation: 'CAP Restauration', niveau: 'CAP 1', promotion: 'Promo 2026',
      periode: { nom: 'Semestre 1', debut: '2026-09-01', fin: '2027-01-31' },
      formule: 'Contrôle continu 30 % · TP 30 %', effectifClasse: 2, moyennePromotion: 12.2,
      eleves: [
        { studentEnrollmentId: 's1', eleve: { nom: 'Diop', prenoms: 'Awa', matricule: 'ETU-1' }, lignes: [
          { matiere: 'Français', coefficient: 2, moyenne: 12, stage: false },
          { matiere: 'Stage', coefficient: 3, moyenne: 16, stage: true },
        ], moyenneGenerale: 14.4, rang: 1, totalCoefficients: 5 },
        { studentEnrollmentId: 's2', eleve: { nom: 'Fall', prenoms: 'Moussa', matricule: 'ETU-2' }, lignes: [
          { matiere: 'Français', coefficient: 2, moyenne: 10, stage: false },
          { matiere: 'Stage', coefficient: 3, moyenne: null, stage: true },
        ], moyenneGenerale: 10, rang: 2, totalCoefficients: 2 },
      ],
    });
    expect(doc.getNumberOfPages()).toBe(2);
    const t = texte(doc);
    expect(t).toContain('BULLETIN DE NOTES');
    expect(t).toContain('14,40 /20');
    expect(t).toContain('1er / 2');
    expect(t).toContain('AUT-42');
  });

  it('un programme de 30 matières tient sur une seule page', async () => {
    const lignes = Array.from({ length: 30 }, (_, i) => ({ matiere: `Matière ${i + 1}`, coefficient: 1, moyenne: 11, stage: false }));
    const doc = await genererBulletinsPdf({
      ecole, formation: 'F', niveau: 'N', promotion: 'P', periode: { nom: 'S1' }, formule: '', effectifClasse: 1, moyennePromotion: 11,
      eleves: [{ studentEnrollmentId: 's1', eleve: { nom: 'A', prenoms: 'B', matricule: 'M' }, lignes, moyenneGenerale: 11, rang: 1, totalCoefficients: 30 }],
    });
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

describe('PDF — convocations et attestation de stage', () => {
  it('une convocation par candidat, avec le planning', async () => {
    const doc = await genererConvocationsPdf({
      ecole, examen: { nom: 'Examen final', typeLibelle: 'Examen final' }, formation: 'CAP', niveau: 'CAP 1', promotion: 'P',
      planning: [{ tour: 'Écrit', epreuve: 'Français', date: '2027-06-10', heure: '08:00', salle: 'A1' }],
      candidats: [{ nom: 'Diop', prenoms: 'Awa', matricule: 'ETU-1', sexe: 'femme' }, { nom: 'Fall', prenoms: 'Moussa', matricule: 'ETU-2', sexe: 'homme' }],
    });
    expect(doc.getNumberOfPages()).toBe(2);
    const t = texte(doc);
    expect(t).toContain('CONVOCATION');
    expect(t).toContain('10/06/2027');
    expect(t).toContain('La candidate ci-dessus est convoquée');
  });

  it('attestation de stage : entreprise et dates en toutes lettres', async () => {
    const doc = await genererAttestationStagePdf({
      ecole, eleve: { nom: 'Diop', prenoms: 'Awa', matricule: 'ETU-1', sexe: 'femme' }, formation: 'CAP', niveau: 'CAP 1', promotion: 'P',
      entreprise: 'Hôtel Terrou-Bi', poste: 'Cuisine', dateDebut: '2026-06-01', dateFin: '2026-08-31', duree: '3 mois',
    });
    const t = texte(doc);
    expect(t).toContain('ATTESTATION DE STAGE');
    expect(t).toContain('Mme Diop Awa');
    expect(t).toContain('1er juin 2026');
  });
});

describe('PDF — documents officiels', () => {
  const base: Omit<DocumentOfficiel, 'type'> = {
    id: 'd1', annee: 2026, numero: 7, studentEnrollmentId: 's1', emisLe: '2026-09-25T10:00:00Z',
    contenu: {
      ecole,
      eleve: { nom: 'Diop', prenoms: 'Awa', matricule: 'ETU-1', sexe: 'femme', dateNaissance: '2005-03-02', lieuNaissance: 'Thiès' },
      formation: { nom: 'CAP Restauration', niveau: 'CAP 2', promotion: 'Promo 2025', typeDiplome: "Diplôme de l'établissement", rythme: 'Jour' },
      examen: { nom: 'Examen final', type: 'officiel', moyenne: 14.25, mention: 'bien' },
    },
  };
  it('attestation d\'inscription : numéro, accords au féminin', async () => {
    const t = texte(await genererDocumentOfficielPdf({ ...base, type: 'attestation_inscription' }, null));
    expect(t).toContain('INS-2026-00007');
    expect(t).toContain('inscrite');
    expect(t).toContain('2 mars 2005');
  });
  it('attestation de réussite : admise, mention et moyenne figées', async () => {
    const t = texte(await genererDocumentOfficielPdf({ ...base, type: 'attestation_reussite' }, null));
    expect(t).toContain('REU-2026-00007');
    expect(t).toContain('ADMISE');
    expect(t).toContain('mention Bien');
  });
  it('diplôme : paysage, titre et nom en grand', async () => {
    const doc = await genererDocumentOfficielPdf({ ...base, type: 'diplome' }, null);
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
    const t = texte(doc);
    expect(t).toContain('DIPLÔME');
    expect(t).toContain('DIP-2026-00007');
    expect(t).toContain('DIOP Awa');
  });
});
