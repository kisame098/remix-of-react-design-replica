import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { Bouton, Img, PAGES_INTERNES, T, useEdition } from '../../edition';
import { Reseaux } from '../../Gabarit';
import { IconeWhatsApp } from '../../reseaux';
import { lienWhatsApp } from '../../utilitaires';

export const POLICES_PRESTIGE = {
  classique: { nom: 'Éditoriale', titres: "'Instrument Serif', Georgia, serif", texte: "'Inter Tight', system-ui, sans-serif" },
  moderne: { nom: 'Journal', titres: "'Newsreader', Georgia, serif", texte: "'Inter Tight', system-ui, sans-serif" },
  elegante: { nom: 'Gravure', titres: "'Cormorant Garamond', Georgia, serif", texte: "'Inter Tight', system-ui, sans-serif" },
} as const;

export const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/* ─────────────────────────── Outils de mise en scène ─────────────────────────── */

/** Apparition douce quand l'élément entre à l'écran. Toujours visible en mode modification. */
export function Revele({ children, className = '', delai = 0, as: Balise = 'div' }: { children: ReactNode; className?: string; delai?: number; as?: 'div' | 'li' | 'p' }) {
  const { edition } = useEdition();
  const ref = useRef<HTMLDivElement>(null);
  const [vu, setVu] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || vu) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVu(true); obs.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [vu]);
  return (
    <Balise ref={ref as never} className={`revele ${vu || edition ? 'visible' : ''} ${className}`} style={{ transitionDelay: `${delai}ms` }}>
      {children}
    </Balise>
  );
}

/**
 * Chiffre qui compte jusqu'à sa valeur quand il apparaît (« 1 200 », « 96 % »).
 * Le texte reste celui écrit par l'école : seule la partie numérique s'anime.
 */
export function Compteur({ valeur, className = '' }: { valeur: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const morceaux = valeur.match(/^(\D*)(\d[\d\s]*)(.*)$/);
  const cible = morceaux ? Number(morceaux[2].replace(/\D/g, '')) : NaN;
  const [courant, setCourant] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(cible)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setCourant(cible); return; }
    let image = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const debut = performance.now();
      const pas = (t: number) => {
        const p = Math.min(1, (t - debut) / 1800);
        setCourant(Math.round(cible * (1 - Math.pow(1 - p, 3))));
        if (p < 1) image = requestAnimationFrame(pas);
      };
      image = requestAnimationFrame(pas);
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => { obs.disconnect(); cancelAnimationFrame(image); };
  }, [cible]);
  if (!morceaux || !Number.isFinite(cible)) return <span className={className}>{valeur}</span>;
  const espace = /\s/.test(morceaux[2].trim()) || cible >= 1000;
  return (
    <span ref={ref} className={`${className} tabular-nums`} aria-label={valeur}>
      {morceaux[1]}{espace ? courant.toLocaleString('fr-FR') : courant}{morceaux[3]}
    </span>
  );
}

/** Blason généré aux initiales de l'école (remplacé par son logo si elle en a un). */
export function Blason({ className = 'h-12 w-10', clair = false }: { className?: string; clair?: boolean }) {
  const { contenu } = useEdition();
  const id = contenu.identite;
  if (id.logo) return <img src={id.logo} alt={id.nom} className={`${className} object-contain`} />;
  const initiales = id.nom.split(/\s+/).filter(m => m.length > 2).slice(0, 2).map(m => m[0]).join('').toUpperCase();
  return (
    <svg viewBox="0 0 64 76" className={className} role="img" aria-label={id.nom}>
      <path d="M32 2 L61 10 V35 C61 55 47 68 32 74 C17 68 3 55 3 35 V10 Z" style={{ fill: clair ? 'transparent' : 'var(--c1)', stroke: 'var(--c2)' }} strokeWidth="2" />
      <path d="M32 7.5 L55.5 14 V35 C55.5 51.5 44.5 62.5 32 68 C19.5 62.5 8.5 51.5 8.5 35 V14 Z" style={{ fill: 'none', stroke: 'var(--c2)' }} strokeWidth="0.75" />
      <path d="M32 15.5 l1.4 2.9 3.2.45-2.3 2.25.55 3.15-2.85-1.5-2.85 1.5.55-3.15-2.3-2.25 3.2-.45z" style={{ fill: 'var(--c2)' }} />
      <text x="32" y="47" textAnchor="middle" style={{ fill: 'var(--c2)', fontFamily: 'var(--f-titre)', fontSize: initiales.length > 1 ? 19 : 24 }}>{initiales}</text>
      <path d="M17 55 Q32 61 47 55" style={{ fill: 'none', stroke: 'var(--c2)' }} strokeWidth="0.75" />
    </svg>
  );
}

/** Une photo qui suit discrètement le pointeur au survol d'une liste (ordinateur uniquement). */
export function useImageSuiveuse() {
  const [image, setImage] = useState<string | null>(null);
  const position = useRef({ x: 0, y: 0 });
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = (e: MouseEvent) => {
      position.current = { x: e.clientX, y: e.clientY };
      if (boite.current) boite.current.style.transform = `translate(${e.clientX + 28}px, ${e.clientY - 120}px)`;
    };
    // Pendant le défilement, la ligne survolée change sous le pointeur : on masque la photo.
    const cacher = () => setImage(null);
    window.addEventListener('mousemove', f, { passive: true });
    window.addEventListener('scroll', cacher, { passive: true });
    return () => { window.removeEventListener('mousemove', f); window.removeEventListener('scroll', cacher); };
  }, []);
  const calque = (
    <div ref={boite} aria-hidden="true"
      className={`hidden lg:block fixed left-0 top-0 z-30 w-60 h-72 pointer-events-none transition-opacity duration-300 ${image ? 'opacity-100' : 'opacity-0'}`}
      style={{ transform: `translate(${position.current.x + 28}px, ${position.current.y - 120}px)` }}>
      {image && <img src={image} alt="" className="w-full h-full object-cover shadow-2xl" />}
    </div>
  );
  return { montrer: setImage, calque };
}

/* ─────────────────────────── Gabarit ─────────────────────────── */

export function GabaritPrestige({ page, sansBandeau, children }: { page: string; sansBandeau?: boolean; children: ReactNode }) {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  const police = POLICES_PRESTIGE[id.police] ?? POLICES_PRESTIGE.classique;
  const style = {
    '--c1': id.couleur1, '--c2': id.couleur2, '--f-titre': police.titres, '--f-texte': police.texte,
    '--ivoire': '#F7F4EE', '--encre': '#0E1525',
  } as CSSProperties;

  // L'en-tête se pose, transparent, sur une grande photo — seulement si la page commence par une.
  const premiere = (contenu.pagesPrestige[page || 'accueil'] ?? [])[0] ?? '';
  const surPhoto = !sansBandeau && (premiere === 'diaporama' || premiere.startsWith('entete-'));

  return (
    <div className={`site prestige min-h-screen flex flex-col bg-[var(--ivoire)] text-[var(--encre)] antialiased ${edition ? 'pb-24 pt-9' : ''}`} style={style}>
      <EnTete page={page} surPhoto={surPhoto} />
      <main className={`flex-1 ${surPhoto ? '' : 'pt-24'}`}>{children}</main>
      <Pied />
      <WhatsAppDiscret />
    </div>
  );
}

function EnTete({ page, surPhoto }: { page: string; surPhoto: boolean }) {
  const { contenu, edition } = useEdition();
  const [defile, setDefile] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const f = () => setDefile(window.scrollY > 60);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  useEffect(() => setMenu(false), [page]);
  const transparent = surPhoto && !defile;

  return (
    <>
      {/* Annonce : une ligne sobre au-dessus de l'en-tête */}
      <header className={`fixed inset-x-0 ${edition ? 'top-9' : 'top-0'} z-40 transition-[background-color,color,box-shadow,height] duration-500 ${transparent ? 'text-white' : 'bg-[#F7F4EE]/95 backdrop-blur text-[var(--encre)] shadow-[0_1px_0_rgba(14,21,37,0.08)]'}`}>
        {(contenu.annonce.texte || edition) && (
          <div className={`overflow-hidden transition-all duration-500 ${defile ? 'max-h-0' : 'max-h-12'} border-b ${transparent ? 'border-white/15' : 'border-black/5'}`}>
            <p className="max-w-[1400px] mx-auto px-6 lg:px-10 py-2 text-center text-[12px] tracking-wide flex justify-center gap-3 flex-wrap">
              <T c="annonce.texte" className="opacity-80" /><Bouton c="annonce.bouton" className="underline underline-offset-4 decoration-[var(--c2)]" />
            </p>
          </div>
        )}
        <div className={`max-w-[1400px] mx-auto px-6 lg:px-10 flex items-center gap-8 transition-[height] duration-500 ${defile ? 'h-[72px]' : 'h-[92px]'}`}>
          <a href="#/" className="flex items-center gap-4 min-w-0">
            <Blason className={`${defile ? 'h-11 w-9' : 'h-14 w-12'} transition-all duration-500 flex-shrink-0`} />
            <span className="min-w-0">
              <span className="block titre text-[22px] leading-none truncate">{contenu.identite.nom}</span>
              <span className={`block capitales !text-[9.5px] mt-1.5 truncate ${transparent ? 'text-white/60' : 'text-black/45'}`}>{contenu.identite.slogan}</span>
            </span>
          </a>
          <nav className="hidden xl:flex items-center gap-7 ml-auto">
            {PAGES_INTERNES.slice(1).map(p => {
              const actif = p.lien === `#/${page}`;
              return (
                <a key={p.lien} href={p.lien} className="relative text-[13.5px] tracking-wide group py-2">
                  {p.nom}
                  <span className={`absolute left-0 -bottom-0.5 h-px bg-[var(--c2)] transition-all duration-500 ${actif ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                </a>
              );
            })}
          </nav>
          <Bouton c="identite.espaceParents"
            className={`hidden md:inline-flex ml-auto xl:ml-2 items-center h-11 px-6 border text-[12px] capitales !tracking-[0.2em] transition-colors duration-300 ${transparent ? 'border-white/50 hover:bg-white hover:text-[var(--encre)]' : 'border-[#0E1525]/30 hover:bg-[var(--encre)] hover:text-white'}`} />
          <button type="button" onClick={() => setMenu(true)} className="xl:hidden ml-auto md:ml-0 flex items-center gap-3 capitales !text-[11px]" aria-label="Ouvrir le menu">
            Menu <span className="flex flex-col gap-1.5"><span className="block h-px w-7 bg-current" /><span className="block h-px w-5 bg-current ml-auto" /></span>
          </button>
        </div>
      </header>
      {menu && <MenuPleinEcran onFermer={() => setMenu(false)} page={page} />}
    </>
  );
}

/** Menu plein écran : chaque page, et la photo de la page survolée. */
function MenuPleinEcran({ onFermer, page }: { onFermer: () => void; page: string }) {
  const { contenu } = useEdition();
  const images: Record<string, string> = {
    '#/': contenu.accueil.diapos[0]?.image, '#/ecole': contenu.ecole.entete.image, '#/enseignement': contenu.enseignement.entete.image,
    '#/vie-scolaire': contenu.vieScolaire.entete.image, '#/admissions': contenu.admissions.entete.image,
    '#/actualites': contenu.actualites.entete.image, '#/contact': contenu.contact.entete.image,
  };
  const [survol, setSurvol] = useState(`#/${page}`);
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', f);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = ''; };
  }, [onFermer]);

  return (
    <div className="fixed inset-0 z-[60] bg-[var(--c1)] text-white grid lg:grid-cols-[1.1fr_1fr] apparition">
      <div className="flex flex-col px-8 lg:px-16 py-8 overflow-y-auto">
        <div className="flex items-center justify-between">
          <Blason className="h-12 w-10" />
          <button type="button" onClick={onFermer} className="flex items-center gap-3 capitales !text-[11px]">Fermer <X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 flex flex-col justify-center gap-1 py-10">
          {PAGES_INTERNES.map((p, i) => (
            <a key={p.lien} href={p.lien} onMouseEnter={() => setSurvol(p.lien)}
              className="group flex items-baseline gap-6 py-1.5">
              <span className="capitales !text-[10px] text-[var(--c2)] w-8">{ROMAINS[i]}</span>
              <span className="titre text-4xl sm:text-5xl lg:text-6xl leading-tight transition-all duration-500 group-hover:italic group-hover:translate-x-3">{p.nom}</span>
            </a>
          ))}
        </nav>
        <div className="grid sm:grid-cols-2 gap-6 text-sm text-white/60 border-t border-white/15 pt-6">
          <p>{contenu.identite.adresse}<br />{contenu.identite.telephone}</p>
          <div className="flex gap-5 sm:justify-end items-start text-white"><Reseaux className="h-4 w-4" /></div>
        </div>
      </div>
      <div className="hidden lg:block relative overflow-hidden">
        {Object.entries(images).map(([lien, src]) => src && (
          <img key={lien} src={src} alt="" className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${survol === lien ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`} />
        ))}
        <div className="absolute inset-0 bg-[var(--c1-15)]" />
      </div>
    </div>
  );
}

function Pied() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  return (
    <footer className="bg-[var(--c1)] text-white/70">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-24 pb-10">
        <div className="flex flex-col items-center text-center pb-20 border-b border-white/10">
          <Blason className="h-24 w-20" />
          <p className="titre text-white text-4xl md:text-5xl mt-8 max-w-3xl leading-tight">{id.nom}</p>
          <p className="capitales text-[var(--c2)] mt-4">{id.slogan}</p>
        </div>
        <div className="grid gap-12 md:grid-cols-4 py-16 text-sm">
          <div>
            <p className="capitales text-white/40 mb-5">Établissement</p>
            <T c="pied.texte" as="p" className="leading-relaxed" />
          </div>
          <div>
            <p className="capitales text-white/40 mb-5">Navigation</p>
            <ul className="space-y-2.5">{PAGES_INTERNES.map(p => <li key={p.lien}><a href={p.lien} className="hover:text-white transition-colors">{p.nom}</a></li>)}</ul>
          </div>
          <div>
            <p className="capitales text-white/40 mb-5">Coordonnées</p>
            <p className="leading-relaxed">{id.adresse}<br />{id.telephone}<br /><a href={`mailto:${id.email}`} className="hover:text-white">{id.email}</a><br />{id.horaires}</p>
          </div>
          <div>
            <p className="capitales text-white/40 mb-5">Nous suivre</p>
            <div className="flex gap-5 text-white"><Reseaux className="h-4 w-4" /></div>
            <a href="#/admissions" className="mt-8 inline-flex items-center gap-3 border border-[var(--c2)] text-white px-6 h-12 capitales !text-[11px] hover:bg-[var(--c2)] transition-colors">Candidater <ArrowUpRight className="h-4 w-4" /></a>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between gap-3 border-t border-white/10 pt-8 text-[11px] tracking-wider text-white/35 uppercase">
          <span>© {new Date().getFullYear()} {id.nom} — Tous droits réservés</span>
          <span>Fondé en {id.creation} · Site propulsé par SenClass</span>
        </div>
      </div>
    </footer>
  );
}

/** WhatsApp sobre : un carré bleu nuit, l'icône dorée. */
function WhatsAppDiscret() {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  if (!id.whatsapp) return null;
  return (
    <a href={lienWhatsApp(id.whatsapp, id.messageWhatsApp)} target="_blank" rel="noreferrer" aria-label="Écrire sur WhatsApp"
      className={`fixed right-6 ${edition ? 'bottom-24' : 'bottom-6'} z-40 h-14 w-14 bg-[var(--c1)] text-[var(--c2)] border border-[var(--c2-30)] shadow-xl flex items-center justify-center hover:bg-[var(--c2)] hover:text-white transition-colors duration-300`}>
      <IconeWhatsApp className="h-6 w-6" />
    </a>
  );
}

/** En-tête des pages intérieures : grande photo, titre éditorial, numéro romain de la page. */
export function EntetePageP({ c, page }: { c: string; page: string }) {
  const index = PAGES_INTERNES.findIndex(p => p.lien === `#/${page}`);
  return (
    <section className="relative h-[78svh] min-h-[520px] flex items-end overflow-hidden grain">
      <Img c={`${c}.image`} className="absolute inset-0 w-full h-full object-cover zoom-lent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0E1525]/90 via-[#0E1525]/35 to-[#0E1525]/30 pointer-events-none" />
      <div className="relative w-full max-w-[1400px] mx-auto px-6 lg:px-10 pb-16 text-white grid lg:grid-cols-[auto_1fr] gap-x-16 items-end">
        <Revele className="hidden lg:block titre text-[11rem] leading-[0.75] text-white/15 select-none">{ROMAINS[Math.max(index, 0)]}</Revele>
        <div>
          <Revele><p className="capitales text-[var(--c2)]"><a href="#/" className="hover:text-white">Accueil</a> <span className="mx-2 text-white/30">—</span> <T c={`${c}.titre`} /></p></Revele>
          <Revele delai={120}><T c={`${c}.titre`} as="h1" className="titre block text-6xl md:text-8xl leading-[0.95] mt-5" /></Revele>
          <Revele delai={240}><T c={`${c}.texte`} as="p" className="block mt-6 text-lg text-white/75 max-w-xl font-light" /></Revele>
        </div>
      </div>
    </section>
  );
}
