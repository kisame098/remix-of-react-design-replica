import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ADRESSE_INSCRIPTION, lienWhatsApp } from "@/lib/contact";

const MESSAGE_COMMERCIAL = "Bonjour, je souhaite en savoir plus sur SenClass pour mon école.";

const CTA = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Prêt à moderniser votre école ?
          </h2>
          <p className="text-muted-foreground mb-8">
            {/* Pas de nombre de jours : l'essai vaut 7 jours par défaut et le
                chef du système peut le régler (3, 7, 13 ou 30 jours). « 30 jours »
                promettait ce que le logiciel n'accorde pas d'office. */}
            Rejoignez la communauté SenClass aujourd'hui et profitez d'une période d'essai gratuite, sans engagement.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              type="button"
              onClick={() => navigate(ADRESSE_INSCRIPTION)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 text-base font-semibold text-primary-foreground bg-primary rounded-lg shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
            >
              Créer mon compte gratuit
            </motion.button>
            <motion.a
              href={lienWhatsApp(MESSAGE_COMMERCIAL)}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-foreground bg-background border-2 border-border rounded-lg hover:bg-muted transition-colors"
            >
              Contacter l'équipe commerciale
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
