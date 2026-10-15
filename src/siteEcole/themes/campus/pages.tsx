import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FileText, GraduationCap, Mail, MapPin, Minus, Phone, Plus, Wallet, X } from 'lucide-react';
import { Img, Liste, Section, T, useEdition } from '../../edition';
import { CartesActualites, FormulaireWhatsApp, NOUVEAU_CYCLE, nouvelleActualite } from '../../composants';
import { IconeWhatsApp } from '../../reseaux';
import { identifiant, lienCarte, lienWhatsApp } from '../../utilitaires';
import { Revele } from '../prestige/GabaritPrestige';
import { CartesActualitesC } from './accueil';
import { Boite, Cadre, Sourcil, TitreC } from './GabaritCampus';

const CHAMP = 'w-full h-12 rounded-xl bg-white/[0.07] border border-white/15 px-4 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--c2)] focus:bg-white/10 transition-colors [&>option]:text-black';
const BOUTON = 'w-full inline-flex items-center justify-center gap-2 h-[52px] rounded-xl bg-[var(--c2)] text-[var(--encre)] font-semibold hover:bg-white transition-colors duration-300';
const CHAMP_CLAIR = 'w-full h-12 rounded-xl bg-[var(--fond)] border border-transparent px-4 focus:outline-none focus:border-[var(--c1)] focus:bg-white transition-colors';
const BOUTON_BLEU = 'inline-flex items-center gap-2 h-[52px] px-8 rounded-full bg-[var(--c1)] text-white font-semibold hover:bg-[var(--c2)] hover:text-[var(--encre)] transition-colors duration-300';

/* ─────────── Notre école ─────────── */

export function HistoireC() {
  return (
    <Section className="py-24 md:py-28">
      <Boite className="grid lg:grid-cols-2 gap-14 items-center">
        <div className="relative">
          <Revele><Cadre c="ecole.histoire.image" className="group h-[420px] md:h-[480px]" /></Revele>
          <Revele delai={200} className="absolute -bottom-8 -right-4 md:right-8 rounded-2xl bg-[var(--c2)] text-[var(--encre)] px-7 py-5 shadow-xl">
            <p className="text-sm font-semibold">Fondée en</p>
            <T c="identite.creation" as="p" className="titre block text-4xl font-extrabold leading-none mt-1" />
          </Revele>
        </div>
        <div>
          <TitreC c="ecole.histoire" texte={false} />
          <T c="ecole.histoire.texte" as="div" className="block mt-6 text-[17px] text-[#5b6472] leading-relaxed" />
        </div>
      </Boite>
    </Section>
  );
}

export function InfrastructuresC() {
  return (
    <Section className="py-24 bg-white">
      <Boite>
        <TitreC c="ecole.infrastructures" centre className="mb-14" texte={false} />
        <Liste c="ecole.infrastructures.elements" colonnes={4} nouveau={{ image: '', titre: 'Espace', texte: 'Description.' }}>
          {(_, i, ce) => (
            <Revele delai={(i % 4) * 90} className="group">
              <Cadre c={`${ce}.image`} className="group h-64" rayon="rounded-[24px]" />
              <T c={`${ce}.titre`} as="h3" className="titre block text-xl font-bold mt-5" />
              <T c={`${ce}.texte`} as="p" className="block text-[#5b6472] mt-1" />
            </Revele>
          )}
        </Liste>
      </Boite>
    </Section>
  );
}

/* ─────────── Enseignement : un menu des cycles, un panneau ─────────── */

export function CyclesDetailC() {
  const { contenu, edition } = useEdition();
  const cycles = contenu.enseignement.cycles;
  const [i, setI] = useState(0);
  const k = Math.min(i, Math.max(cycles.length - 1, 0));
  const ce = `enseignement.cycles.${k}`;
  return (
    <Section className="py-24">
      <Boite className="grid lg:grid-cols-[300px_1fr] gap-8 items-start">
        <div className="lg:sticky lg:top-28 bg-white rounded-[20px] p-3 shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)]">
          <Liste c="enseignement.cycles" nouveau={NOUVEAU_CYCLE} className="space-y-1" libelleAjout="Ajouter un cycle">
            {(cy, j) => (
              <button type="button" onClick={() => setI(j)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-4 text-left transition-colors ${j === k ? 'bg-[var(--c1)] text-white' : 'hover:bg-[var(--fond)]'}`}>
                <span className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${j === k ? 'bg-[var(--c2)] text-[var(--encre)]' : 'bg-[var(--fond)] text-[var(--c1)]'}`}><GraduationCap className="h-5 w-5" /></span>
                <span className="min-w-0"><span className="block titre font-bold text-lg">{cy.nom}</span><span className={`block text-xs truncate ${j === k ? 'text-white/70' : 'text-[#5b6472]'}`}>{cy.age}</span></span>
              </button>
            )}
          </Liste>
        </div>
        {cycles[k] && (
          <div key={k} className="apparition bg-white rounded-[24px] p-3 shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)]">
            <div className="relative h-72 md:h-96 rounded-[18px] overflow-hidden">
              <Img c={`${ce}.image`} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1A33]/80 to-transparent pointer-events-none" />
              <div className="absolute left-6 bottom-6 right-6 text-white">
                <T c={`${ce}.age`} className="inline-block rounded-full bg-[var(--c2)] text-[var(--encre)] px-4 py-1.5 text-sm font-semibold" />
                <T c={`${ce}.nom`} as="h2" className="titre block text-4xl md:text-5xl font-bold mt-3" />
              </div>
            </div>
            <div className="p-5 md:p-8">
              <T c={`${ce}.niveaux`} as="p" className="block titre text-xl font-semibold text-[var(--c1)]" />
              <T c={`${ce}.texte`} as="p" className="block mt-4 text-[17px] text-[#5b6472] leading-relaxed" />
              <Liste c={`${ce}.points`} nouveau="Nouveau point" className="mt-7 grid sm:grid-cols-2 gap-3" libelleAjout="Ajouter un point">
                {(__, ___, cp) => (
                  <p className="flex items-center gap-3 rounded-xl bg-[var(--fond)] px-4 py-3.5 font-semibold">
                    <CheckCircle2 className="h-5 w-5 text-[var(--c1)] flex-shrink-0" /><T c={cp} />
                  </p>
                )}
              </Liste>
              {edition && <p className="mt-5 text-sm text-[#8a93a1]">Choisissez un cycle à gauche pour le modifier ; glissez-les pour changer l'ordre.</p>}
            </div>
          </div>
        )}
      </Boite>
    </Section>
  );
}

/* ─────────── Vie scolaire ─────────── */

export function GalerieC() {
  const { contenu, edition } = useEdition();
  const [ouverte, setOuverte] = useState<number | null>(null);
  const images = contenu.vieScolaire.galerie.elements;
  return (
    <Section className="py-24 bg-white">
      <Boite>
        <TitreC c="vieScolaire.galerie" centre className="mb-14" texte={false} />
        <Liste c="vieScolaire.galerie.elements" colonnes={4} nouveau={{ image: '' }} libelleAjout="Ajouter une photo">
          {(_, i, ce) => (
            <div role="button" tabIndex={0} onClick={() => !edition && setOuverte(i)} onKeyDown={e => e.key === 'Enter' && !edition && setOuverte(i)} className="group block w-full cursor-pointer">
              <Cadre c={`${ce}.image`} className="h-60" rayon="rounded-[24px]" />
            </div>
          )}
        </Liste>
      </Boite>
      {ouverte !== null && images[ouverte] && (
        <div className="fixed inset-0 z-[70] bg-[#0A1A33]/95 backdrop-blur flex items-center justify-center p-4" onClick={() => setOuverte(null)}>
          <button type="button" aria-label="Fermer" className="absolute top-5 right-5 h-12 w-12 rounded-full bg-[var(--c2)] text-[var(--encre)] flex items-center justify-center"><X /></button>
          <button type="button" aria-label="Précédente" onClick={e => { e.stopPropagation(); setOuverte((ouverte - 1 + images.length) % images.length); }} className="absolute left-4 h-12 w-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-[var(--c2)] hover:text-[var(--encre)]"><ArrowLeft /></button>
          <img src={images[ouverte].image} alt="" className="max-h-[85vh] max-w-[85vw] rounded-2xl" onClick={e => e.stopPropagation()} />
          <button type="button" aria-label="Suivante" onClick={e => { e.stopPropagation(); setOuverte((ouverte + 1) % images.length); }} className="absolute right-4 h-12 w-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-[var(--c2)] hover:text-[var(--encre)]"><ArrowRight /></button>
        </div>
      )}
    </Section>
  );
}

export function CalendrierC() {
  return (
    <Section className="py-24">
      <Boite className="max-w-4xl">
        <TitreC c="vieScolaire.calendrier" centre className="mb-14" texte={false} />
        <div className="relative">
          <span className="absolute left-[27px] top-2 bottom-2 w-0.5 bg-[var(--c1-15)]" />
          <Liste c="vieScolaire.calendrier.elements" nouveau={{ date: 'Mois', evenement: 'Événement' }} className="space-y-5" libelleAjout="Ajouter une date">
            {(_, i, ce) => (
              <Revele delai={i * 80} className="relative flex gap-6 items-center">
                <span className="relative z-10 h-14 w-14 rounded-full bg-[var(--c1)] text-[var(--c2)] ring-[6px] ring-[var(--fond)] flex items-center justify-center flex-shrink-0"><Clock className="h-6 w-6" /></span>
                <div className="flex-1 bg-white rounded-2xl px-6 py-5 shadow-[0_10px_40px_-24px_rgba(11,58,102,0.4)] flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                  <T c={`${ce}.date`} className="titre font-bold text-lg text-[var(--c1)] sm:w-40 flex-shrink-0" />
                  <T c={`${ce}.evenement`} className="text-[#3c4656]" />
                </div>
              </Revele>
            )}
          </Liste>
        </div>
      </Boite>
    </Section>
  );
}

/* ─────────── Admissions ─────────── */

export function EtapesC() {
  return (
    <Section className="py-24">
      <Boite>
        <TitreC c="admissions.etapes" centre className="mb-16" texte={false} />
        <div className="relative">
          <span className="hidden lg:block absolute left-[12%] right-[12%] top-10 border-t-2 border-dashed border-[var(--c1-40)]" />
          <Liste c="admissions.etapes.elements" colonnes={4} nouveau={{ titre: 'Étape', texte: 'Description.' }}>
            {(_, i, ce) => (
              <Revele delai={i * 120} className="relative text-center group">
                <span className="relative z-10 mx-auto h-20 w-20 rounded-full bg-white text-[var(--c1)] ring-8 ring-[var(--fond)] shadow-[0_10px_30px_-10px_rgba(11,58,102,0.4)] flex items-center justify-center titre text-3xl font-extrabold group-hover:bg-[var(--c1)] group-hover:text-[var(--c2)] transition-colors duration-500">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <T c={`${ce}.titre`} as="h3" className="titre block text-xl font-bold mt-6" />
                <T c={`${ce}.texte`} as="p" className="block text-[#5b6472] mt-2 leading-relaxed" />
              </Revele>
            )}
          </Liste>
        </div>
      </Boite>
    </Section>
  );
}

export function PiecesC() {
  return (
    <Section className="pb-24">
      <Boite className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="bg-white rounded-[24px] p-8 md:p-10 shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)]">
          <p className="flex items-center gap-3"><span className="h-12 w-12 rounded-xl bg-[var(--c1)] text-[var(--c2)] flex items-center justify-center"><FileText className="h-6 w-6" /></span><T c="admissions.pieces.titre" className="titre text-2xl font-bold" /></p>
          <Liste c="admissions.pieces.elements" nouveau="Nouvelle pièce" className="mt-7 grid sm:grid-cols-2 gap-3">
            {(_, __, ce) => <p className="flex items-start gap-3 rounded-xl bg-[var(--fond)] px-4 py-3.5"><CheckCircle2 className="h-5 w-5 text-[var(--c1)] flex-shrink-0 mt-0.5" /><T c={ce} /></p>}
          </Liste>
        </div>
        <div className="relative bg-[var(--c1)] text-white rounded-[24px] p-8 md:p-10 overflow-hidden">
          <span className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full border-[24px] border-white/5" />
          <p className="flex items-center gap-3"><span className="h-12 w-12 rounded-xl bg-[var(--c2)] text-[var(--encre)] flex items-center justify-center"><Wallet className="h-6 w-6" /></span><T c="admissions.paiement.titre" className="titre text-2xl font-bold" /></p>
          <Liste c="admissions.paiement.elements" nouveau="Moyen de paiement" className="mt-7 space-y-3">
            {(_, __, ce) => <p className="flex items-center gap-3 rounded-xl bg-white/[0.07] border border-white/10 px-4 py-3.5 font-semibold"><span className="h-2 w-2 rounded-full bg-[var(--c2)]" /><T c={ce} /></p>}
          </Liste>
        </div>
      </Boite>
    </Section>
  );
}

export function FraisC() {
  return (
    <Section className="py-24 bg-white">
      <Boite className="max-w-5xl">
        <TitreC c="admissions.frais" centre className="mb-12" />
        <div className="rounded-[24px] overflow-hidden border border-black/5 shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)]">
          <div className="grid grid-cols-3 bg-[var(--c1)] text-white titre font-semibold">
            <span className="px-6 py-5">Cycle</span><span className="px-6 py-5 text-right">Inscription</span><span className="px-6 py-5 text-right">Mensualité</span>
          </div>
          <Liste c="admissions.frais.elements" nouveau={{ niveau: 'Niveau', inscription: '0 F', mensualite: '0 F' }} className="divide-y divide-black/5 bg-white" libelleAjout="Ajouter un tarif">
            {(_, i, ce) => (
              <div className={`grid grid-cols-3 items-center hover:bg-[var(--fond)] transition-colors ${i % 2 ? 'bg-[var(--fond)]/50' : ''}`}>
                <span className="px-6 py-5 flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-[var(--c2)]" /><T c={`${ce}.niveau`} className="titre font-bold text-lg" /></span>
                <T c={`${ce}.inscription`} className="px-6 py-5 text-right text-[#5b6472]" />
                <T c={`${ce}.mensualite`} className="px-6 py-5 text-right titre font-bold text-lg text-[var(--c1)]" />
              </div>
            )}
          </Liste>
        </div>
        <T c="admissions.frais.note" as="p" className="block mt-6 text-center text-[#5b6472]" />
      </Boite>
    </Section>
  );
}

/** Admission : le formulaire dans une carte bleue bordée de jaune, posée sur une photo. */
export function AdmissionC() {
  const { contenu } = useEdition();
  return (
    <Section className="py-24">
      <Boite>
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="lg:pt-6">
            <Sourcil c="admissions.etapes.surtitre" />
            <T c="admissions.formulaire.titre" as="h2" className="titre block text-4xl md:text-5xl font-bold mt-4 leading-[1.15]" />
            <T c="admissions.formulaire.texte" as="p" className="block mt-5 text-[17px] text-[#5b6472]" />
          </div>
        </div>
        <div className="relative mt-10 lg:-mt-6">
          <div className="absolute inset-x-0 bottom-0 top-24 lg:top-32 rounded-[28px] overflow-hidden">
            <Img c="admissions.entete.image" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-[#0A1A33]/25" />
          </div>
          <div className="relative grid lg:grid-cols-2 gap-6 pb-10 lg:pb-14 px-4 lg:px-10">
            <div className="hidden lg:block" />
            <Revele className="bg-[var(--c1)] text-white rounded-[22px] border-t-[6px] border-[var(--c2)] p-7 md:p-10 shadow-2xl">
              <p className="flex items-center gap-3 titre text-2xl font-bold"><GraduationCap className="h-7 w-7 text-[var(--c2)]" />Formulaire de préinscription</p>
              <div className="mt-7 [&_label>span]:text-white/70 [&_label>span]:text-[13px]">
                <FormulaireWhatsApp entete="Demande de préinscription" bouton="Envoyer la préinscription" classeChamp={CHAMP} classeBouton={BOUTON}
                  champs={[
                    { nom: 'enfant', libelle: 'Nom et prénom de l\'enfant', requis: true },
                    { nom: 'naissance', libelle: 'Date de naissance' },
                    { nom: 'cycle', libelle: 'Cycle', type: 'select', options: contenu.enseignement.cycles.map(c => c.nom), requis: true },
                    { nom: 'classe', libelle: 'Classe demandée' },
                    { nom: 'parent', libelle: 'Nom du parent', requis: true },
                    { nom: 'telephone', libelle: 'Téléphone', type: 'tel', requis: true },
                    { nom: 'message', libelle: 'Message', type: 'textarea' },
                  ]} />
              </div>
            </Revele>
          </div>
        </div>
      </Boite>
    </Section>
  );
}

export function FaqC() {
  return (
    <Section className="py-24">
      <Boite className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-start">
        <div className="lg:sticky lg:top-28"><TitreC c="admissions.faq" texte={false} /></div>
        <Liste c="admissions.faq.elements" nouveau={{ question: 'Question ?', reponse: 'Réponse.' }} className="space-y-4" libelleAjout="Ajouter une question">
          {(_, __, ce) => <QuestionC ce={ce} />}
        </Liste>
      </Boite>
    </Section>
  );
}

function QuestionC({ ce }: { ce: string }) {
  const { edition } = useEdition();
  const [ouvert, setOuvert] = useState(false);
  const visible = ouvert || edition;
  return (
    <div className={`rounded-2xl transition-all duration-500 ${visible ? 'bg-[var(--c1)] text-white shadow-xl' : 'bg-white shadow-[0_10px_40px_-24px_rgba(11,58,102,0.4)]'}`}>
      <button type="button" onClick={() => setOuvert(o => !o)} className="w-full flex items-center gap-4 text-left px-6 py-5">
        <T c={`${ce}.question`} className="flex-1 titre font-bold text-lg" />
        <span className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${visible ? 'bg-[var(--c2)] text-[var(--encre)]' : 'bg-[var(--fond)] text-[var(--c1)]'}`}>{visible ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-500 ${visible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden"><T c={`${ce}.reponse`} as="p" className="block px-6 pb-6 text-white/80 leading-relaxed" /></div>
      </div>
    </div>
  );
}

/* ─────────── Actualités et contact ─────────── */

export function ListeActualitesC() {
  const { contenu, edition, majListe } = useEdition();
  const creer = () => {
    const a = nouvelleActualite(identifiant('nouvelle actualite', contenu.actualites.elements.map(x => x.id)));
    majListe('actualites.elements', l => [a, ...l]);
    location.hash = `#/actualites/${a.id}`;
  };
  return (
    <Section className="py-20">
      <Boite>
        {edition ? (
          <>
            <div className="flex justify-center mb-10"><button type="button" className="outil !text-sm !px-5 !py-3" onClick={creer}><Plus className="h-4 w-4" />Écrire une nouvelle actualité</button></div>
            <CartesActualites />
          </>
        ) : <CartesActualitesC />}
      </Boite>
    </Section>
  );
}

export function ContactC() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  const cartes = [
    { Icone: MapPin, titre: 'Adresse', valeur: id.adresse },
    { Icone: Phone, titre: 'Téléphone', valeur: id.telephone, lien: `tel:${id.telephone.replace(/\s/g, '')}` },
    { Icone: IconeWhatsApp, titre: 'WhatsApp', valeur: id.whatsapp, lien: lienWhatsApp(id.whatsapp, id.messageWhatsApp) },
    { Icone: Mail, titre: 'E-mail', valeur: id.email, lien: `mailto:${id.email}` },
  ].filter(c => c.valeur);
  return (
    <Section className="py-24">
      <Boite>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {cartes.map(({ Icone, titre, valeur, lien }, i) => (
            <Revele key={titre} delai={i * 90}>
              <a href={lien} target={lien?.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                className="group h-full flex flex-col items-center text-center bg-white rounded-[20px] p-7 shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)] hover:-translate-y-1 transition-transform">
                <span className="h-16 w-16 rounded-2xl bg-[var(--c1)] text-[var(--c2)] flex items-center justify-center group-hover:rotate-6 transition-transform"><Icone className="h-7 w-7" /></span>
                <p className="titre font-bold text-lg mt-5">{titre}</p>
                <p className="text-[#5b6472] mt-1 break-words">{valeur}</p>
              </a>
            </Revele>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-[24px] p-8 md:p-10 shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)]">
            <T c="contact.titre" as="h2" className="titre block text-3xl md:text-4xl font-bold" />
            <T c="contact.texte" as="p" className="block mt-3 mb-7 text-[#5b6472]" />
            <FormulaireWhatsApp entete="Message depuis le site web" classeChamp={CHAMP_CLAIR} classeBouton={BOUTON_BLEU}
              champs={[
                { nom: 'nom', libelle: 'Nom complet', requis: true },
                { nom: 'telephone', libelle: 'Téléphone', type: 'tel', requis: true },
                { nom: 'objet', libelle: 'Objet', type: 'select', options: ['Inscription', 'Renseignements', 'Paiement', 'Autre'] },
                { nom: 'message', libelle: 'Message', type: 'textarea', requis: true },
              ]} />
          </div>
          <div className="rounded-[24px] bg-white p-2 shadow-[0_10px_40px_-20px_rgba(11,58,102,0.35)] min-h-[460px]">
            <iframe title="Plan d'accès" src={lienCarte(id.adresse)} className="w-full h-full min-h-[440px] rounded-[18px] border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </div>
      </Boite>
    </Section>
  );
}
