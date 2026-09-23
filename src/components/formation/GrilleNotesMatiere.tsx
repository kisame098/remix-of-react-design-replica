import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormationPro } from '@/contexts/FormationProContext';
import type { Student } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Loader2, Trash2, Search, ArrowUpDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type BaremeCategorie, type Evaluation, type NiveauMatiere, type Note, type Periode,
  triEvaluationsChronologique, titreNouvelleEvaluation, analyserSaisieNote, texteDeLaNote,
  moyenneMatiere, resumeEvaluation, titreEvaluationValide, baremeValide, poidsValide, categoriesSaisies,
} from '@/lib/formationPro';
import { cleCase, type SauvegardeNotes } from './useSauvegardeNotes';

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dateCourte = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
const format = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');
const couleurMoyenne = (m: number | null) => m === null ? 'text-muted-foreground' : m >= 10 ? 'text-green-600' : 'text-red-500';

type Tri = 'defaut' | 'nom' | 'moyenne';

interface Props {
  promotionId: string;
  periode: Periode;
  matiere: NiveauMatiere;
  /** Toute la formule : les catégories saisies ici ET celles alimentées par les examens. */
  categories: BaremeCategorie[];
  /** Les épreuves d'examen de la promotion, déjà traduites en évaluations (voir evaluationsDepuisExamens). */
  depuisExamens: { evaluations: Evaluation[]; notes: Note[] };
  eleves: Student[];
  sauvegarde: SauvegardeNotes;
}

/**
 * La saisie d'UNE matière pour UNE période : un seul tableau, comme
 * Devoir 1…5 / Composition / Moyenne du système classique
 * (src/pages/SubjectGrades.tsx). Chaque catégorie de la formule est un
 * groupe de colonnes ; « + » dans son en-tête ajoute une évaluation
 * directement — la catégorie, la matière et la période sont déjà connues,
 * on ne les redemande jamais. Cliquer le titre d'une colonne permet d'en
 * changer la date, le barème, le poids, ou de la supprimer.
 *
 * Seules les catégories SAISIES ici ont des colonnes (Contrôle continu, TP) :
 * Examen blanc et Examen final viennent de la rubrique Examens. La moyenne,
 * elle, suit toute la formule — examens compris.
 */
export const GrilleNotesMatiere = ({ promotionId, periode, matiere, categories, depuisExamens, eleves, sauvegarde }: Props) => {
  const { evaluations, notes, addEvaluation } = useFormationPro();
  const { brouillons, modifierCase } = sauvegarde;

  const colonnes = useMemo(() => categoriesSaisies(categories).map(cat => ({
    categorie: cat,
    evaluations: triEvaluationsChronologique(evaluations.filter(e =>
      e.promotionId === promotionId && e.periodeId === periode.id && e.niveauMatiereId === matiere.id && e.categorieId === cat.id)),
  })), [categories, evaluations, promotionId, periode.id, matiere.id]);
  const toutesLesEvaluations = useMemo(() => colonnes.flatMap(c => c.evaluations), [colonnes]);

  // Les notes telles qu'à l'écran : la base, recouverte par ce qui vient d'être
  // tapé — la moyenne suit la frappe au lieu d'attendre la sauvegarde.
  const notesAffichees = useMemo<Note[]>(() => {
    const ids = new Set(toutesLesEvaluations.map(e => e.id));
    const parCle = new Map(notes.filter(n => ids.has(n.evaluationId)).map(n => [cleCase(n.evaluationId, n.studentEnrollmentId), n]));
    for (const ev of toutesLesEvaluations) {
      for (const s of eleves) {
        const cle = cleCase(ev.id, s.id);
        if (!(cle in brouillons)) continue;
        const saisie = analyserSaisieNote(brouillons[cle], ev.bareme);
        if (saisie.kind === 'vide') parCle.delete(cle);
        else if (saisie.kind === 'note') parCle.set(cle, { id: cle, evaluationId: ev.id, studentEnrollmentId: s.id, statut: 'note', valeur: saisie.valeur });
        else if (saisie.kind === 'statut') parCle.set(cle, { id: cle, evaluationId: ev.id, studentEnrollmentId: s.id, statut: saisie.statut });
      }
    }
    return [...parCle.values()];
  }, [notes, brouillons, toutesLesEvaluations, eleves]);

  // Les examens de cette matière et de cette période, pour la moyenne seulement.
  const examensMatiere = useMemo(() => {
    const evs = depuisExamens.evaluations.filter(e => e.periodeId === periode.id && e.niveauMatiereId === matiere.id);
    const ids = new Set(evs.map(e => e.id));
    return { evaluations: evs, notes: depuisExamens.notes.filter(n => ids.has(n.evaluationId)) };
  }, [depuisExamens, periode.id, matiere.id]);

  const moyennes = useMemo(() => {
    const evs = [...toutesLesEvaluations, ...examensMatiere.evaluations];
    const ns = [...notesAffichees, ...examensMatiere.notes];
    return new Map(eleves.map(s => [s.id, moyenneMatiere(categories, evs, ns, s.id)]));
  }, [eleves, categories, toutesLesEvaluations, notesAffichees, examensMatiere]);
  const avecExamens = categories.some(c => c.sourceExamen);

  // ── Recherche et tri (comme la saisie classique) ─────────────────────────
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<Tri>('defaut');
  const lignes = useMemo(() => {
    let liste = eleves.map(s => ({ eleve: s, moyenne: moyennes.get(s.id) ?? null, rang: null as number | null }));
    if (tri === 'nom') liste.sort((a, b) => a.eleve.lastName.localeCompare(b.eleve.lastName, 'fr') || a.eleve.firstName.localeCompare(b.eleve.firstName, 'fr'));
    if (tri === 'moyenne') {
      liste.sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
      liste = liste.map((l, i, arr) => ({ ...l, rang: l.moyenne === null ? null : arr.findIndex(x => x.moyenne === l.moyenne) + 1 }));
    }
    const q = recherche.trim().toLowerCase();
    return q ? liste.filter(l => `${l.eleve.lastName} ${l.eleve.firstName}`.toLowerCase().includes(q)) : liste;
  }, [eleves, moyennes, tri, recherche]);

  // ── Ajouter une colonne en un clic ─────────────────────────────────────────
  const [ajoutEnCours, setAjoutEnCours] = useState<string | null>(null);
  const [colonneAFocaliser, setColonneAFocaliser] = useState<string | null>(null);
  const ajouterEvaluation = async (cat: BaremeCategorie, existantes: Evaluation[]) => {
    setAjoutEnCours(cat.id);
    try {
      const title = titreNouvelleEvaluation(cat.name, existantes.map(e => e.title));
      const ev = await addEvaluation({
        promotionId, niveauMatiereId: matiere.id, periodeId: periode.id, categorieId: cat.id,
        type: cat.name, title, date: aujourdhui(), bareme: 20, poids: 1,
      });
      setColonneAFocaliser(ev.id);
      toast({ title: `« ${title} » ajoutée`, description: 'Notée sur 20, datée d\'aujourd\'hui — cliquez sur son titre pour changer.' });
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setAjoutEnCours(null);
    }
  };

  // ── Clavier : Entrée / flèches pour descendre et monter dans une colonne ──
  const tableRef = useRef<HTMLDivElement>(null);
  const focaliser = (ligne: number, colonne: string) => {
    tableRef.current?.querySelector<HTMLInputElement>(`input[data-ligne="${ligne}"][data-colonne="${colonne}"]`)?.focus();
  };
  useEffect(() => {
    if (!colonneAFocaliser) return;
    focaliser(0, colonneAFocaliser);
    setColonneAFocaliser(null);
  }, [colonneAFocaliser, toutesLesEvaluations]);

  const valeurCase = (ev: Evaluation, studentId: string): string => {
    const cle = cleCase(ev.id, studentId);
    if (cle in brouillons) return brouillons[cle];
    return texteDeLaNote(notes.find(n => n.evaluationId === ev.id && n.studentEnrollmentId === studentId));
  };

  const moyennesPromo = lignes.map(l => l.moyenne).filter((m): m is number => m !== null);
  const afficherRang = tri === 'moyenne';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher un élève…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8 w-52 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={tri} onValueChange={v => setTri(v as Tri)}>
            <SelectTrigger className="w-44 h-8 text-sm" aria-label="Trier"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="defaut">Ordre d'inscription</SelectItem>
              <SelectItem value="nom">Nom (A → Z)</SelectItem>
              <SelectItem value="moyenne">Moyenne et rang</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={tableRef} className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40">
              {afficherRang && <th rowSpan={2} className="w-12 px-2 text-center font-medium text-muted-foreground border-b">Rang</th>}
              <th rowSpan={2} className="sticky left-0 z-10 bg-muted min-w-[170px] px-3 py-2 text-left font-medium text-muted-foreground border-b border-r">Élève</th>
              {colonnes.map(({ categorie: cat, evaluations: evs }) => (
                <th key={cat.id} colSpan={Math.max(evs.length, 1)} className="px-2 pt-2 pb-1 border-l border-b text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground whitespace-nowrap">
                      {cat.name} <span className="font-normal text-muted-foreground">· {cat.pourcentage} %</span>
                    </span>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0"
                      title={`Ajouter une évaluation en ${cat.name}`} aria-label={`Ajouter une évaluation en ${cat.name}`}
                      disabled={ajoutEnCours === cat.id} onClick={() => void ajouterEvaluation(cat, evs)}
                    >
                      {ajoutEnCours === cat.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </th>
              ))}
              <th rowSpan={2} className="min-w-[90px] px-3 text-center font-semibold border-l border-b bg-muted/60">
                Moyenne<div className="text-xs font-normal text-muted-foreground">{avecExamens ? '/20 · examens inclus' : '/20'}</div>
              </th>
            </tr>
            <tr className="bg-muted/20">
              {colonnes.map(({ categorie: cat, evaluations: evs }) => evs.length === 0 ? (
                <th key={cat.id} className="px-2 py-1.5 border-l border-b text-xs font-normal text-muted-foreground/70 text-center italic">aucune</th>
              ) : evs.map((ev, i) => (
                <th key={ev.id} className={`px-1 py-1 border-b text-center min-w-[84px] ${i === 0 ? 'border-l' : ''}`}>
                  <EnTeteEvaluation evaluation={ev} />
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 ? (
              <tr><td colSpan={99} className="text-center py-8 text-muted-foreground">Aucun élève trouvé pour « {recherche} »</td></tr>
            ) : lignes.map(({ eleve: s, moyenne, rang }, iLigne) => (
              <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20">
                {afficherRang && <td className="text-center font-bold bg-primary/5">{rang ?? '—'}</td>}
                <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-r">
                  <div className="font-medium leading-tight">{s.lastName}</div>
                  <div className="text-xs text-muted-foreground">{s.firstName}</div>
                </td>
                {colonnes.map(({ categorie: cat, evaluations: evs }) => evs.length === 0 ? (
                  <td key={cat.id} className="border-l bg-muted/10" />
                ) : evs.map((ev, i) => {
                  const texte = valeurCase(ev, s.id);
                  const saisie = analyserSaisieNote(texte, ev.bareme);
                  const invalide = saisie.kind === 'invalide';
                  const statut = saisie.kind === 'statut';
                  return (
                    <td key={ev.id} className={`px-1 py-1 text-center ${i === 0 ? 'border-l' : ''}`}>
                      <Input
                        value={texte}
                        placeholder="-"
                        data-ligne={iLigne}
                        data-colonne={ev.id}
                        aria-label={`${ev.title} — ${s.lastName} ${s.firstName}`}
                        aria-invalid={invalide}
                        title={invalide ? saisie.raison : undefined}
                        className={`w-16 h-8 mx-auto text-center px-1 ${invalide ? 'border-destructive ring-1 ring-destructive text-destructive' : ''} ${statut ? 'text-amber-600 font-semibold' : ''}`}
                        onChange={e => modifierCase(ev.id, s.id, ev.bareme, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focaliser(iLigne + 1, ev.id); }
                          if (e.key === 'ArrowUp') { e.preventDefault(); focaliser(iLigne - 1, ev.id); }
                        }}
                      />
                    </td>
                  );
                }))}
                <td className={`text-center font-semibold border-l bg-muted/30 ${couleurMoyenne(moyenne)}`}>
                  {moyenne === null ? '—' : format(moyenne)}
                </td>
              </tr>
            ))}
          </tbody>
          {lignes.length > 0 && toutesLesEvaluations.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/30 text-xs text-muted-foreground">
                {afficherRang && <td />}
                <td className="sticky left-0 z-10 bg-muted px-3 py-2 border-r font-medium">Moyenne de la promotion</td>
                {colonnes.map(({ categorie: cat, evaluations: evs }) => evs.length === 0 ? (
                  <td key={cat.id} className="border-l" />
                ) : evs.map((ev, i) => {
                  const m = resumeEvaluation(ev, notesAffichees, eleves.length).moyenne;
                  return (
                    <td key={ev.id} className={`text-center ${i === 0 ? 'border-l' : ''}`}>
                      {m === null ? '—' : `${format((m * ev.bareme) / 20)}/${ev.bareme}`}
                    </td>
                  );
                }))}
                <td className="text-center font-semibold border-l">
                  {moyennesPromo.length === 0 ? '—' : format(moyennesPromo.reduce((a, b) => a + b, 0) / moyennesPromo.length)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Tapez la note, ou <strong>A</strong> (absent), <strong>AJ</strong> (absent justifié), <strong>NE</strong> (non évalué).
        Entrée passe à l'élève suivant. Une case vide ou un statut n'est jamais compté 0 : il est simplement ignoré dans la moyenne.
      </p>
    </div>
  );
};

/** Titre d'une colonne : cliquer pour modifier date, barème, poids ou supprimer l'évaluation. */
const EnTeteEvaluation = ({ evaluation: ev }: { evaluation: Evaluation }) => {
  const { notes, updateEvaluation, deleteEvaluation } = useFormationPro();
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState(ev.title);
  const [date, setDate] = useState(ev.date);
  const [bareme, setBareme] = useState(String(ev.bareme));
  const [poids, setPoids] = useState(String(ev.poids));
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  const ouvrir = (o: boolean) => {
    if (o) { setTitle(ev.title); setDate(ev.date); setBareme(String(ev.bareme)); setPoids(String(ev.poids)); }
    setOuvert(o);
  };

  const notesSaisies = notes.filter(n => n.evaluationId === ev.id);

  const enregistrer = async () => {
    const b = Number(bareme.replace(',', '.'));
    const p = Number(poids.replace(',', '.'));
    if (!titreEvaluationValide(title) || !date || !baremeValide(b) || !poidsValide(p)) {
      toast({ title: 'Erreur', description: 'Titre, date, barème et poids (supérieurs à 0) sont obligatoires.', variant: 'destructive' });
      return;
    }
    const auDessus = notesSaisies.filter(n => n.statut === 'note' && (n.valeur ?? 0) > b).length;
    if (auDessus > 0) {
      toast({ title: 'Barème trop petit', description: `${auDessus} note${auDessus > 1 ? 's' : ''} déjà saisie${auDessus > 1 ? 's' : ''} dépasse${auDessus > 1 ? 'nt' : ''} ${b}.`, variant: 'destructive' });
      return;
    }
    setEnregistrement(true);
    try {
      await updateEvaluation(ev.id, { title: title.trim(), date, bareme: b, poids: p });
      setOuvert(false);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setEnregistrement(false);
    }
  };

  const supprimer = async () => {
    try {
      await deleteEvaluation(ev.id);
      toast({ title: `« ${ev.title} » supprimée` });
      setOuvert(false);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setConfirmerSuppression(false);
    }
  };

  return (
    <>
      <Popover open={ouvert} onOpenChange={ouvrir}>
        <PopoverTrigger asChild>
          <button className="w-full rounded px-1 py-0.5 hover:bg-muted text-center" title="Modifier cette évaluation">
            <div className="text-xs font-medium text-foreground truncate max-w-[110px] mx-auto">{ev.title}</div>
            <div className="text-[11px] font-normal text-muted-foreground">
              /{ev.bareme} · {dateCourte(ev.date)}{ev.poids !== 1 ? ` · ×${ev.poids}` : ''}
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`titre-${ev.id}`}>Titre</Label>
            <Input id={`titre-${ev.id}`} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`date-${ev.id}`}>Date</Label>
            <Input id={`date-${ev.id}`} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor={`bareme-${ev.id}`}>Noté sur</Label>
              <Input id={`bareme-${ev.id}`} inputMode="decimal" value={bareme} onChange={e => setBareme(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`poids-${ev.id}`}>Poids</Label>
              <Input id={`poids-${ev.id}`} inputMode="decimal" value={poids} onChange={e => setPoids(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Le poids compte cette évaluation plus (2) ou moins (0,5) que les autres de sa catégorie.</p>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setConfirmerSuppression(true)}>
              <Trash2 className="h-3.5 w-3.5" />Supprimer
            </Button>
            <Button size="sm" onClick={() => void enregistrer()} disabled={enregistrement}>
              {enregistrement && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Enregistrer
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirmerSuppression} onOpenChange={setConfirmerSuppression}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {ev.title} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {notesSaisies.length > 0
                ? `Les ${notesSaisies.length} note${notesSaisies.length > 1 ? 's' : ''} déjà saisie${notesSaisies.length > 1 ? 's' : ''} seront supprimées. `
                : 'Aucune note n\'a encore été saisie. '}
              Cette action ne peut pas être défaite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void supprimer()}>
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
