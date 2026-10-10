import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { champConnu, normaliserNomChamp } from '@/lib/modelesDocuments';

// ═══════════════════════════════════════════════════════════════════════════
// MODÈLES WORD (.docx)
//
// Le fichier Word de l'école est gardé TEL QUEL : SenClass remplace seulement
// les champs écrits entre accolades — {NOM ET PRÉNOM DE L'ÉLÈVE} — et rend un
// Word identique à l'original, rempli. Même règle que partout : un champ que
// SenClass ne connaît pas est REFUSÉ.
//
// Word découpe souvent un texte en plusieurs morceaux invisibles (correcteur,
// mise en forme) : docxtemplater recolle les champs coupés. Le logo ne peut
// pas être inséré par SenClass dans un Word : l'école le met dans son fichier.
// ═══════════════════════════════════════════════════════════════════════════

/** Au-delà, le fichier est refusé : un Word avec quelques images tient largement dedans. */
export const TAILLE_MAX_WORD = 5 * 1024 * 1024;

export interface VerificationWord {
  ok: boolean;
  inconnus: string[];
  /** Champs image (logo) : impossibles dans un Word. */
  images: string[];
  utilises: string[];
  erreur?: string;
}

const options = (parser: (tag: string) => { get: (scope: unknown) => unknown }) => ({
  delimiters: { start: '{', end: '}' },
  paragraphLoop: true,
  linebreaks: true,
  parser,
  nullGetter: () => '',
});

/** Message lisible pour une erreur de syntaxe du modèle (accolade non fermée…). */
const messageErreurModele = (e: unknown): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const erreurs: any[] = (e as any)?.properties?.errors ?? [];
  const premiere = erreurs[0]?.properties;
  const pres = premiere?.context || premiere?.xtag;
  if (pres) return `Accolades mal fermées dans le document, près de « ${String(pres).slice(0, 40)} ». Chaque champ s'écrit {COMME CECI}.`;
  return "Ce fichier n'est pas un document Word lisible (.docx).";
};

const ouvrir = (fichier: ArrayBuffer | Uint8Array): PizZip => new PizZip(fichier);

/** Lit les champs du Word et les compare au catalogue de SenClass. */
export const verifierWord = (fichier: ArrayBuffer | Uint8Array): VerificationWord => {
  const vide: VerificationWord = { ok: false, inconnus: [], images: [], utilises: [] };
  if (fichier.byteLength === 0) return { ...vide, erreur: 'Le fichier est vide.' };
  if (fichier.byteLength > TAILLE_MAX_WORD) return { ...vide, erreur: 'Le fichier dépasse 5 Mo : allégez les images qu\'il contient.' };
  let zip: PizZip;
  try { zip = ouvrir(fichier); } catch { return { ...vide, erreur: "Ce fichier n'est pas un document Word (.docx). Un ancien .doc doit d'abord être enregistré en .docx depuis Word." }; }
  if (!zip.file('word/document.xml')) return { ...vide, erreur: "Ce fichier n'est pas un document Word (.docx)." };

  const vus: string[] = [];
  try {
    // Le parseur est appelé une fois par champ à la lecture du modèle : on les note.
    new Docxtemplater(zip, options(tag => { vus.push(tag); return { get: () => '' }; }));
  } catch (e) {
    return { ...vide, erreur: messageErreurModele(e) };
  }
  const inconnus = new Set<string>();
  const images = new Set<string>();
  const utilises: string[] = [];
  for (const brut of vus) {
    const ch = champConnu(brut);
    if (!ch) { inconnus.add(brut.trim()); continue; }
    if (ch.image) images.add(ch.nom);
    if (!utilises.includes(ch.nom)) utilises.push(ch.nom);
  }
  return { ok: inconnus.size === 0 && images.size === 0, inconnus: [...inconnus], images: [...images], utilises };
};

/**
 * Remplit le Word pour un élève. Le modèle doit avoir été vérifié ; une
 * valeur absente laisse la case vide (jamais « undefined »).
 */
export const remplirWord = (fichier: ArrayBuffer | Uint8Array, valeurs: Map<string, string>): Uint8Array => {
  const doc = new Docxtemplater(ouvrir(fichier), options(tag => ({ get: () => valeurs.get(normaliserNomChamp(tag)) ?? '' })));
  doc.render({});
  return doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' }) as Uint8Array;
};

/** Plusieurs Word remplis → une archive .zip (un fichier par élève). */
export const archiverWords = (fichiers: { nom: string; contenu: Uint8Array }[]): Uint8Array => {
  const zip = new PizZip();
  const pris = new Set<string>();
  for (const f of fichiers) {
    let nom = `${f.nom}.docx`;
    for (let i = 2; pris.has(nom); i++) nom = `${f.nom} (${i}).docx`;
    pris.add(nom);
    zip.file(nom, f.contenu);
  }
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' }) as Uint8Array;
};

// ─── Stockage : le fichier voyage en base64 ────────────────────────────────

export const versBase64 = (octets: ArrayBuffer | Uint8Array): string => {
  const u = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
  let binaire = '';
  for (let i = 0; i < u.length; i += 0x8000) binaire += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(binaire);
};

export const depuisBase64 = (b64: string): Uint8Array => {
  const binaire = atob(b64);
  const u = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) u[i] = binaire.charCodeAt(i);
  return u;
};

export const TYPE_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
