import { Section } from '../edition';
import { CartesActualites, Conteneur } from '../composants';
import { EntetePage } from '../Gabarit';

export default function Actualites() {
  return (
    <>
      <EntetePage c="actualites.entete" />
      <Section id="liste-actualites" nom="Actualités" className="py-24 bg-gray-50">
        <Conteneur><CartesActualites /></Conteneur>
      </Section>
    </>
  );
}
