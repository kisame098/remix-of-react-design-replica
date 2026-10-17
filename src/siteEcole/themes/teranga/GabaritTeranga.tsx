import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUpRight, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import { Bouton, Img, PAGES_INTERNES, T, useEdition } from '../../edition';
import { Reseaux } from '../../Gabarit';
import { IconeWhatsApp } from '../../reseaux';
import { lienWhatsApp } from '../../utilitaires';
import { Motif } from './Motif';

/** Polices du modèle Teranga (mêmes trois choix que l'autre modèle, autres familles). */
export const POLICES_TERANGA = {
  classique: { nom: 'Douce', titres: "'Fraunces', Georgia, serif", texte: "'DM Sans', system-ui, sans-serif" },
  moderne: { nom: 'Affirmée', titres: "'Bricolage Grotesque', system-ui, sans-serif", texte: "'DM Sans', system-ui, sans-serif" },
  elegante: { nom: 'Graphique', titres: "'Syne', system-ui, sans-serif", texte: "'DM Sans', system-ui, sans-serif" },
} as const;

export function GabaritTeranga({ page, children }: { page: string; children: ReactNode }) {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  const police = POLICES_TERANGA[id.police] ?? POLICES_TERANGA.moderne;
  const style = {
    '--c1': id.couleur1, '--c2': id.couleur2, '--f-titre': police.titres, '--f-texte': police.texte,
    '--fond': '#FAF6EF', '--encre': '#1C1917',
  } as CSSProperties;

  return (
    <div className={`site teranga min-h-screen flex flex-col bg-[var(--fond)] text-[var(--encre)] ${edition ? 'pb-24 pt-9' : ''}`} style={style}>
      <Defilant />
      <EnTete page={page} />
      <main className="flex-1">{children}</main>
      <Pied />
      <BulleWhatsApp />
    </div>
  );
}

/** Bandeau d'annonce qui défile (fixe en mode modification, pour pouvoir l'écrire). */
function Defilant() {
  const { contenu, edition } = useEdition();
  if (!edition && !contenu.annonce.texte) return null;
  if (edition) {
    return (
      <div className="bg-[var(--encre)] text-white text-sm py-2.5 px-4 flex flex-wrap justify-center gap-3">
        <T c="annonce.texte" className="font-medium" /><Bouton c="annonce.bouton" className="font-bold text-[var(--c2)] bg-white rounded-full px-3" />
      </div>
    );
  }
  const morceau = (
    <span className="flex items-center gap-10 pr-10 whitespace-nowrap">
      {[0, 1, 2].map(k => (
        <span key={k} className="flex items-center gap-10">
          <span>{contenu.annonce.texte}</span>
          <a href={contenu.annonce.bouton.lien} className="font-bold underline underline-offset-4">{contenu.annonce.bouton.texte}</a>
          <span className="text-[var(--c2)]">✦</span>
        </span>
      ))}
    </span>
  );
  return (
    <div className="bg-[var(--encre)] text-white text-sm py-2.5 overflow-hidden">
      <div className="flex w-max animate-[defilement_40s_linear_infinite] hover:[animation-play-state:paused]">{morceau}{morceau}</div>
    </div>
  );
}

export function LogoTeranga({ clair = false }: { clair?: boolean }) {
  const { contenu } = useEdition();
  const id = contenu.identite;
  const initiales = id.nom.split(/\s+/).filter(m => m.length > 2).slice(0, 2).map(m => m[0]).join('').toUpperCase();
  return (
    <a href="#/" className="flex items-center gap-2.5 min-w-0">
      {id.logo
        ? <img src={id.logo} alt={id.nom} className="h-10 w-10 object-contain flex-shrink-0" />
        : <span className="h-10 w-10 rounded-2xl rotate-6 flex-shrink-0 flex items-center justify-center font-extrabold titre text-white bg-[var(--c1)]"><span className="-rotate-6">{initiales}</span></span>}
      <span title={id.nom} className={`titre font-extrabold text-[17px] leading-tight line-clamp-2 break-words max-w-[220px] xl:max-w-[200px] 2xl:max-w-[260px] ${clair ? 'text-white' : ''}`}>{id.nom}</span>
    </a>
  );
}

function EnTete({ page }: { page: string }) {
  const { edition } = useEdition();
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => setOuvert(false), [page]);

  return (
    <>
      <header className={`sticky ${edition ? 'top-12' : 'top-3'} z-40 px-3 mt-3`}>
        <div className="max-w-6xl mx-auto h-16 rounded-full bg-white/85 backdrop-blur-md border border-black/5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex items-center gap-2 pl-4 pr-2">
          <LogoTeranga />
          <nav className="hidden xl:flex items-center gap-0.5 mx-auto whitespace-nowrap">
            {PAGES_INTERNES.map(p => {
              const actif = p.lien === `#/${page}` || (p.lien === '#/' && page === '');
              return (
                <a key={p.lien} href={p.lien} className={`px-3 py-2 rounded-full text-[13.5px] font-semibold transition-colors ${actif ? 'bg-[var(--encre)] text-white' : 'text-black/70 hover:bg-black/5 hover:text-black'}`}>{p.nom}</a>
              );
            })}
          </nav>
          <Bouton c="identite.espaceParents" className="hidden md:inline-flex ml-auto xl:ml-0 items-center px-5 h-12 rounded-full bg-[var(--c1)] text-white text-sm font-bold whitespace-nowrap hover:brightness-110" />
          <button type="button" onClick={() => setOuvert(true)} aria-label="Menu" className="xl:hidden ml-auto md:ml-0 h-12 w-12 rounded-full bg-[var(--encre)] text-white flex items-center justify-center"><Menu className="h-5 w-5" /></button>
        </div>
      </header>

      {ouvert && (
        <div className="fixed inset-0 z-[60] bg-[var(--c1)] text-white flex flex-col overflow-y-auto">
          <Motif type="cercles" className="absolute inset-0 text-white/[0.07]" />
          <div className="relative flex items-center justify-between p-6">
            <LogoTeranga clair />
            <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer" className="h-12 w-12 rounded-full bg-white text-[var(--encre)] flex items-center justify-center"><X /></button>
          </div>
          <nav className="relative flex-1 flex flex-col justify-center px-8 gap-2">
            {PAGES_INTERNES.map((p, i) => (
              <a key={p.lien} href={p.lien} className="titre text-4xl sm:text-5xl font-extrabold flex items-baseline gap-4 hover:translate-x-2 transition-transform">
                <span className="text-base font-bold text-white/50">0{i + 1}</span>{p.nom}
              </a>
            ))}
          </nav>
          <div className="relative p-8"><Bouton c="identite.espaceParents" className="inline-flex px-6 py-3 rounded-full bg-white text-[var(--encre)] font-bold" /></div>
        </div>
      )}
    </>
  );
}

function Pied() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  return (
    <footer className="mt-10 bg-[var(--encre)] text-white rounded-t-[2.5rem] md:rounded-t-[4rem] overflow-hidden relative">
      <Motif type="losanges" className="absolute top-0 inset-x-0 h-10 text-[var(--c2-clair)] opacity-60" />
      <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-14 border-b border-white/10">
          <p className="titre text-4xl md:text-6xl font-extrabold leading-[1.05] max-w-2xl">Une question&nbsp;? <span className="text-[var(--c2-clair)]">Parlons-en.</span></p>
          <div className="flex flex-wrap gap-3">
            {id.whatsapp && (
              <a href={lienWhatsApp(id.whatsapp, id.messageWhatsApp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-14 px-7 rounded-full bg-[#25D366] text-white font-bold"><IconeWhatsApp className="h-5 w-5" />WhatsApp</a>
            )}
            <a href="#/contact" className="inline-flex items-center gap-2 h-14 px-7 rounded-full bg-white text-[var(--encre)] font-bold">Nous écrire <ArrowUpRight className="h-5 w-5" /></a>
          </div>
        </div>
        <div className="grid gap-10 md:grid-cols-3 py-14">
          <div className="space-y-4">
            <LogoTeranga clair />
            <T c="pied.texte" as="p" className="text-white/60 text-sm leading-relaxed max-w-xs" />
            <div className="flex gap-4 text-white"><Reseaux className="h-5 w-5" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-white/70">
            {PAGES_INTERNES.map(p => <a key={p.lien} href={p.lien} className="hover:text-white py-1">{p.nom}</a>)}
          </div>
          <ul className="space-y-3 text-white/70 text-sm">
            <li className="flex gap-3"><MapPin className="h-4 w-4 mt-0.5 text-[var(--c2-clair)] flex-shrink-0" />{id.adresse}</li>
            <li className="flex gap-3"><Phone className="h-4 w-4 mt-0.5 text-[var(--c2-clair)] flex-shrink-0" />{id.telephone}</li>
            <li className="flex gap-3"><Mail className="h-4 w-4 mt-0.5 text-[var(--c2-clair)] flex-shrink-0" />{id.email}</li>
          </ul>
        </div>
        <p className="titre font-extrabold leading-[0.85] text-[13vw] lg:text-[9.5rem] text-white/[0.06] select-none whitespace-nowrap overflow-hidden">{id.nom.split(' ').slice(-1)[0]}</p>
        <div className="flex flex-col md:flex-row justify-between gap-2 text-xs text-white/40 pt-6">
          <span>© {new Date().getFullYear()} {id.nom}</span><span>Site propulsé par SenClass</span>
        </div>
      </div>
    </footer>
  );
}

function BulleWhatsApp() {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  if (!id.whatsapp) return null;
  return (
    <a href={lienWhatsApp(id.whatsapp, id.messageWhatsApp)} target="_blank" rel="noreferrer"
      className={`fixed right-5 ${edition ? 'bottom-24' : 'bottom-5'} z-40 h-14 pl-4 pr-5 rounded-full bg-[#25D366] text-white shadow-xl flex items-center gap-2 font-bold hover:scale-105 transition`}>
      <IconeWhatsApp className="h-6 w-6" /><span className="hidden sm:inline">Écrivez-nous</span>
    </a>
  );
}

/** En-tête des pages intérieures : titre géant sur fond crème, photo arrondie à côté. */
export function EntetePageTeranga({ c, motif = 'cercles' }: { c: string; motif?: 'cercles' | 'losanges' | 'eventails' }) {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-16 pb-10 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
      <div className="apparition">
        <p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm font-semibold mb-6">
          <span className="h-2 w-2 rounded-full bg-[var(--c1)]" /><a href="#/" className="opacity-60 hover:opacity-100">Accueil</a><span className="opacity-30">/</span><T c={`${c}.titre`} />
        </p>
        <T c={`${c}.titre`} as="h1" className="titre block text-5xl md:text-7xl font-extrabold tracking-tight leading-[0.95]" />
        <T c={`${c}.texte`} as="p" className="block mt-6 text-xl text-black/60 max-w-lg" />
      </div>
      <div className="relative h-72 md:h-96">
        <div className="absolute -top-4 -right-4 w-2/3 h-2/3 rounded-[2.5rem] text-[var(--c2)] overflow-hidden"><Motif type={motif} className="w-full h-full" /></div>
        <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden shadow-xl">
          <Img c={`${c}.image`} className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}
