import { useMemo } from 'react';
import { AlertTriangle, BriefcaseBusiness, FileWarning, UserMinus, Users } from 'lucide-react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useAttendance } from '@/contexts/AttendanceContext';
import { useElementsAPayer } from '@/hooks/useElementsAPayer';
import { montantFinance, situationAvecMotif } from '@/lib/financements';
import {
  alertesCohorte, assiduite, aujourdhuiIso, estInsere, insertionActuelle, situationFinanciere, sommeSituations,
  type SituationFinanciere,
} from '@/lib/financementsSuivi';
import { CartesSituation } from '@/components/financements/OngletFinances';

// ═══════════════════════════════════════════════════════════════════════════
// Tableau de bord des Financements : l'état de l'école d'un coup d'œil, puis
// une ligne par cohorte financée (groupées par formation) — effectifs,
// dossiers, sorties, assiduité, argent et insertion. C'est l'état de synthèse
// à présenter à l'organisme.
// ═══════════════════════════════════════════════════════════════════════════

const fmt = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} F`;

interface LigneCohorte {
  promotionId: string;
  nom: string;
  formation: string;
  beneficiaires: number;
  valides: number;
  aTraiter: number;
  sortis: number;
  assiduite: number | null;
  inseres: number;
  finances: SituationFinanciere;
  alertes: number;
}

export const TableauBordFinancements = () => {
  const fin = useFinancements();
  const { promotions, niveaux, formations } = useFormationPro();
  const { students } = useSchool();
  const { studentAttendances } = useAttendance();
  const { elementsDe } = useElementsAPayer();
  const auj = aujourdhuiIso();

  const cohortes = useMemo((): LigneCohorte[] => promotions.flatMap(p => {
    const eleves = students.filter(s => s.classId === p.classId);
    const lignes = eleves.flatMap(e => {
      const d = fin.dossierDe(e.id);
      return d ? [{ e, d, o: fin.organisme(d.organismeId) }] : [];
    });
    if (lignes.length === 0) return [];
    const niveau = niveaux.find(n => n.id === p.niveauId);
    const formation = formations.find(f => f.id === niveau?.formationId);
    const facturesPromo = fin.factures.filter(f => f.classId === p.classId);
    const finances = sommeSituations(lignes.map(({ e, d, o }) => situationFinanciere(
      d.id, o ? montantFinance(o, elementsDe(e)).finance : 0, facturesPromo, fin.versements,
    )));
    const taux = lignes.map(({ e }) => assiduite(studentAttendances, e.id).taux).filter((t): t is number => t !== null);
    return [{
      promotionId: p.id, nom: p.name, formation: formation?.name ?? 'Formation',
      beneficiaires: lignes.length,
      valides: lignes.filter(x => x.d.statut === 'valide').length,
      aTraiter: lignes.filter(x => x.d.statut === 'en_attente' || x.d.statut === 'a_regulariser').length,
      sortis: lignes.filter(x => situationAvecMotif(x.d.situation)).length,
      assiduite: taux.length ? Math.round(taux.reduce((a, b) => a + b, 0) / taux.length) : null,
      inseres: lignes.filter(x => { const pt = insertionActuelle(fin.insertions, x.d.id); return !!pt && estInsere(pt.situation); }).length,
      finances,
      alertes: alertesCohorte({
        dossiers: lignes.map(x => x.d), organismes: fin.reglages.organismes, factures: facturesPromo, versements: fin.versements,
        rapports: fin.rapports, classId: p.classId, finFormation: p.endDate, aujourdhui: auj,
      }).length,
    }];
  }), [promotions, students, niveaux, formations, fin, elementsDe, studentAttendances, auj]);

  if (cohortes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
        Aucun apprenant financé pour l'instant. Ouvrez une promotion ci-dessous et cliquez sur « Activer un financement », ou faites-le à l'inscription.
      </div>
    );
  }

  const total = {
    beneficiaires: cohortes.reduce((s, c) => s + c.beneficiaires, 0),
    aTraiter: cohortes.reduce((s, c) => s + c.aTraiter, 0),
    sortis: cohortes.reduce((s, c) => s + c.sortis, 0),
    inseres: cohortes.reduce((s, c) => s + c.inseres, 0),
    alertes: cohortes.reduce((s, c) => s + c.alertes, 0),
  };
  const parFormation = [...new Set(cohortes.map(c => c.formation))].sort((a, b) => a.localeCompare(b, 'fr'));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {([
          [Users, 'Bénéficiaires', total.beneficiaires, 'text-foreground'],
          [FileWarning, 'Dossiers à traiter', total.aTraiter, total.aTraiter ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'],
          [UserMinus, 'Sortis de formation', total.sortis, total.sortis ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'],
          [BriefcaseBusiness, 'Insérés', total.inseres, 'text-green-700 dark:text-green-400'],
        ] as const).map(([Icone, titre, n, couleur]) => (
          <div key={titre} className="rounded-xl border bg-card p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icone className="h-4 w-4" /></div>
            <div><p className="text-xs text-muted-foreground">{titre}</p><p className={`text-xl font-bold ${couleur}`}>{n}</p></div>
          </div>
        ))}
      </div>
      {fin.suiviDisponible && <CartesSituation s={sommeSituations(cohortes.map(c => c.finances))} />}

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium min-w-[180px]">Cohorte</th>
              <th className="px-3 py-2 font-medium text-center">Bénéficiaires</th>
              <th className="px-3 py-2 font-medium text-center">Dossiers validés</th>
              <th className="px-3 py-2 font-medium text-center">Sortis</th>
              <th className="px-3 py-2 font-medium text-center">Assiduité</th>
              <th className="px-3 py-2 font-medium text-right">Pris en charge</th>
              <th className="px-3 py-2 font-medium text-right">Reçu</th>
              <th className="px-3 py-2 font-medium text-center">Insérés</th>
              <th className="px-3 py-2 font-medium text-center">Alertes</th>
            </tr>
          </thead>
          <tbody>
            {parFormation.flatMap(formation => [
              <tr key={`f-${formation}`} className="border-t bg-muted/20">
                <td colSpan={9} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{formation}</td>
              </tr>,
              ...cohortes.filter(c => c.formation === formation).map(c => (
                <tr key={c.promotionId} className="border-t">
                  <td className="px-3 py-2 font-medium">{c.nom}</td>
                  <td className="px-3 py-2 text-center">{c.beneficiaires}</td>
                  <td className="px-3 py-2 text-center">{c.valides}<span className="text-muted-foreground">/{c.beneficiaires}</span></td>
                  <td className={`px-3 py-2 text-center ${c.sortis ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>{c.sortis}</td>
                  <td className={`px-3 py-2 text-center ${c.assiduite === null ? 'text-muted-foreground' : c.assiduite < 80 ? 'text-amber-700 font-medium' : ''}`}>{c.assiduite === null ? '—' : `${c.assiduite} %`}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(c.finances.finance)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-green-700 dark:text-green-400">{fmt(c.finances.recu)}</td>
                  <td className="px-3 py-2 text-center">{c.inseres}</td>
                  <td className="px-3 py-2 text-center">
                    {c.alertes > 0 ? <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-medium"><AlertTriangle className="h-3.5 w-3.5" />{c.alertes}</span> : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
};
