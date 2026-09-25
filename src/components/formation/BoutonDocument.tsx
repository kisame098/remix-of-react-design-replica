import { useState, type ReactNode } from 'react';
import type jsPDF from 'jspdf';
import { Button, type ButtonProps } from '@/components/ui/button';
import { DocumentDialog } from '@/components/documents/DocumentDialog';

interface Props {
  children: ReactNode;
  /** Titre de la fenêtre d'aperçu. */
  titre: string;
  description?: string;
  nomFichier: string;
  /** Fabrique le PDF — le générateur n'est chargé qu'à ce moment (import dynamique). */
  fabriquer: () => Promise<jsPDF>;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  disabled?: boolean;
  /** Explication au survol (pourquoi le bouton est grisé, par exemple). */
  title?: string;
}

/** Un bouton qui ouvre un document : aperçu, impression, téléchargement — comme les reçus. */
export const BoutonDocument = ({ children, titre, description, nomFichier, fabriquer, variant = 'outline', size = 'sm', className, disabled, title }: Props) => {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      {/* Un bouton grisé ne reçoit pas le survol : l'explication est portée par un conteneur. */}
      <span title={title} className="inline-flex">
        <Button variant={variant} size={size} className={className} disabled={disabled} onClick={() => setOuvert(true)}>
          {children}
        </Button>
      </span>
      <DocumentDialog
        ouvert={ouvert} onFermer={() => setOuvert(false)}
        titre={titre} description={description} nomFichier={nomFichier} generer={fabriquer}
      />
    </>
  );
};
