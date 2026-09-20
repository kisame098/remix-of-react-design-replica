import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════
// IDENTIFIANTS DE CONNEXION D'UN ÉLÈVE — pour les imprimer sur sa fiche.
//
// Le compte se crée EN ARRIÈRE-PLAN juste après l'inscription (SchoolContext,
// « fire-and-forget » volontaire : l'inscription ne doit pas attendre). Sa ligne
// dans `school_accounts` apparaît quelques centaines de millisecondes plus tard.
// On réessaie donc brièvement avant de conclure qu'il n'y en a pas.
//
// LE MOT DE PASSE N'EST PAS DANS LA LIGNE. Un déclencheur de la base
// (encrypt_school_account_password) le chiffre à l'enregistrement et VIDE la
// colonne `password_plain`. Il ne se lit que par la fonction
// `reveal_school_account_password`, qui vérifie que l'appelant est membre de
// l'école propriétaire du compte — la même que celle de l'écran « Identités ».
// (Une première version lisait `password_plain` : toujours vide, la fiche sortait
// sans page d'identifiants et sans le moindre message.)
// ═══════════════════════════════════════════════════════════════════════════

export interface IdentifiantsEleve { identifiant: string; motDePasse: string }

const attendre = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface OptionsChargement {
  tentatives?: number;
  delaiMs?: number;
  /** Injection pour les tests de la boucle de nouvelle tentative. */
  lire?: (inscriptionId: string) => Promise<IdentifiantsEleve | null>;
}

const lireEnBase = async (inscriptionId: string): Promise<IdentifiantsEleve | null> => {
  const { data: compte, error } = await supabase
    .from('school_accounts')
    .select('id, email')
    .eq('student_enrollment_id', inscriptionId)
    .eq('role', 'student')
    .maybeSingle();
  if (error || !compte?.id || !compte.email) return null;

  const { data: motDePasse, error: erreurMdp } = await supabase.rpc('reveal_school_account_password', {
    p_account_id: compte.id,
  });
  if (erreurMdp || !motDePasse) return null;
  return { identifiant: compte.email, motDePasse: String(motDePasse) };
};

/** `null` si le compte n'existe pas (encore) ou n'est pas lisible par ce membre du personnel. */
export const chargerIdentifiantsEleve = async (
  inscriptionId: string,
  { tentatives = 4, delaiMs = 600, lire = lireEnBase }: OptionsChargement = {},
): Promise<IdentifiantsEleve | null> => {
  for (let essai = 0; essai < tentatives; essai++) {
    try {
      const trouve = await lire(inscriptionId);
      if (trouve) return trouve;
    } catch { /* on réessaie */ }
    if (essai < tentatives - 1) await attendre(delaiMs);
  }
  return null;
};
