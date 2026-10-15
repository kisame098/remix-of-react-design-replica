import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus, X } from 'lucide-react';
import { Bouton, Img, Liste, Section, T, useEdition } from '../../edition';
import { CartesActualites, FormulaireWhatsApp, NOUVEAU_CYCLE, nouvelleActualite } from '../../composants';
import { identifiant, lienCarte, lienWhatsApp } from '../../utilitaires';
import { Cadre, JournalP, TitreP } from './accueil';
import { ROMAINS, Revele } from './GabaritPrestige';

const CHAMP = 'w-full bg-transparent border-0 border-b border-black/20 rounded-none px-0 py-3 text-lg font-light focus:outline-none focus:border-[var(--c1)] focus:ring-0 transition-colors';
const BOUTON = 'inline-flex items-center gap-3 h-14 px-10 bg-[var(--c1)] text-white capitales !text-[11px] hover:bg-[var(--c2)] transition-colors duration-300';

/* ─────────── Notre école ─────────── */

export function HistoireP() {
  return (
    <Section className="py-32">
      <Cadre className="grid lg:grid-cols-[0.8fr_1.2fr] gap-16 items-start">
        <div className="lg:sticky lg:top-32">
          <Revele className="titre text-[9rem] md:text-[12rem] leading-[0.8] text-[var(--c1)]"><T c="identite.creation" /></Revele>
          <Revele delai={150} className="mt-8 relative aspect-[4/5] overflow-hidden grain">
            <Img c="ecole.histoire.image" className="w-full h-full object-cover" />
          </Revele>
        </div>
        <div className="lg:pt-10">
          <TitreP c="ecole.histoire" texte={false} />
          <Revele delai={200}>
            <T c="ecole.histoire.texte" as="div" className="block text-xl md:text-2xl font-light leading-[1.7] text-black/75 first-letter:titre first-letter:text-[5.5rem] first-letter:float-left first-letter:leading-[0.8] first-letter:mr-4 first-letter:mt-2 first-letter:text-[var(--c1)]" />
          </Revele>
        </div>
      </Cadre>
    </Section>
  );
}

/** Mot du directeur, version lettre : portrait en noir et blanc, signature manuscrite. */
export function LettreP() {
  return (
    <Section className="py-32 bg-white">
      <Cadre className="grid lg:grid-cols-[0.75fr_1.25fr] gap-16 items-center">
        <Revele className="relative aspect-[3/4] overflow-hidden group">
          <Img c="accueil.mot.image" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-[filter] duration-1000" />
          <div className="absolute inset-4 border border-white/40 pointer-events-none" />
        </Revele>
        <div>
          <TitreP c="accueil.mot" texte={false} />
          <Revele delai={150}><T c="accueil.mot.texte" as="div" className="block text-xl font-light leading-[1.8] text-black/70" /></Revele>
          <Revele delai={300} className="mt-12 pt-8 border-t border-black/10">
            <T c="accueil.mot.nom" as="p" className="signature block text-5xl text-[var(--c1)]" />
            <T c="accueil.mot.fonction" as="p" className="block capitales text-black/45 mt-2" />
          </Revele>
        </div>
      </Cadre>
    </Section>
  );
}

export function EquipeP() {
  return (
    <Section className="py-32">
      <Cadre>
        <TitreP c="ecole.equipe" />
        <Liste c="ecole.equipe.elements" colonnes={4} nouveau={{ photo: '', nom: 'Nom', fonction: 'Fonction' }} libelleAjout="Ajouter une personne">
          {(_, i, ce) => (
            <Revele delai={i * 100} className="group">
              <div className="relative aspect-[3/4] overflow-hidden">
                <Img c={`${ce}.photo`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000" />
              </div>
              <div className="pt-6 border-b border-black/10 pb-5">
                <T c={`${ce}.nom`} as="p" className="titre block text-2xl" />
                <T c={`${ce}.fonction`} as="p" className="block capitales !text-[10px] text-black/45 mt-2" />
              </div>
            </Revele>
          )}
        </Liste>
      </Cadre>
    </Section>
  );
}

/** Campus : défilement horizontal, légendes sous les photos, flèches de navigation. */
export function CampusP() {
  const rail = useRef<HTMLDivElement>(null);
  const defiler = (sens: number) => rail.current?.scrollBy({ left: sens * rail.current.clientWidth * 0.7, behavior: 'smooth' });
  return (
    <Section className="py-32 bg-[var(--c1)] text-white overflow-hidden">
      <Cadre className="flex flex-wrap items-end justify-between gap-8">
        <TitreP c="ecole.infrastructures" clair />
        <div className="mb-16 flex gap-3">
          <button type="button" onClick={() => defiler(-1)} aria-label="Précédent" className="h-14 w-14 border border-white/25 flex items-center justify-center hover:bg-white hover:text-[var(--encre)] transition-colors"><ArrowLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => defiler(1)} aria-label="Suivant" className="h-14 w-14 border border-white/25 flex items-center justify-center hover:bg-white hover:text-[var(--encre)] transition-colors"><ArrowRight className="h-5 w-5" /></button>
        </div>
      </Cadre>
      <div ref={rail} className="defile-x overflow-x-auto snap-x snap-mandatory scroll-pl-6 lg:scroll-pl-10">
        <Liste c="ecole.infrastructures.elements" horizontal nouveau={{ image: '', titre: 'Nouvel espace', texte: 'Description.' }}
          className="flex gap-6 px-6 lg:px-10 w-max" classeElement="snap-start w-[78vw] md:w-[46vw] lg:w-[34vw] flex-shrink-0">
          {(_, i, ce) => (
            <figure>
              <div className="relative aspect-[4/5] overflow-hidden grain"><Img c={`${ce}.image`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-1000" /></div>
              <figcaption className="flex gap-5 pt-6">
                <span className="titre text-xl text-[var(--c2)]">{ROMAINS[i]}</span>
                <span><T c={`${ce}.titre`} className="titre block text-3xl" /><T c={`${ce}.texte`} className="block mt-1 text-white/60 font-light" /></span>
              </figcaption>
            </figure>
          )}
        </Liste>
      </div>
    </Section>
  );
}

export function VisiteP() {
  return (
    <Section className="py-32">
      <Cadre className="grid lg:grid-cols-2 gap-0 bg-white">
        <div className="relative min-h-[420px] overflow-hidden grain"><Img c="prestige.visite.image" className="absolute inset-0 w-full h-full object-cover" /></div>
        <div className="p-10 md:p-20 flex flex-col justify-center">
          <TitreP c="prestige.visite" />
          <Revele delai={300}><Bouton c="prestige.visite.bouton" className="inline-flex items-center h-14 px-10 bg-[var(--c1)] text-white capitales !text-[11px] hover:bg-[var(--c2)] transition-colors duration-300" /></Revele>
        </div>
      </Cadre>
    </Section>
  );
}

/* ─────────── Enseignement : un chapitre par cycle ─────────── */

export function ChapitresP() {
  return (
    <Section className="py-16">
      <Cadre>
        <Liste c="enseignement.cycles" nouveau={NOUVEAU_CYCLE} libelleAjout="Ajouter un cycle">
          {(_, i, ce) => (
            <article className="grid lg:grid-cols-12 gap-10 py-24 border-b border-black/10 items-center">
              <Revele className={`lg:col-span-5 relative aspect-[4/5] overflow-hidden grain ${i % 2 ? 'lg:order-2 lg:col-start-8' : ''}`}>
                <Img c={`${ce}.image`} className="w-full h-full object-cover" />
              </Revele>
              <div className={`lg:col-span-6 ${i % 2 ? 'lg:col-start-1' : 'lg:col-start-7'}`}>
                <Revele className="flex items-center gap-4"><span className="capitales text-[var(--c2)]">Chapitre {ROMAINS[i]}</span><span className="h-px flex-1 bg-black/10" /><T c={`${ce}.age`} className="capitales text-black/45" /></Revele>
                <Revele delai={100}><T c={`${ce}.nom`} as="h2" className="titre block text-6xl md:text-8xl leading-[0.95] mt-8" /></Revele>
                <Revele delai={180}><T c={`${ce}.niveaux`} as="p" className="block mt-4 text-xl text-[var(--c1)]" /></Revele>
                <Revele delai={260}><T c={`${ce}.texte`} as="p" className="block mt-8 text-xl font-light leading-[1.7] text-black/70" /></Revele>
                <Liste c={`${ce}.points`} nouveau="Nouveau point" className="mt-10 border-t border-black/10" libelleAjout="Ajouter un point">
                  {(__, j, cp) => (
                    <p className="flex items-baseline gap-5 py-4 border-b border-black/10">
                      <span className="titre text-[var(--c2)] w-6">{j + 1}</span><T c={cp} className="text-lg" />
                    </p>
                  )}
                </Liste>
              </div>
            </article>
          )}
        </Liste>
      </Cadre>
    </Section>
  );
}

/* ─────────── Vie scolaire ─────────── */

export function ActivitesP() {
  return (
    <Section className="py-32">
      <Cadre>
        <TitreP c="vieScolaire.activites" numero={0} />
        <Liste c="vieScolaire.activites.elements" colonnes={2} nouveau={{ image: '', titre: 'Activité', texte: 'Description.' }} className="!gap-x-10 !gap-y-16" classeElement="!w-full md:!w-[calc((100%_-_2.5rem)/2)]">
          {(_, i, ce) => (
            <Revele delai={(i % 2) * 150} className={i % 2 ? 'md:mt-24' : ''}>
              <div className="relative aspect-[4/3] overflow-hidden group grain"><Img c={`${ce}.image`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" /></div>
              <div className="flex gap-6 pt-6">
                <span className="titre text-2xl text-[var(--c2)]">{ROMAINS[i]}</span>
                <div><T c={`${ce}.titre`} as="h3" className="titre block text-3xl" /><T c={`${ce}.texte`} as="p" className="block mt-2 text-black/60 font-light text-lg" /></div>
              </div>
            </Revele>
          )}
        </Liste>
      </Cadre>
    </Section>
  );
}

export function GalerieP() {
  const { contenu, edition } = useEdition();
  const [ouverte, setOuverte] = useState<number | null>(null);
  const images = contenu.vieScolaire.galerie.elements;
  return (
    <Section className="py-32 bg-white">
      <Cadre>
        <TitreP c="vieScolaire.galerie" />
        <Liste c="vieScolaire.galerie.elements" nouveau={{ image: '' }} className="grid grid-cols-2 md:grid-cols-6 auto-rows-[160px] md:auto-rows-[200px] gap-3" classeElement="[&:nth-child(6n+1)]:md:col-span-4 [&:nth-child(6n+1)]:md:row-span-2 md:col-span-2 [&:nth-child(6n+4)]:md:col-span-3 [&:nth-child(6n+5)]:md:col-span-3" libelleAjout="Ajouter une photo">
          {(_, i, ce) => (
            <div role="button" tabIndex={0} onClick={() => !edition && setOuverte(i)} onKeyDown={e => e.key === 'Enter' && !edition && setOuverte(i)} className="relative block w-full h-full overflow-hidden group">
              <Img c={`${ce}.image`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
            </div>
          )}
        </Liste>
      </Cadre>
      {ouverte !== null && images[ouverte] && (
        <div className="fixed inset-0 z-[60] bg-[#0E1525]/97 flex items-center justify-center p-6" onClick={() => setOuverte(null)}>
          <button type="button" aria-label="Fermer" className="absolute top-6 right-6 text-white flex items-center gap-3 capitales !text-[11px]">Fermer <X className="h-5 w-5" /></button>
          <button type="button" aria-label="Précédente" onClick={e => { e.stopPropagation(); setOuverte((ouverte - 1 + images.length) % images.length); }} className="absolute left-4 md:left-10 h-14 w-14 border border-white/25 text-white flex items-center justify-center"><ArrowLeft className="h-5 w-5" /></button>
          <img src={images[ouverte].image} alt="" className="max-h-[85vh] max-w-[85vw] object-contain" onClick={e => e.stopPropagation()} />
          <button type="button" aria-label="Suivante" onClick={e => { e.stopPropagation(); setOuverte((ouverte + 1) % images.length); }} className="absolute right-4 md:right-10 h-14 w-14 border border-white/25 text-white flex items-center justify-center"><ArrowRight className="h-5 w-5" /></button>
          <p className="absolute bottom-6 text-white/50 titre text-xl">{ouverte + 1} / {images.length}</p>
        </div>
      )}
    </Section>
  );
}

export function CalendrierP() {
  return (
    <Section className="py-32">
      <Cadre className="grid lg:grid-cols-[0.8fr_1.2fr] gap-16">
        <TitreP c="vieScolaire.calendrier" />
        <Liste c="vieScolaire.calendrier.elements" nouveau={{ date: 'Mois', evenement: 'Événement' }} className="border-t border-black/10" libelleAjout="Ajouter une date">
          {(_, i, ce) => (
            <Revele delai={i * 70} className="grid grid-cols-[9rem_1fr] md:grid-cols-[12rem_1fr] gap-6 py-7 border-b border-black/10 items-baseline group">
              <T c={`${ce}.date`} className="titre text-2xl md:text-3xl text-[var(--c1)]" />
              <T c={`${ce}.evenement`} className="text-lg font-light group-hover:translate-x-2 transition-transform duration-500" />
            </Revele>
          )}
        </Liste>
      </Cadre>
    </Section>
  );
}

/* ─────────── Admissions ─────────── */

export function EtapesP() {
  return (
    <Section className="py-32">
      <Cadre>
        <TitreP c="admissions.etapes" numero={0} />
        <Liste c="admissions.etapes.elements" colonnes={4} nouveau={{ titre: 'Étape', texte: 'Description.' }} className="!gap-0" classeElement="!w-full sm:!w-1/2 lg:!w-1/4">
          {(_, i, ce) => (
            <Revele delai={i * 120} className="pr-8 pb-10 group">
              <div className="flex items-center gap-4 mb-8">
                <span className="h-px flex-1 bg-black/15 relative overflow-hidden"><span className="absolute inset-0 bg-[var(--c2)] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700" /></span>
              </div>
              <p className="titre text-7xl text-[var(--c1)] leading-none">{String(i + 1).padStart(2, '0')}</p>
              <T c={`${ce}.titre`} as="h3" className="titre block text-3xl mt-6" />
              <T c={`${ce}.texte`} as="p" className="block mt-3 text-black/60 font-light text-lg leading-relaxed" />
            </Revele>
          )}
        </Liste>
      </Cadre>
    </Section>
  );
}

export function PiecesP() {
  return (
    <Section className="py-28 bg-white">
      <Cadre className="grid lg:grid-cols-2 gap-16">
        {(['admissions.pieces', 'admissions.paiement'] as const).map((c, n) => (
          <div key={c}>
            <Revele className="flex items-center gap-4"><span className="capitales text-[var(--c2)]">{ROMAINS[n]}</span><span className="h-px w-12 bg-[var(--c2)]" /></Revele>
            <Revele delai={100}><T c={`${c}.titre`} as="h3" className="titre block text-4xl md:text-5xl mt-6 mb-10" /></Revele>
            <Liste c={`${c}.elements`} nouveau="Nouvel élément" className="border-t border-black/10">
              {(_, i, ce) => (
                <p className="flex items-baseline gap-5 py-5 border-b border-black/10">
                  <span className="capitales !text-[10px] text-black/35 w-6">{String(i + 1).padStart(2, '0')}</span><T c={ce} className="text-lg" />
                </p>
              )}
            </Liste>
          </div>
        ))}
      </Cadre>
    </Section>
  );
}

/** Frais : registre sobre, chiffres en grand. */
export function FraisP() {
  return (
    <Section className="py-32">
      <Cadre>
        <TitreP c="admissions.frais" numero={1} />
        <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr] gap-6 pb-4 capitales !text-[10px] text-black/40 border-b border-[var(--encre)]">
          <span>Cycle</span><span className="text-right">Frais d'inscription</span><span className="text-right">Mensualité</span>
        </div>
        <Liste c="admissions.frais.elements" nouveau={{ niveau: 'Niveau', inscription: '0 F', mensualite: '0 F' }} libelleAjout="Ajouter un tarif">
          {(_, i, ce) => (
            <Revele delai={i * 80} className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr] gap-x-6 gap-y-2 py-8 border-b border-black/10 items-baseline group">
              <T c={`${ce}.niveau`} className="col-span-2 md:col-span-1 titre text-3xl md:text-4xl group-hover:italic transition-all" />
              <span className="md:text-right"><span className="md:hidden capitales !text-[9px] text-black/40 block">Inscription</span><T c={`${ce}.inscription`} className="titre text-2xl text-black/60" /></span>
              <span className="text-right"><span className="md:hidden capitales !text-[9px] text-black/40 block">Mensualité</span><T c={`${ce}.mensualite`} className="titre text-3xl md:text-4xl text-[var(--c1)]" /></span>
            </Revele>
          )}
        </Liste>
        <Revele><T c="admissions.frais.note" as="p" className="block mt-8 text-black/50 font-light max-w-2xl" /></Revele>
      </Cadre>
    </Section>
  );
}

export function CandidatureP() {
  const { contenu } = useEdition();
  return (
    <Section className="py-32 bg-white">
      <Cadre className="grid lg:grid-cols-[0.8fr_1.2fr] gap-20">
        <div>
          <Revele className="flex items-center gap-4"><span className="capitales text-[var(--c2)]">{ROMAINS[2]}</span><span className="h-px w-12 bg-[var(--c2)]" /><span className="capitales text-black/50">Admission</span></Revele>
          <Revele delai={100}><T c="admissions.formulaire.titre" as="h2" className="titre block text-5xl md:text-7xl leading-[1] mt-6" /></Revele>
          <Revele delai={200}><T c="admissions.formulaire.texte" as="p" className="block mt-6 text-lg font-light text-black/60" /></Revele>
        </div>
        <Revele delai={200}>
          <FormulaireWhatsApp entete="Demande d'admission" bouton="Transmettre la demande" classeChamp={CHAMP} classeBouton={BOUTON}
            champs={[
              { nom: 'enfant', libelle: 'Nom et prénom de l\'élève', requis: true },
              { nom: 'naissance', libelle: 'Date de naissance' },
              { nom: 'cycle', libelle: 'Cycle envisagé', type: 'select', options: contenu.enseignement.cycles.map(c => c.nom), requis: true },
              { nom: 'classe', libelle: 'Classe envisagée' },
              { nom: 'parent', libelle: 'Nom du responsable légal', requis: true },
              { nom: 'telephone', libelle: 'Téléphone', type: 'tel', requis: true },
              { nom: 'message', libelle: 'Établissement actuel, motivations…', type: 'textarea' },
            ]} />
        </Revele>
      </Cadre>
    </Section>
  );
}

export function FaqP() {
  return (
    <Section className="py-32">
      <Cadre className="grid lg:grid-cols-[0.8fr_1.2fr] gap-16">
        <TitreP c="admissions.faq" />
        <Liste c="admissions.faq.elements" nouveau={{ question: 'Question ?', reponse: 'Réponse.' }} className="border-t border-black/10" libelleAjout="Ajouter une question">
          {(_, __, ce) => <QuestionP ce={ce} />}
        </Liste>
      </Cadre>
    </Section>
  );
}

function QuestionP({ ce }: { ce: string }) {
  const { edition } = useEdition();
  const [ouvert, setOuvert] = useState(false);
  const visible = ouvert || edition;
  return (
    <div className="border-b border-black/10">
      <button type="button" onClick={() => setOuvert(o => !o)} className="w-full flex items-center gap-6 text-left py-7 group">
        <T c={`${ce}.question`} className="flex-1 titre text-2xl md:text-3xl group-hover:text-[var(--c1)] transition-colors" />
        <span className="h-10 w-10 border border-black/15 flex items-center justify-center flex-shrink-0">{visible ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-500 ${visible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden"><T c={`${ce}.reponse`} as="p" className="block pb-8 pr-16 text-lg font-light leading-relaxed text-black/65" /></div>
      </div>
    </div>
  );
}

/* ─────────── Journal et contact ─────────── */

export function ListeActualitesP() {
  const { contenu, edition, majListe } = useEdition();
  const creer = () => {
    const a = nouvelleActualite(identifiant('nouvelle actualite', contenu.actualites.elements.map(x => x.id)));
    majListe('actualites.elements', l => [a, ...l]);
    location.hash = `#/actualites/${a.id}`;
  };
  return (
    <Section className="py-28">
      <Cadre>
        {edition ? (
          <>
            <div className="flex justify-center mb-10"><button type="button" className="outil !text-sm !px-5 !py-3" onClick={creer}><Plus className="h-4 w-4" />Écrire une nouvelle actualité</button></div>
            <CartesActualites />
          </>
        ) : <JournalP titre={false} />}
      </Cadre>
    </Section>
  );
}

export function ContactP() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  const lignes = [
    { titre: 'Adresse', valeur: id.adresse },
    { titre: 'Téléphone', valeur: id.telephone, lien: `tel:${id.telephone.replace(/\s/g, '')}` },
    { titre: 'WhatsApp', valeur: id.whatsapp, lien: lienWhatsApp(id.whatsapp, id.messageWhatsApp) },
    { titre: 'Courriel', valeur: id.email, lien: `mailto:${id.email}` },
    { titre: 'Accueil', valeur: id.horaires },
  ].filter(l => l.valeur);
  return (
    <Section className="py-28">
      <Cadre className="grid lg:grid-cols-2 gap-20">
        <div>
          <Revele><T c="contact.titre" as="h2" className="titre block text-5xl md:text-7xl leading-[1]" /></Revele>
          <Revele delai={100}><T c="contact.texte" as="p" className="block mt-6 text-lg font-light text-black/60" /></Revele>
          <dl className="mt-14 border-t border-black/10">
            {lignes.map((l, i) => (
              <Revele key={l.titre} delai={i * 70} className="grid grid-cols-[8rem_1fr] gap-6 py-5 border-b border-black/10 items-baseline">
                <dt className="capitales !text-[10px] text-black/40">{l.titre}</dt>
                <dd className="text-lg">{l.lien ? <a href={l.lien} target={l.lien.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="hover:text-[var(--c1)] underline-offset-4 hover:underline">{l.valeur}</a> : l.valeur}</dd>
              </Revele>
            ))}
          </dl>
        </div>
        <Revele delai={150} className="bg-white p-8 md:p-14">
          <FormulaireWhatsApp entete="Message depuis le site web" bouton="Envoyer le message" classeChamp={CHAMP} classeBouton={BOUTON}
            champs={[
              { nom: 'nom', libelle: 'Nom complet', requis: true },
              { nom: 'telephone', libelle: 'Téléphone', type: 'tel', requis: true },
              { nom: 'objet', libelle: 'Objet', type: 'select', options: ['Admission', 'Visite du campus', 'Renseignements', 'Autre'] },
              { nom: 'message', libelle: 'Message', type: 'textarea', requis: true },
            ]} />
        </Revele>
      </Cadre>
      <div className="mt-24 h-[460px] grayscale contrast-[1.05] hover:grayscale-0 transition-[filter] duration-1000">
        <iframe title="Plan d'accès" src={lienCarte(id.adresse)} className="w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </div>
    </Section>
  );
}
