import { describe, it, expect } from 'vitest';
import { adresseSiteEcole, sousDomaineEcole } from './hoteEcole';

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
