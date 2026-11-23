import { supabase } from '@/integrations/supabase/client';
import { lireProgression, plusRecente, type Progression } from '@/lib/guide';

// La progression est propre à chaque COMPTE (un directeur et sa secrétaire
// n'avancent pas ensemble). Elle est gardée sur l'appareil à chaque étape, et
// dans le compte aux moments importants (réponse, pause, chapitre terminé) :
// changer d'ordinateur ne refait ni la proposition ni les chapitres finis.

const cle = (userId: string) => `senclass:guide:${userId}`;

export const chargerProgression = (userId: string, duCompte: unknown): Progression => {
  let local: unknown = null;
  try { local = JSON.parse(localStorage.getItem(cle(userId)) ?? 'null'); } catch { /* stockage illisible */ }
  return plusRecente(lireProgression(duCompte), lireProgression(local));
};

export const garderSurAppareil = (userId: string, p: Progression): void => {
  try { localStorage.setItem(cle(userId), JSON.stringify(p)); } catch { /* stockage plein ou interdit */ }
};

/** Jamais bloquant : hors connexion, l'appareil garde déjà tout. */
export const garderDansLeCompte = async (p: Progression): Promise<void> => {
  try { await supabase.auth.updateUser({ data: { guide: p } }); } catch { /* réessayé au prochain moment important */ }
};
