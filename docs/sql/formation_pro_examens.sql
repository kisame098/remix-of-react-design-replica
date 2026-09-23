-- ═══════════════════════════════════════════════════════════════════════════
-- FORMATION PROFESSIONNELLE — Examens (étape 4)
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor (après formation_pro_evaluations.sql).
--
-- Une évaluation est du contrôle continu. Un examen est un événement formel
-- (blanc ou officiel) rattaché à UNE promotion :
--   - ses épreuves sont regroupées en TOURS (Écrit, Pratique, Oral…) — un
--     simple regroupement d'affichage, jamais une pondération de plus ;
--   - chaque épreuve a un coefficient, un barème et, si besoin, une note
--     ÉLIMINATOIRE (en dessous : refusé quel que soit le reste) ;
--   - les CANDIDATS sont une liste explicite (pré-remplie avec la promotion,
--     on peut exclure un élève ou ajouter un redoublant d'une autre promotion) ;
--   - le jury retient une DÉCISION et une MENTION par candidat, puis le
--     directeur VERROUILLE l'examen : plus aucune note ni décision ne bouge
--     tant qu'il ne l'a pas déverrouillé. Cette règle est tenue ICI, par la
--     base, pas seulement par l'écran.
--
-- Un rattrapage est un NOUVEL examen de la même promotion : on garde la trace
-- du premier passage.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.fp_examens (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  promotion_id    uuid not null references public.fp_promotions(id) on delete cascade,
  name            text not null,
  type            text not null default 'blanc' check (type in ('blanc', 'officiel')),
  -- Référence de session d'un examen officiel (reprise plus tard sur les diplômes).
  reference       text,
  seuil_admission numeric not null default 10 check (seuil_admission > 0 and seuil_admission <= 20),
  date_debut      date,
  date_fin        date,
  verrouille      boolean not null default false,
  verrouille_le   timestamptz,
  verrouille_par  uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (date_debut is null or date_fin is null or date_debut <= date_fin)
);
create index if not exists fp_examens_promotion_idx on public.fp_examens (promotion_id);

create table if not exists public.fp_examen_tours (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  examen_id   uuid not null references public.fp_examens(id) on delete cascade,
  name        text not null,
  ordering    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists fp_examen_tours_examen_idx on public.fp_examen_tours (examen_id);

create table if not exists public.fp_examen_epreuves (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  tour_id            uuid not null references public.fp_examen_tours(id) on delete cascade,
  -- Facultatif : une épreuve professionnelle peut couvrir plusieurs matières.
  niveau_matiere_id  uuid references public.fp_niveau_matieres(id) on delete set null,
  nom                text not null,
  coefficient        numeric not null default 1 check (coefficient > 0),
  bareme             numeric not null default 20 check (bareme > 0),
  -- Note plancher sur le barème de l'épreuve : en dessous, le candidat est refusé.
  seuil_eliminatoire numeric check (seuil_eliminatoire is null or seuil_eliminatoire >= 0),
  date               date,
  heure              time,
  salle              text,
  examinateurs       text,
  ordering           integer not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists fp_examen_epreuves_tour_idx on public.fp_examen_epreuves (tour_id);

create table if not exists public.fp_examen_candidats (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  examen_id             uuid not null references public.fp_examens(id) on delete cascade,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  created_at            timestamptz not null default now(),
  unique (examen_id, student_enrollment_id)
);
create index if not exists fp_examen_candidats_examen_idx on public.fp_examen_candidats (examen_id);

create table if not exists public.fp_examen_notes (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  epreuve_id            uuid not null references public.fp_examen_epreuves(id) on delete cascade,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  valeur                numeric check (valeur is null or valeur >= 0),
  statut                text not null default 'note' check (statut in ('note', 'absent', 'absent_justifie')),
  observation           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (epreuve_id, student_enrollment_id),
  -- Une absence n'a jamais de valeur : jamais un 0 qui se lirait comme une note.
  check ((statut = 'note') = (valeur is not null))
);
create index if not exists fp_examen_notes_epreuve_idx on public.fp_examen_notes (epreuve_id);

-- La décision du jury. `moyenne` et `elimine` sont figés au verrouillage.
create table if not exists public.fp_examen_resultats (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  examen_id             uuid not null references public.fp_examens(id) on delete cascade,
  student_enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  decision              text check (decision in ('admis', 'ajourne', 'refuse')),
  mention               text check (mention in ('passable', 'assez_bien', 'bien', 'tres_bien')),
  moyenne               numeric,
  elimine               boolean not null default false,
  updated_at            timestamptz not null default now(),
  unique (examen_id, student_enrollment_id)
);
create index if not exists fp_examen_resultats_examen_idx on public.fp_examen_resultats (examen_id);

-- ─── RLS : chaque école ne voit que ses lignes ───────────────────────────────
alter table public.fp_examens          enable row level security;
alter table public.fp_examen_tours     enable row level security;
alter table public.fp_examen_epreuves  enable row level security;
alter table public.fp_examen_candidats enable row level security;
alter table public.fp_examen_notes     enable row level security;
alter table public.fp_examen_resultats enable row level security;

do $$
declare t text;
begin
  foreach t in array array['fp_examens','fp_examen_tours','fp_examen_epreuves','fp_examen_candidats','fp_examen_notes','fp_examen_resultats']
  loop
    execute format('drop policy if exists "%1$s: staff select" on public.%1$s', t);
    execute format('create policy "%1$s: staff select" on public.%1$s for select using (school_id = get_my_school_id())', t);
    execute format('drop policy if exists "%1$s: staff insert" on public.%1$s', t);
    execute format('create policy "%1$s: staff insert" on public.%1$s for insert with check (school_id = get_my_school_id())', t);
    execute format('drop policy if exists "%1$s: staff update" on public.%1$s', t);
    execute format('create policy "%1$s: staff update" on public.%1$s for update using (school_id = get_my_school_id()) with check (school_id = get_my_school_id())', t);
    execute format('drop policy if exists "%1$s: staff delete" on public.%1$s', t);
    execute format('create policy "%1$s: staff delete" on public.%1$s for delete using (school_id = get_my_school_id())', t);
  end loop;
end $$;

-- ─── Verrouillage : tenu par la base ────────────────────────────────────────
-- 1. Seul le directeur (is_school_admin) verrouille, déverrouille ou supprime
--    un examen verrouillé.
create or replace function public.fp_examen_garde_verrou()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.verrouille and not is_school_admin() then
      raise exception 'Examen verrouillé : seul le directeur peut le supprimer.';
    end if;
    return old;
  end if;
  if new.verrouille is distinct from old.verrouille and not is_school_admin() then
    raise exception 'Seul le directeur peut verrouiller ou déverrouiller un examen.';
  end if;
  if old.verrouille and new.verrouille and not is_school_admin() then
    raise exception 'Examen verrouillé : il ne peut plus être modifié.';
  end if;
  return new;
end $$;

drop trigger if exists fp_examens_garde_verrou on public.fp_examens;
create trigger fp_examens_garde_verrou before update or delete on public.fp_examens
  for each row execute function public.fp_examen_garde_verrou();

-- 2. Rien de ce qui compose un examen verrouillé ne change : ni ses tours,
--    ni ses épreuves, ni ses candidats, ni ses notes, ni ses résultats.
--    (La suppression en cascade de l'examen lui-même, réservée au directeur,
--    n'est pas bloquée : la ligne fp_examens a déjà disparu à ce moment-là.)
create or replace function public.fp_examen_id_de_ligne(p_table text, p_ligne jsonb)
returns uuid language sql stable as $$
  select case p_table
    when 'fp_examen_tours'     then (p_ligne->>'examen_id')::uuid
    when 'fp_examen_candidats' then (p_ligne->>'examen_id')::uuid
    when 'fp_examen_resultats' then (p_ligne->>'examen_id')::uuid
    when 'fp_examen_epreuves'  then (select t.examen_id from public.fp_examen_tours t where t.id = (p_ligne->>'tour_id')::uuid)
    when 'fp_examen_notes'     then (select t.examen_id from public.fp_examen_epreuves e join public.fp_examen_tours t on t.id = e.tour_id
                                     where e.id = (p_ligne->>'epreuve_id')::uuid)
  end
$$;

create or replace function public.fp_examen_garde_contenu()
returns trigger language plpgsql as $$
declare
  v_ligne jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_examen uuid := public.fp_examen_id_de_ligne(tg_table_name, v_ligne);
begin
  if v_examen is not null and exists (select 1 from public.fp_examens x where x.id = v_examen and x.verrouille) then
    raise exception 'Examen verrouillé : les notes et les décisions ne peuvent plus être modifiées.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$
declare t text;
begin
  foreach t in array array['fp_examen_tours','fp_examen_epreuves','fp_examen_candidats','fp_examen_notes','fp_examen_resultats']
  loop
    execute format('drop trigger if exists %1$s_garde_verrou on public.%1$s', t);
    execute format('create trigger %1$s_garde_verrou before insert or update or delete on public.%1$s for each row execute function public.fp_examen_garde_contenu()', t);
  end loop;
end $$;
