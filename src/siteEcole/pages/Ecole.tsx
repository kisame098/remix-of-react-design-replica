import { Img, Liste, Section, T } from '../edition';
import { Conteneur, TitreSection } from '../composants';

export function Histoire() {
  return (
    <Section className="py-24">
      <Conteneur className="grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <TitreSection c="ecole.histoire" centre={false} texte={false} />
          <T c="ecole.histoire.texte" as="div" className="block -mt-4 text-gray-600 text-lg leading-relaxed" />
        </div>
        <div className="relative">
          <div className="absolute -right-4 -bottom-4 w-full h-full rounded-3xl bg-[var(--c2-25)]" />
          <div className="relative rounded-3xl overflow-hidden shadow-xl aspect-[4/3]">
            <Img c="ecole.histoire.image" className="w-full h-full object-cover" />
          </div>
        </div>
      </Conteneur>
    </Section>
  );
}

export function Equipe() {
  return (
    <Section className="py-24">
      <Conteneur>
        <TitreSection c="ecole.equipe" />
        <Liste c="ecole.equipe.elements" colonnes={4} nouveau={{ photo: '', nom: 'Nom', fonction: 'Fonction' }} libelleAjout="Ajouter une personne">
          {(_, __, ce) => (
            <div className="text-center group">
              <div className="relative rounded-3xl overflow-hidden aspect-[4/5] shadow-md">
                <Img c={`${ce}.photo`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[var(--c2)]" />
              </div>
              <T c={`${ce}.nom`} as="p" className="titre block text-xl font-bold text-gray-900 mt-5" />
              <T c={`${ce}.fonction`} as="p" className="block text-[var(--c1)] font-medium mt-1" />
            </div>
          )}
        </Liste>
      </Conteneur>
    </Section>
  );
}

export function Infrastructures() {
  return (
    <Section className="py-24 bg-gray-50">
      <Conteneur>
        <TitreSection c="ecole.infrastructures" />
        <Liste c="ecole.infrastructures.elements" colonnes={4} nouveau={{ image: '', titre: 'Nouvel espace', texte: 'Description.' }}>
          {(_, __, ce) => (
            <div className="relative rounded-2xl overflow-hidden aspect-[3/4] group shadow-md">
              <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 p-6 text-white">
                <T c={`${ce}.titre`} as="p" className="titre block text-xl font-bold" />
                <T c={`${ce}.texte`} as="p" className="block text-sm text-white/80 mt-1" />
              </div>
            </div>
          )}
        </Liste>
      </Conteneur>
    </Section>
  );
}
