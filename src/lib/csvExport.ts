// ═══════════════════════════════════════════════════════════════════════════
// EXPORT CSV — listes d'élèves, de paiements, de classements, ouvertes dans
// Excel par un secrétariat.
//
// Deux pièges permanents, invisibles à l'écran et bien visibles dans Excel :
//   • le séparateur : Excel en config française attend un POINT-VIRGULE ; une
//     virgule met toute la ligne dans une seule cellule ;
//   • les guillemets et les retours à la ligne dans un champ (une adresse
//     "Cité Keur Gorgui, villa 12") décalent toutes les colonnes suivantes s'ils
//     ne sont pas échappés.
//
// Le BOM UTF-8 en tête est ce qui fait qu'Excel affiche « Ndèye » et non
// « NdÃ¨ye ». Fonctions pures, couvertes par csvExport.test.ts.
// ═══════════════════════════════════════════════════════════════════════════

/** BOM UTF-8 — sans lui, Excel (Windows) casse tous les accents. */
export const UTF8_BOM = '\uFEFF';

/** Un champ CSV : toujours entre guillemets, guillemets internes doublés. */
export const escapeCsvField = (value: string | number | null | undefined): string => {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
};

/**
 * Assemble un CSV complet : lignes libres d'en-tête (bannière), en-têtes de
 * colonnes, puis données. Séparateur point-virgule et fins de ligne CRLF,
 * comme l'attend Excel.
 */
export const buildCsv = (
  headers: string[],
  rows: (string | number | null | undefined)[][],
  bannerLines: string[] = [],
): string => {
  const lines = [
    ...bannerLines.map(escapeCsvField),
    ...(bannerLines.length > 0 ? [''] : []),
    headers.map(escapeCsvField).join(';'),
    ...rows.map(r => r.map(escapeCsvField).join(';')),
  ];
  return UTF8_BOM + lines.join('\r\n');
};

/** Nom de fichier sûr : sans accent ni caractère interdit par les systèmes de fichiers. */
export const sanitizeFilename = (s: string): string =>
  s.normalize('NFD')
   .replace(/[̀-ͯ]/g, '')
   .replace(/[^a-zA-Z0-9]+/g, '_');

// ─── Import : lecture des colonnes saisies à la main ────────────────────────

/** "15/03/2015", "15-3-2015" ou déjà "2015-03-15" → ISO ; null si illisible. */
export const parseImportedDate = (raw: string): string | null => {
  const s = (raw ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

/** "M", "H", "homme", "F", "femme"… → valeur interne ; null si ambigu. */
export const parseImportedSex = (raw: string): 'homme' | 'femme' | null => {
  const s = (raw ?? '').trim().toLowerCase();
  if (['m', 'homme', 'h'].includes(s)) return 'homme';
  if (['f', 'femme'].includes(s)) return 'femme';
  return null;
};
