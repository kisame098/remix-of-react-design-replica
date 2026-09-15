-- ═══════════════════════════════════════════════════════════════════════════
-- Statistiques plateforme (chef du système)
-- À coller et exécuter dans l'éditeur SQL Supabase.
-- ═══════════════════════════════════════════════════════════════════════════

-- Renvoie UNIQUEMENT des agrégats (des nombres) — jamais de lignes élèves ou
-- profs. Le chef du système n'a donc toujours aucun accès aux données
-- personnelles des écoles : les policies RLS de student_enrollments /
-- teacher_enrollments restent inchangées, scopées à l'école.
create or replace function public.platform_get_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not get_is_platform_admin() then
    raise exception 'Non autorisé';
  end if;

  select jsonb_build_object(
    'schools', jsonb_build_object(
      'total',          (select count(*) from schools),
      'trial',          (select count(*) from schools where subscription_status = 'trial'),
      'active',         (select count(*) from schools where subscription_status = 'active'),
      'suspended',      (select count(*) from schools where subscription_status = 'suspended'),
      'cancelled',      (select count(*) from schools where subscription_status = 'cancelled'),
      'new_this_month', (select count(*) from schools where created_at >= date_trunc('month', now())),
      'trial_expired',  (select count(*) from schools where subscription_status = 'trial' and subscription_expires_at < now()),
      'overdue',        (select count(*) from schools where subscription_status = 'active' and subscription_expires_at < now())
    ),
    'people', jsonb_build_object(
      'students', (select count(*) from student_enrollments where status = 'active'),
      'teachers', (select count(*) from teacher_enrollments where status = 'active'),
      'classes',  (select count(*) from classes)
    ),
    'revenue', jsonb_build_object(
      'total',          (select coalesce(sum(amount), 0) from billing_transactions where status = 'completed'),
      'this_month',     (select coalesce(sum(amount), 0) from billing_transactions
                          where status = 'completed' and coalesce(completed_at, created_at) >= date_trunc('month', now())),
      'pending_claims', (select count(*) from billing_transactions where status = 'pending')
    ),
    'retention', jsonb_build_object(
      -- Écoles qui ne sont plus en essai en cours : elles ont été confrontées
      -- au choix de payer ou non (dénominateur du taux de conversion).
      'past_trial', (select count(*) from schools
                      where subscription_status <> 'trial'
                         or (subscription_status = 'trial' and subscription_expires_at < now())),
      -- Ont payé au moins une fois (paiement confirmé par le chef du système).
      'converted',  (select count(distinct school_id) from billing_transactions where status = 'completed'),
      -- Ont payé au moins deux fois : elles ont renouvelé → fidèles.
      'renewed',    (select count(*) from (
                      select school_id from billing_transactions
                      where status = 'completed' group by school_id having count(*) >= 2
                    ) t)
    ),
    -- Inscriptions d'écoles par mois sur les 12 derniers mois (évolution).
    'signups', (
      select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'count', m.count) order by m.month), '[]'::jsonb)
      from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*) as count
        from schools
        where created_at >= date_trunc('month', now()) - interval '11 months'
        group by 1
      ) m
    )
  ) into v_result;

  return v_result;
end;
$$;
