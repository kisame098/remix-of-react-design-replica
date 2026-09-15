import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  generateLoginEmail, generateStaffDisplayId, generatePassword,
  DOMAINE_COMPTES, ANCIEN_DOMAINE_COMPTES,
} from './accountUtils';

// ════════════════════════════════════════════════════════════════════════════
// IDENTIFIANTS remis aux familles et au personnel. Un email invalide ou un mot
// de passe ambigu (O/0, I/l) se traduit par une file d'attente au secrétariat.
// Les noms sénégalais sont accentués et composés : Ndèye Fatou, N'Diaye…
// ════════════════════════════════════════════════════════════════════════════

describe('generateLoginEmail', () => {
  it('construit prenom.nom.XXXXX@senclass.com', () => {
    expect(generateLoginEmail('Fatou', 'Diop')).toMatch(/^fatou\.diop\.\d{5}@senclass\.com$/);
  });

  it('retire les accents plutôt que de produire un email invalide', () => {
    expect(generateLoginEmail('Ndèye', 'Bâ')).toMatch(/^ndeye\.ba\.\d{5}@senclass\.com$/);
    expect(generateLoginEmail('Aïssatou', 'Sèye')).toMatch(/^aissatou\.seye\./);
  });

  it('retire apostrophes, tirets et espaces des noms composés', () => {
    expect(generateLoginEmail("N'Diaye", 'Sow-Fall')).toMatch(/^ndiaye\.sowfall\.\d{5}@/);
    expect(generateLoginEmail('Marie Claire', 'Da Silva')).toMatch(/^marieclaire\.dasilva\./);
  });

  it('ne produit jamais un email vide, même sur une saisie vide ou exotique', () => {
    expect(generateLoginEmail('', '')).toMatch(/^user\.account\.\d{5}@senclass\.com$/);
    expect(generateLoginEmail('...', '???')).toMatch(/^user\.account\./);
    expect(generateLoginEmail('李', '明')).toMatch(/^user\.account\./);
  });

  it('ne contient que des caractères valides en partie locale', () => {
    for (let i = 0; i < 200; i++) {
      const email = generateLoginEmail('Mòùssá', 'Ñdòùr');
      expect(email).toMatch(/^[a-z0-9.]+@senclass\.com$/);
    }
  });

  it('varie d\'un appel à l\'autre pour deux homonymes', () => {
    const emails = new Set(Array.from({ length: 200 }, () => generateLoginEmail('Fatou', 'Diop')));
    expect(emails.size).toBeGreaterThan(150); // 90 000 suffixes possibles
  });
});

describe('generateStaffDisplayId', () => {
  it('suit le format PERS-AAAA-NNNNN avec l\'année courante', () => {
    const year = new Date().getFullYear();
    expect(generateStaffDisplayId()).toMatch(new RegExp(`^PERS-${year}-\\d{5}$`));
  });
});

describe('generatePassword', () => {
  const passwords = Array.from({ length: 300 }, () => generatePassword());

  it('fait toujours 10 caractères', () => {
    expect(passwords.every(p => p.length === 10)).toBe(true);
  });

  it('contient toujours majuscule, minuscule et chiffre', () => {
    expect(passwords.every(p => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p))).toBe(true);
  });

  it('N\'UTILISE JAMAIS de caractères ambigus à dicter (O 0 I l 1)', () => {
    // Un mot de passe est lu à voix haute ou recopié depuis un papier.
    expect(passwords.some(p => /[O0Il1]/.test(p))).toBe(false);
  });

  it('ne produit pas deux fois le même mot de passe', () => {
    expect(new Set(passwords).size).toBe(passwords.length);
  });

  it('ne place pas systématiquement le chiffre au même endroit (mélange effectif)', () => {
    const positions = new Set(passwords.map(p => p.search(/[0-9]/)));
    expect(positions.size).toBeGreaterThan(3);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LE DOMAINE DU CODE ET CELUI DE LA BASE DOIVENT CONCORDER.
//
// handle_new_user() (base de données) reconnaît les comptes générés à leur
// domaine. Si le code génère un domaine que la base ne connaît pas, chaque
// nouvel élève passe pour un directeur qui s'inscrit : la base lui crée une
// fausse école. Vérifié sur la vraie base, dans une transaction annulée : un
// élève @senclass.com créé avec l'ancienne fonction ajoutait bien une école.
// ════════════════════════════════════════════════════════════════════════════
describe('domaine des comptes générés ↔ base de données', () => {
  const sql = readFileSync(join(process.cwd(), 'docs/sql/domaine_senclass.sql'), 'utf8');

  it('les adresses générées utilisent le domaine déclaré', () => {
    expect(generateLoginEmail('Awa', 'Ndiaye').endsWith(`@${DOMAINE_COMPTES}`)).toBe(true);
  });

  it('handle_new_user() reconnaît le domaine ACTUEL', () => {
    expect(sql).toContain(`'${DOMAINE_COMPTES}'`);
  });

  it('…et l\'ANCIEN : les comptes déjà distribués restent des comptes élèves', () => {
    expect(sql).toContain(`'${ANCIEN_DOMAINE_COMPTES}'`);
  });

  it('la comparaison porte sur le domaine exact, sans tenir compte des majuscules', () => {
    expect(sql).toMatch(/lower\(split_part\(NEW\.email, '@', 2\)\) IN/);
  });
});
