# Mise en ligne de SenClass

- **Hébergeur :** Cloudflare Pages — offre gratuite, usage commercial autorisé, serveur à Dakar.
- **Domaine :** `senclass.com`, acheté chez Hostinger (sans www ; `www.senclass.com` y redirige).
- **Base de données :** Supabase, région `eu-west-1` (Irlande) — le bon choix pour le Sénégal, les câbles sous-marins passent par l'Europe.

---

## 1. Première mise en ligne sur Cloudflare Pages

1. Le code est sur GitHub : `github.com/kisame098/remix-of-react-design-replica`. Cloudflare construit depuis la branche `main` : ce qui n'y est pas n'existe pas pour lui.
2. [dash.cloudflare.com](https://dash.cloudflare.com) (compte gratuit) → **Workers & Pages → Créer → Pages → Connecter à Git** → choisir le dépôt.
3. Réglages :

| Champ | Valeur |
|---|---|
| Nom du projet | `senclass` → adresse technique `senclass.pages.dev` |
| Branche de production | `main` |
| Préréglage de framework | Vite (ou « Aucun ») |
| Commande de build | `npm run build` |
| Dossier de sortie | `dist` |

Rien d'autre à régler : Node 22 est lu dans `.nvmrc`, et Cloudflare installe les dépendances avec `npm clean-install`, qui lit `.npmrc` (sans lui, l'installation échoue sur une erreur ERESOLVE). Cloudflare choisit son outil d'installation d'après le fichier de verrouillage présent : le dépôt ne doit contenir que `package-lock.json` — un `bun.lockb` hérité de Lovable a fait échouer le premier déploiement (`bun install --frozen-lockfile`).

**Variables d'environnement :** aucune à saisir, elles sont dans `.env` (versionné). La clé qui s'y trouve est la clé *publique* de Supabase — elle finit de toute façon dans le code envoyé aux navigateurs, c'est prévu ainsi. Si `.env` sort un jour du dépôt, recopier ses variables `VITE_*` dans Cloudflare → projet → Paramètres → Variables.

Chaque push sur `main` redéploie automatiquement ; chaque autre branche reçoit une adresse de prévisualisation.

## 2. Le domaine `senclass.com` (acheté chez Hostinger)

**Aucun hébergement Hostinger n'est nécessaire** : un nom de domaine et un hébergement sont deux choses séparées. Le domaine reste enregistré chez Hostinger (vous y payez seulement le renouvellement annuel) ; pour le brancher « nu » (sans www) sur Cloudflare Pages, il faut simplement confier sa gestion DNS à Cloudflare.

1. Cloudflare → **Ajouter un site** → `senclass.com` → offre **Free**. Cloudflare affiche **deux serveurs de noms** (du type `xxxx.ns.cloudflare.com`).
2. Hostinger → **Domaines → senclass.com → DNS / Serveurs de noms → Modifier** : remplacer les serveurs actuels (`dns-parking.com`) par ceux de Cloudflare. La bascule prend de quelques minutes à 24 h ; Cloudflare prévient par e-mail.
3. Cloudflare → **Workers & Pages → senclass → Domaines personnalisés** : ajouter `senclass.com`, puis `www.senclass.com`. DNS et HTTPS se configurent tout seuls.
4. **Redirection www → sans www** : Cloudflare → senclass.com → **Règles → Redirect Rules → Créer** → modèle *Redirect from WWW to root* (301). Une seule adresse pour Google.
5. **E-mail `contact@senclass.com`** (affiché dans le pied de page) : Cloudflare → senclass.com → **Email → Email Routing** (gratuit) → transfert vers votre messagerie habituelle.

Déjà prévu dans le code :
- `public/_headers` : les adresses `*.pages.dev` (technique et prévisualisations) répondent `X-Robots-Tag: noindex`, pour que Google ne voie pas le site en double. **Tant que `senclass.com` n'est pas branché, le site n'est donc pas indexé** ; c'est voulu.
- Pas de `404.html` : Cloudflare sert l'application pour toute adresse (`/portail/notes`, `/paiements`…).
- `VITE_SITE_URL="https://senclass.com"` (dans `.env`) alimente l'adresse canonique, les aperçus WhatsApp et les données structurées.

### Adresses de connexion des élèves et professeurs

Les comptes créés désormais reçoivent une adresse `prenom.nom.12345@senclass.com`. Les comptes existants gardent leur adresse `@terranga.com` : leurs identifiants ont déjà été distribués, et ils continuent de fonctionner.

**Avant de créer un nouveau compte élève ou professeur, exécutez `docs/sql/domaine_senclass.sql`.** Sans lui, la base prendrait chaque nouvel élève pour un directeur qui s'inscrit, et lui créerait une fausse école.

## 3. Supabase — obligatoire

**Authentication → URL Configuration.** Sans ce réglage, « mot de passe oublié » envoie les utilisateurs vers `localhost`.

- Site URL : `https://senclass.com`
- Redirect URLs :
  - `https://senclass.com/**`
  - `https://senclass.pages.dev/**` et `https://*.senclass.pages.dev/**` (adresse technique et prévisualisations)
  - `http://localhost:8080/**` (développement)

**Plan Pro (25 $/mois) avant la première vraie école.** L'offre gratuite met le projet en pause après 7 jours sans activité et ne fait aucune sauvegarde. La page d'accueil promet des « sauvegardes quotidiennes automatiques » : c'est vrai **seulement** avec le plan Pro.

**Nettoyer les données de test.** Il faut supprimer les écoles « Ecole Test Charge… » (plus de 1 000 élèves fictifs). C'est irréversible : à faire vous-même, en connaissance de cause.

---

## 3 bis. E-mails de confirmation (Resend)

**Qui est concerné.** Uniquement le **directeur qui inscrit son école** par le formulaire public. Les comptes élèves, professeurs et personnel sont créés par les fonctions Supabase (`create-school-account`, `create-staff-account`) avec `email_confirm: true` : ils sont confirmés d'office et ne reçoivent jamais d'e-mail — leurs adresses `@senclass.com` ne reçoivent d'ailleurs pas de courrier.

**Pourquoi Resend.** Le serveur d'e-mails intégré de Supabase est limité à quelques messages par heure et réservé aux tests. Resend envoie 3 000 e-mails par mois et 100 par jour gratuitement, ce qui couvre largement les inscriptions d'écoles.

### a. Chez Resend (à faire par vous — une création de compte)
1. [resend.com](https://resend.com) → **Sign up** → *Continue with Google*.
2. **Domains → Add domain** → `senclass.com`. Resend affiche des enregistrements DNS (DKIM, SPF, et parfois DMARC).
3. Transmettez-les : ils s'ajoutent dans Cloudflare → `senclass.com` → **DNS**. Resend passe alors le domaine en **Verified**.
4. **API Keys → Create API key** (droit *Sending access* suffit). **Copiez la clé** : elle ne s'affiche qu'une fois. Ne la collez nulle part ailleurs que dans Supabase.

### b. Dans Supabase (à faire par vous — la clé ne doit transiter par personne)
1. **Authentication → Emails → SMTP Settings** → activer **Enable Custom SMTP** :

| Champ | Valeur |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | votre clé d'API Resend |
| Sender email | `contact@senclass.com` |
| Sender name | `SenClass` |

2. **Authentication → Providers → Email** : activer **Confirm email**.
3. **Authentication → Rate limits** : Supabase bride un SMTP neuf à 30 e-mails par heure. Montez-le si besoin.
4. **Authentication → Emails → Templates** : traduisez en français le message « Confirm your signup ». Le lien doit rester `{{ .ConfirmationURL }}`.

### c. Côté application (déjà fait)
- L'inscription détecte que Supabase attend une confirmation (utilisateur créé sans session) et affiche **« Vérifiez votre boîte mail »**, avec l'adresse et un bouton **Renvoyer l'e-mail**.
- Une connexion refusée parce que l'e-mail n'est pas confirmé mène au même écran.
- Le lien de l'e-mail ouvre `https://senclass.com/dashboard`.
- Tant que **Confirm email** reste désactivé, rien ne change : le directeur entre directement après inscription.

**Ordre à respecter :** le code ci-dessus doit être en ligne **avant** d'activer « Confirm email », sinon l'inscription reste bloquée sans message.

---

## 4. Référencement Google

### La concurrence

Sur « logiciel de gestion scolaire Sénégal », Google affiche notamment :
- [EduSen](https://www.edusenpro.net/)
- [LoTech School](https://www.lotechschool.com/)
- [Noppal](https://noppal.jangaan.com/)
- [School'Gest](https://www.schoolgest.sn/)
- [Galactis](https://www.galactis.education/page/logiciel-de-gestion-scolaire-senegal)
- [Scolaris](https://scolaris.sn/)
- [SmartSchool](https://www.smartschool.sn/)
- [Sama-Ecole](https://www.socialnetlink.org/2017/10/31/sama-ecole-un-entrepreneur-web-senegalais-developpe-un-logiciel-de-gestion-scolaire/)

**Tous** mettent « Logiciel de gestion scolaire au Sénégal » dans leur titre. SenClass avait « L'Excellence Scolaire à Portée de Main » : aucun mot recherché. Il était donc invisible sur cette recherche, quel que soit le reste.

### Ce qui est fait dans le code

| | |
|---|---|
| **Titre Google** | « Logiciel de gestion scolaire au Sénégal \| SenClass », avec le mot-clé en tête (56 caractères, sous la limite d'affichage). |
| **Description** | 158 caractères qui nomment ce que cherchent les écoles : inscriptions, notes et bulletins, emplois du temps, présences, paiements. |
| **Titre principal (h1)** | « Logiciel de gestion scolaire au Sénégal ». Visuellement, c'est le badge au-dessus du slogan : l'apparence de la page ne change pas. |
| **Texte d'accroche** | Mentionne « logiciel de gestion scolaire », « écoles du Sénégal » et « du CI à la Terminale » (un vocabulaire local que les concurrents emploient peu). |
| **FAQ** | 8 questions calquées sur les recherches réelles (« combien coûte… », « bulletins automatiques », « adapté au système sénégalais »). Les réponses sont lisibles par Google même repliées, et les prix sont calculés depuis la vraie grille tarifaire. |
| **Données structurées** | Organisation (nom, logo, Dakar, WhatsApp), site, logiciel (catégorie, fonctionnalités, prix 25 000 XOF), FAQ. Aucune note ni aucun avis inventé : Google les sanctionne. |
| **Adresse canonique** | `https://senclass.com/`. |
| **robots.txt** | Accueil ouvert. Espaces privés (tableau de bord, portail, caisse…) fermés, puisqu'il n'y a rien à y indexer. Il annonce aussi le plan du site. |
| **sitemap.xml** | Plan du site pour Google. |
| **Titres par page** | Chaque écran a son titre d'onglet. Toutes les pages sauf l'accueil sont en `noindex`, y compris « page introuvable ». |
| **Favicon** | Votre icône (couches blanches sur carré orange), recadrée et nettoyée de son halo. Google l'affiche aussi à côté du site dans ses résultats. |
| **Image de partage** | WhatsApp et Facebook montrent le logo, le nom et l'accroche. |
| **Vitesse** | Premier téléchargement divisé par trois. La police est chargée sans attendre la feuille de style. La connexion à Supabase est ouverte d'avance. |

### Ce que le code ne peut pas faire — et qui compte le plus face aux concurrents

Le technique fait entrer le site dans la course. Ce qui fait passer devant EduSen ou LoTech, c'est ce qui suit.

1. **Google Search Console**, le jour où le domaine est branché :
   - ajouter `senclass.com` (propriété de domaine, validation par DNS) ;
   - soumettre `https://senclass.com/sitemap.xml` ;
   - demander l'indexation de l'accueil.

   Faire de même sur **Bing Webmaster Tools** (import direct depuis Search Console).
2. **Fiche Google Business Profile** « SenClass », à Dakar. Elle fait apparaître le logiciel dans Maps et dans les recherches locales (« logiciel école Dakar »). Il faut une adresse et un téléphone réels.
3. **Des liens vers le site.** C'est le premier critère de Google, et les concurrents ont des années d'avance :
   - presse tech sénégalaise (Socialnetlink a consacré un article à Sama-Ecole) ;
   - annuaires d'entreprises ;
   - sites des écoles clientes (« géré avec SenClass ») ;
   - partenaires (Wave, Orange Money, associations d'écoles privées).
4. **Des avis Google** laissés par de vraies écoles clientes, sur la fiche Business Profile.
5. **Du contenu.** Plus tard, une page par besoin (« logiciel de bulletins de notes », « paiement de la scolarité par Wave ») ou un blog de conseils aux directeurs. Chaque page est une nouvelle porte d'entrée sur Google.

**Délai réaliste.** Un domaine neuf met plusieurs semaines à plusieurs mois à monter sur une recherche disputée. La recherche du nom, « SenClass », remonte en premier, généralement en quelques jours après l'indexation.

### À corriger sur la page d'accueil (contenu, pas code)

- **E-mail du pied de page** : `contact@senclass.com`. Créez cette boîte, ou un simple transfert vers votre messagerie habituelle — sinon les écoles qui écrivent ne reçoivent qu'une erreur.
- **Téléphone** : l'ancien « +221 33 800 00 00 » était un numéro de démonstration. Il est remplacé par le numéro WhatsApp déjà affiché dans les Tarifs.
- **Icônes Facebook, Twitter, LinkedIn** et **pages Confidentialité, Conditions, Mentions légales** : les liens ne mènent nulle part (`#`). Une politique de confidentialité est attendue pour un logiciel qui traite des données d'élèves mineurs (loi sénégalaise sur les données personnelles, CDP).
- **Promesses des fonctionnalités** : « sauvegardes quotidiennes » est vrai seulement avec Supabase Pro ; « relances automatiques » est à vérifier.
- **Essai gratuit** : la page promettait « 30 jours ». Le logiciel accorde **7 jours** par défaut. Le texte dit désormais « une période d'essai gratuite » ; mettez un nombre de jours seulement si vous le fixez pour tous.

---

## 5. Application installable (PWA)

**Installer l'application :**
- Android (Chrome) : menu ⋮ → **Installer l'application**.
- iPhone (Safari) : Partager → **Sur l'écran d'accueil**.
- Ordinateur : icône d'installation dans la barre d'adresse.

**Hors connexion :**
- l'application s'ouvre, sur n'importe quelle page ;
- l'élève ou le professeur **retrouve ses données** : accueil, notes, emploi du temps, présences et paiements, tels qu'au dernier chargement réussi ;
- un bandeau indique **la date de ces données** et rappelle que rien ne s'enregistre sans réseau ;
- au retour du réseau, tout se rafraîchit seul.

**Comment c'est rangé, et pourquoi.** Les données sont enregistrées sur l'appareil **par compte** (`src/lib/cacheHorsLigne.ts`), et **effacées à la déconnexion**. Le portail permet plusieurs comptes sur un même téléphone — une mère et ses enfants : sans ce cloisonnement, un élève verrait hors connexion les données d'un autre. C'est aussi pourquoi rien ne passe par le cache du service worker, qui est rangé par adresse et non par utilisateur.

**Côté écoles.** Le tableau de bord est consultable de la même manière : élèves, professeurs, classes, notes, paiements, présences, emploi du temps et salaires. Les écrans de l'école ne parlent pas à Supabase — ils lisent les contextes — donc c'est un instantané de chaque contexte qui est gardé (`src/hooks/useInstantaneHorsLigne.ts`), et un seul bandeau en haut du tableau de bord annonce la date. Cet instantané n'est réinstallé **que** hors connexion : avec du réseau, rien ne change, un directeur ne doit jamais voir réapparaître un élève supprimé.

Seule la consultation fonctionne sans réseau ; rien ne s'enregistre. Un seul écran du portail reste hors de portée : le choix des matières optionnelles, qui est une action et exige donc la connexion.

**Mises à jour :** le bandeau « Nouvelle version disponible » propose la mise à jour, il ne l'impose jamais. Recharger d'office ferait perdre un encaissement en cours de saisie.

---

## 5 bis. Notifications push (élèves)

L'élève est prévenu sur son téléphone, application fermée, quand : une note est saisie, un bulletin est publié, un paiement est enregistré, ou une **absence, un retard ou un renvoi** est noté. (Les rappels d'échéance viendront dans un second temps.)

**Ce que voit l'élève.** Profil → carte *Notifications* → « Activer ». Le navigateur demande alors son autorisation — jamais avant, toujours après un clic. Sur iPhone, le site doit d'abord être ajouté à l'écran d'accueil (iOS 16.4 minimum).

**Ce qui est envoyé.** Jamais de valeur de note ni de montant : « Nouvelle note en Mathématiques », « Bulletin (1er trimestre) disponible ». Un téléphone posé sur une table ne doit rien révéler. La notification arrive en **quelques secondes** (une note : ~20 s ; bulletin ou paiement : ~10 s). Plusieurs notes saisies à quelques secondes d'écart pour le même élève donnent **une seule** notification.

**Présences.** Personne n'est prévenu pendant que le professeur fait l'appel : il coche, se corrige, hésite. La notification part quand il valide (« Saisie complète »), 45 secondes plus tard. Si un statut change après la validation, la famille est prévenue à son tour. Si le professeur corrige **avant** l'envoi, la notification est simplement retirée ; s'il corrige **après**, une notification de correction part (« la présence est finalement rétablie »), pour ne pas laisser une famille sur une fausse absence. Le nom de l'élève n'apparaît jamais dans le texte.

**Un appareil, plusieurs comptes.** Un parent qui garde trois enfants sur son téléphone reçoit les trois, à condition que chaque compte active ses notifications (une fois, depuis son profil). Se déconnecter retire uniquement les notifications du compte qui sort ; si le réseau manque à ce moment, l'appareil se désabonne lui-même, par précaution.

### Mise en route

**Rien à configurer à la main.** Ni secret à copier, ni clé à générer :

1. Exécuter `docs/sql/notifications_push.sql` dans le SQL Editor. Il crée les tables, les déclencheurs et la tâche planifiée, et **génère lui-même** le secret qui relie la tâche à la fonction, dans le coffre chiffré de Supabase (Vault).
2. Déployer la fonction `send-notifications` (`supabase/functions/send-notifications/`) avec la vérification JWT **désactivée** : elle est appelée par la base, sans jeton utilisateur, et protégée par ce secret. Sans lui, elle refuse tout (401).
3. Publier l'application.

Au premier appel, la fonction **fabrique elle-même ses clés VAPID** : la publique est lue par l'application, la privée va directement dans le coffre. Personne ne la saisit, ne la copie ni ne la voit. Les clés ne sont écrites qu'une seule fois et jamais écrasées : les remplacer invaliderait tous les abonnements.

Il n'y a **aucun secret à poser** dans « Edge Functions → Secrets ».

### Vérifier

- Supabase → Edge Functions → `send-notifications` → Logs : un appel dès que quelque chose est à envoyer (la tâche passe toutes les 10 secondes).
- `select * from cron.job_run_details order by start_time desc limit 5;` : la tâche tourne sans erreur.
- `select kind, sent_at, attempts from notification_queue order by created_at desc limit 20;` : les lignes passent à `sent_at` renseigné.

### Si une notification n'arrive pas

- Le compte a-t-il **activé** les notifications, depuis son profil ? Sans abonnement, rien n'est mis en file — c'est voulu.
- Le navigateur a-t-il bloqué l'autorisation ? La carte l'indique et explique comment la rétablir.
- Une ligne de `notification_queue` avec `attempts = 3` et `sent_at` vide : trois échecs, la fonction abandonne. Voir ses logs.

## 5 ter. Reçus de paiement et fiche d'inscription

### Reçu de paiement

Chaque encaissement produit un **reçu numéroté** (`REC-2026-00042`), en PDF A5. Il s'ouvre dès l'encaissement, prêt à imprimer ou à télécharger.

**Design.** Bandeau aux **couleurs de l'école, tirées automatiquement de son logo** (un logo vert donne un reçu vert, un logo bordeaux un reçu bordeaux), nom de l'école en capitales à empattements, coordonnées, tampon « ACQUITTÉ », filigrane du logo, motif de sécurité guilloché, emplacement de cachet. Le total est écrit **en chiffres et en lettres**. La palette est calculée pour que le blanc reste lisible sur le bandeau quelle que soit la couleur du logo (contraste vérifié), et le reçu reste lisible sur une imprimante noir et blanc. Jusqu'à 7 lignes de paiement tiennent sur une seule page (mode compact au-delà de 4 lignes).

Le reçu porte aussi le nom de l'élève, chaque ligne payée, le mode de paiement, le nom du caissier et les emplacements de signature.

- **Un reçu par encaissement**, pas par ligne : inscription plus trois mois payés d'un coup donnent un seul reçu.
- **Numéro séquentiel par école et par année**, attribué sous verrou : deux caissiers au même instant ne prennent jamais le même numéro. Un reçu ne se supprime ni ne se modifie.
- **Le chemin d'encaissement n'est pas modifié.** Le numéro est attribué *après* l'enregistrement du paiement, par une fonction séparée (`issue_receipt`). Un incident sur le reçu ne peut donc jamais empêcher d'encaisser ; il affiche « Paiement enregistré, reçu non émis » et le reçu se rouvre depuis l'historique de la caisse.
- **Réédition** : bouton « Voir / réimprimer le reçu » dans l'historique de la caisse ; la copie porte la mention **DUPLICATA**. Un paiement annulé garde son reçu, marqué **ANNULÉ** et sans valeur.
- **Les familles** retrouvent leurs reçus dans « Paiements » du portail (toujours en duplicata), même hors connexion.
- Les paiements **antérieurs** à ce système n'ont pas de reçu : il leur en est attribué un à la demande, avec le prochain numéro.
- **Logo, adresse et n° d'agrément (NINEA)** : Paramètres → École. Sans logo, un monogramme aux initiales de l'école s'imprime.

Mise en route : exécuter `docs/sql/recus.sql` dans le SQL Editor (une seule fois), puis publier l'application.

### Fiche d'inscription

À chaque inscription ou réinscription, une fiche s'ouvre, prête à imprimer. Elle se réédite depuis le profil de l'élève (« Fiche d'inscription »). Même identité visuelle que le reçu. Deux pages dans un seul PDF :

- **Page 1, exemplaire de l'école** (signée et archivée) : identité, classe, tuteurs, frais, engagement, signatures. La photo est facultative : sans photo, aucun cadre vide. Elle ne contient **aucun mot de passe** : un dossier d'archive se consulte, se photocopie, se perd.
- **Page 2, exemplaire de la famille** : identifiant, mot de passe, QR code vers le site, et le mode d'emploi (se connecter, installer l'application, activer les notifications). Absente si les identifiants ne sont pas lisibles.

Le compte de l'élève se crée en arrière-plan juste après l'inscription : la fiche patiente quelques secondes avant de conclure qu'il n'y a pas d'identifiants.

## 6. Avant chaque mise en ligne

```bash
npm run verify
```

La CI GitHub rejoue les types, le lint, les tests et le build. Elle vérifie aussi que le build produit une application installable, un `robots.txt`, un plan du site, et aucune variable `%VITE_…%` oubliée dans la page. **CI rouge = on ne déploie pas.**

## 7. Vérifications après la première mise en ligne

- [ ] `https://senclass.com` s'ouvre en HTTPS, et `www.` y redirige.
- [ ] L'onglet affiche l'icône orange à couches.
- [ ] Un lien partagé dans WhatsApp montre l'image SenClass.
- [ ] L'[outil de test des résultats enrichis](https://search.google.com/test/rich-results) de Google, sur l'accueil, détecte les données structurées sans erreur.
- [ ] Search Console : le plan du site est soumis et l'accueil est indexé.
- [ ] `senclass.pages.dev` renvoie bien `X-Robots-Tag: noindex`.
- [ ] Le lien « mot de passe oublié » reçu par e-mail pointe vers `senclass.com`, pas vers `localhost`.
- [ ] En mode avion, l'application installée s'ouvre et affiche « Hors connexion ».
- [ ] La caméra fonctionne (photo d'inscription, scan à la caisse) et un bulletin PDF se génère.
