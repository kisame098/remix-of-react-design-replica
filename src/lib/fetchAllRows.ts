import { supabase } from '@/integrations/supabase/client';

// PostgREST plafonne chaque requête à un nombre de lignes par défaut (1000
// sur ce projet) et ne renvoie AUCUNE erreur en cas de troncature — juste un
// statut 206 et un header Content-Range que supabase-js n'expose pas côté
// appelant. Un `.select('*')` classique sur une grande école (des milliers de
// notes/présences/paiements) revient donc silencieusement incomplet.
//
// Cette fonction reproduit un `.select('*')` filtré mais en paginant avec
// `.range()`. Pour une grande école (dizaines/centaines de milliers de
// lignes), paginer en séquentiel — une page à la fois, en attendant chaque
// réponse avant de lancer la suivante — peut prendre plusieurs dizaines de
// secondes. On lance donc les pages EN PARALLÈLE (nombre de pages connu à
// l'avance via un count exact), avec une limite de concurrence pour ne pas
// saturer le pool de connexions Supabase. Signature et comportement
// inchangés pour tous les appelants existants — uniquement plus rapide.
//
// IMPORTANT — pagination stable : OFFSET/LIMIT (ce que fait `.range()`) n'est
// garanti stable par Postgres QUE si la requête a un ORDER BY déterministe.
// Sans ça, deux exécutions de la même requête peuvent renvoyer les lignes
// dans un ordre différent — des lignes sautées, d'autres dupliquées d'une
// page à l'autre. Plusieurs appelants historiques de fetchAllRows n'avaient
// aucun `.order()` (ex: `grades`) ; vérifié en conditions réelles sur une
// école de 1002 élèves / 14560 notes : ~11% des lignes étaient mal réparties
// entre pages. On ajoute donc TOUJOURS `.order('id')` en secours après les
// filtres de l'appelant — composé avec un éventuel tri déjà demandé (ex:
// `.order('created_at')` devient `ORDER BY created_at, id`), garantissant un
// résultat stable même quand l'appelant ne trie sur rien d'unique.
//
// `applyFilters` reçoit le query builder juste après `.select(...)` et doit y
// appliquer les `.eq()`/`.in()`/`.order()` nécessaires (sans jamais appeler
// `.range()` soi-même).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const applyStableOrder = (query: any) => query.order('id', { ascending: true }); // eslint-disable-line @typescript-eslint/no-explicit-any

export async function fetchAllRows(
  table: string,
  applyFilters: (query: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
  pageSize = 1000,
  concurrency = 8,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any[]; error: Error | null }> {
  // 1. Nombre total de lignes correspondant au filtre (aucune ligne renvoyée
  //    — juste le compte, via le header Content-Range de PostgREST).
  const countQuery = applyFilters(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from as any)(table).select('*', { count: 'exact', head: true }),
  );
  const { count, error: countError } = await countQuery;

  // Le count a échoué (réseau, policy inhabituelle...) → on retombe sur
  // l'ancien comportement séquentiel plutôt que d'échouer complètement.
  if (countError || count == null) {
    return fetchAllRowsSequential(table, applyFilters, pageSize);
  }
  if (count === 0) return { data: [], error: null };

  // 2. Récupérer chaque page en parallèle, borné par `concurrency` requêtes
  //    simultanées (des pools de workers plutôt qu'un Promise.all massif).
  const pageCount = Math.ceil(count / pageSize);
  const pages: unknown[][] = new Array(pageCount);
  let firstError: Error | null = null;
  let nextPage = 0;

  const worker = async () => {
    while (!firstError) {
      const page = nextPage++;
      if (page >= pageCount) return;
      const from = page * pageSize;
      const query = applyStableOrder(applyFilters((supabase.from as any)(table).select('*'))); // eslint-disable-line @typescript-eslint/no-explicit-any
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) { firstError = error; return; }
      pages[page] = data ?? [];
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, pageCount) }, worker));

  if (firstError) return { data: pages.flat().filter(Boolean), error: firstError };
  return { data: pages.flat(), error: null };
}

// Ancien comportement (une page à la fois) — filet de sécurité si le count
// exact échoue pour une raison quelconque.
async function fetchAllRowsSequential(
  table: string,
  applyFilters: (query: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
  pageSize: number,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any[]; error: Error | null }> {
  const all: unknown[] = [];
  let from = 0;

  while (true) {
    const query = applyStableOrder(applyFilters((supabase.from as any)(table).select('*'))); // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) return { data: all, error };
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}
