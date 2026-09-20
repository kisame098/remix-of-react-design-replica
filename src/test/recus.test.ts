import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ════════════════════════════════════════════════════════════════════════════
// Garde-fous du système de reçus et de la fiche d'inscription. Ils lisent le
// code : ce sont des règles qui ne doivent pas s'affaiblir en silence lors d'une
// retouche — surtout celles qui protègent l'ENCAISSEMENT.
// ════════════════════════════════════════════════════════════════════════════

const RACINE = process.cwd();
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), 'utf8');
/** Le corps d'une fonction ou d'un bloc, de `debut` jusqu'à `fin`. */
const entre = (source: string, debut: string, fin: string): string => {
  const i = source.indexOf(debut);
  expect(i, `« ${debut} » introuvable`).toBeGreaterThan(-1);
  const j = source.indexOf(fin, i + debut.length);
  return source.slice(i, j === -1 ? undefined : j);
};

describe('l\'encaissement reste intact', () => {
  const contexte = lire('src/contexts/PaymentContext.tsx');

  it('addPayment n\'appelle PAS la fonction de reçu : elle ne fait qu\'insérer le paiement', () => {
    const addPayment = entre(contexte, 'const addPayment = useCallback', 'const emettreRecu');
    expect(addPayment).toContain(".from('payments')");
    expect(addPayment).toContain('.insert(');
    expect(addPayment).not.toMatch(/issue_receipt|emettreRecu|receipt/i);
  });

  it('le reçu est émis par une fonction séparée, après l\'encaissement', () => {
    expect(contexte).toMatch(/const emettreRecu = useCallback/);
    expect(contexte).toMatch(/rpc\('issue_receipt'/);
  });

  it('le chargement des reçus ne peut PAS empêcher les paiements de se charger', () => {
    // fetchAllRows('receipts', …) est rattrapé : son échec est absorbé.
    expect(entre(contexte, "fetchAllRows('receipts'", ']).then')).toMatch(/\.catch\(\(\) => \(\{ data: null \}\)\)/);
  });

  it('la caisse et l\'encaissement ne demandent le reçu qu\'APRÈS l\'enregistrement', () => {
    const entree = lire('src/components/payment/PaymentEntry.tsx');
    const iBoucle = entree.indexOf('enregistres.push(await addPayment(');
    const iRecu = entree.indexOf('await montrerRecu(enregistres');
    expect(iBoucle).toBeGreaterThan(-1);
    expect(iRecu).toBeGreaterThan(iBoucle);

    const caisse = lire('src/pages/Caisse.tsx');
    expect(caisse.indexOf('const enregistre = await addPayment(')).toBeLessThan(caisse.indexOf('montrerRecu([enregistre]'));
  });

  it('si un élément échoue en cours d\'encaissement, ceux déjà enregistrés reçoivent quand même leur reçu', () => {
    const entree = lire('src/components/payment/PaymentEntry.tsx');
    expect(entree).toMatch(/catch \(err\) \{[\s\S]{0,300}enregistres\.length > 0[\s\S]{0,100}montrerRecu\(enregistres/);
  });

  it('montrerRecu ne lève jamais : tout est dans un try/catch qui avertit', () => {
    const hook = lire('src/hooks/useRecus.tsx');
    const corps = entre(hook, 'const montrerRecu = useCallback', 'const dialogueRecu');
    expect(corps).toMatch(/try \{/);
    expect(corps).toMatch(/\} catch \{/);
    expect(corps).not.toMatch(/\bthrow\b/);
  });
});

describe('SQL — docs/sql/recus.sql', () => {
  const sql = lire('docs/sql/recus.sql');

  it('la table des reçus a la sécurité par ligne, et AUCUNE politique d\'écriture', () => {
    expect(sql).toMatch(/alter table public\.receipts enable row level security/i);
    expect(sql).not.toMatch(/create policy[^;]*on public\.receipts\s+for (insert|update|delete|all)/i);
    expect(sql).toMatch(/create policy "recus: lecture[^"]*" on public\.receipts\s+for select/i);
  });

  it('un élève voit ses reçus, sans contrôle d\'abonnement (comme pour ses paiements)', () => {
    expect(sql).toMatch(/school_id = get_my_school_id\(\) or student_enrollment_id = get_my_student_enrollment_id\(\)/);
  });

  it('le chemin d\'encaissement n\'est PAS touché : aucune politique ni contrainte sur payments', () => {
    expect(sql).not.toMatch(/create policy[^;]*on public\.payments/i);
    expect(sql).not.toMatch(/drop policy[^;]*on public\.payments/i);
    const altersPayments = [...sql.matchAll(/alter table public\.payments\s+([^;]+);/gi)].map(m => m[1].trim().replace(/\s+/g, ' '));
    expect(altersPayments).toHaveLength(1);
    expect(altersPayments[0]).toMatch(/^add column if not exists receipt_id uuid references public\.receipts\(id\) on delete set null$/);
  });

  it('la colonne receipt_id est FACULTATIVE : un paiement sans reçu reste valable', () => {
    expect(sql).not.toMatch(/receipt_id[^,;]*not null/i);
  });

  it('issue_receipt exige le droit d\'encaisser et l\'appartenance à l\'école', () => {
    const f = entre(sql, 'create or replace function public.issue_receipt', 'grant execute');
    expect(f).toMatch(/not can_manage_payments\(\)/);
    expect(f).toMatch(/v_school\s+uuid := get_my_school_id\(\)/);
    expect(f).toMatch(/school_id <> v_school/);
  });

  it('numérotation sous verrou : deux caissiers au même instant ne prennent pas le même numéro', () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtext\('recu:' \|\| v_school::text\)\)/);
    expect(sql).toMatch(/unique \(school_id, academic_year_label, number\)/);
  });

  it('refus des mélanges : un seul élève, une seule année, jamais un paiement annulé', () => {
    expect(sql).toMatch(/Un reçu ne couvre qu''un seul élève et une seule année/);
    expect(sql).toMatch(/Paiement annulé : aucun reçu à émettre/);
    expect(sql).toMatch(/appartiennent déjà à des reçus différents/);
  });

  it('idempotent : rappeler la fonction ne crée pas de second reçu', () => {
    expect(sql).toMatch(/if v_nulls = 0 and v_recus = 1 then/);
  });

  it('la seule écriture sur payments est le rattachement du reçu', () => {
    const maj = [...sql.matchAll(/update public\.payments set ([^;]+);/gi)].map(m => m[1]);
    expect(maj).toEqual(['receipt_id = v_recu.id where id = any(v_ids)']);
  });

  it('la fonction n\'est pas appelable sans être connecté', () => {
    expect(sql).toMatch(/revoke all on function public\.issue_receipt\(uuid\[\]\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.issue_receipt\(uuid\[\]\) to authenticated/i);
  });
});

describe('fiche d\'inscription — confidentialité des identifiants', () => {
  const pdf = lire('src/lib/ficheInscriptionPdf.ts');

  it('le mot de passe n\'est dessiné que dans la page dédiée à la famille', () => {
    const occurrences = pdf.match(/compte\.motDePasse|data\.compte\.motDePasse/g) ?? [];
    expect(occurrences).toHaveLength(1);
    expect(entre(pdf, 'const pageIdentifiants', 'export async function')).toContain('compte.motDePasse');
  });

  it('la page 1 (archivée par l\'école) ne dessine ni identifiant ni mot de passe', () => {
    const page1 = entre(pdf, 'const pageFiche', '// ─── Page 2');
    expect(page1).not.toMatch(/motDePasse|compte\.identifiant/);
  });

  it('les identifiants ne sont lus que depuis school_accounts, par l\'inscription de l\'élève', () => {
    const src = lire('src/lib/identifiantsEleve.ts');
    expect(src).toMatch(/\.from\('school_accounts'\)/);
    expect(src).toMatch(/\.eq\('student_enrollment_id', inscriptionId\)/);
    expect(src).toMatch(/\.eq\('role', 'student'\)/);
  });

  it('le mot de passe n\'est jamais écrit dans un journal ni dans le stockage du navigateur', () => {
    for (const fichier of [
      'src/lib/ficheInscription.ts', 'src/lib/ficheInscriptionPdf.ts',
      'src/lib/identifiantsEleve.ts', 'src/hooks/useFicheInscription.tsx',
    ]) {
      const code = lire(fichier);
      expect(code, fichier).not.toMatch(/console\.(log|info|warn|error)/);
      expect(code, fichier).not.toMatch(/localStorage|sessionStorage/);
    }
  });

  it('l\'adresse imprimée est celle du site public, pas celle de l\'onglet ouvert', () => {
    expect(lire('src/hooks/useFicheInscription.tsx')).toMatch(/ADRESSE_SITE_PUBLIC = 'https:\/\/senclass\.com'/);
    expect(lire('src/hooks/useFicheInscription.tsx')).not.toMatch(/window\.location/);
  });
});

describe('branchements', () => {
  it('l\'inscription ET la réinscription ouvrent la fiche, après le succès', () => {
    const page = lire('src/pages/StudentRegistration.tsx');
    expect(page).toMatch(/montrerFiche\(student, \{ reinscription: false \}\)/);
    expect(page).toMatch(/montrerFiche\(student, \{ reinscription: true \}\)/);
    expect(page.indexOf("title: 'Inscription réussie !'")).toBeLessThan(page.indexOf('montrerFiche(student, { reinscription: false })'));
  });

  it('la fiche se réédite depuis le profil de l\'élève', () => {
    expect(lire('src/pages/StudentManagement.tsx')).toMatch(/montrerFiche\(selectedStudent\)/);
  });

  it('l\'historique de la caisse propose le reçu', () => {
    expect(lire('src/pages/Caisse.tsx')).toMatch(/montrerRecu\(\[p\], \{ duplicata: !!p\.receiptId \}\)/);
  });

  it('la famille retrouve ses reçus dans le portail — toujours en DUPLICATA', () => {
    expect(lire('src/pages/portal/PortalPaiements.tsx')).toContain('useRecuFamille');
    expect(lire('src/components/portal/RecuFamille.tsx')).toMatch(/duplicata: true/);
  });

  it('les Paramètres saisissent l\'adresse et le n° d\'agrément affichés en en-tête', () => {
    const parametres = lire('src/pages/Settings.tsx');
    expect(parametres).toContain('CLE_ADRESSE_ECOLE');
    expect(parametres).toContain('CLE_NINEA_ECOLE');
    expect(lire('src/lib/documentsEcole.ts')).toMatch(/CLE_ADRESSE_ECOLE = 'adresse'/);
  });

  it('jsPDF n\'est chargé qu\'au moment d\'imprimer (import dynamique), pas dans le lot principal', () => {
    for (const fichier of ['src/hooks/useRecus.tsx', 'src/hooks/useFicheInscription.tsx', 'src/components/portal/RecuFamille.tsx']) {
      const code = lire(fichier);
      expect(code, fichier).not.toMatch(/^import .* from '@\/lib\/(recuPdf|ficheInscriptionPdf)'/m);
      expect(code, fichier).toMatch(/import\('@\/lib\/(recuPdf|ficheInscriptionPdf)'\)/);
    }
  });
});
