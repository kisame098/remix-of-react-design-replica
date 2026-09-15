#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT DE SÉCURITÉ DE L'API — vérifie qu'un inconnu muni de la seule clé
// publique (celle qui est DANS le bundle JavaScript, donc connue de tous) ne
// peut rien lire ni rien écrire.
//
// C'est le contrôle qui compte avant une mise en production : le routeur React
// n'existe pas pour quelqu'un qui appelle l'API directement avec curl.
//
// Aucune donnée n'est modifiée : les écritures testées doivent échouer, et la
// ligne d'essai est supprimée si jamais l'une passait.
//
//   node scripts/audit-securite.mjs [--json rapport.json]
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const racine = process.cwd();

const env = Object.fromEntries(
  readFileSync(join(racine, '.env'), 'utf8')
    .split('\n').filter(Boolean)
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }),
);
const URL = env.VITE_SUPABASE_URL;
const CLE = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!URL || !CLE) {
  console.error('✗ .env incomplet (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)');
  process.exit(2);
}

// Tables et RPC telles que le client les connaît : c'est exactement la surface
// qu'un attaquant peut adresser depuis le bundle.
const types = readFileSync(join(racine, 'src/integrations/supabase/types.ts'), 'utf8');
const section = (nom) => {
  const debut = types.indexOf(`    ${nom}: {`);
  if (debut === -1) return '';
  return types.slice(debut, types.indexOf('\n    }', debut));
};
const noms = (nom) => [...new Set(
  [...section(nom).matchAll(/^ {6}([a-z][a-z0-9_]*): \{/gm)].map(m => m[1]),
)];

const TABLES = noms('Tables');
const RPCS = noms('Functions');

const entetes = { apikey: CLE, Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' };
const resultats = [];
const ajouter = (categorie, cible, verdict, detail) =>
  resultats.push({ categorie, cible, verdict, detail });

// ── 1. Lecture anonyme : aucune table ne doit rendre la moindre ligne ───────
async function lectureAnonyme() {
  for (const table of TABLES) {
    try {
      const r = await fetch(`${URL}/rest/v1/${table}?select=*&limit=1`, { headers: entetes });
      const corps = await r.json();
      if (!r.ok) {
        // 401/403/404 = fermé. C'est un bon résultat.
        ajouter('lecture anonyme', table, 'OK', `refus ${r.status}`);
      } else if (Array.isArray(corps) && corps.length === 0) {
        ajouter('lecture anonyme', table, 'OK', '0 ligne');
      } else {
        ajouter('lecture anonyme', table, 'FUITE',
          `${Array.isArray(corps) ? corps.length : '?'} ligne(s) lisibles sans être connecté`);
      }
    } catch (e) {
      ajouter('lecture anonyme', table, 'ERREUR', String(e.message ?? e));
    }
  }
}

// ── 2. Comptage anonyme : même une statistique ne doit pas fuiter ───────────
async function comptageAnonyme() {
  for (const table of TABLES) {
    try {
      const r = await fetch(`${URL}/rest/v1/${table}?select=*`, {
        headers: { ...entetes, Prefer: 'count=exact', Range: '0-0' },
      });
      const plage = r.headers.get('content-range') ?? '';
      const total = Number(plage.split('/')[1]);
      if (!r.ok || !Number.isFinite(total) || total === 0) {
        ajouter('comptage anonyme', table, 'OK', plage || `refus ${r.status}`);
      } else {
        ajouter('comptage anonyme', table, 'FUITE', `total exposé : ${total}`);
      }
    } catch (e) {
      ajouter('comptage anonyme', table, 'ERREUR', String(e.message ?? e));
    }
  }
}

// ── 3. Écriture anonyme : tout doit être refusé ────────────────────────────
async function ecritureAnonyme() {
  const sonde = '__audit_securite__';
  for (const table of TABLES) {
    try {
      const r = await fetch(`${URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...entetes, Prefer: 'return=representation' },
        body: JSON.stringify({ name: sonde }),
      });
      if (r.ok) {
        const lignes = await r.json().catch(() => []);
        ajouter('écriture anonyme', table, 'FUITE', 'insertion acceptée sans être connecté');
        // Nettoyage : on ne laisse jamais de déchet derrière soi.
        for (const l of Array.isArray(lignes) ? lignes : []) {
          if (l?.id) await fetch(`${URL}/rest/v1/${table}?id=eq.${l.id}`, { method: 'DELETE', headers: entetes });
        }
      } else {
        ajouter('écriture anonyme', table, 'OK', `refus ${r.status}`);
      }
    } catch (e) {
      ajouter('écriture anonyme', table, 'ERREUR', String(e.message ?? e));
    }
  }
}

// ── 4. RPC anonymes : aucune ne doit agir ──────────────────────────────────
// On appelle sans argument : une fonction correctement protégée répond
// « non autorisé » (ou se plaint des arguments manquants) — jamais un succès.
async function rpcAnonymes() {
  const SENSIBLES = /platform_|submit_payment_claim|reveal_|cancel_|ban_/;
  for (const rpc of RPCS) {
    try {
      const r = await fetch(`${URL}/rest/v1/rpc/${rpc}`, {
        method: 'POST', headers: entetes, body: '{}',
      });
      const corps = await r.text();
      if (!r.ok) {
        ajouter('RPC anonyme', rpc, 'OK', `refus ${r.status}`);
      } else if (SENSIBLES.test(rpc)) {
        ajouter('RPC anonyme', rpc, 'FUITE', `répond 200 sans authentification : ${corps.slice(0, 120)}`);
      } else {
        // Résultat vide, ou prédicat qui répond « non » : ce sont des refus
        // corrects, pas des fuites (ex: is_school_admin → false).
        const refus = ['null', '[]', '', '0', 'false'].includes(corps.trim());
        ajouter('RPC anonyme', rpc, refus ? 'OK' : 'À VÉRIFIER', `200 : ${corps.slice(0, 120)}`);
      }
    } catch (e) {
      ajouter('RPC anonyme', rpc, 'ERREUR', String(e.message ?? e));
    }
  }
}

// ── 5. Le blocage d'abonnement est-il bien en base ? ───────────────────────
async function blocageAbonnement() {
  const r = await fetch(`${URL}/rest/v1/rpc/is_school_access_allowed`, {
    method: 'POST', headers: entetes,
    body: JSON.stringify({ p_school_id: '00000000-0000-0000-0000-000000000000' }),
  });
  const corps = await r.text();
  if (r.ok && corps.trim() === 'false') {
    ajouter('abonnement', 'is_school_access_allowed', 'OK', 'présente et refuse une école inconnue');
  } else {
    ajouter('abonnement', 'is_school_access_allowed', 'FUITE',
      `réponse inattendue (${r.status}) : ${corps.slice(0, 120)} — la migration docs/sql/subscription_enforcement.sql est-elle appliquée ?`);
  }
}

// ── Exécution ──────────────────────────────────────────────────────────────
const debut = Date.now();
console.log(`Audit de sécurité — ${TABLES.length} tables, ${RPCS.length} RPC\n`);

await lectureAnonyme();
await comptageAnonyme();
await ecritureAnonyme();
await rpcAnonymes();
await blocageAbonnement();

const fuites = resultats.filter(r => r.verdict === 'FUITE');
const aVerifier = resultats.filter(r => r.verdict === 'À VÉRIFIER');
const erreurs = resultats.filter(r => r.verdict === 'ERREUR');

for (const categorie of [...new Set(resultats.map(r => r.categorie))]) {
  const lot = resultats.filter(r => r.categorie === categorie);
  const ko = lot.filter(r => r.verdict !== 'OK');
  console.log(`${ko.length === 0 ? '✓' : '✗'} ${categorie.padEnd(18)} ${lot.length - ko.length}/${lot.length}`);
  for (const r of ko) console.log(`    ${r.verdict}  ${r.cible} — ${r.detail}`);
}

console.log(`\nDurée ${((Date.now() - debut) / 1000).toFixed(1)}s`);
console.log(`Fuites : ${fuites.length} · À vérifier : ${aVerifier.length} · Erreurs réseau : ${erreurs.length}`);

const iJson = process.argv.indexOf('--json');
if (iJson !== -1 && process.argv[iJson + 1]) {
  writeFileSync(process.argv[iJson + 1], JSON.stringify({
    date: new Date().toISOString(), tables: TABLES.length, rpcs: RPCS.length, resultats,
  }, null, 2));
}

process.exit(fuites.length > 0 ? 1 : 0);
