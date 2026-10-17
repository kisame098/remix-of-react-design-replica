import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, Globe, Loader2, PencilLine, RefreshCw, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { MODELES_SITE } from '@/siteEcole/contenu';
import { adresseSiteEcole } from '@/lib/hoteEcole';

// La nouvelle RPC n'est pas encore dans les types générés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/** Une ligne de platform_sites_ecoles() (docs/sql/platform_sites_ecoles.sql). */
export interface SiteEcoleLigne {
  school_id: string;
  ecole: string;
  ville: string | null;
  slug: string | null;
  modele: string | null;
  nom_site: string | null;
  en_ligne: boolean;
  publie_le: string | null;
  modifie_le: string | null;
  modifications_en_attente: boolean;
}

type Filtre = 'tous' | 'en_ligne' | 'hors_ligne';
const FILTRES: { cle: Filtre; label: string }[] = [
  { cle: 'tous', label: 'Tous' },
  { cle: 'en_ligne', label: 'En ligne' },
  { cle: 'hors_ligne', label: 'Pas en ligne' },
];

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const nomModele = (m: string | null) => (m && m in MODELES_SITE ? MODELES_SITE[m as keyof typeof MODELES_SITE].nom : '—');

/** Filtre + recherche (nom de l'école, nom affiché sur le site, adresse, ville). */
export const filtrerSites = (sites: SiteEcoleLigne[], filtre: Filtre, recherche: string): SiteEcoleLigne[] => {
  const q = recherche.trim().toLowerCase();
  return sites.filter(s =>
    (filtre === 'tous' || (filtre === 'en_ligne') === s.en_ligne) &&
    (!q || [s.ecole, s.nom_site, s.slug, s.ville].some(v => v?.toLowerCase().includes(q))));
};

/** Plateforme → Sites web : tous les sites créés par les écoles. */
const PlatformSitesWeb = () => {
  const [sites, setSites] = useState<SiteEcoleLigne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    const { data, error } = await sb.rpc('platform_sites_ecoles');
    if (error) toast({ title: 'Sites indisponibles', description: error.message, variant: 'destructive' });
    else setSites((data ?? []) as SiteEcoleLigne[]);
    setChargement(false);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const liste = useMemo(() => filtrerSites(sites, filtre, recherche), [sites, filtre, recherche]);
  const enLigne = sites.filter(s => s.en_ligne).length;
  const enAttente = sites.filter(s => s.modifications_en_attente).length;

  const chiffres = [
    { label: 'Sites créés', valeur: sites.length, classe: 'text-foreground' },
    { label: 'En ligne', valeur: enLigne, classe: 'text-emerald-600' },
    { label: 'Pas encore en ligne', valeur: sites.length - enLigne, classe: 'text-slate-500' },
    { label: 'Modifications à publier', valeur: enAttente, classe: 'text-amber-600' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Globe className="h-6 w-6 text-primary" />Sites web</h1>
          <p className="text-sm text-muted-foreground">Les sites internet créés par les écoles, sur leur adresse &lt;école&gt;.senclass.com</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={charger} disabled={chargement}>
          {chargement ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {chiffres.map(c => (
          <Card key={c.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.classe}`}>{chargement ? '—' : c.valeur}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {FILTRES.map(f => (
            <Button key={f.cle} size="sm" variant={filtre === f.cle ? 'default' : 'outline'} onClick={() => setFiltre(f.cle)}>{f.label}</Button>
          ))}
        </div>
        <div className="relative w-full sm:w-72 sm:ml-auto">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="École, adresse, ville…" className="pl-8" aria-label="Rechercher un site" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {chargement ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" />Chargement…</div>
          ) : liste.length === 0 ? (
            <p className="text-center py-16 text-muted-foreground text-sm">
              {sites.length === 0 ? 'Aucune école n\'a encore créé de site.' : 'Aucun site pour ce filtre.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>École</TableHead>
                  <TableHead>Adresse du site</TableHead>
                  <TableHead>Modèle</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Publié le</TableHead>
                  <TableHead>Dernière modification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map(s => {
                  const adresse = s.slug ? adresseSiteEcole(s.slug, window.location.hostname, window.location.origin) : null;
                  return (
                    <TableRow key={s.school_id}>
                      <TableCell className="font-medium">
                        <Link to={`/platform/ecoles/${s.school_id}`} className="hover:underline text-primary">{s.ecole}</Link>
                        <div className="text-xs text-muted-foreground font-normal">
                          {[s.nom_site && s.nom_site !== s.ecole ? `« ${s.nom_site} » sur le site` : null, s.ville].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.en_ligne && adresse ? (
                          <a href={adresse} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline break-all">
                            {s.slug}.senclass.com<ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{s.slug ? `${s.slug}.senclass.com` : 'Pas encore choisie'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{nomModele(s.modele)}</TableCell>
                      <TableCell>
                        {s.en_ligne
                          ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />En ligne</span>
                          : <span className="inline-flex rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-medium">Pas en ligne</span>}
                        {s.modifications_en_attente && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700"><PencilLine className="h-3 w-3" />Modifications à publier</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{date(s.publie_le)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{date(s.modifie_le)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformSitesWeb;
