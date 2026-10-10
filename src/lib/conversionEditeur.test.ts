import { describe, it, expect } from 'vitest';
import { recollerChamps } from './conversionEditeur';
import { verifierModele } from './modelesDocuments';

const corps = (html: string) => {
  const d = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return d.body;
};

describe('recoller les champs coupés par Word', () => {
  it('un champ coupé en plusieurs balises est recollé dans la première, qui garde sa mise en forme', () => {
    const b = corps('<p><b>{NOM DE</b><span> L’ÉLÈ</span><i>VE}</i> est inscrit</p>');
    recollerChamps(b);
    expect(b.querySelector('b')!.textContent).toBe('{NOM DE L’ÉLÈVE}');
    expect(b.textContent).toBe('{NOM DE L’ÉLÈVE} est inscrit');
    expect(verifierModele(`<html><body>${b.innerHTML}</body></html>`).utilises).toEqual(["NOM DE L'ÉLÈVE"]);
  });

  it('le texte après l\'accolade fermante reste à sa place', () => {
    const b = corps('<p><span>Classe : {CLA</span><span>SSE} — année</span></p>');
    recollerChamps(b);
    expect(Array.from(b.querySelectorAll('span')).map(s => s.textContent)).toEqual(['Classe : {CLASSE}', ' — année']);
  });

  it('les champs déjà entiers ne bougent pas ; une accolade jamais fermée ne vole pas le texte suivant', () => {
    const b = corps('<p><span>{CLASSE}</span><span> et {DATE}</span></p><p><span>prix {</span><span>{VILLE}</span></p>');
    recollerChamps(b);
    expect(Array.from(b.querySelectorAll('span')).map(s => s.textContent)).toEqual(['{CLASSE}', ' et {DATE}', 'prix {', '{VILLE}']);
  });
});
