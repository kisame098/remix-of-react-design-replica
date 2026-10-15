/**
 * TOUT le contenu du site, au même endroit : textes, photos, couleurs,
 * coordonnées. Chaque valeur se modifie d'un clic sur le site (mode
 * modification) ; ce fichier n'est que le modèle de départ.
 *
 * Les noms, chiffres, montants et coordonnées sont des EXEMPLES à remplacer
 * par l'école. Photos : Unsplash (licence libre, usage commercial permis).
 */

const photo = (id: string, largeur = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${largeur}&q=80`;
const portrait = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&h=700&crop=faces&q=80`;

/** Modèles de site : même contenu, présentation complètement différente. */
export const MODELES_SITE = {
  institution: { nom: 'Institution', description: 'Classique et solennel : photos plein écran, titres à empattements.', couleurs: ['#0B5D3B', '#E8A317'] },
  teranga: { nom: 'Teranga', description: 'Moderne et chaleureux : fond crème, grands titres, motifs inspirés du wax.', couleurs: ['#B4441C', '#0E5E5A'] },
} as const;
export type ModeleSite = keyof typeof MODELES_SITE;

export const POLICES = {
  classique: { nom: 'Classique', titres: "'Playfair Display', Georgia, serif", texte: "'Inter', system-ui, sans-serif" },
  moderne:   { nom: 'Moderne',   titres: "'Poppins', system-ui, sans-serif",    texte: "'Inter', system-ui, sans-serif" },
  elegante:  { nom: 'Élégante',  titres: "'Cormorant Garamond', Georgia, serif", texte: "'Source Sans 3', system-ui, sans-serif" },
} as const;
export type Police = keyof typeof POLICES;

export interface LienBouton { texte: string; lien: string }

export const TYPES_RESEAUX = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn',
  x: 'X (Twitter)', whatsapp: 'Chaîne WhatsApp', telegram: 'Telegram', site: 'Autre lien',
} as const;
export type TypeReseau = keyof typeof TYPES_RESEAUX;
export interface Reseau { type: TypeReseau; url: string }

export interface Actualite { id: string; image: string; date: string; categorie: string; titre: string; texte: string; contenu: string }

export const CONTENU_DEFAUT = {
  identite: {
    modele: 'institution' as ModeleSite,
    nom: 'Groupe Scolaire Excellence',
    slogan: 'Discipline · Travail · Réussite',
    logo: '',
    couleur1: '#0B5D3B',
    couleur2: '#E8A317',
    police: 'classique' as Police,
    telephone: '+221 33 000 00 00',
    whatsapp: '+221 77 000 00 00',
    email: 'contact@ecole-exemple.sn',
    adresse: 'Sacré-Cœur 3, Dakar, Sénégal',
    horaires: 'Lun – Ven : 7 h 30 – 18 h · Sam : 8 h – 13 h',
    /** Message déjà écrit quand un visiteur clique sur un bouton WhatsApp. */
    messageWhatsApp: 'Bonjour, je souhaite avoir des informations sur l\'école.',
    reseaux: [
      { type: 'facebook', url: 'https://www.facebook.com/' },
      { type: 'instagram', url: 'https://www.instagram.com/' },
      { type: 'tiktok', url: 'https://www.tiktok.com/' },
    ] as Reseau[],
    /** Afficher le fil de la page Facebook dans la section « Suivez-nous ». */
    filFacebook: true,
    espaceParents: { texte: 'Espace parents', lien: 'https://senclass.com' } as LienBouton,
    creation: '2005',
  },

  annonce: {
    texte: 'Inscriptions ouvertes pour l\'année scolaire 2026-2027 : places limitées dans certaines classes.',
    bouton: { texte: 'S\'inscrire', lien: '#/admissions' } as LienBouton,
  },

  /** Ordre des sections de chaque page : on les glisse, on les retire, on en ajoute. */
  pages: {
    accueil: ['diaporama', 'chiffres', 'mot-directeur', 'cycles', 'atouts', 'resultats', 'temoignages', 'actualites-recentes', 'suivez-nous', 'appel'],
    ecole: ['entete-ecole', 'histoire', 'valeurs', 'equipe', 'infrastructures', 'appel'],
    enseignement: ['entete-enseignement', 'cycles-detail', 'pedagogie', 'resultats', 'appel'],
    'vie-scolaire': ['entete-vie-scolaire', 'activites', 'services', 'galerie', 'calendrier', 'appel'],
    admissions: ['entete-admissions', 'etapes', 'pieces', 'frais', 'preinscription', 'faq'],
    actualites: ['entete-actualites', 'liste-actualites', 'suivez-nous'],
    contact: ['entete-contact', 'coordonnees', 'suivez-nous'],
  } as Record<string, string[]>,

  accueil: {
    diapos: [
      {
        image: photo('photo-1567057419565-4349c49d8a04'),
        surtitre: 'Bienvenue au Groupe Scolaire Excellence',
        titre: 'Former des esprits brillants et des citoyens responsables',
        texte: 'Du préscolaire au baccalauréat, un enseignement de qualité dans un cadre sûr, discipliné et bienveillant.',
      },
      {
        image: photo('photo-1694286068561-3233c946e9be'),
        surtitre: 'Préscolaire et élémentaire',
        titre: 'Les premiers pas de votre enfant entre de bonnes mains',
        texte: 'Des classes à effectif réduit et des enseignants attentifs à chaque élève.',
      },
      {
        image: photo('photo-1774870292182-d59afbebf09e'),
        surtitre: 'Moyen et secondaire',
        titre: 'Préparer le BFEM et le Baccalauréat avec sérénité',
        texte: 'Suivi personnalisé, examens blancs, cours de renforcement et orientation.',
      },
    ],
    bouton1: { texte: 'Inscrire mon enfant', lien: '#/admissions' } as LienBouton,
    bouton2: { texte: 'Découvrir l\'école', lien: '#/ecole' } as LienBouton,

    chiffres: [
      { valeur: '20', libelle: 'ans d\'expérience' },
      { valeur: '1 200', libelle: 'élèves' },
      { valeur: '65', libelle: 'enseignants qualifiés' },
      { valeur: '96 %', libelle: 'de réussite au BFEM' },
    ],

    mot: {
      surtitre: 'Mot du directeur',
      titre: 'Une école où chaque enfant compte',
      texte: 'Chers parents, chers élèves,\n\nDepuis sa création, notre établissement s\'est donné pour mission d\'offrir à chaque enfant un enseignement exigeant, fondé sur la discipline, le travail et le respect de nos valeurs.\n\nNous croyons qu\'un élève bien encadré peut aller très loin. C\'est pourquoi nos équipes accompagnent chacun, de ses premiers pas au préscolaire jusqu\'au baccalauréat.\n\nSoyez les bienvenus dans notre grande famille.',
      image: portrait('photo-1616805765352-beedbad46b2a'),
      nom: 'M. Mamadou Diop',
      fonction: 'Directeur général',
    },

    cycles: {
      surtitre: 'Nos cycles',
      titre: 'Un parcours complet, du préscolaire au Bac',
      texte: 'Votre enfant grandit dans le même établissement, avec une pédagogie adaptée à chaque âge.',
    },

    atouts: {
      surtitre: 'Pourquoi nous choisir',
      titre: 'Ce qui fait la différence',
      elements: [
        { icone: 'users', titre: 'Effectifs maîtrisés', texte: 'Des classes à taille humaine pour un vrai suivi de chaque élève.' },
        { icone: 'award', titre: 'Excellents résultats', texte: 'Des taux de réussite au CFEE, au BFEM et au Bac parmi les meilleurs.' },
        { icone: 'shield', titre: 'Cadre sûr et discipliné', texte: 'Établissement gardé, règlement intérieur clair, valeurs affirmées.' },
        { icone: 'globe', titre: 'Langues renforcées', texte: 'Anglais dès le préscolaire, arabe et espagnol au moyen.' },
        { icone: 'laptop', titre: 'Salle informatique', texte: 'Initiation au numérique et à la bureautique à tous les niveaux.' },
        { icone: 'bus', titre: 'Transport et cantine', texte: 'Ramassage scolaire dans plusieurs quartiers et repas équilibrés.' },
      ],
    },

    resultats: {
      surtitre: 'Nos résultats',
      titre: 'Résultats aux examens officiels',
      texte: 'Session 2026',
      elements: [
        { examen: 'CFEE', taux: '100 %', detail: 'Entrée en 6e : 98 %' },
        { examen: 'BFEM', taux: '96 %', detail: '12 mentions Bien et Très bien' },
        { examen: 'Baccalauréat', taux: '89 %', detail: 'Séries L et S' },
      ],
    },

    temoignages: {
      surtitre: 'Témoignages',
      titre: 'Ils nous font confiance',
      elements: [
        { texte: 'Mes deux enfants sont ici depuis le CI. Le suivi est sérieux et les enseignants sont toujours disponibles pour échanger avec les parents.', nom: 'Mme Fatou Ndiaye', role: 'Parent d\'élèves', photo: portrait('photo-1505421031134-e57263cae630') },
        { texte: 'L\'encadrement pendant l\'année du BFEM a fait la différence : examens blancs, cours de renforcement, et une vraie motivation.', nom: 'Cheikh Fall', role: 'Ancien élève, promotion 2024', photo: portrait('photo-1654125992479-37dc114b3a5c') },
        { texte: 'Une école disciplinée où les valeurs comptent autant que les notes. Je la recommande à toutes les familles.', nom: 'Mme Aïssatou Sow', role: 'Parent d\'élève', photo: portrait('photo-1561406636-b80293969660') },
      ],
    },

    actualites: { surtitre: 'Actualités', titre: 'La vie de l\'école' },

    suivez: {
      surtitre: 'Suivez-nous',
      titre: 'Restez connectés à la vie de l\'école',
      texte: 'Photos, annonces et événements : retrouvez-nous sur nos réseaux.',
    },

    appel: {
      titre: 'Inscriptions 2026-2027 ouvertes',
      texte: 'Réservez dès maintenant la place de votre enfant. Notre équipe vous accueille du lundi au samedi.',
      bouton1: { texte: 'Préinscription', lien: '#/admissions' } as LienBouton,
      bouton2: { texte: 'Nous contacter', lien: '#/contact' } as LienBouton,
    },
  },

  ecole: {
    entete: { titre: 'Notre école', texte: 'Une histoire, des valeurs, une équipe.', image: photo('photo-1632215861513-130b66fe97f4') },
    histoire: {
      surtitre: 'Notre histoire',
      titre: 'Plus de vingt ans au service de l\'éducation',
      texte: 'Fondé en 2005 avec une seule classe de préscolaire, le Groupe Scolaire Excellence accueille aujourd\'hui plus de mille élèves, du préscolaire au baccalauréat.\n\nNotre croissance repose sur la confiance des familles et sur un principe simple : exiger beaucoup de chaque élève, et lui donner les moyens de réussir.',
      image: photo('photo-1473649085228-583485e6e4d7', 1200),
    },
    valeurs: {
      surtitre: 'Nos valeurs',
      titre: 'Ce en quoi nous croyons',
      elements: [
        { icone: 'book', titre: 'Excellence', texte: 'Viser haut dans chaque matière et donner le meilleur de soi.' },
        { icone: 'scale', titre: 'Discipline', texte: 'Ponctualité, tenue correcte et respect du règlement.' },
        { icone: 'heart', titre: 'Respect', texte: 'Envers les camarades, les enseignants et notre culture.' },
        { icone: 'handshake', titre: 'Solidarité', texte: 'La « teranga » au quotidien : entraide et partage.' },
      ],
    },
    equipe: {
      surtitre: 'Notre équipe',
      titre: 'L\'équipe de direction',
      elements: [
        { photo: portrait('photo-1616805765352-beedbad46b2a'), nom: 'M. Mamadou Diop', fonction: 'Directeur général' },
        { photo: portrait('photo-1743871698163-a2e470d8eac7'), nom: 'Mme Awa Sarr', fonction: 'Directrice des études' },
        { photo: portrait('photo-1654125992479-37dc114b3a5c'), nom: 'M. Ousmane Ba', fonction: 'Surveillant général' },
        { photo: portrait('photo-1573497019418-b400bb3ab074'), nom: 'Mme Khady Gueye', fonction: 'Directrice du préscolaire' },
      ],
    },
    infrastructures: {
      surtitre: 'Nos infrastructures',
      titre: 'Un cadre pensé pour apprendre',
      elements: [
        { image: photo('photo-1567057420215-0afa9aa9253a', 900), titre: 'Salles de classe', texte: 'Spacieuses, ventilées et équipées.' },
        { image: photo('photo-1653566031471-85365f8d0ae0', 900), titre: 'Salle informatique', texte: 'Postes connectés pour tous les niveaux.' },
        { image: photo('photo-1758061335235-a5ad2b63598d', 900), titre: 'Cour ombragée', texte: 'Un espace de récréation sûr et surveillé.' },
        { image: photo('photo-1745012010615-47abbeb3e906', 900), titre: 'Terrain de sport', texte: 'Football, basket et athlétisme.' },
      ],
    },
  },

  enseignement: {
    entete: { titre: 'Enseignement', texte: 'Programmes officiels du Sénégal, renforcés.', image: photo('photo-1698827623362-f10eadf55a18') },
    cycles: [
      {
        image: photo('photo-1567057420215-0afa9aa9253a', 1000),
        nom: 'Préscolaire',
        niveaux: 'Petite, Moyenne et Grande section',
        age: 'De 3 à 5 ans',
        texte: 'Éveil, langage, motricité et premiers apprentissages dans un cadre chaleureux et sécurisé.',
        points: ['Effectif réduit par classe', 'Initiation à l\'anglais', 'Activités artistiques et motricité'],
      },
      {
        image: photo('photo-1473649085228-583485e6e4d7', 1000),
        nom: 'Élémentaire',
        niveaux: 'Du CI au CM2',
        age: 'De 6 à 11 ans',
        texte: 'Lecture, écriture, calcul et ouverture au monde. Préparation sérieuse au CFEE et à l\'entrée en 6e.',
        points: ['Préparation au CFEE', 'Études surveillées', 'Anglais et informatique'],
      },
      {
        image: photo('photo-1548102249-acdce64fffbd', 1000),
        nom: 'Moyen',
        niveaux: 'De la 6e à la 3e',
        age: 'De 12 à 15 ans',
        texte: 'Consolidation des savoirs, méthodes de travail et préparation intensive au BFEM.',
        points: ['Examens blancs du BFEM', 'Cours de renforcement', 'Anglais, arabe, espagnol'],
      },
      {
        image: photo('photo-1655720348590-c739c860beed', 1000),
        nom: 'Secondaire',
        niveaux: 'De la Seconde à la Terminale · Séries L et S',
        age: 'De 16 à 18 ans',
        texte: 'Spécialisation, rigueur et orientation pour réussir le Baccalauréat et l\'enseignement supérieur.',
        points: ['Bac blanc chaque trimestre', 'Orientation post-bac', 'Travaux pratiques en sciences'],
      },
    ],
    pedagogie: {
      surtitre: 'Notre pédagogie',
      titre: 'Une méthode qui fait ses preuves',
      elements: [
        { icone: 'chart', titre: 'Évaluations régulières', texte: 'Compositions, devoirs et bulletins pour suivre les progrès.' },
        { icone: 'users', titre: 'Suivi personnalisé', texte: 'Les élèves en difficulté sont repérés tôt et accompagnés.' },
        { icone: 'message', titre: 'Lien avec les parents', texte: 'Notes, absences et paiements consultables en ligne.' },
        { icone: 'clock', titre: 'Études surveillées', texte: 'Après les cours, un encadrement pour les devoirs.' },
      ],
    },
  },

  vieScolaire: {
    entete: { titre: 'Vie scolaire', texte: 'Apprendre, s\'épanouir, grandir ensemble.', image: photo('photo-1632932693914-89b90ae3d16d') },
    activites: {
      surtitre: 'Activités',
      titre: 'Au-delà de la salle de classe',
      elements: [
        { image: photo('photo-1745012010615-47abbeb3e906', 900), titre: 'Sport', texte: 'Football, basket, athlétisme et tournois inter-écoles.' },
        { image: photo('photo-1653566031471-85365f8d0ae0', 900), titre: 'Club informatique', texte: 'Bureautique, programmation et usage responsable d\'Internet.' },
        { image: photo('photo-1694286068561-3233c946e9be', 900), titre: 'Club lecture', texte: 'Bibliothèque, concours de lecture et d\'orthographe.' },
        { image: photo('photo-1740986188963-f99c42d5bad4', 900), titre: 'Sorties pédagogiques', texte: 'Musées, île de Gorée, parcs et entreprises.' },
      ],
    },
    services: {
      surtitre: 'Services',
      titre: 'Pour faciliter le quotidien des familles',
      elements: [
        { icone: 'utensils', titre: 'Cantine', texte: 'Repas équilibrés préparés chaque jour.' },
        { icone: 'bus', titre: 'Transport scolaire', texte: 'Ramassage matin et soir dans plusieurs quartiers.' },
        { icone: 'heart', titre: 'Infirmerie', texte: 'Premiers soins et suivi de la santé des élèves.' },
        { icone: 'clock', titre: 'Garderie', texte: 'Accueil des plus petits avant et après les cours.' },
      ],
    },
    galerie: {
      surtitre: 'Galerie',
      titre: 'En images',
      elements: [
        { image: photo('photo-1567057419565-4349c49d8a04', 900) },
        { image: photo('photo-1548102249-acdce64fffbd', 900) },
        { image: photo('photo-1745012010615-47abbeb3e906', 900) },
        { image: photo('photo-1694286068561-3233c946e9be', 900) },
        { image: photo('photo-1744809448493-448812255e4d', 900) },
        { image: photo('photo-1632215861513-130b66fe97f4', 900) },
        { image: photo('photo-1567057420215-0afa9aa9253a', 900) },
        { image: photo('photo-1653566031471-85365f8d0ae0', 900) },
      ],
    },
    calendrier: {
      surtitre: 'Calendrier',
      titre: 'Les grandes dates de l\'année',
      elements: [
        { date: 'Octobre', evenement: 'Rentrée des classes' },
        { date: 'Décembre', evenement: 'Compositions du 1er trimestre et fête de fin d\'année' },
        { date: 'Mars', evenement: 'Compositions du 2e trimestre · Semaine culturelle' },
        { date: 'Mai', evenement: 'Examens blancs (CFEE, BFEM, Bac)' },
        { date: 'Juin – Juillet', evenement: 'Examens officiels et remise des prix' },
      ],
    },
  },

  admissions: {
    entete: { titre: 'Admissions', texte: 'Inscrire votre enfant, étape par étape.', image: photo('photo-1548102249-acdce64fffbd') },
    etapes: {
      surtitre: 'Comment s\'inscrire',
      titre: 'Quatre étapes simples',
      elements: [
        { titre: 'Prise de contact', texte: 'Venez nous voir, appelez-nous ou envoyez la préinscription en ligne.' },
        { titre: 'Dépôt du dossier', texte: 'Déposez les pièces demandées au secrétariat.' },
        { titre: 'Test de niveau', texte: 'Un court test et un entretien pour bien placer votre enfant.' },
        { titre: 'Inscription', texte: 'Réglez les frais d\'inscription : la place est confirmée.' },
      ],
    },
    pieces: {
      titre: 'Pièces à fournir',
      elements: [
        'Extrait d\'acte de naissance',
        'Bulletins de l\'année précédente',
        'Certificat de scolarité ou exeat',
        '4 photos d\'identité récentes',
        'Carnet de vaccination (préscolaire)',
        'Photocopie de la pièce d\'identité du parent',
      ],
    },
    frais: {
      surtitre: 'Frais de scolarité',
      titre: 'Tarifs 2026-2027',
      texte: 'Montants en francs CFA. La mensualité est due d\'octobre à juillet.',
      elements: [
        { niveau: 'Préscolaire', inscription: '40 000 F', mensualite: '30 000 F' },
        { niveau: 'Élémentaire', inscription: '45 000 F', mensualite: '35 000 F' },
        { niveau: 'Moyen', inscription: '50 000 F', mensualite: '40 000 F' },
        { niveau: 'Secondaire', inscription: '55 000 F', mensualite: '45 000 F' },
      ],
      note: 'Réduction à partir du troisième enfant inscrit. Tenue scolaire et fournitures non comprises.',
    },
    paiement: {
      titre: 'Moyens de paiement',
      elements: ['Espèces au secrétariat', 'Wave', 'Orange Money', 'Virement bancaire'],
    },
    formulaire: {
      titre: 'Préinscription en ligne',
      texte: 'Remplissez ce formulaire : il nous parvient directement sur WhatsApp et nous vous rappelons rapidement.',
    },
    faq: {
      surtitre: 'Questions fréquentes',
      titre: 'Vous vous demandez peut-être…',
      elements: [
        { question: 'Peut-on inscrire un enfant en cours d\'année ?', reponse: 'Oui, dans la limite des places disponibles, après un test de niveau.' },
        { question: 'La tenue scolaire est-elle obligatoire ?', reponse: 'Oui. Elle est disponible au secrétariat dès l\'inscription.' },
        { question: 'Comment suivre les notes de mon enfant ?', reponse: 'Chaque parent reçoit un accès à l\'espace parents pour consulter notes, absences et paiements.' },
        { question: 'Proposez-vous le transport scolaire ?', reponse: 'Oui, dans plusieurs quartiers. Renseignez-vous au secrétariat pour les trajets et tarifs.' },
      ],
    },
  },

  actualites: {
    entete: { titre: 'Actualités', texte: 'Événements, résultats et vie de l\'établissement.', image: photo('photo-1632215863479-201029d93143') },
    elements: [
      {
        id: 'resultats-bac-2026', image: photo('photo-1621352152645-61f4835b081b', 1400), date: '20 juillet 2026', categorie: 'Résultats',
        titre: 'Excellents résultats au Baccalauréat 2026', texte: 'Félicitations à nos bacheliers ! 89 % de réussite et plusieurs mentions.',
        contenu: '<p>Les résultats du <strong>Baccalauréat 2026</strong> sont tombés, et nos élèves ont une nouvelle fois fait honneur à l\'établissement.</p><h2>Les chiffres de la session</h2><ul><li><strong>89 %</strong> de réussite toutes séries confondues</li><li>Série S : 92 % · Série L : 86 %</li><li>14 mentions, dont 3 mentions Très bien</li></ul><p>Ce succès est celui des élèves, de leurs familles et de toute l\'équipe pédagogique, mobilisée toute l\'année : cours de renforcement, Bac blancs chaque trimestre et suivi personnalisé.</p><blockquote><p>« Nous sommes fiers de nos élèves. Ces résultats récompensent une année de travail sérieux. » — La direction</p></blockquote><p>La cérémonie de remise des prix aura lieu à la rentrée. Les familles recevront une invitation.</p>',
      },
      {
        id: 'tournoi-inter-ecoles', image: photo('photo-1745012010615-47abbeb3e906', 1400), date: '15 juin 2026', categorie: 'Sport',
        titre: 'Nos cadets remportent le tournoi inter-écoles', texte: 'Une belle victoire en finale, fruit d\'une saison de travail.',
        contenu: '<p>Notre équipe de football des cadets a remporté la finale du tournoi inter-écoles, au terme d\'un match disputé.</p><p>Bravo aux joueurs et à leur encadreur pour cette saison exemplaire, où le fair-play a été aussi remarqué que le jeu.</p>',
      },
      {
        id: 'semaine-culturelle', image: photo('photo-1694286068561-3233c946e9be', 1400), date: '28 mars 2026', categorie: 'Vie scolaire',
        titre: 'Semaine culturelle : lecture, théâtre et danse', texte: 'Une semaine riche en découvertes pour tous les élèves.',
        contenu: '<p>Pendant une semaine, les élèves de tous les cycles ont présenté leurs talents : concours de lecture, pièces de théâtre, poésie et danses traditionnelles.</p><p>Merci aux parents venus nombreux pour la journée de clôture.</p>',
      },
    ] as Actualite[],
  },

  contact: {
    entete: { titre: 'Contact', texte: 'Nous sommes à votre écoute.', image: photo('photo-1632215865645-3efa9af21424') },
    titre: 'Écrivez-nous',
    texte: 'Votre message nous parvient directement sur WhatsApp. Nous répondons dans la journée.',
  },

  pied: {
    texte: 'Un établissement d\'enseignement privé laïc reconnu par l\'État, du préscolaire au baccalauréat.',
  },
};

export type Contenu = typeof CONTENU_DEFAUT;
