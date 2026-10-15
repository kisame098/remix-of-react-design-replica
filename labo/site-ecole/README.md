# Laboratoire — Site web de l'école

Un **modèle de site complet d'école sénégalaise**, où **tout se modifie
directement sur le site** : textes, photos, boutons, listes, sections,
couleurs, police, logo, coordonnées. Construit à l'écart du SaaS ; rien de ce
dossier n'est chargé par l'application en ligne.

## Lancer

```bash
npm run labo:site
```

Site sur http://localhost:8090. Tests : `npm run labo:site:test`. Types :
`npm run labo:site:types`.

## Le site

7 pages : Accueil, Notre école, Enseignement, Vie scolaire, Admissions,
Actualités, Contact.

- Accueil : diaporama, chiffres clés, mot du directeur, cycles (préscolaire →
  secondaire), atouts, résultats CFEE / BFEM / Bac, témoignages, actualités,
  appel à l'inscription.
- Admissions : étapes, pièces à fournir, moyens de paiement (Wave, Orange
  Money…), tarifs, **préinscription en ligne**, questions fréquentes.
- Contact : coordonnées, formulaire, plan Google Maps (sans clé, tiré de
  l'adresse).
- Formulaires **sans serveur** : le message part sur le WhatsApp de l'école.
- Bouton WhatsApp flottant, bouton « Espace parents » vers le portail.

Photos : Unsplash (licence libre, usage commercial permis), appelées par leur
adresse. Noms, chiffres et tarifs sont des exemples à remplacer.

## Modifier

Bouton « Modifier le site » en bas de l'écran :

- cliquer sur un texte et écrire ;
- « Changer la photo » sur chaque image (fichier de l'appareil ou adresse) ;
- l'icône de lien sur un bouton choisit sa destination ;
- au survol d'un élément de liste : déplacer, dupliquer, supprimer ; case
  « Ajouter » en fin de liste ;
- au survol d'une section : la masquer (et la réafficher) ;
- « Identité & couleurs » : nom, devise, logo, 2 couleurs, 3 polices,
  coordonnées, réseaux sociaux, lien de l'espace parents.

## Code

- `src/contenu.ts` — TOUT le contenu par défaut, au même endroit.
- `src/edition.tsx` — mode modification : `T` (texte), `Img`, `Bouton`,
  `Icone`, `Liste`, `Section`, et leurs fenêtres.
- `src/chemin.ts` — lecture / écriture par chemin, fusion d'une sauvegarde
  avec le modèle (testé dans `chemin.test.ts`).
- `src/Gabarit.tsx` — bandeau, en-tête, menu, pied de page, WhatsApp.
- `src/composants.tsx` — sections réutilisées par plusieurs pages.
- `src/pages/` — une page par fichier.

## Labo : limites actuelles

- Le contenu est gardé dans ce navigateur (`localStorage`) ; les photos
  envoyées sont réduites à 1 600 px.

## Étapes suivantes

1. Photos envoyées vers le stockage Supabase.
2. Table `school_sites` (un contenu JSON par école, brouillon / publié), RLS
   `school_id = get_my_school_id()`, lecture publique du site publié.
3. Infos reprises de SenClass (nom, logo, téléphone, cycles…) au premier
   lancement.
4. Site public à `<slug>.senclass.com`, puis domaine propre de l'école.
5. Intégration au SaaS (`src/pages/`, menu, interrupteur dans Paramètres).
