import { motion } from "framer-motion";
import heroImage from "@/assets/hero-classroom.jpg";

const Hero = () => {
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
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 text-sm font-medium text-primary bg-accent rounded-full"
            >
              <span className="text-primary">✨</span>
              <span>Nouveau: Application mobile pour parents</span>
            </motion.div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              <span className="text-secondary">L'Excellence</span>
              <br />
              <span className="text-secondary">Scolaire à </span>
              <span className="text-primary">Portée</span>
              <br />
              <span className="text-primary">de Main</span>
            </h1>

            {/* Description */}
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Teranga School est la plateforme tout-en-un conçue pour simplifier la gestion des écoles africaines. Gagnez du temps, réduisez les coûts et concentrez-vous sur l'éducation.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 text-base font-semibold text-primary-foreground bg-primary rounded-lg shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
              >
                Commencer Gratuitement
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 text-base font-semibold text-foreground bg-background border-2 border-border rounded-lg hover:bg-muted transition-colors"
              >
                Demander une démo
              </motion.button>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-muted border-2 border-background"
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Déjà plus de <span className="font-semibold text-primary">500 écoles</span> nous font confiance.
              </p>
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
              {/* Overlay Label */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur-sm rounded-xl p-4 shadow-lg"
              >
                <p className="text-sm font-semibold text-foreground">Lycée Moderne de Dakar</p>
                <p className="text-xs text-muted-foreground">Utilisateur depuis 2023</p>
              </motion.div>
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
