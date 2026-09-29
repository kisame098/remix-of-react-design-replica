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
  "Il ne contient pas les classes, les élèves, les notes ni les paiements. Les matières de l'élémentaire (CI à CM2) utilisent un barème de points géré à part et ne sont pas dans ce fichier.",
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
  `Élémentaire : ${NIVEAUX_ELEMENTAIRE.join(', ')} (hors de ce fichier, voir plus haut).`,
  `Collège : ${NIVEAUX_COLLEGE.join(', ')}.`,
  `Lycée : ${NIVEAUX_LYCEE.join(', ')}.`,
  '',
  'LES DEUX PARTIES DU FICHIER',
  '"niveauDefaults" : les matières communes à tous les élèves d\'un niveau.',
  '  Une ligne = { "niveau": "4ème", "name": "Mathématiques", "coefficient": 3, "isFacultative": false }.',
  '  isFacultative = true pour une matière optionnelle.',
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
  '- Matières de niveau : ajoutées ; une matière déjà présente (même niveau + même nom) est laissée telle quelle, jamais écrasée.',
  "- Cursus : chaque cursus du fichier est CRÉÉ comme nouveau cursus. Si l'école a déjà un cursus du même nom, il y aura un doublon : ne mettre dans le fichier que les cursus à créer, ou supprimer l'ancien cursus avant l'import.",
  '- Rien n\'est supprimé par un import.',
];
