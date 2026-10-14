import { useMemo } from 'react';
import { useFinancements } from '@/contexts/FinancementsContext';
import { useFormationPro } from '@/contexts/FormationProContext';
import { useSchool, type Student } from '@/contexts/SchoolContext';
import { useElementsAPayer } from '@/hooks/useElementsAPayer';
import { montantFinance, priseEnChargeEffective, type Dossier, type Organisme } from '@/lib/financements';
import type { Formation, Promotion } from '@/lib/formationPro';

// ═══════════════════════════════════════════════════════════════════════════
// Les apprenants d'UN organisme financeur, avec leur promotion, leur
// formation et ce que l'organisme prend en charge pour eux. Partagé par les
// quatre rubriques de l'espace d'un organisme (statistiques, apprenants,
// gestion financière, rapports).
// ═══════════════════════════════════════════════════════════════════════════

export interface ApprenantFinance {
  eleve: Student;
  dossier: Dossier;
  promotion?: Promotion;
  formation?: Formation;
  /** Ce que l'organisme prend en charge sur l'année : 0 tant que le dossier n'est pas validé. */
  finance: number;
}

export const nomComplet = (e: Pick<Student, 'lastName' | 'firstName'>) => `${e.lastName} ${e.firstName}`;

export const useApprenantsOrganisme = (o: Organisme | undefined): ApprenantFinance[] => {
  const fin = useFinancements();
  const { students } = useSchool();
  const { promotions, niveaux, formations } = useFormationPro();
  const { elementsDe } = useElementsAPayer();

  return useMemo(() => {
    if (!o) return [];
    const parId = new Map(students.map(s => [s.id, s]));
    return fin.dossiers
      .filter(d => d.organismeId === o.id)
      .flatMap(d => {
        const eleve = parId.get(d.studentEnrollmentId);
        if (!eleve) return [];
        const promotion = promotions.find(p => p.classId === eleve.classId);
        const niveau = promotion ? niveaux.find(n => n.id === promotion.niveauId) : undefined;
        const formation = niveau ? formations.find(f => f.id === niveau.formationId) : undefined;
        const finance = priseEnChargeEffective(d) ? montantFinance(o, elementsDe(eleve)).finance : 0;
        return [{ eleve, dossier: d, promotion, formation, finance }];
      })
      .sort((a, b) => a.eleve.lastName.localeCompare(b.eleve.lastName, 'fr') || a.eleve.firstName.localeCompare(b.eleve.firstName, 'fr'));
  }, [o, fin.dossiers, students, promotions, niveaux, formations, elementsDe]);
};

/** Les promotions où l'organisme a au moins un apprenant, dans l'ordre alphabétique. */
export const promotionsDe = (lignes: ApprenantFinance[]): Promotion[] =>
  [...new Map(lignes.filter(l => l.promotion).map(l => [l.promotion!.id, l.promotion!])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export const formationsDe = (lignes: ApprenantFinance[]): Formation[] =>
  [...new Map(lignes.filter(l => l.formation).map(l => [l.formation!.id, l.formation!])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
export const messageDe = (e: unknown) => (e as { message?: string })?.message ?? String(e);
