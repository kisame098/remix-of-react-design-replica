import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ════════════════════════════════════════════════════════════════════════════
// Garde-fous du système de notifications. Ils lisent le code plutôt que de
// simuler Supabase : ce sont des règles de sécurité qui ne doivent pas
// s'affaiblir en silence lors d'une retouche.
// ════════════════════════════════════════════════════════════════════════════

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8');

/**
 * Arguments de chaque appel `nom( … )`, en respectant les parenthèses et les
 * apostrophes imbriquées — une expression régulière n'y suffit pas.
 */
const extraireAppels = (source: string, nom: string): string[][] => {
  const appels: string[][] = [];
  let depuis = 0;
  for (;;) {
    const debut = source.indexOf(`${nom}(`, depuis);
    if (debut === -1) return appels;
    let profondeur = 0, dansTexte = false, courant = '';
    const args: string[] = [];
    let i = debut + nom.length;
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === "'") dansTexte = !dansTexte;
      if (!dansTexte) {
        if (c === '(') { profondeur++; if (profondeur === 1) continue; }
        if (c === ')') { profondeur--; if (profondeur === 0) { args.push(courant.trim()); break; } }
        if (c === ',' && profondeur === 1) { args.push(courant.trim()); courant = ''; continue; }
      }
      courant += c;
    }
    appels.push(args);
    depuis = i;
  }
};

describe('SQL — docs/sql/notifications_push.sql', () => {
  const sql = lire('docs/sql/notifications_push.sql');

  it('les deux tables ont la sécurité par ligne activée', () => {
    expect(sql).toMatch(/alter table public\.push_subscriptions enable row level security/i);
    expect(sql).toMatch(/alter table public\.notification_queue enable row level security/i);
  });

  it('la file est fermée aux élèves et professeurs : aucun droit, aucune politique', () => {
    expect(sql).toMatch(/revoke all on public\.notification_queue from anon, authenticated/i);
    expect(sql).not.toMatch(/create policy[^;]*on public\.notification_queue/i);
  });

  it('les abonnements ne se lisent que par leur propriétaire, et ne s\'écrivent pas directement', () => {
    expect(sql).toMatch(/for select to authenticated using \(auth\.uid\(\) = auth_user_id\)/i);
    expect(sql).not.toMatch(/for (insert|update|delete|all) to authenticated/i);
  });

  it('un même appareil peut porter plusieurs comptes (parent + enfants)', () => {
    expect(sql).toMatch(/unique \(endpoint, auth_user_id\)/i);
    expect(sql).not.toMatch(/endpoint\s+text not null unique/i);
  });

  it('se désabonner ne retire que le compte connecté', () => {
    expect(sql).toMatch(/where endpoint = p_endpoint and auth_user_id = auth\.uid\(\)/i);
  });

  it('chaque déclencheur est protégé : il ne peut JAMAIS bloquer une écriture', () => {
    // Un professeur qui enregistre ses notes ou un caissier qui encaisse ne
    // doit pas être arrêté par un bug de notification.
    for (const nom of [
      'notifier_nouvelle_note', 'notifier_nouvelle_note_elementaire',
      'notifier_bulletin_publie', 'notifier_paiement_recu',
      'notifier_presence_eleve', 'notifier_presences_validees',
    ]) {
      const debut = sql.indexOf(`create or replace function public.${nom}()`);
      expect(debut, nom).toBeGreaterThan(-1);
      const fin = sql.indexOf('end $$;', debut);
      const corps = sql.slice(debut, fin);
      expect(corps, nom).toMatch(/exception when others then/i);
      expect(corps, nom).toMatch(/raise warning/i);
    }
  });

  it('la file ne reçoit jamais de valeur de note, de montant, de nom ni de justification', () => {
    // Avant la planification : au-delà, les jsonb_build_object sont des en-têtes HTTP.
    const appels = extraireAppels(sql.slice(0, sql.indexOf('-- ─── 5. Planification')), 'jsonb_build_object');
    // Garde contre un test creux — et contre une charge ajoutée sans contrôle :
    // notes ×2, bulletin, paiement, présence (envoi et correction).
    expect(appels).toHaveLength(6);

    const AUTORISEES = ['date', 'heure', 'matiere', 'mois', 'periode', 'session', 'statut', 'type'];
    const cles = new Set<string>();
    for (const args of appels) {
      args.forEach((arg, i) => {
        if (i % 2 === 0) {
          const cle = arg.replace(/'/g, '');
          expect(AUTORISEES, `clé « ${cle} »`).toContain(cle);
          cles.add(cle);
        } else {
          // La VALEUR ne doit venir d'aucune colonne sensible.
          expect(arg, `valeur « ${arg} »`).not.toMatch(
            /NEW\.(amount|note|devoir|composition|points|justification|is_justified)|first_name|last_name|full_name|display_name/i);
        }
      });
    }
    expect([...cles].sort()).toEqual(AUTORISEES);
  });

  it('la notification arrive en quelques secondes, pas en minutes', () => {
    // Une note annoncée cinq minutes après coup a perdu son intérêt : le délai
    // ne sert qu'à regrouper des saisies quasi simultanées.
    const delais = [...sql.matchAll(/send_after\)\s*select[\s\S]*?now\(\) \+ interval '(\d+) (second|minute)s?'/g)];
    expect(delais.length).toBe(6);   // notes ×2, bulletin, paiement, présence ×2
    for (const [, valeur, unite] of delais) {
      const secondes = Number(valeur) * (unite === 'minute' ? 60 : 1);
      // 45 s au plus : le recul des présences, qui laisse corriger une erreur d'appel.
      expect(secondes).toBeLessThanOrEqual(45);
    }
  });

  it('la tâche planifiée passe toutes les quelques secondes, pas une fois par minute', () => {
    expect(sql).toMatch(/'senclass-notifications',\s*'(\d+) seconds'/);
    const [, secondes] = /'senclass-notifications',\s*'(\d+) seconds'/.exec(sql)!;
    expect(Number(secondes)).toBeLessThanOrEqual(15);
  });

  it('une note ne notifie que lorsqu\'une valeur APPARAÎT, pas à chaque correction', () => {
    expect(sql).toMatch(/OLD\.devoir1 is null and NEW\.devoir1 is not null/);
    expect(sql).toMatch(/OLD\.points_obtenus is null/);
  });

  it('un bulletin republié ne renotifie pas : déclencheur à l\'insertion seulement', () => {
    expect(sql).toMatch(/create trigger notifier_bulletin_publie\s+after insert on public\.published_bulletins/i);
  });

  it('présences : personne n\'est prévenu pendant l\'appel, seulement une fois validé', () => {
    // Le professeur coche, se corrige, hésite : rien ne part avant « Saisie complète ».
    expect(sql).toMatch(/if v_valide then\s+perform public\.reconcilier_presence/);
    expect(sql).toMatch(/coalesce\(OLD\.student_attendance_complete, false\) = false\s+and coalesce\(NEW\.student_attendance_complete, false\) = true/);
    expect(sql).toMatch(/after update of student_attendance_complete on public\.attendance_sessions/);
  });

  it('présences : seuls absent, retard et renvoi notifient — jamais « présent »', () => {
    expect(sql).toMatch(/if p_statut in \('absent', 'late', 'expelled'\) then/);
    expect(sql).toMatch(/if TG_OP = 'INSERT' and NEW\.status = 'present' then return NEW/);
  });

  it('présences : une erreur d\'appel corrigée avant l\'envoi est retirée de la file', () => {
    expect(sql).toMatch(/delete from public\.notification_queue q[\s\S]{0,400}q\.sent_at is null and q\.claimed_at is null/);
  });

  it('présences : corrigée APRÈS l\'envoi, la famille reçoit une correction', () => {
    expect(sql).toMatch(/jsonb_build_object\('statut', 'corrige'/);
    expect(sql).toMatch(/n\.sent_at is not null and n\.payload->>'session' = p_session::text/);
  });

  it('présences : la contrainte de la file accepte le nouveau genre, y compris sur une base existante', () => {
    expect(sql).toMatch(/drop constraint if exists notification_queue_kind_check/);
    expect(sql.match(/kind in \('grade', 'bulletin', 'payment', 'attendance'\)/g)).toHaveLength(2);
  });

  it('une annulation de paiement ne notifie pas', () => {
    expect(sql).toMatch(/create trigger notifier_paiement_recu\s+after insert on public\.payments/i);
    expect(sql).toMatch(/NEW\.status is distinct from 'cancelled'/);
  });

  it('rien n\'est mis en file pour un élève qui n\'a pas activé les notifications', () => {
    expect(sql).toMatch(/exists \(select 1 from public\.push_subscriptions s where s\.auth_user_id = a\.auth_user_id\)/);
  });

  it('la réservation de la file est réservée à la clé de service', () => {
    expect(sql).toMatch(/revoke all on function public\.notifications_reclamer\(integer\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.notifications_reclamer\(integer\) to service_role/i);
  });

  it('la tâche planifiée n\'appelle la fonction que s\'il y a quelque chose à envoyer', () => {
    expect(sql).toMatch(/where exists \(\s*select 1 from public\.notification_queue/i);
  });

  it('le secret du planificateur vient du coffre, pas du fichier', () => {
    expect(sql).toMatch(/vault\.decrypted_secrets/);
    expect(sql).not.toMatch(/'x-cron-secret',\s*'[0-9a-f]{16,}'/i);
  });

  it('le secret est GÉNÉRÉ par la base : personne ne le saisit, personne ne le voit', () => {
    expect(sql).toMatch(/vault\.create_secret\(\s*replace\(gen_random_uuid\(\)/);
    expect(sql).toMatch(/where not exists \(select 1 from vault\.secrets where name = 'senclass_cron_secret'\)/);
  });

  it('aucun secret n\'est stocké en clair : la table de réglages ne porte que la clé PUBLIQUE', () => {
    const cles = [...sql.matchAll(/insert into public\.push_config[^;]*values \('([a-z_]+)'/gi)].map(m => m[1]);
    expect(cles).toEqual(['vapid_public']);
    expect(sql).toMatch(/vault\.create_secret\(p_privee, 'senclass_vapid_privee'\)/);
    expect(sql).toMatch(/alter table public\.push_config enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.push_config from anon, authenticated/i);
  });

  it('la lecture du coffre est réservée à la clé de service, et limitée à deux noms', () => {
    expect(sql).toMatch(/revoke all on function public\.push_secret_lire\(text\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.push_secret_lire\(text\) to service_role/i);
    expect(sql).toMatch(/p_nom in \('senclass_cron_secret', 'senclass_vapid_privee'\)/);
  });

  it('les clés VAPID ne s\'écrasent JAMAIS : réécrire invaliderait tous les abonnements', () => {
    expect(sql).toMatch(/pg_advisory_xact_lock/);
    expect(sql).toMatch(/if exists \(select 1 from public\.push_config where cle = 'vapid_public'\) then\s+return false/);
    expect(sql).toMatch(/revoke all on function public\.push_initialiser_cles\(text, text\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.push_initialiser_cles\(text, text\) to service_role/i);
  });

  it('seuls les comptes connectés lisent la clé publique', () => {
    expect(sql).toMatch(/revoke all on function public\.cle_publique_push\(\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.cle_publique_push\(\) to authenticated/i);
  });

  it('tant que les clés n\'existent pas, la tâche appelle la fonction pour les fabriquer', () => {
    expect(sql).toMatch(/or not exists \(select 1 from public\.push_config where cle = 'vapid_public'\)/);
  });
});

describe('fonction — supabase/functions/send-notifications', () => {
  const fonction = lire('supabase/functions/send-notifications/index.ts');

  it('refuse toute requête sans secret, sans même lire la base', () => {
    const idxRefus = fonction.indexOf("if (!fourni) return json({ erreur: 'Non autorisé' }, 401)");
    const idxBase = fonction.indexOf('createClient(');
    expect(idxRefus).toBeGreaterThan(-1);
    expect(idxBase).toBeGreaterThan(idxRefus);
  });

  it('échoue FERMÉ : secret absent, illisible ou faux, personne n\'entre', () => {
    expect(fonction).toMatch(/if \(erreurSecret\) return json\(\{ erreur: 'Indisponible' \}, 500\)/);
    expect(fonction).toMatch(/if \(!secret \|\| !egaux\(String\(secret\), fourni\)\) return json\(\{ erreur: 'Non autorisé' \}, 401\)/);
  });

  it('aucun secret à configurer à la main : rien ne se lit dans l\'environnement', () => {
    const lus = [...fonction.matchAll(/Deno\.env\.get\('([A-Z_]+)'\)/g)].map(m => m[1]);
    expect(lus.sort()).toEqual(['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL']);
  });

  it('ne renvoie ni ne journalise jamais la clé privée', () => {
    expect(fonction).not.toMatch(/console\.(log|info|warn|error)/);
    expect(fonction).not.toMatch(/json\(\{[^}]*(privee|secret)\b[^}]*\}\)/);
  });

  it('fabrique ses clés elle-même au premier appel', () => {
    expect(fonction).toMatch(/genererPaireVapid\(\)/);
    expect(fonction).toMatch(/push_initialiser_cles/);
  });

  it('compare le secret en temps constant', () => {
    expect(fonction).toMatch(/diff \|= /);
  });

  it('supprime un abonnement mort (404/410) au lieu de réessayer sans fin', () => {
    expect(fonction).toMatch(/code === 404 \|\| code === 410/);
    expect(fonction).toMatch(/from\('push_subscriptions'\)\.delete\(\)/);
  });

  it('n\'écrit aucune clé secrète dans le code', () => {
    expect(fonction).not.toMatch(/[A-Za-z0-9_-]{43}/);   // taille d'une clé privée VAPID en base64url
  });
});

describe('service worker — public/push-sw.js', () => {
  const sw = lire('public/push-sw.js');

  it('affiche les notifications reçues et réagit au clic', () => {
    expect(sw).toMatch(/addEventListener\('push'/);
    expect(sw).toMatch(/addEventListener\('notificationclick'/);
    expect(sw).toMatch(/showNotification\(/);
  });

  it('ne suit que des chemins internes : une notification ne mène jamais hors de SenClass', () => {
    expect(sw).toMatch(/demande\.startsWith\('\/'\)/);
    expect(sw).toMatch(/!demande\.startsWith\('\/\/'\)/);
    expect(sw).toMatch(/new URL\(chemin, self\.location\.origin\)/);
  });

  it('survit à une charge illisible', () => {
    expect(sw).toMatch(/try \{[\s\S]*event\.data\.json\(\)[\s\S]*\} catch/);
  });

  it('est chargé par le service worker généré', () => {
    expect(lire('vite.config.ts')).toMatch(/importScripts:\s*\["push-sw\.js"\]/);
  });
});

describe('branchement dans l\'application', () => {
  it('la déconnexion retire l\'abonnement AVANT de perdre la session', () => {
    const auth = lire('src/contexts/AuthContext.tsx');
    const retrait = auth.indexOf('await retirerAbonnementDuCompte()');
    const sortie = auth.indexOf('await supabase.auth.signOut()');
    expect(retrait).toBeGreaterThan(-1);
    expect(sortie).toBeGreaterThan(retrait);
  });

  it('la carte d\'activation n\'apparaît que pour les élèves', () => {
    expect(lire('src/pages/portal/PortalProfil.tsx')).toMatch(/\{isStudent && <CarteNotifications \/>\}/);
  });

  it('la permission est demandée par un clic, jamais au chargement de la page', () => {
    const lib = lire('src/lib/notificationsPush.ts');
    const hook = lire('src/hooks/useNotificationsPush.ts');
    const carte = lire('src/components/portal/CarteNotifications.tsx');
    expect(carte).toMatch(/onClick=\{actives \? desactiver : activer\}/);
    // requestPermission n'est appelée que dans activerNotifications, elle-même
    // appelée seulement par le bouton.
    expect(lib.match(/requestPermission\(/g)).toHaveLength(1);
    expect(hook).not.toMatch(/requestPermission/);
    expect(hook).not.toMatch(/useEffect\([^)]*activer\(/);
  });

  it('l\'application lit la clé publique sur le serveur, elle n\'en embarque aucune', () => {
    const lib = lire('src/lib/notificationsPush.ts');
    expect(lib).toMatch(/rpc\('cle_publique_push'/);
    expect(lib).not.toMatch(/'B[A-Za-z0-9_-]{86}'/);
  });

  it('la clé privée VAPID n\'est nulle part dans le dépôt', () => {
    const lib = lire('src/lib/notificationsPush.ts');
    expect(lib).not.toMatch(/VAPID_PRIVATE_KEY\s*=\s*['"]/);
    expect(lire('.env')).not.toMatch(/VAPID_PRIVATE/);
  });
});
