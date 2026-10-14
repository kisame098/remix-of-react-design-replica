import { useMemo, useState } from 'react';
import { BriefcaseBusiness, Filter, FolderOpen, GraduationCap, Grid3X3, List, Plus, Search, Users, X } from 'lucide-react';
import type { Student } from '@/contexts/SchoolContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  COULEUR_STATUT_DOSSIER, LIBELLES_SITUATION, LIBELLES_STATUT_DOSSIER, STATUTS_DOSSIER, type Organisme, type StatutDossier,
} from '@/lib/financements';
import { promotionsDe, type ApprenantFinance } from '@/components/financements/donneesOrganisme';
import { DialogAjouterApprenants } from '@/components/financements/DialogActiver';
import { DialogDossier } from '@/components/financements/DialogDossier';
import { DialogInsertion } from '@/components/financements/DialogInsertion';
import { DialogSuiviFormation } from '@/components/financements/DialogSuiviFormation';

type Vue = 'grille' | 'tableau';
type Fenetre = { kind: 'dossier' | 'insertion' | 'suivi'; eleve: Student };

const initiales = (e: Student) => `${e.firstName[0] ?? ''}${e.lastName[0] ?? ''}`.toUpperCase();

/** Les trois gestes sur un apprenant : son dossier, son insertion, le suivi de sa formation. */
const Actions = ({ eleve, ouvrir, avecLibelles }: { eleve: Student; ouvrir: (f: Fenetre) => void; avecLibelles?: boolean }) => (
  <>
    {([
      ['dossier', 'Dossier', FolderOpen],
      ['insertion', 'Insertion', BriefcaseBusiness],
      ['suivi', 'Suivi', GraduationCap],
    ] as const).map(([kind, libelle, Icone]) => (
      avecLibelles ? (
        <Button key={kind} variant="outline" size="sm" className="gap-1 px-2" onClick={() => ouvrir({ kind, eleve })}>
          <Icone className="w-4 h-4" />{libelle}
        </Button>
      ) : (
        <Button key={kind} variant="ghost" size="icon" title={libelle === 'Suivi' ? 'Suivi de la formation' : libelle} aria-label={`${libelle} — ${eleve.lastName} ${eleve.firstName}`} onClick={() => ouvrir({ kind, eleve })}>
          <Icone className="w-4 h-4" />
        </Button>
      )
    ))}
  </>
);

/** Rubrique « Apprenants » : les apprenants pris en charge par l'organisme. */
export const ApprenantsOrganisme = ({ organisme, apprenants }: { organisme: Organisme; apprenants: ApprenantFinance[] }) => {
  const [vue, setVue] = useState<Vue>('tableau');
  const [recherche, setRecherche] = useState('');
  const [promotion, setPromotion] = useState('toutes');
  const [statut, setStatut] = useState<'tous' | StatutDossier>('tous');
  const [fenetre, setFenetre] = useState<Fenetre | null>(null);
  const [ajouter, setAjouter] = useState(false);
  const promotions = promotionsDe(apprenants);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return apprenants.filter(a =>
      (promotion === 'toutes' || a.promotion?.id === promotion)
      && (statut === 'tous' || a.dossier.statut === statut)
      && (!q || `${a.eleve.lastName} ${a.eleve.firstName} ${a.eleve.studentId}`.toLowerCase().includes(q)));
  }, [apprenants, recherche, promotion, statut]);
  const filtre = recherche !== '' || promotion !== 'toutes' || statut !== 'tous';

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Un dossier ne compte qu'une fois <span className="font-medium text-foreground">validé</span> : d'ici là, l'apprenant paie ses frais en entier.
        </p>
        <Button size="sm" className="gap-2" onClick={() => setAjouter(true)}>
          <Plus className="h-3.5 w-3.5" />Ajouter des apprenants
        </Button>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, prénom ou ID..." value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-9" />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={promotion} onValueChange={setPromotion}>
                <SelectTrigger className="w-48" aria-label="Promotion"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="toutes">Toutes les promotions</SelectItem>
                  {promotions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statut} onValueChange={v => setStatut(v as typeof statut)}>
                <SelectTrigger className="w-40" aria-label="Dossier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous les dossiers</SelectItem>
                  {STATUTS_DOSSIER.map(s => <SelectItem key={s} value={s}>{LIBELLES_STATUT_DOSSIER[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              <Button variant={vue === 'grille' ? 'default' : 'ghost'} size="sm" onClick={() => setVue('grille')} className="gap-2">
                <Grid3X3 className="w-4 h-4" /><span className="hidden sm:inline">Grille</span>
              </Button>
              <Button variant={vue === 'tableau' ? 'default' : 'ghost'} size="sm" onClick={() => setVue('tableau')} className="gap-2">
                <List className="w-4 h-4" /><span className="hidden sm:inline">Tableau</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {filtre && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{visibles.length} résultat{visibles.length > 1 ? 's' : ''}</Badge>
          <Button variant="ghost" size="sm" className="text-muted-foreground h-7" onClick={() => { setRecherche(''); setPromotion('toutes'); setStatut('tous'); }}>
            <X className="w-3 h-3 mr-1" />Effacer les filtres
          </Button>
        </div>
      )}

      {apprenants.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Users className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucun apprenant pris en charge par {organisme.nom}</h3>
            <p className="text-muted-foreground mb-6">Ajoutez-les ici, ou un par un à l'inscription et dans Gestion des élèves.</p>
            <Button onClick={() => setAjouter(true)} className="gap-2"><Plus className="h-4 w-4" />Ajouter des apprenants</Button>
          </CardContent>
        </Card>
      ) : visibles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Search className="w-14 h-14 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Aucun résultat</h3>
            <p className="text-muted-foreground">Aucun apprenant ne correspond à votre recherche.</p>
          </CardContent>
        </Card>
      ) : vue === 'grille' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map(({ eleve: e, dossier: d, promotion: p }) => (
            <Card key={d.id} className="hover:shadow-lg transition-all hover:border-primary/50">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center mb-4">
                  <Avatar className="w-16 h-16 mb-3 ring-2 ring-primary/20">
                    <AvatarImage src={e.photoUrl} alt={`${e.firstName} ${e.lastName}`} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">{initiales(e)}</AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-foreground">{e.firstName} {e.lastName}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{e.studentId}</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  {p && <Badge variant="outline" className="gap-1"><GraduationCap className="w-3 h-3" />{p.name}</Badge>}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COULEUR_STATUT_DOSSIER[d.statut]}`}>Dossier {LIBELLES_STATUT_DOSSIER[d.statut].toLowerCase()}</span>
                </div>
                <Separator className="my-4" />
                <div className="flex justify-center gap-1.5"><Actions eleve={e} ouvrir={setFenetre} avecLibelles /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apprenant</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Promotion</TableHead>
                  <TableHead>Dossier</TableHead>
                  <TableHead>Situation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map(({ eleve: e, dossier: d, promotion: p }) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={e.photoUrl} alt={`${e.firstName} ${e.lastName}`} className="object-cover" />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">{initiales(e)}</AvatarFallback>
                        </Avatar>
                        <p className="font-medium text-foreground">{e.firstName} {e.lastName}</p>
                      </div>
                    </TableCell>
                    <TableCell><code className="text-sm bg-muted px-2 py-1 rounded">{e.studentId}</code></TableCell>
                    <TableCell>{p ? <Badge variant="outline">{p.name}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${COULEUR_STATUT_DOSSIER[d.statut]}`}>{LIBELLES_STATUT_DOSSIER[d.statut]}</span>
                    </TableCell>
                    <TableCell className={`text-sm whitespace-nowrap ${d.situation === 'en_formation' ? 'text-muted-foreground' : d.situation === 'terminee' ? 'text-green-700' : 'text-red-600 font-medium'}`}>
                      {LIBELLES_SITUATION[d.situation]}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1"><Actions eleve={e} ouvrir={setFenetre} /></div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DialogDossier eleve={fenetre?.kind === 'dossier' ? fenetre.eleve : null} onFermer={() => setFenetre(null)} />
      <DialogInsertion eleve={fenetre?.kind === 'insertion' ? fenetre.eleve : null} onFermer={() => setFenetre(null)} />
      <DialogSuiviFormation eleve={fenetre?.kind === 'suivi' ? fenetre.eleve : null} onFermer={() => setFenetre(null)} />
      <DialogAjouterApprenants ouvert={ajouter} organisme={organisme} onFermer={() => setAjouter(false)} />
    </div>
  );
};
