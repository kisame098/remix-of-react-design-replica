import type { Chapitre } from '@/lib/guide';

// ═══════════════════════════════════════════════════════════════════════════
// LE PARCOURS — tout ce que le guide dit et demande
//
// Chaque `cible` est un attribut data-guide="…" posé dans l'écran ; un test
// (parcours.test.ts) échoue si l'un d'eux disparaît du code.
//
// Règle d'écriture : dire CE QUE C'EST et À QUOI ÇA SERT, puis laisser faire.
// ═══════════════════════════════════════════════════════════════════════════

/** Une création dans une fenêtre : le nom d'un chemin de notes /notes/<période>/<classe>. */
const PAGE_CLASSE_NOTES = /^\/notes\/[^/]+\/[^/]+$/;
const PAGE_SAISIE = /^\/notes\/[^/]+\/[^/]+\/(elementaire\/)?[^/]+$/;

export const CHAPITRES: Chapitre[] = [
  // ─── 1. Repères ───────────────────────────────────────────────────────────
  {
    id: 'reperes', titre: 'Premiers repères', icone: 'reperes',
    description: 'Le menu, l\'année scolaire et votre compte : où se trouve quoi.',
    etapes: [
      {
        id: 'reperes-tableau', titre: 'Voici votre tableau de bord', page: '/dashboard',
        texte: 'C\'est la première page que vous voyez en vous connectant : nombre d\'élèves, de classes, de professeurs, et vos dernières activités. Les chiffres se mettent à jour tout seuls.',
        condition: { type: 'lire' },
      },
      {
        id: 'reperes-menu', titre: 'Le menu de gauche', champs: [{ cible: 'menu:liste' }],
        texte: 'Chaque ligne ouvre une partie de SenClass. Vous irez de l\'une à l\'autre tout au long de ce guide. La rubrique où vous êtes est en couleur.',
        condition: { type: 'lire' },
      },
      {
        id: 'reperes-annee', titre: 'L\'année scolaire', champs: [{ cible: 'annee:selecteur' }],
        texte: 'Tout ce que vous voyez (élèves, notes, paiements…) appartient à l\'année affichée ici. À la rentrée prochaine, vous créerez la nouvelle année depuis ce bouton : l\'ancienne reste consultable.',
        astuce: 'Si une liste vous paraît vide, vérifiez d\'abord que vous êtes sur la bonne année.',
        condition: { type: 'lire' },
      },
      {
        id: 'reperes-compte', titre: 'Votre compte', champs: [{ cible: 'menu:compte' }],
        texte: 'Cliquez sur votre nom, en bas du menu : c\'est là que se trouvent les réglages, la déconnexion… et ce guide, si vous voulez le relancer.',
        condition: { type: 'visible', cible: 'menu:deconnexion' }, passerVers: 'fin',
      },
      {
        id: 'reperes-relancer', titre: 'Vous retrouverez le guide ici', champs: [{ cible: 'menu:apprendre' }],
        texte: '« Apprendre SenClass » rouvre la liste des chapitres à tout moment. Vous pouvez en refaire un, ou n\'en choisir qu\'un seul.',
        condition: { type: 'lire' }, siAbsent: 'reperes-compte',
      },
    ],
  },

  // ─── 2. Paramètres ────────────────────────────────────────────────────────
  {
    id: 'parametres', titre: 'Régler mon école', icone: 'parametres', adminOnly: true,
    description: 'Nom, logo, coordonnées, dates de l\'année, échéances, horaires et moyennes de passage.',
    etapes: [
      {
        id: 'par-compte', titre: 'Ouvrez le menu de votre compte', champs: [{ cible: 'menu:compte' }],
        texte: 'Cliquez sur votre nom, en bas à gauche.',
        condition: { type: 'visible', cible: 'menu:parametres' }, passerVers: 'par-ecole-intro',
      },
      {
        id: 'par-ouvrir', titre: 'Cliquez sur « Paramètres »', champs: [{ cible: 'menu:parametres' }],
        texte: 'C\'est ici que se règle toute l\'école. Seul le directeur y a accès.',
        condition: { type: 'page', chemin: '/parametres' }, siAbsent: 'par-compte',
      },
      {
        id: 'par-ecole-intro', titre: 'Les cinq parties des paramètres', page: '/parametres', champs: [{ cible: 'parametres:onglets' }],
        texte: 'École, Mon compte, Année scolaire, Emploi du temps et une dernière partie selon votre établissement. Nous les voyons une par une, en commençant par l\'école.',
        condition: { type: 'lire' },
      },
      {
        id: 'par-ecole-onglet', titre: 'Ouvrez l\'onglet « École »', page: '/parametres', champs: [{ cible: 'parametres:onglet-ecole' }],
        texte: 'Il contient l\'identité de votre établissement.',
        condition: { type: 'visible', cible: 'ecole:nom' }, passerVers: 'par-compte-onglet',
      },
      {
        id: 'par-logo', titre: 'Le logo', importance: 'conseille', page: '/parametres', champs: [{ cible: 'ecole:logo' }],
        texte: 'Il apparaît sur les bulletins, les reçus et les fiches d\'inscription. Cliquez sur « Changer la photo » et choisissez votre image : elle est enregistrée tout de suite.',
        astuce: 'Une image PNG à fond transparent donne le meilleur résultat. Sans logo, SenClass met les initiales de l\'école.',
        condition: { type: 'lire' }, siAbsent: 'par-ecole-onglet',
      },
      {
        id: 'par-nom', titre: 'Le nom de l\'école', importance: 'obligatoire', page: '/parametres', champs: [{ cible: 'ecole:nom', libelle: 'Nom de l\'école' }],
        texte: 'Écrivez-le exactement comme vous voulez le lire sur les bulletins et les reçus.',
        condition: { type: 'rempli' }, siAbsent: 'par-ecole-onglet',
      },
      {
        id: 'par-lieu', titre: 'Ville et pays', importance: 'conseille', page: '/parametres', champs: [{ cible: 'ecole:ville', libelle: 'Ville' }, { cible: 'ecole:pays', libelle: 'Pays' }],
        texte: 'Ils complètent l\'adresse dans l\'en-tête de vos documents.',
        condition: { type: 'rempli' }, siAbsent: 'par-ecole-onglet',
      },
      {
        id: 'par-contact', titre: 'Téléphone et e-mail', importance: 'conseille', page: '/parametres', champs: [{ cible: 'ecole:telephone', libelle: 'Téléphone' }, { cible: 'ecole:email', libelle: 'E-mail de contact' }],
        texte: 'Ce sont les coordonnées que les familles liront sur les reçus : mettez celles de l\'école, pas les vôtres.',
        condition: { type: 'rempli' }, siAbsent: 'par-ecole-onglet',
      },
      {
        id: 'par-adresse', titre: 'L\'adresse', importance: 'conseille', page: '/parametres', champs: [{ cible: 'ecole:adresse', libelle: 'Adresse' }],
        texte: 'Boîte postale, rue ou quartier. Elle figure dans l\'en-tête des reçus et des fiches d\'inscription.',
        condition: { type: 'rempli' }, siAbsent: 'par-ecole-onglet',
      },
      {
        id: 'par-officiel', titre: 'Les numéros officiels', importance: 'facultatif', page: '/parametres',
        champs: [{ cible: 'ecole:ninea' }, { cible: 'ecole:autorisation' }, { cible: 'ecole:rc' }],
        texte: 'N° d\'agrément ou NINEA : dans l\'en-tête des reçus. N° d\'autorisation d\'ouverture et registre de commerce : au pied des documents officiels. Remplissez seulement ceux que vous avez.',
        condition: { type: 'lire' }, siAbsent: 'par-ecole-onglet',
      },
      {
        id: 'par-directeurs', titre: 'Les directeurs', importance: 'facultatif', page: '/parametres', champs: [{ cible: 'ecole:directeurs-etudes' }, { cible: 'ecole:directeur-general' }],
        texte: 'Leurs noms signent les bulletins. Laissez vide si vous signez à la main.',
        condition: { type: 'lire' }, siAbsent: 'par-ecole-onglet',
      },
      {
        id: 'par-pied', titre: 'Le pied de page', importance: 'facultatif', page: '/parametres', champs: [{ cible: 'ecole:pied' }],
        texte: 'Un texte libre imprimé en bas des bulletins et relevés : banque, site, slogan… une information par ligne.',
        condition: { type: 'lire' }, siAbsent: 'par-ecole-onglet',
      },
      {
        id: 'par-ecole-enregistrer', titre: 'Enregistrez', importance: 'obligatoire', page: '/parametres', champs: [{ cible: 'ecole:enregistrer' }],
        texte: 'Rien n\'est gardé tant que vous n\'avez pas cliqué ici. Le guide avancera dès que l\'enregistrement aura réussi.',
        condition: { type: 'signal', nom: 'ecole-enregistree' }, siAbsent: 'par-ecole-onglet',
      },
      {
        id: 'par-compte-onglet', titre: 'Ouvrez « Mon compte »', page: '/parametres', champs: [{ cible: 'parametres:onglet-compte' }],
        texte: 'Vos informations à vous, différentes de celles de l\'école.',
        condition: { type: 'visible', cible: 'compte:nom' }, passerVers: 'par-annee-onglet',
      },
      {
        id: 'par-compte-nom', titre: 'Votre nom complet', importance: 'obligatoire', page: '/parametres', champs: [{ cible: 'compte:nom', libelle: 'Nom complet' }],
        texte: 'C\'est ce nom qui s\'écrit dans « Encaissé par » sur les reçus : vérifiez qu\'il est juste. La photo est facultative.',
        condition: { type: 'rempli' }, siAbsent: 'par-compte-onglet',
      },
      {
        id: 'par-compte-enregistrer', titre: 'Enregistrez votre compte', page: '/parametres', champs: [{ cible: 'compte:enregistrer' }],
        texte: 'Cliquez sur Enregistrer.',
        condition: { type: 'signal', nom: 'compte-enregistre' }, siAbsent: 'par-compte-onglet',
      },
      {
        id: 'par-annee-onglet', titre: 'Ouvrez « Année scolaire »', page: '/parametres', champs: [{ cible: 'parametres:onglet-annee' }],
        texte: 'Cette partie commande les mois que les familles doivent payer.',
        condition: { type: 'visible', cible: 'annee:dates' }, passerVers: 'par-horaires-onglet',
      },
      {
        id: 'par-annee-dates', titre: 'Les dates de l\'année', importance: 'obligatoire', page: '/parametres', champs: [{ cible: 'annee:dates', libelle: 'Ouverture et fermeture' }],
        texte: 'De l\'ouverture à la fermeture : SenClass en déduit les mois de scolarité, et refuse les présences en dehors de ces dates.',
        condition: { type: 'rempli' }, siAbsent: 'par-annee-onglet',
      },
      {
        id: 'par-annee-enregistrer', titre: 'Enregistrez les dates', importance: 'obligatoire', page: '/parametres', champs: [{ cible: 'annee:enregistrer' }],
        texte: 'Cliquez sur Enregistrer, juste sous les dates.',
        condition: { type: 'signal', nom: 'annee-enregistree' }, siAbsent: 'par-annee-onglet',
      },
      {
        id: 'par-echeance-mode', titre: 'Quand la mensualité est-elle due ?', page: '/parametres', champs: [{ cible: 'echeance:mode' }],
        texte: 'Avant le début du mois, ou à la fin du mois. SenClass s\'en sert pour dire qu\'un mois impayé est « en retard ».',
        condition: { type: 'lire' }, siAbsent: 'par-annee-onglet',
      },
      {
        id: 'par-echeance-arrivee', titre: 'L\'élève qui arrive en cours de mois', importance: 'facultatif', page: '/parametres', champs: [{ cible: 'echeance:arrivee' }],
        texte: 'Cochez si vous offrez le mois d\'arrivée à partir d\'un certain jour. Sinon, le mois entier est dû, quel que soit le jour d\'inscription. Ce choix s\'enregistre tout seul.',
        condition: { type: 'lire' }, siAbsent: 'par-annee-onglet',
      },
      {
        id: 'par-echeance-mois', titre: 'Les mois à facturer', importance: 'facultatif', page: '/parametres', champs: [{ cible: 'echeance:mois' }],
        texte: 'Décochez un mois que vous ne faites pas payer (vacances, par exemple), puis cliquez sur « Enregistrer les mois ».',
        astuce: 'Enregistrez les mois AVANT de passer à la suite : un mois décoché mais non enregistré est oublié.',
        condition: { type: 'lire' }, siAbsent: 'par-annee-onglet',
      },
      {
        id: 'par-echeance-enregistrer', titre: 'Enregistrez l\'échéance', page: '/parametres', champs: [{ cible: 'echeance:enregistrer' }],
        texte: 'Ce bouton enregistre le mode de facturation choisi plus haut.',
        condition: { type: 'signal', nom: 'echeance-enregistree' }, siAbsent: 'par-annee-onglet',
      },
      {
        id: 'par-horaires-onglet', titre: 'Ouvrez « Emploi du temps »', page: '/parametres', champs: [{ cible: 'parametres:onglet-horaires' }],
        texte: 'Les heures d\'ouverture de vos cours.',
        condition: { type: 'visible', cible: 'horaires:plage' }, passerVers: 'par-scolarite-onglet',
      },
      {
        id: 'par-horaires', titre: 'La plage horaire', page: '/parametres', champs: [{ cible: 'horaires:plage' }],
        texte: 'Première heure de cours et dernière heure de fin : la grille de l\'emploi du temps n\'affichera que ces heures.',
        condition: { type: 'lire' }, siAbsent: 'par-horaires-onglet',
      },
      {
        id: 'par-horaires-enregistrer', titre: 'Enregistrez les horaires', page: '/parametres', champs: [{ cible: 'horaires:enregistrer' }],
        texte: 'Cliquez sur Enregistrer.',
        condition: { type: 'signal', nom: 'horaires-enregistres' }, siAbsent: 'par-horaires-onglet',
      },
      {
        id: 'par-scolarite-onglet', titre: 'Ouvrez « Scolarité »', mode: 'classique', page: '/parametres', champs: [{ cible: 'parametres:onglet-scolarite' }],
        texte: 'Trimestres ou semestres, et la moyenne pour passer en classe supérieure.',
        condition: { type: 'visible', cible: 'scolarite:cycles' }, passerVers: 'par-fin',
      },
      {
        id: 'par-scolarite', titre: 'Chaque cycle a ses règles', mode: 'classique', page: '/parametres', champs: [{ cible: 'scolarite:cycles' }],
        texte: 'Pour chaque cycle, choisissez le découpage de l\'année et la moyenne de passage. Le bulletin de fin d\'année s\'en sert pour écrire Admis ou Redouble.',
        condition: { type: 'lire' }, siAbsent: 'par-scolarite-onglet',
      },
      {
        id: 'par-scolarite-enregistrer', titre: 'Enregistrez la scolarité', mode: 'classique', page: '/parametres', champs: [{ cible: 'scolarite:enregistrer' }],
        texte: 'Cliquez sur Enregistrer.',
        condition: { type: 'signal', nom: 'scolarite-enregistree' }, siAbsent: 'par-scolarite-onglet',
      },
      {
        id: 'par-financements', titre: 'L\'onglet « Financements »', mode: 'formation_pro', importance: 'facultatif', page: '/parametres', champs: [{ cible: 'parametres:onglet-financements' }],
        texte: 'À activer seulement si un organisme (3FPT, bailleur…) paie une part des frais de certains apprenants. Le reste se règle ensuite dans la rubrique Financements.',
        condition: { type: 'lire' },
      },
      {
        id: 'par-fin', titre: 'Votre école est réglée', texte: 'Vous pourrez modifier chacun de ces réglages quand vous voudrez : ils s\'appliquent aussitôt partout.',
        condition: { type: 'lire' },
      },
    ],
  },

  // ─── 3. Cursus ────────────────────────────────────────────────────────────
  {
    id: 'cursus', titre: 'Comprendre le Cursus', icone: 'cursus', permission: 'grades', mode: 'classique',
    description: 'Les matières et coefficients de chaque niveau, déjà préparés pour vous.',
    etapes: [
      {
        id: 'cur-ouvrir', titre: 'Ouvrez « Cursus »', champs: [{ cible: 'menu:/filieres' }],
        texte: 'Cliquez sur Cursus dans le menu de gauche.',
        condition: { type: 'page', chemin: '/filieres' },
      },
      {
        id: 'cur-blocs', titre: 'Un bloc par niveau', page: '/filieres', champs: [{ cible: 'cursus:blocs' }],
        texte: 'Chaque bloc liste les matières d\'un niveau avec leurs coefficients (ou leurs points à l\'élémentaire). Quand vous créerez une classe, vous choisirez un bloc et toutes ses matières arriveront d\'un coup.',
        condition: { type: 'lire' },
      },
      {
        id: 'cur-modifier', titre: 'Adaptez-les à votre école', importance: 'facultatif', page: '/filieres', champs: [{ cible: 'cursus:blocs' }],
        texte: 'Passez la souris sur une matière : un crayon permet de la modifier, une corbeille de la retirer. Faites-le maintenant si vos coefficients sont différents, sinon continuez.',
        condition: { type: 'lire' },
      },
      {
        id: 'cur-nouveau', titre: 'Il manque une série ?', importance: 'facultatif', page: '/filieres', champs: [{ cible: 'cursus:nouveau' }],
        texte: '« Nouveau bloc » ajoute une série (S2, L1…) à un niveau. « Importer » et « Exporter » servent à copier tout un programme d\'une école à l\'autre.',
        condition: { type: 'lire' },
      },
    ],
  },

  // ─── 4. Classes ───────────────────────────────────────────────────────────
  {
    id: 'classes', titre: 'Créer une classe', icone: 'classes', permission: 'classes', mode: 'classique',
    description: 'Votre première classe, avec ses matières.',
    etapes: [
      {
        id: 'cla-ouvrir', titre: 'Ouvrez « Gestion Classe »', champs: [{ cible: 'menu:/classes' }],
        texte: 'Cliquez sur Gestion Classe dans le menu de gauche.',
        condition: { type: 'page', chemin: '/classes' },
      },
      {
        id: 'cla-nouvelle', titre: 'Cliquez sur « Nouvelle Classe »', page: '/classes', champs: [{ cible: 'classe:nouvelle' }],
        texte: 'Une fenêtre va s\'ouvrir. Créez une vraie classe de votre école : elle restera.',
        condition: { type: 'visible', cible: 'classe:nom' }, passerVers: 'cla-liste',
      },
      {
        id: 'cla-nom', titre: 'Le nom de la classe', importance: 'obligatoire', page: '/classes', champs: [{ cible: 'classe:nom', libelle: 'Nom de la classe' }],
        texte: 'Par exemple « 6ème A ». Deux classes ne peuvent pas porter le même nom.',
        condition: { type: 'rempli' }, siAbsent: 'cla-nouvelle',
      },
      {
        id: 'cla-limite', titre: 'La limite d\'élèves', importance: 'obligatoire', page: '/classes', champs: [{ cible: 'classe:limite', libelle: 'Limite d\'élèves' }],
        texte: 'Quand elle est atteinte, la classe est « COMPLET » et on ne peut plus y inscrire personne. Vous pourrez l\'augmenter plus tard.',
        condition: { type: 'rempli' }, siAbsent: 'cla-nouvelle',
      },
      {
        id: 'cla-bloc', titre: 'Le programme', importance: 'conseille', page: '/classes', champs: [{ cible: 'classe:bloc' }],
        texte: 'Choisissez le bloc du Cursus qui correspond (6ème, TS2…) : les matières et coefficients s\'ajoutent tout seuls. Avec « Aucun », il faudra les saisir une par une.',
        condition: { type: 'lire' }, siAbsent: 'cla-nouvelle',
      },
      {
        id: 'cla-creer', titre: 'Créez la classe', importance: 'obligatoire', page: '/classes', champs: [{ cible: 'classe:creer' }],
        texte: 'Cliquez sur « Créer la classe ». Si un champ manque, un message vous le dira.',
        condition: { type: 'signal', nom: 'classe-creee' }, siAbsent: 'cla-nouvelle',
      },
      {
        id: 'cla-liste', titre: 'Vos classes', page: '/classes', champs: [{ cible: 'classe:liste' }],
        texte: 'Chaque carte montre les élèves inscrits et les places restantes. Le crayon modifie la classe ; la corbeille la supprime, mais seulement si elle est vide.',
        absence: 'Vous n\'avez pas encore de classe. Revenez en arrière pour en créer une, ou continuez.',
        condition: { type: 'lire' },
      },
    ],
  },

  // ─── 4 bis. Formations et promotions (formation professionnelle) ──────────
  {
    id: 'formations', titre: 'Formations et promotions', icone: 'formations', permission: 'grades', mode: 'formation_pro',
    description: 'Votre catalogue de formations, puis les groupes d\'apprenants.',
    etapes: [
      {
        id: 'for-ouvrir', titre: 'Ouvrez « Formations »', champs: [{ cible: 'menu:/formation/formations' }],
        texte: 'Cliquez sur Formations dans le menu de gauche.',
        condition: { type: 'page', chemin: '/formation/formations' },
      },
      {
        id: 'for-ajouter', titre: 'Ajoutez une formation', page: '/formation/formations', champs: [{ cible: 'formation:ajouter' }],
        texte: 'Cliquez sur « Ajouter une formation », remplissez la fenêtre et enregistrez. Une formation (« CAP Restauration ») contient des niveaux (« CAP 1 », « CAP 2 »…).',
        condition: { type: 'signal', nom: 'formation-creee' },
      },
      {
        id: 'for-niveaux', titre: 'Puis ses niveaux', page: '/formation/formations',
        texte: 'Cliquez sur le nom de la formation pour l\'ouvrir : vous y créez ses niveaux, et dans chaque niveau ses matières avec coefficients. Sans niveau, on ne peut pas ouvrir de promotion.',
        condition: { type: 'page', chemin: /^\/formation\/formations\/[^/]+/ },
      },
      {
        id: 'for-niveau-creer', titre: 'Créez au moins un niveau',
        texte: 'Ajoutez un niveau sur cette page, puis continuez. Vous pourrez compléter ses matières plus tard.',
        condition: { type: 'lire' },
      },
      {
        id: 'for-promos', titre: 'Ouvrez « Promotions »', champs: [{ cible: 'menu:/formation/promotions' }],
        texte: 'Une promotion, c\'est le groupe d\'apprenants qui suit un niveau ensemble.',
        condition: { type: 'page', chemin: '/formation/promotions' },
      },
      {
        id: 'for-promo-creer', titre: 'Créez une promotion', page: '/formation/promotions', champs: [{ cible: 'promotion:nouvelle' }],
        texte: 'Cliquez sur « Nouvelle promotion », choisissez le niveau, donnez un nom et enregistrez. Les matières du niveau sont reprises automatiquement.',
        absence: 'Le bouton est inactif tant qu\'aucun niveau n\'existe : créez-en un dans Formations.',
        condition: { type: 'signal', nom: 'promotion-creee' },
      },
    ],
  },

  // ─── 5. Inscrire un élève ─────────────────────────────────────────────────
  {
    id: 'inscrire-eleve', titre: 'Inscrire un élève', icone: 'eleve', permission: 'students',
    description: 'De la fiche de l\'élève à sa fiche d\'inscription avec identifiants.',
    etapes: [
      {
        id: 'ele-ouvrir', titre: 'Ouvrez « Inscription Élèves »', champs: [{ cible: 'menu:/inscription' }],
        texte: 'Cliquez sur Inscription Élèves dans le menu de gauche.',
        condition: { type: 'page', chemin: '/inscription' },
      },
      {
        id: 'ele-reel', titre: 'Inscrivez un vrai élève', page: '/inscription',
        texte: 'Ce que vous saisissez est réellement enregistré dans votre école. Prenez la fiche d\'un de vos élèves et remplissons-la ensemble.',
        condition: { type: 'lire' },
      },
      {
        id: 'ele-reinscription', titre: 'L\'élève déjà venu l\'an dernier', importance: 'facultatif', page: '/inscription', champs: [{ cible: 'eleve:reinscription' }],
        texte: 'Saisissez son identifiant (ETU-…) : sa fiche se remplit toute seule, il ne reste qu\'à choisir sa nouvelle classe. Inutile pour un nouvel élève.',
        condition: { type: 'lire' },
      },
      {
        id: 'ele-import', titre: 'Beaucoup d\'élèves ?', importance: 'facultatif', page: '/inscription', champs: [{ cible: 'eleve:import' }],
        texte: 'Ce bouton importe toute une liste depuis un fichier. Pour apprendre, nous en inscrivons un à la main.',
        condition: { type: 'lire' },
      },
      {
        id: 'ele-photo', titre: 'La photo', importance: 'facultatif', page: '/inscription', champs: [{ cible: 'eleve:photo' }],
        texte: 'Avec la caméra ou depuis un fichier. Vous pourrez l\'ajouter plus tard.',
        condition: { type: 'lire' },
      },
      {
        id: 'ele-nom', titre: 'Nom et prénom', importance: 'obligatoire', page: '/inscription', champs: [{ cible: 'eleve:nom', libelle: 'Nom' }, { cible: 'eleve:prenom', libelle: 'Prénom' }],
        texte: 'Comme sur l\'acte de naissance : ils seront imprimés sur les bulletins.',
        condition: { type: 'rempli' },
      },
      {
        id: 'ele-naissance', titre: 'Naissance', importance: 'obligatoire', page: '/inscription', champs: [{ cible: 'eleve:naissance-date', libelle: 'Date de naissance' }, { cible: 'eleve:naissance-lieu', libelle: 'Lieu de naissance' }],
        texte: 'La date et le lieu de naissance de l\'élève.',
        condition: { type: 'rempli' },
      },
      {
        id: 'ele-sexe', titre: 'Sexe et résidence', importance: 'obligatoire', page: '/inscription', champs: [{ cible: 'eleve:sexe', libelle: 'Sexe' }, { cible: 'eleve:residence', libelle: 'Lieu de résidence' }],
        texte: 'Choisissez le sexe dans la liste, puis écrivez où habite l\'élève.',
        condition: { type: 'rempli' },
      },
      {
        id: 'ele-contact', titre: 'Téléphone et e-mail de l\'élève', importance: 'facultatif', page: '/inscription', champs: [{ cible: 'eleve:telephone' }, { cible: 'eleve:email' }],
        texte: 'Seulement s\'il en a. Le numéro important est celui du tuteur, juste après.',
        condition: { type: 'lire' },
      },
      {
        id: 'ele-tuteur', titre: 'Le tuteur principal', importance: 'obligatoire', page: '/inscription', champs: [{ cible: 'eleve:tuteur-statut', libelle: 'Lien avec l\'élève' }, { cible: 'eleve:tuteur-telephone', libelle: 'Téléphone du tuteur' }],
        texte: 'La personne à joindre : père, mère, oncle… et son numéro.',
        condition: { type: 'rempli' },
      },
      {
        id: 'ele-tuteur2', titre: 'Un deuxième tuteur', importance: 'facultatif', page: '/inscription', champs: [{ cible: 'eleve:tuteur2' }],
        texte: 'Une autre personne à joindre si la première ne répond pas.',
        condition: { type: 'lire' },
      },
      {
        id: 'ele-classe', titre: 'Sa classe (ou sa promotion)', importance: 'obligatoire', page: '/inscription', champs: [{ cible: 'eleve:classe', libelle: 'Classe choisie' }],
        texte: 'Seules celles qui ont encore de la place apparaissent. S\'il y a des matières au choix, elles s\'affichent juste dessous : répondez-y aussi.',
        absence: 'Aucune place disponible : créez d\'abord une classe (ou une promotion), puis revenez à ce chapitre.',
        condition: { type: 'rempli' },
      },
      {
        id: 'ele-inscrire', titre: 'Inscrivez l\'élève', importance: 'obligatoire', page: '/inscription', champs: [{ cible: 'eleve:inscrire' }],
        texte: 'Cliquez sur « Inscrire l\'élève ». S\'il manque une information, un message vous dit laquelle.',
        condition: { type: 'signal', nom: 'eleve-inscrit' },
      },
      {
        id: 'ele-fiche', titre: 'La fiche d\'inscription', page: '/inscription',
        texte: 'Elle s\'ouvre toute seule : vous pouvez l\'imprimer pour la famille. Elle contient aussi l\'identifiant et le mot de passe de l\'élève pour son portail. Fermez-la quand vous avez fini.',
        condition: { type: 'lire' },
      },
    ],
  },

  // ─── 6. Gérer les élèves ──────────────────────────────────────────────────
  {
    id: 'gerer-eleves', titre: 'Gérer les élèves', icone: 'eleves', permission: 'students',
    description: 'Retrouver, consulter et corriger une fiche.',
    etapes: [
      {
        id: 'ges-ouvrir', titre: 'Ouvrez « Gestion Élèves »', champs: [{ cible: 'menu:/eleves' }],
        texte: 'Cliquez sur Gestion Élèves dans le menu de gauche.',
        condition: { type: 'page', chemin: '/eleves' },
      },
      {
        id: 'ges-recherche', titre: 'Retrouver un élève', page: '/eleves', champs: [{ cible: 'eleves:recherche' }],
        texte: 'Tapez un nom, un prénom ou un identifiant : la liste se réduit pendant que vous écrivez. Essayez, puis effacez.',
        condition: { type: 'lire' },
      },
      {
        id: 'ges-filtre', titre: 'Filtrer et changer d\'affichage', page: '/eleves', champs: [{ cible: 'eleves:filtre' }, { cible: 'eleves:vue' }],
        texte: 'Choisissez une classe pour ne voir que ses élèves, et passez de la grille au tableau selon vos goûts.',
        condition: { type: 'lire' },
      },
      {
        id: 'ges-profil', titre: 'Ouvrez un profil', page: '/eleves', champs: [{ cible: 'eleves:profil' }],
        texte: 'Cliquez sur « Profil » d\'un élève.',
        absence: 'Aucun élève à l\'écran : inscrivez-en un, ou effacez votre recherche.',
        condition: { type: 'visible', cible: 'eleves:fiche' }, passerVers: 'ges-exporter',
      },
      {
        id: 'ges-fiche', titre: 'Tout sur l\'élève', page: '/eleves', champs: [{ cible: 'eleves:fiche' }],
        texte: '« Personnel » : naissance, résidence, tuteurs. « Profil académique » : ses matières, que l\'on peut activer ou désactiver pour lui seul (dispense, par exemple).',
        condition: { type: 'lire' }, siAbsent: 'ges-profil',
      },
      {
        id: 'ges-modifier', titre: 'Modifier ses informations', page: '/eleves', champs: [{ cible: 'eleves:modifier' }],
        texte: 'Cliquez sur « Modifier les informations ». Juste au-dessus, « Fiche d\'inscription » réimprime sa fiche avec ses identifiants.',
        condition: { type: 'visible', cible: 'eleves:enregistrer' }, siAbsent: 'ges-profil', passerVers: 'ges-exporter',
      },
      {
        id: 'ges-enregistrer', titre: 'Corrigez, puis enregistrez', page: '/eleves', champs: [{ cible: 'eleves:enregistrer' }],
        texte: 'Changez ce que vous voulez (même la classe) et cliquez sur Enregistrer. « Retirer » sert à un élève qui quitte l\'école : ses paiements passés sont conservés, et vous pouvez le réintégrer.',
        condition: { type: 'signal', nom: 'eleve-modifie' }, siAbsent: 'ges-profil', passerVers: 'ges-exporter',
      },
      {
        id: 'ges-exporter', titre: 'Exporter la liste', importance: 'facultatif', page: '/eleves', champs: [{ cible: 'eleves:exporter' }],
        texte: 'Sort la liste affichée, par exemple celle d\'une seule classe, pour l\'imprimer ou l\'ouvrir ailleurs.',
        condition: { type: 'lire' },
      },
    ],
  },

  // ─── 7. Inscrire un professeur ────────────────────────────────────────────
  {
    id: 'inscrire-prof', titre: 'Inscrire un professeur', icone: 'prof', permission: 'teachers',
    description: 'Sa fiche, son contrat et sa rémunération.',
    etapes: [
      {
        id: 'pro-ouvrir', titre: 'Ouvrez « Inscription Profs »', champs: [{ cible: 'menu:/inscription-prof' }],
        texte: 'Cliquez sur Inscription Profs dans le menu de gauche.',
        condition: { type: 'page', chemin: '/inscription-prof' },
      },
      {
        id: 'pro-photo', titre: 'La photo', importance: 'facultatif', page: '/inscription-prof', champs: [{ cible: 'prof:photo' }],
        texte: 'Avec la caméra ou depuis un fichier.',
        condition: { type: 'lire' },
      },
      {
        id: 'pro-nom', titre: 'Nom et prénom', importance: 'obligatoire', page: '/inscription-prof', champs: [{ cible: 'prof:nom', libelle: 'Nom' }, { cible: 'prof:prenom', libelle: 'Prénom' }],
        texte: 'Le nom tel qu\'il apparaîtra dans l\'emploi du temps.',
        condition: { type: 'rempli' },
      },
      {
        id: 'pro-naissance', titre: 'Naissance', importance: 'obligatoire', page: '/inscription-prof', champs: [{ cible: 'prof:naissance-date', libelle: 'Date de naissance' }, { cible: 'prof:naissance-lieu', libelle: 'Lieu de naissance' }],
        texte: 'La date et le lieu de naissance du professeur.',
        condition: { type: 'rempli' },
      },
      {
        id: 'pro-sexe', titre: 'Sexe et résidence', importance: 'obligatoire', page: '/inscription-prof', champs: [{ cible: 'prof:sexe', libelle: 'Sexe' }, { cible: 'prof:residence', libelle: 'Lieu de résidence' }],
        texte: 'Choisissez le sexe, puis écrivez l\'adresse.',
        condition: { type: 'rempli' },
      },
      {
        id: 'pro-telephone', titre: 'Son téléphone', importance: 'obligatoire', page: '/inscription-prof', champs: [{ cible: 'prof:telephone', libelle: 'Téléphone' }],
        texte: 'Son numéro personnel. L\'e-mail, à côté, est facultatif.',
        condition: { type: 'rempli' },
      },
      {
        id: 'pro-diplome', titre: 'Diplôme et expérience', importance: 'obligatoire', page: '/inscription-prof', champs: [{ cible: 'prof:diplome', libelle: 'Diplôme' }, { cible: 'prof:experience', libelle: 'Années d\'expérience' }],
        texte: 'Mettez 0 s\'il débute.',
        condition: { type: 'rempli' },
      },
      {
        id: 'pro-urgence', titre: 'Le numéro d\'urgence', importance: 'obligatoire', page: '/inscription-prof', champs: [{ cible: 'prof:urgence', libelle: 'Numéro d\'urgence' }],
        texte: 'La personne à appeler s\'il lui arrive quelque chose.',
        condition: { type: 'rempli' },
      },
      {
        id: 'pro-contrat', titre: 'Contrat et paiement', importance: 'obligatoire', page: '/inscription-prof', champs: [{ cible: 'prof:contrat', libelle: 'Type de contrat' }, { cible: 'prof:paiement', libelle: 'Type de paiement' }],
        texte: '« Payé à l\'heure » : son salaire se calcule sur ses heures pointées dans Présences. « Salaire fixe » : le même montant chaque mois.',
        condition: { type: 'rempli' },
      },
      {
        id: 'pro-salaire', titre: 'Le montant', importance: 'obligatoire', page: '/inscription-prof', champs: [{ cible: 'prof:salaire', libelle: 'Montant' }],
        texte: 'Le taux horaire ou le salaire mensuel, selon votre choix précédent.',
        condition: { type: 'rempli' }, siAbsent: 'pro-contrat',
      },
      {
        id: 'pro-inscrire', titre: 'Inscrivez le professeur', importance: 'obligatoire', page: '/inscription-prof', champs: [{ cible: 'prof:inscrire' }],
        texte: 'Cliquez sur « Inscrire le Professeur ». Son compte de connexion est créé en même temps.',
        condition: { type: 'signal', nom: 'prof-inscrit' },
      },
    ],
  },

  // ─── 8. Gérer les professeurs ─────────────────────────────────────────────
  {
    id: 'gerer-profs', titre: 'Gérer les professeurs', icone: 'profs', permission: 'teachers',
    description: 'Retrouver et modifier la fiche d\'un professeur.',
    etapes: [
      {
        id: 'gep-ouvrir', titre: 'Ouvrez « Gestion Profs »', champs: [{ cible: 'menu:/professeurs' }],
        texte: 'Cliquez sur Gestion Profs dans le menu de gauche.',
        condition: { type: 'page', chemin: '/professeurs' },
      },
      {
        id: 'gep-filtres', titre: 'Chercher et filtrer', page: '/professeurs', champs: [{ cible: 'profs:filtres' }],
        texte: 'Par nom, par identifiant ou par type de contrat, en grille ou en tableau.',
        condition: { type: 'lire' },
      },
      {
        id: 'gep-carte', titre: 'Profil et modification', page: '/professeurs', champs: [{ cible: 'profs:actions' }],
        texte: '« Profil » montre sa fiche, « Modifier » la corrige : contrat, salaire, coordonnées. C\'est aussi là qu\'on retire un professeur qui part.',
        absence: 'Aucun professeur à l\'écran pour le moment.',
        condition: { type: 'lire' },
      },
    ],
  },

  // ─── 9. Notes ─────────────────────────────────────────────────────────────
  {
    id: 'notes', titre: 'Saisir les notes', icone: 'notes', permission: 'grades', mode: 'classique',
    description: 'Créer une période, ouvrir une classe, noter, voir le classement.',
    etapes: [
      {
        id: 'not-ouvrir', titre: 'Ouvrez « Gestion Notes »', champs: [{ cible: 'menu:/notes' }],
        texte: 'Cliquez sur Gestion Notes dans le menu de gauche.',
        condition: { type: 'page', chemin: '/notes' },
      },
      {
        id: 'not-nouvelle', titre: 'Cliquez sur « Nouvelle Période »', page: '/notes', champs: [{ cible: 'notes:nouvelle' }],
        texte: 'Une période, c\'est un trimestre, un semestre ou un examen interne. Les notes sont rangées dedans. Si elle existe déjà, passez.',
        condition: { type: 'visible', cible: 'periode:nom' }, passerVers: 'not-periodes',
      },
      {
        id: 'not-type', titre: 'Le type', page: '/notes', champs: [{ cible: 'periode:type' }],
        texte: '« Semestre / Trimestre » : plusieurs devoirs et une composition. « Examen Interne » : une seule note par matière.',
        condition: { type: 'lire' }, siAbsent: 'not-nouvelle',
      },
      {
        id: 'not-nom', titre: 'Le nom', importance: 'obligatoire', page: '/notes', champs: [{ cible: 'periode:nom', libelle: 'Nom de la période' }],
        texte: 'Par exemple « 1er Trimestre ».',
        condition: { type: 'rempli' }, siAbsent: 'not-nouvelle',
      },
      {
        id: 'not-dates', titre: 'Les dates', importance: 'facultatif', page: '/notes', champs: [{ cible: 'periode:dates' }],
        texte: 'Elles servent à compter, sur le bulletin, les absences et retards de cette période seulement.',
        condition: { type: 'lire' }, siAbsent: 'not-nouvelle',
      },
      {
        id: 'not-creer', titre: 'Créez la période', importance: 'obligatoire', page: '/notes', champs: [{ cible: 'periode:creer' }],
        texte: 'Cliquez sur « Créer la période ». Toutes vos classes y sont ajoutées.',
        condition: { type: 'signal', nom: 'periode-creee' }, siAbsent: 'not-nouvelle',
      },
      {
        id: 'not-periodes', titre: 'Vos périodes', page: '/notes', champs: [{ cible: 'notes:periodes' }],
        texte: 'Cliquez sur une période pour voir ses classes à droite.',
        condition: { type: 'lire' },
      },
      {
        id: 'not-classe', titre: 'Ouvrez une classe', page: '/notes', champs: [{ cible: 'notes:classe' }],
        texte: 'Cliquez sur une classe. La barre montre combien de matières ont déjà des notes.',
        absence: 'Aucune classe à noter ici : créez une classe, ou choisissez une période à gauche.',
        condition: { type: 'page', chemin: PAGE_CLASSE_NOTES }, passerVers: 'fin',
      },
      {
        id: 'not-matieres', titre: 'Les matières de la classe', page: PAGE_CLASSE_NOTES,
        texte: 'Elles viennent du bloc choisi à la création de la classe. Vous pouvez en ajouter, changer un coefficient et désigner le professeur : il saisira alors ses notes depuis son propre portail.',
        condition: { type: 'lire' }, siAbsent: 'not-classe',
      },
      {
        id: 'not-saisir', titre: 'Cliquez sur « Saisir Notes »', page: PAGE_CLASSE_NOTES, champs: [{ cible: 'notes:saisir' }],
        texte: 'Choisissez la matière que vous voulez.',
        absence: 'Cette classe n\'a pas encore de matière : ajoutez-en une, ou choisissez un bloc dans Cursus.',
        condition: { type: 'page', chemin: PAGE_SAISIE }, passerVers: 'fin',
      },
      {
        id: 'not-noter', titre: 'Écrivez une note', importance: 'facultatif', page: PAGE_SAISIE,
        texte: 'Tapez une vraie note dans une case : elle s\'enregistre toute seule après une seconde (« Enregistré » s\'affiche en haut). Une case vide n\'est jamais comptée comme un zéro.',
        condition: { type: 'signal', nom: 'note-enregistree' },
      },
      {
        id: 'not-fin', titre: 'Et ensuite ?',
        texte: 'De retour sur la page de la classe, le bouton « Classement » donne les rangs et les bulletins à imprimer.',
        condition: { type: 'lire' },
      },
    ],
  },

  // ─── 10. Emploi du temps ──────────────────────────────────────────────────
  {
    id: 'emploi', titre: 'Faire l\'emploi du temps', icone: 'emploi', permission: 'schedule',
    description: 'Ajouter un cours : jour, heure, matière, professeur.',
    etapes: [
      {
        id: 'emp-ouvrir', titre: 'Ouvrez « Emplois du Temps »', champs: [{ cible: 'menu:/emplois-du-temps' }],
        texte: 'Cliquez sur Emplois du Temps dans le menu de gauche.',
        condition: { type: 'page', chemin: '/emplois-du-temps' },
      },
      {
        id: 'emp-vue', titre: 'Par classe ou par professeur', page: '/emplois-du-temps', champs: [{ cible: 'emploi:vue' }],
        texte: 'La même grille, vue de deux façons. Choisissez la classe à remplir.',
        condition: { type: 'lire' },
      },
      {
        id: 'emp-nouveau', titre: 'Cliquez sur « Nouveau Créneau »', page: '/emplois-du-temps', champs: [{ cible: 'emploi:nouveau' }],
        texte: 'Vous pouvez aussi cliquer directement dans une case de la grille.',
        condition: { type: 'visible', cible: 'cours:matiere' }, passerVers: 'emp-fin',
      },
      {
        id: 'emp-quand', titre: 'Le jour et l\'heure', importance: 'obligatoire', page: '/emplois-du-temps', champs: [{ cible: 'cours:jour', libelle: 'Jour' }, { cible: 'cours:heures', libelle: 'Début et fin' }],
        texte: 'Vérifiez le jour, l\'heure de début et l\'heure de fin.',
        condition: { type: 'rempli' }, siAbsent: 'emp-nouveau',
      },
      {
        id: 'emp-matiere', titre: 'La matière', importance: 'obligatoire', page: '/emplois-du-temps', champs: [{ cible: 'cours:matiere', libelle: 'Matière' }],
        texte: 'Par exemple « Mathématiques ». Si un champ « Classe » apparaît dessous, choisissez aussi la classe.',
        condition: { type: 'rempli' }, siAbsent: 'emp-nouveau',
      },
      {
        id: 'emp-prof', titre: 'Le professeur', importance: 'conseille', page: '/emplois-du-temps', champs: [{ cible: 'cours:prof' }],
        texte: 'SenClass prévient si ce professeur a déjà cours à cette heure. Sans professeur, ses heures ne pourront pas être comptées.',
        condition: { type: 'lire' }, siAbsent: 'emp-nouveau',
      },
      {
        id: 'emp-ajouter', titre: 'Ajoutez le cours', importance: 'obligatoire', page: '/emplois-du-temps', champs: [{ cible: 'cours:ajouter' }],
        texte: 'Le groupe et la couleur sont facultatifs. Cliquez sur « Ajouter ».',
        condition: { type: 'signal', nom: 'cours-cree' }, siAbsent: 'emp-nouveau',
      },
      {
        id: 'emp-fin', titre: 'Modifier un cours', page: '/emplois-du-temps',
        texte: 'Cliquez sur un cours de la grille pour le changer ou le supprimer. Les élèves et les professeurs voient la grille dans leur portail.',
        condition: { type: 'lire' },
      },
    ],
  },

  // ─── 11. Présences ────────────────────────────────────────────────────────
  {
    id: 'presences', titre: 'Pointer les présences', icone: 'presences', permission: 'attendance',
    description: 'L\'appel des élèves et les heures des professeurs.',
    etapes: [
      {
        id: 'pre-ouvrir', titre: 'Ouvrez « Gestion Présences »', champs: [{ cible: 'menu:/presences' }],
        texte: 'Cliquez sur Gestion Présences dans le menu de gauche.',
        condition: { type: 'page', chemin: '/presences' },
      },
      {
        id: 'pre-date', titre: 'Choisissez le jour', page: '/presences', champs: [{ cible: 'presences:date' }],
        texte: 'Avec les flèches ou le calendrier. Les cours viennent de l\'emploi du temps ; choisissez un jour qui en a.',
        condition: { type: 'lire' },
      },
      {
        id: 'pre-cours', titre: 'Ouvrez un cours', page: '/presences', champs: [{ cible: 'presences:cours' }],
        texte: 'Cliquez sur le cours à pointer. La pastille dit où en est la saisie : gris = rien, vert = complet.',
        absence: 'Aucun cours ce jour-là : changez de date, ou ajoutez des cours dans l\'emploi du temps.',
        condition: { type: 'visible', cible: 'presences:detail' }, passerVers: 'pre-cloture',
      },
      {
        id: 'pre-prof', titre: 'Le professeur', page: '/presences', champs: [{ cible: 'presences:detail' }],
        texte: 'En haut, le professeur : présent, absent, en retard… puis Enregistrer. Ces heures servent à payer les professeurs à l\'heure : une séance non pointée ne rapporte rien.',
        condition: { type: 'lire' }, siAbsent: 'pre-cours',
      },
      {
        id: 'pre-eleves', titre: 'L\'appel des élèves', importance: 'facultatif', page: '/presences', champs: [{ cible: 'presences:complet' }],
        texte: 'Tous sont présents au départ : ne touchez que les absents et les retards. Quand c\'est juste, cliquez sur « Marquer complet ».',
        absence: 'Cette classe n\'a pas d\'élève, ou l\'appel est déjà marqué complet.',
        condition: { type: 'signal', nom: 'presences-completes' }, passerVers: 'pre-cloture',
      },
      {
        id: 'pre-cloture', titre: 'Bilan et clôture', page: '/presences', champs: [{ cible: 'presences:actions' }],
        texte: '« Bilan Heures » résume les heures de chaque professeur. « Clôturer » verrouille le mois : ne le faites qu\'une fois tout pointé (on peut déverrouiller).',
        condition: { type: 'lire' },
      },
    ],
  },

  // ─── 12. Paiements ────────────────────────────────────────────────────────
  {
    id: 'paiements', titre: 'Encaisser les paiements', icone: 'paiements', permission: 'payments',
    description: 'Fixer les tarifs, encaisser, suivre les impayés.',
    etapes: [
      {
        id: 'pai-ouvrir', titre: 'Ouvrez « Gestion Paiements »', champs: [{ cible: 'menu:/paiements' }],
        texte: 'Cliquez sur Gestion Paiements dans le menu de gauche.',
        condition: { type: 'page', chemin: '/paiements' },
      },
      {
        id: 'pai-config', titre: 'Commencez par « Configuration »', page: '/paiements', champs: [{ cible: 'paiements:config' }],
        texte: 'Sans tarif, il n\'y a rien à encaisser. Cliquez sur Configuration.',
        condition: { type: 'visible', cible: 'services:ajouter' }, passerVers: 'pai-caisse',
      },
      {
        id: 'pai-crayon', titre: 'Le tarif d\'une classe', page: '/paiements', champs: [{ cible: 'tarifs:modifier' }],
        texte: 'Cliquez sur le crayon d\'une classe.',
        absence: 'Aucune classe à régler : créez-en une d\'abord.',
        condition: { type: 'visible', cible: 'tarifs:montants' }, siAbsent: 'pai-config', passerVers: 'pai-services',
      },
      {
        id: 'pai-montants', titre: 'Inscription et mensualité', importance: 'obligatoire', page: '/paiements', champs: [{ cible: 'tarifs:montants', libelle: 'Les deux montants' }],
        texte: 'En FCFA. Mettez 0 si l\'un des deux n\'existe pas chez vous. Les mois s\'affichent ensuite : vous pouvez changer le montant d\'un mois précis.',
        condition: { type: 'rempli' }, siAbsent: 'pai-crayon',
      },
      {
        id: 'pai-enregistrer', titre: 'Enregistrez le tarif', importance: 'obligatoire', page: '/paiements', champs: [{ cible: 'tarifs:enregistrer' }],
        texte: 'Il s\'applique aussitôt à tous les élèves de la classe.',
        condition: { type: 'signal', nom: 'tarif-enregistre' }, siAbsent: 'pai-crayon',
      },
      {
        id: 'pai-services', titre: 'Les services annexes', importance: 'facultatif', page: '/paiements', champs: [{ cible: 'services:ajouter' }],
        texte: 'Cantine, transport, tenue… Un service « obligatoire » est ajouté à chaque élève ; les autres se souscrivent élève par élève dans « Services ».',
        condition: { type: 'lire' }, siAbsent: 'pai-config',
      },
      {
        id: 'pai-caisse', titre: 'La caisse', page: '/paiements', champs: [{ cible: 'paiements:entry' }],
        texte: 'Cliquez sur « Paiement ».',
        condition: { type: 'visible', cible: 'caisse:recherche' }, passerVers: 'pai-suivi',
      },
      {
        id: 'pai-recherche', titre: 'Trouvez l\'élève', page: '/paiements', champs: [{ cible: 'caisse:recherche' }],
        texte: 'Tapez son nom et cliquez dessus : tout ce qu\'il doit apparaît à droite, mois par mois.',
        absence: 'Cliquez sur « Paiement » pour rouvrir la caisse.',
        condition: { type: 'visible', cible: 'caisse:elements' }, siAbsent: 'pai-caisse', passerVers: 'pai-suivi',
      },
      {
        id: 'pai-encaisser', titre: 'Encaisser', importance: 'facultatif', page: '/paiements', champs: [{ cible: 'caisse:elements' }],
        texte: 'Cochez ce que la famille paie, choisissez le mode (espèces, Wave…) et validez : le reçu numéroté s\'ouvre. Pour un acompte, baissez le montant : le reste reste dû.',
        astuce: 'Ne validez que si c\'est un vrai paiement. Une erreur s\'annule dans « Historique », et l\'annulation reste visible.',
        condition: { type: 'signal', nom: 'paiement-enregistre' }, siAbsent: 'pai-recherche', passerVers: 'pai-suivi',
      },
      {
        id: 'pai-suivi', titre: 'Qui n\'a pas payé ?', page: '/paiements', champs: [{ cible: 'paiements:tracking' }],
        texte: '« Suivi » montre qui a payé, qui est en retard, classe par classe.',
        condition: { type: 'lire' },
      },
      {
        id: 'pai-facturation', titre: 'Factures et rappels', page: '/paiements', champs: [{ cible: 'paiements:facturation' }],
        texte: '« Facturation » imprime les factures, les rappels et les fiches de paiement à remettre aux familles.',
        condition: { type: 'lire' },
      },
      {
        id: 'pai-historique', titre: 'Historique et réductions', page: '/paiements', champs: [{ cible: 'paiements:history' }, { cible: 'paiements:reductions' }],
        texte: '« Historique » : tous les paiements, réimpression d\'un reçu, annulation. « Réductions » : un tarif personnel pour un élève.',
        condition: { type: 'lire' },
      },
    ],
  },

  // ─── 13. Le reste ─────────────────────────────────────────────────────────
  {
    id: 'autres', titre: 'Les autres rubriques', icone: 'autres',
    description: 'Salaires, identifiants, documents et site web : à quoi elles servent.',
    etapes: [
      {
        id: 'aut-salaires', titre: 'Ouvrez « Gestion Salaires »', permission: 'payroll', champs: [{ cible: 'menu:/salaires' }],
        texte: 'Cliquez sur Gestion Salaires.',
        condition: { type: 'page', chemin: '/salaires' },
      },
      {
        id: 'aut-salaires-lire', titre: 'La paie', permission: 'payroll', page: '/salaires',
        texte: 'Les professeurs payés à l\'heure y sont calculés sur leurs heures pointées ; les autres à salaire fixe. Vous y enregistrez chaque versement, ainsi que la paie du personnel non enseignant.',
        condition: { type: 'lire' },
      },
      {
        id: 'aut-identifiants', titre: 'Ouvrez « Gestion Identifiants »', permission: 'credentials', champs: [{ cible: 'menu:/identifiants' }],
        texte: 'Cliquez sur Gestion Identifiants.',
        condition: { type: 'page', chemin: '/identifiants' },
      },
      {
        id: 'aut-identifiants-lire', titre: 'Les comptes de connexion', permission: 'credentials', page: '/identifiants', champs: [{ cible: 'identifiants:onglets' }],
        texte: 'Élèves et professeurs : leur identifiant et leur mot de passe, à remettre ou à changer. « Personnel » : le directeur y crée les comptes de la secrétaire, du caissier… et choisit ce que chacun peut ouvrir.',
        condition: { type: 'lire' },
      },
      {
        id: 'aut-documents', titre: 'Ouvrez « Documents »', permission: 'students', mode: 'classique', champs: [{ cible: 'menu:/documents' }],
        texte: 'Cliquez sur Documents.',
        condition: { type: 'page', chemin: '/documents' },
      },
      {
        id: 'aut-documents-lire', titre: 'Certificats et attestations', permission: 'students', mode: 'classique', page: '/documents', champs: [{ cible: 'documents:onglets' }],
        texte: 'Choisissez un modèle et un élève : le document sort rempli. Vous pouvez aussi créer vos propres modèles, ou en importer un depuis Word.',
        condition: { type: 'lire' },
      },
      {
        id: 'aut-site', titre: 'Ouvrez « Site web »', adminOnly: true, champs: [{ cible: 'menu:/site-web' }],
        texte: 'Cliquez sur Site web.',
        condition: { type: 'page', chemin: '/site-web' },
      },
      {
        id: 'aut-site-lire', titre: 'Le site de votre école', adminOnly: true, page: '/site-web',
        texte: 'Un vrai site internet pour votre école, déjà rempli avec vos informations. Vous choisissez un modèle, vous modifiez, vous publiez.',
        condition: { type: 'lire' },
      },
      {
        id: 'aut-fin', titre: 'Vous avez fait le tour', texte: 'Vous pouvez refaire un chapitre quand vous voulez : cliquez sur votre nom, puis « Apprendre SenClass ».',
        condition: { type: 'lire' },
      },
    ],
  },
];
