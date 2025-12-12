import { motion } from "framer-motion";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Essentiel",
    description: "Pour les petites écoles maternelles et primaires.",
    price: "25.000 FCFA",
    period: "mois",
    features: [
      "Jusqu'à 200 élèves",
      "Gestion des inscriptions",
      "Bulletins de notes",
      "Support par email",
    ],
    popular: false,
    cta: "Choisir ce plan",
  },
  {
    name: "Pro",
    description: "L'offre la plus populaire pour les collèges et lycées.",
    price: "50.000 FCFA",
    period: "mois",
    features: [
      "Jusqu'à 1000 élèves",
      "Tout du plan Essentiel",
      "Paiements & Comptabilité",
      "SMS aux parents (500 offerts)",
      "Support prioritaire WhatsApp",
    ],
    popular: true,
    cta: "Choisir ce plan",
  },
  {
    name: "Réseau",
    description: "Pour les groupes scolaires et universités.",
    price: "Sur Devis",
    period: "",
    features: [
      "Élèves illimités",
      "Multi-établissements",
      "Application mobile personnalisée",
      "Formation sur site",
      "Gestionnaire de compte dédié",
    ],
    popular: false,
    cta: "Choisir ce plan",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

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
            Des tarifs transparents et adaptés
          </h2>
          <p className="text-muted-foreground">
            Pas de frais cachés. Choisissez l'offre qui correspond à la taille de votre école.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className={`relative bg-background rounded-2xl p-8 border-2 transition-shadow ${
                plan.popular
                  ? "border-primary shadow-lg shadow-primary/10"
                  : "border-border hover:shadow-md"
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 text-xs font-semibold text-primary-foreground bg-primary rounded-full">
                    POPULAIRE
                  </span>
                </div>
              )}

              {/* Plan Info */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                {plan.period && (
                  <span className="text-muted-foreground">/{plan.period}</span>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-foreground hover:bg-muted/80 border border-border"
                }`}
              >
                {plan.cta}
              </motion.button>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
