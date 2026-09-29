// ═══════════════════════════════════════════════════════════════════════════
// IMPORT DU PROGRAMME (Cursus → Importer) — ce qu'il faut AJOUTER.
//
// Le fichier vient souvent d'un export de la même école, modifié à la main ou
// par une IA : il contient donc des cursus et des matières qui EXISTENT déjà.
// Règles :
//   • rien n'est supprimé ni écrasé (un coefficient existant reste tel quel) ;
//   • un cursus du même nom est COMPLÉTÉ (niveaux, matières, créneaux et
//     options manquants), jamais recréé — la base refuse deux cursus du même
//     nom dans une école ;
//   • l'élémentaire (CI à CM2) se décrit dans « elementaireDefaults » (barème
//     de points) ; une ligne d'élémentaire dans « niveauDefaults » est ignorée
//     et signalée ;
//   • un niveau inconnu, ou une ligne incomplète, est ignoré et signalé.
// Fonction pure, testée dans importProgramme.test.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { NIVEAUX_ELEMENTAIRE, type ElementaryDomaine, type ElementaryRegistre } from '@/lib/elementaryDefaults';

export const NIVEAUX_SECONDAIRE = ['6ème', '5ème', '4ème', '3ème', '2nde', '1ère', 'Tle'];
const ELEMENTAIRE = NIVEAUX_ELEMENTAIRE as readonly string[];
export const DOMAINES: ElementaryDomaine[] = ['LC', 'MATH', 'ESVS', 'EPSA'];
export const REGISTRES: ElementaryRegistre[] = ['RESSOURCES', 'COMPETENCE'];

// ─── État actuel de l'école ──────────────────────────────────────────────────
export interface EtatProgramme {
  niveauDefaults: { niveau: string; name: string }[];
  elementaire: { niveau: string; registre: string; name: string }[];
  filieres: {
    id: string; name: string; niveaux: string[];
    obligatoires: { niveau: string; name: string }[];
    facultatives: { niveau: string; name: string }[];
    groupes: { id: string; niveau: string; label: string; options: string[] }[];
  }[];
}

// ─── Ce qu'il faut faire ─────────────────────────────────────────────────────
export interface MatiereAjout { niveau: string; name: string; coefficient: number }
export interface GroupeAjout { groupId?: string; niveau: string; label: string; coefficient: number; options: string[] }
export interface CursusPlan {
  filiereId?: string;            // absent = cursus à créer
  name: string;
  description?: string;
  niveaux?: string[];            // présent = niveaux à enregistrer (liste complète)
  obligatoires: MatiereAjout[];
  facultatives: MatiereAjout[];
  groupes: GroupeAjout[];
}
export interface PlanImport {
  niveauAjouts: (MatiereAjout & { isFacultative: boolean })[];
  elementaireAjouts: { niveau: string; domaine: ElementaryDomaine; registre: ElementaryRegistre; name: string; pointMax: number }[];
  cursus: CursusPlan[];
  /** Lignes écartées, avec la raison, pour les montrer à l'école. */
  ignores: string[];
  /** Déjà présents : rien à faire (pour le compte rendu). */
  dejaPresents: number;
}

export const FICHIER_INVALIDE = "Fichier invalide — ce n'est pas un export de programme SenClass.";

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const coef = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
};
const cle = (...parts: string[]) => parts.map(p => p.toLowerCase()).join('::');

/** Calcule tout ce que l'import doit ajouter. Lève FICHIER_INVALIDE si ce n'est pas un export SenClass. */
export const planifierImport = (data: unknown, etat: EtatProgramme): PlanImport => {
  const d = data as Record<string, unknown> | null;
  const listes = ['niveauDefaults', 'filieres', 'elementaireDefaults'].filter(k => Array.isArray(d?.[k]));
  if (!d || typeof d !== 'object' || listes.length === 0) throw new Error(FICHIER_INVALIDE);

  const plan: PlanImport = { niveauAjouts: [], elementaireAjouts: [], cursus: [], ignores: [], dejaPresents: 0 };

  // 1. Matières de niveau (collège, lycée).
  const niveauxVus = new Set(etat.niveauDefaults.map(s => cle(s.niveau, s.name)));
  for (const brut of (d.niveauDefaults as unknown[] | undefined) ?? []) {
    const s = (brut ?? {}) as Record<string, unknown>;
    const niveau = texte(s.niveau);
    const name = texte(s.name);
    if (!niveau || !name) { plan.ignores.push('Matière de niveau incomplète (niveau ou nom manquant)'); continue; }
    if (ELEMENTAIRE.includes(niveau)) {
      plan.ignores.push(`${name} (${niveau}) : l'élémentaire se décrit dans « elementaireDefaults », avec un barème de points`);
      continue;
    }
    if (!NIVEAUX_SECONDAIRE.includes(niveau)) { plan.ignores.push(`${name} : niveau inconnu « ${niveau} »`); continue; }
    const k = cle(niveau, name);
    if (niveauxVus.has(k)) { plan.dejaPresents++; continue; }
    niveauxVus.add(k);
    plan.niveauAjouts.push({ niveau, name, coefficient: coef(s.coefficient), isFacultative: s.isFacultative === true });
  }

  // 2. Élémentaire (barème de points).
  const elemVus = new Set(etat.elementaire.map(l => cle(l.niveau, l.registre, l.name)));
  for (const brut of (d.elementaireDefaults as unknown[] | undefined) ?? []) {
    const l = (brut ?? {}) as Record<string, unknown>;
    const niveau = texte(l.niveau);
    const name = texte(l.name);
    const domaine = texte(l.domaine) as ElementaryDomaine;
    const registre = texte(l.registre) as ElementaryRegistre;
    const pointMax = Number(l.pointMax);
    if (!name) { plan.ignores.push('Ligne d\'élémentaire sans nom'); continue; }
    if (!ELEMENTAIRE.includes(niveau)) { plan.ignores.push(`${name} : « ${niveau} » n'est pas un niveau de l'élémentaire`); continue; }
    if (!DOMAINES.includes(domaine)) { plan.ignores.push(`${name} (${niveau}) : domaine « ${domaine} » inconnu (${DOMAINES.join(', ')})`); continue; }
    if (!REGISTRES.includes(registre)) { plan.ignores.push(`${name} (${niveau}) : registre « ${registre} » inconnu (${REGISTRES.join(', ')})`); continue; }
    if (!Number.isFinite(pointMax) || pointMax <= 0) { plan.ignores.push(`${name} (${niveau}) : barème « pointMax » invalide`); continue; }
    const k = cle(niveau, registre, name);
    if (elemVus.has(k)) { plan.dejaPresents++; continue; }
    elemVus.add(k);
    plan.elementaireAjouts.push({ niveau, domaine, registre, name, pointMax });
  }

  // 3. Cursus : compléter l'existant, créer le reste.
  const parNom = new Map(etat.filieres.map(f => [f.name.trim().toLowerCase(), f]));
  const dejaPlanifies = new Map<string, CursusPlan>();
  for (const brut of (d.filieres as unknown[] | undefined) ?? []) {
    const f = (brut ?? {}) as Record<string, unknown>;
    const name = texte(f.name);
    if (!name) { plan.ignores.push('Cursus sans nom'); continue; }
    const niveauxFichier = (Array.isArray(f.niveaux) ? f.niveaux : []).map(texte).filter(Boolean);
    const inconnus = niveauxFichier.filter(n => !NIVEAUX_SECONDAIRE.includes(n));
    inconnus.forEach(n => plan.ignores.push(`Cursus ${name} : niveau inconnu « ${n} »`));
    const niveauxValides = niveauxFichier.filter(n => NIVEAUX_SECONDAIRE.includes(n));

    const existant = parNom.get(name.toLowerCase());
    // Un même cursus répété dans le fichier : on complète le même plan.
    let p = dejaPlanifies.get(name.toLowerCase());
    if (!p) {
      p = { ...(existant ? { filiereId: existant.id } : {}), name: existant?.name ?? name, obligatoires: [], facultatives: [], groupes: [] };
      const description = texte(f.description);
      if (!existant && description) p.description = description;
      dejaPlanifies.set(name.toLowerCase(), p);
      plan.cursus.push(p);
    }
    const niveauxActuels = p.niveaux ?? existant?.niveaux ?? [];
    const union = [...niveauxActuels, ...niveauxValides.filter(n => !niveauxActuels.includes(n))];
    if (union.length !== niveauxActuels.length || (!existant && !p.niveaux && union.length > 0)) p.niveaux = union;
    const niveauxDuCursus = union;

    // Un niveau de matière vide = tous les niveaux du cursus ; sinon il doit en faire partie.
    const niveauMatiere = (v: unknown, quoi: string): string | null => {
      const n = texte(v);
      if (n === '') return '';
      if (!niveauxDuCursus.includes(n)) { plan.ignores.push(`Cursus ${name} : ${quoi} au niveau « ${n} », qui n'est pas un niveau du cursus`); return null; }
      return n;
    };

    const ajouterMatieres = (liste: unknown, existantes: { niveau: string; name: string }[], cible: MatiereAjout[], quoi: string) => {
      const vues = new Set([...existantes.map(m => cle(m.niveau, m.name)), ...cible.map(m => cle(m.niveau, m.name))]);
      for (const b of Array.isArray(liste) ? liste : []) {
        const m = (b ?? {}) as Record<string, unknown>;
        const nom = texte(m.name);
        if (!nom) { plan.ignores.push(`Cursus ${name} : ${quoi} sans nom`); continue; }
        const niveau = niveauMatiere(m.niveau, `${quoi} ${nom}`);
        if (niveau === null) continue;
        const k = cle(niveau, nom);
        if (vues.has(k)) { plan.dejaPresents++; continue; }
        vues.add(k);
        cible.push({ niveau, name: nom, coefficient: coef(m.coefficient) });
      }
    };
    ajouterMatieres(f.mandatorySubjects, existant?.obligatoires ?? [], p.obligatoires, 'matière obligatoire');
    ajouterMatieres(f.facultativeSubjects, existant?.facultatives ?? [], p.facultatives, 'matière facultative');

    for (const b of Array.isArray(f.choiceGroups) ? f.choiceGroups : []) {
      const g = (b ?? {}) as Record<string, unknown>;
      const label = texte(g.label);
      if (!label) { plan.ignores.push(`Cursus ${name} : créneau au choix sans nom`); continue; }
      const niveau = niveauMatiere(g.niveau, `créneau ${label}`);
      if (niveau === null) continue;
      const options = [...new Set((Array.isArray(g.options) ? g.options : []).map(texte).filter(Boolean))];
      const groupeExistant = existant?.groupes.find(x => cle(x.niveau, x.label) === cle(niveau, label));
      const groupePlan = p.groupes.find(x => cle(x.niveau, x.label) === cle(niveau, label));
      const dejaLa = new Set([...(groupeExistant?.options ?? []), ...(groupePlan?.options ?? [])].map(o => o.toLowerCase()));
      const nouvelles = options.filter(o => !dejaLa.has(o.toLowerCase()));
      plan.dejaPresents += options.length - nouvelles.length;
      if (groupePlan) { groupePlan.options.push(...nouvelles); continue; }
      if (groupeExistant) {
        if (nouvelles.length) p.groupes.push({ groupId: groupeExistant.id, niveau, label: groupeExistant.label, coefficient: coef(g.coefficient), options: nouvelles });
        else plan.dejaPresents++;
        continue;
      }
      p.groupes.push({ niveau, label, coefficient: coef(g.coefficient), options: nouvelles });
    }
  }
  // Un cursus existant sans rien de nouveau n'a pas besoin d'apparaître.
  plan.cursus = plan.cursus.filter(c => !c.filiereId || c.niveaux || c.obligatoires.length || c.facultatives.length || c.groupes.length);
  return plan;
};

/** Nombre d'éléments ajoutés par un plan (pour le compte rendu). */
export const compterAjouts = (p: PlanImport): number =>
  p.niveauAjouts.length + p.elementaireAjouts.length
  + p.cursus.reduce((s, c) => s + (c.filiereId ? 0 : 1) + c.obligatoires.length + c.facultatives.length
    + c.groupes.reduce((t, g) => t + (g.groupId ? 0 : 1) + g.options.length, 0), 0);

/** Le message lisible d'une erreur (Error, erreur Supabase, texte…) — jamais « [object Object] ». */
export const messageErreur = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown };
    const parts = [e.message, e.details, e.hint].filter((x): x is string => typeof x === 'string' && x.trim() !== '');
    if (parts.length) return parts.join(' — ');
  }
  return 'Erreur inconnue';
};
