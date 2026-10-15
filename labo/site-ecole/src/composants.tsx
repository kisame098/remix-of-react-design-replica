import { useState } from 'react';
import { ArrowRight, Calendar, CheckCircle2, Quote, Send } from 'lucide-react';
import { Bouton, Icone, Img, Liste, Section, T, useEdition } from './edition';
import { lienWhatsApp } from './utilitaires';

/** Surtitre doré + grand titre, centré ou à gauche. */
export function TitreSection({ c, centre = true, clair = false, texte = true }: { c: string; centre?: boolean; clair?: boolean; texte?: boolean }) {
  return (
    <div className={`${centre ? 'text-center mx-auto' : ''} max-w-2xl mb-12`}>
      <T c={`${c}.surtitre`} as="p" className="text-[var(--c2)] font-semibold uppercase tracking-[0.18em] text-xs mb-3" />
      <T c={`${c}.titre`} as="h2" className={`titre text-3xl md:text-4xl font-bold leading-tight ${clair ? 'text-white' : 'text-[var(--c1)]'}`} />
      <div className={`h-1 w-16 bg-[var(--c2)] rounded mt-5 ${centre ? 'mx-auto' : ''}`} />
      {texte && <T c={`${c}.texte`} as="p" className={`mt-5 text-lg ${clair ? 'text-white/80' : 'text-gray-600'}`} />}
    </div>
  );
}

export const Conteneur = ({ children, className = '' }: { children: React.ReactNode; className?: string }) =>
  <div className={`max-w-7xl mx-auto px-6 ${className}`}>{children}</div>;

/** Grille icône + titre + texte (atouts, valeurs, pédagogie, services). */
export function GrilleIcones({ id, nom, c, fond = false }: { id: string; nom: string; c: string; fond?: boolean }) {
  return (
    <Section id={id} nom={nom} className={`py-20 ${fond ? 'bg-gray-50' : ''}`}>
      <Conteneur>
        <TitreSection c={c} />
        <Liste c={`${c}.elements`} nouveau={{ icone: 'star', titre: 'Nouveau point fort', texte: 'Décrivez-le en une phrase.' }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" classeElement="h-full">
          {(_, __, ce) => (
            <div className="h-full bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group">
              <span className="inline-flex h-14 w-14 rounded-2xl items-center justify-center bg-[var(--c1-10)] text-[var(--c1)] group-hover:bg-[var(--c1)] group-hover:text-white transition-colors">
                <Icone c={`${ce}.icone`} className="h-7 w-7" />
              </span>
              <T c={`${ce}.titre`} as="h3" className="titre block text-xl font-bold text-gray-900 mt-5" />
              <T c={`${ce}.texte`} as="p" className="block text-gray-600 mt-2 leading-relaxed" />
            </div>
          )}
        </Liste>
      </Conteneur>
    </Section>
  );
}

/** Cartes des cycles (accueil) : données partagées avec la page Enseignement. */
export function CartesCycles() {
  return (
    <Section id="accueil-cycles" nom="Nos cycles" className="py-20 bg-gray-50">
      <Conteneur>
        <TitreSection c="accueil.cycles" />
        <Liste c="enseignement.cycles" nouveau={NOUVEAU_CYCLE} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" classeElement="h-full" libelleAjout="Ajouter un cycle">
          {(_, __, ce) => (
            <a href="#/enseignement" className="h-full flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all group">
              <div className="relative h-48 overflow-hidden">
                <Img c={`${ce}.image`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <T c={`${ce}.age`} className="absolute bottom-3 left-3 bg-[var(--c2)] text-gray-900 text-xs font-bold px-3 py-1 rounded-full" />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <T c={`${ce}.nom`} as="h3" className="titre text-2xl font-bold text-[var(--c1)]" />
                <T c={`${ce}.niveaux`} as="p" className="text-sm font-medium text-gray-500 mt-1" />
                <T c={`${ce}.texte`} as="p" className="text-gray-600 mt-3 text-sm leading-relaxed flex-1" />
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--c1)]">En savoir plus <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></span>
              </div>
            </a>
          )}
        </Liste>
      </Conteneur>
    </Section>
  );
}

export const NOUVEAU_CYCLE = {
  image: '', nom: 'Nouveau cycle', niveaux: 'Niveaux concernés', age: 'Âge', texte: 'Présentation du cycle.', points: ['Point fort'],
};

export function Resultats() {
  return (
    <Section id="resultats" nom="Résultats aux examens" className="py-20 bg-[var(--c1)] text-white relative overflow-hidden">
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5" />
      <div className="absolute -left-20 -bottom-40 h-96 w-96 rounded-full bg-[var(--c2-10)]" />
      <Conteneur className="relative">
        <TitreSection c="accueil.resultats" clair />
        <Liste c="accueil.resultats.elements" nouveau={{ examen: 'Examen', taux: '0 %', detail: 'Détail' }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {(_, __, ce) => (
            <div className="text-center rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-8">
              <T c={`${ce}.taux`} as="p" className="titre text-6xl font-bold text-[var(--c2)]" />
              <T c={`${ce}.examen`} as="p" className="text-xl font-semibold mt-3" />
              <T c={`${ce}.detail`} as="p" className="text-white/70 text-sm mt-1" />
            </div>
          )}
        </Liste>
      </Conteneur>
    </Section>
  );
}

export function Temoignages() {
  return (
    <Section id="temoignages" nom="Témoignages" className="py-20">
      <Conteneur>
        <TitreSection c="accueil.temoignages" />
        <Liste c="accueil.temoignages.elements" nouveau={{ texte: 'Votre témoignage…', nom: 'Nom', role: 'Parent d\'élève', photo: '' }}
          className="grid md:grid-cols-3 gap-6" classeElement="h-full">
          {(_, __, ce) => (
            <figure className="h-full bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col">
              <Quote className="h-10 w-10 text-[var(--c2)] mb-4" />
              <T c={`${ce}.texte`} as="blockquote" className="text-gray-700 leading-relaxed flex-1 italic" />
              <figcaption className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                <span className="relative h-12 w-12 rounded-full overflow-hidden flex-shrink-0">
                  <Img c={`${ce}.photo`} className="h-full w-full object-cover" />
                </span>
                <span>
                  <T c={`${ce}.nom`} as="span" className="block font-semibold text-gray-900" />
                  <T c={`${ce}.role`} as="span" className="block text-sm text-gray-500" />
                </span>
              </figcaption>
            </figure>
          )}
        </Liste>
      </Conteneur>
    </Section>
  );
}

export const NOUVELLE_ACTUALITE = { image: '', date: 'Date', categorie: 'Catégorie', titre: 'Titre de l\'actualité', texte: 'Résumé en une ou deux phrases.' };

export function CartesActualites({ limite }: { limite?: number }) {
  const { contenu } = useEdition();
  // Sur l'accueil : les premières seulement ; l'ajout se fait sur la page Actualités.
  if (limite) {
    return <div className="grid md:grid-cols-3 gap-6">{contenu.actualites.elements.slice(0, limite).map((_, i) => <CarteActualite key={i} ce={`actualites.elements.${i}`} />)}</div>;
  }
  return (
    <Liste c="actualites.elements" nouveau={NOUVELLE_ACTUALITE} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" classeElement="h-full" libelleAjout="Ajouter une actualité">
      {(_, __, ce) => <CarteActualite ce={ce} />}
    </Liste>
  );
}

function CarteActualite({ ce }: { ce: string }) {
  return (
    <article className="h-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-shadow flex flex-col">
      <div className="relative h-52 overflow-hidden">
        <Img c={`${ce}.image`} className="w-full h-full object-cover" />
        <T c={`${ce}.categorie`} className="absolute top-4 left-4 bg-[var(--c1)] text-white text-xs font-semibold px-3 py-1 rounded-full" />
      </div>
      <div className="p-6 flex-1">
        <p className="flex items-center gap-1.5 text-sm text-gray-500"><Calendar className="h-4 w-4" /><T c={`${ce}.date`} /></p>
        <T c={`${ce}.titre`} as="h3" className="titre block text-xl font-bold text-gray-900 mt-2 leading-snug" />
        <T c={`${ce}.texte`} as="p" className="block text-gray-600 mt-2 text-sm leading-relaxed" />
      </div>
    </article>
  );
}

/** Bandeau d'appel à l'inscription, en bas des pages. */
export function Appel() {
  return (
    <Section id="appel" nom="Appel à l'inscription" className="py-16">
      <Conteneur>
        <div className="relative overflow-hidden rounded-3xl bg-[var(--c1)] px-8 py-14 md:px-16 text-white flex flex-col lg:flex-row items-center gap-8">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--c2-20)]" />
          <div className="absolute right-40 -bottom-24 h-48 w-48 rounded-full bg-white/5" />
          <div className="relative flex-1 text-center lg:text-left">
            <T c="accueil.appel.titre" as="h2" className="titre text-3xl md:text-4xl font-bold" />
            <T c="accueil.appel.texte" as="p" className="mt-3 text-white/80 text-lg max-w-2xl" />
          </div>
          <div className="relative flex flex-wrap gap-3 justify-center">
            <Bouton c="accueil.appel.bouton1" className="px-7 py-3.5 rounded-full bg-[var(--c2)] text-gray-900 font-bold hover:brightness-105 shadow-lg" />
            <Bouton c="accueil.appel.bouton2" className="px-7 py-3.5 rounded-full border-2 border-white/70 font-semibold hover:bg-white hover:text-[var(--c1)] transition" />
          </div>
        </div>
      </Conteneur>
    </Section>
  );
}

/**
 * Formulaire sans serveur : il compose un message et l'ouvre dans WhatsApp,
 * adressé au numéro de l'école. Rien n'est stocké ni envoyé ailleurs.
 */
export function FormulaireWhatsApp({ champs, entete, bouton = 'Envoyer sur WhatsApp' }: {
  champs: { nom: string; libelle: string; type?: 'text' | 'tel' | 'textarea' | 'select'; options?: string[]; requis?: boolean }[];
  entete: string;
  bouton?: string;
}) {
  const { contenu } = useEdition();
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [envoye, setEnvoye] = useState(false);

  const envoyer = (e: React.FormEvent) => {
    e.preventDefault();
    const lignes = champs.map(ch => `${ch.libelle} : ${valeurs[ch.nom] ?? ''}`).join('\n');
    window.open(lienWhatsApp(contenu.identite.whatsapp, `${entete}\n\n${lignes}`), '_blank', 'noopener');
    setEnvoye(true);
  };

  const classeChamp = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--c1-40)] focus:border-[var(--c1)]';
  return (
    <form onSubmit={envoyer} className="grid sm:grid-cols-2 gap-4">
      {champs.map(ch => (
        <label key={ch.nom} className={`block ${ch.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
          <span className="block text-sm font-medium text-gray-700 mb-1.5">{ch.libelle}{ch.requis && <span className="text-red-500"> *</span>}</span>
          {ch.type === 'textarea'
            ? <textarea rows={4} required={ch.requis} className={classeChamp} value={valeurs[ch.nom] ?? ''} onChange={e => setValeurs(v => ({ ...v, [ch.nom]: e.target.value }))} />
            : ch.type === 'select'
              ? <select required={ch.requis} className={classeChamp} value={valeurs[ch.nom] ?? ''} onChange={e => setValeurs(v => ({ ...v, [ch.nom]: e.target.value }))}>
                  <option value="">Choisir…</option>
                  {ch.options!.map(o => <option key={o}>{o}</option>)}
                </select>
              : <input type={ch.type ?? 'text'} required={ch.requis} className={classeChamp} value={valeurs[ch.nom] ?? ''} onChange={e => setValeurs(v => ({ ...v, [ch.nom]: e.target.value }))} />}
        </label>
      ))}
      <div className="sm:col-span-2 flex flex-wrap items-center gap-4 mt-2">
        <button type="submit" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[var(--c1)] text-white font-semibold hover:brightness-110 shadow-md">
          <Send className="h-4 w-4" />{bouton}
        </button>
        {envoye && <span className="flex items-center gap-1.5 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" />WhatsApp s'est ouvert avec votre message.</span>}
      </div>
    </form>
  );
}
