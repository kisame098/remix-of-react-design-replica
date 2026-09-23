import { useEffect, useMemo, useRef, useState } from 'react';
import { useExamens } from '@/contexts/ExamensContext';
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
  type Examen, type ExamenEpreuve, type ExamenNote, type ExamenTour, type Decision, type Mention,
  analyserSaisieNoteExamen, texteDeLaNote, etatCandidat, propositionJury, decisionRetenue, mentionRetenue,
  triEpreuves, LIBELLES_DECISION, LIBELLES_MENTION, nomEpreuveValide, baremeValide, coefficientValide, seuilEliminatoireValide,
  nomTourValide,
} from '@/lib/formationPro';
import { cleCase, type SauvegardeNotes } from './useSauvegardeNotes';

const format = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');
const couleurMoyenne = (m: number | null, seuil: number) => m === null ? 'text-muted-foreground' : m >= seuil ? 'text-green-600' : 'text-red-500';
const COULEUR_DECISION: Record<Decision, string> = { admis: 'text-green-700', ajourne: 'text-amber-700', refuse: 'text-red-600' };
const AUTO = '__auto';

type Tri = 'defaut' | 'nom' | 'moyenne';

interface Props {
  examen: Examen;
  tours: ExamenTour[];
  candidats: Student[];
  sauvegarde: SauvegardeNotes;
  estDirecteur: boolean;
}

/**
 * La saisie d'un examen en UN tableau : une ligne par candidat, les épreuves
 * en colonnes regroupées par tour, puis moyenne, décision et mention.
 * Le logiciel PROPOSE la décision (note éliminatoire, seuil d'admission) ;
 * le jury la retient ou la change dans la case. Une fois l'examen verrouillé,
 * tout passe en lecture seule et affiche les valeurs figées.
 */
export const GrilleExamen = ({ examen, tours, candidats, sauvegarde, estDirecteur }: Props) => {
  const { epreuves, notes, resultats, addEpreuve, choisirDecision } = useExamens();
  const { brouillons, modifierCase } = sauvegarde;
  const verrouille = examen.verrouille;
  const modifiable = estDirecteur && !verrouille;

  const colonnes = useMemo(() => tours.map(t => ({ tour: t, epreuves: triEpreuves(epreuves.filter(e => e.tourId === t.id)) })), [tours, epreuves]);
  const toutesLesEpreuves = useMemo(() => colonnes.flatMap(c => c.epreuves), [colonnes]);

  // Les notes telles qu'à l'écran : la base, recouverte par ce qui vient d'être tapé.
  const notesAffichees = useMemo<ExamenNote[]>(() => {
    const ids = new Set(toutesLesEpreuves.map(e => e.id));
    const parCle = new Map(notes.filter(n => ids.has(n.epreuveId)).map(n => [cleCase(n.epreuveId, n.studentEnrollmentId), n]));
    for (const ep of toutesLesEpreuves) {
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
  }, [notes, brouillons, toutesLesEpreuves, candidats]);

  const lignesBrutes = useMemo(() => candidats.map(s => {
    const etat = etatCandidat(toutesLesEpreuves, notesAffichees, s.id);
    const proposition = propositionJury(etat, examen.seuilAdmission);
    const resultat = resultats.find(r => r.examenId === examen.id && r.studentEnrollmentId === s.id);
    return {
      eleve: s, etat, proposition, resultat,
      moyenne: verrouille && resultat ? resultat.moyenne ?? null : etat.moyenne,
      decision: decisionRetenue(resultat, proposition),
      mention: mentionRetenue(resultat, proposition),
    };
  }), [candidats, toutesLesEpreuves, notesAffichees, examen.seuilAdmission, examen.id, resultats, verrouille]);

  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<Tri>('defaut');
  const lignes = useMemo(() => {
    let liste = lignesBrutes.map(l => ({ ...l, rang: null as number | null }));
    if (tri === 'nom') liste.sort((a, b) => a.eleve.lastName.localeCompare(b.eleve.lastName, 'fr') || a.eleve.firstName.localeCompare(b.eleve.firstName, 'fr'));
    if (tri === 'moyenne') {
      liste.sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
      liste = liste.map((l, _, arr) => ({ ...l, rang: l.moyenne === null ? null : arr.findIndex(x => x.moyenne === l.moyenne) + 1 }));
    }
    const q = recherche.trim().toLowerCase();
    return q ? liste.filter(l => `${l.eleve.lastName} ${l.eleve.firstName}`.toLowerCase().includes(q)) : liste;
  }, [lignesBrutes, tri, recherche]);

  // ── Ajouter une épreuve (directeur) ─────────────────────────────────────────
  const [ajoutEnCours, setAjoutEnCours] = useState<string | null>(null);
  const [epreuveAOuvrir, setEpreuveAOuvrir] = useState<string | null>(null);
  const ajouterEpreuve = async (tour: ExamenTour, existantes: ExamenEpreuve[]) => {
    setAjoutEnCours(tour.id);
    try {
      const ep = await addEpreuve(tour.id, { nom: `Épreuve ${existantes.length + 1}`, coefficient: 1, bareme: 20 });
      setEpreuveAOuvrir(ep.id);   // on ouvre sa fiche : nom et coefficient sont à donner tout de suite
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setAjoutEnCours(null);
    }
  };

  const tableRef = useRef<HTMLDivElement>(null);
  const focaliser = (ligne: number, colonne: string) => {
    tableRef.current?.querySelector<HTMLInputElement>(`input[data-ligne="${ligne}"][data-colonne="${colonne}"]`)?.focus();
  };

  const valeurCase = (ep: ExamenEpreuve, studentId: string): string => {
    const cle = cleCase(ep.id, studentId);
    if (cle in brouillons) return brouillons[cle];
    return texteDeLaNote(notes.find(n => n.epreuveId === ep.id && n.studentEnrollmentId === studentId));
  };

  const changerDecision = async (studentId: string, data: { decision?: Decision | null; mention?: Mention | null }) => {
    try {
      await choisirDecision(examen.id, studentId, data);
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    }
  };

  const afficherRang = tri === 'moyenne';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher un candidat…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8 w-52 h-8 text-sm" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {modifiable && <NouveauTour examenId={examen.id} />}
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
      </div>

      <div ref={tableRef} className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40">
              {afficherRang && <th rowSpan={2} className="w-12 px-2 text-center font-medium text-muted-foreground border-b">Rang</th>}
              <th rowSpan={2} className="sticky left-0 z-10 bg-muted min-w-[170px] px-3 py-2 text-left font-medium text-muted-foreground border-b border-r">Candidat</th>
              {colonnes.map(({ tour, epreuves: eps }) => (
                <th key={tour.id} colSpan={Math.max(eps.length, 1)} className="px-2 pt-2 pb-1 border-l border-b text-left">
                  <div className="flex items-center justify-between gap-2">
                    {modifiable ? <EnTeteTour tour={tour} nbEpreuves={eps.length} /> : <span className="font-semibold text-foreground whitespace-nowrap">{tour.name}</span>}
                    {modifiable && (
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0"
                        title={`Ajouter une épreuve en ${tour.name}`} aria-label={`Ajouter une épreuve en ${tour.name}`}
                        disabled={ajoutEnCours === tour.id} onClick={() => void ajouterEpreuve(tour, eps)}
                      >
                        {ajoutEnCours === tour.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </th>
              ))}
              <th rowSpan={2} className="min-w-[80px] px-3 text-center font-semibold border-l border-b bg-muted/60">
                Moyenne<div className="text-xs font-normal text-muted-foreground">/20</div>
              </th>
              <th rowSpan={2} className="min-w-[150px] px-2 text-center font-semibold border-b bg-muted/60">Décision</th>
              <th rowSpan={2} className="min-w-[130px] px-2 text-center font-semibold border-b bg-muted/60">Mention</th>
            </tr>
            <tr className="bg-muted/20">
              {colonnes.map(({ tour, epreuves: eps }) => eps.length === 0 ? (
                <th key={tour.id} className="px-2 py-1.5 border-l border-b text-xs font-normal text-muted-foreground/70 text-center italic">aucune épreuve</th>
              ) : eps.map((ep, i) => (
                <th key={ep.id} className={`px-1 py-1 border-b text-center min-w-[90px] ${i === 0 ? 'border-l' : ''}`}>
                  <EnTeteEpreuve
                    epreuve={ep} modifiable={modifiable}
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
            ) : lignes.map(({ eleve: s, etat, proposition, resultat, moyenne, decision, mention, rang }, iLigne) => (
              <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20">
                {afficherRang && <td className="text-center font-bold bg-primary/5">{rang ?? '—'}</td>}
                <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-r">
                  <div className="font-medium leading-tight">{s.lastName}</div>
                  <div className="text-xs text-muted-foreground">{s.firstName}</div>
                </td>
                {colonnes.map(({ tour, epreuves: eps }) => eps.length === 0 ? (
                  <td key={tour.id} className="border-l bg-muted/10" />
                ) : eps.map((ep, i) => {
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
                <td className={`text-center font-semibold border-l bg-muted/30 ${couleurMoyenne(moyenne, examen.seuilAdmission)}`}>
                  {moyenne === null ? '—' : format(moyenne)}
                  {etat.epreuvesEliminatoires.length > 0 && <div className="text-[10px] font-semibold uppercase text-red-600">Éliminé</div>}
                </td>
                <td className="px-2 py-1 bg-muted/30">
                  {verrouille ? (
                    <span className={`block text-center font-semibold ${decision ? COULEUR_DECISION[decision] : 'text-muted-foreground'}`}>
                      {decision ? LIBELLES_DECISION[decision] : '—'}
                    </span>
                  ) : (
                    <Select
                      value={resultat?.decision ?? AUTO}
                      onValueChange={v => void changerDecision(s.id, { decision: v === AUTO ? null : v as Decision })}
                    >
                      <SelectTrigger className={`h-8 text-xs ${decision ? COULEUR_DECISION[decision] : ''}`} aria-label={`Décision — ${s.lastName} ${s.firstName}`} title={proposition.motif}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AUTO}>
                          {proposition.decision ? `${LIBELLES_DECISION[proposition.decision]} (proposé)` : `À décider${proposition.motif ? ` — ${proposition.motif}` : ''}`}
                        </SelectItem>
                        {(Object.keys(LIBELLES_DECISION) as Decision[]).map(d => <SelectItem key={d} value={d}>{LIBELLES_DECISION[d]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="px-2 py-1 bg-muted/30">
                  {decision !== 'admis' ? (
                    <span className="block text-center text-muted-foreground">—</span>
                  ) : verrouille ? (
                    <span className="block text-center font-medium">{mention ? LIBELLES_MENTION[mention] : '—'}</span>
                  ) : (
                    <Select
                      value={resultat?.mention ?? AUTO}
                      onValueChange={v => void changerDecision(s.id, { mention: v === AUTO ? null : v as Mention })}
                    >
                      <SelectTrigger className="h-8 text-xs" aria-label={`Mention — ${s.lastName} ${s.firstName}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AUTO}>{proposition.mention ? `${LIBELLES_MENTION[proposition.mention]} (proposé)` : 'Sans mention'}</SelectItem>
                        {(Object.keys(LIBELLES_MENTION) as Mention[]).map(m => <SelectItem key={m} value={m}>{LIBELLES_MENTION[m]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Tapez la note, ou <strong>A</strong> (absent), <strong>AJ</strong> (absent justifié). Entrée passe au candidat suivant.
        Moyenne = notes sur 20 pondérées par les coefficients, tous tours confondus ; une épreuve sans note n'est jamais comptée 0.
        La décision est <em>proposée</em> (admission à {format(examen.seuilAdmission)}/20, note éliminatoire → refusé) : choisissez-en une autre dans la case si le jury en décide autrement.
      </p>
    </div>
  );
};

/** Titre d'une colonne d'épreuve — le directeur y règle nom, coefficient, barème, note éliminatoire, date et salle. */
const EnTeteEpreuve = ({ epreuve: ep, modifiable, ouvrirDemande, onOuvert }: {
  epreuve: ExamenEpreuve; modifiable: boolean; ouvrirDemande: boolean; onOuvert: () => void;
}) => {
  const { notes, updateEpreuve, deleteEpreuve } = useExamens();
  const [ouvert, setOuvert] = useState(false);
  const [f, setF] = useState({ nom: '', coefficient: '', bareme: '', seuil: '', date: '', heure: '', salle: '', examinateurs: '' });
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const notesSaisies = notes.filter(n => n.epreuveId === ep.id);

  const ouvrir = (o: boolean) => {
    if (o) {
      setF({
        nom: ep.nom, coefficient: String(ep.coefficient), bareme: String(ep.bareme),
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
const EnTeteTour = ({ tour, nbEpreuves }: { tour: ExamenTour; nbEpreuves: number }) => {
  const { updateTour, deleteTour } = useExamens();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState(tour.name);
  const [confirmer, setConfirmer] = useState(false);

  const renommer = async () => {
    if (!nomTourValide(nom)) return;
    try { await updateTour(tour.id, nom); setOuvert(false); }
    catch (err) { toast({ title: 'Erreur', description: String(err), variant: 'destructive' }); }
  };

  return (
    <>
      <Popover open={ouvert} onOpenChange={o => { if (o) setNom(tour.name); setOuvert(o); }}>
        <PopoverTrigger asChild>
          <button className="font-semibold text-foreground whitespace-nowrap rounded px-1 hover:bg-muted" title="Renommer ou supprimer ce tour">{tour.name}</button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`tour-${tour.id}`}>Nom du tour</Label>
            <Input id={`tour-${tour.id}`} value={nom} onChange={e => setNom(e.target.value)} onKeyDown={e => e.key === 'Enter' && void renommer()} />
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

/** « + Tour » : Écrit, Pratique, Oral… (directeur). */
const NouveauTour = ({ examenId }: { examenId: string }) => {
  const { addTour } = useExamens();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const creer = async () => {
    if (!nomTourValide(nom)) return;
    try { await addTour(examenId, nom); setNom(''); setOuvert(false); }
    catch (err) { toast({ title: 'Erreur', description: String(err), variant: 'destructive' }); }
  };
  return (
    <Popover open={ouvert} onOpenChange={setOuvert}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5"><Plus className="h-3.5 w-3.5" />Tour</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="nouveau-tour">Nom du tour</Label>
          <Input id="nouveau-tour" placeholder="Ex : Oral" value={nom} onChange={e => setNom(e.target.value)} onKeyDown={e => e.key === 'Enter' && void creer()} />
          <div className="flex gap-1.5 flex-wrap">
            {['Écrit', 'Pratique', 'Oral'].map(s => (
              <button key={s} type="button" onClick={() => setNom(s)} className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-muted/70">{s}</button>
            ))}
          </div>
        </div>
        <Button size="sm" className="w-full" onClick={() => void creer()}>Ajouter le tour</Button>
      </PopoverContent>
    </Popover>
  );
};
