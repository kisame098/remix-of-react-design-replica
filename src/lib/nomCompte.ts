// ═══════════════════════════════════════════════════════════════════════════
// QUI A FAIT L'OPÉRATION ? — le nom écrit dans « Encaissé par », « Annulé par ».
//
// Ce nom ne doit JAMAIS être vide : c'est la trace qui départage une école et
// une famille en cas de litige. Le 19 et le 22 octobre 2026, trois paiements de
// La Recherche sont partis sans nom : l'onglet utilisé n'avait pas réussi à lire
// la fiche profil au démarrage, et le nom ne venait que d'elle.
//
// D'où l'ordre : nom de la fiche profil, e-mail de la fiche, puis e-mail de
// CONNEXION — ce dernier existe toujours dès qu'on est connecté, même quand la
// fiche n'a pas pu être lue.
//
// La base a le dernier mot (docs/sql/encaisse_par_serveur.sql) : elle remplace
// ce nom par celui du compte réellement connecté. Celui-ci reste utile hors de
// ce chemin (affichage immédiat, ancienne base pas encore mise à jour).
// Fonction pure, testée dans nomCompte.test.ts.
// ═══════════════════════════════════════════════════════════════════════════

const propre = (v: string | null | undefined): string | undefined => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t.length > 0 ? t : undefined;
};

export const nomDuCompte = (
  profile: { full_name?: string | null; email?: string | null } | null | undefined,
  user: { email?: string | null } | null | undefined,
): string | undefined =>
  propre(profile?.full_name) ?? propre(profile?.email) ?? propre(user?.email);
