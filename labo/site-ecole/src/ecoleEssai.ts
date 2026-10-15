import type { InfosEcole } from './modele';

/**
 * École FICTIVE du laboratoire. Elle remplace les données du SaaS
 * (table `schools` : name, slug, logo_url, city, country, phone, email ;
 * classes / formations) tant que l'éditeur n'y est pas branché.
 */
export const ECOLE_ESSAI: InfosEcole = {
  nom: 'École Essai',
  slug: 'ecole-essai',
  logoUrl: null,
  ville: 'Dakar',
  pays: 'Sénégal',
  telephone: '+221 00 000 00 00',
  email: 'contact@ecole-essai.test',
  formations: [
    { nom: 'Préscolaire', description: 'PS, MS, GS' },
    { nom: 'Élémentaire', description: 'Du CI au CM2' },
    { nom: 'Moyen', description: 'De la 6e à la 3e' },
  ],
};
