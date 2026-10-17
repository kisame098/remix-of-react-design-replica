import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUpRight, ChevronRight, Mail, MapPin, Phone, X } from 'lucide-react';
import { Bouton, Img, PAGES_INTERNES, T, useEdition, useValeur } from '../../edition';
import { Reseaux } from '../../Gabarit';
import { IconeWhatsApp } from '../../reseaux';
import { lienWhatsApp } from '../../utilitaires';
import { Revele } from '../prestige/GabaritPrestige';

export const POLICES_BAOBAB = {
  classique: { nom: 'Ronde', titres: "'Plus Jakarta Sans', system-ui, sans-serif", texte: "'Plus Jakarta Sans', system-ui, sans-serif" },
  moderne: { nom: 'Géométrique', titres: "'Outfit', system-ui, sans-serif", texte: "'Plus Jakarta Sans', system-ui, sans-serif" },
  elegante: { nom: 'Douce', titres: "'Manrope', system-ui, sans-serif", texte: "'Manrope', system-ui, sans-serif" },
} as const;

/* ─────────────────────────── Éléments communs ─────────────────────────── */

/** Trait irrégulier, comme tracé au feutre, qui se dessine sous un mot. */
export function Trait({ className = '', trace = false }: { className?: string; trace?: boolean }) {
  return (
    <svg viewBox="0 0 300 24" preserveAspectRatio="none" className={`trait absolute left-0 -bottom-2 w-full h-[0.42em] ${trace ? 'trace' : ''} ${className}`} aria-hidden="true">
      <path d="M4 16 C 60 6, 120 4, 170 10 S 260 18, 296 8" fill="none" stroke="var(--c2)" strokeWidth="7" strokeLinecap="round" pathLength={1} />
    </svg>
  );
}

/** Pastille au-dessus des titres : un point orange et un mot. */
export function Pastille({ c, clair = false }: { c: string; clair?: boolean }) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-bold uppercase tracking-[0.12em] ${clair ? 'bg-white/10 text-white' : 'bg-[var(--c1-10)] text-[var(--c1)]'}`}>
      <span className="h-2 w-2 rounded-full bg-[var(--c2)]" /><T c={c} />
    </p>
  );
}

/**
 * Titre Baobab : le dernier mot est mis en couleur et souligné d'un trait qui
 * se dessine quand le titre apparaît. En modification, le titre reste un texte simple.
 */
export function TitreB({ c, centre = false, clair = false, texte = true, className = '' }: { c: string; centre?: boolean; clair?: boolean; texte?: boolean; className?: string }) {
  const { edition } = useEdition();
  const titre = useValeur<string>(`${c}.titre`) ?? '';
  const mots = titre.trim().split(/\s+/);
  const dernier = mots.pop() ?? '';
  return (
    <Revele className={`${centre ? 'text-center mx-auto' : ''} max-w-3xl ${className}`}>
      <Pastille c={`${c}.surtitre`} clair={clair} />
      <h2 className={`titre mt-5 text-4xl md:text-[3.25rem] font-extrabold leading-[1.08] [text-wrap:balance] ${clair ? 'text-white' : ''}`}>
        {edition ? <T c={`${c}.titre`} /> : (
          <>{mots.join(' ')} <span className={`relative inline-block whitespace-nowrap ${clair ? 'text-[var(--c2)]' : 'text-[var(--c1)]'}`}>{dernier}<Trait /></span></>
        )}
      </h2>
      {texte && <T c={`${c}.texte`} as="p" className={`block mt-5 text-[17px] leading-relaxed ${clair ? 'text-white/70' : 'text-[#55635d]'}`} />}
    </Revele>
  );
}

export const Boite = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`max-w-[1260px] mx-auto px-5 md:px-8 ${className}`}>{children}</div>;

export const BOUTON_VERT = 'group/b inline-flex items-center gap-2.5 h-14 pl-7 pr-2 rounded-2xl bg-[var(--c1)] text-white font-bold hover:bg-[var(--encre)] transition-colors duration-300';
export const BOUTON_ORANGE = 'group/b inline-flex items-center gap-2.5 h-14 pl-7 pr-2 rounded-2xl bg-[var(--c2)] text-white font-bold hover:bg-[var(--c1)] transition-colors duration-300';
export const BOUTON_CONTOUR = 'inline-flex items-center gap-2 h-14 px-7 rounded-2xl border-2 border-[var(--c1-15)] text-[var(--encre)] font-bold hover:border-[var(--c1)] hover:bg-[var(--c1)] hover:text-white transition-colors duration-300';

/** Le petit carré blanc avec flèche, à droite des boutons pleins. */
export const Fleche = () => (
  <span className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center transition-transform duration-300 group-hover/b:translate-x-0.5 group-hover/b:-translate-y-0.5"><ArrowUpRight className="h-4 w-4" /></span>
);

/* ─────────────────────────── Gabarit ─────────────────────────── */

export function GabaritBaobab({ page, children }: { page: string; children: ReactNode }) {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  const police = POLICES_BAOBAB[id.police] ?? POLICES_BAOBAB.classique;
  const style = {
    '--c1': id.couleur1, '--c2': id.couleur2, '--f-titre': police.titres, '--f-texte': police.texte,
    '--doux': '#F3F7F4', '--encre': '#0D1F19',
  } as CSSProperties;
  return (
    <div className={`site baobab min-h-screen flex flex-col bg-white text-[var(--encre)] antialiased ${edition ? 'pb-24 pt-9' : ''}`} style={style}>
      <Annonce />
      <EnTete page={page} />
      <main className="flex-1">{children}</main>
      <Pied />
      <WhatsAppFlottant />
    </div>
  );
}

function Annonce() {
  const { contenu, edition } = useEdition();
  if (!edition && !contenu.annonce.texte) return null;
  return (
    <div className="bg-[var(--c1)] text-white text-[13.5px]">
      <Boite className="py-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#22c55e] point-vivant" /><T c="annonce.texte" /></span>
        <Bouton c="annonce.bouton" className="font-bold text-[var(--c2)] hover:underline underline-offset-4" />
      </Boite>
    </div>
  );
}

/** Logo + nom de l'école. Le nom n'est jamais écrasé par le menu : trop long, il passe sur deux lignes. */
export function LogoBaobab({ clair = false }: { clair?: boolean }) {
  const { contenu } = useEdition();
  const id = contenu.identite;
  const initiales = id.nom.split(/\s+/).filter(m => m.length > 2).slice(0, 2).map(m => m[0]).join('').toUpperCase();
  return (
    <a href="#/" className="flex items-center gap-3 min-w-0 xl:flex-shrink-0">
      {id.logo ? <img src={id.logo} alt={id.nom} className="h-12 w-12 object-contain flex-shrink-0" /> : (
        <span className="relative h-12 w-12 flex-shrink-0">
          <span className="absolute inset-0 rounded-2xl bg-[var(--c1)] rotate-6" />
          <span className="absolute inset-0 rounded-2xl bg-[var(--c2)] -rotate-6 opacity-90 mix-blend-multiply" />
          <span className="relative h-full w-full flex items-center justify-center titre font-extrabold text-white text-lg">{initiales}</span>
        </span>
      )}
      <span className="min-w-0 leading-tight">
        <span title={id.nom} className={`titre font-extrabold text-[19px] xl:text-[17px] line-clamp-2 break-words max-w-[250px] xl:max-w-[190px] ${clair ? 'text-white' : ''}`}>{id.nom}</span>
        <span className={`block text-xs font-medium truncate max-w-[250px] xl:max-w-[190px] ${clair ? 'text-white/60' : 'text-[#6b7a73]'}`}>{id.slogan}</span>
      </span>
    </a>
  );
}

function EnTete({ page }: { page: string }) {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  const [defile, setDefile] = useState(false);
  const [lecture, setLecture] = useState(0);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const f = () => {
      setDefile(window.scrollY > 30);
      setLecture(Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)));
    };
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  useEffect(() => setMenu(false), [page]);

  return (
    <>
      <header className={`sticky ${edition ? 'top-9' : 'top-0'} z-40 bg-white/90 backdrop-blur-xl transition-shadow duration-300 ${defile ? 'shadow-[0_10px_30px_-18px_rgba(13,31,25,0.35)]' : ''}`}>
        <Boite className={`flex items-center gap-6 xl:gap-4 transition-[height] duration-300 ${defile ? 'h-[72px]' : 'h-[88px]'}`}>
          <LogoBaobab />
          <nav className="hidden xl:flex items-center mx-auto whitespace-nowrap">
            {PAGES_INTERNES.map(p => {
              const actif = p.lien === `#/${page}` || (p.lien === '#/' && page === '');
              return (
                <a key={p.lien} href={p.lien} className={`relative px-2.5 py-2 rounded-xl text-[15px] font-semibold transition-colors ${actif ? 'text-[var(--c1)]' : 'text-[#43514b] hover:text-[var(--c1)] hover:bg-[var(--doux)]'}`}>
                  {p.nom}
                  {actif && <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-1.5 w-1.5 rounded-full bg-[var(--c2)]" />}
                </a>
              );
            })}
          </nav>
          {/* Le numéro complet prendrait la place du nom de l'école : une icône suffit à côté du menu. */}
          <a href={`tel:${id.telephone.replace(/\s/g, '')}`} title={`Appelez-nous : ${id.telephone}`} aria-label={`Appelez-nous : ${id.telephone}`} className="hidden xl:flex flex-shrink-0 h-11 w-11 rounded-xl bg-[var(--doux)] text-[var(--c1)] items-center justify-center hover:bg-[var(--c1)] hover:text-white transition-colors">
            <Phone className="h-5 w-5" />
          </a>
          <Bouton c="identite.espaceParents" className="hidden md:inline-flex items-center h-12 px-6 rounded-xl bg-[var(--c1)] text-white font-bold whitespace-nowrap hover:bg-[var(--c2)] transition-colors ml-auto xl:ml-0" />
          <button type="button" onClick={() => setMenu(true)} aria-label="Ouvrir le menu" className="xl:hidden ml-auto md:ml-0 h-12 w-12 rounded-xl bg-[var(--doux)] flex flex-col items-center justify-center gap-1.5">
            <span className="h-0.5 w-5 bg-[var(--encre)] rounded" /><span className="h-0.5 w-3.5 bg-[var(--c2)] rounded ml-1.5" /><span className="h-0.5 w-5 bg-[var(--encre)] rounded" />
          </button>
        </Boite>
        {/* Barre de lecture */}
        <span className="absolute left-0 bottom-0 h-[3px] bg-gradient-to-r from-[var(--c1)] to-[var(--c2)] rounded-r-full transition-[width] duration-150" style={{ width: `${lecture * 100}%` }} />
      </header>

      {/* Menu mobile : une feuille qui monte du bas, comme une application */}
      <div className={`fixed inset-0 z-[60] xl:hidden ${menu ? '' : 'pointer-events-none'}`} aria-hidden={!menu}>
        <div onClick={() => setMenu(false)} className={`absolute inset-0 bg-[#0D1F19]/50 transition-opacity duration-300 ${menu ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute inset-x-0 bottom-0 max-h-[88svh] overflow-y-auto rounded-t-[32px] bg-white p-6 pb-8 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${menu ? 'translate-y-0' : 'translate-y-full'}`}>
          <span className="block mx-auto h-1.5 w-12 rounded-full bg-black/10 mb-6" />
          <div className="flex items-center justify-between mb-6">
            <LogoBaobab />
            <button type="button" onClick={() => setMenu(false)} aria-label="Fermer" className="h-11 w-11 rounded-xl bg-[var(--doux)] flex items-center justify-center"><X className="h-5 w-5" /></button>
          </div>
          <nav className="grid grid-cols-2 gap-3">
            {PAGES_INTERNES.map(p => {
              const actif = p.lien === `#/${page}` || (p.lien === '#/' && page === '');
              return (
                <a key={p.lien} href={p.lien} className={`rounded-2xl px-4 py-4 font-bold flex items-center justify-between ${actif ? 'bg-[var(--c1)] text-white' : 'bg-[var(--doux)]'}`}>
                  {p.nom}<ChevronRight className="h-4 w-4 opacity-50" />
                </a>
              );
            })}
          </nav>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <a href={`tel:${id.telephone.replace(/\s/g, '')}`} className="rounded-2xl border-2 border-[var(--c1-15)] px-4 py-3.5 font-bold flex items-center gap-2"><Phone className="h-4 w-4 text-[var(--c1)]" />Appeler</a>
            {id.whatsapp && <a href={lienWhatsApp(id.whatsapp, id.messageWhatsApp)} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#25D366] text-white px-4 py-3.5 font-bold flex items-center gap-2"><IconeWhatsApp className="h-4 w-4" />WhatsApp</a>}
          </div>
        </div>
      </div>
    </>
  );
}

function Pied() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  return (
    <footer className="px-3 md:px-5 pb-3 md:pb-5">
      <div className="relative rounded-[32px] bg-[var(--encre)] text-white overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--c1)] opacity-40 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-[var(--c2)] opacity-15 blur-3xl" />
        <Boite className="relative py-16">
          <div className="grid lg:grid-cols-[1.3fr_1fr_1fr_1.2fr] gap-12">
            <div className="space-y-6">
              <LogoBaobab clair />
              <T c="pied.texte" as="p" className="block text-white/60 leading-relaxed" />
              <div className="flex gap-4 text-white"><Reseaux className="h-5 w-5" /></div>
            </div>
            <div>
              <p className="font-bold mb-5">L'école</p>
              <ul className="space-y-3 text-white/60">{PAGES_INTERNES.slice(0, 4).map(p => <li key={p.lien}><a href={p.lien} className="hover:text-[var(--c2)] transition-colors">{p.nom}</a></li>)}</ul>
            </div>
            <div>
              <p className="font-bold mb-5">Pratique</p>
              <ul className="space-y-3 text-white/60">{PAGES_INTERNES.slice(4).map(p => <li key={p.lien}><a href={p.lien} className="hover:text-[var(--c2)] transition-colors">{p.nom}</a></li>)}</ul>
            </div>
            <div className="space-y-4 text-white/70 text-[15px]">
              <p className="font-bold text-white mb-5">Nous trouver</p>
              <p className="flex gap-3"><MapPin className="h-5 w-5 text-[var(--c2)] flex-shrink-0" />{id.adresse}</p>
              <p className="flex gap-3"><Phone className="h-5 w-5 text-[var(--c2)] flex-shrink-0" />{id.telephone}</p>
              <p className="flex gap-3"><Mail className="h-5 w-5 text-[var(--c2)] flex-shrink-0" />{id.email}</p>
            </div>
          </div>
          <div className="mt-14 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between gap-3 text-sm text-white/45">
            <span>© {new Date().getFullYear()} {id.nom}. Tous droits réservés.</span>
            <span>Site propulsé par SenClass</span>
          </div>
        </Boite>
      </div>
    </footer>
  );
}

function WhatsAppFlottant() {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  const [ouvert, setOuvert] = useState(false);
  if (!id.whatsapp) return null;
  return (
    <div className={`fixed right-5 ${edition ? 'bottom-24' : 'bottom-5'} z-40 flex flex-col items-end gap-3`}>
      {ouvert && (
        <div className="w-72 rounded-3xl bg-white shadow-2xl border border-black/5 overflow-hidden apparition">
          <div className="bg-[#075E54] text-white p-4 flex items-center gap-3">
            <LogoInitiales />
            <div className="leading-tight"><p className="font-bold text-sm">{id.nom}</p><p className="text-xs text-white/70">Répond en général dans la journée</p></div>
          </div>
          <div className="p-4 bg-[#ECE5DD]">
            <p className="bg-white rounded-2xl rounded-tl-sm p-3 text-sm shadow-sm">Bonjour 👋 Comment pouvons-nous vous aider ?</p>
          </div>
          <a href={lienWhatsApp(id.whatsapp, id.messageWhatsApp)} target="_blank" rel="noreferrer" className="m-3 flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#25D366] text-white font-bold">
            <IconeWhatsApp className="h-5 w-5" />Démarrer la discussion
          </a>
        </div>
      )}
      <button type="button" onClick={() => setOuvert(o => !o)} aria-label="Discuter sur WhatsApp"
        className="h-16 w-16 rounded-2xl bg-[#25D366] text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform">
        {ouvert ? <X className="h-7 w-7" /> : <IconeWhatsApp className="h-8 w-8" />}
      </button>
    </div>
  );
}

function LogoInitiales() {
  const { contenu } = useEdition();
  const initiales = contenu.identite.nom.split(/\s+/).filter(m => m.length > 2).slice(0, 2).map(m => m[0]).join('').toUpperCase();
  return <span className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold">{initiales}</span>;
}

/** En-tête des pages intérieures : bloc doux arrondi, titre souligné, deux photos superposées. */
export function EnteteB({ c }: { c: string }) {
  const { edition } = useEdition();
  const titre = useValeur<string>(`${c}.titre`) ?? '';
  return (
    <section className="px-3 md:px-5 pt-3">
      <div className="relative rounded-[32px] bg-[var(--doux)] overflow-hidden">
        <div className="absolute -right-24 -bottom-24 h-80 w-80 rounded-full border-[48px] border-[var(--c1-10)]" />
        <Boite className="relative grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center py-14 lg:py-20">
          <Revele>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#6b7a73]"><a href="#/" className="hover:text-[var(--c1)]">Accueil</a><ChevronRight className="h-4 w-4" /><span className="text-[var(--c1)]">{titre}</span></p>
            <h1 className="titre mt-5 text-5xl md:text-7xl font-extrabold leading-[1.02]">
              {edition ? <T c={`${c}.titre`} /> : <span className="relative inline-block">{titre}<Trait /></span>}
            </h1>
            <T c={`${c}.texte`} as="p" className="block mt-7 text-lg text-[#55635d] max-w-md" />
          </Revele>
          <Revele delai={150} className="relative h-72 md:h-[340px]">
            <div className="absolute right-0 top-0 w-[82%] h-[88%] rounded-[28px] overflow-hidden shadow-xl"><Img c={`${c}.image`} className="absolute inset-0 w-full h-full object-cover" /></div>
            <div className="absolute left-0 bottom-0 h-28 w-28 rounded-3xl bg-[var(--c2)] flottement flex items-center justify-center shadow-xl">
              <svg viewBox="0 0 40 40" className="h-14 w-14 text-white" aria-hidden="true"><path d="M20 4 L36 12 L20 20 L4 12 Z" fill="currentColor" /><path d="M10 16 V24 C10 27 15 30 20 30 C25 30 30 27 30 24 V16 L20 21 Z" fill="currentColor" opacity=".8" /></svg>
            </div>
          </Revele>
        </Boite>
      </div>
    </section>
  );
}
