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

## Quatre modèles au choix

Même contenu, même façon de modifier, présentation **complètement
différente**. Le directeur choisit dans « Identité & couleurs » ; ses textes,
photos et actualités sont conservés quand il change de modèle.

| | Institution | Teranga |
|---|---|---|
| Esprit | classique, solennel | moderne, chaleureux, créatif |
| Fond | blanc | crème, blocs arrondis |
| Accueil | photo plein écran assombrie | deux colonnes, photo en arche, badge tournant |
| Menu | barre classique + bandeau coordonnées | pilule flottante, menu plein écran sur téléphone |
| Annonce | bandeau fixe | bandeau qui défile |
| Décor | filets dorés | motifs géométriques inspirés du wax |
| Chiffres | barre blanche | mosaïque de tuiles colorées |
| Cycles (Enseignement) | blocs alternés | onglets |
| Tarifs | tableau | cartes de prix |
| Témoignages | cartes | bulles de discussion |
| Actualités | grille de cartes | mise en page magazine |
| Calendrier | liste | frise horizontale |
| Pied de page | colonnes | « Parlons-en » + grand nom de l'école |

Couleurs conseillées : Institution vert / or, Teranga terracotta / sarcelle,
Prestige bleu nuit / or patiné (toujours modifiables).

### Campus — moderne et rassurant (inspiré de univet.rstheme.com/blue)

Le design de la référence, la réalité d'une école sénégalaise. Bleu marine,
jaune soleil, fond crème, titres Bitter. Ouverture : le nom (ou un mot
choisi) en lettres géantes derrière la photo qui se fond dans un ciel dégradé,
bouton rond « Visite en vidéo » (lien YouTube / Facebook). Cartes des cycles
qui s'ouvrent par le bouton jaune ; grand bloc bleu à onglets avec les
**communiqués de la direction** (numérotés, téléchargeables) ; grand bandeau
qui fait défiler les **résultats CFEE / BFEM / Bac** ; **agenda** (portes
ouvertes, remise des prix, kermesse, réunion parents-professeurs) ;
préinscription dans une carte bleue bordée de jaune posée sur une photo ;
anneaux de réussite qui se dessinent ; titres qui se remplissent de couleur
au défilement ; bouton « remonter » avec anneau de progression ; panneau
latéral. Propre ordre de pages (`contenu.pagesCampus`).

### Prestige — pour les établissements d'excellence

Sa propre structure (ordre des pages dans `contenu.pagesPrestige`) et des
sections qu'il est seul à proposer : **Manifeste** signé à la main,
**Palmarès et distinctions**, **Où vont nos bacheliers** (défilement des
universités), **Visite du campus**. Mise en scène : ouverture plein écran
avec fondu lent et barre de progression, en-tête transparent qui se pose au
défilement, menu plein écran avec aperçu photo de chaque page, apparitions au
défilement, compteurs animés, programmes et journal dont la photo suit le
pointeur, campus en défilement horizontal, chapitres numérotés en chiffres
romains, blason généré aux initiales, grain photographique, angles droits et
filets fins. Respecte « réduire les animations » du système.

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
adresse ; uniquement des élèves et personnes africains (contrôle visuel de
chaque photo). Noms, chiffres et tarifs sont des exemples à remplacer.

## Modifier

Bouton « Modifier le site » en bas de l'écran :

- cliquer sur un texte et écrire ;
- « Changer la photo » sur chaque image (fichier de l'appareil ou adresse) ;
- l'icône de lien sur un bouton choisit sa destination (une page, notre
  WhatsApp, notre téléphone, une adresse) ;
- éléments de liste (cycles, chiffres, équipe…) : **glisser à la souris**
  avec la poignée ⠿, dupliquer, supprimer, « Ajouter » ; les rangées se
  recentrent, jamais de trou ;
- sections : **glisser**, monter / descendre, ajouter en dessous, **envoyer
  vers une autre page**, retirer ; « Ajouter une section » propose tout le
  catalogue ;
- actualités : un clic ouvre **l'article complet** (`#/actualites/<id>`),
  écrit dans un éditeur : titres, gras, couleurs, surligné, alignement,
  listes, citations, photos, **vidéos YouTube / Facebook / TikTok /
  Instagram**, liens **simples, en carte d'aperçu ou intégrés** ; partage
  WhatsApp / Facebook ;
- « Identité & couleurs » : nom, devise, logo, 2 couleurs, 3 polices,
  coordonnées, **WhatsApp** (numéro + message), **réseaux sociaux** (liste
  libre), fil de la page Facebook, espace parents.

## Code

- `src/contenu.ts` — TOUT le contenu par défaut, au même endroit.
- `src/edition.tsx` — mode modification : `T` (texte), `Img`, `Bouton`,
  `Icone`, `Liste`, `Section`, et leurs fenêtres.
- `src/chemin.ts` — lecture / écriture par chemin, fusion d'une sauvegarde
  avec le modèle (testé dans `chemin.test.ts`).
- `src/Gabarit.tsx` — bandeau, en-tête, menu, pied de page, WhatsApp.
- `src/composants.tsx` — sections réutilisées par plusieurs pages.
- `src/sections.tsx` — catalogue des sections et `PageSections` (ordre,
  glisser-déposer, envoi vers une autre page).
- `src/EditeurArticle.tsx` — éditeur des articles (TipTap), chargé seulement
  en mode modification.
- `src/pages/` — les sections du modèle Institution, rangées par page.
- `src/themes/campus/` — le modèle Campus.
- `src/themes/prestige/` — le modèle Prestige (gabarit, blason, apparitions,
  compteurs, sections communes et exclusives).
- `src/themes/teranga/` — le modèle Teranga : gabarit, motifs wax, sections
  (mêmes identifiants que l'autre modèle, branchées dans `sections.tsx`).

Bibliothèques ajoutées au projet pour le labo : TipTap (éditeur) et dnd-kit
(glisser-déposer). Les aperçus de liens sont lus par le service public
microlink.io.

## Labo : limites actuelles

- Le contenu est gardé dans ce navigateur (`localStorage`) ; les photos
  envoyées sont réduites à 1 600 px.
- Le HTML des articles est affiché tel quel : avant la mise en ligne publique,
  le nettoyer (DOMPurify, iframes limitées à YouTube / Facebook / TikTok /
  Instagram).

## Étapes suivantes

1. Photos envoyées vers le stockage Supabase.
2. Table `school_sites` (un contenu JSON par école, brouillon / publié), RLS
   `school_id = get_my_school_id()`, lecture publique du site publié.
3. Infos reprises de SenClass (nom, logo, téléphone, cycles…) au premier
   lancement.
4. Site public à `<slug>.senclass.com`, puis domaine propre de l'école.
5. Intégration au SaaS (`src/pages/`, menu, interrupteur dans Paramètres).
