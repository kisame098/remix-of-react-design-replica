import { Clock, Mail, MapPin, MessageCircleMore, Phone } from 'lucide-react';
import { Section, T, useEdition } from '../edition';
import { Conteneur, FormulaireWhatsApp } from '../composants';
import { lienCarte, lienWhatsApp } from '../utilitaires';

export function Coordonnees() {
  const { contenu } = useEdition();
  const id = contenu.identite;
  const cartes = [
    { Icone: MapPin, titre: 'Adresse', lignes: [id.adresse] },
    { Icone: Phone, titre: 'Téléphone', lignes: [id.telephone], lien: `tel:${id.telephone.replace(/\s/g, '')}` },
    { Icone: MessageCircleMore, titre: 'WhatsApp', lignes: [id.whatsapp], lien: lienWhatsApp(id.whatsapp, id.messageWhatsApp), externe: true },
    { Icone: Mail, titre: 'E-mail', lignes: [id.email], lien: `mailto:${id.email}` },
    { Icone: Clock, titre: 'Horaires', lignes: id.horaires.split('·').map(s => s.trim()) },
  ].filter(c => c.lignes.some(Boolean));

  return (
    <Section className="py-24">
      <Conteneur>
        <div className="flex flex-wrap justify-center gap-6 mb-16">
          {cartes.map(({ Icone, titre, lignes, lien, externe }) => (
            <a key={titre} href={lien} {...(externe ? { target: '_blank', rel: 'noreferrer' } : {})}
              className="w-full sm:w-[calc((100%_-_1.5rem)/2)] lg:w-[calc((100%_-_6rem)/5)] bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow text-center">
              <span className="mx-auto h-14 w-14 rounded-full bg-[var(--c1)] text-white flex items-center justify-center ring-4 ring-[var(--c2-30)]"><Icone className="h-6 w-6" /></span>
              <p className="titre font-bold text-lg text-gray-900 mt-4">{titre}</p>
              {lignes.map(l => <p key={l} className="text-gray-600 text-sm mt-1 break-words">{l}</p>)}
            </a>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-stretch">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 md:p-10">
            <T c="contact.titre" as="h2" className="titre block text-3xl font-bold text-[var(--c1)]" />
            <T c="contact.texte" as="p" className="block text-gray-600 mt-3 mb-8" />
            <FormulaireWhatsApp
              entete="Message depuis le site web"
              champs={[
                { nom: 'nom', libelle: 'Nom complet', requis: true },
                { nom: 'telephone', libelle: 'Téléphone', type: 'tel', requis: true },
                { nom: 'objet', libelle: 'Objet', type: 'select', options: ['Inscription', 'Renseignements', 'Paiement', 'Autre'] },
                { nom: 'message', libelle: 'Message', type: 'textarea', requis: true },
              ]}
            />
          </div>
          <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-100 min-h-[420px]">
            <iframe title="Plan d'accès" src={lienCarte(id.adresse)} className="w-full h-full min-h-[420px] border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </div>
      </Conteneur>
    </Section>
  );
}
