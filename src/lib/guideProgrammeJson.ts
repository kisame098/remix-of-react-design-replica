// ═══════════════════════════════════════════════════════════════════════════
// Mode d'emploi placé EN TÊTE du fichier JSON exporté depuis Cursus
// (programme : matières par niveau et cursus/séries).
//
// Le JSON n'accepte pas de commentaires : l'explication est un champ
// « _LISEZ_MOI » (tableau de lignes) que l'import ignore. Une école peut
// donner le fichier à une IA, qui lit le mode d'emploi, modifie le
// programme, et rend un fichier que SenClass réimporte tel quel.
// Les niveaux cités viennent du code : le guide ne peut pas les contredire.
// ═══════════════════════════════════════════════════════════════════════════
import { NIVEAUX_ELEMENTAIRE } from '@/lib/elementaryDefaults';

const NIVEAUX_COLLEGE = ['6ème', '5ème', '4ème', '3ème'];
const NIVEAUX_LYCEE = ['2nde', '1ère', 'Tle'];

export const CLE_GUIDE = '_LISEZ_MOI';

export const guideProgrammeJson = (): string[] => [
  "FICHIER DE PROGRAMME SENCLASS — mode d'emploi (ce champ est ignoré à l'import).",
  '',
  'À QUOI SERT CE FICHIER',
  "Il contient le programme de l'école : les matières de chaque niveau (avec coefficient) et les cursus/séries (S1, S2, L…) avec leurs matières. On peut le modifier (à la main ou avec une IA) puis le réimporter dans SenClass : Cursus → Importer.",
  "Il ne contient pas les classes, les élèves, les notes ni les paiements.",
  '',
  'CONSIGNES POUR UNE IA QUI MODIFIE CE FICHIER',
  '1. Rendre un JSON strictement valide : pas de commentaires, pas de virgule finale, guillemets droits ".',
  '2. Garder "type": "teranga_school_programme_export" et "version": 1 tels quels.',
  '3. Ne jamais ajouter d\'identifiants (id) : SenClass les crée lui-même.',
  '4. Écrire les niveaux EXACTEMENT comme dans la liste ci-dessous (accents compris).',
  '5. "coefficient" est un nombre (1, 2, 3, 0.5…). "isFacultative" est true ou false.',
  '6. Le champ "_LISEZ_MOI" peut être gardé ou supprimé : il est ignoré.',
  '',
  'NIVEAUX RECONNUS',
  `Élémentaire : ${NIVEAUX_ELEMENTAIRE.join(', ')} (UNIQUEMENT dans "elementaireDefaults").`,
  `Collège : ${NIVEAUX_COLLEGE.join(', ')}.`,
  `Lycée : ${NIVEAUX_LYCEE.join(', ')}.`,
  'Maternelle (PS, MS, GS) : aucune matière, ne jamais l\'écrire dans ce fichier.',
  '',
  'LES TROIS PARTIES DU FICHIER',
  '"niveauDefaults" : les matières communes à tous les élèves d\'un niveau du COLLÈGE ou du LYCÉE (jamais CI à CM2).',
  '  Une ligne = { "niveau": "4ème", "name": "Mathématiques", "coefficient": 3, "isFacultative": false }.',
  '  isFacultative = true pour une matière optionnelle.',
  '"elementaireDefaults" : les matières de l\'ÉLÉMENTAIRE (CI à CM2), notées sur un barème de points, sans coefficient.',
  '  Une ligne = { "niveau": "CE1", "domaine": "LC", "registre": "COMPETENCE", "name": "Anglais", "pointMax": 10 }.',
  '  "domaine" : LC (Langue et Communication), MATH (Mathématiques), ESVS (Science et Vie Sociale), EPSA (Physique, Sportive et Artistique).',
  '  "registre" : RESSOURCES ou COMPETENCE. "pointMax" : la note maximale (10, 20…).',
  '"filieres" : les cursus/séries (surtout au lycée).',
  '  "name" : le nom du cursus (ex. "S2"). "description" : texte libre ou null.',
  '  "niveaux" : les niveaux où ce cursus existe (ex. ["1ère", "Tle"]).',
  '  "mandatorySubjects" : matières obligatoires du cursus { "niveau", "name", "coefficient" }.',
  '     "niveau": "" = la matière vaut pour TOUS les niveaux du cursus ; un niveau précis = seulement ce niveau.',
  '  "facultativeSubjects" : matières facultatives du cursus, même forme.',
  '  "choiceGroups" : un créneau où l\'élève choisit UNE matière parmi plusieurs (ex. LV2).',
  '     { "niveau": "", "label": "LV2", "coefficient": 2, "options": ["Espagnol", "Arabe", "Allemand"] }.',
  '  Un cursus qui porte le nom d\'un niveau et ne couvre que ce niveau (ex. name "3ème", niveaux ["3ème"]) sert aux matières propres à ce niveau : le garder tel quel.',
  '',
  "CE QUE FAIT L'IMPORT",
  '- Il AJOUTE ce qui manque : rien n\'est supprimé, et rien d\'existant n\'est modifié (un coefficient déjà enregistré reste tel quel).',
  "- Un cursus qui existe déjà (même nom) est COMPLÉTÉ : niveaux, matières, créneaux au choix et options manquants. On peut donc réimporter le fichier entier après l'avoir modifié.",
  '- Pour CHANGER un coefficient ou SUPPRIMER une matière existante, le faire dans SenClass (Cursus), pas par ce fichier.',
  '- Une ligne incorrecte (niveau inconnu, élémentaire dans "niveauDefaults"…) est ignorée et signalée ; le reste est importé.',
  "- Après l'import, utiliser « Appliquer aux classes existantes » (dans Cursus, sur chaque niveau) pour mettre à jour les classes déjà créées.",
];
