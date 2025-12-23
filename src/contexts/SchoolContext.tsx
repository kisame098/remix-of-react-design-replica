import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSchoolYear } from './SchoolYearContext';

export interface Tutor {
  phone: string;
  status: string;
  email?: string;
}

// Données de base d'une personne (persistantes à travers les années)
export interface PersonBase {
  uniqueId: string; // ID unique permanent (ex: ETU-2024-00001)
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: 'homme' | 'femme';
  phone?: string;
  email?: string;
  residence: string;
  createdAt: string; // Date de première inscription
}

// Élève avec données de base
export interface StudentBase extends PersonBase {
  tutor1: Tutor;
  tutor2?: Tutor;
}

// Inscription d'un élève pour une année scolaire
export interface StudentEnrollment {
  id: number;
  studentUniqueId: string;
  schoolYearId: string;
  classId: number | null;
  enrolledAt: string;
}

// Prof avec données de base
export interface TeacherBase extends PersonBase {
  diploma: string;
  emergencyPhone: string;
}

// Inscription d'un prof pour une année scolaire
export interface TeacherEnrollment {
  id: number;
  teacherUniqueId: string;
  schoolYearId: string;
  yearsExperience: number;
  contractType: 'cdi' | 'cdd' | 'vacataire' | 'stagiaire';
  paymentType: 'hourly' | 'fixed';
  salaryAmount: number;
  enrolledAt: string;
}

// Vue combinée pour affichage (élève + inscription)
export interface Student {
  id: number;
  studentId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: 'homme' | 'femme';
  phone?: string;
  email?: string;
  residence: string;
  tutor1: Tutor;
  tutor2?: Tutor;
  classId: number | null;
  createdAt: Date;
}

// Vue combinée pour affichage (prof + inscription)
export interface Teacher {
  id: number;
  teacherId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  sex: 'homme' | 'femme';
  phone: string;
  email?: string;
  residence: string;
  diploma: string;
  yearsExperience: number;
  emergencyPhone: string;
  contractType: 'cdi' | 'cdd' | 'vacataire' | 'stagiaire';
  paymentType: 'hourly' | 'fixed';
  salaryAmount: number;
  createdAt: Date;
}

export interface SchoolClass {
  id: number;
  name: string;
  studentLimit: number;
  createdAt: Date;
}

export interface GradePeriod {
  id: number;
  name: string;
  type: 'semester' | 'exam';
  schoolYearId: string;
  createdAt: Date;
}

export interface PeriodClass {
  periodId: number;
  classId: number;
  isActive: boolean;
}

export interface Subject {
  id: number;
  name: string;
  coefficient: number;
  classId: number;
  periodId: number;
}

export interface Grade {
  studentId: number;
  subjectId: number;
  periodId: number;
  classId: number;
  devoir1?: number;
  devoir2?: number;
  devoir3?: number;
  devoir4?: number;
  devoir5?: number;
  composition?: number;
  note?: number;
}

export interface StudentSubjectSetting {
  active: boolean;
  customCoef?: string;
  lvLevel?: 'none' | 'lv1' | 'lv2' | 'lv3';
}

export interface SubjectSettingsData {
  subjectId: number;
  periodId: number;
  devoir1Active: boolean;
  devoir2Active: boolean;
  devoir3Active: boolean;
  devoir4Active: boolean;
  devoir5Active: boolean;
  lvModeActive: boolean;
  lv1Coefficient: number;
  lv2Coefficient: number;
  lv3Coefficient: number;
  studentSettings: Record<number, StudentSubjectSetting>;
}

interface SchoolContextType {
  // Données de base (persistantes)
  studentBases: StudentBase[];
  teacherBases: TeacherBase[];
  
  // Inscriptions par année
  studentEnrollments: StudentEnrollment[];
  teacherEnrollments: TeacherEnrollment[];
  
  // Données fixes (partagées entre années)
  classes: SchoolClass[];
  
  // Données par année
  gradePeriods: GradePeriod[];
  periodClasses: PeriodClass[];
  subjects: Subject[];
  grades: Grade[];
  subjectSettings: SubjectSettingsData[];
  
  // Vues combinées pour l'année courante
  students: Student[];
  teachers: Teacher[];
  
  // Fonctions élèves
  addStudent: (student: Omit<Student, 'id' | 'studentId' | 'createdAt'>) => Student;
  updateStudent: (id: number, updates: Partial<Student>) => void;
  generateStudentId: () => string;
  findStudentByUniqueId: (uniqueId: string) => StudentBase | undefined;
  reEnrollStudent: (uniqueId: string, classId: number | null) => Student | null;
  
  // Fonctions profs
  addTeacher: (teacher: Omit<Teacher, 'id' | 'teacherId' | 'createdAt'>) => Teacher;
  updateTeacher: (id: number, updates: Partial<Teacher>) => void;
  generateTeacherId: () => string;
  findTeacherByUniqueId: (uniqueId: string) => TeacherBase | undefined;
  reEnrollTeacher: (uniqueId: string, enrollmentData: Omit<TeacherEnrollment, 'id' | 'teacherUniqueId' | 'schoolYearId' | 'enrolledAt'>) => Teacher | null;
  
  // Fonctions classes
  addClass: (schoolClass: Omit<SchoolClass, 'id' | 'createdAt'>) => SchoolClass;
  deleteClass: (id: number) => void;
  getStudentCountByClass: (classId: number) => number;
  
  // Fonctions périodes et notes
  addGradePeriod: (period: Omit<GradePeriod, 'id' | 'createdAt' | 'schoolYearId'>) => GradePeriod;
  deleteGradePeriod: (id: number) => void;
  togglePeriodClass: (periodId: number, classId: number) => void;
  addSubject: (subject: Omit<Subject, 'id'>) => Subject;
  updateSubject: (id: number, updates: Partial<Subject>) => void;
  deleteSubject: (id: number) => void;
  setGrades: (grades: Grade[]) => void;
  updateSubjectSettings: (subjectId: number, periodId: number, settings: Omit<SubjectSettingsData, 'subjectId' | 'periodId'>) => void;
  getSubjectSettings: (subjectId: number, periodId: number) => SubjectSettingsData | undefined;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

const STORAGE_KEYS = {
  studentBases: 'school_student_bases',
  teacherBases: 'school_teacher_bases',
  studentEnrollments: 'school_student_enrollments',
  teacherEnrollments: 'school_teacher_enrollments',
  classes: 'school_classes',
  gradePeriods: 'school_grade_periods',
  periodClasses: 'school_period_classes',
  subjects: 'school_subjects',
  grades: 'school_grades',
  subjectSettings: 'school_subject_settings',
  counters: 'school_counters',
};

interface Counters {
  student: number;
  teacher: number;
  class: number;
  period: number;
  subject: number;
  studentEnrollment: number;
  teacherEnrollment: number;
}

export const SchoolProvider = ({ children }: { children: ReactNode }) => {
  const { currentYear } = useSchoolYear();

  // Compteurs persistants
  const [counters, setCounters] = useState<Counters>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.counters);
    return saved ? JSON.parse(saved) : {
      student: 1,
      teacher: 1,
      class: 1,
      period: 1,
      subject: 1,
      studentEnrollment: 1,
      teacherEnrollment: 1,
    };
  });

  // Données de base persistantes
  const [studentBases, setStudentBases] = useState<StudentBase[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.studentBases);
    return saved ? JSON.parse(saved) : [];
  });

  const [teacherBases, setTeacherBases] = useState<TeacherBase[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.teacherBases);
    return saved ? JSON.parse(saved) : [];
  });

  // Inscriptions par année
  const [studentEnrollments, setStudentEnrollments] = useState<StudentEnrollment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.studentEnrollments);
    return saved ? JSON.parse(saved) : [];
  });

  const [teacherEnrollments, setTeacherEnrollments] = useState<TeacherEnrollment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.teacherEnrollments);
    return saved ? JSON.parse(saved) : [];
  });

  // Données fixes
  const [classes, setClasses] = useState<SchoolClass[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.classes);
    return saved ? JSON.parse(saved) : [];
  });

  // Données par année
  const [gradePeriods, setGradePeriods] = useState<GradePeriod[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.gradePeriods);
    return saved ? JSON.parse(saved) : [];
  });

  const [periodClasses, setPeriodClasses] = useState<PeriodClass[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.periodClasses);
    return saved ? JSON.parse(saved) : [];
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.subjects);
    return saved ? JSON.parse(saved) : [];
  });

  const [grades, setGradesState] = useState<Grade[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.grades);
    return saved ? JSON.parse(saved) : [];
  });

  const [subjectSettings, setSubjectSettings] = useState<SubjectSettingsData[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.subjectSettings);
    return saved ? JSON.parse(saved) : [];
  });

  // Persistance
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.counters, JSON.stringify(counters));
  }, [counters]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.studentBases, JSON.stringify(studentBases));
  }, [studentBases]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.teacherBases, JSON.stringify(teacherBases));
  }, [teacherBases]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.studentEnrollments, JSON.stringify(studentEnrollments));
  }, [studentEnrollments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.teacherEnrollments, JSON.stringify(teacherEnrollments));
  }, [teacherEnrollments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.classes, JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.gradePeriods, JSON.stringify(gradePeriods));
  }, [gradePeriods]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.periodClasses, JSON.stringify(periodClasses));
  }, [periodClasses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.subjects, JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.grades, JSON.stringify(grades));
  }, [grades]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.subjectSettings, JSON.stringify(subjectSettings));
  }, [subjectSettings]);

  // Vues combinées pour l'année courante
  const students: Student[] = React.useMemo(() => {
    if (!currentYear) return [];
    
    const currentEnrollments = studentEnrollments.filter(e => e.schoolYearId === currentYear.id);
    
    return currentEnrollments.map(enrollment => {
      const base = studentBases.find(s => s.uniqueId === enrollment.studentUniqueId);
      if (!base) return null;
      
      return {
        id: enrollment.id,
        studentId: base.uniqueId,
        firstName: base.firstName,
        lastName: base.lastName,
        dateOfBirth: base.dateOfBirth,
        placeOfBirth: base.placeOfBirth,
        sex: base.sex,
        phone: base.phone,
        email: base.email,
        residence: base.residence,
        tutor1: base.tutor1,
        tutor2: base.tutor2,
        classId: enrollment.classId,
        createdAt: new Date(base.createdAt),
      };
    }).filter(Boolean) as Student[];
  }, [currentYear, studentEnrollments, studentBases]);

  const teachers: Teacher[] = React.useMemo(() => {
    if (!currentYear) return [];
    
    const currentEnrollments = teacherEnrollments.filter(e => e.schoolYearId === currentYear.id);
    
    return currentEnrollments.map(enrollment => {
      const base = teacherBases.find(t => t.uniqueId === enrollment.teacherUniqueId);
      if (!base) return null;
      
      return {
        id: enrollment.id,
        teacherId: base.uniqueId,
        firstName: base.firstName,
        lastName: base.lastName,
        dateOfBirth: base.dateOfBirth,
        placeOfBirth: base.placeOfBirth,
        sex: base.sex,
        phone: base.phone || '',
        email: base.email,
        residence: base.residence,
        diploma: base.diploma,
        yearsExperience: enrollment.yearsExperience,
        emergencyPhone: base.emergencyPhone,
        contractType: enrollment.contractType,
        paymentType: enrollment.paymentType,
        salaryAmount: enrollment.salaryAmount,
        createdAt: new Date(base.createdAt),
      };
    }).filter(Boolean) as Teacher[];
  }, [currentYear, teacherEnrollments, teacherBases]);

  // Filtrer les périodes pour l'année courante
  const currentGradePeriods = React.useMemo(() => {
    if (!currentYear) return [];
    return gradePeriods.filter(p => p.schoolYearId === currentYear.id);
  }, [currentYear, gradePeriods]);

  // === Fonctions Élèves ===
  const generateStudentId = (): string => {
    const year = new Date().getFullYear();
    const paddedNumber = String(counters.student).padStart(5, '0');
    return `ETU-${year}-${paddedNumber}`;
  };

  const findStudentByUniqueId = (uniqueId: string): StudentBase | undefined => {
    return studentBases.find(s => s.uniqueId === uniqueId);
  };

  const addStudent = (studentData: Omit<Student, 'id' | 'studentId' | 'createdAt'>): Student => {
    if (!currentYear) throw new Error('Aucune année scolaire sélectionnée');

    const uniqueId = generateStudentId();
    
    // Créer la base élève
    const newBase: StudentBase = {
      uniqueId,
      firstName: studentData.firstName,
      lastName: studentData.lastName,
      dateOfBirth: studentData.dateOfBirth,
      placeOfBirth: studentData.placeOfBirth,
      sex: studentData.sex,
      phone: studentData.phone,
      email: studentData.email,
      residence: studentData.residence,
      tutor1: studentData.tutor1,
      tutor2: studentData.tutor2,
      createdAt: new Date().toISOString(),
    };

    // Créer l'inscription
    const newEnrollment: StudentEnrollment = {
      id: counters.studentEnrollment,
      studentUniqueId: uniqueId,
      schoolYearId: currentYear.id,
      classId: studentData.classId,
      enrolledAt: new Date().toISOString(),
    };

    setStudentBases(prev => [...prev, newBase]);
    setStudentEnrollments(prev => [...prev, newEnrollment]);
    setCounters(prev => ({
      ...prev,
      student: prev.student + 1,
      studentEnrollment: prev.studentEnrollment + 1,
    }));

    return {
      id: newEnrollment.id,
      studentId: uniqueId,
      ...studentData,
      createdAt: new Date(),
    };
  };

  const reEnrollStudent = (uniqueId: string, classId: number | null): Student | null => {
    if (!currentYear) return null;
    
    const base = findStudentByUniqueId(uniqueId);
    if (!base) return null;

    // Vérifier si déjà inscrit cette année
    const existingEnrollment = studentEnrollments.find(
      e => e.studentUniqueId === uniqueId && e.schoolYearId === currentYear.id
    );
    if (existingEnrollment) return null;

    const newEnrollment: StudentEnrollment = {
      id: counters.studentEnrollment,
      studentUniqueId: uniqueId,
      schoolYearId: currentYear.id,
      classId,
      enrolledAt: new Date().toISOString(),
    };

    setStudentEnrollments(prev => [...prev, newEnrollment]);
    setCounters(prev => ({
      ...prev,
      studentEnrollment: prev.studentEnrollment + 1,
    }));

    return {
      id: newEnrollment.id,
      studentId: base.uniqueId,
      firstName: base.firstName,
      lastName: base.lastName,
      dateOfBirth: base.dateOfBirth,
      placeOfBirth: base.placeOfBirth,
      sex: base.sex,
      phone: base.phone,
      email: base.email,
      residence: base.residence,
      tutor1: base.tutor1,
      tutor2: base.tutor2,
      classId,
      createdAt: new Date(base.createdAt),
    };
  };

  const updateStudent = (id: number, updates: Partial<Student>) => {
    // Mettre à jour l'inscription
    setStudentEnrollments(prev =>
      prev.map(e => {
        if (e.id === id) {
          return { ...e, classId: updates.classId ?? e.classId };
        }
        return e;
      })
    );

    // Mettre à jour la base si nécessaire
    const enrollment = studentEnrollments.find(e => e.id === id);
    if (enrollment) {
      setStudentBases(prev =>
        prev.map(s => {
          if (s.uniqueId === enrollment.studentUniqueId) {
            return {
              ...s,
              firstName: updates.firstName ?? s.firstName,
              lastName: updates.lastName ?? s.lastName,
              dateOfBirth: updates.dateOfBirth ?? s.dateOfBirth,
              placeOfBirth: updates.placeOfBirth ?? s.placeOfBirth,
              sex: updates.sex ?? s.sex,
              phone: updates.phone ?? s.phone,
              email: updates.email ?? s.email,
              residence: updates.residence ?? s.residence,
              tutor1: updates.tutor1 ?? s.tutor1,
              tutor2: updates.tutor2 ?? s.tutor2,
            };
          }
          return s;
        })
      );
    }
  };

  // === Fonctions Profs ===
  const generateTeacherId = (): string => {
    const year = new Date().getFullYear();
    const paddedNumber = String(counters.teacher).padStart(5, '0');
    return `PROF-${year}-${paddedNumber}`;
  };

  const findTeacherByUniqueId = (uniqueId: string): TeacherBase | undefined => {
    return teacherBases.find(t => t.uniqueId === uniqueId);
  };

  const addTeacher = (teacherData: Omit<Teacher, 'id' | 'teacherId' | 'createdAt'>): Teacher => {
    if (!currentYear) throw new Error('Aucune année scolaire sélectionnée');

    const uniqueId = generateTeacherId();
    
    const newBase: TeacherBase = {
      uniqueId,
      firstName: teacherData.firstName,
      lastName: teacherData.lastName,
      dateOfBirth: teacherData.dateOfBirth,
      placeOfBirth: teacherData.placeOfBirth,
      sex: teacherData.sex,
      phone: teacherData.phone,
      email: teacherData.email,
      residence: teacherData.residence,
      diploma: teacherData.diploma,
      emergencyPhone: teacherData.emergencyPhone,
      createdAt: new Date().toISOString(),
    };

    const newEnrollment: TeacherEnrollment = {
      id: counters.teacherEnrollment,
      teacherUniqueId: uniqueId,
      schoolYearId: currentYear.id,
      yearsExperience: teacherData.yearsExperience,
      contractType: teacherData.contractType,
      paymentType: teacherData.paymentType,
      salaryAmount: teacherData.salaryAmount,
      enrolledAt: new Date().toISOString(),
    };

    setTeacherBases(prev => [...prev, newBase]);
    setTeacherEnrollments(prev => [...prev, newEnrollment]);
    setCounters(prev => ({
      ...prev,
      teacher: prev.teacher + 1,
      teacherEnrollment: prev.teacherEnrollment + 1,
    }));

    return {
      id: newEnrollment.id,
      teacherId: uniqueId,
      ...teacherData,
      createdAt: new Date(),
    };
  };

  const reEnrollTeacher = (
    uniqueId: string,
    enrollmentData: Omit<TeacherEnrollment, 'id' | 'teacherUniqueId' | 'schoolYearId' | 'enrolledAt'>
  ): Teacher | null => {
    if (!currentYear) return null;
    
    const base = findTeacherByUniqueId(uniqueId);
    if (!base) return null;

    // Vérifier si déjà inscrit cette année
    const existingEnrollment = teacherEnrollments.find(
      e => e.teacherUniqueId === uniqueId && e.schoolYearId === currentYear.id
    );
    if (existingEnrollment) return null;

    const newEnrollment: TeacherEnrollment = {
      id: counters.teacherEnrollment,
      teacherUniqueId: uniqueId,
      schoolYearId: currentYear.id,
      ...enrollmentData,
      enrolledAt: new Date().toISOString(),
    };

    setTeacherEnrollments(prev => [...prev, newEnrollment]);
    setCounters(prev => ({
      ...prev,
      teacherEnrollment: prev.teacherEnrollment + 1,
    }));

    return {
      id: newEnrollment.id,
      teacherId: base.uniqueId,
      firstName: base.firstName,
      lastName: base.lastName,
      dateOfBirth: base.dateOfBirth,
      placeOfBirth: base.placeOfBirth,
      sex: base.sex,
      phone: base.phone || '',
      email: base.email,
      residence: base.residence,
      diploma: base.diploma,
      yearsExperience: enrollmentData.yearsExperience,
      emergencyPhone: base.emergencyPhone,
      contractType: enrollmentData.contractType,
      paymentType: enrollmentData.paymentType,
      salaryAmount: enrollmentData.salaryAmount,
      createdAt: new Date(base.createdAt),
    };
  };

  const updateTeacher = (id: number, updates: Partial<Teacher>) => {
    setTeacherEnrollments(prev =>
      prev.map(e => {
        if (e.id === id) {
          return {
            ...e,
            yearsExperience: updates.yearsExperience ?? e.yearsExperience,
            contractType: updates.contractType ?? e.contractType,
            paymentType: updates.paymentType ?? e.paymentType,
            salaryAmount: updates.salaryAmount ?? e.salaryAmount,
          };
        }
        return e;
      })
    );

    const enrollment = teacherEnrollments.find(e => e.id === id);
    if (enrollment) {
      setTeacherBases(prev =>
        prev.map(t => {
          if (t.uniqueId === enrollment.teacherUniqueId) {
            return {
              ...t,
              firstName: updates.firstName ?? t.firstName,
              lastName: updates.lastName ?? t.lastName,
              dateOfBirth: updates.dateOfBirth ?? t.dateOfBirth,
              placeOfBirth: updates.placeOfBirth ?? t.placeOfBirth,
              sex: updates.sex ?? t.sex,
              phone: updates.phone ?? t.phone,
              email: updates.email ?? t.email,
              residence: updates.residence ?? t.residence,
              diploma: updates.diploma ?? t.diploma,
              emergencyPhone: updates.emergencyPhone ?? t.emergencyPhone,
            };
          }
          return t;
        })
      );
    }
  };

  // === Fonctions Classes ===
  const addClass = (classData: Omit<SchoolClass, 'id' | 'createdAt'>): SchoolClass => {
    const newClass: SchoolClass = {
      ...classData,
      id: counters.class,
      createdAt: new Date(),
    };
    setCounters(prev => ({ ...prev, class: prev.class + 1 }));
    setClasses(prev => [...prev, newClass]);
    return newClass;
  };

  const deleteClass = (id: number) => {
    setClasses(prev => prev.filter(c => c.id !== id));
  };

  const getStudentCountByClass = (classId: number): number => {
    return students.filter(s => s.classId === classId).length;
  };

  // === Fonctions Périodes et Notes ===
  const addGradePeriod = (periodData: Omit<GradePeriod, 'id' | 'createdAt' | 'schoolYearId'>): GradePeriod => {
    if (!currentYear) throw new Error('Aucune année scolaire sélectionnée');
    
    const newPeriod: GradePeriod = {
      ...periodData,
      id: counters.period,
      schoolYearId: currentYear.id,
      createdAt: new Date(),
    };
    setCounters(prev => ({ ...prev, period: prev.period + 1 }));
    setGradePeriods(prev => [...prev, newPeriod]);
    return newPeriod;
  };

  const deleteGradePeriod = (id: number) => {
    setGradePeriods(prev => prev.filter(p => p.id !== id));
  };

  const togglePeriodClass = (periodId: number, classId: number) => {
    const existing = periodClasses.find(
      pc => pc.periodId === periodId && pc.classId === classId
    );
    if (existing) {
      setPeriodClasses(prev =>
        prev.map(pc =>
          pc.periodId === periodId && pc.classId === classId
            ? { ...pc, isActive: !pc.isActive }
            : pc
        )
      );
    } else {
      setPeriodClasses(prev => [...prev, { periodId, classId, isActive: false }]);
    }
  };

  const addSubject = (subjectData: Omit<Subject, 'id'>): Subject => {
    const newSubject: Subject = {
      ...subjectData,
      id: counters.subject,
    };
    setCounters(prev => ({ ...prev, subject: prev.subject + 1 }));
    setSubjects(prev => [...prev, newSubject]);
    return newSubject;
  };

  const updateSubject = (id: number, updates: Partial<Subject>) => {
    setSubjects(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const deleteSubject = (id: number) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
  };

  const setGrades = (newGrades: Grade[]) => {
    setGradesState(newGrades);
  };

  const updateSubjectSettings = (
    subjectId: number,
    periodId: number,
    settings: Omit<SubjectSettingsData, 'subjectId' | 'periodId'>
  ) => {
    setSubjectSettings(prev => {
      const existing = prev.find(
        ss => ss.subjectId === subjectId && ss.periodId === periodId
      );
      if (existing) {
        return prev.map(ss =>
          ss.subjectId === subjectId && ss.periodId === periodId
            ? { ...ss, ...settings }
            : ss
        );
      }
      return [...prev, { subjectId, periodId, ...settings }];
    });
  };

  const getSubjectSettings = (
    subjectId: number,
    periodId: number
  ): SubjectSettingsData | undefined => {
    return subjectSettings.find(
      ss => ss.subjectId === subjectId && ss.periodId === periodId
    );
  };

  return (
    <SchoolContext.Provider
      value={{
        studentBases,
        teacherBases,
        studentEnrollments,
        teacherEnrollments,
        classes,
        gradePeriods: currentGradePeriods,
        periodClasses,
        subjects,
        grades,
        subjectSettings,
        students,
        teachers,
        addStudent,
        updateStudent,
        generateStudentId,
        findStudentByUniqueId,
        reEnrollStudent,
        addTeacher,
        updateTeacher,
        generateTeacherId,
        findTeacherByUniqueId,
        reEnrollTeacher,
        addClass,
        deleteClass,
        getStudentCountByClass,
        addGradePeriod,
        deleteGradePeriod,
        togglePeriodClass,
        addSubject,
        updateSubject,
        deleteSubject,
        setGrades,
        updateSubjectSettings,
        getSubjectSettings,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};
