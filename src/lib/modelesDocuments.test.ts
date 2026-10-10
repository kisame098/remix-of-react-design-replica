import { describe, it, expect } from 'vitest';
import {
  CHAMPS, champConnu, normaliserNomChamp, verifierModele, nettoyer, remplirModele, valeursChamps,
  champsVides, assemblerDocuments, versionImprimee, contexteExemple, CLASSE_FEUILLE, TAILLE_MAX_MODELE,
  produireDocuments, eleveDocument, lireReglagesPage, professeurDocument, ELEVE_VIDE, separerFeuilles, documentPret,
  type ContexteDocument,
} from './modelesDocuments';
import { MODELES_PAR_DEFAUT } from './modelesDocumentsParDefaut';
import { visuelVersHtml } from './documentVisuel';
import type { InfosEcole } from './documentsEcole';

const ecole: InfosEcole = {
  nom: 'Les Roses', ville: 'Thiès', telephone: '33 951 00 00', autorisation: '0123', directeurGeneral: 'Ousmane FALL',
};

const contexte = (modif: Partial<ContexteDocument['eleve']> = {}): ContexteDocument => {
  const base = contexteExemple(ecole, '2026-2027');
  return { ...base, date: '2026-10-10T10:00:00Z', eleve: { ...base.eleve, ...modif } };
};

const page = (corps: string, tete = '') => `<!DOCTYPE html><html><head>${tete}</head><body>${corps}</body></html>`;

// Le modèle envoyé par l'utilisateur (raccourci), tel quel.
const CERTIFICAT_UTILISATEUR = page(`
  <div class="school-name">{NOM DE L'ÉTABLISSEMENT}</div>
  <div class="school-type">{TYPE / DÉNOMINATION DE L'ÉTABLISSEMENT}</div>
  <div>Aut. {NUMÉRO D'AUTORISATION} / MEN / DEP / {ANNÉE}</div>
  <div>Tel : {TÉLÉPHONE 1} / {TÉLÉPHONE 2}</div>
  <div>{VILLE} le {DATE}</div>
  <span class="value">{NOM ET PRÉNOM DE L'ÉLÈVE}</span>
  <span>{DATE DE NAISSANCE} à {LIEU DE NAISSANCE}</span>
  <span>{NOM DU PÈRE} et de {NOM DE LA MÈRE}</span>
  <span>{CLASSE}</span> <span>{ANNÉE SCOLAIRE}</span>
  <div class="signature-name">{NOM DU DIRECTEUR}</div>`,
'<style>.label{white-space:nowrap} input[type="text"]{border:0} @media print { body { background: white; } }</style>');

describe('le catalogue des champs', () => {
  it('chaque champ a un nom unique (même sans accents) et dit d\'où vient sa valeur', () => {
    const noms = CHAMPS.map(c => normaliserNomChamp(c.nom));
    expect(new Set(noms).size).toBe(noms.length);
    for (const c of CHAMPS) expect(c.source.length, c.nom).toBeGreaterThan(3);
  });

  it('un nom de champ se reconnaît sans tenir compte des accents, de la casse, des espaces ni de l\'apostrophe courbe', () => {
    expect(champConnu("NOM DE L'ÉTABLISSEMENT")?.nom).toBe("NOM DE L'ÉTABLISSEMENT");
    expect(champConnu('  nom de l’etablissement ')?.nom).toBe("NOM DE L'ÉTABLISSEMENT");
    expect(champConnu('NOM  DU   PERE')?.nom).toBe('NOM DU PÈRE');
    expect(champConnu('TÉLÉPHONE 2')).toBeUndefined();
  });
});

describe('vérifier un modèle : un champ inconnu de SenClass est refusé', () => {
  it('le certificat envoyé tel quel est refusé, avec la liste exacte des champs inconnus', () => {
    const v = verifierModele(CERTIFICAT_UTILISATEUR);
    expect(v.ok).toBe(false);
    expect(v.inconnus.sort()).toEqual(['ANNÉE', 'TYPE / DÉNOMINATION DE L\'ÉTABLISSEMENT', 'TÉLÉPHONE 1', 'TÉLÉPHONE 2'].sort());
    expect(v.utilises).toEqual(expect.arrayContaining(['NOM DE L\'ÉTABLISSEMENT', 'NOM DU PÈRE', 'CLASSE', 'ANNÉE SCOLAIRE', 'NOM DU DIRECTEUR']));
  });

  it('les constantes écrites en clair et les champs connus suffisent : accepté', () => {
    const corrige = CERTIFICAT_UTILISATEUR
      .replace("{TYPE / DÉNOMINATION DE L'ÉTABLISSEMENT}", 'Établissement privé laïc')
      .replace('{ANNÉE}', '2015')
      .replace('{TÉLÉPHONE 1} / {TÉLÉPHONE 2}', "{TÉLÉPHONE DE L'ÉTABLISSEMENT} / 77 111 22 33");
    const v = verifierModele(corrige);
    expect(v.inconnus).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('les crochets du CSS (sélecteurs d\'attribut) ne sont pas des champs', () => {
    const v = verifierModele(page('<p>{CLASSE}</p>', '<style>input[type="text"]{color:red} a[href]{x:y}</style>'));
    expect(v.ok).toBe(true);
    expect(v.utilises).toEqual(['CLASSE']);
  });

  it('un champ caché dans un attribut est vérifié aussi', () => {
    expect(verifierModele(page('<p title="{INVENTÉ}">x</p>')).inconnus).toEqual(['INVENTÉ']);
  });

  it('le logo ne se met que dans <img src="…"> : écrit dans le texte, il est refusé', () => {
    expect(verifierModele(page('<img src="{LOGO DE L\'ÉTABLISSEMENT}"><p>x</p>')).ok).toBe(true);
    const v = verifierModele(page("<p>{LOGO DE L'ÉTABLISSEMENT}</p>"));
    expect(v.ok).toBe(false);
    expect(v.imagesMalPlacees).toEqual(["LOGO DE L'ÉTABLISSEMENT"]);
  });

  it('un modèle vide, sans contenu ou trop lourd est refusé avec une raison', () => {
    expect(verifierModele('   ').erreur).toMatch(/vide/);
    expect(verifierModele(page('   ')).erreur).toMatch(/aucun contenu/);
    expect(verifierModele('x'.repeat(TAILLE_MAX_MODELE + 1)).erreur).toMatch(/1 Mo/);
  });

  it('chaque modèle fourni par SenClass passe sa propre vérification', () => {
    expect(MODELES_PAR_DEFAUT.length).toBeGreaterThan(0);
    for (const m of MODELES_PAR_DEFAUT) {
      const v = verifierModele(visuelVersHtml(m.contenu));
      expect(v, m.nom).toMatchObject({ ok: true, inconnus: [], retraits: [] });
    }
  });
});

describe('le nettoyage : un modèle piégé ne peut rien exécuter ni appeler Internet', () => {
  it('scripts, onclick, liens javascript: et ressources Internet sont retirés, et l\'école est prévenue', () => {
    const piege = page(
      '<p onclick="alert(1)">a</p><script>vol()</script><a href="javascript:vol()">x</a><img src="https://pisteur.example/p.gif"><iframe src="https://x"></iframe>',
      '<link rel="stylesheet" href="https://fonts.example/a.css"><style>@import url("https://x/y.css"); .a{background:url(https://x/z.png)}</style>',
    );
    const { html, retraits } = nettoyer(piege);
    expect(html).not.toMatch(/onclick|<script|vol\(\)|javascript:|https?:\/\/|<iframe|<link/i);
    expect(retraits.length).toBeGreaterThanOrEqual(4);
  });

  it('les styles du modèle, les images intégrées (data:) et les champs dans src sont gardés', () => {
    const { html, retraits } = nettoyer(page(
      '<div class="page" style="color:red"><img src="data:image/png;base64,AAAA"><img src="{LOGO DE L\'ÉTABLISSEMENT}"></div>',
      '<style>.page{width:210mm} @page{size:A4;margin:0} @media print{body{background:white}}</style>',
    ));
    expect(retraits).toEqual([]);
    expect(html).toContain('.page{width:210mm}');
    expect(html).toContain('@media print');
    expect(html).toContain('data:image/png;base64,AAAA');
    expect(html).toContain('{LOGO DE L');
    expect(html).toContain('style="color:red"');
  });
});

describe('remplir un modèle pour un élève', () => {
  it('chaque champ reçoit la donnée de SenClass', () => {
    const v = valeursChamps(contexte());
    const html = remplirModele(page(
      "<p>{NOM DE L'ÉTABLISSEMENT} — {VILLE} le {DATE} ({DATE EN LETTRES})</p><p>{NOM ET PRÉNOM DE L'ÉLÈVE}, {NÉ OU NÉE} le {DATE DE NAISSANCE} à {LIEU DE NAISSANCE}</p><p>{NOM DU PÈRE} / {NOM DE LA MÈRE} — {CLASSE} {ANNÉE SCOLAIRE} — {NOM DU DIRECTEUR}</p>"), v);
    expect(html).toContain('Les Roses — Thiès le 10/10/2026 (10 octobre 2026)');
    expect(html).toContain('DIOP Awa, née le 05/03/2012 à Dakar');
    expect(html).toContain('Moussa DIOP / Fatou NDIAYE — 6ème A 2026-2027 — Ousmane FALL');
  });

  it('une valeur est posée comme TEXTE : un nom contenant du HTML ne devient jamais du code', () => {
    const html = remplirModele(page("<p>{NOM DE L'ÉLÈVE}</p>"), valeursChamps(contexte({ nom: '<img src=x onerror=alert(1)>' })));
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
  });

  it('les crochets du CSS ne sont pas touchés', () => {
    const html = remplirModele(page('<p>{CLASSE}</p>', '<style>a[href]{color:red}</style>'), valeursChamps(contexte()));
    expect(html).toContain('a[href]{color:red}');
  });

  it('le logo va dans src ; sans père ni mère enregistrés, ces champs restent vides et sont signalés', () => {
    const c = { ...contexte({ tuteurs: [{ nom: 'Aliou SECK', qualite: 'oncle', telephone: '70' }] }), ecole: { ...ecole, logo: 'data:image/png;base64,LOGO' } };
    const modele = page('<img src="{LOGO DE L\'ÉTABLISSEMENT}"><p>{NOM DU PÈRE} {NOM DE LA MÈRE} {NOM DU TUTEUR}</p>');
    const html = remplirModele(modele, valeursChamps(c));
    expect(html).toContain('src="data:image/png;base64,LOGO"');
    expect(html).toContain('Aliou SECK');
    expect(champsVides(verifierModele(modele), c)).toEqual(['NOM DU PÈRE', 'NOM DE LA MÈRE']);
  });

  it('une école sans logo : l\'image disparaît au lieu d\'afficher une icône cassée', () => {
    const html = remplirModele(page('<img src="{LOGO DE L\'ÉTABLISSEMENT}"><p>x</p>'), valeursChamps({ ...contexte(), ecole: { ...ecole, logo: null } }));
    expect(html).not.toContain('<img');
  });

  it('sexe inconnu (données reprises d\'un ancien logiciel) : « né(e) » et SEXE vide, jamais deviné', () => {
    const v = valeursChamps(contexte({ sexe: '' }));
    expect(v.get(normaliserNomChamp('NÉ OU NÉE'))).toBe('né(e)');
    expect(v.get('SEXE')).toBe('');
    expect(valeursChamps(contexte({ sexe: 'homme' })).get('SEXE')).toBe('Masculin');
  });
});

describe('plusieurs élèves d\'un coup', () => {
  it('une feuille par élève, chacune sur sa page, avec les styles du modèle', () => {
    const modele = page("<div class=\"page\">{NOM DE L'ÉLÈVE}</div>", '<style>.page{width:210mm}</style>');
    const html = assemblerDocuments(['DIOP', 'FALL', 'SECK'].map(nom => remplirModele(modele, valeursChamps(contexte({ nom })))));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const feuilles = doc.querySelectorAll(`.${CLASSE_FEUILLE}`);
    expect(Array.from(feuilles).map(f => f.textContent)).toEqual(['DIOP', 'FALL', 'SECK']);
    expect(html).toContain('.page{width:210mm}');
    expect(html).toMatch(/break-after:page/);
  });

  it('pour le PDF, les règles @media print du modèle s\'appliquent tout le temps', () => {
    expect(versionImprimee('<style>@media print { body{background:white} }</style>')).toBe('<style>@media all { body{background:white} }</style>');
  });
});

describe('produire les documents d\'une classe', () => {
  const c1 = contexte({ nom: 'DIOP', prenom: 'Awa' });
  const c2 = contexte({ nom: 'FALL', prenom: 'Modou', tuteurs: [] });

  it('un modèle avec un champ inconnu ne produit RIEN, même s\'il a été enregistré avant', () => {
    const p = produireDocuments(page('<p>{TÉLÉPHONE 2}</p>'), [c1]);
    expect(p.refus?.inconnus).toEqual(['TÉLÉPHONE 2']);
    expect(p.html).toBe('');
  });

  it('une feuille par élève, et la liste des champs restés vides avec les élèves concernés', () => {
    const p = produireDocuments(page("<p>{NOM ET PRÉNOM DE L'ÉLÈVE} fils de {NOM DU PÈRE}</p>"), [c1, c2]);
    expect(p.refus).toBeUndefined();
    expect(p.html).toContain('DIOP Awa fils de Moussa DIOP');
    expect(p.html).toContain('FALL Modou fils de');
    expect(p.vides).toEqual([{ champ: 'NOM DU PÈRE', eleves: ['FALL Modou'] }]);
  });

  it('le document produit est nettoyé APRÈS remplissage', () => {
    const p = produireDocuments(page('<p onclick="x()">{CLASSE}</p><script>vol()</script>'), [c1]);
    expect(p.html).not.toMatch(/onclick|<script/);
    expect(p.html).toContain('6ème A');
  });

  it('un élève de SchoolContext devient un élève de document (tuteurs, classe)', () => {
    const e = eleveDocument({
      studentId: 'ETU-1', firstName: 'Awa', lastName: 'DIOP', sex: 'femme', dateOfBirth: '2012-03-05',
      tutor1: { fullName: 'Fatou NDIAYE', phone: '76', status: 'mere' },
    }, '6ème A');
    expect(e).toMatchObject({ matricule: 'ETU-1', classe: '6ème A', tuteurs: [{ nom: 'Fatou NDIAYE', qualite: 'mere' }] });
  });

  it('une information de l\'école manquante (logo) est signalée UNE fois, avec où la remplir', () => {
    const p = produireDocuments(page('<img src="{LOGO DE L\'ÉTABLISSEMENT}"><p>{CLASSE}</p>'), [c1, c2]);
    expect(p.vides).toEqual([{ champ: "LOGO DE L'ÉTABLISSEMENT", eleves: [], source: expect.stringContaining('Paramètres') }]);
  });
});

describe('marges de la règle @page (appliquées à l\'impression seulement par le navigateur)', () => {
  const avecPage = (regle: string) => page('<p>{CLASSE}</p>', `<style>@page { ${regle} } body{margin:0}</style>`);

  it('lit les marges et l\'orientation', () => {
    expect(lireReglagesPage(avecPage('size: A4; margin: 2.2cm 2.5cm;'))).toEqual({ marges: '2.2cm 2.5cm', paysage: false, a5: false });
    expect(lireReglagesPage(avecPage('size: A4 landscape; margin: 1cm'))).toEqual({ marges: '1cm', paysage: true, a5: false });
    expect(lireReglagesPage(avecPage('margin: 1cm; margin-left: 3cm'))).toEqual({ marges: '1cm 1cm 1cm 3cm', paysage: false, a5: false });
  });

  it('sans marge (ou marge à 0, cas des modèles qui font eux-mêmes leur page), rien n\'est ajouté', () => {
    expect(lireReglagesPage(avecPage('size: A4; margin: 0;')).marges).toBeNull();
    expect(lireReglagesPage(page('<p>x</p>')).marges).toBeNull();
    expect(assemblerDocuments([avecPage('size: A4; margin: 0')])).not.toContain('padding:');
  });

  it('à l\'écran et dans le PDF, chaque feuille reprend ces marges ; à l\'impression, la feuille redevient neutre', () => {
    const html = assemblerDocuments([avecPage('size: A4; margin: 2.2cm 2.5cm;')]);
    expect(html).toContain('padding:2.2cm 2.5cm');
    expect(html).toContain('width:210mm');
    expect(html).toContain('@media only print');
    // Le PDF transforme « @media print » en « @media all » : la remise à zéro ne doit pas s'y appliquer.
    expect(versionImprimee(html)).toContain('@media only print');
  });

  it('une feuille déclarée A5 (reçu) fait 148 mm de large à l\'écran et dans le PDF, pas 210', () => {
    expect(lireReglagesPage(avecPage('size: A5 portrait; margin: 8mm')).a5).toBe(true);
    const html = assemblerDocuments([avecPage('size: A5 portrait; margin: 8mm')]);
    expect(html).toContain('width:148mm;min-height:210mm;padding:8mm');
  });
});

describe('documents de professeur', () => {
  it('un professeur : fiche + matières et classes tirées de l\'emploi du temps (sans doublon, triées)', () => {
    const p = professeurDocument(
      { id: 'e1', teacherId: 'PROF-1', firstName: 'Mamadou', lastName: 'SARR', sex: 'homme', contractType: 'vacataire' },
      [
        { teacherId: 'e1', subjectName: 'Physique', className: '5ème B' },
        { teacherId: 'e1', subjectName: 'Mathématiques', className: '6ème A' },
        { teacherId: 'e1', subjectName: 'Mathématiques', className: '5ème B' },
        { teacherId: 'autre', subjectName: 'Anglais', className: '4ème' },
      ],
    );
    expect(p).toMatchObject({ matieres: ['Mathématiques', 'Physique'], classes: ['5ème B', '6ème A'] });
    const v = valeursChamps({ ...contexteExemple(ecole), eleve: ELEVE_VIDE, professeur: p });
    expect(v.get(normaliserNomChamp('CIVILITÉ DU PROFESSEUR'))).toBe('Monsieur');
    expect(v.get(normaliserNomChamp('MATIÈRES ENSEIGNÉES'))).toBe('Mathématiques, Physique');
    expect(v.get(normaliserNomChamp('CONTRAT DU PROFESSEUR'))).toBe('Vacataire');
  });

  it('la cible du modèle se déduit de ses champs ; mélanger élève et professeur est refusé', () => {
    expect(verifierModele(page('<p>{CLASSE}</p>')).cible).toBe('eleve');
    expect(verifierModele(page('<p>{NOM DU PROFESSEUR}</p>')).cible).toBe('professeur');
    expect(verifierModele(page('<p>{NOM DE L\'ÉTABLISSEMENT}</p>')).cible).toBe('aucune');
    const mixte = verifierModele(page('<p>{NOM DU PROFESSEUR} {CLASSE}</p>'));
    expect(mixte.ok).toBe(false);
    expect(mixte.erreur).toMatch(/soit un élève, soit un professeur/);
  });
});

describe('séparer un document assemblé', () => {
  it('une feuille par élève, chacune avec les styles du modèle (pour le registre)', () => {
    const modele = page("<p>{NOM DE L'ÉLÈVE}</p>", '<style>p{color:red}</style>');
    const assemble = assemblerDocuments(['DIOP', 'FALL'].map(nom => remplirModele(modele, valeursChamps(contexte({ nom })))));
    const parts = separerFeuilles(assemble);
    expect(parts).toHaveLength(2);
    expect(parts[1]).toContain('FALL');
    expect(parts[1]).not.toContain('DIOP');
    expect(parts[1]).toContain('p{color:red}');
  });
});

describe('modèles de reçu', () => {
  const recu = { ...contexteExemple(ecole, '2026-2027'), date: '2026-10-10T10:00:00Z' };

  it('les champs du reçu se remplissent ; la cible est « reçu » (élève permis, professeur interdit)', () => {
    const modele = page("<p>{NUMÉRO DU REÇU} — {NOM ET PRÉNOM DE L'ÉLÈVE} — {MONTANT TOTAL} — {MONTANT EN LETTRES} — {MODE DE PAIEMENT}</p>");
    expect(verifierModele(modele).cible).toBe('recu');
    const html = documentPret(modele, recu);
    expect(html).toContain('REC-2026-00042 — DIOP Awa — 75 000 FCFA — Soixante-quinze mille francs CFA — Espèces');
    expect(verifierModele(page('<p>{NUMÉRO DU REÇU} {NOM DU PROFESSEUR}</p>')).ok).toBe(false);
  });

  it('{TABLEAU DES PAIEMENTS} devient un vrai tableau, à l\'endroit du champ, valeurs posées comme texte', () => {
    const c = { ...recu, recu: { ...recu.recu!, lignes: [{ designation: '<b>piège</b>', montant: 1000, annulee: true }, { designation: 'Cantine', montant: 5000, annulee: false }] } };
    const html = documentPret(page('<div class="avant">Avant</div><div>{TABLEAU DES PAIEMENTS}</div><p>Après</p>'), c);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const lignes = Array.from(doc.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(td => td.textContent));
    expect(lignes).toEqual([['Désignation', 'Montant (FCFA)'], ['<b>piège</b> (annulé)', '1 000'], ['Cantine', '5 000']]);
    expect(doc.querySelector('td')!.getAttribute('style')).toContain('line-through');
    expect(html).not.toContain('<b>piège</b>');
    expect(doc.body.textContent).toMatch(/Avant[\s\S]*Désignation[\s\S]*Après/);
  });

  it("dans le tableau de l'école (entre <tbody> et </tbody>), seulement des lignes, dans ses colonnes", () => {
    const c = { ...recu, recu: { ...recu.recu!, lignes: [{ designation: 'Inscription', montant: 50000, annulee: false }, { designation: 'Cantine', montant: 5000, annulee: true }] } };
    const modele = page(`<table><thead><tr><th>N°</th><th>Désignation</th><th>Montant</th></tr></thead>
      <tbody>{Tableau des paiements}<tr class="total"><td colspan="2">TOTAL</td><td>{Montant total}</td></tr></tbody></table>`);
    const doc = new DOMParser().parseFromString(documentPret(modele, c), 'text/html');
    expect(doc.querySelectorAll('table')).toHaveLength(1);
    const lignes = Array.from(doc.querySelectorAll('tr')).map(tr => Array.from(tr.cells).map(td => td.textContent));
    expect(lignes).toEqual([['N°', 'Désignation', 'Montant'], ['1', 'Inscription', '50 000'], ['2', 'Cantine (annulé)', '5 000'], ['TOTAL', '75 000 FCFA']]);
  });

  it('dans un tableau sans en-tête reconnu : désignation, puis montant en dernière colonne', () => {
    const doc = new DOMParser().parseFromString(documentPret(page('<table><tr><td>{TABLEAU DES PAIEMENTS}</td></tr><tr><td>a</td><td>b</td></tr></table>'), recu), 'text/html');
    expect(Array.from(doc.querySelectorAll('tr')).slice(0, 2).map(tr => Array.from(tr.cells).map(td => td.textContent)))
      .toEqual([["Frais d'inscription", '50 000'], ['Scolarité — Octobre 2026', '25 000']]);
  });

  it('mention ANNULÉ / DUPLICATA', () => {
    const v = (r: Partial<NonNullable<typeof recu.recu>>) => valeursChamps({ ...recu, recu: { ...recu.recu!, ...r } }).get(normaliserNomChamp('MENTION DU REÇU'));
    expect(v({})).toBe('');
    expect(v({ duplicata: true })).toBe('DUPLICATA');
    expect(v({ annule: true, duplicata: true })).toBe('ANNULÉ');
  });
});

describe('tableau des paiements — beaucoup de lignes', () => {
  it('au-delà de huit lignes, deux colonnes lues de haut en bas, comme le reçu SenClass', () => {
    const base = contexteExemple(ecole, '2026-2027');
    const lignes = Array.from({ length: 11 }, (_, i) => ({ designation: `Mois ${i + 1}`, montant: 1000, annulee: false }));
    const html = documentPret(page('<div>{TABLEAU DES PAIEMENTS}</div>'), { ...base, recu: { ...base.recu!, lignes } });
    const tables = Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('table'));
    expect(tables).toHaveLength(2);
    expect(tables.map(t => t.querySelectorAll('tr').length - 1)).toEqual([6, 5]);
    expect(tables[1].querySelector('td')!.textContent).toBe('Mois 7');
  });
});
