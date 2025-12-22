import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface SchoolYear {
  id: string; // Format: "2024-2025"
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedAt?: string;
  createdAt: string;
}

interface SchoolYearContextType {
  schoolYears: SchoolYear[];
  currentYear: SchoolYear | null;
  setCurrentYear: (year: SchoolYear) => void;
  createSchoolYear: (startYear: number) => SchoolYear;
  closeSchoolYear: (yearId: string) => void;
  reopenSchoolYear: (yearId: string) => void;
  getSchoolYear: (yearId: string) => SchoolYear | undefined;
  isCurrentYearClosed: boolean;
}

const SchoolYearContext = createContext<SchoolYearContextType | undefined>(undefined);

const STORAGE_KEY = 'school_years';
const CURRENT_YEAR_KEY = 'current_school_year';

export const SchoolYearProvider = ({ children }: { children: ReactNode }) => {
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    // Créer une année par défaut
    const currentCalendarYear = new Date().getFullYear();
    const month = new Date().getMonth();
    // Si on est avant septembre, on est dans l'année scolaire précédente
    const startYear = month < 8 ? currentCalendarYear - 1 : currentCalendarYear;
    const defaultYear: SchoolYear = {
      id: `${startYear}-${startYear + 1}`,
      name: `Année Scolaire ${startYear}-${startYear + 1}`,
      startDate: `${startYear}-09-01`,
      endDate: `${startYear + 1}-07-31`,
      isClosed: false,
      createdAt: new Date().toISOString(),
    };
    return [defaultYear];
  });

  const [currentYear, setCurrentYearState] = useState<SchoolYear | null>(() => {
    const savedId = localStorage.getItem(CURRENT_YEAR_KEY);
    const savedYears = localStorage.getItem(STORAGE_KEY);
    if (savedId && savedYears) {
      const years = JSON.parse(savedYears) as SchoolYear[];
      return years.find(y => y.id === savedId) || years[0] || null;
    }
    return null;
  });

  // Initialiser l'année courante si pas encore définie
  useEffect(() => {
    if (!currentYear && schoolYears.length > 0) {
      const openYear = schoolYears.find(y => !y.isClosed) || schoolYears[0];
      setCurrentYearState(openYear);
    }
  }, [schoolYears, currentYear]);

  // Persister les données
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schoolYears));
  }, [schoolYears]);

  useEffect(() => {
    if (currentYear) {
      localStorage.setItem(CURRENT_YEAR_KEY, currentYear.id);
    }
  }, [currentYear]);

  const setCurrentYear = (year: SchoolYear) => {
    setCurrentYearState(year);
  };

  const createSchoolYear = (startYear: number): SchoolYear => {
    const yearId = `${startYear}-${startYear + 1}`;
    
    // Vérifier si l'année existe déjà
    const existing = schoolYears.find(y => y.id === yearId);
    if (existing) {
      return existing;
    }

    const newYear: SchoolYear = {
      id: yearId,
      name: `Année Scolaire ${startYear}-${startYear + 1}`,
      startDate: `${startYear}-09-01`,
      endDate: `${startYear + 1}-07-31`,
      isClosed: false,
      createdAt: new Date().toISOString(),
    };

    setSchoolYears(prev => [...prev, newYear].sort((a, b) => b.id.localeCompare(a.id)));
    return newYear;
  };

  const closeSchoolYear = (yearId: string) => {
    setSchoolYears(prev =>
      prev.map(y =>
        y.id === yearId
          ? { ...y, isClosed: true, closedAt: new Date().toISOString() }
          : y
      )
    );
  };

  const reopenSchoolYear = (yearId: string) => {
    setSchoolYears(prev =>
      prev.map(y =>
        y.id === yearId
          ? { ...y, isClosed: false, closedAt: undefined }
          : y
      )
    );
  };

  const getSchoolYear = (yearId: string) => {
    return schoolYears.find(y => y.id === yearId);
  };

  const isCurrentYearClosed = currentYear?.isClosed ?? false;

  return (
    <SchoolYearContext.Provider
      value={{
        schoolYears,
        currentYear,
        setCurrentYear,
        createSchoolYear,
        closeSchoolYear,
        reopenSchoolYear,
        getSchoolYear,
        isCurrentYearClosed,
      }}
    >
      {children}
    </SchoolYearContext.Provider>
  );
};

export const useSchoolYear = () => {
  const context = useContext(SchoolYearContext);
  if (!context) {
    throw new Error('useSchoolYear must be used within a SchoolYearProvider');
  }
  return context;
};
