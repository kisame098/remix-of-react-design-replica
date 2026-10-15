import { useState } from 'react';
import { ChevronDown, FileText, Wallet } from 'lucide-react';
import { Liste, Section, T, useEdition } from '../edition';
import { Conteneur, FormulaireWhatsApp, TitreSection } from '../composants';
import { EntetePage } from '../Gabarit';

export default function Admissions() {
  const { contenu } = useEdition();
  const cycles = contenu.enseignement.cycles.map(c => c.nom);

  return (
    <>
      <EntetePage c="admissions.entete" />

      <Section id="etapes" nom="Étapes d'inscription" className="py-24">
        <Conteneur>
          <TitreSection c="admissions.etapes" />
          <Liste c="admissions.etapes.elements" nouveau={{ titre: 'Nouvelle étape', texte: 'Description.' }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" classeElement="h-full">
            {(_, i, ce) => (
              <div className="h-full relative bg-white rounded-2xl p-7 pt-10 border border-gray-100 shadow-sm">
                <span className="absolute -top-6 left-7 h-12 w-12 rounded-full bg-[var(--c1)] text-white titre text-xl font-bold flex items-center justify-center ring-4 ring-white">{i + 1}</span>
                <T c={`${ce}.titre`} as="h3" className="titre block text-xl font-bold text-gray-900" />
                <T c={`${ce}.texte`} as="p" className="block text-gray-600 mt-2 leading-relaxed" />
              </div>
            )}
          </Liste>
        </Conteneur>
      </Section>

      <Section id="pieces" nom="Pièces et paiement" className="pb-24">
        <Conteneur className="grid lg:grid-cols-2 gap-8">
          <Encadre icone={<FileText className="h-6 w-6" />} c="admissions.pieces" />
          <Encadre icone={<Wallet className="h-6 w-6" />} c="admissions.paiement" />
        </Conteneur>
      </Section>

      <Section id="frais" nom="Frais de scolarité" className="py-24 bg-gray-50">
        <Conteneur className="max-w-4xl">
          <TitreSection c="admissions.frais" />
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-3 bg-[var(--c1)] text-white font-semibold text-sm md:text-base">
              <span className="p-4 md:px-6">Cycle</span><span className="p-4 md:px-6 text-right">Inscription</span><span className="p-4 md:px-6 text-right">Mensualité</span>
            </div>
            <Liste c="admissions.frais.elements" nouveau={{ niveau: 'Niveau', inscription: '0 F', mensualite: '0 F' }} className="divide-y divide-gray-100" libelleAjout="Ajouter une ligne">
              {(_, __, ce) => (
                <div className="grid grid-cols-3 text-sm md:text-base">
                  <T c={`${ce}.niveau`} className="p-4 md:px-6 font-semibold text-gray-900" />
                  <T c={`${ce}.inscription`} className="p-4 md:px-6 text-right text-gray-700" />
                  <T c={`${ce}.mensualite`} className="p-4 md:px-6 text-right font-semibold text-[var(--c1)]" />
                </div>
              )}
            </Liste>
          </div>
          <T c="admissions.frais.note" as="p" className="block mt-4 text-sm text-gray-500 text-center" />
        </Conteneur>
      </Section>

      <Section id="preinscription" nom="Préinscription" className="py-24">
        <Conteneur className="max-w-3xl">
          <div className="text-center mb-10">
            <T c="admissions.formulaire.titre" as="h2" className="titre block text-3xl md:text-4xl font-bold text-[var(--c1)]" />
            <T c="admissions.formulaire.texte" as="p" className="block mt-4 text-gray-600 text-lg" />
          </div>
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-10">
            <FormulaireWhatsApp
              entete="Demande de préinscription"
              bouton="Envoyer la préinscription"
              champs={[
                { nom: 'enfant', libelle: 'Nom et prénom de l\'enfant', requis: true },
                { nom: 'naissance', libelle: 'Date de naissance' },
                { nom: 'cycle', libelle: 'Cycle demandé', type: 'select', options: cycles, requis: true },
                { nom: 'classe', libelle: 'Classe demandée' },
                { nom: 'parent', libelle: 'Nom du parent', requis: true },
                { nom: 'telephone', libelle: 'Téléphone', type: 'tel', requis: true },
                { nom: 'message', libelle: 'Message (facultatif)', type: 'textarea' },
              ]}
            />
          </div>
        </Conteneur>
      </Section>

      <Section id="faq" nom="Questions fréquentes" className="py-24 bg-gray-50">
        <Conteneur className="max-w-3xl">
          <TitreSection c="admissions.faq" />
          <Liste c="admissions.faq.elements" nouveau={{ question: 'Nouvelle question ?', reponse: 'Réponse.' }} className="space-y-3" libelleAjout="Ajouter une question">
            {(_, __, ce) => <Question ce={ce} />}
          </Liste>
        </Conteneur>
      </Section>
    </>
  );
}

function Encadre({ icone, c }: { icone: React.ReactNode; c: string }) {
  return (
    <div className="rounded-2xl border-2 border-[var(--c1-15)] p-8 bg-white">
      <div className="flex items-center gap-3 mb-6">
        <span className="h-12 w-12 rounded-xl bg-[var(--c1)] text-white flex items-center justify-center">{icone}</span>
        <T c={`${c}.titre`} as="h3" className="titre text-2xl font-bold text-gray-900" />
      </div>
      <Liste c={`${c}.elements`} nouveau="Nouvel élément" className="space-y-3">
        {(_, __, ce) => (
          <p className="flex gap-3 text-gray-700">
            <span className="mt-2 h-2 w-2 rounded-full bg-[var(--c2)] flex-shrink-0" /><T c={ce} />
          </p>
        )}
      </Liste>
    </div>
  );
}

function Question({ ce }: { ce: string }) {
  const { edition } = useEdition();
  const [ouvert, setOuvert] = useState(false);
  const visible = ouvert || edition;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <button type="button" onClick={() => setOuvert(o => !o)} className="w-full flex items-center gap-4 text-left p-5 md:px-7">
        <T c={`${ce}.question`} className="flex-1 font-semibold text-gray-900 text-lg" />
        <ChevronDown className={`h-5 w-5 text-[var(--c1)] transition-transform flex-shrink-0 ${visible ? 'rotate-180' : ''}`} />
      </button>
      {visible && <T c={`${ce}.reponse`} as="p" className="block px-5 md:px-7 pb-6 text-gray-600 leading-relaxed" />}
    </div>
  );
}
