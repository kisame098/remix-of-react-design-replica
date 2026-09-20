import { describe, it, expect } from 'vitest';
import { doitRechargerDOffice, estUneErreurDeChargement } from './rechargementApresDeploiement';

// ════════════════════════════════════════════════════════════════════════════
// Une mise en ligne pendant qu'un onglet reste ouvert ne doit pas détruire le
// travail en cours de quelqu'un qui clique sur « Imprimer le reçu ».
// ════════════════════════════════════════════════════════════════════════════

const chrome = (fichier: string) =>
  new Error(`Failed to fetch dynamically imported module: https://senclass.com/assets/${fichier}`);

describe('doitRechargerDOffice', () => {
  it('changement de page (fichier d\'un écran) : recharger, on n\'a rien à perdre', () => {
    expect(doitRechargerDOffice(chrome('Caisse-Ab12Cd34.js'))).toBe(true);
    expect(doitRechargerDOffice(chrome('StudentManagement-9f8e7d6c.js'))).toBe(true);
  });

  it.each(['recuPdf-QSxsZVHg.js', 'ficheInscriptionPdf-ClmhKcDz.js'])(
    '%s (générateur de PDF, chargé au clic) : NE PAS recharger — le travail en cours est sacré',
    (fichier) => expect(doitRechargerDOffice(chrome(fichier))).toBe(false),
  );

  it('erreur sans nom de fichier (Safari, Firefox) : comportement historique, on recharge', () => {
    expect(doitRechargerDOffice(new Error('Importing a module script failed.'))).toBe(true);
    expect(doitRechargerDOffice('error loading dynamically imported module')).toBe(true);
    expect(doitRechargerDOffice(undefined)).toBe(true);
  });

  it('accepte une erreur sous forme d\'objet ou de texte', () => {
    expect(doitRechargerDOffice({ message: 'x /assets/recuPdf-zzz.js' })).toBe(false);
    expect(doitRechargerDOffice('Unable to preload CSS for /assets/ficheInscriptionPdf-a1.css')).toBe(false);
  });
});

describe('estUneErreurDeChargement', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/a.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
    'Unable to preload CSS for /assets/a.css',
  ])('reconnaît : %s', (m) => expect(estUneErreurDeChargement(new Error(m))).toBe(true));

  it.each([new Error('Cannot read properties of undefined'), new Error('Network request failed'), null, undefined, 42])(
    'ne confond pas une autre erreur avec un fichier introuvable : %s',
    (e) => expect(estUneErreurDeChargement(e)).toBe(false),
  );
});
