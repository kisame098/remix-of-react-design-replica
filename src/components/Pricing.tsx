import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ADRESSE_INSCRIPTION } from "@/lib/contact";

const FEATURES = [
  "Gestion des inscriptions et des dossiers élèves",
  "Bulletins de notes générés automatiquement",
  "Suivi des présences élèves et professeurs",
  "Suivi des paiements et frais de scolarité",
  "Emploi du temps",
  "Portail élève / parent",
  "Démonstration et formation de votre équipe sur place",
];

const Pricing = () => {
  const navigate = useNavigate();

  return (
    <section id="tarifs" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Un tarif simple et transparent
          </h2>
          <p className="text-muted-foreground">
            Un seul prix, pas de frais cachés. Contactez-nous, on se déplace pour vous présenter le produit.
          </p>
        </motion.div>

        {/* Pricing Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-md mx-auto"
        >
          <div className="relative bg-background rounded-2xl p-8 border-2 border-primary shadow-lg shadow-primary/10">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-foreground mb-2">Abonnement SenClass</h3>
              <p className="text-sm text-muted-foreground">Pour tout établissement, quelle que soit sa taille.</p>
            </div>

            <div className="mb-6">
              <span className="text-3xl font-bold text-foreground">25.000 FCFA</span>
              <span className="text-muted-foreground">/mois</span>
            </div>

            <ul className="space-y-3 mb-8">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Abonnement en libre-service : l'école crée d'abord son compte,
                puis active l'abonnement depuis son espace (page Abonnement),
                où le paiement l'active immédiatement. */}
            <motion.button
              type="button"
              onClick={() => navigate(ADRESSE_INSCRIPTION)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-lg font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            >
              S'abonner
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
