import { describe, it, expect } from 'vitest';
import PizZip from 'pizzip';
import { verifierWord, remplirWord, archiverWords, versBase64, depuisBase64, TAILLE_MAX_WORD } from './modeleWord';
import { valeursChamps, contexteExemple } from './modelesDocuments';

/** Un vrai petit .docx : chaque élément de `runs` est un morceau de texte séparé, comme Word en fabrique. */
const docx = (paragraphes: string[][]): Uint8Array => {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const corps = paragraphes.map(runs => `<w:p>${runs.map(t => `<w:r><w:t xml:space="preserve">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r>`).join('')}</w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corps}</w:body></w:document>`);
  return zip.generate({ type: 'uint8array' }) as Uint8Array;
};

const texteDuWord = (fichier: Uint8Array): string =>
  (new PizZip(fichier).file('word/document.xml')?.asText() ?? '').replace(/<[^>]+>/g, '');

const ecole = { nom: 'Les Roses', ville: 'Thiès', directeurGeneral: 'Ousmane FALL' };

describe('modèle Word : vérification', () => {
  it('les champs connus sont acceptés, même coupés en morceaux par Word et avec l\'apostrophe courbe', () => {
    const v = verifierWord(docx([['Je soussigné ', '{NOM DU DIR', 'ECTEUR}'], ['certifie que {NOM ET PRÉNOM DE L’ÉLÈVE} est en {CLASSE}']]));
    expect(v.erreur).toBeUndefined();
    expect(v.ok).toBe(true);
    expect(v.utilises).toEqual(['NOM DU DIRECTEUR', "NOM ET PRÉNOM DE L'ÉLÈVE", 'CLASSE']);
  });

  it('un champ inconnu de SenClass est refusé, avec son nom', () => {
    const v = verifierWord(docx([['Tél. {TÉLÉPHONE 2} — {CLASSE}']]));
    expect(v.ok).toBe(false);
    expect(v.inconnus).toEqual(['TÉLÉPHONE 2']);
  });

  it('le logo ne peut pas être inséré par SenClass dans un Word : refusé, avec la raison', () => {
    const v = verifierWord(docx([["{LOGO DE L'ÉTABLISSEMENT}"]]));
    expect(v.ok).toBe(false);
    expect(v.images).toEqual(["LOGO DE L'ÉTABLISSEMENT"]);
  });

  it('une accolade non fermée est expliquée, sans plantage', () => {
    const v = verifierWord(docx([['Nom : {NOM DE L\'ÉLÈVE']]));
    expect(v.ok).toBe(false);
    expect(v.erreur).toMatch(/Accolades mal fermées/);
  });

  it('un fichier qui n\'est pas un .docx, vide ou trop lourd est refusé avec une raison', () => {
    expect(verifierWord(new TextEncoder().encode('pas un word')).erreur).toMatch(/pas un document Word/);
    expect(verifierWord(new Uint8Array(0)).erreur).toMatch(/vide/);
    expect(verifierWord(new Uint8Array(TAILLE_MAX_WORD + 1)).erreur).toMatch(/5 Mo/);
  });
});

describe('modèle Word : remplissage', () => {
  it('chaque champ reçoit la donnée de l\'élève ; le reste du document est intact', () => {
    const c = contexteExemple(ecole, '2026-2027');
    const rempli = remplirWord(docx([['Je soussigné ', '{NOM DU DIR', 'ECTEUR}'], ['{NOM ET PRÉNOM DE L’ÉLÈVE}, classe {CLASSE}, {ANNÉE SCOLAIRE}']]), valeursChamps(c));
    expect(texteDuWord(rempli)).toBe('Je soussigné Ousmane FALLDIOP Awa, classe 6ème A, 2026-2027');
  });

  it('une valeur absente laisse la case vide, jamais « undefined »', () => {
    const rempli = remplirWord(docx([['Père : {NOM DU PÈRE}.']]), new Map());
    expect(texteDuWord(rempli)).toBe('Père : .');
  });

  it('plusieurs élèves → une archive avec un Word par élève, sans écraser deux homonymes', () => {
    const f = docx([['x']]);
    const archive = new PizZip(archiverWords([{ nom: 'DIOP Awa', contenu: f }, { nom: 'DIOP Awa', contenu: f }, { nom: 'FALL Modou', contenu: f }]));
    expect(Object.keys(archive.files).sort()).toEqual(['DIOP Awa (2).docx', 'DIOP Awa.docx', 'FALL Modou.docx']);
  });

  it('le fichier fait l\'aller-retour en base64 sans perte', () => {
    const f = docx([['{CLASSE}']]);
    expect(depuisBase64(versBase64(f))).toEqual(f);
  });
});
