import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { Bouton, Icone, Img, Liste, Section, T, useEdition } from '../../edition';
import { ajouterElement, retirerElement } from '../../chemin';
import { NOUVEAU_CYCLE } from '../../composants';
import { TYPES_RESEAUX, type Actualite } from '../../contenu';
import { IconeWhatsApp, STYLE_RESEAU } from '../../reseaux';
import { estPageFacebook, lienWhatsApp } from '../../utilitaires';
import { BadgeTournant, Motif } from './Motif';

export const Boite = ({ children, className = '' }: { children: React.ReactNode; className?: string }) =>
  <div className={`max-w-6xl mx-auto px-6 ${className}`}>{children}</div>;

/** Titre de section Teranga : étiquette en pilule + très grand titre serré. */
export function TitreT({ c, centre = false, clair = false, texte = true }: { c: string; centre?: boolean; clair?: boolean; texte?: boolean }) {
  return (
    <div className={`mb-12 ${centre ? 'text-center mx-auto' : ''} max-w-3xl`}>
      <T c={`${c}.surtitre`} as="p" className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-5 ${clair ? 'bg-white/10 text-white' : 'bg-[var(--c1)] text-white'}`} />
      <T c={`${c}.titre`} as="h2" className={`titre block text-4xl md:text-6xl font-extrabold leading-[0.98] ${clair ? 'text-white' : ''}`} />
      {texte && <T c={`${c}.texte`} as="p" className={`block mt-5 text-lg md:text-xl ${clair ? 'text-white/70' : 'text-black/60'}`} />}
    </div>
  );
}

/* ─────────── Accueil : écran d'ouverture en deux colonnes, photo en arche ─────────── */

export function DiaporamaT() {
  const { contenu, edition, majListe } = useEdition();
  const diapos = contenu.accueil.diapos;
  const [i, setI] = useState(0);
  const n = diapos.length;
  const k = Math.min(i, n - 1);
  useEffect(() => {
    if (edition || n < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [edition, n]);
  if (n === 0) return null;
  const autres = diapos.map((_, j) => j).filter(j => j !== k).slice(0, 2);
  // Le texte du badge fait le tour du cercle : on répète le bouton principal jusqu'à le remplir.
  const motBadge = `${contenu.accueil.bouton1.texte || contenu.identite.nom} • `;
  const badge = motBadge.repeat(Math.max(1, Math.round(34 / motBadge.length)));

  return (
    <section className="relative overflow-hidden">
      <Boite className="grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center pt-14 pb-20 md:pt-20">
        <div key={k} className="apparition relative z-10">
          <T c={`accueil.diapos.${k}.surtitre`} as="p" className="inline-flex items-center gap-2 rounded-full bg-white border border-black/10 px-4 py-2 text-sm font-semibold shadow-sm" />
          <T c={`accueil.diapos.${k}.titre`} as="h1" className="titre block mt-7 text-5xl sm:text-6xl xl:text-[5.2rem] font-extrabold leading-[0.95]" />
          <T c={`accueil.diapos.${k}.texte`} as="p" className="block mt-7 text-xl text-black/60 max-w-xl leading-relaxed" />
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Bouton c="accueil.bouton1" className="inline-flex items-center h-14 px-8 rounded-full bg-[var(--encre)] text-white font-bold hover:bg-[var(--c1)] transition-colors" />
            <Bouton c="accueil.bouton2" className="inline-flex items-center h-14 px-8 rounded-full border-2 border-[var(--encre)] font-bold hover:bg-[var(--encre)] hover:text-white transition-colors" />
          </div>
          {n > 1 && (
            <div className="mt-12 flex items-center gap-4">
              <span className="titre font-extrabold text-2xl">0{k + 1}</span>
              <div className="flex gap-1.5">
                {diapos.map((_, j) => (
                  <button key={j} type="button" onClick={() => setI(j)} aria-label={`Diapositive ${j + 1}`}
                    className={`h-1.5 rounded-full transition-all ${j === k ? 'w-14 bg-[var(--c1)]' : 'w-6 bg-black/15 hover:bg-black/30'}`} />
                ))}
              </div>
              <span className="titre font-extrabold text-2xl text-black/25">0{n}</span>
            </div>
          )}
          {edition && (
            <div className="mt-6 flex gap-2">
              <button type="button" className="outil" onClick={() => { majListe('accueil.diapos', l => ajouterElement(l, structuredClone(l[k]), k)); setI(k + 1); }}><Plus className="h-3.5 w-3.5" />Ajouter une diapositive</button>
              {n > 1 && <button type="button" className="outil text-red-600" onClick={() => { majListe('accueil.diapos', l => retirerElement(l, k)); setI(0); }}><Trash2 className="h-3.5 w-3.5" />Supprimer celle-ci</button>}
            </div>
          )}
        </div>

        <div className="relative h-[460px] md:h-[560px]">
          <div className="absolute right-0 top-6 w-[78%] h-[92%] rounded-t-full rounded-b-[2.5rem] bg-[var(--c2)] overflow-hidden">
            <Motif type="eventails" className="w-full h-full text-white/15" />
          </div>
          <div className="absolute right-8 top-0 w-[72%] h-[90%] rounded-t-full rounded-b-[2.5rem] overflow-hidden shadow-2xl">
            <Img c={`accueil.diapos.${k}.image`} className="w-full h-full object-cover" />
          </div>
          {autres.map((j, p) => (
            <button key={j} type="button" onClick={() => setI(j)} aria-label={`Diapositive ${j + 1}`}
              className={`absolute ${p === 0 ? 'left-0 top-16 h-32 w-32' : 'left-10 bottom-10 h-24 w-24'} rounded-full overflow-hidden ring-[6px] ring-[var(--fond)] shadow-lg hover:scale-105 transition-transform`}>
              <img src={diapos[j].image} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          <BadgeTournant texte={badge} className="absolute right-0 bottom-0 h-32 w-32 md:h-36 md:w-36 rounded-full bg-[var(--c1)] text-white shadow-xl">
            <ArrowUpRight className="h-9 w-9" />
          </BadgeTournant>
        </div>
      </Boite>
    </section>
  );
}

/* ─────────── Chiffres : mosaïque de tuiles colorées ─────────── */

const TUILES = ['bg-[var(--c1)] text-white', 'bg-white text-[var(--encre)] border border-black/10', 'bg-[var(--c2)] text-white', 'bg-[var(--encre)] text-white'];

export function ChiffresT() {
  return (
    <Section className="py-10">
      <Boite>
        <Liste c="accueil.chiffres" colonnes={4} nouveau={{ valeur: '0', libelle: 'libellé' }} classeElement="flex">
          {(_, i, ce) => (
            <div className={`w-full rounded-[2rem] p-8 min-h-[190px] flex flex-col justify-between relative overflow-hidden ${TUILES[i % TUILES.length]} ${i % 2 ? 'lg:translate-y-6' : ''}`}>
              <Motif type="points" className="absolute inset-0 opacity-10" />
              <T c={`${ce}.libelle`} as="p" className="relative font-semibold opacity-80" />
              <T c={`${ce}.valeur`} as="p" className="relative titre text-6xl font-extrabold leading-none" />
            </div>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────── Mot du directeur : citation géante, portrait rond ─────────── */

export function MotT() {
  return (
    <Section className="py-28">
      <Boite className="grid lg:grid-cols-[320px_1fr] gap-14 items-start">
        <div className="relative mx-auto lg:mx-0">
          <div className="absolute -inset-4 rounded-full text-[var(--c1)] overflow-hidden"><Motif type="cercles" echelle={0.6} className="w-full h-full opacity-40" /></div>
          <div className="relative h-72 w-72 rounded-full overflow-hidden ring-8 ring-[var(--fond)]">
            <Img c="accueil.mot.image" className="w-full h-full object-cover" />
          </div>
          <div className="relative mt-8 text-center lg:text-left">
            <T c="accueil.mot.nom" as="p" className="titre block text-2xl font-extrabold" />
            <T c="accueil.mot.fonction" as="p" className="block text-[var(--c1)] font-semibold" />
          </div>
        </div>
        <div>
          <T c="accueil.mot.surtitre" as="p" className="inline-flex rounded-full bg-[var(--c1)] text-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest" />
          <p className="titre text-[9rem] leading-[0.6] font-extrabold text-[var(--c2)] mt-8 select-none">“</p>
          <T c="accueil.mot.titre" as="h2" className="titre block text-4xl md:text-5xl font-extrabold leading-tight -mt-6" />
          <T c="accueil.mot.texte" as="div" className="block mt-8 text-xl leading-relaxed text-black/70 columns-1 xl:columns-2 gap-10" />
        </div>
      </Boite>
    </Section>
  );
}

/* ─────────── Cycles : cartes numérotées, photo en arche ─────────── */

export function CyclesT() {
  return (
    <Section className="py-24 bg-white rounded-[2.5rem] md:rounded-[4rem] mx-2 md:mx-4">
      <Boite>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <TitreT c="accueil.cycles" />
          <a href="#/enseignement" className="mb-12 inline-flex items-center gap-2 h-12 px-6 rounded-full border-2 border-[var(--encre)] font-bold hover:bg-[var(--encre)] hover:text-white transition-colors">Tous les cycles <ArrowRight className="h-4 w-4" /></a>
        </div>
        <Liste c="enseignement.cycles" colonnes={4} nouveau={NOUVEAU_CYCLE} classeElement="flex" libelleAjout="Ajouter un cycle">
          {(_, i, ce) => (
            <a href="#/enseignement" className="group w-full rounded-[2rem] bg-[var(--fond)] p-3 pb-6 hover:bg-[var(--c1)] hover:text-white transition-colors duration-300">
              <div className="relative h-56 rounded-t-full rounded-b-[1.5rem] overflow-hidden">
                <Img c={`${ce}.image`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="px-3 pt-5">
                <p className="titre font-extrabold text-black/20 group-hover:text-white/40 text-lg">0{i + 1}</p>
                <T c={`${ce}.nom`} as="h3" className="titre block text-3xl font-extrabold" />
                <T c={`${ce}.niveaux`} as="p" className="block text-sm font-semibold mt-1 opacity-70" />
                <T c={`${ce}.age`} className="inline-block mt-4 rounded-full border border-current px-3 py-1 text-xs font-bold" />
              </div>
            </a>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────── Atouts / valeurs / pédagogie / services : liste éditoriale numérotée ─────────── */

export function ListeEditoriale({ c, fonce = false }: { c: string; fonce?: boolean }) {
  return (
    <Section className={`py-28 ${fonce ? 'bg-[var(--encre)] text-white rounded-[2.5rem] md:rounded-[4rem] mx-2 md:mx-4' : ''}`}>
      <Boite className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12">
        <div className="lg:sticky lg:top-32 self-start"><TitreT c={c} clair={fonce} /></div>
        <Liste c={`${c}.elements`} nouveau={{ icone: 'star', titre: 'Nouveau point', texte: 'Décrivez-le en une phrase.' }} className={`divide-y ${fonce ? 'divide-white/10' : 'divide-black/10'}`}>
          {(_, i, ce) => (
            <div className="py-7 flex gap-6 items-start group">
              <span className={`flex-shrink-0 h-16 w-16 rounded-2xl flex items-center justify-center transition-transform group-hover:-rotate-6 ${i % 2 ? 'bg-[var(--c2)]' : 'bg-[var(--c1)]'} text-white`}>
                <Icone c={`${ce}.icone`} className="h-7 w-7" />
              </span>
              <div className="flex-1">
                <T c={`${ce}.titre`} as="h3" className="titre block text-2xl md:text-3xl font-extrabold" />
                <T c={`${ce}.texte`} as="p" className={`block mt-2 text-lg ${fonce ? 'text-white/60' : 'text-black/60'}`} />
              </div>
              <span className={`titre text-sm font-bold ${fonce ? 'text-white/30' : 'text-black/25'}`}>0{i + 1}</span>
            </div>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────── Résultats : chiffres géants sur fond couleur, motif ─────────── */

export function ResultatsT() {
  return (
    <Section className="relative py-28 bg-[var(--c1)] text-white overflow-hidden">
      <Motif type="losanges" className="absolute inset-0 text-white/[0.08]" />
      <Boite className="relative">
        <TitreT c="accueil.resultats" clair centre />
        <Liste c="accueil.resultats.elements" colonnes={3} nouveau={{ examen: 'Examen', taux: '0 %', detail: 'Détail' }} classeElement="flex">
          {(_, __, ce) => (
            <div className="w-full text-center rounded-[2rem] bg-white text-[var(--encre)] p-10 relative">
              <T c={`${ce}.examen`} className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[var(--encre)] text-white px-5 py-2 text-sm font-bold whitespace-nowrap" />
              <T c={`${ce}.taux`} as="p" className="titre block text-7xl md:text-8xl font-extrabold text-[var(--c1)] leading-none mt-4" />
              <T c={`${ce}.detail`} as="p" className="block mt-4 text-black/60 font-medium" />
            </div>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────── Témoignages : bulles de discussion ─────────── */

export function TemoignagesT() {
  return (
    <Section className="py-28">
      <Boite>
        <TitreT c="accueil.temoignages" centre />
        <Liste c="accueil.temoignages.elements" colonnes={3} nouveau={{ texte: 'Votre témoignage…', nom: 'Nom', role: 'Parent d\'élève', photo: '' }} classeElement="flex">
          {(_, i, ce) => (
            <figure className={`w-full flex flex-col ${i % 2 ? 'lg:mt-14' : ''}`}>
              <div className={`relative rounded-[2rem] rounded-bl-md p-8 text-lg leading-relaxed ${i % 3 === 0 ? 'bg-[var(--c1)] text-white' : i % 3 === 1 ? 'bg-white border border-black/10' : 'bg-[var(--c2)] text-white'}`}>
                <T c={`${ce}.texte`} as="blockquote" className="block" />
              </div>
              <figcaption className="flex items-center gap-3 mt-5 pl-2">
                <span className="relative h-14 w-14 rounded-full overflow-hidden ring-4 ring-white shadow"><Img c={`${ce}.photo`} className="h-full w-full object-cover" /></span>
                <span>
                  <T c={`${ce}.nom`} className="block titre font-extrabold text-lg" />
                  <T c={`${ce}.role`} className="block text-sm text-black/50" />
                </span>
              </figcaption>
            </figure>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────── Actualités : mise en page magazine (une grande + une liste) ─────────── */

export function MagazineActualites({ limite }: { limite?: number }) {
  const { contenu } = useEdition();
  const liste = contenu.actualites.elements.slice(0, limite ?? contenu.actualites.elements.length);
  if (liste.length === 0) return null;
  const [une, ...reste] = liste;
  const lien = (a: Actualite) => `#/actualites/${encodeURIComponent(a.id)}`;
  return (
    <div className="grid lg:grid-cols-[1.25fr_1fr] gap-8">
      <a href={lien(une)} className="group relative rounded-[2.5rem] overflow-hidden min-h-[460px] flex items-end">
        <Img c="actualites.elements.0.image" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="relative m-4 rounded-[1.75rem] bg-white p-7 max-w-lg">
          <p className="flex items-center gap-3 text-sm font-semibold"><span className="rounded-full bg-[var(--c1)] text-white px-3 py-1">{une.categorie}</span><span className="text-black/50">{une.date}</span></p>
          <p className="titre text-3xl font-extrabold leading-tight mt-4 group-hover:text-[var(--c1)] transition-colors">{une.titre}</p>
          <p className="text-black/60 mt-2">{une.texte}</p>
        </div>
      </a>
      <div className="flex flex-col divide-y divide-black/10">
        {reste.map(a => (
          <a key={a.id} href={lien(a)} className="group flex gap-5 py-6 first:pt-0 items-center">
            <img src={a.image} alt="" className="h-28 w-28 rounded-[1.5rem] object-cover flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--c1)]">{a.categorie} · <span className="text-black/40">{a.date}</span></p>
              <p className="titre text-xl font-extrabold leading-snug mt-1.5 group-hover:underline underline-offset-4">{a.titre}</p>
            </div>
            <ArrowUpRight className="ml-auto h-6 w-6 flex-shrink-0 opacity-30 group-hover:opacity-100 group-hover:rotate-45 transition" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function ActualitesRecentesT() {
  const { edition } = useEdition();
  return (
    <Section className="py-28">
      <Boite>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <TitreT c="accueil.actualites" />
          <a href="#/actualites" className="mb-12 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[var(--encre)] text-white font-bold">
            {edition ? <><Pencil className="h-4 w-4" />Gérer les actualités</> : <>Toutes les actualités <ArrowRight className="h-4 w-4" /></>}
          </a>
        </div>
        <MagazineActualites limite={4} />
      </Boite>
    </Section>
  );
}

/* ─────────── Suivez-nous : grandes tuiles aux couleurs de chaque réseau ─────────── */

export function SuivezNousT() {
  const { contenu, edition, ouvrirIdentite } = useEdition();
  const id = contenu.identite;
  const facebook = id.reseaux.find(r => r.type === 'facebook' && estPageFacebook(r.url));
  const tuiles = [
    ...id.reseaux.filter(r => r.url).map(r => ({ ...STYLE_RESEAU[r.type] ?? STYLE_RESEAU.site, nom: TYPES_RESEAUX[r.type], url: r.url })),
    ...(id.whatsapp ? [{ Icone: IconeWhatsApp, couleur: '#25D366', nom: 'WhatsApp', url: lienWhatsApp(id.whatsapp, id.messageWhatsApp) }] : []),
  ];
  return (
    <Section className="py-24">
      <Boite className={`grid gap-12 ${id.filFacebook && facebook ? 'lg:grid-cols-[1fr_440px]' : ''} items-start`}>
        <div>
          <TitreT c="accueil.suivez" />
          <div className={`grid grid-cols-2 gap-4 ${id.filFacebook && facebook ? '' : 'md:grid-cols-4'}`}>
            {tuiles.map((t, i) => (
              <a key={i} href={t.url} target="_blank" rel="noreferrer" className="group aspect-[5/4] rounded-[2rem] p-6 flex flex-col justify-between text-white hover:-translate-y-1 transition-transform" style={{ background: t.couleur }}>
                <t.Icone className="h-10 w-10" />
                <span className="flex items-center justify-between font-bold text-lg">{t.nom}<ArrowUpRight className="h-5 w-5 group-hover:rotate-45 transition-transform" /></span>
              </a>
            ))}
            {edition && (
              <button type="button" onClick={() => ouvrirIdentite(true)} className="aspect-[5/4] rounded-[2rem] border-2 border-dashed border-black/20 flex flex-col items-center justify-center gap-2 font-semibold text-black/50 hover:border-[var(--c1)] hover:text-[var(--c1)]">
                <Pencil className="h-6 w-6" />Modifier nos réseaux
              </button>
            )}
          </div>
        </div>
        {id.filFacebook && facebook && (
          <iframe title="Page Facebook" className="rounded-[2rem] border-0 bg-white w-full shadow-lg" height={620}
            src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(facebook.url)}&tabs=timeline&width=440&height=620`} />
        )}
      </Boite>
    </Section>
  );
}

/* ─────────── Appel à l'inscription : bloc géant couleur d'accent ─────────── */

export function AppelT() {
  return (
    <Section className="py-16 px-2 md:px-4">
      <div className="relative rounded-[2.5rem] md:rounded-[4rem] bg-[var(--c2)] text-white overflow-hidden px-8 py-20 md:py-28">
        <Motif type="cercles" className="absolute inset-0 text-white/10" />
        <div className="relative max-w-5xl mx-auto text-center">
          <T c="accueil.appel.titre" as="h2" className="titre block text-5xl md:text-7xl font-extrabold leading-[0.95]" />
          <T c="accueil.appel.texte" as="p" className="block mt-6 text-xl text-white/80 max-w-2xl mx-auto" />
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Bouton c="accueil.appel.bouton1" className="inline-flex items-center h-16 px-10 rounded-full bg-[var(--encre)] text-white text-lg font-bold hover:scale-105 transition-transform" />
            <Bouton c="accueil.appel.bouton2" className="inline-flex items-center h-16 px-10 rounded-full bg-white text-[var(--encre)] text-lg font-bold hover:scale-105 transition-transform" />
          </div>
        </div>
      </div>
    </Section>
  );
}
