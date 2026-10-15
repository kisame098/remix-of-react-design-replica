import type { CSSProperties, ReactNode } from 'react';
import { ImageIcon, Mail, MapPin, Phone, GraduationCap } from 'lucide-react';
import { ancreBloc, sousAdresse, type Bloc, type InfosEcole, type Site } from './modele';

/**
 * Le site tel que le visiteur le voit. Sert à l'aperçu de l'éditeur et servira
 * tel quel au site public (étape 4).
 *
 * `format` force la mise en page : l'aperçu « téléphone » de l'éditeur est une
 * boîte étroite dans un grand écran, où les points de rupture Tailwind (md:)
 * — calculés sur la fenêtre — ne se déclencheraient pas. Sans `format` (site
 * public), la mise en page suit l'écran du visiteur.
 */
export type Format = 'ordinateur' | 'telephone';

interface Props {
  site: Site;
  ecole: InfosEcole;
  format?: Format;
  /** Mode éditeur : blocs cliquables et encadré sur le bloc choisi. */
  selection?: string | null;
  onSelectionner?: (id: string) => void;
  onOuvrir?: (id: string) => void;
}

const POLICES = { moderne: "'Inter', system-ui, sans-serif", classique: "Georgia, 'Times New Roman', serif" };

export default function RenduSite({ site, ecole, format, selection, onSelectionner, onOuvrir }: Props) {
  const editeur = !!onSelectionner;
  const tel = format === 'telephone';
  /** Classes de deux colonnes : jamais sur téléphone, dès « md » sinon. */
  const deuxCol = tel ? 'grid-cols-1' : format === 'ordinateur' ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2';
  const troisCol = tel ? 'grid-cols-1' : format === 'ordinateur' ? 'grid-cols-3' : 'grid-cols-1 md:grid-cols-3';
  const style = { '--site': site.apparence.couleur, fontFamily: POLICES[site.apparence.police] } as CSSProperties;

  const menu = site.blocs.filter(b => b.type !== 'banniere');

  const rendre = (bloc: Bloc): ReactNode => {
    switch (bloc.type) {
      case 'banniere':
        return (
          <div className="relative min-h-[320px] flex items-center justify-center text-center px-6 py-16 text-white"
            style={{ background: bloc.image ? undefined : 'var(--site)' }}>
            {bloc.image && (
              <>
                <img src={bloc.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/45" />
              </>
            )}
            <div className="relative max-w-2xl space-y-4">
              <h1 className={`${tel ? 'text-3xl' : 'text-4xl md:text-5xl'} font-bold leading-tight`}>{bloc.titre}</h1>
              {bloc.sousTitre && <p className="text-lg opacity-90">{bloc.sousTitre}</p>}
              {bloc.boutonTexte && bloc.boutonLien && (
                <a href={bloc.boutonLien} onClick={e => editeur && e.preventDefault()}
                  className="inline-block mt-2 px-6 py-3 rounded-full bg-white font-semibold shadow"
                  style={{ color: 'var(--site)' }}>
                  {bloc.boutonTexte}
                </a>
              )}
            </div>
          </div>
        );

      case 'presentation':
        return (
          <Section titre={bloc.titre}>
            <div className={`grid ${deuxCol} gap-8 items-center`}>
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {bloc.texte || (editeur && <Vide>Écrivez la présentation de votre école.</Vide>)}
              </div>
              {bloc.image ? <img src={bloc.image} alt="" className="rounded-2xl w-full aspect-[4/3] object-cover" />
                : editeur && <ImageVide />}
            </div>
          </Section>
        );

      case 'chiffres':
        return (
          <Section titre={bloc.titre} fond>
            {bloc.elements.length === 0 ? editeur && <Vide>Ajoutez vos chiffres clés (élèves, années d'existence…).</Vide> : (
              <div className={`grid ${tel ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'} gap-6 text-center`}>
                {bloc.elements.map((el, i) => (
                  <div key={i}>
                    <p className="text-4xl font-bold" style={{ color: 'var(--site)' }}>{el.valeur}</p>
                    <p className="text-sm text-gray-600 mt-1">{el.libelle}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        );

      case 'formations':
        return (
          <Section titre={bloc.titre} intro={bloc.intro}>
            <div className={`grid ${troisCol} gap-4`}>
              {ecole.formations.map(f => (
                <div key={f.nom} className="rounded-2xl border border-gray-200 p-5 bg-white">
                  <GraduationCap className="h-6 w-6 mb-3" style={{ color: 'var(--site)' }} />
                  <p className="font-semibold text-gray-900">{f.nom}</p>
                  {f.description && <p className="text-sm text-gray-600 mt-1">{f.description}</p>}
                </div>
              ))}
            </div>
          </Section>
        );

      case 'galerie':
        return (
          <Section titre={bloc.titre} fond>
            {bloc.images.length === 0 ? editeur && <Vide>Ajoutez des photos de l'école.</Vide> : (
              <div className={`grid ${tel ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'} gap-3`}>
                {bloc.images.map((src, i) => <img key={i} src={src} alt="" className="rounded-xl w-full aspect-square object-cover" />)}
              </div>
            )}
          </Section>
        );

      case 'contact': {
        const lignes = [
          { icone: MapPin, texte: [ecole.ville, ecole.pays].filter(Boolean).join(', ') },
          { icone: Phone, texte: ecole.telephone, lien: ecole.telephone && `tel:${ecole.telephone.replace(/\s/g, '')}` },
          { icone: Mail, texte: ecole.email, lien: ecole.email && `mailto:${ecole.email}` },
        ].filter(l => l.texte);
        return (
          <Section titre={bloc.titre} intro={bloc.intro}>
            <div className={`grid ${troisCol} gap-4`}>
              {lignes.map(l => (
                <a key={l.texte} href={l.lien || undefined} onClick={e => editeur && e.preventDefault()}
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 p-5 bg-white">
                  <span className="p-2.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--site) 12%, white)' }}>
                    <l.icone className="h-5 w-5" style={{ color: 'var(--site)' }} />
                  </span>
                  <span className="text-gray-800 text-sm break-all">{l.texte}</span>
                </a>
              ))}
            </div>
          </Section>
        );
      }
    }
  };

  return (
    <div style={style} className="bg-white text-gray-900">
      {/* En-tête : logo et nom repris du SaaS, menu bâti sur les blocs. */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          {ecole.logoUrl
            ? <img src={ecole.logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" />
            : <span className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: 'var(--site)' }}>{ecole.nom.charAt(0)}</span>}
          <span className="font-bold truncate flex-1">{ecole.nom}</span>
          {!tel && (
            <nav className={`${format ? 'flex' : 'hidden md:flex'} gap-5 text-sm text-gray-600`}>
              {menu.map(b => (
                <a key={b.id} href={`#${ancreBloc(site, b)}`} onClick={e => editeur && e.preventDefault()} className="hover:text-gray-900">
                  {b.titre}
                </a>
              ))}
            </nav>
          )}
        </div>
      </header>

      {site.blocs.map(bloc => (
        <div
          key={bloc.id}
          id={ancreBloc(site, bloc)}
          data-bloc={bloc.id}
          onClick={editeur ? () => onSelectionner!(bloc.id) : undefined}
          onDoubleClick={onOuvrir ? () => onOuvrir(bloc.id) : undefined}
          className={editeur
            ? `relative cursor-pointer outline-offset-[-3px] ${selection === bloc.id ? 'outline outline-[3px] outline-primary' : 'hover:outline hover:outline-2 hover:outline-primary/40'}`
            : undefined}
        >
          {rendre(bloc)}
        </div>
      ))}

      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} {ecole.nom} · {sousAdresse(ecole)}
      </footer>
    </div>
  );
}

function Section({ titre, intro, fond, children }: { titre: string; intro?: string; fond?: boolean; children: ReactNode }) {
  return (
    <section className={`px-6 py-14 ${fond ? 'bg-gray-50' : ''}`}>
      <div className="max-w-5xl mx-auto">
        {titre && <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--site)' }}>{titre}</h2>}
        {intro && <p className="text-gray-600 mb-6 whitespace-pre-line">{intro}</p>}
        <div className={intro ? '' : 'mt-6'}>{children}</div>
      </div>
    </section>
  );
}

/** Indications visibles dans l'éditeur seulement, jamais sur le site public. */
function Vide({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-400 italic border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">{children}</p>;
}

function ImageVide() {
  return (
    <div className="rounded-2xl aspect-[4/3] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
      <ImageIcon className="h-8 w-8" />Ajoutez une photo
    </div>
  );
}
