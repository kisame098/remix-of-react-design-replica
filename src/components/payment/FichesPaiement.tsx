import { useMemo, useState } from 'react';
import { useSchool, type Student } from '@/contexts/SchoolContext';
import { useFichesPaiement } from '@/hooks/useFichesPaiement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Printer, School, Search, User, Users } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// FICHES DE PAIEMENT — le relevé de l'année, pour un élève, une classe ou toute
// l'école, en un seul PDF (une fiche par page). Pensé pour la fin d'année :
// on peut ne sortir que les fiches des élèves qui ont encore un reste.
// Ni numérotées ni enregistrées : une photographie à la date d'impression.
// ═══════════════════════════════════════════════════════════════════════════

type Portee = 'eleve' | 'classe' | 'ecole';
type Filtre = 'tous' | 'reste' | 'solde';

const fmt = (n: number) => `${new Intl.NumberFormat('fr-FR').format(n)} F`;
const nomEleve = (e: Student) => `${e.lastName.toUpperCase()} ${e.firstName}`;

const FichesPaiement = () => {
  const { students, classes } = useSchool();
  const { ficheDe, montrerFiches, dialogueFiches } = useFichesPaiement();

  const [portee, setPortee] = useState<Portee>('classe');
  const [classeId, setClasseId] = useState('');
  const [recherche, setRecherche] = useState('');
  const [eleveId, setEleveId] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('tous');

  const nomClasse = (id: string | null) => (id ? classes.find(c => c.id === id)?.name : undefined);

  const cibles = useMemo((): Student[] => {
    if (portee === 'ecole') return students;
    if (portee === 'classe') return classeId ? students.filter(s => s.classId === classeId) : [];
    return eleveId ? students.filter(s => s.id === eleveId) : [];
  }, [portee, classeId, eleveId, students]);

  const fiches = useMemo(() => cibles
    .map(ficheDe)
    .filter(f => filtre === 'tous' || (filtre === 'reste' ? !f.bilan.solde : f.bilan.solde))
    .sort((a, b) => (a.eleve.classe ?? '').localeCompare(b.eleve.classe ?? '') || a.eleve.nom.localeCompare(b.eleve.nom)),
  [cibles, ficheDe, filtre]);

  const totaux = fiches.reduce((t, f) => ({ reste: t.reste + f.bilan.reste, soldes: t.soldes + (f.bilan.solde ? 1 : 0) }), { reste: 0, soldes: 0 });

  const elevesTrouves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 2) return [];
    return students.filter(s => `${s.firstName} ${s.lastName} ${s.lastName} ${s.firstName} ${s.studentId}`.toLowerCase().includes(q)).slice(0, 8);
  }, [recherche, students]);

  const imprimer = () => {
    const portion = portee === 'ecole' ? 'ecole' : portee === 'classe' ? (nomClasse(classeId) ?? 'classe') : (fiches[0]?.eleve.nom ?? 'eleve');
    montrerFiches(
      fiches,
      fiches.length === 1 ? `Fiche de paiement — ${fiches[0].eleve.nom}` : `${fiches.length} fiches de paiement`,
      `Fiches_paiement_${portion}`,
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Fiches de paiement</CardTitle>
        <p className="text-sm text-muted-foreground">
          Le relevé de l'année de chaque élève : tous ses frais, mois par mois, ce qui est payé (avec les numéros de
          reçus) et ce qui reste. Une fiche porte « SOLDÉ » ou le reste à payer. À distribuer en fin d'année, ou à la demande.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border p-0.5 bg-muted/30 w-fit">
            {([['eleve', 'Un élève', User], ['classe', 'Une classe', Users], ['ecole', 'Toute l\'école', School]] as const).map(([id, label, Icone]) => (
              <button key={id} type="button" onClick={() => setPortee(id)}
                className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 transition-colors ${portee === id ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icone className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
          {portee !== 'eleve' && (
            <div className="flex rounded-lg border p-0.5 bg-muted/30 w-fit">
              {([['tous', 'Tous les élèves'], ['reste', 'Avec un reste'], ['solde', 'Soldés']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setFiltre(id)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filtre === id ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {portee === 'classe' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Classe</Label>
              <Select value={classeId} onValueChange={setClasseId}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {portee === 'eleve' && (
            <div className="space-y-1.5 relative">
              <Label className="text-xs">Élève</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Nom ou matricule…" value={recherche}
                  onChange={e => { setRecherche(e.target.value); setEleveId(null); }} />
              </div>
              {!eleveId && elevesTrouves.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border bg-popover shadow-md">
                  {elevesTrouves.map(s => (
                    <button key={s.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => { setEleveId(s.id); setRecherche(`${nomEleve(s)} — ${nomClasse(s.classId) ?? 'sans classe'}`); }}>
                      <span className="font-medium">{nomEleve(s)}</span>
                      <span className="text-muted-foreground"> · {s.studentId} · {nomClasse(s.classId) ?? 'sans classe'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <p className="text-sm">
            {cibles.length === 0 ? (
              <span className="text-muted-foreground">Choisissez {portee === 'classe' ? 'une classe' : 'un élève'}.</span>
            ) : fiches.length === 0 ? (
              <span className="text-muted-foreground">Aucun élève ne correspond à ce filtre.</span>
            ) : (
              <>
                <span className="font-semibold">{fiches.length} fiche{fiches.length > 1 ? 's' : ''}</span>
                {' · '}{totaux.soldes} soldée{totaux.soldes > 1 ? 's' : ''}
                {totaux.reste > 0 && <> · reste total <span className="font-semibold">{fmt(totaux.reste)}</span></>}
              </>
            )}
          </p>
          <Button className="gap-2" disabled={fiches.length === 0} onClick={imprimer}>
            <Printer className="h-4 w-4" /> Imprimer les fiches
          </Button>
        </div>
      </CardContent>
      {dialogueFiches}
    </Card>
  );
};

export default FichesPaiement;
