import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Calendar, Check, Copy, Facebook, Loader2, Plus } from 'lucide-react';
import { Img, Section, T, useEdition } from '../edition';
import { CartesActualites, Conteneur, nouvelleActualite } from '../composants';
import { IconeWhatsApp } from '../reseaux';
import { identifiant, lienWhatsApp } from '../utilitaires';

// L'éditeur d'article n'est chargé qu'en mode modification : le visiteur ne le télécharge jamais.
const EditeurArticle = lazy(() => import('../EditeurArticle'));

export function ListeActualites() {
  const { contenu, edition, majListe } = useEdition();
  const creer = () => {
    const a = nouvelleActualite(identifiant('nouvelle actualite', contenu.actualites.elements.map(x => x.id)));
    majListe('actualites.elements', l => [a, ...l]);
    location.hash = `#/actualites/${a.id}`;
  };
  return (
    <Section className="py-24 bg-gray-50">
      <Conteneur>
        {edition && (
          <div className="flex justify-center mb-10">
            <button type="button" className="outil !text-sm !px-5 !py-3" onClick={creer}><Plus className="h-4 w-4" />Écrire une nouvelle actualité</button>
          </div>
        )}
        <CartesActualites />
      </Conteneur>
    </Section>
  );
}

/** Page d'une actualité : l'article complet, à lire ou à écrire. */
export function PageArticle({ id }: { id: string }) {
  const { contenu, edition, maj } = useEdition();
  const index = contenu.actualites.elements.findIndex(a => a.id === id);
  const a = contenu.actualites.elements[index];
  const ce = `actualites.elements.${index}`;
  const [copie, setCopie] = useState(false);

  // Enregistrement de l'article un instant après la dernière frappe (pas à chaque lettre).
  const minuteur = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(minuteur.current), []);
  const ecrireContenu = (html: string) => {
    clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => maj(`${ce}.contenu`, html), 400);
  };

  if (!a) {
    return (
      <Conteneur className="py-32 text-center">
        <p className="titre text-3xl font-bold text-[var(--c1)]">Actualité introuvable</p>
        <a href="#/actualites" className="inline-block mt-6 font-semibold text-[var(--c1)] underline">Voir toutes les actualités</a>
      </Conteneur>
    );
  }

  const adresse = location.href;
  const autres = contenu.actualites.elements.filter(x => x.id !== id).slice(0, 3);

  const teranga = contenu.identite.modele === 'teranga';
  const prestige = contenu.identite.modele === 'prestige';
  return (
    <article>
      {prestige ? (
        <div className="pt-16">
          <div className="max-w-4xl mx-auto px-6 text-center apparition">
            <a href="#/actualites" className="capitales text-black/45 hover:text-[var(--c1)] inline-flex items-center gap-2"><ArrowLeft className="h-3.5 w-3.5" />Le journal</a>
            <p className="mt-10 flex items-center justify-center gap-4 capitales">
              <T c={`${ce}.categorie`} className="text-[var(--c2)]" /><span className="h-px w-8 bg-black/20" /><T c={`${ce}.date`} className="text-black/50" />
            </p>
            <T c={`${ce}.titre`} as="h1" className="titre block text-5xl md:text-7xl leading-[1.02] mt-8" />
            <T c={`${ce}.texte`} as="p" className="block mt-8 text-xl font-light text-black/60 max-w-2xl mx-auto" />
          </div>
          <div className="relative mt-16 h-[55vh] min-h-[360px] max-w-[1400px] mx-auto overflow-hidden grain">
            <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </div>
      ) : teranga ? (
        <div className="max-w-5xl mx-auto px-6 pt-16 apparition">
          <a href="#/actualites" className="inline-flex items-center gap-1.5 rounded-full bg-white border border-black/10 px-4 py-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Toutes les actualités</a>
          <div className="flex flex-wrap items-center gap-3 mt-8 text-sm font-semibold">
            <T c={`${ce}.categorie`} className="rounded-full bg-[var(--c1)] text-white px-4 py-1.5" />
            <span className="flex items-center gap-1.5 text-black/50"><Calendar className="h-4 w-4" /><T c={`${ce}.date`} /></span>
          </div>
          <T c={`${ce}.titre`} as="h1" className="titre block text-4xl md:text-7xl font-extrabold leading-[0.98] mt-5" />
          <div className="relative mt-12 h-[300px] md:h-[520px] rounded-[2.5rem] overflow-hidden">
            <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </div>
      ) : (
      <div className="relative h-[380px] md:h-[480px] overflow-hidden">
        <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="max-w-4xl mx-auto px-6 pb-10 text-white apparition">
            <a href="#/actualites" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white mb-5"><ArrowLeft className="h-4 w-4" />Toutes les actualités</a>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <T c={`${ce}.categorie`} className="bg-[var(--c2)] text-gray-900 font-semibold px-3 py-1 rounded-full" />
              <span className="flex items-center gap-1.5 text-white/85"><Calendar className="h-4 w-4" /><T c={`${ce}.date`} /></span>
            </div>
            <T c={`${ce}.titre`} as="h1" className="titre block text-3xl md:text-5xl font-bold leading-tight mt-4" />
          </div>
        </div>
      </div>
      )}

      <div className={`${prestige ? 'max-w-3xl py-20 [&_.article]:text-[1.2rem] [&_.article]:font-light' : 'max-w-4xl py-14'} mx-auto px-6`}>
        {edition && !prestige && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm font-sans">
            <p className="font-semibold text-amber-900 mb-1">Résumé affiché sur la carte de l'actualité :</p>
            <T c={`${ce}.texte`} as="p" className="block text-gray-700" />
          </div>
        )}
        {edition ? (
          <Suspense fallback={<p className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Chargement de l'éditeur…</p>}>
            <EditeurArticle key={id} valeur={a.contenu} onChange={ecrireContenu} />
          </Suspense>
        ) : (
          <div className="article" dangerouslySetInnerHTML={{ __html: a.contenu || `<p>${a.texte}</p>` }} />
        )}

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap items-center gap-3">
          <span className="font-semibold text-gray-700 mr-2">Partager :</span>
          <a href={lienWhatsApp('', `${a.titre} — ${adresse}`)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-4 py-2 text-sm font-semibold"><IconeWhatsApp className="h-4 w-4" />WhatsApp</a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(adresse)}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#1877F2] text-white px-4 py-2 text-sm font-semibold"><Facebook className="h-4 w-4" />Facebook</a>
          <button type="button" onClick={() => navigator.clipboard?.writeText(adresse).then(() => { setCopie(true); setTimeout(() => setCopie(false), 2000); })}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            {copie ? <><Check className="h-4 w-4 text-green-600" />Lien copié</> : <><Copy className="h-4 w-4" />Copier le lien</>}
          </button>
        </div>
      </div>

      {autres.length > 0 && !edition && (
        <div className="bg-gray-50 py-16">
          <Conteneur>
            <p className="titre text-2xl font-bold text-[var(--c1)] mb-8">Autres actualités</p>
            <AutresActualites ids={autres.map(x => x.id)} />
          </Conteneur>
        </div>
      )}
    </article>
  );
}

function AutresActualites({ ids }: { ids: string[] }) {
  const { contenu } = useEdition();
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {ids.map(id => {
        const a = contenu.actualites.elements.find(x => x.id === id)!;
        return (
          <a key={id} href={`#/actualites/${encodeURIComponent(id)}`} className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="h-40 overflow-hidden">{a.image && <img src={a.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}</div>
            <div className="p-5">
              <p className="text-xs text-gray-500">{a.date}</p>
              <p className="titre font-bold text-gray-900 mt-1 group-hover:text-[var(--c1)]">{a.titre}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
