import { describe, it, expect } from 'vitest';
import jsPDF from 'jspdf';
import { decouperProprement, ecrireAjuste } from './documentsDesign';

// ════════════════════════════════════════════════════════════════════════════
// « ahmadoukane3452@gmail.com » est sorti « ahmadoukane3452@gma. » sur un reçu : un
// découpage en lignes dont on ne gardait que la première. Un texte imprimé sur un
// document officiel ne se perd jamais en silence.
// ════════════════════════════════════════════════════════════════════════════

const nouveau = () => {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  doc.setFont('helvetica', 'bold');
  return doc;
};
const brut = (doc: jsPDF) => Buffer.from(doc.output('arraybuffer')).toString('latin1');

describe('ecrireAjuste', () => {
  it('un texte qui tient : une ligne, à la taille demandée, rien de changé', () => {
    const doc = nouveau();
    const lignes = ecrireAjuste(doc, 'Espèces', 10, 10, 60, { taille: 9 });
    expect(lignes).toBe(1);
    expect(doc.getFontSize()).toBe(9);
  });

  it('LE CAS RÉEL : un e-mail qui ne tient pas à 9 pt est RÉTRÉCI, pas coupé', () => {
    const doc = nouveau();
    const email = 'ahmadoukane3452@gmail.com';        // ≈ 44 mm à 9 pt
    const lignes = ecrireAjuste(doc, email, 10, 10, 40, { taille: 9, tailleMin: 7.4 });
    expect(lignes).toBe(1);
    expect(doc.getFontSize()).toBeLessThan(9);
    expect(doc.getFontSize()).toBeGreaterThanOrEqual(7.4);
    expect(brut(doc)).toContain(email);              // en un seul morceau, complet
    expect(brut(doc)).not.toContain('gma.');
  });

  it('trop étroit même à la taille minimale, une seule ligne permise : « … » visible, jamais un simple découpage', () => {
    const doc = nouveau();
    ecrireAjuste(doc, 'ahmadoukane3452@gmail.com', 10, 10, 30, { taille: 9, tailleMin: 7.4, lignesMax: 1 });
    expect(brut(doc)).toContain('\x85');
  });

  it('trop long même à la taille minimale : plusieurs lignes, tout le texte est là', () => {
    const doc = nouveau();
    const texte = 'Direction Générale des Études et de la Planification Scolaire';
    const lignes = ecrireAjuste(doc, texte, 10, 10, 30, { taille: 9, tailleMin: 7, lignesMax: 4 });
    expect(lignes).toBeGreaterThan(1);
    const contenu = brut(doc);
    for (const mot of ['Direction', 'Planification', 'Scolaire']) expect(contenu).toContain(mot);
  });

  it('au-delà de lignesMax : tronqué AVEC « … », pour que ça se voie', () => {
    const doc = nouveau();
    const enorme = 'x'.repeat(300);
    const lignes = ecrireAjuste(doc, enorme, 10, 10, 30, { taille: 9, tailleMin: 7, lignesMax: 2 });
    expect(lignes).toBe(2);
    expect(brut(doc)).toContain('\x85');             // « … » en WinAnsi
  });

  it('la ligne tronquée tient dans la largeur, points de suspension compris', () => {
    const doc = nouveau();
    ecrireAjuste(doc, 'y'.repeat(200), 10, 10, 30, { taille: 9, tailleMin: 7, lignesMax: 1 });
    // Ce qu'on a écrit : le texte de la dernière ligne + « … » ne dépasse pas 30 mm.
    doc.setFontSize(7);
    const ecrit = (brut(doc).match(/\((y+)\x85\) Tj/) ?? [])[1] ?? '';
    expect(ecrit.length).toBeGreaterThan(3);
    expect(doc.getTextWidth(`${ecrit}…`)).toBeLessThanOrEqual(30.5);
  });

  it('ne perd jamais tout : au moins une ligne, même pour un texte vide', () => {
    expect(ecrireAjuste(nouveau(), '', 10, 10, 30, { taille: 9 })).toBe(1);
  });
});

describe('decouperProprement — couper aux séparateurs naturels, jamais en plein mot', () => {
  const doc = nouveau();
  doc.setFontSize(8);

  it('une adresse e-mail se coupe après un point ou l\'arobase', () => {
    const lignes = decouperProprement(doc, 'mamadou.lamine.diallo.comptabilite@collegesainteanne.sn', 45);
    expect(lignes.length).toBeGreaterThan(1);
    expect(lignes.join('')).toBe('mamadou.lamine.diallo.comptabilite@collegesainteanne.sn');   // rien ne manque
    // Chaque ligne se termine sur un séparateur, sauf la dernière.
    for (const l of lignes.slice(0, -1)) expect(l).toMatch(/[.@\-_/]$/);
  });

  it('une référence se coupe après un tiret', () => {
    const lignes = decouperProprement(doc, 'WV-2026-09-19-000088213-XYZ', 25);
    expect(lignes.join('')).toBe('WV-2026-09-19-000088213-XYZ');
    for (const l of lignes.slice(0, -1)) expect(l).toMatch(/-$/);
  });

  it('un texte ordinaire se coupe aux espaces, comme d\'habitude', () => {
    const lignes = decouperProprement(doc, 'Participation au voyage pédagogique de fin année', 40);
    expect(lignes.join(' ')).toBe('Participation au voyage pédagogique de fin année');
  });

  it('un mot seul plus large que la ligne est coupé en dernier recours, sans rien perdre', () => {
    const lignes = decouperProprement(doc, 'x'.repeat(120), 20);
    expect(lignes.length).toBeGreaterThan(1);
    expect(lignes.join('')).toBe('x'.repeat(120));
  });

  it('un texte qui tient reste une seule ligne, intacte', () => {
    expect(decouperProprement(doc, 'Espèces', 40)).toEqual(['Espèces']);
    expect(decouperProprement(doc, '', 40)).toEqual(['']);
  });
});
