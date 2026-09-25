import { useEffect, useMemo, useRef, useState } from 'react';
import { useExamens } from '@/contexts/ExamensContext';
import type { Student } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Loader2, Trash2, Search, ArrowUpDown, ClipboardList } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type Examen, type ExamenEpreuve, type ExamenNote, type ExamenTour, type NiveauMatiere,
  analyserSaisieNoteExamen, texteDeLaNote, etatCandidat, triEpreuves,
  nomEpreuveValide, baremeValide, coefficientValide, seuilEliminatoireValide, nomTourValide, seuilAdmissionValide,
} from '@/lib/formationPro';
import { cleCase, type SauvegardeNotes } from './useSauvegardeNotes';

const format = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');
const couleurNote = (m: number | null, seuil: number) => m === null ? 'text-muted-foreground' : m >= seuil ? 'text-green-600' : 'text-red-500';

type Tri = 'defaut' | 'nom' | 'note';

interface Props {
  examen: Examen;
  /** Tous les tours de l'examen (pour y ranger une nouvelle épreuve). */
  tours: ExamenTour[];
  /** Les épreuves affichées : celles de la matière choisie (ou celles sans matière). */
  epreuves: ExamenEpreuve[];
  /** La matière choisie dans la colonne de gauche — `null` pour les épreuves hors programme. */
  matiere: NiveauMatiere | null;
  matieres: NiveauMatiere[];
  candidats: Student[];
  sauvegarde: SauvegardeNotes;
  estDirecteur: boolean;
}

/**
 * La saisie d'UNE matière d'un examen — comme une matière dans Évaluations :
 * une ligne par candidat, ses épreuves en colonnes (rangées par tour : Écrit,
 * Pratique, Oral…) et la note de la matière sur 20. Moyenne générale,
 * décision et mention sont sur l'écran « Résultats » (ResultatsExamen).
 */
export const GrilleExamen = ({ examen, tours, epreuves, matiere, matieres, candidats, sauvegarde, estDirecteur }: Props) => {
  const { notes, epreuves: toutesLesEpreuves } = useExamens();
  const { brouillons, modifierCase } = sauvegarde;
  const verrouille = examen.verrouille;
  const modifiable = estDirecteur && !verrouille;

  const colonnes = useMemo(() => tours
    .map(t => ({ tour: t, epreuves: triEpreuves(epreuves.filter(e => e.tourId === t.id)) }))
    .filter(c => c.epreuves.length > 0), [tours, epreuves]);
  const lesEpreuves = useMemo(() => colonnes.flatMap(c => c.epreuves), [colonnes]);
  const epreuvesDuTour = (tourId: string) => toutesLesEpreuves.filter(e => e.tourId === tourId).length;

  // Les notes telles qu'à l'écran : la base, recouverte par ce qui vient d'être tapé.
  const notesAffichees = useMemo<ExamenNote[]>(() => {
    const ids = new Set(lesEpreuves.map(e => e.id));
    const parCle = new Map(notes.filter(n => ids.has(n.epreuveId)).map(n => [cleCase(n.epreuveId, n.studentEnrollmentId), n]));
    for (const ep of lesEpreuves) {
      for (const s of candidats) {
        const cle = cleCase(ep.id, s.id);
        if (!(cle in brouillons)) continue;
        const saisie = analyserSaisieNoteExamen(brouillons[cle], ep.bareme);
        if (saisie.kind === 'vide') parCle.delete(cle);
        else if (saisie.kind === 'note') parCle.set(cle, { id: cle, epreuveId: ep.id, studentEnrollmentId: s.id, statut: 'note', valeur: saisie.valeur });
        else if (saisie.kind === 'statut' && saisie.statut !== 'non_evalue') parCle.set(cle, { id: cle, epreuveId: ep.id, studentEnrollmentId: s.id, statut: saisie.statut });
      }
    }
    return [...parCle.values()];
  }, [notes, brouillons, lesEpreuves, candidats]);

  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<Tri>('defaut');
  const lignes = useMemo(() => {
    let liste = candidats.map(s => {
      const etat = etatCandidat(lesEpreuves, notesAffichees, s.id);
      return { eleve: s, etat, note: etat.moyenne, rang: null as number | null };
    });
    if (tri === 'nom') liste.sort((a, b) => a.eleve.lastName.localeCompare(b.eleve.lastName, 'fr') || a.eleve.firstName.localeCompare(b.eleve.firstName, 'fr'));
    if (tri === 'note') {
      liste.sort((a, b) => (b.note ?? -1) - (a.note ?? -1));
      liste = liste.map((l, _, arr) => ({ ...l, rang: l.note === null ? null : arr.findIndex(x => x.note === l.note) + 1 }));
    }
    const q = recherche.trim().toLowerCase();
    return q ? liste.filter(l => `${l.eleve.lastName} ${l.eleve.firstName}`.toLowerCase().includes(q)) : liste;
  }, [candidats, lesEpreuves, notesAffichees, tri, recherche]);

  const [epreuveAOuvrir, setEpreuveAOuvrir] = useState<string | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);
  const focaliser = (ligne: number, colonne: string) => {
    tableRef.current?.querySelector<HTMLInputElement>(`input[data-ligne="${ligne}"][data-colonne="${colonne}"]`)?.focus();
  };

  const valeurCase = (ep: ExamenEpreuve, studentId: string): string => {
    const cle = cleCase(ep.id, studentId);
    if (cle in brouillons) return brouillons[cle];
    return texteDeLaNote(notes.find(n => n.epreuveId === ep.id && n.studentEnrollmentId === studentId));
  };

  const boutonAjout = modifiable && (
    <AjouterEpreuve examenId={examen.id} tours={tours} matiere={matiere} onCree={id => setEpreuveAOuvrir(id)} />
  );

  if (lesEpreuves.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-14 gap-3">
          <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {matiere ? `Aucune épreuve de « ${matiere.matiereName} » dans cet examen.` : 'Aucune épreuve hors programme.'}
          </p>
          {boutonAjout || (!verrouille && <p className="text-sm text-muted-foreground/70">Les épreuves sont définies par le directeur.</p>)}
        </CardContent>
      </Card>
    );
  }

  const afficherRang = tri === 'note';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher un candidat…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8 w-52 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {boutonAjout}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={tri} onValueChange={v => setTri(v as Tri)}>
              <SelectTrigger className="w-40 h-8 text-sm" aria-label="Trier"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="defaut">Ordre d'inscription</SelectItem>
                <SelectItem value="nom">Nom (A → Z)</SelectItem>
                <SelectItem value="note">Note et rang</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div ref={tableRef} className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40">
              {afficherRang && <th rowSpan={2} className="w-12 px-2 text-center font-medium text-muted-foreground border-b">Rang</th>}
              <th rowSpan={2} className="sticky left-0 z-10 bg-muted min-w-[170px] px-3 py-2 text-left font-medium text-muted-foreground border-b border-r">Candidat</th>
              {colonnes.map(({ tour, epreuves: eps }) => (
                <th key={tour.id} colSpan={eps.length} className="px-2 pt-2 pb-1 border-l border-b text-left">
                  {modifiable ? <EnTeteTour tour={tour} nbEpreuves={epreuvesDuTour(tour.id)} seuilExamen={examen.seuilAdmission} /> : <span className="font-semibold text-foreground whitespace-nowrap">{tour.name}</span>}
                </th>
              ))}
              <th rowSpan={2} className="min-w-[90px] px-3 text-center font-semibold border-l border-b bg-muted/60">
                {matiere ? 'Note' : 'Moyenne'}<div className="text-xs font-normal text-muted-foreground">/20</div>
              </th>
            </tr>
            <tr className="bg-muted/20">
              {colonnes.map(({ epreuves: eps }) => eps.map((ep, i) => (
                <th key={ep.id} className={`px-1 py-1 border-b text-center min-w-[90px] ${i === 0 ? 'border-l' : ''}`}>
                  <EnTeteEpreuve
                    epreuve={ep} modifiable={modifiable} matieres={matieres}
                    ouvrirDemande={epreuveAOuvrir === ep.id} onOuvert={() => setEpreuveAOuvrir(null)}
                  />
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 ? (
              <tr><td colSpan={99} className="text-center py-8 text-muted-foreground">
                {candidats.length === 0 ? 'Aucun candidat — ajoutez-en avec le bouton « Candidats ».' : `Aucun candidat trouvé pour « ${recherche} »`}
              </td></tr>
            ) : lignes.map(({ eleve: s, etat, note, rang }, iLigne) => (
              <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20">
                {afficherRang && <td className="text-center font-bold bg-primary/5">{rang ?? '—'}</td>}
                <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-r">
                  <div className="font-medium leading-tight">{s.lastName}</div>
                  <div className="text-xs text-muted-foreground">{s.firstName}</div>
                </td>
                {colonnes.map(({ epreuves: eps }) => eps.map((ep, i) => {
                  const texte = valeurCase(ep, s.id);
                  const saisie = analyserSaisieNoteExamen(texte, ep.bareme);
                  const invalide = saisie.kind === 'invalide';
                  const eliminatoire = etat.epreuvesEliminatoires.includes(ep.id);
                  return (
                    <td key={ep.id} className={`px-1 py-1 text-center ${i === 0 ? 'border-l' : ''} ${eliminatoire ? 'bg-red-50 dark:bg-red-950/30' : ''}`}>
                      <Input
                        value={texte}
                        placeholder="-"
                        disabled={verrouille}
                        data-ligne={iLigne}
                        data-colonne={ep.id}
                        aria-label={`${ep.nom} — ${s.lastName} ${s.firstName}`}
                        aria-invalid={invalide}
                        title={invalide ? saisie.raison : eliminatoire ? `Sous la note éliminatoire (${ep.seuilEliminatoire})` : undefined}
                        className={`w-16 h-8 mx-auto text-center px-1 ${invalide ? 'border-destructive ring-1 ring-destructive text-destructive' : ''} ${saisie.kind === 'statut' ? 'text-amber-600 font-semibold' : ''} ${eliminatoire ? 'text-red-600 font-semibold' : ''}`}
                        onChange={e => modifierCase(ep.id, s.id, ep.bareme, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focaliser(iLigne + 1, ep.id); }
                          if (e.key === 'ArrowUp') { e.preventDefault(); focaliser(iLigne - 1, ep.id); }
                        }}
                      />
                    </td>
                  );
                }))}
                <td className={`text-center font-semibold border-l bg-muted/30 ${couleurNote(note, examen.seuilAdmission)}`}>
                  {note === null ? '—' : format(note)}
                  {etat.epreuvesEliminatoires.length > 0 && <div className="text-[10px] font-semibold uppercase text-red-600">Éliminatoire</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Tapez la note, ou <strong>A</strong> (absent), <strong>AJ</strong> (absent justifié). Entrée passe au candidat suivant.
        {lesEpreuves.length > 1 && ' La note de la matière combine ses épreuves selon leur coefficient.'}
        {' '}Moyenne générale, décision et mention : écran « Résultats ».
      </p>
    </div>
  );
};

/** Titre d'une colonne d'épreuve — le directeur y règle nom, coefficient, barème, note éliminatoire, date et salle. */
const SANS_MATIERE = '__sans';

const EnTeteEpreuve = ({ epreuve: ep, modifiable, matieres, ouvrirDemande, onOuvert }: {
  epreuve: ExamenEpreuve; modifiable: boolean; matieres: NiveauMatiere[]; ouvrirDemande: boolean; onOuvert: () => void;
}) => {
  const { notes, updateEpreuve, deleteEpreuve } = useExamens();
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ nom: '', matiere: SANS_MATIERE, coefficient: '', bareme: '', seuil: '', date: '', heure: '', salle: '', examinateurs: '' });
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const notesSaisies = notes.filter(n => n.epreuveId === ep.id);

  const ouvrir = (o: boolean) => {
    if (o) {
      setF({
        nom: ep.nom, matiere: ep.niveauMatiereId ?? SANS_MATIERE, coefficient: String(ep.coefficient), bareme: String(ep.bareme),
        seuil: ep.seuilEliminatoire == null ? '' : String(ep.seuilEliminatoire),
        date: ep.date ?? '', heure: ep.heure ?? '', salle: ep.salle ?? '', examinateurs: ep.examinateurs ?? '',
      });
    }
    setOuvert(o);
  };
  useEffect(() => {
    if (ouvrirDemande) { ouvrir(true); onOuvert(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvrirDemande]);

  const nombre = (t: string) => Number(t.replace(',', '.'));
  const enregistrer = async () => {
    const coefficient = nombre(f.coefficient);
    const bareme = nombre(f.bareme);
    const seuil = f.seuil.trim() === '' ? undefined : nombre(f.seuil);
    if (!nomEpreuveValide(f.nom) || !coefficientValide(coefficient) || !baremeValide(bareme)) {
      toast({ title: 'Erreur', description: 'Nom, coefficient et barème (supérieurs à 0) sont obligatoires.', variant: 'destructive' });
      return;
    }
    if (!seuilEliminatoireValide(seuil, bareme)) {
      toast({ title: 'Erreur', description: `La note éliminatoire doit être entre 0 et ${bareme} (exclu), ou vide.`, variant: 'destructive' });
      return;
    }
    const auDessus = notesSaisies.filter(n => n.statut === 'note' && (n.valeur ?? 0) > bareme).length;
    if (auDessus > 0) {
      toast({ title: 'Barème trop petit', description: `${auDessus} note(s) déjà saisie(s) dépasse(nt) ${bareme}.`, variant: 'destructive' });
      return;
    }
    setEnregistrement(true);
    try {
      await updateEpreuve(ep.id, {
        nom: f.nom.trim(), coefficient, bareme, seuilEliminatoire: seuil,
        niveauMatiereId: f.matiere === SANS_MATIERE ? undefined : f.matiere,
        date: f.date || undefined, heure: f.heure || undefined, salle: f.salle, examinateurs: f.examinateurs,
      });
      setOuvert(false);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setEnregistrement(false);
    }
  };

  const resume = (
    <>
      <div className="text-xs font-medium text-foreground truncate max-w-[120px] mx-auto">{ep.nom}</div>
      <div className="text-[11px] font-normal text-muted-foreground">
        ×{ep.coefficient} · /{ep.bareme}
        {ep.seuilEliminatoire != null && <span className="text-red-600"> · élim. &lt;{ep.seuilEliminatoire}</span>}
      </div>
      {!ep.niveauMatiereId && <div className="text-[10px] font-normal italic text-muted-foreground/80" title="Rattachée à aucune matière : ne compte pas dans les moyennes d'Évaluations">hors moyenne</div>}
    </>
  );
  if (!modifiable) return <div className="px-1 py-0.5 text-center">{resume}</div>;

  return (
    <>
      <Popover open={ouvert} onOpenChange={ouvrir}>
        <PopoverTrigger asChild>
          <button className="w-full rounded px-1 py-0.5 hover:bg-muted text-center" title="Modifier cette épreuve">{resume}</button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`nom-${ep.id}`}>Nom de l'épreuve</Label>
            <Input id={`nom-${ep.id}`} value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Matière du programme</Label>
            <Select
              value={f.matiere}
              onValueChange={v => {
                // Choisir une matière reprend son nom et son coefficient si l'épreuve n'a pas encore été nommée.
                const m = matieres.find(x => x.id === v);
                setF(prev => ({ ...prev, matiere: v, ...(m && /^Épreuve \d+$/.test(prev.nom) ? { nom: m.matiereName, coefficient: String(m.coefficient) } : {}) }));
              }}
            >
              <SelectTrigger aria-label="Matière du programme"><SelectValue /></SelectTrigger>
              <SelectContent>
                {matieres.map(m => <SelectItem key={m.id} value={m.id}>{m.matiereName}</SelectItem>)}
                <SelectItem value={SANS_MATIERE}>Aucune (hors moyenne)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">La note de l'épreuve entre dans la moyenne de cette matière, dans Évaluations.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor={`coef-${ep.id}`}>Coefficient</Label>
              <Input id={`coef-${ep.id}`} inputMode="decimal" value={f.coefficient} onChange={e => setF({ ...f, coefficient: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`bareme-${ep.id}`}>Noté sur</Label>
              <Input id={`bareme-${ep.id}`} inputMode="decimal" value={f.bareme} onChange={e => setF({ ...f, bareme: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`seuil-${ep.id}`}>Éliminatoire</Label>
              <Input id={`seuil-${ep.id}`} inputMode="decimal" placeholder="aucune" value={f.seuil} onChange={e => setF({ ...f, seuil: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">Note éliminatoire : en dessous, le candidat est refusé quelle que soit sa moyenne. Laissez vide si l'épreuve n'est pas éliminatoire.</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor={`date-${ep.id}`}>Date</Label>
              <Input id={`date-${ep.id}`} type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`heure-${ep.id}`}>Heure</Label>
              <Input id={`heure-${ep.id}`} type="time" value={f.heure} onChange={e => setF({ ...f, heure: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor={`salle-${ep.id}`}>Salle</Label>
              <Input id={`salle-${ep.id}`} value={f.salle} onChange={e => setF({ ...f, salle: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`exam-${ep.id}`}>Examinateurs</Label>
              <Input id={`exam-${ep.id}`} value={f.examinateurs} onChange={e => setF({ ...f, examinateurs: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setConfirmer(true)}>
              <Trash2 className="h-3.5 w-3.5" />Supprimer
            </Button>
            <Button size="sm" onClick={() => void enregistrer()} disabled={enregistrement}>
              {enregistrement && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Enregistrer
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <AlertDialog open={confirmer} onOpenChange={setConfirmer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'épreuve « {ep.nom} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {notesSaisies.length > 0 ? `Ses ${notesSaisies.length} note(s) seront supprimées. ` : ''}Cette action ne peut pas être défaite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              void deleteEpreuve(ep.id).then(() => setOuvert(false)).catch(err => toast({ title: 'Erreur', description: String(err), variant: 'destructive' }));
            }}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/** Nom d'un tour — le directeur le renomme ou le supprime. */
const EnTeteTour = ({ tour, nbEpreuves, seuilExamen }: { tour: ExamenTour; nbEpreuves: number; seuilExamen: number }) => {
  const { updateTour, deleteTour } = useExamens();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState(tour.name);
  const [exigee, setExigee] = useState('');
  const [confirmer, setConfirmer] = useState(false);

  const renommer = async () => {
    if (!nomTourValide(nom)) return;
    const moyenneExigee = exigee.trim() === '' ? null : Number(exigee.replace(',', '.'));
    if (moyenneExigee !== null && !seuilAdmissionValide(moyenneExigee)) {
      toast({ title: 'Erreur', description: 'La moyenne exigée doit être entre 0 et 20 (ou vide).', variant: 'destructive' });
      return;
    }
    try { await updateTour(tour.id, { name: nom, moyenneExigee }); setOuvert(false); }
    catch (err) { toast({ title: 'Erreur', description: String(err), variant: 'destructive' }); }
  };

  return (
    <>
      <Popover open={ouvert} onOpenChange={o => {
        if (o) { setNom(tour.name); setExigee(tour.moyenneExigee == null ? '' : String(tour.moyenneExigee).replace('.', ',')); }
        setOuvert(o);
      }}>
        <PopoverTrigger asChild>
          <button className="font-semibold text-foreground whitespace-nowrap rounded px-1 hover:bg-muted" title="Renommer ce tour, régler sa moyenne exigée ou le supprimer">
            {tour.name}
            {tour.moyenneExigee != null && <span className="font-normal text-muted-foreground"> · moy. exigée {String(tour.moyenneExigee).replace('.', ',')}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`tour-${tour.id}`}>Nom du tour</Label>
            <Input id={`tour-${tour.id}`} value={nom} onChange={e => setNom(e.target.value)} onKeyDown={e => e.key === 'Enter' && void renommer()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`exigee-${tour.id}`}>Moyenne exigée pour ce tour</Label>
            <Input id={`exigee-${tour.id}`} inputMode="decimal" placeholder={`${String(seuilExamen).replace('.', ',')} (celle de l'examen)`} value={exigee} onChange={e => setExigee(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Total demandé = coefficients du tour × cette moyenne. Avant le dernier tour, elle décide de l'admissibilité
              (ex. CAP : 12 au 1er tour, 10 au 2e).
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setConfirmer(true)}>
              <Trash2 className="h-3.5 w-3.5" />Supprimer
            </Button>
            <Button size="sm" onClick={() => void renommer()}>Enregistrer</Button>
          </div>
        </PopoverContent>
      </Popover>
      <AlertDialog open={confirmer} onOpenChange={setConfirmer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le tour « {tour.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {nbEpreuves > 0 ? `Ses ${nbEpreuves} épreuve(s) et toutes leurs notes seront supprimées. ` : ''}Cette action ne peut pas être défaite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              void deleteTour(tour.id).catch(err => toast({ title: 'Erreur', description: String(err), variant: 'destructive' }));
            }}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/**
 * « + Épreuve » dans une matière : on choisit le tour (ou on en crée un), et
 * l'épreuve reprend le nom et le coefficient de la matière — sa fiche s'ouvre
 * ensuite pour ajuster barème, note éliminatoire, date (directeur).
 */
const AjouterEpreuve = ({ examenId, tours, matiere, onCree }: {
  examenId: string; tours: ExamenTour[]; matiere: NiveauMatiere | null; onCree: (epreuveId: string) => void;
}) => {
  const { epreuves, addTour, addEpreuve } = useExamens();
  const [ouvert, setOuvert] = useState(false);
  const [tourId, setTourId] = useState<string>('');
  const [nouveauTour, setNouveauTour] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (ouvert) { setTourId(tours[0]?.id ?? '__nouveau'); setNouveauTour(tours.length === 0 ? 'Écrit' : ''); }
  }, [ouvert, tours]);

  const creer = async () => {
    if (tourId === '__nouveau' && !nomTourValide(nouveauTour)) {
      toast({ title: 'Erreur', description: 'Donnez un nom au nouveau tour (Écrit, Pratique, Oral…).', variant: 'destructive' });
      return;
    }
    setEnCours(true);
    try {
      const idTour = tourId === '__nouveau' ? (await addTour(examenId, nouveauTour)).id : tourId;
      const deCeTour = epreuves.filter(e => e.tourId === idTour).length;
      const ep = await addEpreuve(idTour, matiere
        ? { nom: matiere.matiereName, coefficient: matiere.coefficient, bareme: 20, niveauMatiereId: matiere.id }
        : { nom: `Épreuve ${deCeTour + 1}`, coefficient: 1, bareme: 20 });
      setOuvert(false);
      onCree(ep.id);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Plus className="h-3.5 w-3.5" />Épreuve</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3">
        <p className="text-sm font-medium">Nouvelle épreuve{matiere ? ` de ${matiere.matiereName}` : ''}</p>
        <div className="space-y-1.5">
          <Label>Tour</Label>
          <Select value={tourId} onValueChange={setTourId}>
            <SelectTrigger aria-label="Tour"><SelectValue /></SelectTrigger>
            <SelectContent>
              {tours.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              <SelectItem value="__nouveau">Nouveau tour…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {tourId === '__nouveau' && (
          <div className="space-y-1.5">
            <Label htmlFor="nouveau-tour">Nom du tour</Label>
            <Input id="nouveau-tour" placeholder="Ex : Oral" value={nouveauTour} onChange={e => setNouveauTour(e.target.value)} />
            <div className="flex gap-1.5 flex-wrap">
              {['Écrit', 'Pratique', 'Oral'].map(n => (
                <button key={n} type="button" onClick={() => setNouveauTour(n)} className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/70">{n}</button>
              ))}
            </div>
          </div>
        )}
        <Button size="sm" className="w-full" disabled={enCours} onClick={() => void creer()}>
          {enCours && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Ajouter l'épreuve
        </Button>
      </PopoverContent>
    </Popover>
  );
};
