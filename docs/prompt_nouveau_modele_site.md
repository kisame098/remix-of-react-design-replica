# Prompt — créer un nouveau modèle de site web d'école (SenClass)

> Copier tout ce qui suit la ligne « — DÉBUT DU PROMPT — » et le coller dans l'autre IA.
> Le résultat (un fichier HTML + une fiche) sera ensuite intégré dans SenClass.

— DÉBUT DU PROMPT —

Tu es un designer web et un développeur front-end de très haut niveau. Tu vas créer **un modèle de site web pour une école privée au Sénégal**. Ce modèle sera vendu dans un logiciel de gestion scolaire (SenClass), où chaque école choisit son modèle puis modifie elle-même tous les textes, toutes les photos et l'ordre des blocs, directement sur la page.

## 1. Le niveau attendu

- Le résultat doit ressembler à un **vrai site d'établissement sérieux, fini, haut de gamme** : un directeur doit avoir envie de l'acheter en le voyant. Prends comme niveau de référence un thème premium comme https://univet.rstheme.com/blue/. Prends-lui la qualité, pas le contenu.
- Les couleurs doivent être nettes. Les espacements doivent être généreux et réguliers, la typographie soignée, et les animations douces et propres : apparition au défilement, survols, compteurs. Pas d'effets gadgets.
- **Créativité réelle.** Le modèle doit être **structurellement différent** des 5 modèles qui existent déjà. Changer les couleurs ne suffit pas : il faut d'autres mises en page, d'autres formes et d'autres idées de blocs. Voici les 5 modèles existants, à **ne pas** reproduire :
  1. **Institution** : classique et solennel, diaporama plein écran, titres à empattements, vert et or.
  2. **Teranga** : fond crème, grands titres, motifs wax, boutons en pilule, photos en arche.
  3. **Prestige** : éditorial, bleu nuit et or, angles droits, chiffres romains, blason.
  4. **Campus** : bleu marine et jaune, mot géant derrière la photo, cartes à bouton jaune, bloc à onglets.
  5. **Baobab** : vert et orange sur blanc, trait dessiné sous les titres, collage de photos, bento, accordéon horizontal.

## 2. La réalité sénégalaise (obligatoire)

- Il s'agit d'une école privée sénégalaise, du préscolaire au lycée : Préscolaire (PS/MS/GS), Élémentaire (CI → CM2), Moyen (6e → 3e) et Secondaire (2nde → Terminale).
- Les examens : **CFEE**, **BFEM**, **Baccalauréat**. La monnaie : **F CFA** (écrire par exemple « 30 000 F »). Les paiements : espèces, **Wave**, **Orange Money**, virement.
- **WhatsApp est le canal principal.**
  - Un bouton WhatsApp flottant doit être présent sur toutes les pages.
  - Le numéro WhatsApp apparaît dans l'en-tête ou le pied de page.
  - Les formulaires (préinscription, contact) **envoient le message sur WhatsApp** : ils construisent un lien `https://wa.me/221XXXXXXXXX?text=…` avec les champs remplis. Pas d'envoi vers un serveur.
- Prévois des réseaux sociaux en liste libre : Facebook, Instagram, TikTok, YouTube, LinkedIn, X, chaîne WhatsApp, Telegram.
- **Toutes les personnes montrées sont africaines, au plus près du Sénégal.** Aucune photo de personnes blanches. Pas de toge de remise de diplôme à l'américaine.
- **N'invente aucune preuve sociale.** Pas d'étoiles, pas de « des centaines de familles », pas de « n°1 », pas de faux labels, pas de faux partenaires. Les chiffres et les noms sont des **exemples clairement remplaçables** : l'école les modifiera.

## 3. Les photos à utiliser

Utilise ces photos, déjà en ligne (adresses publiques, format 16:9). Tu peux les recadrer avec `object-fit: cover`.

| Adresse | Ce qu'elle montre |
|---|---|
| https://senclass.com/site-ecole/prescolaire.webp | Maternelle : enfants de 4-5 ans et leur maîtresse autour d'une table, blocs de couleur |
| https://senclass.com/site-ecole/prescolaire-atelier.webp | Maternelle : atelier de comptage, classe très colorée |
| https://senclass.com/site-ecole/elementaire.webp | Classe du primaire, élève qui montre son ardoise, maître entre les rangs |
| https://senclass.com/site-ecole/salle-de-classe.webp | Classe du moyen, professeure en wax au tableau, élèves qui lèvent la main |
| https://senclass.com/site-ecole/cours.webp | Même classe, autre angle |
| https://senclass.com/site-ecole/laboratoire.webp | Lycéens en blouse, expérience de chimie |
| https://senclass.com/site-ecole/salle-informatique.webp | Salle informatique, élèves en uniforme |
| https://senclass.com/site-ecole/club-informatique.webp | Salle informatique, autre angle |
| https://senclass.com/site-ecole/bibliotheque.webp | Bibliothèque, élèves qui lisent |
| https://senclass.com/site-ecole/cour.webp | Cour ombragée sous les arbres, bâtiments peints |
| https://senclass.com/site-ecole/cour-recreation.webp | Cour de récréation, élèves qui jouent |
| https://senclass.com/site-ecole/sortie-goree.webp | Sortie scolaire à l'île de Gorée |
| https://senclass.com/site-ecole/semaine-culturelle.webp | Semaine culturelle : danse sabar dans la cour |
| https://senclass.com/site-ecole/kermesse.webp | Kermesse de fin d'année, stands en wax |
| https://senclass.com/site-ecole/resultats-bac.webp | Joie des élèves devant le tableau des résultats |
| https://senclass.com/site-ecole/remise-des-prix.webp | Célébration dans la cour, élèves et parents |

S'il te manque une photo, mets un emplacement gris avec un attribut `data-photo-a-creer="description précise de la scène"`. Je la créerai ensuite.

## 4. Les contraintes techniques (très important pour l'intégration)

Livre **un seul fichier HTML autonome** :
- **Tailwind CSS par CDN**, polices **Google Fonts** et icônes **Lucide** par CDN. Aucune autre bibliothèque, aucun framework.
- Un peu de JavaScript natif, seulement pour : la navigation entre les pages, le menu mobile, les animations au défilement (`IntersectionObserver`), les compteurs, les onglets et accordéons éventuels, et la construction du lien WhatsApp des formulaires.
- **Responsive impeccable** : téléphone (375 px), tablette et ordinateur. Aucun défilement horizontal sur téléphone. Respecter `prefers-reduced-motion`.

### 4.1 Les 7 pages, dans un seul fichier

Accueil, Notre école, Enseignement, Vie scolaire, Admissions, Actualités, Contact. La navigation se fait par l'ancre de l'adresse : `#/`, `#/ecole`, `#/enseignement`, `#/vie-scolaire`, `#/admissions`, `#/actualites`, `#/contact`. Chaque page est un `<main data-page="accueil">` (ou `ecole`, `enseignement`…), affiché ou masqué en JavaScript.

Prévois aussi **une page d'article** (`#/actualites/<identifiant>`) qui affiche une actualité complète : grande image, date, catégorie, titre, texte riche, boutons de partage WhatsApp et Facebook, puis « autres actualités ».

L'en-tête et le pied de page sont communs à toutes les pages. Ils contiennent : logo ou initiales de l'école, nom, slogan, menu, téléphone, WhatsApp, réseaux sociaux, bouton « Espace parents », adresse et horaires.

### 4.2 Deux couleurs seulement, réglables par l'école

- Couleur principale `var(--c1)` et couleur d'accent `var(--c2)`, déclarées sur `:root`. Tu peux utiliser des nuances dérivées : `color-mix(in srgb, var(--c1) 10%, transparent)`, etc.
- Les noirs, gris et blancs sont libres.
- **Aucune autre couleur de marque écrite en dur.** L'école doit pouvoir changer ses deux couleurs, et tout le site doit rester beau avec d'autres couleurs.
- Propose **tes deux couleurs conseillées**.

### 4.3 Deux polices, réglables

Utilise `var(--f-titre)` pour les titres et `var(--f-texte)` pour le texte, définies sur `:root`. Propose ton choix de polices.

### 4.4 Tout doit être modifiable : marque chaque contenu

L'école modifiera tout, directement sur la page. Pour que l'intégration soit possible, **chaque texte, image, bouton et liste doit porter l'attribut qui dit d'où vient sa valeur**, selon la structure de contenu ci-dessous (section 5) :

- **Texte :** `data-champ="accueil.mot.titre"`
- **Image :** `<img data-champ="ecole.histoire.image" …>`
- **Bouton ou lien :** `data-bouton="accueil.bouton1"`. La valeur est un objet `{ texte, lien }`, et le lien interne s'écrit `#/admissions`.
- **Icône :** `data-icone="accueil.atouts.elements.0.icone"`. Choisis seulement parmi : users, award, shield, globe, laptop, bus, book, scale, heart, handshake, chart, message, clock, utensils, graduation, star, trophy, music, palette, science, bebe, bibliotheque.
- **Liste** (chiffres, cycles, témoignages, équipe, frais, FAQ…) :
  - le conteneur porte `data-liste="accueil.chiffres"` ;
  - chaque élément porte `data-element="0"`, `data-element="1"`… ;
  - les champs d'un élément utilisent son numéro : `data-champ="accueil.chiffres.0.valeur"`.
  - **Règle anti-trou :** l'école peut retirer ou ajouter des éléments. Une grille doit toujours rester belle avec 1, 2, 3, 5 ou 7 éléments. Utilise `flex flex-wrap justify-center` avec des largeurs fixes par colonne, **jamais** de grille qui laisse une case vide.
- **Bloc de page :** chaque bloc est un `<section data-section="identifiant">`. Les identifiants sont ceux du catalogue (section 6). L'école pourra masquer, réordonner ou déplacer chaque bloc vers une autre page : **un bloc ne doit donc jamais dépendre du bloc d'avant ou d'après**, ni visuellement ni dans le code.

Un texte vide doit disparaître proprement : pas de titre fantôme, pas d'espace vide.

## 5. La structure du contenu (noms de champs à respecter)

Chaque `data-champ` pointe dans cette structure. Les valeurs ci-dessous sont des exemples ; « texte » signifie un paragraphe libre. Une liste `[ … ]` est montrée avec un seul élément, mais en contient plusieurs.

```json
{
 "identite": { "nom": "Groupe Scolaire Excellence", "slogan": "Discipline · Travail · Réussite", "logo": "", "telephone": "+221 33 000 00 00", "whatsapp": "+221 77 000 00 00", "email": "contact@ecole-exemple.sn", "adresse": "Sacré-Cœur 3, Dakar, Sénégal", "horaires": "Lun – Ven : 7 h 30 – 18 h · Sam : 8 h – 13 h", "messageWhatsApp": "Bonjour, je souhaite avoir des informations sur l'école.", "reseaux": [ { "type": "facebook", "url": "https://www.facebook.com/" } ], "espaceParents": { "texte": "Espace parents", "lien": "https://senclass.com" }, "creation": "2005" },
 "annonce": { "texte": "texte", "bouton": { "texte": "S'inscrire", "lien": "#/admissions" } },
 "accueil": {
  "diapos": [ { "image": "…", "surtitre": "…", "titre": "…", "texte": "…" } ],
  "bouton1": { "texte": "Inscrire mon enfant", "lien": "#/admissions" }, "bouton2": { "texte": "Découvrir l'école", "lien": "#/ecole" },
  "chiffres": [ { "valeur": "20", "libelle": "ans d'expérience" } ],
  "mot": { "surtitre": "Mot du directeur", "titre": "…", "texte": "texte", "image": "…", "nom": "M. Mamadou Diop", "fonction": "Directeur général" },
  "cycles": { "surtitre": "Nos cycles", "titre": "…", "texte": "…" },
  "atouts": { "surtitre": "…", "titre": "…", "elements": [ { "icone": "users", "titre": "…", "texte": "…" } ] },
  "resultats": { "surtitre": "…", "titre": "…", "texte": "Session 2026", "elements": [ { "examen": "CFEE", "taux": "100 %", "detail": "Entrée en 6e : 98 %" } ] },
  "temoignages": { "surtitre": "…", "titre": "…", "elements": [ { "texte": "…", "nom": "Mme Fatou Ndiaye", "role": "Parent d'élèves", "photo": "…" } ] },
  "actualites": { "surtitre": "Actualités", "titre": "La vie de l'école" },
  "suivez": { "surtitre": "Suivez-nous", "titre": "…", "texte": "…" },
  "appel": { "titre": "Inscriptions 2026-2027 ouvertes", "texte": "…", "bouton1": { "texte": "Préinscription", "lien": "#/admissions" }, "bouton2": { "texte": "Nous contacter", "lien": "#/contact" } }
 },
 "ecole": {
  "entete": { "titre": "Notre école", "texte": "…", "image": "…" },
  "histoire": { "surtitre": "…", "titre": "…", "texte": "texte", "image": "…" },
  "valeurs": { "surtitre": "…", "titre": "…", "elements": [ { "icone": "book", "titre": "Excellence", "texte": "…" } ] },
  "equipe": { "surtitre": "…", "titre": "…", "elements": [ { "photo": "…", "nom": "…", "fonction": "…" } ] },
  "infrastructures": { "surtitre": "…", "titre": "…", "elements": [ { "image": "…", "titre": "Salles de classe", "texte": "…" } ] }
 },
 "enseignement": {
  "entete": { "titre": "Enseignement", "texte": "…", "image": "…" },
  "cycles": [ { "image": "…", "nom": "Préscolaire", "niveaux": "Petite, Moyenne et Grande section", "age": "De 3 à 5 ans", "texte": "…", "points": [ "Effectif réduit par classe" ] } ],
  "pedagogie": { "surtitre": "…", "titre": "…", "elements": [ { "icone": "chart", "titre": "…", "texte": "…" } ] }
 },
 "vieScolaire": {
  "entete": { "titre": "Vie scolaire", "texte": "…", "image": "…" },
  "activites": { "surtitre": "…", "titre": "…", "elements": [ { "image": "…", "titre": "Sport", "texte": "…" } ] },
  "services": { "surtitre": "…", "titre": "…", "elements": [ { "icone": "utensils", "titre": "Cantine", "texte": "…" } ] },
  "galerie": { "surtitre": "…", "titre": "En images", "elements": [ { "image": "…" } ] },
  "calendrier": { "surtitre": "…", "titre": "…", "elements": [ { "date": "Octobre", "evenement": "Rentrée des classes" } ] }
 },
 "admissions": {
  "entete": { "titre": "Admissions", "texte": "…", "image": "…" },
  "etapes": { "surtitre": "…", "titre": "Quatre étapes simples", "elements": [ { "titre": "Prise de contact", "texte": "…" } ] },
  "pieces": { "titre": "Pièces à fournir", "elements": [ "Extrait d'acte de naissance" ] },
  "frais": { "surtitre": "…", "titre": "Tarifs 2026-2027", "texte": "…", "elements": [ { "niveau": "Préscolaire", "inscription": "40 000 F", "mensualite": "30 000 F" } ], "note": "…" },
  "paiement": { "titre": "Moyens de paiement", "elements": [ "Espèces au secrétariat" ] },
  "formulaire": { "titre": "Préinscription en ligne", "texte": "…" },
  "faq": { "surtitre": "…", "titre": "…", "elements": [ { "question": "…", "reponse": "…" } ] }
 },
 "actualites": {
  "entete": { "titre": "Actualités", "texte": "…", "image": "…" },
  "elements": [ { "id": "resultats-bac-2026", "image": "…", "date": "20 juillet 2026", "categorie": "Résultats", "titre": "…", "texte": "résumé court", "contenu": "<p>article complet en HTML</p>" } ]
 },
 "contact": { "entete": { "titre": "Contact", "texte": "…", "image": "…" }, "titre": "Écrivez-nous", "texte": "…" },
 "pied": { "texte": "…" }
}
```

Pour un champ qui n'existe pas dans cette structure, crée-le **dans un objet propre à ton modèle**, nommé d'après le modèle en minuscules et sans accent. Par exemple, pour un modèle « Sahel » : `data-champ="sahel.manifeste.titre"`. Décris-le dans la fiche finale (section 7).

## 6. Le catalogue des blocs (`data-section`)

Pour chaque page, utilise ces blocs. Tu choisis leur ordre et leur présentation : c'est là que ta créativité compte.

- **Accueil :**
  - `diaporama` : héros d'ouverture, une ou plusieurs diapositives ;
  - `chiffres` ;
  - `mot-directeur` ;
  - `cycles` : les cycles en cartes ;
  - `atouts` : pourquoi nous choisir ;
  - `resultats` : CFEE, BFEM, Bac ;
  - `temoignages` ;
  - `actualites-recentes` ;
  - `suivez-nous` : réseaux et fil Facebook ;
  - `appel` : appel à l'inscription.
- **Notre école :** `entete-ecole` (bandeau de page), `histoire`, `valeurs`, `equipe`, `infrastructures`.
- **Enseignement :** `entete-enseignement`, `cycles-detail` (chaque cycle en détail avec ses points), `pedagogie`.
- **Vie scolaire :** `entete-vie-scolaire`, `activites`, `services`, `galerie`, `calendrier`.
- **Admissions :**
  - `entete-admissions` ;
  - `etapes` ;
  - `pieces` : pièces à fournir et moyens de paiement ;
  - `frais` : tableau ou cartes de tarifs, lisible sur téléphone ;
  - `preinscription` : formulaire vers WhatsApp avec nom de l'enfant, classe visée, nom du parent, téléphone et message ;
  - `faq` : accordéon.
- **Actualités :** `entete-actualites`, `liste-actualites`.
- **Contact :** `entete-contact`, `coordonnees` (téléphone, WhatsApp, e-mail, adresse, horaires, formulaire vers WhatsApp, carte Google intégrée sans clé : `https://www.google.com/maps?q=<adresse>&output=embed`).

Tu peux **ajouter 2 à 5 blocs originaux** qui n'existent pas encore, par exemple « une journée à l'école », « nos lauréats » ou « visite en images ». Donne à chacun un identifiant en minuscules avec tirets, et place ses données dans l'objet propre à ton modèle.

## 7. Ce que tu dois me rendre

1. **Le fichier HTML complet**, en un seul bloc de code, sans rien omettre. Pas de « … reste identique », pas de section à compléter : tout doit fonctionner en ouvrant le fichier.
2. **Une fiche** en fin de réponse :
   - nom du modèle (un mot, idéalement évocateur du Sénégal) et une phrase de description ;
   - les 2 couleurs conseillées (hexadécimal) et les 2 polices ;
   - l'ordre des blocs de chaque page (liste d'identifiants) ;
   - pour chaque bloc original : identifiant, nom affiché en français, et structure JSON de ses données avec des exemples ;
   - les photos manquantes (`data-photo-a-creer`) avec leur description.

Avant de répondre, vérifie toi-même :
- toutes les pages s'ouvrent depuis le menu, y compris sur téléphone ;
- chaque texte et chaque image porte bien son `data-champ` ;
- chaque liste reste belle si on retire ou ajoute un élément ;
- le site reste beau avec d'autres couleurs (essaie mentalement rouge et vert, et bleu et orange) ;
- aucune preuve sociale inventée, aucune personne non africaine ;
- WhatsApp est partout où un parent en a besoin.

— FIN DU PROMPT —
