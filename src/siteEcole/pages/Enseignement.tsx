import { CheckCircle2 } from 'lucide-react';
import { Img, Liste, Section, T } from '../edition';
import { Conteneur, NOUVEAU_CYCLE } from '../composants';

export function CyclesDetail() {
  return (
    <Section className="py-24">
      <Conteneur>
        <Liste c="enseignement.cycles" nouveau={NOUVEAU_CYCLE} className="space-y-24" libelleAjout="Ajouter un cycle">
          {(_, i, ce) => (
            <div className={`grid lg:grid-cols-2 gap-12 items-center ${i % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
              <div className="relative">
                <div className={`absolute ${i % 2 ? '-left-4' : '-right-4'} -bottom-4 w-full h-full rounded-3xl bg-[var(--c1-10)]`} />
                <div className="relative rounded-3xl overflow-hidden shadow-xl aspect-[4/3]">
                  <Img c={`${ce}.image`} className="w-full h-full object-cover" />
                </div>
              </div>
              <div>
                <T c={`${ce}.age`} className="inline-block bg-[var(--c2-20)] text-gray-900 text-sm font-semibold px-4 py-1.5 rounded-full" />
                <T c={`${ce}.nom`} as="h2" className="titre block text-4xl font-bold text-[var(--c1)] mt-4" />
                <T c={`${ce}.niveaux`} as="p" className="block text-lg font-medium text-gray-500 mt-2" />
                <T c={`${ce}.texte`} as="p" className="block text-gray-600 text-lg leading-relaxed mt-5" />
                <Liste c={`${ce}.points`} nouveau="Nouveau point" className="mt-6 space-y-3" libelleAjout="Ajouter un point">
                  {(__, ___, cp) => (
                    <p className="flex items-center gap-3 text-gray-800 font-medium">
                      <CheckCircle2 className="h-5 w-5 text-[var(--c1)] flex-shrink-0" /><T c={cp} />
                    </p>
                  )}
                </Liste>
              </div>
            </div>
          )}
        </Liste>
      </Conteneur>
    </Section>
  );
}
