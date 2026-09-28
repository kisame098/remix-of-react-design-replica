import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import {
  baremeDuCycle, cycleDuNiveau, estDernierePeriodeDeLAnnee, lireConfigScolarite, nomPeriode, rangDeLaPeriode,
  type ConfigScolarite,
} from '@/lib/configScolarite';

/** La configuration scolaire de l'école (Paramètres → Scolarité). */
export function useConfigScolarite(): ConfigScolarite {
  const { school } = useAuth();
  return useMemo(() => lireConfigScolarite(school?.settings as Record<string, unknown> | undefined), [school?.settings]);
}

/**
 * Où en est l'année pour cette classe et cette période : « trimestre 2 sur 3 »,
 * et faut-il rendre la décision finale sur ce bulletin ?
 */
export function useFinDAnnee(periodId: string | undefined, classId: string | undefined) {
  const config = useConfigScolarite();
  const { classes, gradePeriods, isClassInPeriod } = useSchool();
  return useMemo(() => {
    const schoolClass = classes.find(c => c.id === classId);
    const period = gradePeriods.find(p => p.id === periodId);
    const cycle = cycleDuNiveau(schoolClass?.niveau);
    if (!schoolClass || !period || !cycle || period.type !== 'semester') return null;
    // Les périodes de notes de CETTE classe, cette année (une période d'examen ne compte pas).
    const deLAnnee = gradePeriods.filter(p => p.type === 'semester' && p.academicYearLabel === period.academicYearLabel);
    const liees = deLAnnee.filter(p => isClassInPeriod(p.id, schoolClass.id));
    const rang = rangDeLaPeriode(period.id, liees.length > 0 ? liees : deLAnnee);
    const { periodes, seuil } = config[cycle];
    return {
      rang,
      total: periodes,
      nom: nomPeriode(periodes),
      estDerniere: estDernierePeriodeDeLAnnee(rang, schoolClass.niveau, config),
      seuil,
      bareme: baremeDuCycle(cycle),
    };
  }, [config, classes, gradePeriods, isClassInPeriod, periodId, classId]);
}
