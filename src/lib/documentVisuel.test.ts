import { describe, it, expect } from 'vitest';
import {
  visuelVersHtml, nouvelElement, documentVierge, cssContenu, versStyleReact, lireDocumentVisuel, dimensionsPage,
  type DocumentVisuel, type ElementTexte,
} from './documentVisuel';
import { produireDocuments, verifierModele, contexteExemple, CLASSE_PAGE } from './modelesDocuments';
import { MODELES_PAR_DEFAUT } from './modelesDocumentsParDefaut';
import { lireSource, verifierSource } from './modeleDocument';

const lire = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('page libre → HTML', () => {
  it('chaque élément est posé en millimètres, dans l\'ordre (le dernier au premier plan)', () => {
    const doc = documentVierge();
    const t = { ...nouvelElement('texte', 'portrait'), x: 20, y: 30, l: 100, h: 10, html: 'Bonjour {CLASSE}' } as ElementTexte;
    const r = { ...nouvelElement('forme', 'portrait', { forme: 'ellipse' }), x: 5, y: 6 };
    doc.elements = [r, t];
    const page = lire(visuelVersHtml(doc)).querySelector(`.${CLASSE_PAGE}`)!;
    const enfants = Array.from(page.children) as HTMLElement[];
    expect(enfants).toHaveLength(2);
    expect(enfants[0].style.borderRadius).toBe('50%');
    expect(enfants[1].style.left).toBe('20mm');
    expect(enfants[1].style.top).toBe('30mm');
    expect(enfants[1].textContent).toBe('Bonjour {CLASSE}');
  });

  it('paysage : feuille de 297 × 210 mm et impression en paysage', () => {
    const html = visuelVersHtml(documentVierge('paysage'));
    expect(dimensionsPage('paysage')).toEqual({ largeur: 297, hauteur: 210 });
    expect(html).toContain('width: 297mm; height: 210mm');
    expect(html).toContain('size: A4 landscape');
  });

  it('le logo est un champ dans src : vérifié, puis remplacé par le logo de l\'école', () => {
    const doc = documentVierge();
    doc.elements = [nouvelElement('image', 'portrait', { source: 'logo' })];
    const html = visuelVersHtml(doc);
    expect(verifierModele(html).ok).toBe(true);
    const c = { ...contexteExemple({ nom: 'X', logo: 'data:image/png;base64,LOGO' }), date: '2026-10-10' };
    expect(produireDocuments(html, [c]).html).toContain('src="data:image/png;base64,LOGO"');
  });

  it('un champ inconnu tapé dans une zone de texte est refusé, comme ailleurs', () => {
    const doc = documentVierge();
    doc.elements = [{ ...nouvelElement('texte', 'portrait'), html: 'Tél. {TÉLÉPHONE 2}' } as ElementTexte];
    expect(verifierSource({ genre: 'visuel', contenu: doc }).inconnus).toEqual(['TÉLÉPHONE 2']);
  });

  it('un texte piégé (script, onclick) ne survit pas à la production', () => {
    const doc = documentVierge();
    doc.elements = [{ ...nouvelElement('texte', 'portrait'), html: '<b onclick="x()">{CLASSE}</b><script>vol()</script>' } as ElementTexte];
    const p = produireDocuments(visuelVersHtml(doc), [contexteExemple({ nom: 'X' })]);
    expect(p.html).not.toMatch(/onclick|<script/);
    expect(p.html).toContain('<b>6ème A</b>');
  });

  it('les styles de texte deviennent du CSS (et des propriétés React pour l\'éditeur)', () => {
    const t = nouvelElement('texte', 'portrait') as ElementTexte;
    const css = cssContenu({ ...t, style: { ...t.style, gras: true, taille: 18, alignement: 'center' } });
    expect(css).toMatchObject({ 'font-weight': 'bold', 'font-size': '18pt', 'text-align': 'center' });
    expect(versStyleReact(css)).toMatchObject({ fontWeight: 'bold', fontSize: '18pt', textAlign: 'center' });
  });
});

describe('page vide ou faite seulement de formes', () => {
  it('une page sans rien est refusée ; une page avec seulement un cadre est acceptée', () => {
    expect(verifierSource({ genre: 'visuel', contenu: documentVierge() }).erreur).toMatch(/vide/);
    const cadre = documentVierge();
    cadre.elements = [nouvelElement('forme', 'portrait')];
    expect(verifierSource({ genre: 'visuel', contenu: cadre }).ok).toBe(true);
  });
});

describe('lecture prudente d\'un document enregistré', () => {
  it('une donnée inattendue ne fait jamais planter : null, ou les éléments inconnus écartés', () => {
    expect(lireDocumentVisuel(null)).toBeNull();
    expect(lireDocumentVisuel({ version: 2, elements: [] })).toBeNull();
    const d = lireDocumentVisuel({ version: 1, orientation: 'n\'importe quoi', elements: [{ type: 'texte' }, { type: 'video' }, null] }) as DocumentVisuel;
    expect(d.orientation).toBe('portrait');
    expect(d.elements).toHaveLength(1);
  });

  it('une ligne de la base devient une source selon son genre', () => {
    expect(lireSource({ genre: 'html', html: '<p>x</p>' })).toEqual({ genre: 'html', html: '<p>x</p>' });
    expect(lireSource({ genre: 'word', fichier: 'AAAA' })).toEqual({ genre: 'word', fichier: 'AAAA' });
    expect(lireSource({ genre: 'visuel', contenu: { version: 1, elements: [] } })?.genre).toBe('visuel');
    expect(lireSource({ genre: 'visuel', contenu: 'cassé' })).toBeNull();
  });
});

describe('modèles fournis par SenClass', () => {
  it('les 7 documents scolaires sont fournis, chacun valide, avec le logo, rempli pour SA cible', () => {
    expect(MODELES_PAR_DEFAUT.map(m => m.nom)).toEqual([
      'Certificat de scolarité', "Certificat d'inscription", "Convocation de l'élève", "Convocation d'un parent",
      "Demande de permission d'absence — élève", "Demande de permission d'absence — professeur",
      'Autorisation parentale de sortie scolaire',
    ]);
    for (const m of MODELES_PAR_DEFAUT) {
      const v = verifierSource({ genre: 'visuel', contenu: m.contenu });
      expect(v, m.nom).toMatchObject({ ok: true, inconnus: [] });
      expect(v.utilises, m.nom).toContain("LOGO DE L'ÉTABLISSEMENT");
      const p = produireDocuments(visuelVersHtml(m.contenu), [contexteExemple({ nom: 'Les Roses', directeurGeneral: 'Ousmane FALL' })]);
      expect(p.refus, m.nom).toBeUndefined();
      expect(p.html, m.nom).toMatch(v.cible === 'professeur' ? /Mamadou SARR/ : /DIOP Awa|Awa DIOP/);
    }
    const prof = MODELES_PAR_DEFAUT.find(m => m.nom.includes('professeur'))!;
    expect(verifierSource({ genre: 'visuel', contenu: prof.contenu }).cible).toBe('professeur');
  });

  it('noir et blanc uniquement (documents administratifs) : aucune autre couleur, aucun fond gris', () => {
    for (const m of MODELES_PAR_DEFAUT) {
      const html = visuelVersHtml(m.contenu);
      const couleurs = (html.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) ?? []).map(c => c.toLowerCase());
      expect(couleurs.filter(c => !['#000', '#000000', '#fff', '#ffffff', '#e5e5e5'].includes(c)), m.nom).toEqual([]);
      for (const el of m.contenu.elements) if ('fond' in el) expect(el.fond, m.nom).toBeNull();
    }
  });

  it('chaque élément a un identifiant unique (les copier n\'en mélange jamais deux)', () => {
    const ids = MODELES_PAR_DEFAUT.flatMap(m => m.contenu.elements.map(e => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
