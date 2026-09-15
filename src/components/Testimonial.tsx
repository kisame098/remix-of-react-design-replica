import { motion } from "framer-motion";
import { CheckCircle, MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "221706811277";
const WHATSAPP_MESSAGE = "Bonjour, je suis intéressé(e) par SenClass pour mon établissement.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

const Testimonial = () => {
  return (
    <section id="temoignages" className="py-20 navy-gradient text-secondary-foreground">
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
              Nous comprenons les défis des établissements scolaires locaux. C'est pourquoi SenClass est optimisé pour fonctionner même avec une connexion internet lente et s'adapte aux systèmes éducatifs de la zone UEMOA.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-secondary-foreground/90">Support local et formation sur site</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-secondary-foreground/90">Pensé pour s'adapter aux programmes scolaires sénégalais</span>
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
            <div className="bg-background rounded-2xl p-8 shadow-xl text-center">
              <p className="font-semibold text-foreground mb-2">Envie de voir SenClass en action ?</p>
              <p className="text-sm text-muted-foreground mb-6">
                On se déplace pour vous présenter le produit et former votre équipe, sans engagement.
              </p>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Nous contacter sur WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Testimonial;
