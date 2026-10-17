import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { siteDeDepart } from './siteWeb';
import { accesSiteWeb, menuPourMode } from './modeGestion';
import { CONTENU_DEFAUT, MODELES_SITE } from '@/siteEcole/contenu';
import { avecModele } from '@/siteEcole/ChoixModele';

describe('site web de l\'école — accès', () => {
  it('ouvert au directeur de toute école, bêta-testeuse ou non ; jamais aux autres comptes', () => {
    expect(accesSiteWeb({ beta_testeur: true }, 'admin')).toBe(true);
    expect(accesSiteWeb({ beta_testeur: false }, 'admin')).toBe(true);
    expect(accesSiteWeb({}, 'admin')).toBe(true);
    expect(accesSiteWeb({}, 'staff')).toBe(false);
    expect(accesSiteWeb({}, 'teacher')).toBe(false);
    expect(accesSiteWeb(null, 'admin')).toBe(false);
  });

  it('la rubrique « Site web » n\'apparaît dans le menu que si elle est ouverte, dans les deux modes', () => {
    for (const mode of ['classique', 'formation_pro'] as const) {
      expect(menuPourMode(mode).some(i => i.url === '/site-web')).toBe(false);
      const item = menuPourMode(mode, { siteWeb: true }).find(i => i.url === '/site-web');
      expect(item).toBeDefined();
      expect(item?.beta).toBeFalsy();
    }
  });
});

describe('site web de l\'école — site de départ', () => {
  const ecole = { name: 'Groupe Scolaire Les Bâtisseurs', logo_url: 'https://x/logo.png', phone: '+221 77 123 45 67', email: 'direction@batisseurs.sn', city: 'Thiès', country: 'Sénégal' };

  it('reprend ce que SenClass sait déjà de l\'école, sur le modèle Campus', () => {
    const c = siteDeDepart(ecole);
    expect(c.identite.modele).toBe('campus');
    expect(c.identite.nom).toBe('Groupe Scolaire Les Bâtisseurs');
    expect(c.identite.logo).toBe('https://x/logo.png');
    expect(c.identite.telephone).toBe('+221 77 123 45 67');
    expect(c.identite.whatsapp).toBe('+221 77 123 45 67');
    expect(c.identite.email).toBe('direction@batisseurs.sn');
    expect(c.identite.adresse).toBe('Thiès, Sénégal');
    expect(c.campus.motGeant).toBe('BÂTISSEURS');
    expect(c.accueil.diapos[0].surtitre).toBe('Bienvenue au Groupe Scolaire Les Bâtisseurs');
  });

  it('garde les exemples pour ce que l\'école n\'a pas renseigné, sans toucher au modèle', () => {
    const c = siteDeDepart({ name: 'École X', logo_url: null, phone: null, email: null, city: null, country: '' });
    expect(c.identite.logo).toBe(CONTENU_DEFAUT.identite.logo);
    expect(c.identite.telephone).toBe(CONTENU_DEFAUT.identite.telephone);
    expect(c.identite.adresse).toBe(CONTENU_DEFAUT.identite.adresse);
    expect(CONTENU_DEFAUT.identite.nom).toBe('Groupe Scolaire Excellence');
  });
});

describe('site web de l\'école — choix du modèle', () => {
  const ecole = { name: 'Lycée Sant Yalla', logo_url: null, phone: '+221 33 800 00 00', email: null, city: 'Dakar', country: 'Sénégal' };

  it('à la première ouverture, le modèle choisi arrive avec ses couleurs et les infos de l\'école', () => {
    for (const modele of Object.keys(MODELES_SITE) as (keyof typeof MODELES_SITE)[]) {
      const c = siteDeDepart(ecole, modele);
      expect(c.identite.modele).toBe(modele);
      expect([c.identite.couleur1, c.identite.couleur2]).toEqual([...MODELES_SITE[modele].couleurs]);
      expect(c.identite.nom).toBe('Lycée Sant Yalla');
    }
  });

  it('changer de modèle garde tous les textes ; les couleurs ne changent que si on le demande', () => {
    const avant = { ...siteDeDepart(ecole, 'campus') };
    const apresSans = avecModele(avant, 'prestige', false);
    expect(apresSans.identite.modele).toBe('prestige');
    expect(apresSans.identite.couleur1).toBe(avant.identite.couleur1);
    expect(apresSans.accueil).toBe(avant.accueil);
    const apresAvec = avecModele(avant, 'prestige', true);
    expect([apresAvec.identite.couleur1, apresAvec.identite.couleur2]).toEqual([...MODELES_SITE.prestige.couleurs]);
    expect(apresAvec.identite.nom).toBe('Lycée Sant Yalla');
  });
});
