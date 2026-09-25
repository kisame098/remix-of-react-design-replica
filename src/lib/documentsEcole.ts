import type jsPDF from 'jspdf';

// ═══════════════════════════════════════════════════════════════════════════
// BRIQUES COMMUNES DES DOCUMENTS OFFICIELS DE L'ÉCOLE (reçu, fiche d'inscription)
//
// En-tête avec le logo de l'école, dates, ouverture/téléchargement du PDF. Le
// dessin des bulletins garde le sien (src/lib/bulletinPdf.ts) : ces documents-ci
// ont une charte plus sobre, pensée pour l'impression noir et blanc.
// ═══════════════════════════════════════════════════════════════════════════

/** Ce dont un document a besoin pour se signer au nom de l'école. */
export interface InfosEcole {
  nom: string;
  ville?: string;
  pays?: string;
  telephone?: string;
  email?: string;
  /** Adresse postale ou physique (Paramètres > École). */
  adresse?: string;
  /** N° d'agrément / NINEA (Paramètres > École). */
  ninea?: string;
  /** N° d'autorisation d'ouverture (Paramètres > École) — documents officiels de la formation professionnelle. */
  autorisation?: string;
  /** N° du registre de commerce (Paramètres > École). */
  rc?: string;
  /** Logo en data URL (Paramètres > École) — jamais un lien distant. */
  logo?: string | null;
}

/** Forme minimale d'une école telle que la fournit AuthContext. */
export interface EcoleSource {
  name?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  settings?: Record<string, unknown> | null;
}

const texte = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** Adresse et NINEA vivent dans `schools.settings` (voir Paramètres > École). */
export const CLE_ADRESSE_ECOLE = 'adresse';
export const CLE_NINEA_ECOLE = 'ninea';
export const CLE_AUTORISATION_ECOLE = 'autorisationOuverture';
export const CLE_RC_ECOLE = 'registreCommerce';

export const infosEcole = (school: EcoleSource | null | undefined): InfosEcole => ({
  nom: texte(school?.name) ?? 'École',
  ville: texte(school?.city),
  pays: texte(school?.country),
  telephone: texte(school?.phone),
  email: texte(school?.email),
  adresse: texte(school?.settings?.[CLE_ADRESSE_ECOLE]),
  ninea: texte(school?.settings?.[CLE_NINEA_ECOLE]),
  autorisation: texte(school?.settings?.[CLE_AUTORISATION_ECOLE]),
  rc: texte(school?.settings?.[CLE_RC_ECOLE]),
  logo: school?.logo_url || null,
});

// ─── Dates ────────────────────────────────────────────────────────────────────
// Toujours à l'heure de Dakar : un reçu réimprimé depuis un autre fuseau, ou un
// test lancé sur une autre machine, doit afficher la MÊME heure de paiement.

const partiesDakar = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Dakar', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const v = (t: string) => parties.find(p => p.type === t)?.value ?? '';
  return { j: v('day'), m: v('month'), a: v('year'), h: v('hour'), min: v('minute') };
};

/** « 19/09/2026 » — chaîne vide si la date est illisible. */
export const dateDakar = (iso: string): string => {
  const p = partiesDakar(iso);
  return p ? `${p.j}/${p.m}/${p.a}` : '';
};

/** « 19/09/2026 à 14:32 ». */
export const dateHeureDakar = (iso: string): string => {
  const p = partiesDakar(iso);
  return p ? `${p.j}/${p.m}/${p.a} à ${p.h}:${p.min}` : '';
};

/** Le bleu nuit de SenClass, quand aucune teinte n'est fournie. */
export const COULEUR_MONOGRAMME_PAR_DEFAUT = '#1F3A5F';

const MOIS_LONGS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 19 septembre 2026 à 14:32 » — heure de Dakar. */
export const dateLongueDakar = (iso: string): string => {
  const p = partiesDakar(iso);
  if (!p) return '';
  const mois = MOIS_LONGS[Number(p.m) - 1] ?? p.m;
  return `${Number(p.j)}${p.j === '01' ? 'er' : ''} ${mois} ${p.a} à ${p.h}:${p.min}`;
};

// ─── Dessin ───────────────────────────────────────────────────────────────────

/** Les deux premières lettres significatives du nom : « Collège Sainte Anne » → « CS ». */
export const initialesEcole = (nom: string): string => {
  const mots = nom.split(/[\s'’-]+/).filter(m => m.length > 2 || /^[A-ZÉÈ]/.test(m));
  const lettres = (mots.length >= 2 ? [mots[0], mots[1]] : [mots[0] ?? nom]).map(m => m[0]).join('');
  return lettres.toUpperCase().slice(0, 2) || 'E';
};

/**
 * Le logo de l'école, à ses proportions (jamais déformé). Sans logo — ou si
 * l'image est illisible — un monogramme aux initiales de l'école : mieux qu'un
 * trou blanc sur un document officiel.
 */
export const dessinerLogoEcole = (
  doc: jsPDF, ecole: InfosEcole, x: number, y: number, w: number, h: number,
  /** Couleur du monogramme quand il n'y a pas de logo : la teinte du document. */
  couleurMonogramme = COULEUR_MONOGRAMME_PAR_DEFAUT,
): void => {
  if (ecole.logo) {
    try {
      const { width: imgW, height: imgH, fileType } = doc.getImageProperties(ecole.logo);
      const ratio = Math.min(w / imgW, h / imgH);
      const dw = imgW * ratio;
      const dh = imgH * ratio;
      doc.addImage(ecole.logo, fileType, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      return;
    } catch { /* image illisible : monogramme */ }
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  doc.setDrawColor(couleurMonogramme);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, r, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(r * 1.5);
  doc.setTextColor(couleurMonogramme);
  doc.text(initialesEcole(ecole.nom), cx, cy + r * 0.28, { align: 'center' });
};

/** Lignes de coordonnées sous le nom : « Dakar, Sénégal », « Tél. … · email », « NINEA … ». */
export const lignesCoordonnees = (ecole: InfosEcole): string[] => {
  const lieu = [ecole.adresse, [ecole.ville, ecole.pays].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
  const contact = [ecole.telephone && `Tél. ${ecole.telephone}`, ecole.email].filter(Boolean).join('  ·  ');
  return [lieu, contact, ecole.ninea && `N° d'agrément / NINEA : ${ecole.ninea}`]
    .filter((l): l is string => typeof l === 'string' && l.length > 0);
};

// ─── Sortie ───────────────────────────────────────────────────────────────────

/** Nom de fichier sûr : sans accents ni caractères qui gênent un système de fichiers. */
export const nomDeFichier = (texteBrut: string): string =>
  texteBrut.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const telechargerPdf = (doc: jsPDF, nom: string): void => { doc.save(`${nomDeFichier(nom)}.pdf`); };

/**
 * Ouvre le PDF dans un nouvel onglet avec la fenêtre d'impression prête.
 * Renvoie `false` si le navigateur a bloqué l'ouverture (fenêtre surgissante) :
 * l'appelant propose alors le téléchargement plutôt que de ne rien faire.
 */
export const imprimerPdf = (doc: jsPDF): boolean => {
  doc.autoPrint();
  const fenetre = window.open(String(doc.output('bloburl')), '_blank');
  return fenetre !== null;
};
