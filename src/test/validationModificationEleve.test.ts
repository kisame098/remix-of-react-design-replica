import { describe, it, expect } from 'vitest';
import { erreurModificationEleve, type ChampsControles } from '@/lib/validationModificationEleve';

const complet: ChampsControles = {
  firstName: 'Awa', lastName: 'Diop', dateOfBirth: '2012-03-04', placeOfBirth: 'Dakar',
  sex: 'femme', residence: 'Pikine', tutor1: { phone: '771234567', status: 'pere' },
};
// Fiche importée : seulement le nom.
const incomplet: ChampsControles = {
  firstName: 'Moussa', lastName: 'Fall', dateOfBirth: '', placeOfBirth: '',
  sex: '', residence: '', tutor1: { phone: '', status: '' },
};

describe('Modifier un élève', () => {
  it('fiche incomplète : on peut changer un numéro sans tout remplir', () => {
    const apres = { ...incomplet, tutor1: { phone: '781112233', status: '' } };
    expect(erreurModificationEleve(incomplet, apres)).toBeNull();
  });

  it('fiche complète : changer le téléphone du tuteur passe', () => {
    expect(erreurModificationEleve(complet, { ...complet, tutor1: { ...complet.tutor1, phone: '700000000' } })).toBeNull();
  });

  it('effacer une valeur obligatoire qui existait est refusé', () => {
    const msg = erreurModificationEleve(complet, { ...complet, residence: '  ', tutor1: { ...complet.tutor1, phone: '' } });
    expect(msg).toContain('lieu de résidence');
    expect(msg).toContain('téléphone du tuteur 1');
  });

  it('le nom et le prénom restent toujours exigés', () => {
    expect(erreurModificationEleve(incomplet, { ...incomplet, firstName: '' })).toMatch(/nom et le prénom/);
  });
});
