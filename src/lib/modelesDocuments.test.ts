import { describe, it, expect } from 'vitest';
import {
  CHAMPS, champConnu, normaliserNomChamp, verifierModele, nettoyer, remplirModele, valeursChamps,
  champsVides, assemblerDocuments, versionImprimee, contexteExemple, CLASSE_FEUILLE, TAILLE_MAX_MODELE,
  produireDocuments, eleveDocument,
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
