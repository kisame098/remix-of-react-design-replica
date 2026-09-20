// ═══════════════════════════════════════════════════════════════════════════
// MONTANT EN LETTRES — « Arrêté la présente somme à : vingt-cinq mille francs CFA »
//
// Sur un reçu, le montant en chiffres seul se falsifie d'un coup de stylo
// (25 000 → 125 000) ; la version en lettres protège le document.
//
// Règles du français appliquées ici :
//   • « vingt » et « cent » prennent un s quand ils sont multipliés ET que rien
//     ne les suit : « quatre-vingts », « deux cents » — mais « quatre-vingt-un »,
//     « deux cent un », « deux cent mille » (mille est invariable) ;
//   • « et un » à 21, 31, 41, 51, 61 et 71 — pas à 81 ni 91 ;
//   • « mille » ne prend jamais de « un » devant lui : « mille », pas « un mille » ;
//   • million et milliard sont des noms : ils prennent le s (« deux millions »)
//     et ce qui les précède garde son pluriel (« quatre-vingts millions ») ;
//   • « un million de francs », avec « de », quand rien ne suit million.
// ═══════════════════════════════════════════════════════════════════════════

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];

const DIZAINES: Record<number, string> = {
  20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante',
};

/** 1 à 99 (0 exclu). `pluriel` : « quatre-vingts » plutôt que « quatre-vingt ». */
const moinsDeCent = (n: number, pluriel: boolean): string => {
  if (n < 17) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  if (n < 70) {
    const base = DIZAINES[Math.floor(n / 10) * 10];
    const u = n % 10;
    if (u === 0) return base;
    return u === 1 ? `${base} et un` : `${base}-${UNITES[u]}`;
  }
  if (n < 80) {
    const r = n - 60;   // 10 à 19
    return r === 11 ? 'soixante et onze' : `soixante-${moinsDeCent(r, pluriel)}`;
  }
  const r = n - 80;     // 0 à 19
  if (r === 0) return pluriel ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${moinsDeCent(r, pluriel)}`;
};

/** 1 à 999. */
const moinsDeMille = (n: number, pluriel: boolean): string => {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  if (c === 0) return moinsDeCent(reste, pluriel);
  if (c === 1) return reste ? `cent ${moinsDeCent(reste, pluriel)}` : 'cent';
  return reste
    ? `${UNITES[c]} cent ${moinsDeCent(reste, pluriel)}`
    : `${UNITES[c]} cent${pluriel ? 's' : ''}`;
};

/** Entier de 0 à 999 999 999 999 en lettres, sans unité monétaire. */
export const nombreEnLettres = (valeur: number): string => {
  const n = Math.floor(Math.abs(valeur));
  if (!Number.isFinite(n) || n >= 1e12) throw new RangeError(`Montant hors limites : ${valeur}`);
  if (n === 0) return 'zéro';

  const milliards = Math.floor(n / 1e9);
  const millions  = Math.floor((n % 1e9) / 1e6);
  const milliers  = Math.floor((n % 1e6) / 1e3);
  const unites    = n % 1e3;

  const morceaux: string[] = [];
  if (milliards) morceaux.push(`${moinsDeMille(milliards, true)} milliard${milliards > 1 ? 's' : ''}`);
  if (millions)  morceaux.push(`${moinsDeMille(millions, true)} million${millions > 1 ? 's' : ''}`);
  if (milliers)  morceaux.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers, false)} mille`);
  if (unites)    morceaux.push(moinsDeMille(unites, true));
  return morceaux.join(' ');
};

/**
 * « Vingt-cinq mille francs CFA ». Le franc CFA n'a pas de centimes : un montant
 * décimal est arrondi à l'entier le plus proche.
 */
export const montantEnLettres = (montant: number): string => {
  const n = Math.round(montant);
  const texte = nombreEnLettres(n);
  // « un million DE francs » : le « de » n'apparaît que si rien ne suit million.
  const de = n >= 1e6 && n % 1e6 === 0 ? ' de' : '';
  const franc = n <= 1 ? 'franc' : 'francs';
  return `${texte.charAt(0).toUpperCase()}${texte.slice(1)}${de} ${franc} CFA`;
};

/**
 * « 25 000 » — regroupement par milliers avec une espace ordinaire.
 *
 * Pas `Intl.NumberFormat('fr-FR')` : il emploie l'espace fine insécable
 * (U+202F), que les polices standard d'un PDF ne savent pas dessiner — elle
 * sortirait en caractère parasite sur le reçu.
 */
export const formaterMontant = (montant: number): string =>
  String(Math.round(montant)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
