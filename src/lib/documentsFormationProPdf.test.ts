import { describe, it, expect } from 'vitest';
import {
  genererBulletinsPdf, genererConvocationsPdf, genererAttestationStagePdf, genererDocumentOfficielPdf, dateEnLettres, genererRelevesPdf,
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

describe('PDF — bulletins (format IFHO)', () => {
  const ligne = (matiere: string, notes: string[], comp: string, moyenne: number | null, coefficient: number) => ({
    matiere, coefficient, stage: false, moyenne, appreciation: moyenne === null ? '' : 'Bien',
    cellules: [{ notes, moyenne: moyenne }, { notes: [comp], moyenne: null }],
  });
  const donnees = (lignes: ReturnType<typeof ligne>[], recap = [{ periode: 'Semestre 1', moyenne: 15.55 }, { periode: 'Semestre 2', moyenne: 14.07 }]) => ({
    ecole, formation: 'BEP Restauration', niveau: 'BEP 2', promotion: 'Promo 2023',
    periode: { nom: 'Second semestre' }, anneeScolaire: '2023-2024',
    colonnes: [{ categorieId: 'dev', nom: 'Devoirs', abrege: 'DEV', nbNotes: 2 }, { categorieId: 'comp', nom: 'Composition', abrege: 'COMP', nbNotes: 1 }],
    detail: true,
    formule: 'Devoirs 50 % · Composition 50 %', effectifClasse: 2, moyennePromotion: 12,
    eleves: [{ studentEnrollmentId: 's1', eleve: { nom: 'Niang', prenoms: 'Sokhna', matricule: 'M1', dateNaissance: '1997-12-21' }, lignes,
      moyenneGenerale: 14.07, rang: 1, totalCoefficients: 26, totalPoints: 365.88, recapitulatif: recap, moyenneAnnuelle: 14.81 }],
  });

  it('en-tête de l\'école, titre, colonnes DEV / COMP, totaux, semestres et moyenne générale', async () => {
    const doc = await genererBulletinsPdf(donnees([ligne('Français', ['18,00', '16,00'], '16,00', 16.5, 2)]));
    const t = texte(doc);
    expect(t).toContain('BULLETIN DE COMPOSITION');
    expect(t).toContain('SECOND SEMESTRE 2023 - 2024');
    expect(t).toContain('DEV 1');
    expect(t).toContain('DEVOIRS');
    expect(t).toContain('COMPOSITION');
    expect(t).toContain('365,88');
    expect(t).toContain('Moyenne Semestre 1');
    expect(t).toContain('14,81');
    expect(t).toContain('LE DIRECTEUR DES');
    expect(t).toContain('N° Aut : AUT-42');
  });

  it('par défaut : une colonne par partie avec son nom entier et sa seule moyenne, pas de DEV 1 / DEV 2', async () => {
    const francais = { ...ligne('Français', ['18,00', '16,00'], '', 16.5, 2), cellules: [{ notes: ['18,00', '16,00'], moyenne: 17 }, { notes: ['16,00'], moyenne: 16 }] };
    const d = { ...donnees([francais]), detail: false,
      colonnes: [
        { categorieId: 'cc', nom: 'Contrôle continu', abrege: 'CC', nbNotes: 2 }, { categorieId: 'tp', nom: 'TP', abrege: 'TP', nbNotes: 1 },
      ] };
    const t = texte(await genererBulletinsPdf(d));
    // Le nom entier (sur deux lignes dans l'en-tête étroit).
    expect(t).toContain('CONTRÔLE');
    expect(t).toContain('CONTINU');
    expect(t).not.toContain('CC 1');
    expect(t).toContain('17,00');   // la moyenne du contrôle continu (18 et 16)
    expect(t).not.toContain('18,00');
  });

  it('un programme de 30 matières tient sur une seule page', async () => {
    const lignes = Array.from({ length: 30 }, (_, i) => ligne(`Matière ${i + 1}`, ['11,00', '12,00'], '11,00', 11, 1));
    const doc = await genererBulletinsPdf(donnees(lignes));
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

describe('PDF — relevé de notes d\'examen (format CAP / examen blanc)', () => {
  it('tours côte à côte, totaux demandés, admissibilité, décision et mention', async () => {
    const doc = await genererRelevesPdf({
      ecole, typeLibelle: 'EXAMEN BLANC', diplome: "Brevet d'Étude Professionnelle (BEP)", option: 'RESTAURATION', session: 'session 2024',
      date: '2024-06-19', centre: 'IFHO', presidentJury: 'M. Diallo', avecNE: true,
      candidats: [{
        nom: 'Gueye', prenoms: 'Babacar', matricule: 'BC000', dateNaissance: '1998-04-10', lieuNaissance: 'Dakar',
        tours: [
          { nom: '1er tour', lignes: [{ discipline: 'Techniques culinaires', coefficient: 4, note: '12', points: '48', ne: '< 8' }], total: 166, totalMax: 260, totalDemande: 156, moyenne: 12.76, decision: 'ADMISSIBLE' },
          { nom: '2e tour', lignes: [{ discipline: 'Mathématiques', coefficient: 1, note: '14,5', points: '14,5' }], total: 83, totalMax: 140, totalDemande: 70, moyenne: 11.86 },
        ],
        totalGeneral: 249, totalGeneralMax: 400, totalGeneralDemande: 226, moyenneGenerale: 12.45, decision: 'ADMIS', mention: 'ASSEZ BIEN',
      }],
    });
    const t = texte(doc);
    expect(t).toContain('RELEVÉ DE NOTES');
    expect(t).toContain('EXAMEN BLANC');
    expect(t).toContain('Option RESTAURATION session 2024');
    expect(t).toContain('DATE : 19/06/2024');
    expect(t).toContain('ÉPREUVES DU 1ER TOUR');
    expect(t).toContain('ÉPREUVES DU 2E TOUR');
    expect(t).toContain('166 / 260');
    expect(t).toContain('ADMISSIBLE');
    expect(t).toContain('249 / 400');
    expect(t).toContain('226');
    expect(t).toContain('ASSEZ BIEN');
    expect(t).toContain('M. Diallo');
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
