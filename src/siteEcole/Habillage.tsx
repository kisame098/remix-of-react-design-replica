import type { ReactNode } from 'react';
import { useEdition } from './edition';
import { GabaritTeranga } from './themes/teranga/GabaritTeranga';
import { GabaritPrestige } from './themes/prestige/GabaritPrestige';
import { GabaritCampus } from './themes/campus/GabaritCampus';
import { GabaritBaobab } from './themes/baobab/GabaritBaobab';
import { Gabarit } from './Gabarit';

/** Le gabarit (en-tête, menu, pied de page) du modèle choisi par l'école. */
export default function Habillage({ page, article = false, children }: { page: string; article?: boolean; children: ReactNode }) {
  const { contenu } = useEdition();
  const modele = contenu.identite.modele;
  if (modele === 'prestige') return <GabaritPrestige page={page} sansBandeau={article}>{children}</GabaritPrestige>;
  if (modele === 'campus') return <GabaritCampus page={page} sansBandeau={article}>{children}</GabaritCampus>;
  if (modele === 'baobab') return <GabaritBaobab page={page}>{children}</GabaritBaobab>;
  const Composant = modele === 'teranga' ? GabaritTeranga : Gabarit;
  return <Composant page={page}>{children}</Composant>;
}
