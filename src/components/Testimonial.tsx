import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

const Testimonial = () => {
  return (
    <section className="py-20 navy-gradient text-secondary-foreground">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Fièrement conçu à Dakar, pour l'Afrique.
            </h2>
            <p className="text-secondary-foreground/80 mb-8 leading-relaxed">
              Nous comprenons les défis des établissements scolaires locaux. C'est pourquoi Teranga School est optimisé pour fonctionner même avec une connexion internet lente et s'adapte aux systèmes éducatifs de la zone UEMOA.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-secondary-foreground/90">Support local et formation sur site</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-secondary-foreground/90">Conforme aux normes du Ministère de l'Éducation</span>
              </div>
            </div>
          </motion.div>

          {/* Right Content - Testimonial Card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="bg-background rounded-2xl p-8 shadow-xl">
              {/* Author */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">MA</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">M. Amadou Sow</p>
                  <p className="text-sm text-muted-foreground">Directeur, Groupe Scolaire Les Élites</p>
                </div>
              </div>

              {/* Quote */}
              <blockquote className="text-foreground leading-relaxed">
                <span className="text-primary text-4xl font-serif">"</span>
                Teranga School a transformé notre façon de travailler. Les parents sont ravis de recevoir les notes par SMS et nous avons réduit nos impayés de 40% grâce au suivi automatisé.
                <span className="text-primary text-4xl font-serif">"</span>
              </blockquote>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Testimonial;
