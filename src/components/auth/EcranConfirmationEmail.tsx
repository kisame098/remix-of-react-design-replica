import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, MailCheck, RefreshCw } from 'lucide-react';

interface EcranConfirmationEmailProps {
  /** Adresse où le lien de confirmation vient d'être envoyé. */
  email: string;
  envoiEnCours: boolean;
  onRenvoyer: () => void;
  onRetour: () => void;
}

/**
 * Écran affiché après l'inscription d'une école, quand Supabase attend que le
 * directeur confirme son adresse.
 *
 * Il remplace l'ancien message trompeur : le formulaire annonçait « Vérifiez
 * votre email » alors qu'aucun e-mail n'était envoyé, puis renvoyait vers la
 * page de connexion sans explication.
 */
export const EcranConfirmationEmail = ({
  email, envoiEnCours, onRenvoyer, onRetour,
}: EcranConfirmationEmailProps) => (
  <div className="min-h-screen bg-muted/30 flex items-center justify-center p-8">
    <div className="w-full max-w-md">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à l'accueil
      </Link>

      <div className="rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>

        <h1 className="mb-2 text-2xl font-bold text-foreground">Vérifiez votre boîte mail</h1>
        <p className="text-muted-foreground leading-relaxed">
          Votre école est enregistrée. Nous avons envoyé un lien de confirmation à{' '}
          <strong className="font-semibold text-foreground">{email}</strong>. Cliquez dessus pour
          ouvrir votre espace.
        </p>

        <p className="mt-4 text-sm text-muted-foreground">
          L'e-mail n'arrive pas ? Regardez dans vos spams, puis renvoyez-le.
        </p>

        <button
          type="button"
          onClick={onRenvoyer}
          disabled={envoiEnCours}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3
                     text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25
                     transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {envoiEnCours ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          Renvoyer l'e-mail
        </button>

        <button
          type="button"
          onClick={onRetour}
          className="mt-4 text-sm font-medium text-primary hover:underline"
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  </div>
);

export default EcranConfirmationEmail;
