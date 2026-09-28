// ═══════════════════════════════════════════════════════════════════════════
// reset-school-account — changer le mot de passe d'un compte élève, professeur
// ou personnel.
//
// Sécurité (manquait avant : tout compte connecté pouvait changer n'importe
// quel mot de passe) :
//   • l'appelant doit être membre actif de l'école du compte (même règle que
//     reveal_school_account_password : get_my_school_id()) ;
//   • un compte du PERSONNEL ne peut être changé que par le directeur.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { MIN_MOT_DE_PASSE } from '../create-staff-account/regles.ts'

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return repondre({ error: 'Non autorisé' }, 401)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) return repondre({ error: 'Non autorisé' }, 401)

    const { accountId, newPassword } = await req.json()
    if (!accountId || typeof newPassword !== 'string' || !newPassword) {
      return repondre({ error: 'Champs requis : accountId, newPassword' }, 400)
    }
    if (newPassword.length < MIN_MOT_DE_PASSE) {
      return repondre({ error: `Le mot de passe doit contenir au moins ${MIN_MOT_DE_PASSE} caractères` }, 400)
    }

    // L'école de l'appelant (membres actifs seulement : ni élève ni professeur).
    const { data: schoolId, error: schoolErr } = await supabaseClient.rpc('get_my_school_id')
    if (schoolErr || !schoolId) return repondre({ error: 'Non autorisé' }, 403)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: account, error: accountError } = await supabaseAdmin
      .from('school_accounts')
      .select('auth_user_id, school_id, role')
      .eq('id', accountId)
      .maybeSingle()
    if (accountError || !account?.auth_user_id) return repondre({ error: 'Compte introuvable' }, 404)
    if (account.school_id !== schoolId) return repondre({ error: 'Non autorisé' }, 403)

    if (account.role === 'staff') {
      const { data: appelant } = await supabaseAdmin
        .from('school_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .maybeSingle()
      if (appelant?.role !== 'admin_school') {
        return repondre({ error: 'Seul le directeur peut changer le mot de passe du personnel' }, 403)
      }
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      account.auth_user_id,
      { password: newPassword }
    )
    if (updateError) return repondre({ error: updateError.message }, 400)

    // Copie chiffrée (déclencheur encrypt_school_account_password) pour l'affichage.
    await supabaseAdmin
      .from('school_accounts')
      .update({ password_plain: newPassword, updated_at: new Date().toISOString() })
      .eq('id', accountId)

    return repondre({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return repondre({ error: msg }, 500)
  }
})
