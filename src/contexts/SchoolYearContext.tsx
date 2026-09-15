import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
// Stocké dans la table `school_years` (Supabase), scopée par school_id — partagée
// par TOUS les appareils (admin, personnel, élèves, profs). Auparavant géré en
// localStorage : chaque navigateur calculait sa propre année par défaut, ce qui
// désynchronisait le compte élève (portail) de l'admin (ex: QR généré pour un
// mois "hors année scolaire" côté élève, introuvable côté admin).

export interface SchoolYear {
  id: string;        // Label "2024-2025" — utilisé comme academic_year_label en DB
  name: string;      // "Année Scolaire 2024-2025"
  startDate: string; // ISO "2024-09-01"
  endDate: string;   // ISO "2025-07-31"
  isClosed: boolean;
  closedAt?: string;
  createdAt: string;
}

interface SchoolYearContextType {
  schoolYears: SchoolYear[];
  currentYear: SchoolYear | null;
  yearsLoading: boolean;
  setCurrentYear: (year: SchoolYear) => void;
  createSchoolYear: (startYear: number) => SchoolYear;
  closeSchoolYear: (yearId: string) => void;
  reopenSchoolYear: (yearId: string) => void;
  getSchoolYear: (yearId: string) => SchoolYear | undefined;
  updateSchoolYear: (yearId: string, updates: Partial<Pick<SchoolYear, 'startDate' | 'endDate'>>) => void;
  isCurrentYearClosed: boolean;
}

const LS_SELECTED_YEAR_KEY = 'current_school_year';

const SchoolYearContext = createContext<SchoolYearContextType | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mapRow = (r: {
  label: string; name: string; start_date: string; end_date: string;
  is_closed: boolean; closed_at: string | null; created_at: string;
}): SchoolYear => ({
  id:        r.label,
  name:      r.name,
  startDate: r.start_date,
  endDate:   r.end_date,
  isClosed:  r.is_closed,
  closedAt:  r.closed_at ?? undefined,
  createdAt: r.created_at,
});

const buildDefault = (startYear: number): SchoolYear => ({
  id:        `${startYear}-${startYear + 1}`,
  name:      `Année Scolaire ${startYear}-${startYear + 1}`,
  startDate: `${startYear}-09-01`,
  endDate:   `${startYear + 1}-07-31`,
  isClosed:  false,
  createdAt: new Date().toISOString(),
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export const SchoolYearProvider = ({ children }: { children: ReactNode }) => {
  const { school, isSchoolAccessBlocked } = useAuth();
  const schoolId: string | null = school?.id ?? null;

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [yearsLoading, setYearsLoading] = useState(true);

  // Sélection d'affichage (quelle année consulter) — préférence locale à
  // l'appareil, ne concerne que la navigation admin entre années archivées.
  const [selectedLabel, setSelectedLabel] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_SELECTED_YEAR_KEY); } catch { return null; }
  });

  // Charger les années scolaires de l'école depuis la base — commun à tous les
  // comptes (admin, personnel, élèves, profs via school_accounts).
  useEffect(() => {
    let cancelled = false;
    if (!schoolId) { setSchoolYears([]); setYearsLoading(false); return; }

    setYearsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('school_years')
        .select('label, name, start_date, end_date, is_closed, closed_at, created_at')
        .eq('school_id', schoolId)
        .order('label', { ascending: false });

      if (cancelled) return;

      let years: SchoolYear[] = !error && data ? data.map(mapRow) : [];

      // Aucune année configurée pour cette école → amorcer une année par défaut.
      // Échoue silencieusement pour un compte élève/prof (RLS en lecture seule) :
      // l'admin sera celui qui l'initialise à sa première connexion.
      // Même piège qu'ailleurs : une liste vide peut simplement vouloir dire
      // « accès fermé par l'abonnement ». On n'amorce pas dans ce cas.
      if (years.length === 0 && !isSchoolAccessBlocked) {
        const now       = new Date();
        const startYear = now.getMonth() < 8 ? now.getFullYear() - 1 : now.getFullYear();
        const draft     = buildDefault(startYear);
        const { data: inserted, error: insErr } = await supabase
          .from('school_years')
          .insert({
            school_id:  schoolId,
            label:      draft.id,
            name:       draft.name,
            start_date: draft.startDate,
            end_date:   draft.endDate,
            is_closed:  false,
          })
          .select('label, name, start_date, end_date, is_closed, closed_at, created_at')
          .single();
        if (!insErr && inserted && !cancelled) years = [mapRow(inserted)];
      }

      if (!cancelled) { setSchoolYears(years); setYearsLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [schoolId, isSchoolAccessBlocked]);

  // ── Année courante affichée ──────────────────────────────────────────────
  const currentYear = useMemo(() => {
    if (schoolYears.length === 0) return null;
    const bySelection = selectedLabel ? schoolYears.find(y => y.id === selectedLabel) : undefined;
    return bySelection ?? schoolYears.find(y => !y.isClosed) ?? schoolYears[0];
  }, [schoolYears, selectedLabel]);

  useEffect(() => {
    if (!currentYear) return;
    try { localStorage.setItem(LS_SELECTED_YEAR_KEY, currentYear.id); } catch { /* ignore */ }
  }, [currentYear]);

  // ── Actions ────────────────────────────────────────────────────────────────
  // Mise à jour optimiste de l'état local + écriture en base en arrière-plan,
  // pour garder les mêmes signatures synchrones qu'avant (aucun appelant à
  // modifier) tout en partageant la source de vérité entre tous les appareils.

  const setCurrentYear = (year: SchoolYear) => setSelectedLabel(year.id);

  const createSchoolYear = (startYear: number): SchoolYear => {
    const id = `${startYear}-${startYear + 1}`;
    const existing = schoolYears.find(y => y.id === id);
    if (existing) return existing;

    const newYear = buildDefault(startYear);
    setSchoolYears(prev => [newYear, ...prev].sort((a, b) => b.id.localeCompare(a.id)));

    if (schoolId) {
      supabase.from('school_years').insert({
        school_id:  schoolId,
        label:      newYear.id,
        name:       newYear.name,
        start_date: newYear.startDate,
        end_date:   newYear.endDate,
        is_closed:  false,
      }).then(({ error }) => { if (error) console.error('Erreur création année scolaire:', error); });
    }
    return newYear;
  };

  const closeSchoolYear = (yearId: string) => {
    const closedAt = new Date().toISOString();
    setSchoolYears(prev => prev.map(y => y.id === yearId ? { ...y, isClosed: true, closedAt } : y));
    if (schoolId) {
      supabase.from('school_years')
        .update({ is_closed: true, closed_at: closedAt })
        .eq('school_id', schoolId).eq('label', yearId)
        .then(({ error }) => { if (error) console.error('Erreur clôture année scolaire:', error); });
    }
  };

  const reopenSchoolYear = (yearId: string) => {
    setSchoolYears(prev => prev.map(y => y.id === yearId ? { ...y, isClosed: false, closedAt: undefined } : y));
    if (schoolId) {
      supabase.from('school_years')
        .update({ is_closed: false, closed_at: null })
        .eq('school_id', schoolId).eq('label', yearId)
        .then(({ error }) => { if (error) console.error('Erreur réouverture année scolaire:', error); });
    }
  };

  const getSchoolYear = (yearId: string) => schoolYears.find(y => y.id === yearId);

  const updateSchoolYear = (yearId: string, updates: Partial<Pick<SchoolYear, 'startDate' | 'endDate'>>) => {
    setSchoolYears(prev => prev.map(y => y.id === yearId ? { ...y, ...updates } : y));
    if (schoolId) {
      const dbUpdates: Record<string, string> = {};
      if (updates.startDate) dbUpdates.start_date = updates.startDate;
      if (updates.endDate)   dbUpdates.end_date   = updates.endDate;
      supabase.from('school_years')
        .update(dbUpdates)
        .eq('school_id', schoolId).eq('label', yearId)
        .then(({ error }) => { if (error) console.error('Erreur mise à jour année scolaire:', error); });
    }
  };

  const isCurrentYearClosed = currentYear?.isClosed ?? false;

  return (
    <SchoolYearContext.Provider value={{
      schoolYears,
      currentYear,
      yearsLoading,
      setCurrentYear,
      createSchoolYear,
      closeSchoolYear,
      reopenSchoolYear,
      getSchoolYear,
      updateSchoolYear,
      isCurrentYearClosed,
    }}>
      {children}
    </SchoolYearContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useSchoolYear = () => {
  const ctx = useContext(SchoolYearContext);
  if (!ctx) throw new Error('useSchoolYear must be used within a SchoolYearProvider');
  return ctx;
};
