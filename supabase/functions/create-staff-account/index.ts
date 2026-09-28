// ═══════════════════════════════════════════════════════════════════════════
// create-staff-account — le directeur crée un compte pour un membre du personnel.
//
// L'adresse est une VRAIE adresse e-mail (gmail…) et le mot de passe est celui
// que l'employé a choisi et dit au directeur. Pas de « mot de passe oublié » :
// le directeur le change au besoin (reset-school-account).
//
// Sécurité :
//   • l'appelant doit être directeur (admin_school) de son école ;
//   • la ligne school_accounts doit être un compte PERSONNEL de CETTE école,
//     pas encore relié ;
//   • le compte est marqué app_metadata.compte_ecole = true : le déclencheur
//     handle_new_user ne crée alors ni école ni rôle de directeur
//     (docs/sql/personnel_vrai_email.sql).
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { messageErreurCompte, normaliserEmail, verifierComptePersonnel } from './regles.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const repondre = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Vérification de l'appelant (doit être directeur de son école) ────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return repondre({ error: 'Non autorisé' }, 401)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) return repondre({ error: 'Non autorisé' }, 401)

    const { data: schoolId, error: schoolErr } = await supabaseClient.rpc('get_my_school_id')
    if (schoolErr || !schoolId) return repondre({ error: 'Non autorisé' }, 403)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: callerMember } = await supabaseAdmin
      .from('school_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .maybeSingle()
    if (callerMember?.role !== 'admin_school') {
      return repondre({ error: 'Seul le directeur peut créer un compte personnel' }, 403)
    }

    // ── Corps de la requête ─────────────────────────────────────────────────
    const corps = await req.json()
    const email = normaliserEmail(String(corps.email ?? ''))
    const password = String(corps.password ?? '')
    const fullName = String(corps.fullName ?? '').trim()
    const accountId = corps.accountId
    const perms: string[] = Array.isArray(corps.permissions) ? corps.permissions : []
    const erreurs = verifierComptePersonnel({ nom: fullName, email, motDePasse: password })
    if (!accountId) erreurs.push('Compte introuvable')
    if (erreurs.length) return repondre({ error: erreurs.join(' · ') }, 400)

    // La ligne à relier : un compte PERSONNEL de cette école, pas encore relié.
    const { data: ligne } = await supabaseAdmin
      .from('school_accounts')
      .select('id, school_id, role, auth_user_id')
      .eq('id', accountId)
      .maybeSingle()
    if (!ligne || ligne.school_id !== schoolId || ligne.role !== 'staff' || ligne.auth_user_id) {
      return repondre({ error: 'Compte introuvable' }, 403)
    }

    // ── Créer l'utilisateur ─────────────────────────────────────────────────
    const { data: { user: newUser }, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { compte_ecole: true },
    })

    if (createError || !newUser) {
      // Rien n'a été créé côté connexion : on retire la ligne préparée, pour ne
      // pas laisser un compte fantôme dans la liste du personnel.
      await supabaseAdmin.from('school_accounts').delete().eq('id', accountId).is('auth_user_id', null)
      return repondre({ error: messageErreurCompte(createError?.message) }, 400)
    }

    // ── Lier auth_user_id à la ligne school_accounts (comme élèves/profs) ────
    const { error: linkError } = await supabaseAdmin
      .from('school_accounts')
      .update({ auth_user_id: newUser.id, email, updated_at: new Date().toISOString() })
      .eq('id', accountId)
    if (linkError) return repondre({ error: `Compte créé mais liaison échouée : ${linkError.message}` }, 500)

    // ── Profil (le déclencheur ne le crée pas pour les comptes d'école) ──────
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: newUser.id, email, full_name: fullName, registered_at: new Date().toISOString() })
    if (profileError) return repondre({ error: `Erreur profil : ${profileError.message}` }, 500)

    // ── Accès au tableau de bord (rôle personnel) ───────────────────────────
    const { error: memberError } = await supabaseAdmin
      .from('school_members')
      .upsert(
        { school_id: schoolId, user_id: newUser.id, role: 'staff', permissions: perms, invited_by: user.id },
        { onConflict: 'school_id,user_id' }
      )
    if (memberError) return repondre({ error: `Erreur d'accès au tableau de bord : ${memberError.message}` }, 500)

    return repondre({ userId: newUser.id })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return repondre({ error: msg }, 500)
  }
})
