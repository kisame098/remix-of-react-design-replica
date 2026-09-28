// Règles des comptes du personnel, partagées avec la fonction Supabase
// create-staff-account (un seul endroit, testé dans comptePersonnel.test.ts).
export {
  MIN_MOT_DE_PASSE, normaliserEmail, emailValide, verifierComptePersonnel, messageErreurCompte,
} from '../../supabase/functions/create-staff-account/regles';
