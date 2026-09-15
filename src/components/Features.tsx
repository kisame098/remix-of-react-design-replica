import { motion } from "framer-motion";
import { Users, BookOpen, CreditCard, ClipboardCheck, Shield, Headphones } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Gestion des Inscriptions",
    description: "Gérez les dossiers élèves, les réinscriptions et les documents administratifs en un clic.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: BookOpen,
    title: "Notes et Bulletins",
    description: "Génération automatique des bulletins, calcul des moyennes et classements instantanés.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: CreditCard,
    title: "Paiements Simplifiés",
    description: "Encaissement rapide (espèces, Wave, Orange Money), suivi des impayés et relances automatiques.",
    color: "bg-green-50 text-green-600",
  },
  {
    icon: ClipboardCheck,
    title: "Suivi des Présences",
    description: "Enregistrez les absences et retards des élèves comme des professeurs, en un clic par créneau.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: Shield,
    title: "Sécurité Maximale",
    description: "Vos données sont hébergées en sécurité avec des sauvegardes quotidiennes automatiques.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Headphones,
    title: "Support Dédié",
    description: "Une équipe basée à Dakar disponible par téléphone et WhatsApp pour vous aider.",
    color: "bg-primary/10 text-primary",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

const Features = () => {
  return (
    <section id="fonctionnalites" className="py-20 bg-muted/50">
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
            Tout ce dont vous avez besoin pour réussir
          </h2>
          <p className="text-muted-foreground">
            Une suite complète d'outils pour digitaliser votre établissement, de l'inscription à la remise des diplômes.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="bg-background rounded-xl p-6 shadow-sm border border-border hover:shadow-md transition-shadow"
            >
              <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
