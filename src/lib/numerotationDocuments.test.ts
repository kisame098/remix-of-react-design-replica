import { describe, it, expect } from 'vitest';
import { prefixeDuModele, formaterNumero, numeroProvisoire, utiliseNumero } from './numerotationDocuments';
import { verifierModele } from './modelesDocuments';

describe('numérotation des documents délivrés', () => {
  it('même format que les reçus : PRÉFIXE-année de début-5 chiffres', () => {
    expect(formaterNumero('CS', '2026-2027', 42)).toBe('CS-2026-00042');
    expect(numeroProvisoire('CS', '2026-2027')).toBe('CS-2026-·····');
  });

  it('préfixe fixé pour les modèles fournis, initiales du nom pour ceux de l\'école', () => {
    expect(prefixeDuModele('senclass:certificat-scolarite', 'peu importe')).toBe('CS');
    expect(prefixeDuModele('uuid', "Attestation de réussite")).toBe('AR');
    expect(prefixeDuModele('uuid', "Certificat d'inscription — cycle moyen")).toBe('CICM');
    expect(prefixeDuModele('uuid', 'Bulletin de sortie de l’élève spécial')).toBe('BSES');
    expect(prefixeDuModele('uuid', '123 —')).toBe('DOC');
  });

  it('un modèle n\'est numéroté que s\'il contient le champ {NUMÉRO DU DOCUMENT}', () => {
    expect(utiliseNumero(verifierModele('<html><body><p>N° {numéro du document}</p></body></html>'))).toBe(true);
    expect(utiliseNumero(verifierModele('<html><body><p>{CLASSE}</p></body></html>'))).toBe(false);
  });
});
