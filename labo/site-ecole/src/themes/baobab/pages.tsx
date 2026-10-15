import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Mail, MapPin, Minus, Phone, Plus, Send, X } from 'lucide-react';
import { Img, Liste, Section, T, useEdition } from '../../edition';
import { CartesActualites, NOUVEAU_CYCLE, nouvelleActualite } from '../../composants';
import { IconeWhatsApp } from '../../reseaux';
import { identifiant, lienCarte, lienWhatsApp } from '../../utilitaires';
import { Revele } from '../prestige/GabaritPrestige';
import { Boite, TitreB, Trait } from './GabaritBaobab';

/* ─────────── Notre école ─────────── */

export function HistoireB() {
  return (
    <Section className="py-24">
      <Boite className="grid lg:grid-cols-2 gap-16 items-center">
        <Revele className="relative h-[460px]">
          <div className="absolute left-0 top-0 w-[72%] h-[78%] rounded-[32px] overflow-hidden"><Img c="ecole.histoire.image" className="absolute inset-0 w-full h-full object-cover" /></div>
          <div className="absolute right-0 bottom-0 w-[50%] h-[50%] rounded-[28px] overflow-hidden ring-8 ring-white shadow-2xl"><Img c="ecole.infrastructures.elements.0.image" className="absolute inset-0 w-full h-full object-cover" /></div>
          <div className="absolute left-6 bottom-6 rounded-3xl bg-[var(--c2)] text-white px-6 py-5 shadow-xl flottement">
            <p className="text-sm font-semibold text-white/85">Depuis</p>
            <T c="identite.creation" as="p" className="titre block text-5xl font-extrabold leading-none" />
          </div>
        </Revele>
        <div>
          <TitreB c="ecole.histoire" texte={false} />
          <Revele delai={150}><T c="ecole.histoire.texte" as="div" className="block mt-7 text-[17px] leading-relaxed text-[#55635d]" /></Revele>
        </div>
      </Boite>
    </Section>
  );
}

export function EquipeB() {
  return (
    <Section className="py-24 bg-[var(--doux)]">
      <Boite>
        <TitreB c="ecole.equipe" centre className="mb-14" texte={false} />
        <Liste c="ecole.equipe.elements" colonnes={4} nouveau={{ photo: '', nom: 'Nom', fonction: 'Fonction' }} libelleAjout="Ajouter une personne">
          {(_, i, ce) => (
            <Revele delai={(i % 4) * 90} className="group">
              <div className="relative aspect-[4/5] rounded-[28px] overflow-hidden">
                <Img c={`${ce}.photo`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 backdrop-blur px-4 py-3 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                  <T c={`${ce}.fonction`} className="block text-sm font-semibold text-[var(--c1)]" />
                </div>
              </div>
              <T c={`${ce}.nom`} as="p" className="titre block text-xl font-extrabold mt-5" />
              <T c={`${ce}.fonction`} as="p" className="block text-[#6b7a73] text-sm group-hover:opacity-0 transition-opacity" />
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

export function InfraB() {
  return (
    <Section className="py-24">
      <Boite>
        <TitreB c="ecole.infrastructures" className="mb-12" texte={false} />
        <Liste c="ecole.infrastructures.elements" nouveau={{ image: '', titre: 'Espace', texte: 'Description.' }}
          className="grid md:grid-cols-3 auto-rows-[240px] gap-4" classeElement="first:md:row-span-2 [&:nth-child(4)]:md:col-span-2">
          {(_, __, ce) => (
            <div className="group relative h-full rounded-[28px] overflow-hidden">
              <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D1F19]/80 to-transparent pointer-events-none" />
              <div className="absolute left-6 right-6 bottom-6 text-white">
                <T c={`${ce}.titre`} as="p" className="titre block text-2xl font-extrabold" />
                <T c={`${ce}.texte`} as="p" className="block text-white/80 text-sm mt-1" />
              </div>
            </div>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────── Enseignement : cartes qui s'empilent au défilement ─────────── */

export function CyclesEmpilesB() {
  const { contenu, edition } = useEdition();
  if (edition) {
    return (
      <Section className="py-24">
        <Boite>
          <Liste c="enseignement.cycles" nouveau={NOUVEAU_CYCLE} className="space-y-6" libelleAjout="Ajouter un cycle">
            {(_, __, ce) => <CarteCycle ce={ce} i={0} />}
          </Liste>
        </Boite>
      </Section>
    );
  }
  return (
    <Section className="py-24">
      <Boite>
        {contenu.enseignement.cycles.map((_, i) => (
          <div key={i} className="sticky pb-6" style={{ top: `${110 + i * 26}px` }}>
            <CarteCycle ce={`enseignement.cycles.${i}`} i={i} />
          </div>
        ))}
      </Boite>
    </Section>
  );
}

function CarteCycle({ ce, i }: { ce: string; i: number }) {
  const teintes = ['bg-white', 'bg-[var(--doux)]', 'bg-[var(--c1)] text-white', 'bg-[#FFF4EC]'];
  const fonce = i % 4 === 2;
  return (
    <article className={`rounded-[36px] ${teintes[i % 4]} border border-black/5 shadow-[0_-20px_50px_-30px_rgba(13,31,25,0.35)] grid md:grid-cols-[1.1fr_1fr] overflow-hidden min-h-[460px]`}>
      <div className="p-8 md:p-12 flex flex-col">
        <div className="flex items-center gap-3">
          <span className={`titre text-sm font-extrabold rounded-full px-3.5 py-1.5 ${fonce ? 'bg-white/15' : 'bg-[var(--c2)] text-white'}`}>0{i + 1}</span>
          <T c={`${ce}.age`} className={`font-semibold ${fonce ? 'text-white/75' : 'text-[#6b7a73]'}`} />
        </div>
        <T c={`${ce}.nom`} as="h2" className="titre block text-5xl md:text-6xl font-extrabold mt-6" />
        <T c={`${ce}.niveaux`} as="p" className={`block mt-2 text-lg font-semibold ${fonce ? 'text-[var(--c2)]' : 'text-[var(--c1)]'}`} />
        <T c={`${ce}.texte`} as="p" className={`block mt-5 text-[17px] leading-relaxed ${fonce ? 'text-white/80' : 'text-[#55635d]'}`} />
        <Liste c={`${ce}.points`} nouveau="Nouveau point" className="mt-auto pt-8 flex flex-wrap gap-2" libelleAjout="Point">
          {(__, ___, cp) => (
            <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${fonce ? 'bg-white/10' : 'bg-white border border-black/5'}`}>
              <Check className={`h-4 w-4 ${fonce ? 'text-[var(--c2)]' : 'text-[var(--c1)]'}`} /><T c={cp} />
            </span>
          )}
        </Liste>
      </div>
      <div className="relative min-h-[280px] m-3 md:m-4 rounded-[28px] overflow-hidden"><Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover" /></div>
    </article>
  );
}

/* ─────────── Vie scolaire ─────────── */

export function ActivitesB() {
  return (
    <Section className="py-24">
      <Boite>
        <TitreB c="vieScolaire.activites" className="mb-12" texte={false} />
        <Liste c="vieScolaire.activites.elements" colonnes={2} nouveau={{ image: '', titre: 'Activité', texte: 'Description.' }}>
          {(_, i, ce) => (
            <Revele delai={(i % 2) * 120} className="group relative h-[340px] rounded-[32px] overflow-hidden">
              <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D1F19]/90 via-[#0D1F19]/20 to-transparent pointer-events-none" />
              <span className="absolute right-6 top-6 titre text-6xl font-extrabold text-white/25">0{i + 1}</span>
              <div className="absolute left-7 right-7 bottom-7 text-white">
                <T c={`${ce}.titre`} as="h3" className="titre block text-3xl font-extrabold" />
                <T c={`${ce}.texte`} as="p" className="block mt-2 text-white/80 max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 transition-all duration-500" />
              </div>
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

export function GalerieB() {
  const { contenu, edition } = useEdition();
  const [ouverte, setOuverte] = useState<number | null>(null);
  const images = contenu.vieScolaire.galerie.elements;
  return (
    <Section className="py-24 bg-[var(--doux)]">
      <Boite>
        <TitreB c="vieScolaire.galerie" centre className="mb-12" texte={false} />
        <Liste c="vieScolaire.galerie.elements" nouveau={{ image: '' }} className="columns-2 md:columns-4 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid" libelleAjout="Ajouter une photo">
          {(_, i, ce) => (
            <div role="button" tabIndex={0} onClick={() => !edition && setOuverte(i)} onKeyDown={e => e.key === 'Enter' && !edition && setOuverte(i)}
              className={`group relative block w-full rounded-[24px] overflow-hidden cursor-pointer ${['aspect-[4/5]', 'aspect-square', 'aspect-[4/3]', 'aspect-[3/4]'][i % 4]}`}>
              <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
          )}
        </Liste>
      </Boite>
      {ouverte !== null && images[ouverte] && (
        <div className="fixed inset-0 z-[70] bg-[#0D1F19]/95 flex items-center justify-center p-4" onClick={() => setOuverte(null)}>
          <button type="button" aria-label="Fermer" className="absolute top-5 right-5 h-12 w-12 rounded-2xl bg-white flex items-center justify-center"><X /></button>
          <button type="button" aria-label="Précédente" onClick={e => { e.stopPropagation(); setOuverte((ouverte - 1 + images.length) % images.length); }} className="absolute left-4 h-12 w-12 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-[var(--c2)]"><ArrowLeft /></button>
          <img src={images[ouverte].image} alt="" className="max-h-[85vh] max-w-[85vw] rounded-3xl" onClick={e => e.stopPropagation()} />
          <button type="button" aria-label="Suivante" onClick={e => { e.stopPropagation(); setOuverte((ouverte + 1) % images.length); }} className="absolute right-4 h-12 w-12 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-[var(--c2)]"><ArrowRight /></button>
        </div>
      )}
    </Section>
  );
}

/** Calendrier : une tuile par période, comme les feuilles d'un calendrier mural. */
export function CalendrierB() {
  return (
    <Section className="py-24 overflow-hidden">
      <Boite>
        <TitreB c="vieScolaire.calendrier" className="mb-12" texte={false} />
        <Liste c="vieScolaire.calendrier.elements" nouveau={{ date: 'Mois', evenement: 'Événement' }} horizontal
          className="flex gap-5 overflow-x-auto snap-x pb-4 [scrollbar-width:thin]" classeElement="snap-start flex-shrink-0 w-[260px]" libelleAjout="Date">
          {(_, i, ce) => (
            <Revele delai={i * 80} className="h-full rounded-[28px] bg-white border border-black/5 shadow-[0_20px_40px_-30px_rgba(13,31,25,0.5)] overflow-hidden">
              <div className={`relative px-6 pt-8 pb-6 ${i % 2 ? 'bg-[var(--c2)]' : 'bg-[var(--c1)]'} text-white`}>
                <span className="absolute left-8 -top-1 h-5 w-2.5 rounded-full bg-white/70" /><span className="absolute right-8 -top-1 h-5 w-2.5 rounded-full bg-white/70" />
                <T c={`${ce}.date`} as="p" className="titre block text-3xl font-extrabold" />
              </div>
              <T c={`${ce}.evenement`} as="p" className="block p-6 font-semibold text-[#43514b] leading-snug" />
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────── Admissions ─────────── */

/** Étapes : une barre qui se remplit pendant que les étapes apparaissent. */
export function EtapesB() {
  const ref = useRef<HTMLDivElement>(null);
  const [vu, setVu] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVu(true); obs.disconnect(); } }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <Section className="py-24">
      <Boite>
        <TitreB c="admissions.etapes" centre className="mb-16" texte={false} />
        <div ref={ref} className="relative">
          <div className="hidden lg:block absolute left-[12.5%] right-[12.5%] top-8 h-1.5 rounded-full bg-[var(--doux)] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[var(--c1)] to-[var(--c2)] rounded-full transition-[width] duration-[1800ms] ease-out" style={{ width: vu ? '100%' : '0%' }} />
          </div>
          <Liste c="admissions.etapes.elements" colonnes={4} nouveau={{ titre: 'Étape', texte: 'Description.' }}>
            {(_, i, ce) => (
              <div className="text-center">
                <span className={`relative z-10 mx-auto h-16 w-16 rounded-2xl flex items-center justify-center titre text-2xl font-extrabold transition-all duration-500 ${vu ? 'bg-[var(--c1)] text-white scale-100' : 'bg-[var(--doux)] text-[var(--c1)] scale-90'}`} style={{ transitionDelay: `${i * 400}ms` }}>{i + 1}</span>
                <T c={`${ce}.titre`} as="h3" className="titre block text-xl font-extrabold mt-6" />
                <T c={`${ce}.texte`} as="p" className="block text-[#55635d] mt-2" />
              </div>
            )}
          </Liste>
        </div>
      </Boite>
    </Section>
  );
}

/** Pièces à fournir : une liste que le parent coche pour préparer son dossier (gardée sur son téléphone). */
export function PiecesB() {
  const { contenu, edition } = useEdition();
  const pieces = contenu.admissions.pieces.elements;
  const CLE = 'site-ecole.dossier-coche';
  const [coches, setCoches] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(CLE) ?? '[]'); } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(CLE, JSON.stringify(coches)); } catch { /* sans stockage, la liste reste utilisable */ } }, [coches]);
  const prets = pieces.filter(p => coches.includes(p)).length;
  return (
    <Section className="py-24 bg-[var(--doux)]">
      <Boite className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
        <div className="rounded-[32px] bg-white p-7 md:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <T c="admissions.pieces.titre" as="h3" className="titre block text-3xl font-extrabold" />
              <p className="text-[#6b7a73] mt-1">Cochez au fur et à mesure pour préparer votre dossier.</p>
            </div>
            <p className="titre font-extrabold text-[var(--c1)] text-lg">{prets} / {pieces.length} prêtes</p>
          </div>
          <div className="mt-5 h-2.5 rounded-full bg-[var(--doux)] overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-[var(--c1)] to-[var(--c2)] transition-[width] duration-500" style={{ width: `${pieces.length ? (prets / pieces.length) * 100 : 0}%` }} /></div>
          <Liste c="admissions.pieces.elements" nouveau="Nouvelle pièce" className="mt-7 grid sm:grid-cols-2 gap-3">
            {(p, __, ce) => {
              const fait = coches.includes(p as string);
              return (
                <div role="checkbox" aria-checked={fait} tabIndex={0}
                  onClick={() => !edition && setCoches(l => (fait ? l.filter(x => x !== p) : [...l, p as string]))}
                  onKeyDown={e => e.key === ' ' && !edition && setCoches(l => (fait ? l.filter(x => x !== p) : [...l, p as string]))}
                  className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 cursor-pointer transition-all ${fait ? 'border-[var(--c1)] bg-[var(--c1-10)]' : 'border-black/5 hover:border-[var(--c1-40)]'}`}>
                  <span className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${fait ? 'bg-[var(--c1)] text-white' : 'border-2 border-black/15'}`}>{fait && <Check className="h-4 w-4" />}</span>
                  <T c={ce} className={`font-semibold ${fait ? 'line-through text-[#55635d]' : ''}`} />
                </div>
              );
            }}
          </Liste>
        </div>
        <div className="rounded-[32px] bg-[var(--c1)] text-white p-7 md:p-10 relative overflow-hidden">
          <span className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10" />
          <T c="admissions.paiement.titre" as="h3" className="titre block text-3xl font-extrabold" />
          <Liste c="admissions.paiement.elements" nouveau="Moyen de paiement" className="mt-7 space-y-3">
            {(_, __, ce) => <p className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-4 font-bold"><CheckCircle2 className="h-5 w-5 text-[var(--c2)]" /><T c={ce} /></p>}
          </Liste>
        </div>
      </Boite>
    </Section>
  );
}

/** Lit « 35 000 F » → 35000 (pour calculer le coût annuel). */
const enNombre = (texte: string) => Number(texte.replace(/[^\d]/g, '')) || 0;
const enFrancs = (n: number) => `${n.toLocaleString('fr-FR')} F`;

/**
 * Tarifs : bascule « par mois / pour l'année ». L'année = inscription + 10 mensualités,
 * puisque la mensualité est due d'octobre à juillet (le nombre de mois se règle ici).
 */
export function FraisB() {
  const { contenu, edition } = useEdition();
  const [annuel, setAnnuel] = useState(false);
  const MOIS = 10;
  return (
    <Section className="py-24">
      <Boite>
        <div className="flex flex-col items-center text-center">
          <TitreB c="admissions.frais" centre />
          <div className="mt-8 inline-flex items-center rounded-2xl bg-[var(--doux)] p-1.5">
            {[false, true].map(a => (
              <button key={String(a)} type="button" onClick={() => setAnnuel(a)}
                className={`px-6 py-3 rounded-xl font-bold transition-all ${annuel === a ? 'bg-white shadow-md text-[var(--c1)]' : 'text-[#55635d]'}`}>{a ? 'Pour l\'année' : 'Par mois'}</button>
            ))}
          </div>
        </div>
        <Liste c="admissions.frais.elements" colonnes={4} nouveau={{ niveau: 'Niveau', inscription: '0 F', mensualite: '0 F' }} className="mt-12" classeElement="flex" libelleAjout="Ajouter un tarif">
          {(el, i, ce) => {
            const total = enNombre(el.inscription) + MOIS * enNombre(el.mensualite);
            const vedette = i === 1;
            return (
              <Revele delai={i * 100} className={`w-full rounded-[32px] p-8 flex flex-col ${vedette ? 'bg-[var(--c1)] text-white shadow-2xl lg:-translate-y-3' : 'bg-[var(--doux)]'}`}>
                <div className="flex items-center justify-between">
                  <T c={`${ce}.niveau`} className="titre text-2xl font-extrabold" />
                </div>
                <div className="mt-7 min-h-[84px]">
                  {annuel && !edition ? (
                    <><p className="titre text-4xl font-extrabold">{enFrancs(total)}</p><p className={`text-sm mt-1 ${vedette ? 'text-white/70' : 'text-[#6b7a73]'}`}>inscription + {MOIS} mensualités</p></>
                  ) : (
                    <><T c={`${ce}.mensualite`} as="p" className="titre block text-4xl font-extrabold" /><p className={`text-sm mt-1 ${vedette ? 'text-white/70' : 'text-[#6b7a73]'}`}>par mois</p></>
                  )}
                </div>
                <div className={`mt-6 pt-6 border-t ${vedette ? 'border-white/15' : 'border-black/10'} flex items-center justify-between font-semibold`}>
                  <span className={vedette ? 'text-white/70' : 'text-[#6b7a73]'}>Inscription</span><T c={`${ce}.inscription`} />
                </div>
                <a href="#/admissions" className={`mt-7 h-12 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors ${vedette ? 'bg-white text-[var(--c1)] hover:bg-[var(--c2)] hover:text-white' : 'bg-white hover:bg-[var(--c1)] hover:text-white'}`}>Préinscrire <ArrowRight className="h-4 w-4" /></a>
              </Revele>
            );
          }}
        </Liste>
        <T c="admissions.frais.note" as="p" className="block mt-8 text-center text-[#6b7a73]" />
      </Boite>
    </Section>
  );
}

/** Préinscription en trois étapes, comme une application ; le message part sur WhatsApp. */
export function PreinscriptionB() {
  const { contenu } = useEdition();
  const [etape, setEtape] = useState(0);
  const [v, setV] = useState<Record<string, string>>({});
  const [envoye, setEnvoye] = useState(false);
  const maj = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV(x => ({ ...x, [k]: e.target.value }));
  const etapes = ['L\'enfant', 'Le parent', 'Envoi'];
  const champ = 'w-full h-14 rounded-2xl bg-[var(--doux)] border-2 border-transparent px-5 font-semibold focus:outline-none focus:border-[var(--c1)] focus:bg-white transition-colors';
  const valide = etape === 0 ? !!(v.enfant && v.cycle) : etape === 1 ? !!(v.parent && v.telephone) : true;
  const envoyer = () => {
    const message = `Demande de préinscription\n\nEnfant : ${v.enfant ?? ''}\nNaissance : ${v.naissance ?? ''}\nCycle : ${v.cycle ?? ''}\nClasse : ${v.classe ?? ''}\nParent : ${v.parent ?? ''}\nTéléphone : ${v.telephone ?? ''}\nMessage : ${v.message ?? ''}`;
    window.open(lienWhatsApp(contenu.identite.whatsapp, message), '_blank', 'noopener');
    setEnvoye(true);
  };
  return (
    <Section className="py-24 bg-[var(--doux)]">
      <Boite className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 items-start">
        <div className="lg:sticky lg:top-32">
          <T c="admissions.formulaire.titre" as="h2" className="titre block text-4xl md:text-5xl font-extrabold leading-[1.08]" />
          <T c="admissions.formulaire.texte" as="p" className="block mt-5 text-[17px] text-[#55635d]" />
          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white p-4"><span className="h-11 w-11 rounded-xl bg-[#25D366] text-white flex items-center justify-center"><IconeWhatsApp className="h-5 w-5" /></span><span className="text-sm font-semibold">Votre demande arrive directement sur le WhatsApp de l'école.</span></div>
        </div>
        <div className="rounded-[32px] bg-white p-6 md:p-10 shadow-[0_30px_60px_-40px_rgba(13,31,25,0.5)]">
          <div className="flex items-center gap-2">
            {etapes.map((n, i) => (
              <div key={n} className="flex-1">
                <div className="h-1.5 rounded-full bg-[var(--doux)] overflow-hidden"><div className={`h-full bg-[var(--c1)] transition-[width] duration-500 ${i <= etape ? 'w-full' : 'w-0'}`} /></div>
                <p className={`mt-2 text-sm font-bold ${i <= etape ? 'text-[var(--c1)]' : 'text-[#8a978f]'}`}>{i + 1}. {n}</p>
              </div>
            ))}
          </div>
          <div key={etape} className="mt-8 grid gap-4 apparition">
            {etape === 0 && (<>
              <input className={champ} placeholder="Nom et prénom de l'enfant *" value={v.enfant ?? ''} onChange={maj('enfant')} />
              <input className={champ} type="date" value={v.naissance ?? ''} onChange={maj('naissance')} aria-label="Date de naissance" />
              <div className="grid sm:grid-cols-2 gap-4">
                <select className={champ} value={v.cycle ?? ''} onChange={maj('cycle')}><option value="">Cycle *</option>{contenu.enseignement.cycles.map(c => <option key={c.nom}>{c.nom}</option>)}</select>
                <input className={champ} placeholder="Classe demandée" value={v.classe ?? ''} onChange={maj('classe')} />
              </div>
            </>)}
            {etape === 1 && (<>
              <input className={champ} placeholder="Nom du parent *" value={v.parent ?? ''} onChange={maj('parent')} />
              <input className={champ} type="tel" placeholder="Téléphone *" value={v.telephone ?? ''} onChange={maj('telephone')} />
              <textarea className={`${champ} !h-32 py-4`} placeholder="Un message ? (facultatif)" value={v.message ?? ''} onChange={maj('message')} />
            </>)}
            {etape === 2 && (
              <div className="rounded-2xl bg-[var(--doux)] p-6 space-y-2 text-[15px]">
                {[['Enfant', v.enfant], ['Cycle', v.cycle], ['Classe', v.classe], ['Parent', v.parent], ['Téléphone', v.telephone]].map(([k, x]) => (
                  <p key={k} className="flex justify-between gap-4"><span className="text-[#6b7a73]">{k}</span><span className="font-bold text-right">{x || '—'}</span></p>
                ))}
              </div>
            )}
          </div>
          <div className="mt-8 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setEtape(e => Math.max(0, e - 1))} className={`h-14 px-6 rounded-2xl font-bold border-2 border-black/10 ${etape === 0 ? 'invisible' : ''}`}><ArrowLeft className="h-4 w-4 inline mr-2" />Retour</button>
            {etape < 2
              ? <button type="button" disabled={!valide} onClick={() => setEtape(e => e + 1)} className="h-14 px-8 rounded-2xl bg-[var(--c1)] text-white font-bold disabled:opacity-40 hover:bg-[var(--c2)] transition-colors">Continuer <ArrowRight className="h-4 w-4 inline ml-2" /></button>
              : <button type="button" onClick={envoyer} className="h-14 px-8 rounded-2xl bg-[#25D366] text-white font-bold flex items-center gap-2"><Send className="h-4 w-4" />Envoyer sur WhatsApp</button>}
          </div>
          {envoye && <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--c1)]"><CheckCircle2 className="h-4 w-4" />WhatsApp s'est ouvert avec votre demande.</p>}
        </div>
      </Boite>
    </Section>
  );
}

export function FaqB() {
  const [ouvert, setOuvert] = useState(0);
  const { edition } = useEdition();
  return (
    <Section className="py-24">
      <Boite className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
        <TitreB c="admissions.faq" texte={false} />
        <Liste c="admissions.faq.elements" nouveau={{ question: 'Question ?', reponse: 'Réponse.' }} className="space-y-3" libelleAjout="Ajouter une question">
          {(_, i, ce) => {
            const visible = edition || ouvert === i;
            return (
              <div className={`rounded-[24px] border-2 transition-colors ${visible ? 'border-[var(--c1)] bg-white' : 'border-transparent bg-[var(--doux)]'}`}>
                <button type="button" onClick={() => setOuvert(o => (o === i ? -1 : i))} className="w-full flex items-center gap-4 text-left p-6">
                  <span className={`titre font-extrabold text-sm h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${visible ? 'bg-[var(--c1)] text-white' : 'bg-white'}`}>{String(i + 1).padStart(2, '0')}</span>
                  <T c={`${ce}.question`} className="flex-1 titre font-extrabold text-lg" />
                  <span className={`transition-transform duration-500 ${visible ? 'rotate-180 text-[var(--c2)]' : ''}`}>{visible ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}</span>
                </button>
                <div className={`grid transition-[grid-template-rows] duration-500 ${visible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                  <div className="overflow-hidden"><T c={`${ce}.reponse`} as="p" className="block px-6 pb-6 pl-[4.75rem] text-[#55635d] leading-relaxed" /></div>
                </div>
              </div>
            );
          }}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────── Actualités et contact ─────────── */

export function ListeActusB() {
  const { contenu, edition, majListe } = useEdition();
  const creer = () => {
    const a = nouvelleActualite(identifiant('nouvelle actualite', contenu.actualites.elements.map(x => x.id)));
    majListe('actualites.elements', l => [a, ...l]);
    location.hash = `#/actualites/${a.id}`;
  };
  if (edition) {
    return (
      <Section className="py-20">
        <Boite>
          <div className="flex justify-center mb-10"><button type="button" className="outil !text-sm !px-5 !py-3" onClick={creer}><Plus className="h-4 w-4" />Écrire une nouvelle actualité</button></div>
          <CartesActualites />
        </Boite>
      </Section>
    );
  }
  const [une, ...reste] = contenu.actualites.elements;
  if (!une) return null;
  return (
    <Section className="py-20">
      <Boite>
        <Revele>
          <a href={`#/actualites/${encodeURIComponent(une.id)}`} className="group grid lg:grid-cols-2 gap-8 items-center rounded-[36px] bg-[var(--doux)] p-4 md:p-5">
            <div className="relative h-72 md:h-[420px] rounded-[28px] overflow-hidden">{une.image && <img src={une.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}</div>
            <div className="p-4 md:p-8">
              <p className="flex items-center gap-3 text-sm font-bold"><span className="rounded-full bg-[var(--c2)] text-white px-3 py-1">À la une</span><span className="text-[#6b7a73]">{une.date}</span></p>
              <p className="titre text-3xl md:text-5xl font-extrabold leading-[1.08] mt-5"><span className="relative">{une.titre}</span></p>
              <p className="text-[17px] text-[#55635d] mt-4">{une.texte}</p>
              <span className="mt-7 inline-flex items-center gap-2 font-bold text-[var(--c1)] group-hover:gap-3 transition-all">Lire l'article <ArrowRight className="h-4 w-4" /></span>
            </div>
          </a>
        </Revele>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {reste.map((a, i) => (
            <Revele key={a.id} delai={i * 90}>
              <a href={`#/actualites/${encodeURIComponent(a.id)}`} className="group block">
                <div className="relative h-56 rounded-[28px] overflow-hidden">{a.image && <img src={a.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}<span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--c1)]">{a.categorie}</span></div>
                <p className="text-sm text-[#6b7a73] font-semibold mt-4">{a.date}</p>
                <p className="titre text-xl font-extrabold mt-1.5 group-hover:text-[var(--c1)] transition-colors">{a.titre}</p>
              </a>
            </Revele>
          ))}
        </div>
      </Boite>
    </Section>
  );
}

export function ContactB() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  const [v, setV] = useState({ nom: '', telephone: '', message: '' });
  const lignes = [
    { Icone: MapPin, titre: 'Adresse', valeur: id.adresse },
    { Icone: Phone, titre: 'Téléphone', valeur: id.telephone, lien: `tel:${id.telephone.replace(/\s/g, '')}` },
    { Icone: Mail, titre: 'E-mail', valeur: id.email, lien: `mailto:${id.email}` },
    { Icone: Clock, titre: 'Horaires', valeur: id.horaires },
  ].filter(l => l.valeur);
  const champ = 'w-full h-14 rounded-2xl bg-[var(--doux)] border-2 border-transparent px-5 font-semibold focus:outline-none focus:border-[var(--c1)] focus:bg-white transition-colors';
  return (
    <Section className="py-20">
      <Boite className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
        <div className="rounded-[32px] bg-[var(--c1)] text-white p-8 md:p-10 relative overflow-hidden">
          <span className="absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-white/10" />
          <h2 className="titre text-4xl font-extrabold"><span className="relative inline-block">Parlons-en<Trait trace /></span></h2>
          <div className="mt-10 space-y-5 relative">
            {lignes.map(({ Icone, titre, valeur, lien }) => (
              <a key={titre} href={lien} className="flex items-center gap-4 group">
                <span className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-[var(--c2)] transition-colors"><Icone className="h-6 w-6" /></span>
                <span><span className="block text-sm text-white/60">{titre}</span><span className="block font-bold">{valeur}</span></span>
              </a>
            ))}
            {id.whatsapp && (
              <a href={lienWhatsApp(id.whatsapp, id.messageWhatsApp)} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 h-14 rounded-2xl bg-[#25D366] font-bold"><IconeWhatsApp className="h-5 w-5" />Écrire sur WhatsApp</a>
            )}
          </div>
        </div>
        <div className="rounded-[32px] bg-[var(--doux)] p-8 md:p-10">
          <T c="contact.titre" as="h2" className="titre block text-3xl font-extrabold" />
          <T c="contact.texte" as="p" className="block mt-2 text-[#55635d]" />
          <form className="mt-7 grid gap-4" onSubmit={e => { e.preventDefault(); window.open(lienWhatsApp(id.whatsapp, `Message depuis le site web\n\nNom : ${v.nom}\nTéléphone : ${v.telephone}\n\n${v.message}`), '_blank', 'noopener'); }}>
            <div className="grid sm:grid-cols-2 gap-4">
              <input required className={champ} placeholder="Nom complet *" value={v.nom} onChange={e => setV(x => ({ ...x, nom: e.target.value }))} />
              <input required type="tel" className={champ} placeholder="Téléphone *" value={v.telephone} onChange={e => setV(x => ({ ...x, telephone: e.target.value }))} />
            </div>
            <textarea required className={`${champ} !h-36 py-4`} placeholder="Votre message *" value={v.message} onChange={e => setV(x => ({ ...x, message: e.target.value }))} />
            <button type="submit" className="h-14 rounded-2xl bg-[var(--c1)] text-white font-bold flex items-center justify-center gap-2 hover:bg-[var(--c2)] transition-colors"><Send className="h-4 w-4" />Envoyer sur WhatsApp</button>
          </form>
        </div>
        <div className="lg:col-span-2 rounded-[32px] overflow-hidden h-[420px] bg-[var(--doux)]">
          <iframe title="Plan d'accès" src={lienCarte(id.adresse)} className="w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </Boite>
    </Section>
  );
}
