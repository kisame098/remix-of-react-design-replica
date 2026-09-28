import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { messageErreurCompte, normaliserEmail, verifierComptePersonnel, MIN_MOT_DE_PASSE } from './comptePersonnel';

describe('compte du personnel : vraie adresse et mot de passe choisi', () => {
  const ok = { nom: 'Awa Ndiaye', email: 'awa.ndiaye@gmail.com', motDePasse: 'dakar2026' };

  it('accepte une vraie adresse et un mot de passe choisi', () => {
    expect(verifierComptePersonnel(ok)).toEqual([]);
  });

  it('refuse ce qui ne marcherait pas à la connexion', () => {
    expect(verifierComptePersonnel({ ...ok, nom: ' ' })).toContain('Le nom complet est obligatoire');
    expect(verifierComptePersonnel({ ...ok, email: 'awa.gmail.com' })).toContain("L'adresse e-mail n'est pas valide");
    expect(verifierComptePersonnel({ ...ok, motDePasse: '12345' })[0]).toMatch(`${MIN_MOT_DE_PASSE} caractères`);
    expect(verifierComptePersonnel({ ...ok, motDePasse: ' secret1' })[0]).toMatch(/espace/);
  });

  it('l’adresse est rangée en minuscules, sans espaces', () => {
    expect(normaliserEmail('  Awa.Ndiaye@Gmail.COM ')).toBe('awa.ndiaye@gmail.com');
  });

  it('adresse déjà utilisée : message clair en français', () => {
    expect(messageErreurCompte('A user with this email address has already been registered')).toMatch(/déjà utilisée/);
  });
});

describe('garde-fous de sécurité des fonctions Supabase', () => {
  const creation = readFileSync('supabase/functions/create-staff-account/index.ts', 'utf8');
  const changement = readFileSync('supabase/functions/reset-school-account/index.ts', 'utf8');
  const sql = readFileSync('docs/sql/personnel_vrai_email.sql', 'utf8');

  it('le compte créé est marqué « compte d’école » : le déclencheur ne crée ni école ni directeur', () => {
    expect(creation).toMatch(/app_metadata: \{ compte_ecole: true \}/);
    expect(sql).toMatch(/raw_app_meta_data->>'compte_ecole'/);
    // Surtout pas user_metadata, que n'importe qui peut remplir en s'inscrivant.
    expect(sql).not.toMatch(/raw_user_meta_data->>'compte_ecole'/);
  });

  it('création : directeur uniquement, et seulement un compte personnel de SON école', () => {
    expect(creation).toMatch(/callerMember\?\.role !== 'admin_school'/);
    expect(creation).toMatch(/ligne\.school_id !== schoolId \|\| ligne\.role !== 'staff'/);
  });

  it('changement de mot de passe : même école obligatoire, personnel réservé au directeur', () => {
    expect(changement).toMatch(/rpc\('get_my_school_id'\)/);
    expect(changement).toMatch(/account\.school_id !== schoolId/);
    expect(changement).toMatch(/account\.role === 'staff'/);
  });
});
