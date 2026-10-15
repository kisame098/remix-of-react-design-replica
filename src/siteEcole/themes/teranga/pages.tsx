import { useState } from 'react';
import { Check, Clock, Mail, MapPin, Minus, Phone, Plus, X } from 'lucide-react';
import { Img, Liste, Section, T, useEdition } from '../../edition';
import { CartesActualites, FormulaireWhatsApp, NOUVEAU_CYCLE, nouvelleActualite } from '../../composants';
import { IconeWhatsApp } from '../../reseaux';
import { identifiant, lienCarte, lienWhatsApp } from '../../utilitaires';
import { Boite, MagazineActualites, TitreT } from './accueil';
import { Motif } from './Motif';

const CHAMP = 'w-full bg-transparent border-0 border-b-2 border-black/15 px-0 py-3 text-lg focus:outline-none focus:border-[var(--c1)] placeholder:text-black/30';
const BOUTON = 'inline-flex items-center gap-2 h-14 px-8 rounded-full bg-[var(--encre)] text-white font-bold hover:bg-[var(--c1)] transition-colors';

/* ─────────── Notre école ─────────── */

export function HistoireT() {
  return (
    <Section className="py-24">
      <Boite className="grid lg:grid-cols-2 gap-16 items-center">
        <div className="relative h-[480px]">
          <div className="absolute left-0 top-0 w-3/4 h-3/4 rounded-[2.5rem] overflow-hidden shadow-xl"><Img c="ecole.histoire.image" className="w-full h-full object-cover" /></div>
          <div className="absolute right-0 bottom-0 w-1/2 h-1/2 rounded-[2.5rem] overflow-hidden ring-8 ring-[var(--fond)] shadow-xl"><Img c="ecole.entete.image" className="w-full h-full object-cover" /></div>
          <div className="absolute left-6 bottom-6 h-28 w-28 rounded-full bg-[var(--c1)] text-white flex flex-col items-center justify-center shadow-xl">
            <span className="text-xs font-bold uppercase opacity-70">Depuis</span>
            <T c="identite.creation" className="titre text-3xl font-extrabold" />
          </div>
        </div>
        <div>
          <TitreT c="ecole.histoire" texte={false} />
          <T c="ecole.histoire.texte" as="div" className="block -mt-4 text-xl leading-relaxed text-black/70 first-letter:titre first-letter:text-7xl first-letter:font-extrabold first-letter:float-left first-letter:mr-3 first-letter:leading-[0.8] first-letter:text-[var(--c1)]" />
        </div>
      </Boite>
    </Section>
  );
}

export function EquipeT() {
  return (
    <Section className="py-24 bg-white rounded-[2.5rem] md:rounded-[4rem] mx-2 md:mx-4">
      <Boite>
        <TitreT c="ecole.equipe" centre />
        <Liste c="ecole.equipe.elements" colonnes={4} nouveau={{ photo: '', nom: 'Nom', fonction: 'Fonction' }} libelleAjout="Ajouter une personne">
          {(_, i, ce) => (
            <div className="text-center group">
              <div className="relative mx-auto h-52 w-52">
                <div className={`absolute inset-0 rounded-full ${i % 2 ? 'bg-[var(--c2)]' : 'bg-[var(--c1)]'} translate-x-2 translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform`} />
                <div className="relative h-full w-full rounded-full overflow-hidden"><Img c={`${ce}.photo`} className="w-full h-full object-cover" /></div>
              </div>
              <T c={`${ce}.nom`} as="p" className="titre block text-2xl font-extrabold mt-6" />
              <T c={`${ce}.fonction`} as="p" className="block text-black/50 font-medium mt-1" />
            </div>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/** Infrastructures : mosaïque irrégulière, la première photo en grand. */
export function InfrastructuresT() {
  return (
    <Section className="py-24">
      <Boite>
        <TitreT c="ecole.infrastructures" />
        <Liste c="ecole.infrastructures.elements" nouveau={{ image: '', titre: 'Nouvel espace', texte: 'Description.' }}
          className="grid grid-cols-1 md:grid-cols-4 auto-rows-[220px] gap-4" classeElement="first:md:col-span-2 first:md:row-span-2 [&:nth-child(4)]:md:col-span-2">
          {(_, __, ce) => (
            <div className="group relative h-full rounded-[2rem] overflow-hidden">
              <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute left-3 bottom-3 right-3 rounded-[1.25rem] bg-white/95 backdrop-blur px-5 py-3">
                <T c={`${ce}.titre`} as="p" className="titre block font-extrabold text-lg" />
                <T c={`${ce}.texte`} as="p" className="block text-sm text-black/60" />
              </div>
            </div>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────── Enseignement : les cycles en onglets ─────────── */

export function CyclesOnglets() {
  const { contenu, edition } = useEdition();
  const cycles = contenu.enseignement.cycles;
  const [i, setI] = useState(0);
  const k = Math.min(i, Math.max(cycles.length - 1, 0));
  const ce = `enseignement.cycles.${k}`;
  return (
    <Section className="py-20">
      <Boite>
        <Liste c="enseignement.cycles" nouveau={NOUVEAU_CYCLE} className="flex flex-wrap gap-2 mb-10" libelleAjout="Cycle">
          {(cy, j) => (
            <button type="button" onClick={() => setI(j)}
              className={`h-14 px-7 rounded-full font-bold text-lg transition-colors ${j === k ? 'bg-[var(--encre)] text-white' : 'bg-white border border-black/10 hover:border-black/40'}`}>
              {cy.nom}
            </button>
          )}
        </Liste>
        {cycles[k] && (
          <div key={k} className="apparition grid lg:grid-cols-2 gap-10 items-stretch rounded-[2.5rem] bg-white p-4 md:p-6">
            <div className="relative min-h-[360px] rounded-[2rem] overflow-hidden">
              <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover" />
              <T c={`${ce}.age`} className="absolute left-4 top-4 rounded-full bg-white px-4 py-2 font-bold text-sm" />
            </div>
            <div className="p-4 md:p-6 flex flex-col">
              <T c={`${ce}.nom`} as="h2" className="titre block text-5xl md:text-6xl font-extrabold" />
              <T c={`${ce}.niveaux`} as="p" className="block mt-3 text-lg font-semibold text-[var(--c1)]" />
              <T c={`${ce}.texte`} as="p" className="block mt-6 text-xl text-black/70 leading-relaxed" />
              <Liste c={`${ce}.points`} nouveau="Nouveau point" className="mt-8 grid sm:grid-cols-2 gap-3" libelleAjout="Ajouter un point">
                {(__, ___, cp) => (
                  <p className="flex items-center gap-3 rounded-2xl bg-[var(--fond)] px-4 py-3 font-semibold">
                    <span className="h-7 w-7 rounded-full bg-[var(--c2)] text-white flex items-center justify-center flex-shrink-0"><Check className="h-4 w-4" /></span><T c={cp} />
                  </p>
                )}
              </Liste>
              {edition && <p className="mt-6 text-sm text-black/40">Choisissez un onglet pour modifier son cycle ; glissez les onglets pour les réordonner.</p>}
            </div>
          </div>
        )}
      </Boite>
    </Section>
  );
}

/* ─────────── Vie scolaire ─────────── */

export function ActivitesT() {
  return (
    <Section className="py-24">
      <Boite>
        <TitreT c="vieScolaire.activites" />
        <Liste c="vieScolaire.activites.elements" colonnes={2} nouveau={{ image: '', titre: 'Nouvelle activité', texte: 'Description.' }} classeElement="flex">
          {(_, i, ce) => (
            <div className={`w-full flex flex-col sm:flex-row gap-5 rounded-[2rem] p-3 ${i % 2 ? 'bg-[var(--c2)] text-white' : 'bg-white'}`}>
              <div className="relative h-48 sm:h-auto sm:w-48 flex-shrink-0 rounded-[1.5rem] overflow-hidden"><Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover" /></div>
              <div className="py-3 pr-4">
                <T c={`${ce}.titre`} as="h3" className="titre block text-2xl font-extrabold" />
                <T c={`${ce}.texte`} as="p" className="block mt-2 opacity-70 leading-relaxed" />
              </div>
            </div>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/** Galerie en mosaïque (colonnes de hauteurs libres). */
export function GalerieT() {
  const { edition } = useEdition();
  const [agrandie, setAgrandie] = useState<string | null>(null);
  return (
    <Section className="py-24">
      <Boite>
        <TitreT c="vieScolaire.galerie" centre />
        <Liste c="vieScolaire.galerie.elements" nouveau={{ image: '' }} className="columns-2 md:columns-3 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid" libelleAjout="Ajouter une photo">
          {(el, i, ce) => (
            <div role="button" tabIndex={0} onClick={() => !edition && setAgrandie(el.image)} onKeyDown={e => e.key === 'Enter' && !edition && setAgrandie(el.image)} className={`relative block w-full rounded-[1.75rem] overflow-hidden ${['aspect-[3/4]', 'aspect-square', 'aspect-[4/3]'][i % 3]}`}>
              <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
          )}
        </Liste>
      </Boite>
      {agrandie && (
        <div className="fixed inset-0 z-[60] bg-[var(--encre)]/95 flex items-center justify-center p-4" onClick={() => setAgrandie(null)}>
          <button type="button" className="absolute top-5 right-5 h-12 w-12 rounded-full bg-white text-black flex items-center justify-center" aria-label="Fermer"><X /></button>
          <img src={agrandie} alt="" className="max-h-full max-w-full rounded-[1.5rem]" />
        </div>
      )}
    </Section>
  );
}

/** Calendrier en frise horizontale. */
export function CalendrierT() {
  return (
    <Section className="py-24 bg-[var(--encre)] text-white rounded-[2.5rem] md:rounded-[4rem] mx-2 md:mx-4 overflow-hidden relative">
      <Motif type="eventails" className="absolute inset-0 text-white/[0.04]" />
      <Boite className="relative">
        <TitreT c="vieScolaire.calendrier" clair />
        <div className="relative">
          <div className="hidden md:block absolute left-0 right-0 top-[11px] h-0.5 bg-white/15" />
          <Liste c="vieScolaire.calendrier.elements" nouveau={{ date: 'Mois', evenement: 'Événement' }} className="grid md:grid-flow-col md:auto-cols-fr gap-8" libelleAjout="Date">
            {(_, i, ce) => (
              <div className="relative">
                <span className={`block h-6 w-6 rounded-full ring-4 ring-[var(--encre)] ${i % 2 ? 'bg-[var(--c2)]' : 'bg-[var(--c1)]'}`} />
                <T c={`${ce}.date`} as="p" className="titre block text-2xl font-extrabold mt-5" />
                <T c={`${ce}.evenement`} as="p" className="block mt-2 text-white/60" />
              </div>
            )}
          </Liste>
        </div>
      </Boite>
    </Section>
  );
}

/* ─────────── Admissions ─────────── */

/** Étapes : parcours vertical, gros numéros reliés par une ligne. */
export function EtapesT() {
  return (
    <Section className="py-24">
      <Boite className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
        <div className="lg:sticky lg:top-32 self-start"><TitreT c="admissions.etapes" /></div>
        <Liste c="admissions.etapes.elements" nouveau={{ titre: 'Nouvelle étape', texte: 'Description.' }} className="relative">
          {(_, i, ce) => (
            <div className="relative flex gap-6 pb-12 last:pb-0 group">
              <div className="flex flex-col items-center">
                <span className={`h-16 w-16 rounded-full flex items-center justify-center titre text-2xl font-extrabold text-white flex-shrink-0 ${i % 2 ? 'bg-[var(--c2)]' : 'bg-[var(--c1)]'}`}>{i + 1}</span>
                <span className="flex-1 w-0.5 bg-black/10 mt-2 group-last:hidden" />
              </div>
              <div className="pt-3 rounded-[2rem] flex-1">
                <T c={`${ce}.titre`} as="h3" className="titre block text-3xl font-extrabold" />
                <T c={`${ce}.texte`} as="p" className="block mt-2 text-lg text-black/60" />
              </div>
            </div>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

export function PiecesT() {
  return (
    <Section className="py-16">
      <Boite className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="rounded-[2.5rem] bg-white p-8 md:p-10">
          <T c="admissions.pieces.titre" as="h3" className="titre block text-3xl font-extrabold mb-6" />
          <Liste c="admissions.pieces.elements" nouveau="Nouvelle pièce" className="grid sm:grid-cols-2 gap-3">
            {(_, __, ce) => (
              <p className="flex items-start gap-3 rounded-2xl border border-black/10 p-4 font-medium">
                <span className="h-6 w-6 rounded-md border-2 border-[var(--c1)] flex items-center justify-center flex-shrink-0 mt-0.5"><Check className="h-4 w-4 text-[var(--c1)]" /></span><T c={ce} />
              </p>
            )}
          </Liste>
        </div>
        <div className="rounded-[2.5rem] bg-[var(--c1)] text-white p-8 md:p-10 relative overflow-hidden">
          <Motif type="points" className="absolute inset-0 text-white/10" />
          <T c="admissions.paiement.titre" as="h3" className="relative titre block text-3xl font-extrabold mb-6" />
          <Liste c="admissions.paiement.elements" nouveau="Moyen de paiement" className="relative flex flex-wrap gap-2">
            {(_, __, ce) => <T c={ce} className="inline-block rounded-full bg-white text-[var(--encre)] px-5 py-2.5 font-bold" />}
          </Liste>
        </div>
      </Boite>
    </Section>
  );
}

/** Frais : une carte de prix par cycle (au lieu d'un tableau). */
export function FraisT() {
  return (
    <Section className="py-24">
      <Boite>
        <TitreT c="admissions.frais" centre />
        <Liste c="admissions.frais.elements" colonnes={4} nouveau={{ niveau: 'Niveau', inscription: '0 F', mensualite: '0 F' }} classeElement="flex" libelleAjout="Ajouter un tarif">
          {(_, i, ce) => (
            <div className={`w-full rounded-[2rem] p-8 flex flex-col ${i === 1 ? 'bg-[var(--encre)] text-white lg:-translate-y-4 shadow-2xl' : 'bg-white'}`}>
              <T c={`${ce}.niveau`} as="p" className="titre block text-2xl font-extrabold" />
              <p className="mt-6 text-sm font-semibold opacity-60">Mensualité</p>
              <T c={`${ce}.mensualite`} as="p" className="titre block text-5xl font-extrabold text-[var(--c1)] leading-tight" />
              <div className={`mt-6 pt-6 border-t ${i === 1 ? 'border-white/15' : 'border-black/10'} flex justify-between font-semibold`}>
                <span className="opacity-60">Inscription</span><T c={`${ce}.inscription`} />
              </div>
            </div>
          )}
        </Liste>
        <T c="admissions.frais.note" as="p" className="block mt-10 text-center text-black/50" />
      </Boite>
    </Section>
  );
}

export function PreinscriptionT() {
  const { contenu } = useEdition();
  return (
    <Section className="py-16 px-2 md:px-4">
      <div className="max-w-6xl mx-auto rounded-[2.5rem] md:rounded-[3.5rem] bg-white overflow-hidden grid lg:grid-cols-[0.8fr_1.2fr]">
        <div className="relative bg-[var(--c2)] text-white p-10 md:p-14 flex flex-col justify-between overflow-hidden">
          <Motif type="losanges" className="absolute inset-0 text-white/10" />
          <div className="relative">
            <T c="admissions.formulaire.titre" as="h2" className="titre block text-4xl md:text-5xl font-extrabold leading-tight" />
            <T c="admissions.formulaire.texte" as="p" className="block mt-5 text-lg text-white/80" />
          </div>
          <p className="relative mt-10 flex items-center gap-3 font-bold"><IconeWhatsApp className="h-8 w-8" />Réponse rapide sur WhatsApp</p>
        </div>
        <div className="p-8 md:p-14">
          <FormulaireWhatsApp entete="Demande de préinscription" bouton="Envoyer la préinscription" classeChamp={CHAMP} classeBouton={BOUTON}
            champs={[
              { nom: 'enfant', libelle: 'Nom et prénom de l\'enfant', requis: true },
              { nom: 'naissance', libelle: 'Date de naissance' },
              { nom: 'cycle', libelle: 'Cycle demandé', type: 'select', options: contenu.enseignement.cycles.map(c => c.nom), requis: true },
              { nom: 'classe', libelle: 'Classe demandée' },
              { nom: 'parent', libelle: 'Nom du parent', requis: true },
              { nom: 'telephone', libelle: 'Téléphone', type: 'tel', requis: true },
              { nom: 'message', libelle: 'Message (facultatif)', type: 'textarea' },
            ]} />
        </div>
      </div>
    </Section>
  );
}

export function FaqT() {
  return (
    <Section className="py-24">
      <Boite className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
        <div className="lg:sticky lg:top-32 self-start"><TitreT c="admissions.faq" /></div>
        <Liste c="admissions.faq.elements" nouveau={{ question: 'Nouvelle question ?', reponse: 'Réponse.' }} className="space-y-3" libelleAjout="Ajouter une question">
          {(_, __, ce) => <QuestionT ce={ce} />}
        </Liste>
      </Boite>
    </Section>
  );
}

function QuestionT({ ce }: { ce: string }) {
  const { edition } = useEdition();
  const [ouvert, setOuvert] = useState(false);
  const visible = ouvert || edition;
  return (
    <div className={`rounded-[1.75rem] transition-colors ${visible ? 'bg-white' : 'bg-white/50 hover:bg-white'}`}>
      <button type="button" onClick={() => setOuvert(o => !o)} className="w-full flex items-center gap-4 text-left p-6">
        <T c={`${ce}.question`} className="flex-1 titre text-xl font-extrabold" />
        <span className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${visible ? 'bg-[var(--c1)] text-white' : 'bg-[var(--encre)] text-white'}`}>{visible ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span>
      </button>
      {visible && <T c={`${ce}.reponse`} as="p" className="block px-6 pb-6 -mt-2 text-lg text-black/60" />}
    </div>
  );
}

/* ─────────── Actualités et contact ─────────── */

export function ListeActualitesT() {
  const { contenu, edition, majListe } = useEdition();
  const creer = () => {
    const a = nouvelleActualite(identifiant('nouvelle actualite', contenu.actualites.elements.map(x => x.id)));
    majListe('actualites.elements', l => [a, ...l]);
    location.hash = `#/actualites/${a.id}`;
  };
  return (
    <Section className="py-16">
      <Boite>
        {edition ? (
          <>
            <div className="flex justify-center mb-10"><button type="button" className="outil !text-sm !px-5 !py-3" onClick={creer}><Plus className="h-4 w-4" />Écrire une nouvelle actualité</button></div>
            <CartesActualites />
          </>
        ) : <MagazineActualites />}
      </Boite>
    </Section>
  );
}

export function CoordonneesT() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  const lignes = [
    { Icone: MapPin, titre: 'Adresse', valeur: id.adresse },
    { Icone: Phone, titre: 'Téléphone', valeur: id.telephone, lien: `tel:${id.telephone.replace(/\s/g, '')}` },
    { Icone: IconeWhatsApp, titre: 'WhatsApp', valeur: id.whatsapp, lien: lienWhatsApp(id.whatsapp, id.messageWhatsApp) },
    { Icone: Mail, titre: 'E-mail', valeur: id.email, lien: `mailto:${id.email}` },
    { Icone: Clock, titre: 'Horaires', valeur: id.horaires },
  ].filter(l => l.valeur);
  return (
    <Section className="py-16">
      <Boite className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-[2.5rem] bg-[var(--encre)] text-white p-8 md:p-12">
          <T c="contact.titre" as="h2" className="titre block text-4xl md:text-5xl font-extrabold" />
          <T c="contact.texte" as="p" className="block mt-4 text-white/60 text-lg" />
          <div className="mt-10 space-y-1">
            {lignes.map(({ Icone, titre, valeur, lien }) => {
              const contenuLigne = (
                <>
                  <span className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0"><Icone className="h-5 w-5 text-[var(--c2-clair)]" /></span>
                  <span><span className="block text-xs uppercase tracking-wider text-white/40 font-bold">{titre}</span><span className="block font-semibold">{valeur}</span></span>
                </>
              );
              return lien
                ? <a key={titre} href={lien} target={lien.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="flex items-center gap-4 rounded-2xl p-2 hover:bg-white/5">{contenuLigne}</a>
                : <div key={titre} className="flex items-center gap-4 p-2">{contenuLigne}</div>;
            })}
          </div>
        </div>
        <div className="rounded-[2.5rem] bg-white p-8 md:p-12">
          <FormulaireWhatsApp entete="Message depuis le site web" classeChamp={CHAMP} classeBouton={BOUTON}
            champs={[
              { nom: 'nom', libelle: 'Nom complet', requis: true },
              { nom: 'telephone', libelle: 'Téléphone', type: 'tel', requis: true },
              { nom: 'objet', libelle: 'Objet', type: 'select', options: ['Inscription', 'Renseignements', 'Paiement', 'Autre'] },
              { nom: 'message', libelle: 'Message', type: 'textarea', requis: true },
            ]} />
        </div>
        <div className="lg:col-span-2 rounded-[2.5rem] overflow-hidden h-[420px] bg-white">
          <iframe title="Plan d'accès" src={lienCarte(id.adresse)} className="w-full h-full border-0 grayscale-[30%]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </Boite>
    </Section>
  );
}
