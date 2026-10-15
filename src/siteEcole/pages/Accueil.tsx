import { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Bouton, Img, Liste, Section, T, useEdition } from '../edition';
import { ajouterElement, retirerElement } from '../chemin';
import { CartesActualites, Conteneur, TitreSection } from '../composants';

export function Diaporama() {
  const { contenu, edition, majListe } = useEdition();
  const diapos = contenu.accueil.diapos;
  const [i, setI] = useState(0);
  const n = diapos.length;
  const courant = Math.min(i, n - 1);

  // Défilement automatique, arrêté pendant la modification.
  useEffect(() => {
    if (edition || n < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % n), 6500);
    return () => clearInterval(t);
  }, [edition, n]);

  const aller = (sens: number) => setI(x => (x + sens + n) % n);
  if (n === 0) return null;

  return (
    <section className="relative h-[560px] md:h-[640px] overflow-hidden bg-gray-900">
      {diapos.map((_, k) => (
        <div key={k} className={`absolute inset-0 transition-opacity duration-1000 ${k === courant ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}`}>
          <Img c={`accueil.diapos.${k}.image`} className={`absolute inset-0 w-full h-full object-cover ${k === courant ? 'scale-105' : 'scale-100'} transition-transform duration-[7000ms] ease-out`} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/10" />
          <div className="relative h-full max-w-7xl mx-auto px-6 flex items-center">
            {k === courant && (
              <div className="max-w-2xl text-white apparition">
                <p className="flex items-center gap-3 mb-5">
                  <span className="h-0.5 w-10 bg-[var(--c2)]" />
                  <T c={`accueil.diapos.${k}.surtitre`} className="uppercase tracking-[0.2em] text-sm font-semibold text-[var(--c2)]" />
                </p>
                <T c={`accueil.diapos.${k}.titre`} as="h1" className="titre block text-4xl md:text-6xl font-bold leading-[1.1]" />
                <T c={`accueil.diapos.${k}.texte`} as="p" className="block mt-6 text-lg md:text-xl text-white/85 leading-relaxed" />
                <div className="mt-9 flex flex-wrap gap-4">
                  <Bouton c="accueil.bouton1" className="inline-flex px-8 py-4 rounded-full bg-[var(--c2)] text-gray-900 font-bold shadow-lg hover:brightness-105 transition" />
                  <Bouton c="accueil.bouton2" className="inline-flex px-8 py-4 rounded-full border-2 border-white/80 text-white font-semibold hover:bg-white hover:text-gray-900 transition" />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {n > 1 && (
        <>
          <button type="button" onClick={() => aller(-1)} aria-label="Diapositive précédente"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur text-white hidden md:flex items-center justify-center"><ChevronLeft /></button>
          <button type="button" onClick={() => aller(1)} aria-label="Diapositive suivante"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur text-white hidden md:flex items-center justify-center"><ChevronRight /></button>
          <div className="absolute bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {diapos.map((_, k) => (
              <button key={k} type="button" onClick={() => setI(k)} aria-label={`Diapositive ${k + 1}`}
                className={`h-2.5 rounded-full transition-all ${k === courant ? 'w-8 bg-[var(--c2)]' : 'w-2.5 bg-white/60'}`} />
            ))}
          </div>
        </>
      )}

      {edition && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex gap-2">
          <button type="button" className="outil" onClick={() => { majListe('accueil.diapos', l => ajouterElement(l, structuredClone(l[courant]), courant)); setI(courant + 1); }}>
            <Plus className="h-3.5 w-3.5" />Ajouter une diapositive
          </button>
          {n > 1 && (
            <button type="button" className="outil text-red-600" onClick={() => { majListe('accueil.diapos', l => retirerElement(l, courant)); setI(0); }}>
              <Trash2 className="h-3.5 w-3.5" />Supprimer celle-ci
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function Chiffres() {
  return (
    <Section className="relative z-20 -mt-16 md:-mt-20 pb-4">
      <Conteneur>
        <Liste c="accueil.chiffres" nouveau={{ valeur: '0', libelle: 'libellé' }}
          className="flex flex-wrap bg-white rounded-2xl shadow-xl border border-gray-100"
          classeElement="flex-1 basis-1/2 lg:basis-0 border-gray-100 [&:not(:first-child)]:lg:border-l">
          {(_, __, ce) => (
            <div className="px-4 py-8 md:py-10 text-center">
              <T c={`${ce}.valeur`} as="p" className="titre text-4xl md:text-5xl font-bold text-[var(--c1)]" />
              <T c={`${ce}.libelle`} as="p" className="mt-2 text-sm md:text-base text-gray-600 font-medium" />
            </div>
          )}
        </Liste>
      </Conteneur>
    </Section>
  );
}

export function MotDuDirecteur() {
  return (
    <Section className="py-24">
      <Conteneur className="grid lg:grid-cols-[5fr_7fr] gap-14 items-center">
        <div className="relative max-w-md mx-auto lg:mx-0 w-full">
          <div className="absolute -left-4 -top-4 w-full h-full rounded-3xl border-4 border-[var(--c2)]" />
          <div className="relative rounded-3xl overflow-hidden shadow-xl aspect-[4/5]">
            <Img c="accueil.mot.image" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-6 -right-4 md:-right-8 bg-[var(--c1)] text-white rounded-2xl px-6 py-4 shadow-xl">
            <T c="accueil.mot.nom" as="p" className="titre font-bold text-lg" />
            <T c="accueil.mot.fonction" as="p" className="text-sm text-white/75" />
          </div>
        </div>
        <div>
          <TitreSection c="accueil.mot" centre={false} texte={false} />
          <T c="accueil.mot.texte" as="div" className="block -mt-4 text-gray-600 text-lg leading-relaxed" />
        </div>
      </Conteneur>
    </Section>
  );
}

export function ActualitesRecentes() {
  return (
    <Section className="py-20 bg-gray-50">
      <Conteneur>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <TitreSection c="accueil.actualites" centre={false} />
          <a href="#/actualites" className="mb-12 inline-flex items-center gap-1 font-semibold text-[var(--c1)] hover:gap-2 transition-all">Toutes les actualités <ArrowRight className="h-4 w-4" /></a>
        </div>
        <CartesActualites limite={3} />
      </Conteneur>
    </Section>
  );
}
