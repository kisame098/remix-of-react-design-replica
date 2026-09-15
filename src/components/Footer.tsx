import { Facebook, Twitter, Linkedin, MapPin, Phone, Mail } from "lucide-react";
import { EMAIL_CONTACT, TELEPHONE_LISIBLE, lienWhatsApp } from "@/lib/contact";

const Footer = () => {
  return (
    <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-lg font-bold text-foreground">SenClass</span>
            </a>
            <p className="text-sm text-muted-foreground mb-4">
              Le logiciel de gestion scolaire conçu à Dakar pour les écoles du Sénégal et d'Afrique. Simple, fiable et sécurisé.
            </p>
            <div className="flex gap-4">
              <a href="#" aria-label="Facebook" className="text-muted-foreground hover:text-foreground transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" aria-label="Twitter" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" aria-label="LinkedIn" className="text-muted-foreground hover:text-foreground transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Produit</h4>
            <ul className="space-y-3">
              <li>
                <a href="#fonctionnalites" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Fonctionnalités
                </a>
              </li>
              <li>
                <a href="#tarifs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Tarifs
                </a>
              </li>
              <li>
                <a href="#temoignages" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Témoignages
                </a>
              </li>
              <li>
                <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Légal</h4>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Confidentialité
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Conditions d'utilisation
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Mentions légales
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div id="contact">
            <h4 className="font-semibold text-foreground mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Sacré-Coeur 3, Dakar, Sénégal
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                {/* Le numéro WhatsApp réel — l'ancien « 33 800 00 00 » était un
                    numéro de démonstration. */}
                <a
                  href={lienWhatsApp("Bonjour, je souhaite en savoir plus sur SenClass.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {TELEPHONE_LISIBLE} (WhatsApp)
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a
                  href={`mailto:${EMAIL_CONTACT}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {EMAIL_CONTACT}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SenClass. Fait avec passion à Dakar.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
