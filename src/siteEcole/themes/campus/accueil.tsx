import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, Award, CalendarDays, CheckCircle2, ChevronDown, Clock, FileDown, MapPin, Play, Plus, Quote, Trash2, X,
} from 'lucide-react';
import { Bouton, ICONES, Icone, Img, Liste, Section, T, useEdition } from '../../edition';
import { ajouterElement, retirerElement } from '../../chemin';
import { NOUVEAU_CYCLE } from '../../composants';
import { TYPES_RESEAUX } from '../../contenu';
import { IconeWhatsApp, STYLE_RESEAU } from '../../reseaux';
import { integrationDepuisUrl, lienWhatsApp } from '../../utilitaires';
import { Compteur, Revele } from '../prestige/GabaritPrestige';
import { Boite, CLASSE_BOUTON_BLANC, CLASSE_BOUTON_JAUNE, Cadre, Sourcil, TitreC, useRempli } from './GabaritCampus';

/** Flèche ronde à droite des boutons jaunes. */
const FlecheRonde = () => (
  <span className="h-10 w-10 rounded-full bg-[var(--c1)] text-white flex items-center justify-center transition-transform duration-300 group-hover/b:rotate-45"><ArrowUpRight className="h-4 w-4" /></span>
);

/* ─────────────────────────── Ouverture ─────────────────────────── */

export function HeroC() {
  const { contenu, edition, maj, majListe } = useEdition();
  const c = contenu.campus;
  const diapos = contenu.accueil.diapos;
  const [i, setI] = useState(0);
  const [video, setVideo] = useState(false);
  const n = diapos.length;
  const k = Math.min(i, n - 1);
  const mot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (edition || n < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % n), 7000);
    return () => clearInterval(t);
  }, [edition, n]);
  // Le grand mot descend légèrement plus lentement que la page : effet de profondeur.
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const f = () => { if (mot.current) mot.current.style.transform = `translate3d(-50%, ${Math.min(window.scrollY, 600) * 0.35}px, 0)`; };
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const integration = integrationDepuisUrl(c.video);
  if (n === 0) return null;

  return (
    <section className="relative min-h-[100svh] overflow-hidden text-white"
      style={{ background: 'linear-gradient(180deg, var(--c1) 0%, color-mix(in srgb, var(--c1) 62%, #4f9be8) 26%, color-mix(in srgb, var(--c1) 40%, #8cc2f5) 48%, color-mix(in srgb, var(--c1) 30%, #cfe6ff) 70%)' }}>
      {/* Le grand mot, derrière la photo */}
      <div ref={mot} className="absolute left-1/2 top-[13vh] md:top-[110px] -translate-x-1/2 w-full text-center pointer-events-none select-none z-0">
        <span className="titre font-extrabold uppercase leading-none tracking-tight whitespace-nowrap inline-block"
          style={{ fontSize: `clamp(4rem, ${Math.min(19, 150 / Math.max(c.motGeant.length, 6))}vw, 17rem)`, backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,.62) 0%, rgba(255,255,255,.18) 75%, rgba(255,255,255,0) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          {c.motGeant}
        </span>
      </div>

      {/* Les photos : leur haut se fond dans le ciel, le mot reste lisible au-dessus */}
      {diapos.map((_, j) => (
        <div key={j} className={`absolute inset-x-0 bottom-0 h-[64%] z-10 transition-opacity duration-[1400ms] ${j === k ? 'opacity-100' : 'opacity-0'}`}
          style={{ WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 38%)', maskImage: 'linear-gradient(180deg, transparent 0%, black 38%)' }}>
          <Img c={`accueil.diapos.${j}.image`} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[8000ms] ease-out ${j === k ? 'scale-100' : 'scale-110'}`} />
        </div>
      ))}
      {c.detoure && <img src={c.detoure} alt="" className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[78%] object-contain z-20 pointer-events-none" />}
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#0A1A33]/85 via-[#0A1A33]/40 to-transparent z-20 pointer-events-none" />

      <Boite className="relative z-30 min-h-[100svh] flex flex-col justify-end pb-14 md:pb-20">
        <div className="flex flex-col lg:flex-row lg:items-end gap-10">
          <div key={k} className="flex-1 max-w-3xl">
            <Revele><p className="flex items-center gap-2.5 font-medium text-white/90"><span className="h-8 w-8 rounded-full bg-white/15 backdrop-blur flex items-center justify-center"><Award className="h-4 w-4 text-[var(--c2)]" /></span><T c={`accueil.diapos.${k}.surtitre`} /></p></Revele>
            <Revele delai={120}><T c={`accueil.diapos.${k}.titre`} as="h1" className="titre block text-[2.6rem] sm:text-6xl lg:text-[4.2rem] font-bold leading-[1.08] mt-5 [text-wrap:balance] drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)]" /></Revele>
            <Revele delai={240}><T c={`accueil.diapos.${k}.texte`} as="p" className="block mt-5 text-lg text-white/85 max-w-xl" /></Revele>
            <Revele delai={360} className="mt-8 flex flex-wrap items-center gap-4">
              <Bouton c="accueil.bouton1" className={CLASSE_BOUTON_JAUNE} />
              <Bouton c="accueil.bouton2" className="inline-flex items-center h-[52px] px-7 rounded-full border border-white/40 text-white font-semibold hover:bg-white hover:text-[var(--encre)] transition-colors duration-300" />
            </Revele>
          </div>

          {(integration || edition) && (
            <div className="flex flex-col items-center gap-3 lg:mb-4">
              <button type="button" onClick={() => integration && setVideo(true)} aria-label={c.videoLibelle}
                className="pulsation relative h-24 w-24 rounded-full bg-white/15 backdrop-blur-md border border-white/40 flex items-center justify-center hover:bg-[var(--c2)] hover:text-[var(--encre)] transition-colors duration-300">
                <Play className="h-8 w-8 ml-1" fill="currentColor" />
              </button>
              <T c="campus.videoLibelle" className="titre font-semibold text-lg" />
              {edition && (
                <input value={c.video} onChange={e => maj('campus.video', e.target.value)} placeholder="Lien YouTube ou Facebook de la vidéo"
                  className="w-64 rounded-lg bg-white/95 text-[var(--encre)] text-xs px-3 py-2 font-sans" />
              )}
            </div>
          )}
        </div>

        {n > 1 && (
          <div className="mt-12 flex items-center gap-3">
            {diapos.map((_, j) => (
              <button key={j} type="button" onClick={() => setI(j)} aria-label={`Diapositive ${j + 1}`} className="group py-2">
                <span className={`block h-1 rounded-full transition-all duration-500 ${j === k ? 'w-14 bg-[var(--c2)]' : 'w-6 bg-white/40 group-hover:bg-white/70'}`} />
              </button>
            ))}
            {edition && (
              <span className="ml-4 flex gap-2">
                <button type="button" className="outil" onClick={() => { majListe('accueil.diapos', l => ajouterElement(l, structuredClone(l[k]), k)); setI(k + 1); }}><Plus className="h-3.5 w-3.5" />Photo</button>
                <button type="button" className="outil text-red-600" onClick={() => { majListe('accueil.diapos', l => retirerElement(l, k)); setI(0); }}><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            )}
          </div>
        )}
        {edition && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 flex items-center gap-2 font-sans">
            <span className="outil">Grand mot : <input value={c.motGeant} onChange={e => maj('campus.motGeant', e.target.value.toUpperCase())} className="w-40 border rounded px-1.5 py-0.5" /></span>
          </div>
        )}
      </Boite>

      {video && integration && (
        <div className="fixed inset-0 z-[70] bg-[#0A1A33]/90 backdrop-blur flex items-center justify-center p-4 apparition" onClick={() => setVideo(false)}>
          <button type="button" aria-label="Fermer" className="absolute top-5 right-5 h-12 w-12 rounded-full bg-[var(--c2)] text-[var(--encre)] flex items-center justify-center"><X /></button>
          <div className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden bg-black" onClick={e => e.stopPropagation()}>
            {integration.type === 'video'
              ? <video src={integration.src} controls autoPlay className="w-full h-full" />
              : <iframe src={`${integration.src}${integration.src.includes('?') ? '&' : '?'}autoplay=1`} title={c.videoLibelle} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── Cycles : cartes qui s'ouvrent ─────────────────────────── */

const ICONES_CYCLES = ['bebe', 'book', 'graduation', 'science', 'star', 'trophy'];

export function ProgrammesC() {
  const [ouvert, setOuvert] = useState<number | null>(null);
  return (
    <Section className="relative py-24 md:py-28">
      <Boite>
        <TitreC c="accueil.cycles" centre className="mb-14" />
        <Liste c="enseignement.cycles" colonnes={4} nouveau={NOUVEAU_CYCLE} classeElement="flex" libelleAjout="Ajouter un cycle">
          {(cy, i, ce) => (
            <Revele delai={i * 90} className="w-full pb-5">
              <div className={`relative h-full bg-white rounded-[20px] p-7 pb-10 shadow-[0_10px_40px_-18px_rgba(11,58,102,0.35)] transition-all duration-500 hover:-translate-y-1.5 ${ouvert === i ? 'ring-2 ring-[var(--c2)]' : ''}`}>
                <span className="absolute left-0 top-6 h-16 w-3 hachures rounded-r" />
                <span className="h-14 w-14 rounded-2xl bg-[var(--c1)] text-[var(--c2)] flex items-center justify-center">
                  {(() => { const I = ICONES[ICONES_CYCLES[i % ICONES_CYCLES.length]]; return <I className="h-7 w-7" />; })()}
                </span>
                <T c={`${ce}.nom`} as="h3" className="titre block text-2xl font-bold mt-6 text-[var(--c1)]" />
                <T c={`${ce}.niveaux`} as="p" className="block text-[15px] text-[#5b6472] mt-2" />
                <div className={`grid transition-[grid-template-rows] duration-500 ${ouvert === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden">
                    <T c={`${ce}.texte`} as="p" className="block text-[15px] text-[#5b6472] mt-4 leading-relaxed" />
                    <ul className="mt-4 space-y-2">
                      {(cy as typeof NOUVEAU_CYCLE).points.map((_, j) => (
                        <li key={j} className="flex gap-2 text-[14px] font-medium"><CheckCircle2 className="h-4 w-4 text-[var(--c1)] mt-0.5 flex-shrink-0" /><T c={`${ce}.points.${j}`} /></li>
                      ))}
                    </ul>
                    <a href="#/enseignement" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--c1)] hover:gap-2.5 transition-all">Le programme <ArrowRight className="h-4 w-4" /></a>
                  </div>
                </div>
                <button type="button" onClick={() => setOuvert(o => (o === i ? null : i))} aria-label={ouvert === i ? 'Refermer' : 'En savoir plus'}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-[var(--c2)] text-[var(--encre)] ring-[6px] ring-[var(--fond)] flex items-center justify-center hover:scale-110 transition-transform">
                  <ChevronDown className={`h-5 w-5 transition-transform duration-500 ${ouvert === i ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </Revele>
          )}
        </Liste>
      </Boite>
      <span className="hidden lg:block absolute right-[6%] bottom-6 text-[var(--c1)] flotte" aria-hidden="true">
        <svg viewBox="0 0 64 64" className="h-24 w-24 drop-shadow-xl"><path d="M32 10 L60 22 L32 34 L4 22 Z" fill="currentColor" /><path d="M16 28 V40 C16 45 24 49 32 49 C40 49 48 45 48 40 V28 L32 35 Z" fill="currentColor" opacity=".85" /><path d="M58 23 V38" stroke="var(--c2)" strokeWidth="2.5" /><circle cx="58" cy="40" r="3" fill="var(--c2)" /></svg>
      </span>
    </Section>
  );
}

/* ─────────────────────────── À propos ─────────────────────────── */

export function AproposC() {
  return (
    <Section className="py-24 md:py-28">
      <Boite className="grid lg:grid-cols-2 gap-14 items-center">
        <div className="grid gap-5">
          <Revele><Cadre c="campus.apropos.image1" className="group h-64 md:h-72" /></Revele>
          <Revele delai={150} className="lg:ml-16"><Cadre c="campus.apropos.image2" className="group h-64 md:h-72" /></Revele>
        </div>
        <div>
          <TitreC c="campus.apropos" />
          <div className="mt-8 grid sm:grid-cols-[1fr_auto] gap-6 items-start">
            <Liste c="campus.apropos.points" nouveau="Nouveau point" className="space-y-3.5">
              {(_, __, cp) => <p className="flex items-center gap-3 font-semibold"><CheckCircle2 className="h-5 w-5 text-[var(--c1)] flex-shrink-0" /><T c={cp} /></p>}
            </Liste>
            <Revele delai={200} className="relative overflow-hidden rounded-2xl bg-[var(--c1)] text-white p-6 sm:w-64">
              <span className="absolute left-0 top-0 h-full w-2 hachures opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, rgba(255,255,255,.25) 0 2px, transparent 2px 8px)' }} />
              <Award className="h-10 w-10 text-[var(--c2)]" />
              <T c="campus.apropos.distinction.valeur" as="p" className="titre block text-3xl font-bold mt-3" />
              <T c="campus.apropos.distinction.texte" as="p" className="block text-white/75 text-sm mt-1" />
            </Revele>
          </div>
          <div className="mt-9"><Bouton c="campus.apropos.bouton" className={CLASSE_BOUTON_BLANC} /></div>
        </div>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Le grand bloc bleu à onglets ─────────────────────────── */

export function VieCampusC() {
  const { contenu } = useEdition();
  const onglets = [
    { nom: 'Nos cycles', icone: 'graduation', chemin: 'enseignement.cycles', titre: 'nom' },
    { nom: 'Activités', icone: 'trophy', chemin: 'vieScolaire.activites.elements', titre: 'titre' },
    { nom: 'Infrastructures', icone: 'bibliotheque', chemin: 'ecole.infrastructures.elements', titre: 'titre' },
  ] as const;
  const [o, setO] = useState(0);
  const onglet = onglets[o];
  const elements = (onglet.chemin.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], contenu) as unknown[] ?? []).slice(0, 4);
  const visages = [...contenu.ecole.equipe.elements.map(e => e.photo), ...contenu.accueil.temoignages.elements.map(t => t.photo)].filter(Boolean).slice(0, 5);

  return (
    <Section className="px-3 md:px-6">
      <div className="relative max-w-[1320px] mx-auto rounded-[28px] bg-[var(--c1)] text-white overflow-hidden px-5 md:px-12 py-16 md:py-20">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/[0.04]" />
        <div className="absolute right-0 bottom-0 h-64 w-64 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '18px 18px' }} />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
          <TitreC c="campus.vie" clair texte={false} />
          <div className="flex flex-wrap gap-2">
            {onglets.map((x, j) => (
              <button key={x.nom} type="button" onClick={() => setO(j)}
                className={`relative flex items-center gap-2 px-4 py-3 titre font-semibold text-[17px] transition-colors ${j === o ? 'text-[var(--c2)]' : 'text-white/80 hover:text-white'}`}>
                {x.nom}
                <span className={`absolute left-4 right-4 bottom-1 h-0.5 bg-[var(--c2)] transition-transform duration-500 origin-left ${j === o ? 'scale-x-100' : 'scale-x-0'}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="relative grid lg:grid-cols-[340px_1fr] gap-6">
          <div className="space-y-6">
            <div className="rounded-[20px] bg-[#0A1A33]/70 border border-white/10 p-7 text-center">
              <div className="flex justify-center -space-x-3">
                {visages.map((v, j) => <img key={j} src={v} alt="" className="h-12 w-12 rounded-full object-cover ring-[3px] ring-[var(--c1)]" />)}
              </div>
              <T c="campus.vie.inscrits" as="p" className="titre block text-4xl font-bold mt-5 text-[var(--c2)]" />
              <T c="campus.vie.inscritsTexte" as="p" className="block text-white/75 mt-1" />
              <div className="mt-6"><Bouton c="campus.vie.bouton" className={CLASSE_BOUTON_JAUNE} /></div>
            </div>
            <CarteCommuniques />
          </div>

          <div key={o} className="grid sm:grid-cols-2 gap-5 content-start">
            {elements.map((_, j) => (
              <Revele key={j} delai={j * 90} className="group relative h-64 lg:h-[270px] rounded-[20px] overflow-hidden border-[6px] border-white/10">
                <Img c={`${onglet.chemin}.${j}.image`} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1A33]/90 via-[#0A1A33]/15 to-transparent pointer-events-none" />
                <a href={onglet.chemin.startsWith('enseignement') ? '#/enseignement' : onglet.chemin.startsWith('ecole') ? '#/ecole' : '#/vie-scolaire'}
                  className="absolute left-5 right-5 bottom-5 flex items-center justify-between gap-3">
                  <T c={`${onglet.chemin}.${j}.${onglet.titre}`} className="titre text-xl font-bold" />
                  <span className="h-10 w-10 rounded-full bg-[var(--c2)] text-[var(--encre)] flex items-center justify-center translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500"><ArrowUpRight className="h-5 w-5" /></span>
                </a>
              </Revele>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Le panneau des communiqués de la direction (numérotés, avec document à télécharger). */
export function CarteCommuniques({ grande = false }: { grande?: boolean }) {
  return (
    <div className={`rounded-[20px] bg-white text-[var(--encre)] ${grande ? 'p-8 md:p-10' : 'p-7'}`}>
      <p className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--c2)] ring-4 ring-[var(--c2-25)]" /><T c="campus.communiques.titre" className={`titre font-bold ${grande ? 'text-3xl' : 'text-xl'}`} /></p>
      <Liste c="campus.communiques.elements" nouveau={{ titre: 'Nouveau communiqué', date: 'Date', reference: 'N° …', lien: '' }} className={`mt-5 divide-y divide-black/10 ${grande ? 'md:columns-1' : ''}`} libelleAjout="Ajouter un communiqué">
        {(el, _, ce) => (
          <div className="py-4 flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              <T c={`${ce}.titre`} as="p" className={`titre block font-semibold leading-snug ${grande ? 'text-xl' : 'text-[17px]'}`} />
              <p className="flex items-center gap-1.5 text-sm text-[#5b6472] mt-2"><CalendarDays className="h-4 w-4" /><T c={`${ce}.date`} /></p>
              <T c={`${ce}.reference`} as="p" className="block text-xs uppercase tracking-wider text-[#8a93a1] mt-1.5" />
            </div>
            {(el as { lien: string }).lien
              ? <a href={(el as { lien: string }).lien} target="_blank" rel="noreferrer" aria-label="Télécharger le communiqué" className="h-10 w-10 rounded-full bg-[var(--fond)] text-[var(--c1)] flex items-center justify-center hover:bg-[var(--c2)] transition-colors flex-shrink-0"><FileDown className="h-5 w-5" /></a>
              : <span className="h-10 w-10 rounded-full bg-[var(--fond)] text-[#b0b7c2] flex items-center justify-center flex-shrink-0"><FileDown className="h-5 w-5" /></span>}
          </div>
        )}
      </Liste>
    </div>
  );
}

export function CommuniquesC() {
  return (
    <Section className="py-24">
      <Boite className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
        <div className="lg:sticky lg:top-32">
          <Sourcil c="campus.communiques.titre" />
          <h2 className="titre text-4xl md:text-5xl font-bold mt-4 leading-[1.15]">Les annonces officielles de la direction</h2>
          <p className="mt-5 text-[#5b6472] text-[17px]">Rentrée, compositions, fournitures, réunions : chaque communiqué est daté, numéroté et téléchargeable.</p>
        </div>
        <CarteCommuniques grande />
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Grand bandeau des résultats ─────────────────────────── */

export function BandeauResultatsC() {
  const { contenu, edition } = useEdition();
  const elements = [...contenu.accueil.resultats.elements.map(r => `${r.examen} ${r.taux}`), ...contenu.campus.bandeau];
  if (edition) {
    return (
      <Section className="py-14">
        <Boite>
          <p className="text-sm text-[#5b6472] mb-3 font-sans">Le bandeau reprend vos résultats aux examens, puis ces mentions :</p>
          <Liste c="campus.bandeau" nouveau="Nouvelle mention" className="flex flex-wrap gap-3">
            {(_, __, ce) => <T c={ce} className="inline-block rounded-full bg-white px-5 py-2.5 titre font-bold text-[var(--c1)]" />}
          </Liste>
        </Boite>
      </Section>
    );
  }
  const ligne = (
    <div className="flex items-center">
      {elements.map((t, j) => (
        <span key={j} className="flex items-center whitespace-nowrap">
          <span className={`titre font-extrabold uppercase px-8 text-5xl md:text-7xl ${j % 2 ? 'text-[var(--c2)]' : 'text-[var(--c1)]'}`}>{t}</span>
          <span className="h-14 w-14 md:h-16 md:w-16 rounded-full border-2 border-[var(--c1)] flex items-center justify-center text-[var(--c1)]"><Award className="h-7 w-7" /></span>
        </span>
      ))}
    </div>
  );
  return (
    <section className="py-16 md:py-20 overflow-hidden" aria-label="Nos résultats">
      <div className="flex w-max animate-[defilement_45s_linear_infinite] hover:[animation-play-state:paused]">{ligne}{ligne}</div>
    </section>
  );
}

/* ─────────────────────────── Agenda ─────────────────────────── */

export function AgendaC() {
  return (
    <Section className="py-20 md:py-24">
      <Boite>
        <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <TitreC c="campus.agenda" texte={false} />
          <a href="#/vie-scolaire" className={CLASSE_BOUTON_BLANC}>Toute la vie scolaire <ArrowRight className="h-4 w-4" /></a>
        </div>
        <Liste c="campus.agenda.elements" colonnes={2} nouveau={{ image: '', date: 'Date', heure: 'Heure', titre: 'Événement', lieu: 'Lieu' }} classeElement="flex" libelleAjout="Ajouter un rendez-vous">
          {(_, i, ce) => (
            <Revele delai={(i % 2) * 120} className="w-full group relative bg-white rounded-[20px] p-3 flex gap-5 shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)] hover:shadow-[0_20px_50px_-20px_rgba(11,58,102,0.45)] transition-shadow">
              <div className="relative h-32 w-32 sm:h-36 sm:w-40 flex-shrink-0 rounded-2xl overflow-hidden">
                <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div className="py-2 pr-3 flex-1 min-w-0">
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#5b6472]">
                  <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-[var(--c1)]" /><T c={`${ce}.date`} /></span>
                  <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-[var(--c1)]" /><T c={`${ce}.heure`} /></span>
                </p>
                <T c={`${ce}.titre`} as="h3" className="titre block text-xl md:text-[22px] font-bold mt-2.5 leading-snug group-hover:text-[var(--c1)] transition-colors" />
                <p className="flex items-center gap-1.5 text-[14px] text-[#5b6472] mt-2.5"><MapPin className="h-4 w-4" /><T c={`${ce}.lieu`} /></p>
              </div>
              <span className="absolute right-0 bottom-0 h-14 w-14 hachures rounded-br-[20px] opacity-70" />
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Le mot du directeur, sur la photo de l'école ─────────────────────────── */

export function MotC() {
  return (
    <Section className="relative pt-10">
      <div className="absolute inset-x-0 bottom-0 h-[62%] overflow-hidden">
        <Img c="campus.appelImage" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#0A1A33]/45" />
      </div>
      <Boite className="relative pb-20">
        <Revele className="rounded-[24px] bg-[var(--c1)] text-white p-4 md:p-5 grid md:grid-cols-[300px_1fr] gap-8 items-center shadow-2xl">
          <div className="relative h-80 md:h-full min-h-[300px] rounded-[18px] overflow-hidden"><Img c="accueil.mot.image" className="absolute inset-0 w-full h-full object-cover" /></div>
          <div className="py-4 md:py-8 pr-4 md:pr-10 relative">
            <Quote className="absolute right-6 top-2 h-20 w-20 text-white/[0.06]" />
            <Sourcil c="accueil.mot.surtitre" clair />
            <T c="accueil.mot.titre" as="h2" className="titre block text-3xl md:text-4xl font-bold mt-4 leading-tight" />
            <T c="accueil.mot.texte" as="p" className="block mt-5 text-white/80 italic leading-relaxed line-clamp-[8]" />
            <div className="mt-7 flex flex-wrap items-center justify-between gap-5">
              <div>
                <T c="accueil.mot.nom" as="p" className="titre block text-xl font-bold" />
                <T c="accueil.mot.fonction" as="p" className="block text-white/60 text-sm mt-0.5" />
              </div>
              <a href="#/ecole" className={CLASSE_BOUTON_JAUNE}>Lire la suite <FlecheRonde /></a>
            </div>
          </div>
        </Revele>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Vie scolaire : grandes photos encadrées ─────────────────────────── */

export function VieScolaireC() {
  return (
    <Section className="py-24 md:py-28 bg-white">
      <Boite>
        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-end mb-14">
          <TitreC c="vieScolaire.activites" texte={false} />
          <T c="vieScolaire.entete.texte" as="p" className="block border-l-2 border-[var(--c2)] pl-5 text-[#5b6472] text-[17px]" />
        </div>
        <Liste c="vieScolaire.activites.elements" colonnes={3} nouveau={{ image: '', titre: 'Activité', texte: 'Description.' }} libelleAjout="Ajouter une activité">
          {(_, i, ce) => (
            <Revele delai={(i % 3) * 110} className="group">
              <div className="relative rounded-[40px] bg-[var(--fond)] p-2.5 shadow-[0_10px_40px_-18px_rgba(11,58,102,0.3)]">
                <div className="relative h-[380px] rounded-[32px] overflow-hidden">
                  <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-x-0 bottom-0 p-6 pt-24 bg-gradient-to-t from-[#0A1A33]/90 to-transparent text-white translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
                    <T c={`${ce}.titre`} as="h3" className="titre block text-2xl font-bold" />
                    <T c={`${ce}.texte`} as="p" className="block mt-1.5 text-white/80 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>
                </div>
              </div>
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Équipe : portraits ronds ─────────────────────────── */

export function EquipeC() {
  return (
    <Section className="py-24 md:py-28">
      <Boite>
        <div className="flex flex-wrap items-end justify-between gap-6 mb-14">
          <TitreC c="ecole.equipe" texte={false} />
          <a href="#/ecole" className={CLASSE_BOUTON_BLANC}>Toute l'équipe <ArrowRight className="h-4 w-4" /></a>
        </div>
        <Liste c="ecole.equipe.elements" colonnes={4} nouveau={{ photo: '', nom: 'Nom', fonction: 'Fonction' }} classeElement="flex" libelleAjout="Ajouter une personne">
          {(_, i, ce) => (
            <Revele delai={i * 90} className="w-full group relative bg-white rounded-[20px] p-5 pb-7 text-center shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)]">
              <span className="absolute left-4 top-4 h-10 w-10 hachures rounded" />
              <div className="relative mx-auto h-48 w-48 rounded-full overflow-hidden ring-[6px] ring-[var(--fond)]">
                <Img c={`${ce}.photo`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              </div>
              <span className="relative -mt-5 mx-auto h-10 w-10 rounded-full bg-[var(--c2)] text-[var(--encre)] ring-4 ring-white flex items-center justify-center"><Award className="h-4 w-4" /></span>
              <T c={`${ce}.nom`} as="p" className="titre block text-xl font-bold mt-3" />
              <T c={`${ce}.fonction`} as="p" className="block text-[#5b6472] text-sm mt-1" />
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Chiffres : compteurs sur fond bleu ─────────────────────────── */

export function ChiffresC() {
  const { edition } = useEdition();
  return (
    <Section className="px-3 md:px-6 py-10">
      <div className="max-w-[1320px] mx-auto rounded-[28px] bg-[var(--c1)] text-white px-5 md:px-12 py-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
        <Liste c="accueil.chiffres" colonnes={4} nouveau={{ valeur: '0', libelle: 'libellé' }} className="relative">
          {(el, i, ce) => (
            <Revele delai={i * 100} className="text-center">
              {edition ? <T c={`${ce}.valeur`} as="p" className="titre block text-5xl md:text-6xl font-bold text-[var(--c2)]" />
                : <p className="titre text-5xl md:text-6xl font-bold text-[var(--c2)]"><Compteur valeur={el.valeur} /></p>}
              <T c={`${ce}.libelle`} as="p" className="block mt-3 text-white/80 font-medium" />
            </Revele>
          )}
        </Liste>
      </div>
    </Section>
  );
}

/* ─────────────────────────── Cartes à icône (atouts, valeurs, pédagogie, services) ─────────────────────────── */

export function CartesIconesC({ c, fond = false }: { c: string; fond?: boolean }) {
  return (
    <Section className={`py-24 ${fond ? 'bg-white' : ''}`}>
      <Boite>
        <TitreC c={c} centre className="mb-14" />
        <Liste c={`${c}.elements`} colonnes={3} nouveau={{ icone: 'star', titre: 'Nouveau', texte: 'Description.' }} classeElement="flex">
          {(_, i, ce) => (
            <Revele delai={(i % 3) * 100} className="w-full group relative rounded-[20px] p-8 bg-[var(--fond)] border border-transparent hover:border-[var(--c1-15)] hover:bg-white hover:shadow-[0_20px_50px_-24px_rgba(11,58,102,0.45)] transition-all duration-500 overflow-hidden">
              <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--c2)] opacity-0 group-hover:opacity-20 scale-50 group-hover:scale-100 transition-all duration-700" />
              <span className="relative h-16 w-16 rounded-2xl bg-white group-hover:bg-[var(--c1)] text-[var(--c1)] group-hover:text-[var(--c2)] shadow-sm flex items-center justify-center transition-colors duration-500">
                <Icone c={`${ce}.icone`} className="h-8 w-8" />
              </span>
              <T c={`${ce}.titre`} as="h3" className="titre block text-[22px] font-bold mt-6" />
              <T c={`${ce}.texte`} as="p" className="block text-[#5b6472] mt-2.5 leading-relaxed" />
              <span className="absolute left-8 bottom-0 h-1 w-0 bg-[var(--c2)] group-hover:w-16 transition-all duration-500 rounded-t" />
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Résultats : anneaux qui se dessinent ─────────────────────────── */

function Anneau({ valeur }: { valeur: string }) {
  const ref = useRef<SVGCircleElement>(null);
  const taux = Math.min(100, Math.max(0, parseFloat(valeur.replace(',', '.')) || 0));
  const tour = 2 * Math.PI * 70;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.strokeDashoffset = String(tour);
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      requestAnimationFrame(() => { el.style.strokeDashoffset = String(tour * (1 - taux / 100)); });
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [taux, tour]);
  return (
    <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90" aria-hidden="true">
      <circle cx="80" cy="80" r="70" fill="none" stroke="var(--c1-15)" strokeWidth="10" />
      <circle ref={ref} cx="80" cy="80" r="70" fill="none" stroke="var(--c2)" strokeWidth="10" strokeLinecap="round" strokeDasharray={tour}
        style={{ transition: 'stroke-dashoffset 2s cubic-bezier(.2,.7,.2,1)' }} />
    </svg>
  );
}

export function ResultatsC() {
  const { edition } = useEdition();
  return (
    <Section className="py-24 bg-white">
      <Boite>
        <TitreC c="accueil.resultats" centre className="mb-14" />
        <Liste c="accueil.resultats.elements" colonnes={3} nouveau={{ examen: 'Examen', taux: '0 %', detail: 'Détail' }} classeElement="flex">
          {(el, i, ce) => (
            <Revele delai={i * 120} className="w-full rounded-[20px] bg-[var(--fond)] p-8 text-center">
              <div className="relative mx-auto h-44 w-44">
                <Anneau valeur={el.taux} />
                <div className="absolute inset-0 flex items-center justify-center">
                  {edition ? <T c={`${ce}.taux`} className="titre text-4xl font-bold text-[var(--c1)]" /> : <span className="titre text-4xl font-bold text-[var(--c1)]"><Compteur valeur={el.taux} /></span>}
                </div>
              </div>
              <T c={`${ce}.examen`} as="p" className="titre block text-2xl font-bold mt-6" />
              <T c={`${ce}.detail`} as="p" className="block text-[#5b6472] mt-1.5" />
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Témoignages ─────────────────────────── */

export function TemoignagesC() {
  return (
    <Section className="py-24">
      <Boite>
        <TitreC c="accueil.temoignages" centre className="mb-14" texte={false} />
        <Liste c="accueil.temoignages.elements" colonnes={3} nouveau={{ texte: 'Témoignage…', nom: 'Nom', role: 'Parent d\'élève', photo: '' }} classeElement="flex">
          {(_, i, ce) => (
            <Revele delai={(i % 3) * 110} className="w-full relative bg-white rounded-[20px] p-8 shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)]">
              <span className="absolute -top-5 left-8 h-11 w-11 rounded-full bg-[var(--c2)] text-[var(--encre)] flex items-center justify-center"><Quote className="h-5 w-5" /></span>
              <p className="text-[var(--c2)] tracking-[0.2em] mt-2" aria-hidden="true">★★★★★</p>
              <T c={`${ce}.texte`} as="p" className="block mt-3 text-[#3c4656] italic leading-relaxed" />
              <div className="flex items-center gap-4 mt-6 pt-6 border-t border-black/5">
                <span className="relative h-14 w-14 rounded-full overflow-hidden"><Img c={`${ce}.photo`} className="absolute inset-0 w-full h-full object-cover" /></span>
                <span><T c={`${ce}.nom`} className="titre block font-bold text-lg" /><T c={`${ce}.role`} className="block text-sm text-[#5b6472]" /></span>
              </div>
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Actualités : cartes horizontales ─────────────────────────── */

export function CartesActualitesC({ limite }: { limite?: number }) {
  const { contenu } = useEdition();
  const liste = contenu.actualites.elements.slice(0, limite ?? undefined);
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {liste.map((a, i) => (
        <Revele key={a.id} delai={(i % 2) * 110}>
          <a href={`#/actualites/${encodeURIComponent(a.id)}`} className="group relative bg-white rounded-[20px] p-3 flex gap-5 h-full shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)] hover:shadow-[0_20px_50px_-20px_rgba(11,58,102,0.45)] transition-shadow">
            <div className="relative h-36 w-36 sm:w-44 flex-shrink-0 rounded-2xl overflow-hidden">
              {a.image && <img src={a.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />}
            </div>
            <div className="py-2 pr-3 min-w-0">
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#5b6472]">
                <span className="text-[var(--c1)] font-semibold">{a.categorie}</span>
                <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{a.date}</span>
              </p>
              <p className="titre text-xl font-bold mt-2.5 leading-snug group-hover:text-[var(--c1)] transition-colors line-clamp-2">{a.titre}</p>
              <p className="text-[14px] text-[#5b6472] mt-2 line-clamp-2">{a.texte}</p>
            </div>
            <span className="absolute right-0 bottom-0 h-14 w-14 hachures rounded-br-[20px] opacity-70" />
          </a>
        </Revele>
      ))}
    </div>
  );
}

export function ActualitesC() {
  return (
    <Section className="py-24">
      <Boite>
        <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <TitreC c="accueil.actualites" texte={false} />
          <a href="#/actualites" className={CLASSE_BOUTON_BLANC}>Toutes les actualités <ArrowRight className="h-4 w-4" /></a>
        </div>
        <CartesActualitesC limite={4} />
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Bande de photos + appel ─────────────────────────── */

export function BandePhotosC() {
  const { contenu } = useEdition();
  const images = contenu.vieScolaire.galerie.elements.slice(0, 6);
  return (
    <section className="relative">
      <div className="grid grid-cols-3 md:grid-cols-6">
        {images.map((g, j) => (
          <div key={j} className="group relative h-40 md:h-56 overflow-hidden">
            <Img c={`vieScolaire.galerie.elements.${j}.image`} className="absolute inset-0 w-full h-full object-cover grayscale-[35%] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Bouton c="campus.bandePhotos.bouton" className={`${CLASSE_BOUTON_JAUNE} !pr-7 pointer-events-auto shadow-2xl`} />
      </div>
    </section>
  );
}

export function AppelC() {
  const ref = useRempli<HTMLHeadingElement>();
  return (
    <Section className="relative overflow-hidden">
      <Img c="campus.appelImage" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--c1)] via-[var(--c1)]/85 to-[var(--c1)]/30" />
      <Boite className="relative py-24 md:py-32 text-white">
        <div className="max-w-xl">
          <p className="flex items-center gap-2.5 text-[var(--c2)] font-semibold"><Award className="h-5 w-5" />Inscriptions</p>
          <h2 ref={ref} className="mt-4"><T c="accueil.appel.titre" className="titre remplissage remplissage-clair text-4xl md:text-5xl font-bold leading-[1.15]" /></h2>
          <T c="accueil.appel.texte" as="p" className="block mt-5 text-white/80 text-lg" />
          <div className="mt-9 flex flex-wrap gap-4">
            <Bouton c="accueil.appel.bouton1" className={CLASSE_BOUTON_JAUNE} />
            <Bouton c="accueil.appel.bouton2" className="inline-flex items-center h-[52px] px-7 rounded-full border border-white/40 font-semibold hover:bg-white hover:text-[var(--encre)] transition-colors duration-300" />
          </div>
        </div>
      </Boite>
    </Section>
  );
}

/* ─────────────────────────── Réseaux ─────────────────────────── */

export function SuivezC() {
  const { contenu, edition, ouvrirIdentite } = useEdition();
  const id = contenu.identite;
  const liens = [
    ...id.reseaux.filter(r => r.url).map(r => ({ ...(STYLE_RESEAU[r.type] ?? STYLE_RESEAU.site), nom: TYPES_RESEAUX[r.type], url: r.url })),
    ...(id.whatsapp ? [{ Icone: IconeWhatsApp, couleur: '#25D366', nom: 'WhatsApp', url: lienWhatsApp(id.whatsapp, id.messageWhatsApp) }] : []),
  ];
  return (
    <Section className="py-24 bg-white">
      <Boite>
        <TitreC c="accueil.suivez" centre className="mb-12" />
        <div className="flex flex-wrap justify-center gap-5">
          {liens.map((l, i) => (
            <Revele key={i} delai={i * 80}>
              <a href={l.url} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-[20px] bg-[var(--fond)] pl-3 pr-7 py-3 hover:bg-[var(--c1)] hover:text-white transition-colors duration-500">
                <span className="h-14 w-14 rounded-2xl text-white flex items-center justify-center group-hover:scale-110 transition-transform" style={{ background: l.couleur }}><l.Icone className="h-6 w-6" /></span>
                <span className="titre text-lg font-bold">{l.nom}</span>
                <ArrowUpRight className="h-5 w-5 opacity-40 group-hover:opacity-100 group-hover:rotate-45 transition" />
              </a>
            </Revele>
          ))}
          {edition && <button type="button" className="outil" onClick={() => ouvrirIdentite(true)}>Modifier nos réseaux</button>}
        </div>
      </Boite>
    </Section>
  );
}
