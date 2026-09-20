import { supabase } from '@/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════
// IDENTIFIANTS DE CONNEXION D'UN ÉLÈVE — pour les imprimer sur sa fiche.
//
// Le compte se crée EN ARRIÈRE-PLAN juste après l'inscription (SchoolContext,
// « fire-and-forget » volontaire : l'inscription ne doit pas attendre). Sa ligne
// dans `school_accounts` apparaît quelques centaines de millisecondes plus tard.
// On réessaie donc brièvement avant de conclure qu'il n'y en a pas.
// ═══════════════════════════════════════════════════════════════════════════

export interface IdentifiantsEleve { identifiant: string; motDePasse: string }

const attendre = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export interface OptionsChargement {
  tentatives?: number;
  delaiMs?: number;
  /** Injection pour les tests. */
  lire?: (inscriptionId: string) => Promise<IdentifiantsEleve | null>;
}

const lireEnBase = async (inscriptionId: string): Promise<IdentifiantsEleve | null> => {
  const { data, error } = await supabase
    .from('school_accounts')
    .select('email, password_plain')
    .eq('student_enrollment_id', inscriptionId)
    .eq('role', 'student')
    .maybeSingle();
  if (error || !data?.email || !data.password_plain) return null;
  return { identifiant: data.email, motDePasse: data.password_plain };
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
