// ═══════════════════════════════════════════════════════════════════════════
// envoyer-email — e-mails commerciaux du chef du système, via Resend, depuis
// contact@senclass.com. Les réponses arrivent dans la boîte habituelle
// (transfert Cloudflare Email Routing).
//
// Sécurité :
//   • vérification JWT ACTIVÉE (appelée par le navigateur du chef du système) ;
//   • l'appelant doit être chef du système (get_is_platform_admin()), vérifié
//     ici avec SON jeton — jamais sur la foi du navigateur ;
//   • la clé Resend est le secret RESEND_API_KEY des fonctions (Edge Functions
//     → Secrets), jamais une table ni le code.
// Chaque envoi (réussi ou non) est inscrit dans platform_echanges.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifierRequete, messageResend, type RequeteEnvoi } from './email.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erreur: 'Méthode non autorisée' }, 405);

  const jeton = req.headers.get('Authorization');
  if (!jeton) return json({ erreur: 'Non autorisé' }, 401);

  // Le client de l'appelant : les règles d'accès de la base s'appliquent à LUI.
  const appelant = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: jeton } },
    auth: { persistSession: false },
  });
  const { data: estChef, error: erreurRole } = await appelant.rpc('get_is_platform_admin');
  if (erreurRole || estChef !== true) return json({ erreur: 'Réservé au chef du système' }, 403);

  const cle = Deno.env.get('RESEND_API_KEY');
  if (!cle) return json({ erreur: "La clé Resend n'est pas configurée (secret RESEND_API_KEY)" }, 500);

  let requete: RequeteEnvoi;
  try { requete = await req.json(); } catch { return json({ erreur: 'Requête illisible' }, 400); }
  const erreurs = verifierRequete(requete);
  if (erreurs.length) return json({ erreur: erreurs.join(' · ') }, 400);

  const resultats: { email: string; ok: boolean; erreur?: string }[] = [];
  for (const [i, d] of requete.destinataires.entries()) {
    // Resend accepte 2 requêtes par seconde : on espace les envois.
    if (i > 0) await pause(550);
    const message = messageResend(requete, d);
    let ok = false, erreur: string | undefined, resendId: string | undefined;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      const corps = await r.json().catch(() => ({}));
      ok = r.ok;
      resendId = corps?.id;
      if (!r.ok) erreur = corps?.message ?? `Erreur ${r.status}`;
    } catch (e) {
      erreur = (e as Error).message;
    }
    resultats.push({ email: d.email, ok, erreur });
    await appelant.from('platform_echanges').insert({
      prospect_id: d.prospectId ?? null, school_id: d.schoolId ?? null, type: 'email',
      objet: message.subject, contenu: message.text, destinataire: d.email,
      statut_envoi: ok ? 'envoye' : 'echec', erreur: erreur ?? null, resend_id: resendId ?? null,
    });
  }
  return json({ envoyes: resultats.filter(r => r.ok).length, echecs: resultats.filter(r => !r.ok).length, resultats });
});
