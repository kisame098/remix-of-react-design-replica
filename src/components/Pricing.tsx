import { motion } from "framer-motion";
import { Check, MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "221706811277";
const WHATSAPP_MESSAGE = "Bonjour, je suis intéressé(e) par SenClass pour mon établissement.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

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

            <ul className="space-y-3 mb-6">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mb-6 px-3 py-2 rounded-lg bg-muted/50 text-xs text-muted-foreground text-center">
              💳 Paiement en ligne bientôt disponible — pour le moment, l'abonnement s'active directement avec nous.
            </div>

            {/* CTA Button */}
            <motion.a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-lg font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Nous contacter sur WhatsApp
            </motion.a>
            <p className="mt-3 text-center text-xs text-muted-foreground">{WHATSAPP_NUMBER.replace(/^221/, "+221 ")}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
