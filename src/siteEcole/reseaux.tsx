import type { ElementType } from 'react';
import { Facebook, Globe, Instagram, Linkedin, MessageCircleMore, Music2, Send, Twitter, Youtube } from 'lucide-react';
import type { TypeReseau } from './contenu';

/** Logo officiel WhatsApp (absent de la bibliothèque d'icônes). */
export function IconeWhatsApp({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.56.94.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.01c0-5.2 4.23-9.43 9.43-9.43a9.38 9.38 0 0 1 9.43 9.44c0 5.2-4.23 9.42-9.44 9.42zm8.02-17.44A11.27 11.27 0 0 0 12.04.75C5.8.75.72 5.83.72 12.07c0 2 .52 3.94 1.51 5.65L.62 23.25l5.66-1.48a11.3 11.3 0 0 0 5.41 1.38h.01c6.24 0 11.32-5.08 11.32-11.32 0-3.02-1.18-5.87-3.32-8z" /></svg>
  );
}

/** Icône et couleur de marque de chaque réseau. */
export const STYLE_RESEAU: Record<TypeReseau, { Icone: ElementType; couleur: string }> = {
  facebook: { Icone: Facebook, couleur: '#1877F2' },
  instagram: { Icone: Instagram, couleur: '#E1306C' },
  tiktok: { Icone: Music2, couleur: '#111111' },
  youtube: { Icone: Youtube, couleur: '#FF0000' },
  linkedin: { Icone: Linkedin, couleur: '#0A66C2' },
  x: { Icone: Twitter, couleur: '#111111' },
  whatsapp: { Icone: MessageCircleMore, couleur: '#25D366' },
  telegram: { Icone: Send, couleur: '#229ED9' },
  site: { Icone: Globe, couleur: '#475569' },
};
