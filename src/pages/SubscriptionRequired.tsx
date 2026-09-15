import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSubscriptionGate } from '@/lib/subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, CreditCard, LogOut } from 'lucide-react';

const GATE_CONTENT: Record<string, { title: string; message: string }> = {
  trial_expired: {
    title: "Période d'essai terminée",
    message: "La période d'essai gratuite de votre établissement est arrivée à son terme.",
  },
  suspended: {
    title: 'Accès suspendu',
    message: "L'abonnement de votre établissement a été suspendu.",
  },
  cancelled: {
    title: 'Accès suspendu',
    message: "L'abonnement de votre établissement a été annulé.",
  },
};

/**
 * Bloque le dashboard admin/staff quand l'école est suspended/cancelled
 * (voir ProtectedRoute.tsx) — jamais pour le portail élève/professeur, qui
 * reste accessible. Seule issue : /abonnement, pour soumettre un paiement.
 */
const SubscriptionRequired = () => {
  const { school, accountRole, signOut } = useAuth();
  const navigate = useNavigate();
  // Seul un admin peut régler l'abonnement (page /abonnement réservée
  // adminOnly) — un staff qui y accéderait rebondirait indéfiniment entre
  // /dashboard et /abonnement-requis, donc on ne lui propose pas ce bouton.
  const isAdmin = accountRole === 'admin';

  const gate = getSubscriptionGate(school?.subscription_status, school?.subscription_expires_at);
  const content = GATE_CONTENT[gate] ?? GATE_CONTENT.suspended;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 flex flex-col items-center text-center gap-4">
          <div className="p-3 rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-foreground">{content.title}</h1>
            <p className="text-sm text-muted-foreground">{content.message}</p>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? 'Réglez votre abonnement pour retrouver l\'accès complet à SenClass.'
                : "Contactez l'administrateur de votre établissement pour régler l'abonnement."}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full pt-2">
            {isAdmin && (
              <Button className="gap-2" onClick={() => navigate('/abonnement')}>
                <CreditCard className="h-4 w-4" />
                Voir l'abonnement
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionRequired;
