import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { etapeFranchie, messageErreurSuppression, motValide, nomValide, lignesApercu } from './suppressionEcole';

describe('suppression d\'école — confirmations', () => {
  it('le mot doit être SUPPRIMER en majuscules', () => {
    expect(motValide('SUPPRIMER')).toBe(true);
    expect(motValide(' SUPPRIMER ')).toBe(true);
    expect(motValide('supprimer')).toBe(false);
    expect(motValide('')).toBe(false);
  });

  it('le nom doit être exact (casse et accents), sans jamais valider une saisie vide', () => {
    expect(nomValide('École Sainte-Anne', 'École Sainte-Anne')).toBe(true);
    expect(nomValide('  École Sainte-Anne ', 'École Sainte-Anne')).toBe(true);
    expect(nomValide('ecole sainte-anne', 'École Sainte-Anne')).toBe(false);
    expect(nomValide('', '')).toBe(false);
  });

  it('chaque étape exige la sienne, la dernière les exige toutes', () => {
    const nom = 'Collège Test';
    expect(etapeFranchie(1, { compris: false, mot: '', nom: '' }, nom)).toBe(false);
    expect(etapeFranchie(1, { compris: true, mot: '', nom: '' }, nom)).toBe(true);
    expect(etapeFranchie(2, { compris: true, mot: 'oui', nom: '' }, nom)).toBe(false);
    expect(etapeFranchie(2, { compris: true, mot: 'SUPPRIMER', nom: '' }, nom)).toBe(true);
    expect(etapeFranchie(3, { compris: true, mot: 'SUPPRIMER', nom: 'Autre' }, nom)).toBe(false);
    expect(etapeFranchie(3, { compris: false, mot: 'SUPPRIMER', nom }, nom)).toBe(false);
    expect(etapeFranchie(3, { compris: true, mot: 'SUPPRIMER', nom }, nom)).toBe(true);
  });

  it('messages d\'erreur lisibles', () => {
    expect(messageErreurSuppression({ message: "Le nom saisi ne correspond pas à celui de l'école" })).toMatch(/nom saisi/);
    expect(messageErreurSuppression({ message: 'Non autorisé' })).toMatch(/chef du système/);
    expect(messageErreurSuppression(new Error('fetch failed'))).toMatch(/Rien n'a été effacé/);
  });

  it('l\'aperçu liste les effectifs', () => {
    const l = lignesApercu({ eleves: 3, professeurs: 2, classes: 1, paiements: 9, recus: 4, bulletins: 0, comptes: 7, compte_chef_conserve: false });
    expect(l.find(x => x.label === 'Élèves')?.valeur).toBe(3);
    expect(l.find(x => x.label === 'Comptes de connexion')?.valeur).toBe(7);
  });
});

describe('suppression d\'école — le serveur est la vraie barrière', () => {
  const sql = readFileSync('docs/sql/platform_supprimer_ecole.sql', 'utf8');
  const corps = sql.slice(sql.indexOf('function public.platform_delete_school'));

  it('réservée au chef du système, avec nom exact et mot SUPPRIMER vérifiés en base', () => {
    expect(corps).toContain('get_is_platform_admin()');
    expect(corps).toMatch(/p_confirm_name/);
    expect(corps).toContain("'SUPPRIMER'");
  });
  it('protège les chefs du système, l\'appelant et les comptes partagés avec une autre école', () => {
    expect(corps).toContain('platform_admins');
    expect(corps).toContain('auth.uid()');
    expect(corps).toMatch(/school_id <> p_school_id/);
  });
  it('conserve la comptabilité d\'abonnement et écrit un journal avant d\'effacer', () => {
    expect(corps).toContain('update public.billing_transactions');
    expect(corps.indexOf('platform_deleted_schools')).toBeLessThan(corps.indexOf('delete from public.schools'));
  });
  it('n\'est exécutable que par un utilisateur connecté', () => {
    expect(sql).toContain('revoke all on function public.platform_delete_school(uuid, text, text) from public, anon');
  });
  it('l\'écran école n\'expose la suppression que via la boîte à 3 étapes', () => {
    const page = readFileSync('src/pages/platform/PlatformSchools.tsx', 'utf8');
    expect(page).toContain('SuppressionEcoleDialog');
    expect(page).not.toContain("rpc('platform_delete_school'");
  });
});
