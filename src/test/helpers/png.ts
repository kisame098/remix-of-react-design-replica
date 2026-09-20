import { deflateSync } from 'node:zlib';

// PNG minimal généré à la volée : les tests de PDF ont besoin d'un VRAI logo
// (jsPDF lit les octets de l'image), sans dépendre d'un fichier du dépôt.

const TABLE_CRC = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (octets: Uint8Array): number => {
  let c = 0xffffffff;
  for (const o of octets) c = TABLE_CRC[(c ^ o) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const bloc = (type: string, donnees: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + donnees.length);
  const vue = new DataView(out.buffer);
  vue.setUint32(0, donnees.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(donnees, 8);
  vue.setUint32(8 + donnees.length, crc32(out.subarray(4, 8 + donnees.length)));
  return out;
};

/** Rend un PNG RGBA `largeur × hauteur`, pixel par pixel, en data URL. */
export const pngDataUrl = (
  largeur: number, hauteur: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): string => {
  const brut = new Uint8Array((largeur * 4 + 1) * hauteur);
  for (let y = 0; y < hauteur; y++) {
    const debut = y * (largeur * 4 + 1);
    brut[debut] = 0;
    for (let x = 0; x < largeur; x++) brut.set(pixel(x, y), debut + 1 + x * 4);
  }
  const entete = new Uint8Array(13);
  const vue = new DataView(entete.buffer);
  vue.setUint32(0, largeur); vue.setUint32(4, hauteur);
  entete.set([8, 6, 0, 0, 0], 8);   // 8 bits, RGBA

  const morceaux = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    bloc('IHDR', entete), bloc('IDAT', deflateSync(brut)), bloc('IEND', new Uint8Array(0)),
  ];
  const total = new Uint8Array(morceaux.reduce((s, m) => s + m.length, 0));
  let o = 0;
  for (const m of morceaux) { total.set(m, o); o += m.length; }
  return `data:image/png;base64,${Buffer.from(total).toString('base64')}`;
};

/**
 * Un logo d'école plausible : disque, anneau blanc, disque central, fond transparent.
 * `principal` colore le corps du logo (bleu par défaut), `accent` le cœur (or).
 */
export const logoDeTest = (
  taille = 120,
  principal: [number, number, number] = [31, 95, 169],
  accent: [number, number, number] = [230, 165, 30],
): string =>
  pngDataUrl(taille, taille, (x, y) => {
    const c = taille / 2;
    const d = Math.hypot(x - c + 0.5, y - c + 0.5) / c;
    if (d > 1) return [0, 0, 0, 0];
    if (d > 0.82) return [...principal.map(v => Math.round(v * 0.7)), 255] as [number, number, number, number];
    if (d > 0.7) return [255, 255, 255, 255];
    if (d > 0.32) return [...principal, 255] as [number, number, number, number];
    return [...accent, 255] as [number, number, number, number];
  });
