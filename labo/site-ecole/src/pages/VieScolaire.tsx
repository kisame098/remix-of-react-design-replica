import { useState } from 'react';
import { X } from 'lucide-react';
import { Img, Liste, Section, T, useEdition } from '../edition';
import { Appel, Conteneur, GrilleIcones, TitreSection } from '../composants';
import { EntetePage } from '../Gabarit';

export default function VieScolaire() {
  const { contenu, edition } = useEdition();
  const [agrandie, setAgrandie] = useState<string | null>(null);

  return (
    <>
      <EntetePage c="vieScolaire.entete" />

      <Section id="activites" nom="Activités" className="py-24">
        <Conteneur>
          <TitreSection c="vieScolaire.activites" />
          <Liste c="vieScolaire.activites.elements" nouveau={{ image: '', titre: 'Nouvelle activité', texte: 'Description.' }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" classeElement="h-full">
            {(_, __, ce) => (
              <div className="h-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="relative h-48 overflow-hidden"><Img c={`${ce}.image`} className="w-full h-full object-cover" /></div>
                <div className="p-6">
                  <T c={`${ce}.titre`} as="h3" className="titre block text-xl font-bold text-[var(--c1)]" />
                  <T c={`${ce}.texte`} as="p" className="block text-gray-600 text-sm mt-2 leading-relaxed" />
                </div>
              </div>
            )}
          </Liste>
        </Conteneur>
      </Section>

      <GrilleIcones id="services" nom="Services" c="vieScolaire.services" fond />

      <Section id="galerie" nom="Galerie" className="py-24">
        <Conteneur>
          <TitreSection c="vieScolaire.galerie" />
          <Liste c="vieScolaire.galerie.elements" nouveau={{ image: '' }} className="grid grid-cols-2 md:grid-cols-4 gap-3" libelleAjout="Ajouter une photo">
            {(el, i, ce) => (
              <button type="button" onClick={() => !edition && setAgrandie(el.image)}
                className={`relative block w-full overflow-hidden rounded-xl group ${i % 5 === 0 ? 'md:col-span-2 md:row-span-2 aspect-square' : 'aspect-square'}`}>
                <Img c={`${ce}.image`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </button>
            )}
          </Liste>
        </Conteneur>
      </Section>

      <Section id="calendrier" nom="Calendrier" className="py-24 bg-gray-50">
        <Conteneur className="max-w-4xl">
          <TitreSection c="vieScolaire.calendrier" />
          <Liste c="vieScolaire.calendrier.elements" nouveau={{ date: 'Mois', evenement: 'Événement' }} className="relative space-y-4" libelleAjout="Ajouter une date">
            {(_, __, ce) => (
              <div className="flex gap-5 items-stretch bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <T c={`${ce}.date`} className="titre w-36 md:w-44 flex-shrink-0 bg-[var(--c1)] text-white font-bold flex items-center justify-center text-center p-4" />
                <T c={`${ce}.evenement`} as="p" className="flex-1 py-5 pr-5 text-gray-800 font-medium self-center" />
              </div>
            )}
          </Liste>
        </Conteneur>
      </Section>

      <Appel />

      {agrandie && contenu && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setAgrandie(null)}>
          <button type="button" className="absolute top-5 right-5 text-white" aria-label="Fermer"><X className="h-8 w-8" /></button>
          <img src={agrandie} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </>
  );
}
