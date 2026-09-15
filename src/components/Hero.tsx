import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-classroom.jpg";
import { ADRESSE_INSCRIPTION, lienWhatsApp } from "@/lib/contact";

const MESSAGE_DEMO = "Bonjour, je souhaite une démonstration de SenClass pour mon école.";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24 bg-background overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Badge */}
            {/* Titre principal de la page (h1) : il porte le mot-clé que tapent
                les directeurs d'école sur Google — tous les concurrents l'ont.
                Visuellement, c'est toujours le badge ; le slogan en dessous
                garde sa taille, il n'est simplement plus le h1. */}
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 text-sm font-medium text-primary bg-accent rounded-full"
            >
              <span className="text-primary" aria-hidden="true">🎓</span>
              <span>Logiciel de gestion scolaire au Sénégal</span>
            </motion.h1>

            {/* Title */}
            <p className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              <span className="text-secondary">L'Excellence</span>
              <br />
              <span className="text-secondary">Scolaire à </span>
              <span className="text-primary">Portée</span>
              <br />
              <span className="text-primary">de Main</span>
            </p>

            {/* Description */}
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              SenClass est le logiciel de gestion scolaire tout-en-un des écoles du Sénégal, du CI à la Terminale : inscriptions, notes et bulletins, emplois du temps, présences et paiements. Gagnez du temps, réduisez les coûts et concentrez-vous sur l'éducation.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <motion.button
                type="button"
                onClick={() => navigate(ADRESSE_INSCRIPTION)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 text-base font-semibold text-primary-foreground bg-primary rounded-lg shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
              >
                Commencer Gratuitement
              </motion.button>
              <motion.a
                href={lienWhatsApp(MESSAGE_DEMO)}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-foreground bg-background border-2 border-border rounded-lg hover:bg-muted transition-colors"
              >
                Demander une démo
              </motion.a>
            </div>

          </motion.div>

          {/* Right Content - Image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src={heroImage}
                alt="Élèves africains dans une salle de classe moderne"
                className="w-full h-auto object-cover"
              />
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-secondary/10 rounded-full blur-2xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
