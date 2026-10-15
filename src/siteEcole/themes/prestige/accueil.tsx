import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Bouton, Icone, Img, Liste, Section, T, useEdition } from '../../edition';
import { ajouterElement, retirerElement } from '../../chemin';
import { NOUVEAU_CYCLE } from '../../composants';
import { TYPES_RESEAUX } from '../../contenu';
import { lienWhatsApp } from '../../utilitaires';
import { Compteur, ROMAINS, Revele, useImageSuiveuse } from './GabaritPrestige';

export const Cadre = ({ children, className = '' }: { children: React.ReactNode; className?: string }) =>
  <div className={`max-w-[1400px] mx-auto px-6 lg:px-10 ${className}`}>{children}</div>;

/** En-tête de section : numéro romain, filet, petites capitales, titre éditorial. */
export function TitreP({ c, numero, clair = false, texte = true, centre = false }: { c: string; numero?: number; clair?: boolean; texte?: boolean; centre?: boolean }) {
  return (
    <div className={`mb-16 ${centre ? 'text-center mx-auto max-w-3xl' : 'max-w-4xl'}`}>
      <Revele className={`flex items-center gap-4 ${centre ? 'justify-center' : ''}`}>
        {numero !== undefined && <span className="capitales text-[var(--c2)]">{ROMAINS[numero]}</span>}
        <span className="h-px w-12 bg-[var(--c2)]" />
        <T c={`${c}.surtitre`} className={`capitales ${clair ? 'text-white/60' : 'text-black/50'}`} />
      </Revele>
      <Revele delai={100}><T c={`${c}.titre`} as="h2" className={`titre block text-5xl md:text-7xl leading-[1] mt-6 ${clair ? 'text-white' : ''}`} /></Revele>
      {texte && <Revele delai={200}><T c={`${c}.texte`} as="p" className={`block mt-6 text-lg font-light leading-relaxed max-w-2xl ${centre ? 'mx-auto' : ''} ${clair ? 'text-white/70' : 'text-black/60'}`} /></Revele>}
    </div>
  );
}

/* ─────────── Ouverture : plein écran, fondu lent entre les photos ─────────── */

export function OuvertureP() {
  const { contenu, edition, majListe } = useEdition();
  const diapos = contenu.accueil.diapos;
  const [i, setI] = useState(0);
  const n = diapos.length;
  const k = Math.min(i, n - 1);
  useEffect(() => {
    if (edition || n < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % n), 8000);
    return () => clearInterval(t);
  }, [edition, n]);
  if (n === 0) return null;

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#0E1525] text-white grain">
      {diapos.map((_, j) => (
        <div key={j} className={`absolute inset-0 transition-opacity duration-[1800ms] ${j === k ? 'opacity-100' : 'opacity-0'}`}>
          <Img c={`accueil.diapos.${j}.image`} className={`absolute inset-0 w-full h-full object-cover ${j === k ? 'zoom-lent' : ''}`} />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0E1525] via-[#0E1525]/55 to-[#0E1525]/25 pointer-events-none" />
      {/* Assombrit le haut pour que le menu reste lisible sur n'importe quelle photo. */}
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#0E1525]/80 to-transparent pointer-events-none" />

      <div className="relative min-h-[100svh] max-w-[1400px] mx-auto px-6 lg:px-10 pt-44 flex flex-col justify-end pb-14">
        <div key={k} className="max-w-4xl">
          <Revele><p className="flex items-center gap-4"><span className="h-px w-12 bg-[var(--c2)]" /><T c={`accueil.diapos.${k}.surtitre`} className="capitales text-white/80" /></p></Revele>
          <Revele delai={150}><T c={`accueil.diapos.${k}.titre`} as="h1" className="titre block text-[12vw] sm:text-7xl lg:text-[5.6rem] xl:text-[6.4rem] leading-[0.95] mt-8 [text-wrap:balance]" /></Revele>
          <Revele delai={300}><T c={`accueil.diapos.${k}.texte`} as="p" className="block mt-8 text-lg md:text-xl font-light text-white/75 max-w-2xl leading-relaxed" /></Revele>
          <Revele delai={450} className="mt-10 flex flex-wrap gap-4">
            <Bouton c="accueil.bouton1" className="inline-flex items-center h-14 px-9 bg-[var(--c2)] text-white capitales !text-[11px] hover:bg-white hover:text-[var(--encre)] transition-colors duration-300" />
            <Bouton c="accueil.bouton2" className="inline-flex items-center h-14 px-9 border border-white/40 capitales !text-[11px] hover:bg-white hover:text-[var(--encre)] transition-colors duration-300" />
          </Revele>
        </div>

        <div className="mt-16 pt-6 border-t border-white/15 flex items-center gap-6">
          <span className="titre text-2xl">{String(k + 1).padStart(2, '0')}<span className="text-white/35"> / {String(n).padStart(2, '0')}</span></span>
          <div className="flex-1 flex gap-2">
            {diapos.map((d, j) => (
              <button key={j} type="button" onClick={() => setI(j)} className="group flex-1 text-left" aria-label={`Diapositive ${j + 1}`}>
                <span className="block h-px bg-white/20 overflow-hidden"><span className={`block h-full bg-[var(--c2)] ${j === k ? 'w-full transition-[width] duration-[8000ms] ease-linear' : 'w-0'}`} /></span>
                <span className={`hidden md:block mt-3 text-[12px] truncate transition-colors ${j === k ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>{d.surtitre}</span>
              </button>
            ))}
          </div>
          <span className="hidden md:flex flex-col items-center gap-2 capitales !text-[9px] text-white/50">Défiler<span className="block h-10 w-px bg-white/40 animate-[trait-defile_2.4s_ease-in-out_infinite]" /></span>
        </div>

        {edition && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 flex gap-2">
            <button type="button" className="outil" onClick={() => { majListe('accueil.diapos', l => ajouterElement(l, structuredClone(l[k]), k)); setI(k + 1); }}><Plus className="h-3.5 w-3.5" />Ajouter une photo d'ouverture</button>
            {n > 1 && <button type="button" className="outil text-red-600" onClick={() => { majListe('accueil.diapos', l => retirerElement(l, k)); setI(0); }}><Trash2 className="h-3.5 w-3.5" />Supprimer celle-ci</button>}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─────────── Manifeste : un paragraphe, une signature ─────────── */

export function ManifesteP() {
  return (
    <Section className="py-32 md:py-44">
      <Cadre className="max-w-5xl text-center">
        <Revele className="flex items-center justify-center gap-4"><span className="h-px w-12 bg-[var(--c2)]" /><T c="prestige.manifeste.surtitre" className="capitales text-black/50" /><span className="h-px w-12 bg-[var(--c2)]" /></Revele>
        <Revele delai={150}><T c="prestige.manifeste.texte" as="p" className="titre block text-3xl md:text-5xl leading-[1.25] mt-12" /></Revele>
        <Revele delai={300} className="mt-14">
          <T c="prestige.manifeste.signature" as="p" className="signature block text-6xl text-[var(--c1)]" />
          <T c="prestige.manifeste.fonction" as="p" className="block capitales text-black/45 mt-2" />
        </Revele>
      </Cadre>
    </Section>
  );
}

/* ─────────── Chiffres : compteurs, filets fins ─────────── */

export function ChiffresP() {
  const { edition } = useEdition();
  return (
    <Section className="pb-28">
      <Cadre>
        <Liste c="accueil.chiffres" colonnes={4} nouveau={{ valeur: '0', libelle: 'libellé' }} className="!gap-0 border-y border-black/10" classeElement="!w-1/2 lg:!w-1/4 border-black/10 [&:not(:first-child)]:border-l">
          {(el, i, ce) => (
            <Revele delai={i * 120} className="px-6 py-14 text-center">
              {edition ? <T c={`${ce}.valeur`} as="p" className="titre block text-6xl md:text-7xl text-[var(--c1)]" />
                : <p className="titre text-6xl md:text-7xl text-[var(--c1)]"><Compteur valeur={el.valeur} /></p>}
              <T c={`${ce}.libelle`} as="p" className="block capitales text-black/50 mt-4 !leading-relaxed" />
            </Revele>
          )}
        </Liste>
      </Cadre>
    </Section>
  );
}

/* ─────────── Programmes : liste élégante, photo qui suit le pointeur ─────────── */

export function ProgrammesP() {
  const { contenu, edition } = useEdition();
  const { montrer, calque } = useImageSuiveuse();
  return (
    <Section className="py-28 bg-white">
      <Cadre>
        <div className="grid lg:grid-cols-[1fr_auto] items-end gap-8">
          <TitreP c="accueil.cycles" numero={0} />
          <a href="#/enseignement" className="mb-16 inline-flex items-center gap-3 capitales !text-[11px] border-b border-[var(--c2)] pb-2 hover:gap-5 transition-all">Les programmes <ArrowRight className="h-4 w-4" /></a>
        </div>
        <Liste c="enseignement.cycles" nouveau={NOUVEAU_CYCLE} className="border-t border-black/10" libelleAjout="Ajouter un cycle">
          {(_, i, ce) => (
            <a href="#/enseignement" onMouseEnter={() => !edition && montrer(contenu.enseignement.cycles[i]?.image ?? null)} onMouseLeave={() => montrer(null)}
              className="group grid grid-cols-[3rem_1fr_auto] md:grid-cols-[5rem_1.3fr_1fr_auto] items-center gap-6 py-9 border-b border-black/10">
              <span className="titre text-2xl text-[var(--c2)]">{ROMAINS[i]}</span>
              <T c={`${ce}.nom`} className="titre text-4xl md:text-6xl leading-none transition-all duration-500 group-hover:italic group-hover:translate-x-3 group-hover:text-[var(--c1)]" />
              <span className="hidden md:block">
                <T c={`${ce}.niveaux`} className="block text-black/70" />
                <T c={`${ce}.age`} className="block capitales text-black/40 mt-1.5 !text-[10px]" />
              </span>
              <span className="h-12 w-12 border border-black/15 flex items-center justify-center transition-all duration-500 group-hover:bg-[var(--c1)] group-hover:border-[var(--c1)] group-hover:text-white">
                <ArrowUpRight className="h-5 w-5 transition-transform duration-500 group-hover:rotate-45" />
              </span>
            </a>
          )}
        </Liste>
      </Cadre>
      {calque}
    </Section>
  );
}

/* ─────────── Résultats : registre officiel ─────────── */

export function ResultatsP() {
  const { edition } = useEdition();
  return (
    <Section className="py-28 bg-[var(--c1)] text-white">
      <Cadre className="grid lg:grid-cols-[0.9fr_1.1fr] gap-16">
        <TitreP c="accueil.resultats" numero={1} clair />
        <Liste c="accueil.resultats.elements" nouveau={{ examen: 'Examen', taux: '0 %', detail: 'Détail' }} className="border-t border-white/15">
          {(el, i, ce) => (
            <Revele delai={i * 120} className="grid grid-cols-[1fr_auto] items-end gap-6 py-8 border-b border-white/15">
              <div>
                <T c={`${ce}.examen`} as="p" className="block capitales text-[var(--c2)]" />
                <T c={`${ce}.detail`} as="p" className="block mt-3 text-white/60 font-light" />
              </div>
              {edition ? <T c={`${ce}.taux`} className="titre text-7xl md:text-8xl leading-none" /> : <span className="titre text-7xl md:text-8xl leading-none"><Compteur valeur={el.taux} /></span>}
            </Revele>
          )}
        </Liste>
      </Cadre>
    </Section>
  );
}

/* ─────────── Palmarès : année, distinction, détail ─────────── */

export function DistinctionsP() {
  return (
    <Section className="py-28">
      <Cadre>
        <TitreP c="prestige.distinctions" numero={2} texte={false} />
        <Liste c="prestige.distinctions.elements" nouveau={{ annee: '2026', titre: 'Distinction', detail: 'Détail' }} className="border-t border-black/10">
          {(_, i, ce) => (
            <Revele delai={i * 80} className="grid grid-cols-[5rem_1fr] md:grid-cols-[8rem_1fr_1fr] gap-6 py-8 border-b border-black/10 items-baseline">
              <T c={`${ce}.annee`} className="titre text-3xl text-[var(--c2)]" />
              <T c={`${ce}.titre`} className="titre text-2xl md:text-3xl" />
              <T c={`${ce}.detail`} className="col-start-2 md:col-start-auto text-black/55 font-light" />
            </Revele>
          )}
        </Liste>
      </Cadre>
    </Section>
  );
}

/* ─────────── Destinations : les établissements qui accueillent nos bacheliers ─────────── */

export function DestinationsP() {
  const { contenu, edition } = useEdition();
  const noms = contenu.prestige.destinations.elements;
  return (
    <Section className="py-28 bg-white overflow-hidden">
      <Cadre><TitreP c="prestige.destinations" numero={3} centre /></Cadre>
      {edition ? (
        <Cadre>
          <Liste c="prestige.destinations.elements" nouveau="Établissement" className="flex flex-wrap justify-center gap-3">
            {(_, __, ce) => <T c={ce} className="inline-block border border-black/15 px-5 py-3 titre text-xl" />}
          </Liste>
        </Cadre>
      ) : (
        <div className="relative border-y border-black/10 py-10 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="flex w-max animate-[defilement_60s_linear_infinite] hover:[animation-play-state:paused]">
            {[0, 1].map(k => (
              <div key={k} className="flex items-center">
                {noms.map((nom, j) => (
                  <span key={j} className="flex items-center whitespace-nowrap">
                    <span className="titre text-4xl md:text-5xl px-10 text-black/80 hover:text-[var(--c1)] hover:italic transition-all">{nom}</span>
                    <span className="text-[var(--c2)] text-xl">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

/* ─────────── Témoignages : une seule grande citation à la fois ─────────── */

export function TemoignagesP() {
  const { contenu, edition } = useEdition();
  const liste = contenu.accueil.temoignages.elements;
  const [i, setI] = useState(0);
  const n = liste.length;
  const k = Math.min(i, Math.max(n - 1, 0));
  useEffect(() => {
    if (edition || n < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % n), 9000);
    return () => clearInterval(t);
  }, [edition, n]);

  if (edition) {
    return (
      <Section className="py-28">
        <Cadre>
          <TitreP c="accueil.temoignages" numero={4} texte={false} />
          <Liste c="accueil.temoignages.elements" colonnes={3} nouveau={{ texte: 'Témoignage…', nom: 'Nom', role: 'Parent d\'élève', photo: '' }}>
            {(_, __, ce) => (
              <div className="border border-black/10 p-8 bg-white">
                <T c={`${ce}.texte`} as="p" className="titre block text-2xl leading-snug" />
                <div className="flex items-center gap-4 mt-6">
                  <span className="relative h-14 w-14 overflow-hidden"><Img c={`${ce}.photo`} className="w-full h-full object-cover grayscale" /></span>
                  <span><T c={`${ce}.nom`} className="block font-medium" /><T c={`${ce}.role`} className="block capitales !text-[9.5px] text-black/45 mt-1" /></span>
                </div>
              </div>
            )}
          </Liste>
        </Cadre>
      </Section>
    );
  }
  if (n === 0) return null;
  const t = liste[k];
  return (
    <Section className="py-32">
      <Cadre className="max-w-5xl">
        <Revele className="flex items-center justify-center gap-4"><span className="h-px w-12 bg-[var(--c2)]" /><span className="capitales text-black/50">{contenu.accueil.temoignages.surtitre}</span><span className="h-px w-12 bg-[var(--c2)]" /></Revele>
        <div key={k} className="apparition text-center mt-14">
          <p className="titre text-[7rem] leading-[0.4] text-[var(--c2)] select-none">“</p>
          <blockquote className="titre text-3xl md:text-[2.75rem] leading-[1.25] mt-6">{t.texte}</blockquote>
          <div className="mt-12 flex items-center justify-center gap-5">
            {t.photo && <img src={t.photo} alt="" className="h-16 w-16 object-cover grayscale" />}
            <div className="text-left"><p className="font-medium text-lg">{t.nom}</p><p className="capitales text-black/45 !text-[10px] mt-1">{t.role}</p></div>
          </div>
        </div>
        {n > 1 && (
          <div className="mt-14 flex items-center justify-center gap-6">
            <button type="button" aria-label="Précédent" onClick={() => setI((k - 1 + n) % n)} className="h-12 w-12 border border-black/15 flex items-center justify-center hover:bg-[var(--c1)] hover:text-white transition-colors"><ChevronLeft className="h-5 w-5" /></button>
            <span className="titre text-xl tabular-nums">{k + 1} <span className="text-black/30">/ {n}</span></span>
            <button type="button" aria-label="Suivant" onClick={() => setI((k + 1) % n)} className="h-12 w-12 border border-black/15 flex items-center justify-center hover:bg-[var(--c1)] hover:text-white transition-colors"><ChevronRight className="h-5 w-5" /></button>
          </div>
        )}
      </Cadre>
    </Section>
  );
}

/* ─────────── Journal : actualités en liste de revue ─────────── */

export function JournalP({ limite, titre = true }: { limite?: number; titre?: boolean }) {
  const { contenu } = useEdition();
  const { montrer, calque } = useImageSuiveuse();
  const liste = contenu.actualites.elements.slice(0, limite ?? undefined);
  return (
    <>
      {titre && (
        <div className="grid lg:grid-cols-[1fr_auto] items-end gap-8">
          <TitreP c="accueil.actualites" numero={5} texte={false} />
          <a href="#/actualites" className="mb-16 inline-flex items-center gap-3 capitales !text-[11px] border-b border-[var(--c2)] pb-2 hover:gap-5 transition-all">Tout le journal <ArrowRight className="h-4 w-4" /></a>
        </div>
      )}
      <div className="border-t border-black/10">
        {liste.map((a, i) => {
          const [jour, ...reste] = a.date.split(' ');
          return (
            <Revele key={a.id} delai={i * 80}>
              <a href={`#/actualites/${encodeURIComponent(a.id)}`} onMouseEnter={() => montrer(a.image || null)} onMouseLeave={() => montrer(null)}
                className="group grid grid-cols-[4.5rem_1fr_auto] md:grid-cols-[7rem_10rem_1fr_auto] gap-6 items-center py-8 border-b border-black/10">
                <span className="leading-none"><span className="titre text-5xl block">{/^\d+$/.test(jour) ? jour : '—'}</span><span className="capitales !text-[9px] text-black/45 block mt-2">{/^\d+$/.test(jour) ? reste.join(' ') : a.date}</span></span>
                <span className="hidden md:block capitales !text-[10px] text-[var(--c2)]">{a.categorie}</span>
                <span>
                  <span className="titre block text-2xl md:text-4xl leading-tight transition-colors duration-300 group-hover:text-[var(--c1)]">{a.titre}</span>
                  <span className="block mt-2 text-black/55 font-light">{a.texte}</span>
                </span>
                <ArrowUpRight className="h-6 w-6 text-black/30 transition-all duration-500 group-hover:text-[var(--c1)] group-hover:rotate-45" />
              </a>
            </Revele>
          );
        })}
      </div>
      {calque}
    </>
  );
}

export function ActualitesRecentesP() {
  return <Section className="py-28"><Cadre><JournalP limite={4} /></Cadre></Section>;
}

/* ─────────── Réseaux : sobres liens en grande typographie ─────────── */

export function SuivezNousP() {
  const { contenu, edition, ouvrirIdentite } = useEdition();
  const id = contenu.identite;
  const liens = [
    ...id.reseaux.filter(r => r.url).map(r => ({ nom: TYPES_RESEAUX[r.type], url: r.url })),
    ...(id.whatsapp ? [{ nom: 'WhatsApp', url: lienWhatsApp(id.whatsapp, id.messageWhatsApp) }] : []),
  ];
  return (
    <Section className="py-28 bg-white">
      <Cadre className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12">
        <TitreP c="accueil.suivez" />
        <div className="border-t border-black/10">
          {liens.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noreferrer" className="group flex items-center justify-between py-6 border-b border-black/10">
              <span className="titre text-4xl transition-all duration-500 group-hover:italic group-hover:translate-x-3 group-hover:text-[var(--c1)]">{l.nom}</span>
              <ArrowUpRight className="h-6 w-6 text-[var(--c2)] transition-transform duration-500 group-hover:rotate-45" />
            </a>
          ))}
          {edition && <button type="button" className="outil mt-6" onClick={() => ouvrirIdentite(true)}>Modifier nos réseaux</button>}
        </div>
      </Cadre>
    </Section>
  );
}

/* ─────────── Appel : grande photo, invitation centrée ─────────── */

export function AppelP() {
  return (
    <Section className="relative py-40 md:py-52 overflow-hidden text-white text-center grain">
      <Img c="prestige.appelImage" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-[#0E1525]/75 pointer-events-none" />
      <Cadre className="relative max-w-4xl">
        <Revele><T c="accueil.appel.titre" as="h2" className="titre block text-5xl md:text-8xl leading-[0.95]" /></Revele>
        <Revele delai={150}><T c="accueil.appel.texte" as="p" className="block mt-8 text-lg md:text-xl font-light text-white/75" /></Revele>
        <Revele delai={300} className="mt-12 flex flex-wrap justify-center gap-4">
          <Bouton c="accueil.appel.bouton1" className="inline-flex items-center h-14 px-10 bg-[var(--c2)] capitales !text-[11px] hover:bg-white hover:text-[var(--encre)] transition-colors duration-300" />
          <Bouton c="accueil.appel.bouton2" className="inline-flex items-center h-14 px-10 border border-white/40 capitales !text-[11px] hover:bg-white hover:text-[var(--encre)] transition-colors duration-300" />
        </Revele>
      </Cadre>
    </Section>
  );
}

/* ─────────── Liste numérotée en chiffres romains (atouts, valeurs, pédagogie, services) ─────────── */

export function PiliersP({ c, numero, fond = false }: { c: string; numero?: number; fond?: boolean }) {
  return (
    <Section className={`py-28 ${fond ? 'bg-white' : ''}`}>
      <Cadre>
        <TitreP c={c} numero={numero} />
        <Liste c={`${c}.elements`} colonnes={2} nouveau={{ icone: 'star', titre: 'Nouveau', texte: 'Description.' }} className="!gap-x-16 !gap-y-0" classeElement="!w-full md:!w-[calc((100%_-_4rem)/2)]">
          {(_, i, ce) => (
            <Revele delai={(i % 2) * 120} className="flex gap-8 py-10 border-t border-black/10 group">
              <span className="titre text-5xl text-[var(--c2)] w-14 flex-shrink-0 leading-none">{ROMAINS[i]}</span>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Icone c={`${ce}.icone`} className="h-5 w-5 text-[var(--c1)]" />
                  <T c={`${ce}.titre`} as="h3" className="titre text-3xl" />
                </div>
                <T c={`${ce}.texte`} as="p" className="block mt-3 text-black/60 font-light leading-relaxed text-lg" />
              </div>
            </Revele>
          )}
        </Liste>
      </Cadre>
    </Section>
  );
}
