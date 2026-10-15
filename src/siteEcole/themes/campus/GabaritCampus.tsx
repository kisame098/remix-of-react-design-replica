import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUp, ArrowUpRight, ChevronRight, GraduationCap, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import { Bouton, Img, PAGES_INTERNES, T, useEdition } from '../../edition';
import { Reseaux } from '../../Gabarit';
import { IconeWhatsApp } from '../../reseaux';
import { lienWhatsApp } from '../../utilitaires';

export const POLICES_CAMPUS = {
  classique: { nom: 'Académique', titres: "'Bitter', Georgia, serif", texte: "'Inter', system-ui, sans-serif" },
  moderne: { nom: 'Robuste', titres: "'Roboto Slab', Georgia, serif", texte: "'Inter', system-ui, sans-serif" },
  elegante: { nom: 'Littéraire', titres: "'Lora', Georgia, serif", texte: "'Inter', system-ui, sans-serif" },
} as const;

/* ─────────────────────────── Petits éléments communs ─────────────────────────── */

/** Progression (0 → 1) d'un élément qui traverse l'écran : sert au remplissage des titres. */
export function useRempli<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const { edition } = useEdition();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (edition || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.style.setProperty('--rempli', '1'); return; }
    let image = 0;
    const calculer = () => {
      image = 0;
      const r = el.getBoundingClientRect();
      const h = innerHeight;
      // 0 quand le titre entre par le bas (90 % de l'écran), 1 quand il atteint 45 %.
      const p = Math.min(1, Math.max(0, (h * 0.9 - r.top) / (h * 0.45)));
      el.style.setProperty('--rempli', p.toFixed(3));
    };
    const surDefilement = () => { if (!image) image = requestAnimationFrame(calculer); };
    calculer();
    window.addEventListener('scroll', surDefilement, { passive: true });
    window.addEventListener('resize', surDefilement);
    return () => { window.removeEventListener('scroll', surDefilement); window.removeEventListener('resize', surDefilement); cancelAnimationFrame(image); };
  }, [edition]);
  return ref;
}

/** Petite étiquette au-dessus des titres : le mortier de diplômé + un mot. */
export function Sourcil({ c, clair = false, centre = false }: { c: string; clair?: boolean; centre?: boolean }) {
  return (
    <p className={`flex items-center gap-2.5 ${centre ? 'justify-center' : ''} text-[15px] font-semibold ${clair ? 'text-[var(--c2)]' : 'text-[var(--c1)]'}`}>
      <GraduationCap className="h-5 w-5" /><T c={c} />
    </p>
  );
}

/** Titre de section Campus : sourcil + grand titre qui se remplit de couleur au défilement. */
export function TitreC({ c, centre = false, clair = false, texte = true, className = '' }: { c: string; centre?: boolean; clair?: boolean; texte?: boolean; className?: string }) {
  const ref = useRempli<HTMLHeadingElement>();
  return (
    <div className={`${centre ? 'text-center mx-auto' : ''} max-w-3xl ${className}`}>
      <Sourcil c={`${c}.surtitre`} clair={clair} centre={centre} />
      <h2 ref={ref} className="mt-4">
        <T c={`${c}.titre`} className={`titre remplissage ${clair ? 'remplissage-clair' : ''} text-4xl md:text-5xl font-bold leading-[1.15] [text-wrap:balance] inline`} />
      </h2>
      {texte && <T c={`${c}.texte`} as="p" className={`block mt-5 text-[17px] leading-relaxed ${clair ? 'text-white/70' : 'text-[#5b6472]'}`} />}
    </div>
  );
}

/** Photo dans un cadre blanc épais aux coins arrondis (signature visuelle du modèle). */
export function Cadre({ c, className = '', rayon = 'rounded-[28px]' }: { c: string; className?: string; rayon?: string }) {
  return (
    <div className={`relative ${rayon} bg-white p-2 shadow-[0_10px_40px_-12px_rgba(11,58,102,0.25)] ${className}`}>
      <div className={`relative h-full w-full overflow-hidden ${rayon.replace(/\d+px/, m => `${Math.max(0, parseInt(m) - 8)}px`)}`}>
        <Img c={c} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      </div>
    </div>
  );
}

/** Bouton principal : pilule jaune, icône qui glisse au survol. */
export const CLASSE_BOUTON_JAUNE = 'group/b inline-flex items-center gap-3 h-[52px] pl-7 pr-2 rounded-full bg-[var(--c2)] text-[var(--encre)] font-semibold text-[15px] hover:bg-white transition-colors duration-300';
export const CLASSE_BOUTON_BLANC = 'inline-flex items-center gap-3 h-[52px] px-7 rounded-full bg-white text-[var(--encre)] font-semibold text-[15px] shadow-sm hover:bg-[var(--c2)] transition-colors duration-300';

export const Boite = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`max-w-[1240px] mx-auto px-5 md:px-8 ${className}`}>{children}</div>;

/* ─────────────────────────── Gabarit ─────────────────────────── */

export function GabaritCampus({ page, sansBandeau, children }: { page: string; sansBandeau?: boolean; children: ReactNode }) {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  const police = POLICES_CAMPUS[id.police] ?? POLICES_CAMPUS.classique;
  const style = {
    '--c1': id.couleur1, '--c2': id.couleur2, '--f-titre': police.titres, '--f-texte': police.texte,
    '--fond': '#F6F4EE', '--encre': '#0A1A33',
  } as CSSProperties;
  const premiere = (contenu.pagesCampus[page || 'accueil'] ?? [])[0] ?? '';
  const surPhoto = !sansBandeau && (premiere === 'diaporama' || premiere.startsWith('entete-'));

  return (
    <div className={`site campus min-h-screen flex flex-col bg-[var(--fond)] text-[var(--encre)] antialiased ${edition ? 'pb-24 pt-9' : ''}`} style={style}>
      <EnTete page={page} surPhoto={surPhoto} />
      <main className={`flex-1 ${surPhoto ? '' : 'pt-[96px]'}`}>{children}</main>
      <Pied />
      <Flottants />
    </div>
  );
}

function EnTete({ page, surPhoto }: { page: string; surPhoto: boolean }) {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  const [defile, setDefile] = useState(false);
  const [panneau, setPanneau] = useState(false);
  useEffect(() => {
    const f = () => setDefile(window.scrollY > 40);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  useEffect(() => setPanneau(false), [page]);
  const plein = defile || !surPhoto;

  return (
    <>
      <header className={`fixed inset-x-0 ${edition ? 'top-9' : 'top-0'} z-40 transition-all duration-500 ${plein ? 'bg-[var(--c1)] shadow-[0_8px_30px_-10px_rgba(0,0,0,0.35)]' : 'bg-transparent'}`}>
        <div className={`max-w-[1400px] mx-auto px-5 md:px-8 flex items-center gap-6 text-white transition-[height] duration-500 ${defile ? 'h-[76px]' : 'h-[96px]'}`}>
          <LogoCampus />
          <nav className="hidden xl:flex items-center gap-1 mx-auto">
            {PAGES_INTERNES.map(p => {
              const actif = p.lien === `#/${page}` || (p.lien === '#/' && page === '');
              return (
                <a key={p.lien} href={p.lien} className={`relative px-3.5 py-2 text-[15px] font-medium transition-colors ${actif ? 'text-[var(--c2)]' : 'text-white/90 hover:text-[var(--c2)]'}`}>
                  {p.nom}
                </a>
              );
            })}
          </nav>
          <div className="ml-auto xl:ml-0 flex items-center gap-4">
            {id.whatsapp && (
              <a href={lienWhatsApp(id.whatsapp, id.messageWhatsApp)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="hidden md:flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><IconeWhatsApp className="h-5 w-5" /></a>
            )}
            <span className="hidden md:block h-6 w-px bg-white/25" />
            <button type="button" onClick={() => setPanneau(true)} aria-label="Ouvrir le menu" className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-white/10"><Menu className="h-6 w-6" /></button>
            <Bouton c="annonce.bouton" className="hidden sm:inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[var(--c2)] text-[var(--encre)] font-semibold text-[15px] hover:bg-white transition-colors duration-300" />
          </div>
        </div>
      </header>
      <PanneauLateral ouvert={panneau} onFermer={() => setPanneau(false)} page={page} />
    </>
  );
}

export function LogoCampus({ grand = false }: { grand?: boolean }) {
  const { contenu } = useEdition();
  const id = contenu.identite;
  const mots = id.nom.split(/\s+/);
  const dernier = mots.length > 1 ? mots.pop()! : id.nom;
  return (
    <a href="#/" className="flex items-center gap-3 min-w-0 text-white">
      {id.logo
        ? <img src={id.logo} alt={id.nom} className={`${grand ? 'h-16 w-16' : 'h-12 w-12'} object-contain flex-shrink-0`} />
        : (
          <svg viewBox="0 0 48 56" className={`${grand ? 'h-16 w-14' : 'h-12 w-11'} flex-shrink-0`} aria-hidden="true">
            <path d="M24 2 L45 9 V28 C45 42 35 51 24 54 C13 51 3 42 3 28 V9 Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M24 14 L37 20 L24 26 L11 20 Z" fill="currentColor" />
            <path d="M16 23.5 V30 C16 33 20 35 24 35 C28 35 32 33 32 30 V23.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M37 20 V29" stroke="currentColor" strokeWidth="2" /><circle cx="37" cy="30" r="1.8" fill="currentColor" />
            <path d="M14 42 Q24 47 34 42" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      <span className="leading-none min-w-0">
        {mots.length > 0 && <span className={`block font-semibold uppercase tracking-[0.12em] ${grand ? 'text-[13px]' : 'text-[11px]'} text-white/80 truncate`}>{mots.join(' ')}</span>}
        <span className={`block titre font-extrabold uppercase ${grand ? 'text-[34px]' : 'text-[26px]'} leading-[1.05] truncate`}>{dernier}</span>
      </span>
    </a>
  );
}

/** Panneau latéral (droite) : navigation, coordonnées, réseaux. */
function PanneauLateral({ ouvert, onFermer, page }: { ouvert: boolean; onFermer: () => void; page: string }) {
  const { contenu } = useEdition();
  const id = contenu.identite;
  useEffect(() => {
    if (!ouvert) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [ouvert, onFermer]);
  return (
    <div className={`fixed inset-0 z-[60] ${ouvert ? '' : 'pointer-events-none'}`} aria-hidden={!ouvert}>
      <div onClick={onFermer} className={`absolute inset-0 bg-[#0A1A33]/60 backdrop-blur-sm transition-opacity duration-500 ${ouvert ? 'opacity-100' : 'opacity-0'}`} />
      <aside className={`absolute right-0 inset-y-0 w-full max-w-[420px] bg-[var(--c1)] text-white overflow-y-auto transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${ouvert ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-7 border-b border-white/10">
          <LogoCampus />
          <button type="button" onClick={onFermer} aria-label="Fermer" className="h-11 w-11 rounded-full bg-[var(--c2)] text-[var(--encre)] flex items-center justify-center hover:rotate-90 transition-transform duration-300"><X className="h-5 w-5" /></button>
        </div>
        <nav className="p-7 flex flex-col">
          {PAGES_INTERNES.map((p, i) => (
            <a key={p.lien} href={p.lien}
              style={{ transitionDelay: ouvert ? `${120 + i * 50}ms` : '0ms' }}
              className={`group flex items-center justify-between py-3.5 border-b border-white/10 titre text-[22px] font-semibold transition-all duration-500 ${ouvert ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'} ${p.lien === `#/${page}` || (p.lien === '#/' && !page) ? 'text-[var(--c2)]' : 'hover:text-[var(--c2)]'}`}>
              {p.nom}<ChevronRight className="h-5 w-5 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition" />
            </a>
          ))}
        </nav>
        <div className="px-7 pb-8 space-y-4 text-white/75 text-[15px]">
          <p className="flex gap-3"><MapPin className="h-5 w-5 text-[var(--c2)] flex-shrink-0" />{id.adresse}</p>
          <p className="flex gap-3"><Phone className="h-5 w-5 text-[var(--c2)] flex-shrink-0" />{id.telephone}</p>
          <p className="flex gap-3"><Mail className="h-5 w-5 text-[var(--c2)] flex-shrink-0" />{id.email}</p>
          <div className="flex gap-3 pt-3 text-white">
            <Reseaux className="h-4 w-4" />
          </div>
          <Bouton c="identite.espaceParents" className="mt-4 flex items-center justify-center h-12 rounded-full bg-white text-[var(--encre)] font-semibold" />
        </div>
      </aside>
    </div>
  );
}

function Pied() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  return (
    <footer className="bg-[var(--c1)] text-white relative overflow-hidden">
      <div className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full border-[40px] border-white/[0.04]" />
      <div className="max-w-[1400px] mx-auto grid lg:grid-cols-[400px_1fr]">
        <div className="bg-black/10 px-5 md:px-10 py-16 space-y-8">
          <LogoCampus grand />
          <T c="pied.texte" as="p" className="block text-white/70 leading-relaxed" />
          <div className="grid grid-cols-2 gap-5 text-sm">
            <div><p className="text-white/50 mb-1">E-mail :</p><a href={`mailto:${id.email}`} className="font-medium hover:text-[var(--c2)] break-all">{id.email}</a></div>
            <div><p className="text-white/50 mb-1">Téléphone :</p><a href={`tel:${id.telephone.replace(/\s/g, '')}`} className="font-medium hover:text-[var(--c2)]">{id.telephone}</a></div>
          </div>
          <Bouton c="identite.espaceParents" className="inline-flex items-center gap-3 h-12 px-6 rounded-xl bg-white/10 border border-white/15 hover:bg-white hover:text-[var(--encre)] transition-colors font-semibold" />
          <div className="flex items-center gap-4 pt-2"><span className="text-white/60 text-sm">Suivez-nous</span><span className="flex gap-3"><Reseaux className="h-4 w-4" /></span></div>
        </div>
        <div className="px-5 md:px-10 py-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          <ColonnePied titre="L'école" liens={PAGES_INTERNES.slice(1, 4)} />
          <ColonnePied titre="Liens utiles" liens={PAGES_INTERNES.slice(4)} />
          <div>
            <p className="titre text-xl font-bold">WhatsApp</p>
            <span className="block h-0.5 w-10 bg-[var(--c2)] mt-3 mb-6" />
            <p className="text-white/70 text-[15px] mb-5">Une question ? Écrivez-nous, nous répondons dans la journée.</p>
            {id.whatsapp && (
              <a href={lienWhatsApp(id.whatsapp, id.messageWhatsApp)} target="_blank" rel="noreferrer"
                className="flex items-center justify-between gap-3 h-14 pl-5 pr-2 rounded-xl bg-white/10 border border-white/15 hover:border-[var(--c2)] transition-colors">
                <span className="font-medium">{id.whatsapp}</span>
                <span className="h-10 w-10 rounded-lg bg-[var(--c2)] text-[var(--encre)] flex items-center justify-center"><ArrowUpRight className="h-5 w-5" /></span>
              </a>
            )}
          </div>
          <p className="sm:col-span-2 lg:col-span-3 pt-8 mt-auto border-t border-white/10 text-sm text-white/50 flex flex-col md:flex-row justify-between gap-2">
            <span>© {new Date().getFullYear()} {id.nom}. Tous droits réservés.</span><span>Site propulsé par SenClass</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

function ColonnePied({ titre, liens }: { titre: string; liens: { lien: string; nom: string }[] }) {
  return (
    <div>
      <p className="titre text-xl font-bold">{titre}</p>
      <span className="block h-0.5 w-10 bg-[var(--c2)] mt-3 mb-6" />
      <ul className="space-y-3 text-white/70">
        {liens.map(l => <li key={l.lien}><a href={l.lien} className="hover:text-[var(--c2)] hover:pl-1.5 transition-all">{l.nom}</a></li>)}
      </ul>
    </div>
  );
}

/** WhatsApp + « remonter » avec un anneau qui montre la progression de la lecture. */
function Flottants() {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  const [progres, setProgres] = useState(0);
  useEffect(() => {
    const f = () => setProgres(Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const tour = 2 * Math.PI * 22;
  return (
    <div className={`fixed right-5 ${edition ? 'bottom-24' : 'bottom-5'} z-40 flex flex-col items-center gap-3`}>
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Remonter en haut"
        className={`relative h-12 w-12 rounded-full bg-[var(--c1)] text-white flex items-center justify-center shadow-lg transition-all duration-500 ${progres > 0.05 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="2" />
          <circle cx="24" cy="24" r="22" fill="none" stroke="var(--c2)" strokeWidth="2" strokeLinecap="round" strokeDasharray={tour} strokeDashoffset={tour * (1 - progres)} />
        </svg>
        <ArrowUp className="h-5 w-5" />
      </button>
      {id.whatsapp && (
        <a href={lienWhatsApp(id.whatsapp, id.messageWhatsApp)} target="_blank" rel="noreferrer" aria-label="WhatsApp"
          className="h-14 w-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
          <IconeWhatsApp className="h-7 w-7" />
        </a>
      )}
    </div>
  );
}

/** En-tête des pages intérieures : bandeau bleu, titre, fil d'Ariane, photo encadrée. */
export function EnteteC({ c }: { c: string }) {
  return (
    <section className="relative bg-[var(--c1)] text-white overflow-hidden pt-[96px]">
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '22px 22px' }} />
      <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-[var(--c2)] opacity-[0.07] blur-2xl" />
      <Boite className="relative grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center py-16 lg:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-2 text-sm">
            <a href="#/" className="text-white/70 hover:text-[var(--c2)]">Accueil</a><ChevronRight className="h-3.5 w-3.5 text-white/40" /><T c={`${c}.titre`} className="text-[var(--c2)] font-medium" />
          </p>
          <T c={`${c}.titre`} as="h1" className="titre block text-5xl md:text-6xl font-bold mt-6 leading-[1.1]" />
          <T c={`${c}.texte`} as="p" className="block mt-5 text-lg text-white/70 max-w-lg" />
        </div>
        <div className="relative">
          <div className="absolute -left-6 -bottom-6 h-24 w-24 hachures rounded-2xl opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, rgba(255,255,255,.25) 0 2px, transparent 2px 8px)' }} />
          <Cadre c={`${c}.image`} className="h-72 md:h-80" />
        </div>
      </Boite>
    </section>
  );
}
