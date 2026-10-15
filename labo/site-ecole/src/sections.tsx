import { useState, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, CornerUpRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PAGES_INTERNES, useEdition } from './edition';
import { ajouterElement, deplacerElement, retirerElement } from './chemin';
import { EntetePage } from './Gabarit';
import { Appel, CartesCycles, GrilleIcones, Resultats, SuivezNous, Temoignages } from './composants';
import { ActualitesRecentes, Chiffres, Diaporama, MotDuDirecteur } from './pages/Accueil';
import { Equipe, Histoire, Infrastructures } from './pages/Ecole';
import { CyclesDetail } from './pages/Enseignement';
import { Activites, Calendrier, Galerie } from './pages/VieScolaire';
import { Etapes, Faq, Frais, Pieces, Preinscription } from './pages/Admissions';
import { ListeActualites } from './pages/Actualites';
import { Coordonnees } from './pages/Contact';

/**
 * Catalogue de toutes les sections du site. Une section n'appartient à
 * aucune page en particulier : chaque page liste les siennes (contenu.pages),
 * et l'école peut en glisser, retirer, ajouter ou envoyer vers une autre page.
 */
export const SECTIONS: Record<string, { nom: string; groupe: string; Composant: () => ReactNode }> = {
  diaporama: { nom: 'Diaporama', groupe: 'Accueil', Composant: Diaporama },
  chiffres: { nom: 'Chiffres clés', groupe: 'Accueil', Composant: Chiffres },
  'mot-directeur': { nom: 'Mot du directeur', groupe: 'Accueil', Composant: MotDuDirecteur },
  cycles: { nom: 'Nos cycles (cartes)', groupe: 'Accueil', Composant: CartesCycles },
  atouts: { nom: 'Pourquoi nous choisir', groupe: 'Accueil', Composant: () => <GrilleIcones c="accueil.atouts" /> },
  resultats: { nom: 'Résultats aux examens', groupe: 'Accueil', Composant: Resultats },
  temoignages: { nom: 'Témoignages', groupe: 'Accueil', Composant: Temoignages },
  'actualites-recentes': { nom: 'Dernières actualités', groupe: 'Accueil', Composant: ActualitesRecentes },
  'suivez-nous': { nom: 'Suivez-nous (réseaux, Facebook)', groupe: 'Accueil', Composant: SuivezNous },
  appel: { nom: 'Appel à l\'inscription', groupe: 'Accueil', Composant: Appel },

  'entete-ecole': { nom: 'Bandeau « Notre école »', groupe: 'Notre école', Composant: () => <EntetePage c="ecole.entete" /> },
  histoire: { nom: 'Notre histoire', groupe: 'Notre école', Composant: Histoire },
  valeurs: { nom: 'Nos valeurs', groupe: 'Notre école', Composant: () => <GrilleIcones c="ecole.valeurs" fond /> },
  equipe: { nom: 'Équipe de direction', groupe: 'Notre école', Composant: Equipe },
  infrastructures: { nom: 'Infrastructures', groupe: 'Notre école', Composant: Infrastructures },

  'entete-enseignement': { nom: 'Bandeau « Enseignement »', groupe: 'Enseignement', Composant: () => <EntetePage c="enseignement.entete" /> },
  'cycles-detail': { nom: 'Les cycles en détail', groupe: 'Enseignement', Composant: CyclesDetail },
  pedagogie: { nom: 'Notre pédagogie', groupe: 'Enseignement', Composant: () => <GrilleIcones c="enseignement.pedagogie" fond /> },

  'entete-vie-scolaire': { nom: 'Bandeau « Vie scolaire »', groupe: 'Vie scolaire', Composant: () => <EntetePage c="vieScolaire.entete" /> },
  activites: { nom: 'Activités', groupe: 'Vie scolaire', Composant: Activites },
  services: { nom: 'Services (cantine, transport…)', groupe: 'Vie scolaire', Composant: () => <GrilleIcones c="vieScolaire.services" fond /> },
  galerie: { nom: 'Galerie photos', groupe: 'Vie scolaire', Composant: Galerie },
  calendrier: { nom: 'Calendrier', groupe: 'Vie scolaire', Composant: Calendrier },

  'entete-admissions': { nom: 'Bandeau « Admissions »', groupe: 'Admissions', Composant: () => <EntetePage c="admissions.entete" /> },
  etapes: { nom: 'Étapes d\'inscription', groupe: 'Admissions', Composant: Etapes },
  pieces: { nom: 'Pièces et moyens de paiement', groupe: 'Admissions', Composant: Pieces },
  frais: { nom: 'Frais de scolarité', groupe: 'Admissions', Composant: Frais },
  preinscription: { nom: 'Préinscription en ligne', groupe: 'Admissions', Composant: Preinscription },
  faq: { nom: 'Questions fréquentes', groupe: 'Admissions', Composant: Faq },

  'entete-actualites': { nom: 'Bandeau « Actualités »', groupe: 'Actualités', Composant: () => <EntetePage c="actualites.entete" /> },
  'liste-actualites': { nom: 'Toutes les actualités', groupe: 'Actualités', Composant: ListeActualites },

  'entete-contact': { nom: 'Bandeau « Contact »', groupe: 'Contact', Composant: () => <EntetePage c="contact.entete" /> },
  coordonnees: { nom: 'Coordonnées, formulaire et plan', groupe: 'Contact', Composant: Coordonnees },
};

const cleDePage = (page: string) => page || 'accueil';
const nomDePage = (cle: string) => PAGES_INTERNES.find(p => p.lien === (cle === 'accueil' ? '#/' : `#/${cle}`))?.nom ?? cle;

/** Les sections d'une page, dans l'ordre choisi par l'école. */
export function PageSections({ page }: { page: string }) {
  const { contenu, edition, maj } = useEdition();
  const cle = cleDePage(page);
  const ids = (contenu.pages[cle] ?? []).filter(id => SECTIONS[id]);
  const [ajout, setAjout] = useState<number | null>(null);
  const capteurs = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!edition) return <>{ids.map(id => { const { Composant } = SECTIONS[id]; return <Composant key={id} />; })}</>;

  const changer = (liste: string[]) => maj(`pages.${cle}`, liste);
  const finGlisse = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) changer(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };
  const envoyer = (id: string, vers: string) => {
    changer(ids.filter(x => x !== id));
    const cible = (contenu.pages[vers] ?? []).filter(x => x !== id);
    maj(`pages.${vers}`, [...cible, id]);
  };

  return (
    <>
      <DndContext sensors={capteurs} collisionDetection={closestCenter} onDragEnd={finGlisse}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id, i) => (
            <SectionTriable key={id} id={id} nom={SECTIONS[id].nom} premier={i === 0} dernier={i === ids.length - 1} pageCourante={cle}
              onDeplacer={sens => changer(deplacerElement(ids, i, sens))}
              onRetirer={() => changer(retirerElement(ids, i))}
              onEnvoyer={vers => envoyer(id, vers)}
              onAjouterDessous={() => setAjout(i)}>
              {(() => { const { Composant } = SECTIONS[id]; return <Composant />; })()}
            </SectionTriable>
          ))}
        </SortableContext>
      </DndContext>

      <div className="py-10 flex justify-center bg-gray-50 border-t border-dashed border-gray-300">
        <button type="button" className="outil !text-sm !px-5 !py-3" onClick={() => setAjout(ids.length - 1)}>
          <Plus className="h-4 w-4" />Ajouter une section à cette page
        </button>
      </div>

      <CatalogueSections ouvert={ajout !== null} dejaLa={ids} onFermer={() => setAjout(null)}
        onChoisir={id => { changer(ajouterElement(ids, id, ajout ?? ids.length - 1)); setAjout(null); }} />
    </>
  );
}

function SectionTriable({ id, nom, premier, dernier, pageCourante, onDeplacer, onRetirer, onEnvoyer, onAjouterDessous, children }: {
  id: string; nom: string; premier: boolean; dernier: boolean; pageCourante: string;
  onDeplacer: (sens: -1 | 1) => void; onRetirer: () => void; onEnvoyer: (page: string) => void; onAjouterDessous: () => void; children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative group/sec ${isDragging ? 'z-40 opacity-90 shadow-2xl ring-4 ring-amber-400' : 'hover:outline hover:outline-2 hover:outline-amber-400/70 hover:-outline-offset-2'}`}>
      {/* Collée sous l'en-tête pendant qu'on fait défiler une longue section. */}
      <div className="sticky top-[124px] z-[35] h-0">
      <div className={`absolute top-0 left-3 ${isDragging ? 'flex' : 'hidden group-hover/sec:flex'} items-center gap-0.5 rounded-xl bg-white text-gray-900 border border-gray-200 shadow-lg p-1 font-sans text-xs`}>
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-semibold cursor-grab active:cursor-grabbing" title="Glisser pour déplacer la section">
          <GripVertical className="h-4 w-4" />{nom}
        </button>
        <Outil titre="Monter" disabled={premier} onClick={() => onDeplacer(-1)}><ArrowUp /></Outil>
        <Outil titre="Descendre" disabled={dernier} onClick={() => onDeplacer(1)}><ArrowDown /></Outil>
        <Outil titre="Ajouter une section en dessous" onClick={onAjouterDessous}><Plus /></Outil>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Envoyer vers une autre page" className="p-1.5 rounded-lg hover:bg-gray-100 [&>svg]:h-4 [&>svg]:w-4"><CornerUpRight /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="font-sans">
            <DropdownMenuLabel>Envoyer vers la page…</DropdownMenuLabel>
            {PAGES_INTERNES.map(p => {
              const cle = p.lien === '#/' ? 'accueil' : p.lien.slice(2);
              return cle === pageCourante ? null : <DropdownMenuItem key={cle} onClick={() => onEnvoyer(cle)}>{p.nom}</DropdownMenuItem>;
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Outil titre="Retirer de la page" onClick={onRetirer}><Trash2 className="text-red-600" /></Outil>
      </div>
      </div>
      {children}
    </div>
  );
}

function Outil({ titre, onClick, disabled, children }: { titre: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={titre} aria-label={titre} disabled={disabled} onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 [&>svg]:h-4 [&>svg]:w-4">{children}</button>
  );
}

/** Fenêtre « Ajouter une section » : tout le catalogue, rangé par page d'origine. */
function CatalogueSections({ ouvert, dejaLa, onFermer, onChoisir }: { ouvert: boolean; dejaLa: string[]; onFermer: () => void; onChoisir: (id: string) => void }) {
  const { contenu } = useEdition();
  const groupes = [...new Set(Object.values(SECTIONS).map(s => s.groupe))];
  const ou = (id: string) => Object.entries(contenu.pages).filter(([, l]) => l.includes(id)).map(([p]) => nomDePage(p));
  return (
    <Dialog open={ouvert} onOpenChange={o => !o && onFermer()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto font-sans">
        <DialogHeader>
          <DialogTitle>Ajouter une section</DialogTitle>
          <DialogDescription>Toutes les sections du site peuvent aller sur n'importe quelle page. Une section garde son contenu partout où elle apparaît.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {groupes.map(g => (
            <div key={g}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{g}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {Object.entries(SECTIONS).filter(([, s]) => s.groupe === g).map(([id, s]) => {
                  const present = dejaLa.includes(id);
                  const pages = ou(id);
                  return (
                    <Button key={id} variant="outline" disabled={present} onClick={() => onChoisir(id)} className="h-auto justify-start text-left py-2.5 px-3 flex-col items-start gap-0.5">
                      <span className="font-medium">{s.nom}</span>
                      <span className="text-xs text-muted-foreground font-normal">{present ? 'Déjà sur cette page' : pages.length ? `Aussi sur : ${pages.join(', ')}` : 'Sur aucune page'}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
