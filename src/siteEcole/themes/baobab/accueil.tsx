import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, Quote, Search, Sparkles } from 'lucide-react';
import { Bouton, ICONES, Icone, Img, Liste, Section, T, useEdition } from '../../edition';
import { NOUVEAU_CYCLE } from '../../composants';
import { TYPES_RESEAUX } from '../../contenu';
import { IconeWhatsApp, STYLE_RESEAU } from '../../reseaux';
import { lienWhatsApp } from '../../utilitaires';
import { Compteur, Revele } from '../prestige/GabaritPrestige';
import { BOUTON_CONTOUR, Boite, TitreB, Trait } from './GabaritBaobab';

/* ─────────────────────────── Ouverture : titre + recherche / collage de photos ─────────────────────────── */

export function HeroB() {
  const { contenu, edition } = useEdition();
  const h = contenu.baobab.hero;
  const cycles = contenu.enseignement.cycles;
  const [cycle, setCycle] = useState('');
  const [pret, setPret] = useState(false);
  useEffect(() => { const t = setTimeout(() => setPret(true), 150); return () => clearTimeout(t); }, []);
  const visages = contenu.accueil.temoignages.elements.map(t => t.photo).filter(Boolean).slice(0, 3);

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 w-full lg:w-[46%] bg-[var(--doux)] rounded-bl-[80px] -z-0" />
      <Boite className="relative grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center py-14 lg:py-20">
        <div>
          <Revele><p className="inline-flex items-center gap-2.5 rounded-full bg-white border border-[var(--c1-15)] pl-1.5 pr-4 py-1.5 text-sm font-semibold shadow-sm">
            <span className="rounded-full bg-[var(--c2)] text-white px-2.5 py-1 text-xs font-bold">Nouveau</span><T c="baobab.hero.surtitre" />
          </p></Revele>
          <Revele delai={100}>
            <h1 className="titre mt-7 text-[2.9rem] sm:text-6xl xl:text-[4.6rem] font-extrabold leading-[1.02]">
              <T c="baobab.hero.titreDebut" />{' '}
              <span className="relative inline-block text-[var(--c1)]"><T c="baobab.hero.motSouligne" />{!edition && <Trait trace={pret} />}</span>{' '}
              <T c="baobab.hero.titreFin" />
            </h1>
          </Revele>
          <Revele delai={200}><T c="baobab.hero.texte" as="p" className="block mt-6 text-lg md:text-xl text-[#55635d] max-w-xl leading-relaxed" /></Revele>

          {/* Le petit outil « trouver un cycle » : il mène aux tarifs et à la préinscription. */}
          <Revele delai={300} className="mt-9 max-w-xl">
            <form onSubmit={e => { e.preventDefault(); location.hash = '#/admissions'; }}
              className="flex flex-col sm:flex-row gap-2 rounded-[22px] bg-white p-2 shadow-[0_20px_50px_-20px_rgba(13,31,25,0.35)] border border-black/5">
              <label className="flex-1 flex items-center gap-3 px-4 py-2 rounded-2xl hover:bg-[var(--doux)] transition-colors">
                <Search className="h-5 w-5 text-[var(--c1)] flex-shrink-0" />
                <span className="flex-1">
                  <span className="block text-xs font-semibold text-[#6b7a73]">Pour mon enfant</span>
                  <select value={cycle} onChange={e => setCycle(e.target.value)} className="w-full bg-transparent font-bold focus:outline-none -ml-0.5 cursor-pointer">
                    <option value="">Choisir un cycle</option>
                    {cycles.map(c => <option key={c.nom} value={c.nom}>{c.nom} — {c.age}</option>)}
                  </select>
                </span>
              </label>
              <button type="submit" className="h-14 px-7 rounded-2xl bg-[var(--c1)] text-white font-bold hover:bg-[var(--c2)] transition-colors flex items-center justify-center gap-2">
                Voir les tarifs <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </Revele>

          <Revele delai={400} className="mt-9 flex items-center gap-4">
            <span className="flex -space-x-3">{visages.map((v, i) => <img key={i} src={v} alt="" className="h-11 w-11 rounded-full object-cover ring-[3px] ring-white" />)}</span>
            <button type="button" onClick={() => document.querySelector('[data-temoignages]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="text-sm leading-tight text-left group"><span className="block font-bold group-hover:text-[var(--c1)] transition-colors">Ce qu'en disent les parents</span><span className="text-[#55635d]">Lire les témoignages →</span></button>
          </Revele>
        </div>

        {/* Collage : trois photos et des étiquettes qui flottent */}
        <div className="relative h-[480px] md:h-[560px]">
          <Revele delai={150} className="absolute right-0 top-0 w-[68%] h-[72%] rounded-[32px] overflow-hidden shadow-2xl">
            <Img c="baobab.hero.image1" className="absolute inset-0 w-full h-full object-cover" />
          </Revele>
          <Revele delai={300} className="absolute left-0 top-[20%] w-[42%] h-[42%] rounded-[28px] overflow-hidden shadow-2xl ring-8 ring-white">
            <Img c="baobab.hero.image2" className="absolute inset-0 w-full h-full object-cover" />
          </Revele>
          <Revele delai={450} className="absolute left-[24%] bottom-0 w-[52%] h-[36%] rounded-[28px] overflow-hidden shadow-2xl ring-8 ring-white">
            <Img c="baobab.hero.image3" className="absolute inset-0 w-full h-full object-cover" />
          </Revele>
          <div className="absolute right-[4%] bottom-[22%] flottement rounded-2xl bg-white shadow-xl px-4 py-3 flex items-center gap-3 z-10">
            <span className="h-11 w-11 rounded-xl bg-[var(--c2)] text-white flex items-center justify-center"><Sparkles className="h-5 w-5" /></span>
            <span className="leading-tight"><T c="baobab.hero.etiquette1" className="block titre font-extrabold text-lg" /><span className="block text-xs text-[#6b7a73]">Session 2026</span></span>
          </div>
          <div className="absolute left-[4%] top-[3%] flottement-lent rounded-2xl bg-[var(--c1)] text-white shadow-xl px-4 py-3 z-10">
            <T c="baobab.hero.etiquette2" className="block titre font-extrabold text-xl" /><span className="block text-xs text-white/70">du préscolaire au Bac</span>
          </div>
          <div className="absolute right-[10%] -top-3 h-20 w-20 rounded-full border-[10px] border-[var(--c2)] opacity-80 -z-0" />
        </div>
      </Boite>
    </section>
  );
}

/* ─────────────────────────── Bandeau de confiance ─────────────────────────── */

export function ConfianceB() {
  const { contenu, edition } = useEdition();
  if (edition) {
    return (
      <Section className="py-8 border-y border-black/5">
        <Boite>
          <Liste c="baobab.confiance" nouveau="Nouvel atout" className="flex flex-wrap justify-center gap-3">
            {(_, __, ce) => <T c={ce} className="inline-block rounded-full bg-[var(--doux)] px-4 py-2 font-semibold" />}
          </Liste>
        </Boite>
      </Section>
    );
  }
  const ligne = (
    <div className="flex items-center">
      {contenu.baobab.confiance.map((t, i) => (
        <span key={i} className="flex items-center gap-3 px-8 whitespace-nowrap font-bold text-[17px] text-[#43514b]">
          <CheckCircle2 className="h-5 w-5 text-[var(--c1)]" />{t}
        </span>
      ))}
    </div>
  );
  return (
    <section className="py-7 border-y border-black/5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
      <div className="flex w-max animate-[defilement_35s_linear_infinite]">{ligne}{ligne}</div>
    </section>
  );
}

/* ─────────────────────────── Atouts en mosaïque « bento » ─────────────────────────── */

export function BentoB() {
  const { contenu } = useEdition();
  const atouts = contenu.accueil.atouts.elements;
  const chiffre = contenu.accueil.chiffres[0];
  return (
    <Section className="py-24">
      <Boite>
        <div className="grid lg:grid-cols-[1fr_auto] items-end gap-8 mb-12">
          <TitreB c="accueil.atouts" texte={false} />
          <a href="#/ecole" className={BOUTON_CONTOUR}>Découvrir l'école <ArrowRight className="h-4 w-4" /></a>
        </div>
        <div className="grid md:grid-cols-4 auto-rows-[200px] gap-4">
          <Revele className="md:col-span-2 md:row-span-2 relative rounded-[28px] overflow-hidden group">
            <Img c="baobab.bentoImage" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D1F19]/85 via-[#0D1F19]/20 to-transparent pointer-events-none" />
            <div className="absolute left-7 right-7 bottom-7 text-white">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-bold">{atouts[0] && <Icone c="accueil.atouts.elements.0.icone" className="h-3.5 w-3.5" />}Notre force</span>
              <T c="accueil.atouts.elements.0.titre" as="h3" className="titre block text-3xl font-extrabold mt-3" />
              <T c="accueil.atouts.elements.0.texte" as="p" className="block mt-2 text-white/80 max-w-md" />
            </div>
          </Revele>
          {chiffre && (
            <Revele delai={100} className="rounded-[28px] bg-[var(--c1)] text-white p-7 flex flex-col justify-between relative overflow-hidden">
              <span className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
              <T c="accueil.chiffres.0.libelle" as="p" className="block font-semibold text-white/80" />
              <p className="titre text-6xl font-extrabold"><Compteur valeur={chiffre.valeur} /></p>
            </Revele>
          )}
          {atouts.slice(1, 6).map((_, j) => {
            const i = j + 1;
            const large = i === 3;
            return (
              <Revele key={i} delai={100 + j * 80} className={`group rounded-[28px] p-7 flex flex-col justify-between transition-colors duration-500 ${large ? 'md:col-span-2 bg-[var(--c2)] text-white' : 'bg-[var(--doux)] hover:bg-[var(--c1)] hover:text-white'}`}>
                <span className={`h-12 w-12 rounded-2xl flex items-center justify-center ${large ? 'bg-white/20' : 'bg-white text-[var(--c1)] group-hover:bg-white/15 group-hover:text-white'} transition-colors`}>
                  <Icone c={`accueil.atouts.elements.${i}.icone`} className="h-6 w-6" />
                </span>
                <div>
                  <T c={`accueil.atouts.elements.${i}.titre`} as="h3" className="titre block text-xl font-extrabold" />
                  <T c={`accueil.atouts.elements.${i}.texte`} as="p" className={`block mt-1.5 text-sm ${large ? 'text-white/85' : 'text-[#55635d] group-hover:text-white/75'} line-clamp-2`} />
                </div>
              </Revele>
            );
          })}
        </div>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Cycles : accordéon horizontal ─────────────────────────── */

const ICONES_CYCLES = ['bebe', 'book', 'graduation', 'science', 'star', 'trophy'];

export function AccordeonB() {
  const { contenu, edition } = useEdition();
  const cycles = contenu.enseignement.cycles;
  const [actif, setActif] = useState(0);
  if (edition) {
    return (
      <Section className="py-24 bg-[var(--doux)]">
        <Boite>
          <TitreB c="accueil.cycles" className="mb-12" />
          <Liste c="enseignement.cycles" colonnes={4} nouveau={NOUVEAU_CYCLE} libelleAjout="Ajouter un cycle">
            {(_, __, ce) => (
              <div className="rounded-[24px] bg-white overflow-hidden">
                <div className="relative h-40"><Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover" /></div>
                <div className="p-5"><T c={`${ce}.nom`} as="p" className="titre block text-xl font-extrabold" /><T c={`${ce}.age`} as="p" className="block text-sm text-[#6b7a73]" /><T c={`${ce}.texte`} as="p" className="block text-sm mt-2" /></div>
              </div>
            )}
          </Liste>
        </Boite>
      </Section>
    );
  }
  return (
    <Section className="py-24 bg-[var(--doux)]">
      <Boite>
        <TitreB c="accueil.cycles" className="mb-12" />
        <div className="flex flex-col lg:flex-row gap-3 lg:h-[500px]">
          {cycles.map((cy, i) => {
            const ouvert = actif === i;
            const I = ICONES[ICONES_CYCLES[i % ICONES_CYCLES.length]];
            return (
              <div key={i} onMouseEnter={() => setActif(i)} onClick={() => setActif(i)}
                className={`relative overflow-hidden rounded-[28px] cursor-pointer transition-[flex-grow,height] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${ouvert ? 'lg:flex-[3.2] h-[420px]' : 'lg:flex-1 h-24'} lg:h-auto`}>
                <img src={cy.image} alt="" className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${ouvert ? 'scale-100' : 'scale-110'}`} />
                <div className={`absolute inset-0 transition-colors duration-700 ${ouvert ? 'bg-gradient-to-t from-[#0D1F19]/90 via-[#0D1F19]/25 to-transparent' : ''}`} style={ouvert ? undefined : { backgroundColor: 'color-mix(in srgb, var(--c1) 82%, transparent)' }} />
                {/* Fermé : le nom à la verticale */}
                <div className={`absolute inset-0 hidden lg:flex flex-col items-center justify-between py-8 text-white transition-opacity duration-300 ${ouvert ? 'opacity-0' : 'opacity-100 delay-200'}`}>
                  <span className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center"><I className="h-6 w-6" /></span>
                  <span className="titre text-2xl font-extrabold [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">{cy.nom}</span>
                  <span className="titre text-sm font-bold text-white/60">0{i + 1}</span>
                </div>
                <div className={`lg:hidden absolute inset-x-5 top-7 flex items-center gap-3 text-white ${ouvert ? 'opacity-0' : ''}`}><I className="h-5 w-5" /><span className="titre font-extrabold text-xl">{cy.nom}</span></div>
                {/* Ouvert : le détail */}
                <div className={`absolute left-7 right-7 bottom-7 text-white transition-all duration-500 ${ouvert ? 'opacity-100 translate-y-0 delay-300' : 'opacity-0 translate-y-6 pointer-events-none'}`}>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[var(--c2)] px-3.5 py-1.5 text-sm font-bold">{cy.age}</span>
                  <p className="titre text-4xl md:text-5xl font-extrabold mt-4">{cy.nom}</p>
                  <p className="text-white/80 mt-1 font-semibold">{cy.niveaux}</p>
                  <p className="text-white/80 mt-3 max-w-lg">{cy.texte}</p>
                  <div className="mt-5 flex flex-wrap gap-2">{cy.points.map((p, j) => <span key={j} className="rounded-full bg-white/15 backdrop-blur px-3.5 py-1.5 text-sm font-semibold">{p}</span>)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Chiffres ─────────────────────────── */

export function ChiffresB() {
  const { edition } = useEdition();
  return (
    <Section className="py-20">
      <Boite>
        <Liste c="accueil.chiffres" colonnes={4} nouveau={{ valeur: '0', libelle: 'libellé' }}>
          {(el, i, ce) => (
            <Revele delai={i * 100} className="relative text-center lg:text-left lg:pl-8">
              {i > 0 && <span className="hidden lg:block absolute left-0 top-2 bottom-2 w-px bg-black/10" />}
              {edition ? <T c={`${ce}.valeur`} as="p" className="titre block text-6xl font-extrabold text-[var(--c1)]" />
                : <p className="titre text-6xl font-extrabold"><span className="text-[var(--c1)]"><Compteur valeur={el.valeur} /></span><span className="text-[var(--c2)]">.</span></p>}
              <T c={`${ce}.libelle`} as="p" className="block mt-2 text-[#55635d] font-semibold" />
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Une journée à l'école ─────────────────────────── */

export function JourneeB() {
  return (
    <Section className="py-24 px-3 md:px-5">
      <div className="relative max-w-[1400px] mx-auto rounded-[36px] bg-[var(--c1)] text-white overflow-hidden">
        <div className="absolute -left-40 -bottom-40 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <Boite className="relative grid lg:grid-cols-[0.9fr_1.1fr] gap-12 py-16 md:py-20">
          <div className="lg:sticky lg:top-32 self-start">
            <TitreB c="baobab.journee" clair />
            <Revele delai={200} className="mt-10 relative h-72 rounded-[28px] overflow-hidden"><Img c="baobab.journee.image" className="absolute inset-0 w-full h-full object-cover" /></Revele>
          </div>
          <div className="relative">
            <span className="absolute left-[38px] top-4 bottom-4 w-0.5 bg-white/15" />
            <Liste c="baobab.journee.elements" nouveau={{ heure: '00 h', titre: 'Moment', texte: 'Description.' }} className="space-y-4" libelleAjout="Ajouter un moment">
              {(_, i, ce) => (
                <Revele delai={i * 90} className="relative flex gap-5 items-start group">
                  <span className="relative z-10 h-[78px] w-[78px] rounded-3xl bg-white text-[var(--c1)] flex flex-col items-center justify-center flex-shrink-0 group-hover:bg-[var(--c2)] group-hover:text-white transition-colors duration-300">
                    <T c={`${ce}.heure`} className="titre font-extrabold text-lg leading-none text-center" />
                  </span>
                  <div className="flex-1 rounded-3xl bg-white/[0.07] border border-white/10 p-5 group-hover:bg-white/[0.12] transition-colors">
                    <T c={`${ce}.titre`} as="h3" className="titre block text-xl font-extrabold" />
                    <T c={`${ce}.texte`} as="p" className="block mt-1.5 text-white/70" />
                  </div>
                </Revele>
              )}
            </Liste>
          </div>
        </Boite>
      </div>
    </Section>
  );
}

/* ─────────────────────────── Évolution des résultats : barres animées ─────────────────────────── */

const SERIES = [
  { cle: 'cfee', nom: 'CFEE' },
  { cle: 'bfem', nom: 'BFEM' },
  { cle: 'bac', nom: 'Bac' },
] as const;

export function EvolutionB() {
  const { contenu, edition } = useEdition();
  const annees = contenu.baobab.evolution.annees;
  const [serie, setSerie] = useState<(typeof SERIES)[number]['cle']>('bfem');
  const [vu, setVu] = useState(false);
  const graphe = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = graphe.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVu(true); obs.disconnect(); } }, { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const derniere = annees[annees.length - 1];
  const premiere = annees[0];
  const gain = derniere && premiere ? Number(derniere[serie]) - Number(premiere[serie]) : 0;

  return (
    <Section className="py-24">
      <Boite className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 items-center">
        <div>
          <TitreB c="baobab.evolution" />
          <div className="mt-8 inline-flex rounded-2xl bg-[var(--doux)] p-1.5">
            {SERIES.map(s => (
              <button key={s.cle} type="button" onClick={() => setSerie(s.cle)}
                className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${serie === s.cle ? 'bg-white text-[var(--c1)] shadow-md' : 'text-[#55635d] hover:text-[var(--encre)]'}`}>{s.nom}</button>
            ))}
          </div>
          {derniere && (
            <div className="mt-8 flex gap-8">
              <div><p className="titre text-5xl font-extrabold text-[var(--c1)]">{derniere[serie]} %</p><p className="text-[#55635d] font-semibold mt-1">en {derniere.annee}</p></div>
              {gain > 0 && <div><p className="titre text-5xl font-extrabold text-[var(--c2)]">+{gain}</p><p className="text-[#55635d] font-semibold mt-1">points depuis {premiere.annee}</p></div>}
            </div>
          )}
        </div>

        <div ref={graphe} className="rounded-[32px] bg-[var(--doux)] p-6 md:p-10">
          <div className="relative h-80 flex items-end gap-3 md:gap-6">
            {[25, 50, 75, 100].map(g => (
              <span key={g} className="absolute inset-x-0 border-t border-dashed border-black/10 text-[11px] text-[#8a978f] font-semibold" style={{ bottom: `${g}%` }}><span className="absolute -top-2.5 -left-1 bg-[var(--doux)] pr-1">{g}</span></span>
            ))}
            {annees.map((a, i) => {
              const v = Math.min(100, Math.max(0, Number(a[serie]) || 0));
              const dernier = i === annees.length - 1;
              return (
                <div key={i} className="relative flex-1 h-full flex flex-col justify-end items-center group">
                  <span className={`mb-2 titre font-extrabold text-sm transition-all duration-500 ${vu ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${dernier ? 'text-[var(--c2)]' : 'text-[var(--c1)]'}`} style={{ transitionDelay: `${700 + i * 120}ms` }}>{v} %</span>
                  <div className={`w-full max-w-[64px] rounded-t-2xl rounded-b-md transition-[height] duration-[1200ms] ease-[cubic-bezier(.2,.8,.2,1)] ${dernier ? 'bg-[var(--c2)]' : 'bg-[var(--c1)] group-hover:brightness-125'}`}
                    style={{ height: vu ? `${v}%` : '0%', transitionDelay: `${i * 120}ms` }} />
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 md:gap-6 mt-3">
            {annees.map((a, i) => <span key={i} className="flex-1 text-center text-sm font-bold text-[#55635d]">{a.annee}</span>)}
          </div>
          {edition && (
            <div className="mt-8 rounded-2xl bg-white p-4 font-sans text-sm">
              <p className="font-semibold mb-3">Taux de réussite par année (en %)</p>
              <Liste c="baobab.evolution.annees" nouveau={{ annee: '2027', cfee: '0', bfem: '0', bac: '0' }} className="space-y-2" libelleAjout="Ajouter une année">
                {(_, __, ce) => (
                  <div className="grid grid-cols-4 gap-2 items-center">
                    <T c={`${ce}.annee`} className="font-bold" />
                    <span>CFEE <T c={`${ce}.cfee`} /></span><span>BFEM <T c={`${ce}.bfem`} /></span><span>Bac <T c={`${ce}.bac`} /></span>
                  </div>
                )}
              </Liste>
            </div>
          )}
        </div>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Mot du directeur ─────────────────────────── */

export function MotB() {
  return (
    <Section className="py-24">
      <Boite className="grid lg:grid-cols-[0.9fr_1.1fr] gap-14 items-center">
        <Revele className="relative">
          <div className="relative aspect-[4/5] max-w-md rounded-[36px] overflow-hidden"><Img c="accueil.mot.image" className="absolute inset-0 w-full h-full object-cover" /></div>
          <div className="absolute -bottom-6 right-0 md:right-10 rounded-3xl bg-white shadow-2xl p-5 flex items-center gap-4 flottement">
            <span className="h-14 w-14 rounded-2xl bg-[var(--c1)] text-white flex items-center justify-center"><Quote className="h-6 w-6" /></span>
            <span className="leading-tight"><T c="accueil.mot.nom" className="block titre font-extrabold text-lg" /><T c="accueil.mot.fonction" className="block text-sm text-[#6b7a73]" /></span>
          </div>
          <span className="absolute -left-5 -top-5 h-24 w-24 rounded-[28px] bg-[var(--c2)] -z-10 rotate-12" />
        </Revele>
        <div>
          <TitreB c="accueil.mot" texte={false} />
          <Revele delai={200}><T c="accueil.mot.texte" as="div" className="block mt-7 text-[17px] text-[#55635d] leading-relaxed" /></Revele>
        </div>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Témoignages : deux rangées en sens contraire ─────────────────────────── */

export function TemoignagesB() {
  const { contenu, edition } = useEdition();
  const liste = contenu.accueil.temoignages.elements;
  const carte = (t: (typeof liste)[number], j: number) => (
    <figure key={j} className="w-[380px] flex-shrink-0 rounded-[28px] bg-white border border-black/5 p-7 mx-3 shadow-[0_10px_30px_-20px_rgba(13,31,25,0.4)]">
      <Quote className="h-8 w-8 text-[var(--c2)]" />
      <blockquote className="mt-4 text-[#43514b] leading-relaxed line-clamp-4">{t.texte}</blockquote>
      <figcaption className="flex items-center gap-3 mt-6">{t.photo && <img src={t.photo} alt="" className="h-12 w-12 rounded-2xl object-cover" />}<span><span className="block font-bold">{t.nom}</span><span className="block text-sm text-[#6b7a73]">{t.role}</span></span></figcaption>
    </figure>
  );
  if (edition) {
    return (
      <Section className="py-24 bg-[var(--doux)]">
        <Boite>
          <TitreB c="accueil.temoignages" centre className="mb-12" texte={false} />
          <Liste c="accueil.temoignages.elements" colonnes={3} nouveau={{ texte: 'Témoignage…', nom: 'Nom', role: 'Parent d\'élève', photo: '' }}>
            {(_, __, ce) => (
              <div className="rounded-[28px] bg-white p-7">
                <T c={`${ce}.texte`} as="p" className="block text-[#43514b]" />
                <div className="flex items-center gap-3 mt-5"><span className="relative h-12 w-12 rounded-2xl overflow-hidden"><Img c={`${ce}.photo`} className="absolute inset-0 w-full h-full object-cover" /></span><span><T c={`${ce}.nom`} className="block font-bold" /><T c={`${ce}.role`} className="block text-sm text-[#6b7a73]" /></span></div>
              </div>
            )}
          </Liste>
        </Boite>
      </Section>
    );
  }
  // Assez de cartes pour remplir l'écran, même avec deux ou trois témoignages.
  const plein = Array.from({ length: Math.max(6, liste.length * 2) }, (_, j) => liste[j % Math.max(liste.length, 1)]).filter(Boolean);
  return (
    <Section className="py-24 bg-[var(--doux)] overflow-hidden">
      <span data-temoignages className="block -translate-y-24" />
      <Boite><TitreB c="accueil.temoignages" centre className="mb-14" texte={false} /></Boite>
      <div className="space-y-6 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
        <div className="flex w-max animate-[defilement_55s_linear_infinite] hover:[animation-play-state:paused]">{plein.map(carte)}{plein.map((t, j) => carte(t, j + 100))}</div>
        <div className="flex w-max animate-[defilement-inverse_55s_linear_infinite] hover:[animation-play-state:paused]">{[...plein].reverse().map(carte)}{[...plein].reverse().map((t, j) => carte(t, j + 100))}</div>
      </div>
    </Section>
  );
}

/* ─────────────────────────── Actualités : carrousel à glisser ─────────────────────────── */

export function CarrouselActusB({ titre = true }: { titre?: boolean }) {
  const { contenu } = useEdition();
  const rail = useRef<HTMLDivElement>(null);
  const [progres, setProgres] = useState(0);
  const defiler = (sens: number) => rail.current?.scrollBy({ left: sens * 400, behavior: 'smooth' });
  const surDefilement = () => {
    const r = rail.current;
    if (r) setProgres(r.scrollLeft / Math.max(1, r.scrollWidth - r.clientWidth));
  };
  return (
    <>
      <Boite className="flex flex-wrap items-end justify-between gap-6 mb-10">
        {titre ? <TitreB c="accueil.actualites" texte={false} /> : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={() => defiler(-1)} aria-label="Précédent" className="h-14 w-14 rounded-2xl border-2 border-[var(--c1-15)] flex items-center justify-center hover:bg-[var(--c1)] hover:text-white hover:border-[var(--c1)] transition-colors"><ArrowLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => defiler(1)} aria-label="Suivant" className="h-14 w-14 rounded-2xl bg-[var(--c1)] text-white flex items-center justify-center hover:bg-[var(--c2)] transition-colors"><ArrowRight className="h-5 w-5" /></button>
        </div>
      </Boite>
      <div ref={rail} onScroll={surDefilement} className="flex gap-6 overflow-x-auto snap-x snap-mandatory px-5 md:px-[max(2rem,calc((100vw-1260px)/2+2rem))] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {contenu.actualites.elements.map((a, i) => (
          <Revele key={a.id} delai={i * 90} className="snap-start flex-shrink-0 w-[85vw] sm:w-[380px]">
            <a href={`#/actualites/${encodeURIComponent(a.id)}`} className="group block">
              <div className="relative h-64 rounded-[28px] overflow-hidden">
                {a.image && <img src={a.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}
                <span className="absolute left-4 top-4 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-[var(--c1)]">{a.categorie}</span>
                <span className="absolute right-4 bottom-4 h-12 w-12 rounded-2xl bg-[var(--c2)] text-white flex items-center justify-center scale-0 group-hover:scale-100 transition-transform duration-300"><ArrowUpRight className="h-5 w-5" /></span>
              </div>
              <p className="flex items-center gap-2 text-sm text-[#6b7a73] font-semibold mt-5"><CalendarDays className="h-4 w-4" />{a.date}</p>
              <p className="titre text-xl font-extrabold mt-2 leading-snug group-hover:text-[var(--c1)] transition-colors">{a.titre}</p>
            </a>
          </Revele>
        ))}
      </div>
      <Boite className="mt-8"><div className="h-1 rounded-full bg-black/5 overflow-hidden"><div className="h-full rounded-full bg-[var(--c1)] transition-[width] duration-200" style={{ width: `${Math.max(12, progres * 100)}%` }} /></div></Boite>
    </>
  );
}

export function ActusB() {
  return <Section className="py-24 overflow-hidden"><CarrouselActusB /></Section>;
}

/* ─────────────────────────── Une question ? ─────────────────────────── */

export function QuestionB() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  return (
    <Section className="py-16 px-3 md:px-5">
      <div className="relative max-w-[1400px] mx-auto rounded-[36px] bg-[var(--c2)] text-white overflow-hidden">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full border-[44px] border-white/10" />
        <div className="absolute left-1/3 -bottom-24 h-60 w-60 rounded-full bg-white/10" />
        <Boite className="relative py-14 md:py-16 grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
          <div>
            <T c="baobab.question.titre" as="h2" className="titre block text-4xl md:text-5xl font-extrabold leading-[1.08]" />
            <T c="baobab.question.texte" as="p" className="block mt-4 text-lg text-white/85 max-w-xl" />
          </div>
          <div className="flex flex-wrap lg:justify-end gap-3">
            {id.whatsapp && <a href={lienWhatsApp(id.whatsapp, id.messageWhatsApp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2.5 h-14 px-7 rounded-2xl bg-white text-[var(--encre)] font-bold hover:bg-[var(--encre)] hover:text-white transition-colors"><IconeWhatsApp className="h-5 w-5 text-[#25D366]" />WhatsApp</a>}
            <Bouton c="baobab.question.bouton" className="inline-flex items-center h-14 px-7 rounded-2xl bg-[var(--encre)] text-white font-bold hover:bg-white hover:text-[var(--encre)] transition-colors" />
          </div>
        </Boite>
      </div>
    </Section>
  );
}

/* ─────────────────────────── Cartes à icône (valeurs, pédagogie, services) ─────────────────────────── */

export function IconesB({ c, doux = false }: { c: string; doux?: boolean }) {
  return (
    <Section className={`py-24 ${doux ? 'bg-[var(--doux)]' : ''}`}>
      <Boite>
        <TitreB c={c} className="mb-12" />
        <Liste c={`${c}.elements`} colonnes={4} nouveau={{ icone: 'star', titre: 'Nouveau', texte: 'Description.' }} classeElement="flex">
          {(_, i, ce) => (
            <Revele delai={(i % 4) * 90} className={`w-full group rounded-[28px] p-7 transition-all duration-500 hover:-translate-y-1.5 ${doux ? 'bg-white' : 'bg-[var(--doux)]'} hover:bg-[var(--c1)] hover:text-white`}>
              <span className="h-14 w-14 rounded-2xl bg-[var(--c2)] text-white flex items-center justify-center group-hover:rotate-[-8deg] transition-transform duration-500"><Icone c={`${ce}.icone`} className="h-7 w-7" /></span>
              <T c={`${ce}.titre`} as="h3" className="titre block text-xl font-extrabold mt-6" />
              <T c={`${ce}.texte`} as="p" className="block mt-2 text-[#55635d] group-hover:text-white/75 leading-relaxed transition-colors" />
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Résultats (cartes) ─────────────────────────── */

export function ResultatsB() {
  const { edition } = useEdition();
  return (
    <Section className="py-24">
      <Boite>
        <TitreB c="accueil.resultats" centre className="mb-12" />
        <Liste c="accueil.resultats.elements" colonnes={3} nouveau={{ examen: 'Examen', taux: '0 %', detail: 'Détail' }} classeElement="flex">
          {(el, i, ce) => (
            <Revele delai={i * 110} className={`w-full rounded-[28px] p-8 ${i === 1 ? 'bg-[var(--c1)] text-white' : 'bg-[var(--doux)]'}`}>
              <T c={`${ce}.examen`} className={`inline-block rounded-full px-4 py-1.5 font-bold text-sm ${i === 1 ? 'bg-white/15' : 'bg-white text-[var(--c1)]'}`} />
              {edition ? <T c={`${ce}.taux`} as="p" className="titre block text-7xl font-extrabold mt-6" /> : <p className="titre text-7xl font-extrabold mt-6"><Compteur valeur={el.taux} /></p>}
              <T c={`${ce}.detail`} as="p" className={`block mt-2 ${i === 1 ? 'text-white/75' : 'text-[#55635d]'}`} />
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Réseaux ─────────────────────────── */

export function SuivezB() {
  const { contenu, edition, ouvrirIdentite } = useEdition();
  const id = contenu.identite;
  const liens = [
    ...id.reseaux.filter(r => r.url).map(r => ({ ...(STYLE_RESEAU[r.type] ?? STYLE_RESEAU.site), nom: TYPES_RESEAUX[r.type], url: r.url })),
    ...(id.whatsapp ? [{ Icone: IconeWhatsApp, couleur: '#25D366', nom: 'WhatsApp', url: lienWhatsApp(id.whatsapp, id.messageWhatsApp) }] : []),
  ];
  return (
    <Section className="py-24 bg-[var(--doux)]">
      <Boite>
        <TitreB c="accueil.suivez" centre className="mb-12" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {liens.map((l, i) => (
            <Revele key={i} delai={i * 80}>
              <a href={l.url} target="_blank" rel="noreferrer" className="group flex flex-col items-center gap-3 rounded-[28px] bg-white p-7 hover:-translate-y-1 transition-transform">
                <span className="h-16 w-16 rounded-2xl text-white flex items-center justify-center group-hover:scale-110 transition-transform" style={{ background: l.couleur }}><l.Icone className="h-7 w-7" /></span>
                <span className="font-bold">{l.nom}</span>
              </a>
            </Revele>
          ))}
        </div>
        {edition && <p className="text-center mt-6"><button type="button" className="outil" onClick={() => ouvrirIdentite(true)}>Modifier nos réseaux</button></p>}
      </Boite>
    </Section>
  );
}

