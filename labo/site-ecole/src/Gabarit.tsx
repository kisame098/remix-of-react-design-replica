import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Clock, Facebook, Instagram, Mail, MapPin, Menu, Phone, X, Youtube, Music2 } from 'lucide-react';
import { POLICES } from './contenu';
import { Bouton, Img, PAGES_INTERNES, Section, T, useEdition } from './edition';
import { lienWhatsApp } from './utilitaires';

export function Gabarit({ page, children }: { page: string; children: ReactNode }) {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  const police = POLICES[id.police] ?? POLICES.classique;
  const style = {
    '--c1': id.couleur1, '--c2': id.couleur2, '--f-titre': police.titres, '--f-texte': police.texte,
  } as CSSProperties;

  return (
    <div className={`site min-h-screen flex flex-col ${edition ? 'pb-24 pt-9' : ''}`} style={style}>
      <Section id="annonce" nom="Bandeau d'annonce">
        <div className="bg-[var(--c2)] text-gray-900 text-sm">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
            <T c="annonce.texte" className="font-medium" />
            <Bouton c="annonce.bouton" className="underline font-bold underline-offset-2" />
          </div>
        </div>
      </Section>

      <BarreHaute />
      <EnTete page={page} edition={edition} />

      <main className="flex-1">{children}</main>

      <PiedDePage />
      <BoutonWhatsApp />
    </div>
  );
}

function BarreHaute() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  return (
    <div className="hidden md:block bg-[var(--c1)] text-white/90 text-[13px]">
      <div className="max-w-7xl mx-auto px-6 h-10 flex items-center gap-6">
        <a href={`tel:${id.telephone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 hover:text-white"><Phone className="h-3.5 w-3.5" />{id.telephone}</a>
        <a href={`mailto:${id.email}`} className="flex items-center gap-1.5 hover:text-white"><Mail className="h-3.5 w-3.5" />{id.email}</a>
        <span className="hidden lg:flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{id.horaires}</span>
        <div className="ml-auto flex items-center gap-3"><Reseaux /></div>
      </div>
    </div>
  );
}

export function Reseaux({ className = 'h-4 w-4' }: { className?: string }) {
  const { contenu } = useEdition();
  const id = contenu.identite;
  const liens = [
    { url: id.facebook, Icone: Facebook, nom: 'Facebook' },
    { url: id.instagram, Icone: Instagram, nom: 'Instagram' },
    { url: id.youtube, Icone: Youtube, nom: 'YouTube' },
    { url: id.tiktok, Icone: Music2, nom: 'TikTok' },
  ].filter(l => l.url);
  return <>{liens.map(({ url, Icone, nom }) => (
    <a key={nom} href={url} target="_blank" rel="noreferrer" aria-label={nom} className="opacity-80 hover:opacity-100"><Icone className={className} /></a>
  ))}</>;
}

export function Logo({ clair = false }: { clair?: boolean }) {
  const { contenu } = useEdition();
  const id = contenu.identite;
  const initiales = id.nom.split(/\s+/).filter(m => m.length > 2).slice(0, 2).map(m => m[0]).join('').toUpperCase();
  return (
    <a href="#/" className="flex items-center gap-3 min-w-0">
      {id.logo
        ? <img src={id.logo} alt={id.nom} className="h-12 w-12 object-contain flex-shrink-0" />
        : <span className={`h-12 w-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg titre ${clair ? 'bg-white text-[var(--c1)]' : 'bg-[var(--c1)] text-white'} ring-2 ring-[var(--c2)] ring-offset-2 ${clair ? 'ring-offset-[var(--c1)]' : ''}`}>{initiales}</span>}
      <span className="min-w-0">
        <span className={`block titre font-bold text-lg leading-tight truncate ${clair ? 'text-white' : 'text-[var(--c1)]'}`}>{id.nom}</span>
        <span className={`block text-xs truncate ${clair ? 'text-white/70' : 'text-gray-500'}`}>{id.slogan}</span>
      </span>
    </a>
  );
}

function EnTete({ page, edition }: { page: string; edition: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [defile, setDefile] = useState(false);
  useEffect(() => setOuvert(false), [page]);
  useEffect(() => {
    const f = () => setDefile(window.scrollY > 40);
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  return (
    <header className={`sticky ${edition ? 'top-9' : 'top-0'} z-50 bg-white transition-shadow ${defile ? 'shadow-md' : 'border-b border-gray-100'}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center gap-6">
        <Logo />
        <nav className="hidden xl:flex items-center gap-1 ml-auto">
          {PAGES_INTERNES.map(p => {
            const actif = p.lien === `#/${page}`;
            return (
              <a key={p.lien} href={p.lien}
                className={`px-3 py-2 text-[15px] font-medium rounded-md transition-colors relative ${actif ? 'text-[var(--c1)]' : 'text-gray-700 hover:text-[var(--c1)]'}`}>
                {p.nom}
                {actif && <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 bg-[var(--c2)] rounded" />}
              </a>
            );
          })}
        </nav>
        <Bouton c="identite.espaceParents"
          className="hidden md:inline-flex ml-auto xl:ml-2 px-5 py-2.5 rounded-full bg-[var(--c1)] text-white text-sm font-semibold hover:brightness-110 transition" />
        <button type="button" className="xl:hidden ml-auto md:ml-0 p-2 rounded-lg hover:bg-gray-100" onClick={() => setOuvert(o => !o)} aria-label="Menu">
          {ouvert ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {ouvert && (
        <nav className="xl:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col">
          {PAGES_INTERNES.map(p => (
            <a key={p.lien} href={p.lien} className={`px-3 py-3 rounded-lg font-medium ${p.lien === `#/${page}` ? 'bg-gray-50 text-[var(--c1)]' : 'text-gray-700'}`}>{p.nom}</a>
          ))}
          <Bouton c="identite.espaceParents" className="md:hidden mt-2 text-center px-5 py-3 rounded-full bg-[var(--c1)] text-white font-semibold" />
        </nav>
      )}
    </header>
  );
}

function PiedDePage() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  return (
    <footer className="bg-[var(--c1)] text-white">
      <div className="h-1.5 bg-[var(--c2)]" />
      <div className="max-w-7xl mx-auto px-6 py-14 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-1">
          <Logo clair />
          <T c="pied.texte" as="p" className="text-sm text-white/75 leading-relaxed" />
          <div className="flex gap-4"><Reseaux className="h-5 w-5" /></div>
        </div>
        <div>
          <p className="titre font-bold text-lg mb-4">Liens rapides</p>
          <ul className="space-y-2 text-sm text-white/80">
            {PAGES_INTERNES.map(p => <li key={p.lien}><a href={p.lien} className="hover:text-[var(--c2)]">{p.nom}</a></li>)}
          </ul>
        </div>
        <div>
          <p className="titre font-bold text-lg mb-4">Nous trouver</p>
          <ul className="space-y-3 text-sm text-white/80">
            <li className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-[var(--c2)]" />{id.adresse}</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 mt-0.5 flex-shrink-0 text-[var(--c2)]" />{id.telephone}<br />{id.whatsapp}</li>
            <li className="flex gap-2"><Mail className="h-4 w-4 mt-0.5 flex-shrink-0 text-[var(--c2)]" />{id.email}</li>
            <li className="flex gap-2"><Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-[var(--c2)]" />{id.horaires}</li>
          </ul>
        </div>
        <div>
          <p className="titre font-bold text-lg mb-4">Inscriptions</p>
          <p className="text-sm text-white/80 mb-4">Préinscrivez votre enfant en quelques minutes.</p>
          <a href="#/admissions" className="inline-block px-5 py-2.5 rounded-full bg-[var(--c2)] text-gray-900 text-sm font-bold hover:brightness-105">Préinscription</a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 text-xs text-white/60 flex flex-col md:flex-row gap-2 justify-between">
          <span>© {new Date().getFullYear()} {id.nom}. Tous droits réservés.</span>
          <span>Site propulsé par SenClass</span>
        </div>
      </div>
    </footer>
  );
}

function BoutonWhatsApp() {
  const { contenu, edition } = useEdition();
  const id = contenu.identite;
  if (!id.whatsapp) return null;
  return (
    <a href={lienWhatsApp(id.whatsapp, `Bonjour ${id.nom}, je souhaite avoir des informations.`)} target="_blank" rel="noreferrer"
      aria-label="Écrire sur WhatsApp"
      className={`fixed right-5 ${edition ? 'bottom-24' : 'bottom-5'} z-40 h-14 w-14 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center hover:scale-105 transition`}>
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.56.94.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.01c0-5.2 4.23-9.43 9.43-9.43a9.38 9.38 0 0 1 9.43 9.44c0 5.2-4.23 9.42-9.44 9.42zm8.02-17.44A11.27 11.27 0 0 0 12.04.75C5.8.75.72 5.83.72 12.07c0 2 .52 3.94 1.51 5.65L.62 23.25l5.66-1.48a11.3 11.3 0 0 0 5.41 1.38h.01c6.24 0 11.32-5.08 11.32-11.32 0-3.02-1.18-5.87-3.32-8z" /></svg>
    </a>
  );
}

/** Bandeau-titre des pages intérieures. */
export function EntetePage({ c }: { c: string }) {
  return (
    <div className="relative h-[280px] md:h-[340px] flex items-end overflow-hidden">
      <Img c={`${c}.image`} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
      <div className="absolute inset-y-0 left-0 w-2 bg-[var(--c2)]" />
      <div className="relative max-w-7xl mx-auto w-full px-6 pb-10 text-white apparition">
        <T c={`${c}.titre`} as="h1" className="titre text-4xl md:text-5xl font-bold" />
        <T c={`${c}.texte`} as="p" className="mt-3 text-lg text-white/85 max-w-2xl" />
      </div>
    </div>
  );
}
