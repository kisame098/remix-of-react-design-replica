import { describe, it, expect } from 'vitest';
import { adresseRefusee, adresseSiteEcole, nettoyerAdresse, sousDomaineEcole, suggestionAdresse } from './hoteEcole';

describe('site d\'école sur son sous-domaine', () => {
  it('reconnaît une adresse d\'école', () => {
    expect(sousDomaineEcole('gsexcellence.senclass.com')).toBe('gsexcellence');
    expect(sousDomaineEcole('Groupe-Scolaire-Excellence.SenClass.com')).toBe('groupe-scolaire-excellence');
    expect(sousDomaineEcole('lycee-2.localhost')).toBe('lycee-2');
  });

  it('ne prend jamais le SaaS, ses services ni une autre adresse pour un site d\'école', () => {
    for (const h of ['senclass.com', 'www.senclass.com', 'maj.senclass.com', 'send.senclass.com', 'rsend.senclass.com',
      'senclass.pages.dev', 'localhost', 'a.b.senclass.com', '-x.senclass.com', 'x-.senclass.com', 'gsexcellence.senclass.com.pirate.net']) {
      expect(sousDomaineEcole(h), h).toBeNull();
    }
  });

  it('adresse à partager : le sous-domaine en production, /site/… ailleurs', () => {
    expect(adresseSiteEcole('gsexcellence', 'senclass.com', 'https://senclass.com')).toBe('https://gsexcellence.senclass.com');
    expect(adresseSiteEcole('gsexcellence', 'www.senclass.com', 'https://www.senclass.com')).toBe('https://gsexcellence.senclass.com');
    expect(adresseSiteEcole('gsexcellence', 'localhost', 'http://localhost:8080')).toBe('http://localhost:8080/site/gsexcellence');
  });
});


describe('choix de l\'adresse du site', () => {
  it('accepte lettres minuscules, chiffres et tirets, de 3 à 63 caractères', () => {
    expect(adresseRefusee('gsexcellence')).toBeNull();
    expect(adresseRefusee('lycee-2')).toBeNull();
    expect(adresseRefusee('abc')).toBeNull();
    for (const mauvais of ['ab', 'GSE', 'gs excellence', '-gse', 'gse-', 'école', 'a'.repeat(64)]) {
      expect(adresseRefusee(mauvais), mauvais).toBe('format');
    }
  });

  it('refuse les adresses réservées à SenClass', () => {
    for (const r of ['www', 'maj', 'admin', 'api', 'send']) expect(adresseRefusee(r), r).toBe('reservee');
  });

  it('nettoie la saisie au fil de la frappe', () => {
    expect(nettoyerAdresse('GS Excellence')).toBe('gs-excellence');
    expect(nettoyerAdresse('Lycée  Sant Yalla!')).toBe('lycee-sant-yalla-');
    expect(nettoyerAdresse('--ecole')).toBe('ecole');
  });

  it('propose une adresse tirée du nom, toujours valable', () => {
    expect(suggestionAdresse('Groupe Scolaire Excellence')).toBe('groupe-scolaire-excellence');
    expect(suggestionAdresse('Lycée Sant Yalla')).toBe('lycee-sant-yalla');
    expect(suggestionAdresse('API')).toBe('ecole-api');
    expect(adresseRefusee(suggestionAdresse('Groupe Scolaire Excellence'))).toBeNull();
  });
});
