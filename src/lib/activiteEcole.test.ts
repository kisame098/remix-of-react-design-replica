import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { doitPinger, ilYA, jourActif, joursSansActivite, niveauActivite, type JourHistorique } from './activiteEcole';

const T = new Date('2026-09-20T12:00:00Z').getTime();
const avant = (ms: number) => new Date(T - ms).toISOString();
const MIN = 60_000, H = 3_600_000, J = 86_400_000;

describe('ping d\'activité', () => {
  it('premier ping toujours ; ensuite pas avant 5 minutes', () => {
    expect(doitPinger(null, T)).toBe(true);
    expect(doitPinger(T - 4 * MIN, T)).toBe(false);
    expect(doitPinger(T - 5 * MIN, T)).toBe(true);
  });
  it('une horloge qui recule ne bloque pas le suivi', () => {
    expect(doitPinger(T + H, T)).toBe(true);
  });
});

describe('niveau d\'activité', () => {
  it('seuils', () => {
    expect(niveauActivite(avant(5 * MIN), T)).toBe('en_ligne');
    expect(niveauActivite(avant(2 * H), T)).toBe('active');
    expect(niveauActivite(avant(3 * J), T)).toBe('active');
    expect(niveauActivite(avant(10 * J), T)).toBe('calme');
    expect(niveauActivite(avant(30 * J), T)).toBe('inactive');
  });
  it('aucune trace ou date illisible → jamais', () => {
    expect(niveauActivite(null, T)).toBe('jamais');
    expect(niveauActivite('n\'importe quoi', T)).toBe('jamais');
  });
});

describe('ilYA', () => {
  it('formule lisible', () => {
    expect(ilYA(avant(10_000), T)).toBe("à l'instant");
    expect(ilYA(avant(7 * MIN), T)).toBe('il y a 7 min');
    expect(ilYA(avant(3 * H), T)).toBe('il y a 3 h');
    expect(ilYA(avant(1 * J), T)).toBe('il y a 1 jour');
    expect(ilYA(avant(12 * J), T)).toBe('il y a 12 jours');
    expect(ilYA(avant(95 * J), T)).toBe('il y a 3 mois');
    expect(ilYA(null, T)).toBe('Jamais');
  });
  it('une date dans le futur ne donne pas de valeur négative', () => {
    expect(ilYA(new Date(T + H).toISOString(), T)).toBe("à l'instant");
  });
});

describe('historique', () => {
  const jour = (o: Partial<JourHistorique>): JourHistorique =>
    ({ jour: '2026-09-20', connectes: 0, notes: 0, seances: 0, paiements: 0, inscriptions: 0, ...o });
  it('un jour est actif dès qu\'une trace existe', () => {
    expect(jourActif(jour({}))).toBe(false);
    expect(jourActif(jour({ paiements: 1 }))).toBe(true);
    expect(jourActif(jour({ connectes: 2 }))).toBe(true);
  });
  it('compte les jours consécutifs sans trace depuis aujourd\'hui', () => {
    expect(joursSansActivite([jour({}), jour({}), jour({ notes: 3 }), jour({})])).toBe(2);
    expect(joursSansActivite([jour({ notes: 1 }), jour({})])).toBe(0);
    expect(joursSansActivite([jour({}), jour({})])).toBe(2);
  });
});

describe('vie privée — la fiche école ne contient aucune donnée d\'élève', () => {
  const sql = readFileSync('docs/sql/platform_activite_ecoles.sql', 'utf8');
  const page = readFileSync('src/pages/platform/PlatformSchoolDetail.tsx', 'utf8');

  it('le SQL ne lit jamais de nom, de note individuelle ni de contact d\'élève', () => {
    for (const interdit of ['first_name', 'last_name', 'student_profiles', 'photo_url', 'phone', 'parent']) {
      expect(sql, interdit).not.toContain(interdit);
    }
    // les seules lectures de `payments.amount` sont des sommes
    expect(sql).not.toMatch(/select\s+amount\b/);
  });
  it('la page passe uniquement par les fonctions réservées au chef du système', () => {
    expect(page).not.toMatch(/\.from\(/);
    expect(page).toContain("rpc('platform_school_detail'");
  });
  it('toutes les fonctions exposées vérifient le chef du système', () => {
    for (const nom of ['platform_schools_overview', 'platform_school_detail']) {
      const corps = sql.slice(sql.indexOf(`function public.${nom}`), sql.indexOf(`revoke all on function public.${nom}`));
      expect(corps, nom).toContain('get_is_platform_admin()');
    }
  });
  it('la table d\'activité n\'a ni politique ni accès direct', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke all on table public.school_user_days from anon, authenticated');
    expect(sql).not.toMatch(/create policy[^;]*school_user_days/);
  });
});
