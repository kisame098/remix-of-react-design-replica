import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Tutor {
  phone: string;
  status: 'pere' | 'mere' | 'oncle' | 'tante' | 'autre' | '';
  email?: string;
}

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
  devoir1?: number;
  devoir2?: number;
  devoir3?: number;
  composition?: number;
  note?: number; // For exams
}

interface SchoolContextType {
  students: Student[];
  classes: SchoolClass[];
  teachers: Teacher[];
  gradePeriods: GradePeriod[];
  periodClasses: PeriodClass[];
  subjects: Subject[];
  grades: Grade[];
  addStudent: (student: Omit<Student, 'id' | 'studentId' | 'createdAt'>) => Student;
  updateStudent: (id: number, updates: Partial<Student>) => void;
  addClass: (schoolClass: Omit<SchoolClass, 'id' | 'createdAt'>) => SchoolClass;
  deleteClass: (id: number) => void;
  getStudentCountByClass: (classId: number) => number;
  generateStudentId: () => string;
  addTeacher: (teacher: Omit<Teacher, 'id' | 'teacherId' | 'createdAt'>) => Teacher;
  updateTeacher: (id: number, updates: Partial<Teacher>) => void;
  generateTeacherId: () => string;
  addGradePeriod: (period: Omit<GradePeriod, 'id' | 'createdAt'>) => GradePeriod;
  deleteGradePeriod: (id: number) => void;
  togglePeriodClass: (periodId: number, classId: number) => void;
  addSubject: (subject: Omit<Subject, 'id'>) => Subject;
  updateSubject: (id: number, updates: Partial<Subject>) => void;
  deleteSubject: (id: number) => void;
  setGrades: (grades: Grade[]) => void;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

// Auto-increment counters (simulating database auto-increment)
let studentCounter = 1;
let classCounter = 1;
let teacherCounter = 1;
let periodCounter = 1;
let subjectCounter = 1;

export const SchoolProvider = ({ children }: { children: ReactNode }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [gradePeriods, setGradePeriods] = useState<GradePeriod[]>([]);
  const [periodClasses, setPeriodClasses] = useState<PeriodClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGradesState] = useState<Grade[]>([]);

  const generateStudentId = (): string => {
    const year = new Date().getFullYear();
    const paddedNumber = String(studentCounter).padStart(5, '0');
    return `ETU-${year}-${paddedNumber}`;
  };

  const generateTeacherId = (): string => {
    const year = new Date().getFullYear();
    const paddedNumber = String(teacherCounter).padStart(5, '0');
    return `PROF-${year}-${paddedNumber}`;
  };

  const addStudent = (studentData: Omit<Student, 'id' | 'studentId' | 'createdAt'>): Student => {
    const newStudent: Student = {
      ...studentData,
      id: studentCounter,
      studentId: generateStudentId(),
      createdAt: new Date(),
    };
    studentCounter++;
    setStudents(prev => [...prev, newStudent]);
    return newStudent;
  };

  const updateStudent = (id: number, updates: Partial<Student>) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addTeacher = (teacherData: Omit<Teacher, 'id' | 'teacherId' | 'createdAt'>): Teacher => {
    const newTeacher: Teacher = {
      ...teacherData,
      id: teacherCounter,
      teacherId: generateTeacherId(),
      createdAt: new Date(),
    };
    teacherCounter++;
    setTeachers(prev => [...prev, newTeacher]);
    return newTeacher;
  };

  const updateTeacher = (id: number, updates: Partial<Teacher>) => {
    setTeachers(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const addClass = (classData: Omit<SchoolClass, 'id' | 'createdAt'>): SchoolClass => {
    const newClass: SchoolClass = {
      ...classData,
      id: classCounter,
      createdAt: new Date(),
    };
    classCounter++;
    setClasses(prev => [...prev, newClass]);
    return newClass;
  };

  const deleteClass = (id: number) => {
    setClasses(prev => prev.filter(c => c.id !== id));
  };

  const getStudentCountByClass = (classId: number): number => {
    return students.filter(s => s.classId === classId).length;
  };

  const addGradePeriod = (periodData: Omit<GradePeriod, 'id' | 'createdAt'>): GradePeriod => {
    const newPeriod: GradePeriod = {
      ...periodData,
      id: periodCounter,
      createdAt: new Date(),
    };
    periodCounter++;
    setGradePeriods(prev => [...prev, newPeriod]);
    return newPeriod;
  };

  const deleteGradePeriod = (id: number) => {
    setGradePeriods(prev => prev.filter(p => p.id !== id));
    setPeriodClasses(prev => prev.filter(pc => pc.periodId !== id));
    setSubjects(prev => prev.filter(s => s.periodId !== id));
    setGradesState(prev => prev.filter(g => g.periodId !== id));
  };

  const togglePeriodClass = (periodId: number, classId: number) => {
    const existing = periodClasses.find(pc => pc.periodId === periodId && pc.classId === classId);
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
      id: subjectCounter,
    };
    subjectCounter++;
    setSubjects(prev => [...prev, newSubject]);
    return newSubject;
  };

  const updateSubject = (id: number, updates: Partial<Subject>) => {
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const deleteSubject = (id: number) => {
    setSubjects(prev => prev.filter(s => s.id !== id));
    setGradesState(prev => prev.filter(g => g.subjectId !== id));
  };

  const setGrades = (newGrades: Grade[]) => {
    setGradesState(newGrades);
  };

  return (
    <SchoolContext.Provider
      value={{
        students,
        classes,
        teachers,
        gradePeriods,
        periodClasses,
        subjects,
        grades,
        addStudent,
        updateStudent,
        addClass,
        deleteClass,
        getStudentCountByClass,
        generateStudentId,
        addTeacher,
        updateTeacher,
        generateTeacherId,
        addGradePeriod,
        deleteGradePeriod,
        togglePeriodClass,
        addSubject,
        updateSubject,
        deleteSubject,
        setGrades,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};
