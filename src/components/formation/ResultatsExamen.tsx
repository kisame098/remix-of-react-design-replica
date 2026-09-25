import { useMemo, useState } from 'react';
import { useExamens } from '@/contexts/ExamensContext';
import type { Student } from '@/contexts/SchoolContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowUpDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  type Examen, type ExamenEpreuve, type ExamenTour, type NiveauMatiere, type Decision, type Mention,
  etatCandidat, bilanCandidat, decisionRetenue, mentionRetenue, LIBELLES_DECISION, LIBELLES_MENTION,
} from '@/lib/formationPro';

const format = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');
const couleur = (m: number | null, seuil: number) => m === null ? 'text-muted-foreground' : m >= seuil ? 'text-green-600' : 'text-red-500';
const COULEUR_DECISION: Record<Decision, string> = { admis: 'text-green-700', ajourne: 'text-amber-700', refuse: 'text-red-600' };
const AUTO = '__auto';

type Tri = 'defaut' | 'nom' | 'moyenne';

interface Props {
  examen: Examen;
  /** Toutes les épreuves de l'examen. */
  epreuves: ExamenEpreuve[];
  /** Les tours de l'examen : chacun a sa moyenne exigée (admissibilité avant le dernier). */
  tours: ExamenTour[];
  /** Les matières qui ont au moins une épreuve dans l'examen, dans l'ordre du programme. */
  matieres: NiveauMatiere[];
  candidats: Student[];
  onChoisirMatiere: (id: string | null) => void;
}

/**
 * Le tableau du jury : pour chaque candidat, la note de chaque matière,
 * la moyenne générale (épreuves pondérées par leur coefficient), puis la
 * décision et la mention — PROPOSÉES par le logiciel, que le jury garde ou
 * change dans la case. Figé une fois l'examen verrouillé.
 */
export const ResultatsExamen = ({ examen, epreuves, tours, matieres, candidats, onChoisirMatiere }: Props) => {
  const { notes, resultats, choisirDecision } = useExamens();
  const verrouille = examen.verrouille;
  const horsProgramme = epreuves.filter(e => !e.niveauMatiereId);

  const lignesBrutes = useMemo(() => candidats.map(s => {
    const bilan = bilanCandidat(tours, epreuves, notes, s.id, examen.seuilAdmission);
    const { etat, proposition } = bilan;
    const resultat = resultats.find(r => r.examenId === examen.id && r.studentEnrollmentId === s.id);
    const parMatiere = new Map(matieres.map(m => [m.id, etatCandidat(epreuves.filter(e => e.niveauMatiereId === m.id), notes, s.id)]));
    return {
      eleve: s, etat, proposition, resultat, parMatiere, bilan,
      horsProgramme: horsProgramme.length > 0 ? etatCandidat(horsProgramme, notes, s.id) : null,
      moyenne: verrouille && resultat ? resultat.moyenne ?? null : etat.moyenne,
      decision: decisionRetenue(resultat, proposition),
      mention: mentionRetenue(resultat, proposition),
    };
  }), [candidats, epreuves, tours, notes, examen.seuilAdmission, examen.id, resultats, verrouille, matieres, horsProgramme]);
  // Plusieurs tours : une colonne par tour (moyenne, admissible ou non).
  const toursAffiches = lignesBrutes[0]?.bilan.tours ?? [];
  const plusieursTours = toursAffiches.length > 1;

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

  const changer = async (studentId: string, data: { decision?: Decision | null; mention?: Mention | null }) => {
    try { await choisirDecision(examen.id, studentId, data); }
    catch (err) { toast({ title: 'Erreur', description: String(err), variant: 'destructive' }); }
  };

  const celluleNote = (e: ReturnType<typeof etatCandidat> | null | undefined, key: string) => {
    const m = e?.moyenne ?? null;
    const elim = (e?.epreuvesEliminatoires.length ?? 0) > 0;
    return (
      <td key={key} className={`text-center ${elim ? 'bg-red-50 dark:bg-red-950/30 text-red-600 font-semibold' : couleur(m, examen.seuilAdmission)}`}
        title={elim ? 'Note éliminatoire' : undefined}>
        {m === null ? '—' : format(m)}
      </td>
    );
  };

  const afficherRang = tri === 'moyenne';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher un candidat…" value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-8 w-52 h-8 text-sm" />
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

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40">
              {afficherRang && <th className="w-12 px-2 text-center font-medium text-muted-foreground border-b">Rang</th>}
              <th className="sticky left-0 z-10 bg-muted min-w-[170px] px-3 py-2 text-left font-medium text-muted-foreground border-b border-r">Candidat</th>
              {matieres.map(m => (
                <th key={m.id} className="px-2 py-2 border-b text-center min-w-[80px]">
                  <button onClick={() => onChoisirMatiere(m.id)} className="text-xs font-medium text-foreground hover:text-primary hover:underline" title={`Saisir ${m.matiereName}`}>
                    {m.matiereName}
                  </button>
                  <div className="text-[11px] font-normal text-muted-foreground">
                    ×{epreuves.filter(e => e.niveauMatiereId === m.id).reduce((t, e) => t + e.coefficient, 0)}
                  </div>
                </th>
              ))}
              {horsProgramme.length > 0 && (
                <th className="px-2 py-2 border-b text-center min-w-[80px]">
                  <button onClick={() => onChoisirMatiere(null)} className="text-xs font-medium text-foreground hover:text-primary hover:underline">Autres épreuves</button>
                </th>
              )}
              {plusieursTours && toursAffiches.map(bt => (
                <th key={bt.tour.id} className="min-w-[90px] px-2 text-center font-semibold border-l border-b bg-muted/40">
                  <div className="text-xs">{bt.tour.name}</div>
                  <div className="text-[11px] font-normal text-muted-foreground">moy. exigée {format(bt.moyenneExigee)}</div>
                </th>
              ))}
              <th className="min-w-[80px] px-3 text-center font-semibold border-l border-b bg-muted/60">Moyenne<div className="text-xs font-normal text-muted-foreground">{plusieursTours ? 'générale /20' : '/20'}</div></th>
              <th className="min-w-[150px] px-2 text-center font-semibold border-b bg-muted/60">Décision</th>
              <th className="min-w-[130px] px-2 text-center font-semibold border-b bg-muted/60">Mention</th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 ? (
              <tr><td colSpan={99} className="text-center py-8 text-muted-foreground">
                {candidats.length === 0 ? 'Aucun candidat — ajoutez-en avec le bouton « Candidats ».' : `Aucun candidat trouvé pour « ${recherche} »`}
              </td></tr>
            ) : lignes.map(({ eleve: s, etat, proposition, resultat, parMatiere, horsProgramme: autres, moyenne, decision, mention, rang, bilan }) => (
              <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/20">
                {afficherRang && <td className="text-center font-bold bg-primary/5">{rang ?? '—'}</td>}
                <td className="sticky left-0 z-10 bg-background px-3 py-1.5 border-r">
                  <div className="font-medium leading-tight">{s.lastName}</div>
                  <div className="text-xs text-muted-foreground">{s.firstName}</div>
                </td>
                {matieres.map(m => celluleNote(parMatiere.get(m.id), m.id))}
                {autres && celluleNote(autres, 'autres')}
                {plusieursTours && bilan.tours.map((bt, i) => {
                  const dernier = i === bilan.tours.length - 1;
                  return (
                    <td key={bt.tour.id} className="text-center border-l bg-muted/10">
                      <div className={`font-semibold ${couleur(bt.etat.moyenne, bt.moyenneExigee)}`}>{bt.etat.moyenne === null ? '—' : format(bt.etat.moyenne)}</div>
                      {!dernier && bt.atteint !== null && (
                        <div className={`text-[10px] font-semibold uppercase ${bt.atteint ? 'text-green-700' : 'text-red-600'}`}>{bt.atteint ? 'Admissible' : 'Non admissible'}</div>
                      )}
                    </td>
                  );
                })}
                <td className={`text-center font-semibold border-l bg-muted/30 ${couleur(moyenne, examen.seuilAdmission)}`}>
                  {moyenne === null ? '—' : format(moyenne)}
                  {etat.epreuvesEliminatoires.length > 0 && <div className="text-[10px] font-semibold uppercase text-red-600">Éliminé</div>}
                </td>
                <td className="px-2 py-1 bg-muted/30">
                  {verrouille ? (
                    <span className={`block text-center font-semibold ${decision ? COULEUR_DECISION[decision] : 'text-muted-foreground'}`}>
                      {decision ? LIBELLES_DECISION[decision] : '—'}
                    </span>
                  ) : (
                    <Select value={resultat?.decision ?? AUTO} onValueChange={v => void changer(s.id, { decision: v === AUTO ? null : v as Decision })}>
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
                    <Select value={resultat?.mention ?? AUTO} onValueChange={v => void changer(s.id, { mention: v === AUTO ? null : v as Mention })}>
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
        Moyenne = toutes les épreuves sur 20, pondérées par leur coefficient ; une épreuve sans note n'est jamais comptée 0.
        La décision est <em>proposée</em> (admission à {format(examen.seuilAdmission)}/20, note éliminatoire → refusé) : choisissez-en une autre si le jury en décide autrement.
      </p>
    </div>
  );
};
