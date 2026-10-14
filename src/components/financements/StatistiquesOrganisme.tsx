import { useMemo } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, Clock, FolderOpen, GraduationCap, Landmark, School, Users, BriefcaseBusiness } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  COULEUR_STATUT_DOSSIER, LIBELLES_STATUT_DOSSIER, STATUTS_DOSSIER, type Organisme,
} from '@/lib/financements';
import {
  alertesOrganisme, aujourdhuiIso, estInsere, insertionActuelle, situationFinanciere, sommeSituations,
} from '@/lib/financementsSuivi';
import { fmt, promotionsDe, type ApprenantFinance } from '@/components/financements/donneesOrganisme';

const taux = (n: number, sur: number) => (sur > 0 ? Math.round((n / sur) * 100) : 0);

/** Rubrique « Statistiques » : l'essentiel d'un organisme en un coup d'œil. */
export const StatistiquesOrganisme = ({ organisme, apprenants }: { organisme: Organisme; apprenants: ApprenantFinance[] }) => {
  const fin = useFinancements();
  const auj = aujourdhuiIso();

  const situations = useMemo(
    () => new Map(apprenants.map(a => [a.dossier.id, situationFinanciere(a.dossier.id, a.finance, fin.factures, fin.versements)])),
    [apprenants, fin.factures, fin.versements],
  );
  const total = sommeSituations([...situations.values()]);
  const valides = apprenants.filter(a => a.dossier.statut === 'valide').length;
  const promotions = promotionsDe(apprenants);
  const parPromotion = promotions.map(p => {
    const siens = apprenants.filter(a => a.promotion?.id === p.id);
    return { promotion: p, effectif: siens.length, s: sommeSituations(siens.map(a => situations.get(a.dossier.id)!)) };
  });
  const alertes = alertesOrganisme({
    organisme, dossiers: apprenants.map(a => a.dossier), factures: fin.factures, versements: fin.versements, rapports: fin.rapports,
    classeDe: d => apprenants.find(a => a.dossier.id === d.id)?.eleve.classId ?? undefined,
    promotions: promotions.map(p => ({ classId: p.classId, nom: p.name, finFormation: p.endDate })), aujourdhui: auj,
  });
  const insertions = apprenants.map(a => insertionActuelle(fin.insertions, a.dossier.id));
  const enFormation = apprenants.filter(a => a.dossier.situation === 'en_formation').length;
  const terminee = apprenants.filter(a => a.dossier.situation === 'terminee').length;

  return (
    <div className="p-5 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          ['Apprenants financés', String(apprenants.length), `${valides} dossier${valides > 1 ? 's' : ''} validé${valides > 1 ? 's' : ''}`, Users, 'bg-primary/10', 'text-primary', null],
          ['Pris en charge', fmt(total.finance), 'FCFA · dossiers validés', Landmark, 'bg-blue-500/10', 'text-blue-600', null],
          ["Reçu de l'organisme", fmt(total.recu), 'FCFA', Banknote, 'bg-green-500/10', 'text-green-600', taux(total.recu, total.finance)],
          ['Reste à encaisser', fmt(total.finance - total.recu), 'FCFA', Clock, 'bg-amber-500/10', 'text-amber-600', null],
        ] as const).map(([titre, valeur, aide, Icone, fond, couleur, pct]) => (
          <Card key={titre}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{titre}</p>
                  <p className="text-2xl font-bold mt-0.5">{valeur}</p>
                  {pct === null ? <p className="text-xs text-muted-foreground">{aide}</p> : (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Progress value={pct} className="h-1 w-12" />
                      <p className="text-xs text-muted-foreground">{pct}%</p>
                    </div>
                  )}
                </div>
                <div className={`p-2.5 rounded-xl ${fond}`}><Icone className={`h-5 w-5 ${couleur}`} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><School className="h-4 w-4 text-primary" />Par promotion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {parPromotion.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun apprenant rattaché pour l'instant.</p>
            ) : parPromotion.map(({ promotion, effectif, s }) => (
              <div key={promotion.id}>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="font-medium text-sm truncate">{promotion.name}</span>
                  <div className="flex items-center gap-3 text-sm flex-shrink-0">
                    <span className="text-muted-foreground text-xs">{effectif} apprenant{effectif > 1 ? 's' : ''}</span>
                    <span className="font-semibold">{fmt(s.recu)} <span className="text-xs font-normal text-muted-foreground">/ {fmt(s.finance)} FCFA</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={taux(s.recu, s.finance)} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground w-8 text-right">{taux(s.recu, s.finance)}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" />À traiter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertes.length === 0 ? (
              <p className="text-sm text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Rien à signaler.</p>
            ) : alertes.map(a => (
              <p key={a.texte} className={`text-sm flex items-start gap-2 ${a.niveau === 'rouge' ? 'text-red-700 dark:text-red-400' : 'text-amber-800 dark:text-amber-300'}`}>
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />{a.texte}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" />Dossiers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {STATUTS_DOSSIER.map(st => (
              <div key={st} className="flex items-center justify-between text-sm">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COULEUR_STATUT_DOSSIER[st]}`}>{LIBELLES_STATUT_DOSSIER[st]}</span>
                <span className="font-semibold">{apprenants.filter(a => a.dossier.statut === st).length}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" />Formation</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>En formation</span><span className="font-semibold">{enFormation}</span></div>
            <div className="flex justify-between"><span>Formation terminée</span><span className="font-semibold">{terminee}</span></div>
            <div className="flex justify-between"><span>Sortis (abandon, exclusion…)</span><span className="font-semibold text-red-600">{apprenants.length - enFormation - terminee}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-primary" />Insertion</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Insérés</span><span className="font-semibold text-green-700">{insertions.filter(p => p && estInsere(p.situation)).length}</span></div>
            <div className="flex justify-between"><span>En recherche d'emploi</span><span className="font-semibold">{insertions.filter(p => p?.situation === 'recherche').length}</span></div>
            <div className="flex justify-between"><span>Pas encore suivis</span><span className="font-semibold text-muted-foreground">{insertions.filter(p => !p).length}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
