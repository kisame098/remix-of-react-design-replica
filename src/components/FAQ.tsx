import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { QUESTIONS, donneesStructureesFAQ } from "@/lib/faq";

/**
 * Questions fréquentes (contenu : src/lib/faq.ts).
 *
 * Les réponses restent dans la page même repliées (<details>) : Google les
 * lit. Un accordéon qui ne les insère qu'à l'ouverture les lui cacherait.
 */
const FAQ = () => {
  return (
    <section id="faq" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Questions fréquentes
          </h2>
          <p className="text-muted-foreground">
            Tout ce que les directeurs d'école nous demandent avant de se lancer.
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-3">
          {QUESTIONS.map((q) => (
            <details
              key={q.question}
              className="group rounded-xl border border-border bg-background px-5 py-4 open:shadow-sm open:border-primary/40 transition-colors"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <h3 className="text-base">{q.question}</h3>
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{q.reponse}</p>
            </details>
          ))}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructureesFAQ()) }}
      />
    </section>
  );
};

export default FAQ;
