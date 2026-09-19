// ═══════════════════════════════════════════════════════════════════════════
// TEXTE DES NOTIFICATIONS — module pur, sans aucune API Deno.
//
// Il vit à côté de la fonction qui l'utilise (send-notifications) mais reste
// importable par les tests de l'application : ce que lit un élève sur son
// écran verrouillé se vérifie sans déployer quoi que ce soit.
//
// RÈGLE : rien de sensible dans le texte. Ni valeur de note, ni montant. Un
// téléphone posé sur une table ne doit rien révéler des résultats d'un enfant.
// ═══════════════════════════════════════════════════════════════════════════

export type GenreNotification = 'grade' | 'bulletin' | 'payment' | 'attendance';

/** Une ligne de `notification_queue`, réduite à ce dont la composition a besoin. */
export interface LigneFile {
  id: string;
  kind: GenreNotification;
  payload: Record<string, unknown>;
}

export interface NotificationAEnvoyer {
  title: string;
  body: string;
  /** Chemin interne ouvert au clic — toujours relatif au site. */
  url: string;
  /** Deux notifications de même étiquette se remplacent au lieu de s'empiler. */
  tag: string;
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 2026-09 » → « septembre 2026 » ; toute autre forme → `null`. */
export const libelleMois = (cle: unknown): string | null => {
  if (typeof cle !== 'string') return null;
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(cle);
  return m ? `${MOIS[Number(m[2]) - 1]} ${m[1]}` : null;
};

const uniques = (valeurs: unknown[]): string[] => {
  const vus = new Set<string>();
  for (const v of valeurs) {
    if (typeof v === 'string' && v.trim()) vus.add(v.trim());
  }
  return [...vus];
};

/** « A », « A et B », « A, B et C », « A, B, C et 2 autres ». */
export const enumeration = (noms: string[], maxCites = 3, singulierAutre = 'autre', plurielAutre = 'autres'): string => {
  if (noms.length <= 1) return noms[0] ?? '';
  if (noms.length <= maxCites) return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
  const cites = noms.slice(0, maxCites);
  const reste = noms.length - maxCites;
  return `${cites.join(', ')} et ${reste} ${reste > 1 ? plurielAutre : singulierAutre}`;
};

const composerNotes = (lignes: LigneFile[]): NotificationAEnvoyer => {
  const matieres = uniques(lignes.map(l => l.payload.matiere));
  return {
    title: matieres.length > 1 ? 'Nouvelles notes' : 'Nouvelle note',
    body: matieres.length === 0
      ? 'De nouvelles notes ont été saisies.'
      : matieres.length === 1
        ? `Une nouvelle note a été saisie en ${matieres[0]}.`
        : `Nouvelles notes en ${enumeration(matieres)}.`,
    url: '/portail/notes',
    tag: 'notes',
  };
};

const composerBulletins = (lignes: LigneFile[]): NotificationAEnvoyer => {
  const periodes = uniques(lignes.map(l => l.payload.periode));
  return {
    title: periodes.length > 1 ? 'Bulletins disponibles' : 'Bulletin disponible',
    body: periodes.length === 0
      ? 'Votre bulletin est disponible.'
      : periodes.length === 1
        ? `Votre bulletin (${periodes[0]}) est disponible.`
        : `Vos bulletins (${enumeration(periodes, 3, 'autre', 'autres')}) sont disponibles.`,
    url: '/portail/notes',
    tag: 'bulletin',
  };
};

const libellePaiement = (l: LigneFile): string => {
  const mois = libelleMois(l.payload.mois);
  switch (l.payload.type) {
    case 'inscription': return "l'inscription";
    case 'tuition':     return mois ? `la scolarité de ${mois}` : 'la scolarité';
    case 'service':     return mois ? `un service annexe (${mois})` : 'un service annexe';
    default:            return 'un paiement';
  }
};

const composerPaiements = (lignes: LigneFile[]): NotificationAEnvoyer => ({
  title: lignes.length > 1 ? 'Paiements enregistrés' : 'Paiement enregistré',
  body: lignes.length > 1
    ? `${lignes.length} paiements ont été enregistrés.`
    : `Votre paiement pour ${libellePaiement(lignes[0])} a bien été enregistré.`,
  url: '/portail/paiements',
  tag: 'paiements',
});

// ─── Présences ────────────────────────────────────────────────────────────────

type StatutPresence = 'absent' | 'late' | 'expelled' | 'corrige';

const estStatutPresence = (v: unknown): v is StatutPresence =>
  v === 'absent' || v === 'late' || v === 'expelled' || v === 'corrige';

/** « 2026-10-09 » → « 09/10 » ; toute autre forme → `null`. */
const jourCourt = (iso: unknown): string | null => {
  if (typeof iso !== 'string') return null;
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}/${m[1]}` : null;
};

const LIBELLES_UN: Record<Exclude<StatutPresence, 'corrige'>, string> = {
  absent:   'Absence',
  late:     'Retard',
  expelled: 'Renvoi du cours',
};

const TITRES_UN: Record<StatutPresence, string> = {
  absent: 'Absence enregistrée', late: 'Retard enregistré',
  expelled: 'Renvoi enregistré', corrige: 'Présence corrigée',
};

/** « en Mathématiques (08:00), le 09/10 » — la date n'est dite que si ce n'est pas aujourd'hui. */
const precisionCours = (l: LigneFile, aujourdhui: string): string => {
  const matiere = typeof l.payload.matiere === 'string' && l.payload.matiere.trim()
    ? ` en ${l.payload.matiere.trim()}` : ' à un cours';
  const heure = typeof l.payload.heure === 'string' && /^\d{1,2}:\d{2}$/.test(l.payload.heure)
    ? ` (${l.payload.heure})` : '';
  const jour = l.payload.date !== aujourdhui ? jourCourt(l.payload.date) : null;
  return `${matiere}${heure}${jour ? `, le ${jour}` : ''}`;
};

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/**
 * Le nom de l'élève n'apparaît jamais : le texte s'affiche sur un écran
 * verrouillé, et ce compte est parfois lu par un parent, parfois par l'enfant.
 * `aujourdhui` (AAAA-MM-JJ, UTC = Dakar) sert à ne dire la date que si elle
 * n'est pas celle du jour.
 */
const composerPresences = (lignes: LigneFile[], aujourdhui: string): NotificationAEnvoyer | null => {
  const evenements = lignes.filter(l => estStatutPresence(l.payload.statut));
  if (evenements.length === 0) return null;   // rien de lisible : mieux vaut se taire
  const commun = { url: '/portail/presences', tag: 'presences' };

  if (evenements.length === 1) {
    const statut = evenements[0].payload.statut as StatutPresence;
    return {
      ...commun,
      title: TITRES_UN[statut],
      body: statut === 'corrige'
        ? `Correction : la présence${precisionCours(evenements[0], aujourdhui)} est finalement rétablie.`
        : `${LIBELLES_UN[statut]}${precisionCours(evenements[0], aujourdhui)}.`,
    };
  }

  const compte = (st: StatutPresence) => evenements.filter(l => l.payload.statut === st).length;
  const morceaux = [
    compte('absent') && pluriel(compte('absent'), 'absence', 'absences'),
    compte('late') && pluriel(compte('late'), 'retard', 'retards'),
    compte('expelled') && pluriel(compte('expelled'), 'renvoi', 'renvois'),
    compte('corrige') && pluriel(compte('corrige'), 'correction', 'corrections'),
  ].filter((m): m is string => typeof m === 'string');
  const matieres = uniques(evenements.map(l => l.payload.matiere));

  return {
    ...commun,
    title: 'Présences enregistrées',
    body: `Présences : ${enumeration(morceaux, 4)}${matieres.length ? ` (${enumeration(matieres)})` : ''}.`,
  };
};

/**
 * Regroupe les lignes d'UN compte en au plus une notification par genre :
 * quarante notes saisies d'un coup donnent « Nouvelles notes en … », pas
 * quarante sonneries.
 */
export const composerNotifications = (
  lignes: LigneFile[], maintenant: Date = new Date(),
): NotificationAEnvoyer[] => {
  const parGenre = new Map<GenreNotification, LigneFile[]>();
  for (const l of lignes) parGenre.set(l.kind, [...(parGenre.get(l.kind) ?? []), l]);

  const resultat: NotificationAEnvoyer[] = [];
  const notes = parGenre.get('grade');    if (notes?.length)    resultat.push(composerNotes(notes));
  const buls  = parGenre.get('bulletin'); if (buls?.length)     resultat.push(composerBulletins(buls));
  const pays  = parGenre.get('payment');  if (pays?.length)     resultat.push(composerPaiements(pays));
  const pres  = parGenre.get('attendance');
  const presences = pres?.length ? composerPresences(pres, maintenant.toISOString().slice(0, 10)) : null;
  if (presences) resultat.push(presences);
  return resultat;
};
