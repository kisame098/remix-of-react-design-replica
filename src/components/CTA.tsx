import { motion } from "framer-motion";

const CTA = () => {
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
            Rejoignez la communauté Teranga School aujourd'hui et profitez de 30 jours d'essai gratuit sans engagement.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 text-base font-semibold text-primary-foreground bg-primary rounded-lg shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
            >
              Créer mon compte gratuit
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 text-base font-semibold text-foreground bg-background border-2 border-border rounded-lg hover:bg-muted transition-colors"
            >
              Contacter l'équipe commerciale
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
