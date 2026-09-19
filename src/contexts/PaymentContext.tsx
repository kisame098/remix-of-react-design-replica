import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode, useMemo
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { useAuth } from './AuthContext';
import { useSchoolYear } from './SchoolYearContext';
import {
  TuitionConfig, AnnexService, Payment, ServiceEnrollment,
  MonthKey,
} from '@/types/payment';
import * as queries from '@/lib/paymentQueries';
import { findPreviousSchoolYear } from '@/lib/schoolYears';
import { useEnLigne } from '@/hooks/useEnLigne';
import { useInstantaneHorsLigne } from '@/hooks/useInstantaneHorsLigne';

// ─── Mappers DB → TypeScript ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapTuition = (r: any): TuitionConfig => ({
  id:               r.id,
  classId:          r.class_id,
  academicYearLabel: r.academic_year_label,
  inscriptionFee:   Number(r.inscription_fee),
  monthlyFee:       Number(r.monthly_fee),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapService = (r: any): AnnexService => ({
  id:               r.id,
  name:             r.name,
  description:      r.description ?? undefined,
  amount:           Number(r.amount),
  frequency:        r.frequency,
  isObligatory:     r.is_obligatory,
  scope:            r.scope,
  classIds:         r.class_ids ?? [],
  academicYearLabel: r.academic_year_label,
  createdAt:        r.created_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapPayment = (r: any): Payment => ({
  id:               r.id,
  studentId:        r.student_enrollment_id,
  studentUniqueId:  r.student_unique_id,
  academicYearLabel: r.academic_year_label,
  type:             r.type,
  serviceId:        r.service_id ?? undefined,
  monthKey:         r.month_key ?? undefined,
  amount:           Number(r.amount),
  method:           r.method,
  reference:        r.reference ?? undefined,
  note:             r.note ?? undefined,
  receivedBy:       r.received_by ?? undefined,
  paidAt:           r.paid_at,
  status:           r.status ?? 'confirmed',
  cancelledAt:      r.cancelled_at ?? undefined,
  cancelledBy:      r.cancelled_by ?? undefined,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapEnrollment = (r: any): ServiceEnrollment => ({
  id:               r.id,
  studentId:        r.student_enrollment_id,
  serviceId:        r.service_id,
  academicYearLabel: r.academic_year_label,
  startMonthIndex:  r.start_month_index,
  endMonthIndex:    r.end_month_index ?? undefined,
  createdAt:        r.created_at,
});

// ─── Context Types ────────────────────────────────────────────────────────────
interface PaymentContextType {
  // State
  tuitionConfigs:    TuitionConfig[];
  annexServices:     AnnexService[];
  payments:          Payment[];
  serviceEnrollments: ServiceEnrollment[];
  paymentLoading:    boolean;

  /** Date ISO des données réinstallées depuis l'appareil, hors connexion. */
  instantaneLe: string | null;

  // Tuition config
  setTuitionConfig: (classId: string, inscriptionFee: number, monthlyFee: number) => Promise<void>;
  getTuitionConfig: (classId: string) => TuitionConfig | undefined;

  // Annex services CRUD
  addAnnexService: (data: Omit<AnnexService, 'id' | 'academicYearLabel' | 'createdAt'>) => Promise<AnnexService>;
  updateAnnexService: (id: string, data: Partial<Omit<AnnexService, 'id' | 'academicYearLabel' | 'createdAt'>>) => Promise<void>;
  deleteAnnexService: (id: string) => Promise<void>;
  /** All services scoped to this class */
  getServicesForClass: (classId: string) => AnnexService[];

  // Service enrollments
  enrollInService: (studentId: string, serviceId: string, startMonthIndex: number) => Promise<void>;
  unenrollFromService: (studentId: string, serviceId: string, endMonthIndex: number) => Promise<void>;
  getStudentEnrollment: (studentId: string, serviceId: string) => ServiceEnrollment | undefined;
  isEnrolledInService: (studentId: string, classId: string | null, serviceId: string, monthIndex?: number) => boolean;
  getStudentActiveServices: (studentId: string, classId: string | null) => AnnexService[];
  getAvailableServicesForStudent: (studentId: string, classId: string | null) => AnnexService[];

  // Payments
  addPayment: (data: Omit<Payment, 'id' | 'academicYearLabel' | 'paidAt' | 'status' | 'cancelledAt' | 'cancelledBy'>) => Promise<Payment>;
  /** Annule un paiement (statut → 'cancelled', trace qui/quand) — ne le supprime jamais. */
  cancelPayment: (id: string) => Promise<void>;
  getStudentPayments: (studentId: string) => Payment[];

  // Payment queries
  hasPaidInscription:  (studentId: string) => boolean;
  hasPaidTuitionMonth: (studentId: string, monthKey: MonthKey) => boolean;
  hasPaidService:      (studentId: string, serviceId: string, monthKey?: MonthKey) => boolean;

  // Stats
  getTotalCollectedForYear: () => number;
}

const PaymentContext = createContext<PaymentContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const PaymentProvider = ({ children }: { children: ReactNode }) => {
  const { school, profile } = useAuth();
  const { currentYear, schoolYears } = useSchoolYear();
  const enLigne = useEnLigne();
  const schoolId: string | null = school?.id ?? null;

  const yearLabel = currentYear?.id ?? null;   // SchoolYear.id IS the label ("2024-2025")

  const [tuitionConfigs,     setTuitionConfigs]     = useState<TuitionConfig[]>([]);
  const [annexServices,      setAnnexServices]       = useState<AnnexService[]>([]);
  const [payments,           setPayments]            = useState<Payment[]>([]);
  const [serviceEnrollments, setServiceEnrollments]  = useState<ServiceEnrollment[]>([]);
  const [paymentLoading,     setPaymentLoading]      = useState(false);

  // Prevent duplicate concurrent loads
  const loadingRef = useRef(false);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId || !yearLabel) {
      setTuitionConfigs([]);
      setAnnexServices([]);
      setPayments([]);
      setServiceEnrollments([]);
      return;
    }

    if (loadingRef.current) return;
    // Hors connexion, la requête n'aboutirait pas et le voyant resterait
    // allumé : l'instantané enregistré prend le relais.
    if (!enLigne) { setPaymentLoading(false); return; }
    loadingRef.current = true;
    setPaymentLoading(true);

    Promise.all([
      supabase
        .from('tuition_configs')
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_year_label', yearLabel),

      supabase
        .from('annex_services')
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_year_label', yearLabel)
        .order('created_at'),

      // fetchAllRows : une grande école dépasse vite 1000 paiements sur une
      // année (limite PostgREST par défaut, tronquée sans erreur sinon).
      fetchAllRows('payments', q => q
        .eq('school_id', schoolId)
        .eq('academic_year_label', yearLabel)
        .order('paid_at', { ascending: false })),

      fetchAllRows('service_enrollments', q => q
        .eq('school_id', schoolId)
        .eq('academic_year_label', yearLabel)),
    ]).then(([tRes, sRes, pRes, eRes]) => {
      if (tRes.data) setTuitionConfigs(tRes.data.map(mapTuition));
      if (sRes.data) setAnnexServices(sRes.data.map(mapService));
      if (pRes.data) setPayments(pRes.data.map(mapPayment));
      if (eRes.data) setServiceEnrollments(eRes.data.map(mapEnrollment));
    }).finally(() => {
      setPaymentLoading(false);
      loadingRef.current = false;
    });
  }, [schoolId, yearLabel, enLigne]);

  // ── Report des frais de scolarité d'une année sur l'autre ───────────────────
  // Une école garde presque toujours la même grille tarifaire d'une année à
  // l'autre : à l'ouverture d'une nouvelle année, on recopie les tarifs de
  // l'année précédente au lieu de repartir d'une grille vide. Les classes
  // survivent aux années (pas d'academic_year_label sur `classes`), donc le
  // class_id reste valide.
  //
  // Effet séparé du chargement principal pour ne pas élargir ses dépendances
  // (il rechargerait alors tous les paiements à chaque changement d'années).
  // Ne se déclenche que si l'année courante n'a AUCUN tarif ; `ignoreDuplicates`
  // garantit qu'un tarif déjà saisi n'est jamais écrasé.
  const carryOverAttemptedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!schoolId || !yearLabel || !currentYear || paymentLoading) return;
    if (tuitionConfigs.length > 0) return;
    if (carryOverAttemptedRef.current === yearLabel) return;
    carryOverAttemptedRef.current = yearLabel;

    // Sélection pure dans src/lib/schoolYears.ts (schoolYears.test.ts).
    const previousYear = findPreviousSchoolYear(schoolYears, currentYear);
    if (!previousYear) return;

    (async () => {
      const { data: prevRows } = await supabase
        .from('tuition_configs')
        .select('class_id, inscription_fee, monthly_fee')
        .eq('school_id', schoolId)
        .eq('academic_year_label', previousYear.id);
      if (!prevRows?.length) return;

      await supabase.from('tuition_configs').upsert(
        prevRows.map(r => ({
          school_id:           schoolId,
          academic_year_label: yearLabel,
          class_id:            r.class_id,
          inscription_fee:     r.inscription_fee,
          monthly_fee:         r.monthly_fee,
        })),
        { onConflict: 'school_id,academic_year_label,class_id', ignoreDuplicates: true },
      );

      // Relecture plutôt que de se fier au retour de l'upsert : avec
      // ignoreDuplicates, une insertion concurrente (autre onglet) renverrait
      // une liste vide alors que les tarifs existent bien.
      const { data: fresh } = await supabase
        .from('tuition_configs')
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_year_label', yearLabel);
      if (fresh?.length) setTuitionConfigs(fresh.map(mapTuition));
    })();
  }, [schoolId, yearLabel, currentYear, schoolYears, paymentLoading, tuitionConfigs.length]);

  // ── Tuition Config ──────────────────────────────────────────────────────────
  const setTuitionConfig = useCallback(async (classId: string, inscriptionFee: number, monthlyFee: number) => {
    if (!schoolId || !yearLabel) return;

    const existing = tuitionConfigs.find(c => c.classId === classId && c.academicYearLabel === yearLabel);

    if (existing) {
      // Optimistic update
      setTuitionConfigs(prev => prev.map(c =>
        c.id === existing.id ? { ...c, inscriptionFee, monthlyFee } : c
      ));
      await supabase
        .from('tuition_configs')
        .update({
          inscription_fee: inscriptionFee,
          monthly_fee:     monthlyFee,
          updated_at:      new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('school_id', schoolId);
    } else {
      // Optimistic insert (temp id)
      const tempId = `tmp-${Date.now()}`;
      const optimistic: TuitionConfig = { id: tempId, classId, academicYearLabel: yearLabel, inscriptionFee, monthlyFee };
      setTuitionConfigs(prev => [...prev, optimistic]);

      const { data } = await supabase
        .from('tuition_configs')
        .insert({
          school_id:           schoolId,
          academic_year_label: yearLabel,
          class_id:            classId,
          inscription_fee:     inscriptionFee,
          monthly_fee:         monthlyFee,
        })
        .select()
        .single();

      if (data) {
        setTuitionConfigs(prev => prev.map(c => c.id === tempId ? mapTuition(data) : c));
      }
    }
  }, [schoolId, yearLabel, tuitionConfigs]);

  const getTuitionConfig = useCallback((classId: string): TuitionConfig | undefined =>
    tuitionConfigs.find(c => c.classId === classId && c.academicYearLabel === yearLabel),
  [tuitionConfigs, yearLabel]);

  // ── Annex Services ────────────────────────────────────────────────────────────
  const addAnnexService = useCallback(async (data: Omit<AnnexService, 'id' | 'academicYearLabel' | 'createdAt'>): Promise<AnnexService> => {
    if (!schoolId || !yearLabel) throw new Error('No school/year context');

    const tempId = `tmp-${Date.now()}`;
    const now    = new Date().toISOString();
    const optimistic: AnnexService = { ...data, id: tempId, academicYearLabel: yearLabel, createdAt: now };
    setAnnexServices(prev => [...prev, optimistic]);

    const { data: row, error } = await supabase
      .from('annex_services')
      .insert({
        school_id:           schoolId,
        academic_year_label: yearLabel,
        name:                data.name,
        description:         data.description ?? null,
        amount:              data.amount,
        frequency:           data.frequency,
        is_obligatory:       data.isObligatory,
        scope:               data.scope,
        class_ids:           data.classIds,
      })
      .select()
      .single();

    if (error || !row) {
      // Rollback on error
      setAnnexServices(prev => prev.filter(s => s.id !== tempId));
      throw error ?? new Error('Failed to create service');
    }

    const saved = mapService(row);
    setAnnexServices(prev => prev.map(s => s.id === tempId ? saved : s));
    return saved;
  }, [schoolId, yearLabel]);

  const updateAnnexService = useCallback(async (id: string, data: Partial<Omit<AnnexService, 'id' | 'academicYearLabel' | 'createdAt'>>) => {
    if (!schoolId) return;

    // Optimistic update
    setAnnexServices(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));

    await supabase
      .from('annex_services')
      .update({
        ...(data.name        !== undefined && { name:         data.name }),
        ...(data.description !== undefined && { description:  data.description ?? null }),
        ...(data.amount      !== undefined && { amount:       data.amount }),
        ...(data.frequency   !== undefined && { frequency:    data.frequency }),
        ...(data.isObligatory !== undefined && { is_obligatory: data.isObligatory }),
        ...(data.scope       !== undefined && { scope:        data.scope }),
        ...(data.classIds    !== undefined && { class_ids:    data.classIds }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('school_id', schoolId);
  }, [schoolId]);

  const deleteAnnexService = useCallback(async (id: string) => {
    if (!schoolId) return;

    // Optimistic remove service + its enrollments
    setAnnexServices(prev => prev.filter(s => s.id !== id));
    setServiceEnrollments(prev => prev.filter(e => e.serviceId !== id));

    await supabase
      .from('annex_services')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId);
    // service_enrollments cascade deletes via FK ON DELETE CASCADE
  }, [schoolId]);

  const getServicesForClass = useCallback((classId: string): AnnexService[] =>
    annexServices.filter(s =>
      s.academicYearLabel === yearLabel &&
      (s.scope === 'all' || s.classIds.includes(classId))
    ),
  [annexServices, yearLabel]);

  // ── Service Enrollment ────────────────────────────────────────────────────────
  const enrollInService = useCallback(async (studentId: string, serviceId: string, startMonthIndex: number) => {
    if (!schoolId || !yearLabel) return;

    // Check if there's an existing enrollment (re-enroll scenario)
    const existing = serviceEnrollments.find(
      e => e.studentId === studentId && e.serviceId === serviceId && e.academicYearLabel === yearLabel
    );

    const now = new Date().toISOString();

    if (existing) {
      // Re-enroll: update start_month_index, clear end_month_index
      setServiceEnrollments(prev => prev.map(e =>
        e.id === existing.id
          ? { ...e, startMonthIndex, endMonthIndex: undefined }
          : e
      ));
      await supabase
        .from('service_enrollments')
        .update({ start_month_index: startMonthIndex, end_month_index: null })
        .eq('id', existing.id)
        .eq('school_id', schoolId);
    } else {
      // Fresh enrollment
      const tempId = `tmp-${Date.now()}`;
      const optimistic: ServiceEnrollment = {
        id: tempId, studentId, serviceId, academicYearLabel: yearLabel,
        startMonthIndex, endMonthIndex: undefined, createdAt: now,
      };
      setServiceEnrollments(prev => [...prev, optimistic]);

      const { data } = await supabase
        .from('service_enrollments')
        .insert({
          school_id:            schoolId,
          academic_year_label:  yearLabel,
          student_enrollment_id: studentId,
          service_id:           serviceId,
          start_month_index:    startMonthIndex,
          end_month_index:      null,
        })
        .select()
        .single();

      if (data) {
        setServiceEnrollments(prev => prev.map(e => e.id === tempId ? mapEnrollment(data) : e));
      }
    }
  }, [schoolId, yearLabel, serviceEnrollments]);

  const unenrollFromService = useCallback(async (studentId: string, serviceId: string, endMonthIndex: number) => {
    if (!schoolId || !yearLabel) return;

    // Optimistic update
    setServiceEnrollments(prev => prev.map(e =>
      e.studentId === studentId && e.serviceId === serviceId && e.academicYearLabel === yearLabel
        ? { ...e, endMonthIndex }
        : e
    ));

    const existing = serviceEnrollments.find(
      e => e.studentId === studentId && e.serviceId === serviceId && e.academicYearLabel === yearLabel
    );
    if (!existing) return;

    await supabase
      .from('service_enrollments')
      .update({ end_month_index: endMonthIndex })
      .eq('id', existing.id)
      .eq('school_id', schoolId);
  }, [schoolId, yearLabel, serviceEnrollments]);

  const getStudentEnrollment = useCallback((studentId: string, serviceId: string): ServiceEnrollment | undefined =>
    serviceEnrollments.find(e =>
      e.studentId === studentId && e.serviceId === serviceId && e.academicYearLabel === yearLabel
    ),
  [serviceEnrollments, yearLabel]);

  // Les quatre interrogations ci-dessous vivent dans src/lib/paymentQueries.ts
  // (fonctions pures couvertes par paymentQueries.test.ts) — ici on ne fait que
  // leur passer les données déjà chargées.
  const isEnrolledInService = useCallback((
    studentId: string, classId: string | null, serviceId: string, monthIndex?: number
  ): boolean =>
    queries.isEnrolledInService(
      annexServices, serviceEnrollments, yearLabel, studentId, classId, serviceId, monthIndex),
  [annexServices, serviceEnrollments, yearLabel]);

  const getStudentActiveServices = useCallback((studentId: string, classId: string | null): AnnexService[] =>
    queries.getStudentActiveServices(annexServices, serviceEnrollments, yearLabel, studentId, classId),
  [annexServices, serviceEnrollments, yearLabel]);

  const getAvailableServicesForStudent = useCallback((studentId: string, classId: string | null): AnnexService[] =>
    queries.getAvailableServicesForStudent(annexServices, serviceEnrollments, yearLabel, studentId, classId),
  [annexServices, serviceEnrollments, yearLabel]);

  // ── Payments ─────────────────────────────────────────────────────────────────
  const addPayment = useCallback(async (data: Omit<Payment, 'id' | 'academicYearLabel' | 'paidAt'>): Promise<Payment> => {
    if (!schoolId || !yearLabel) throw new Error('No school/year context');

    const { data: row, error } = await supabase
      .from('payments')
      .insert({
        school_id:             schoolId,
        academic_year_label:   yearLabel,
        student_enrollment_id: data.studentId,
        student_unique_id:     data.studentUniqueId,
        type:                  data.type,
        service_id:            data.serviceId ?? null,
        month_key:             data.monthKey ?? null,
        amount:                data.amount,
        method:                data.method,
        reference:             data.reference ?? null,
        note:                  data.note ?? null,
        received_by:           data.receivedBy ?? null,
      })
      .select()
      .single();

    if (error || !row) throw error ?? new Error('Failed to record payment');

    const saved = mapPayment(row);
    // Add to local state (prepend — newest first)
    setPayments(prev => [saved, ...prev]);
    return saved;
  }, [schoolId, yearLabel]);

  // Annulation = pièce comptable qui reste, jamais une suppression — passe
  // uniquement par le RPC audité `cancel_payment` (trace qui/quand en base).
  const cancelPayment = useCallback(async (id: string) => {
    const cancelledBy = profile?.full_name || profile?.email || undefined;
    const { data, error } = await supabase.rpc('cancel_payment', {
      p_payment_id: id,
      p_cancelled_by: cancelledBy ?? '',
    });
    if (error) throw error;
    if (data) setPayments(prev => prev.map(p => p.id === id ? mapPayment(data) : p));
  }, [profile]);

  const getStudentPayments = useCallback((studentId: string): Payment[] =>
    payments.filter(p => p.studentId === studentId && p.academicYearLabel === yearLabel),
  [payments, yearLabel]);

  // ── Payment queries ── un paiement annulé ne compte plus comme payé ──────────
  const hasPaidInscription = useCallback((studentId: string): boolean =>
    queries.hasPaidInscription(payments, yearLabel, studentId),
  [payments, yearLabel]);

  const hasPaidTuitionMonth = useCallback((studentId: string, monthKey: MonthKey): boolean =>
    queries.hasPaidTuitionMonth(payments, yearLabel, studentId, monthKey),
  [payments, yearLabel]);

  const hasPaidService = useCallback((studentId: string, serviceId: string, monthKey?: MonthKey): boolean =>
    queries.hasPaidService(payments, yearLabel, studentId, serviceId, monthKey),
  [payments, yearLabel]);

  // ── Stats ── un paiement annulé n'est plus de l'argent réellement encaissé ───
  const getTotalCollectedForYear = useCallback((): number =>
    queries.getTotalCollectedForYear(payments, yearLabel),
  [payments, yearLabel]);

  // ── Instantané hors connexion ──────────────────────────────────────────────
  // Les écrans lisent ce contexte, jamais Supabase : garder ces tranches rend
  // l'écran consultable sans réseau. On n'enregistre qu'une fois le chargement
  // terminé, sinon l'état vide du démarrage effacerait l'instantané.
  const tranchesHorsLigne = useMemo(() => ({ tuitionConfigs, annexServices, payments, serviceEnrollments }), [tuitionConfigs, annexServices, payments, serviceEnrollments]);

  const appliquerInstantane = useCallback((t: typeof tranchesHorsLigne) => {
    setTuitionConfigs(t.tuitionConfigs);
    setAnnexServices(t.annexServices);
    setPayments(t.payments);
    setServiceEnrollments(t.serviceEnrollments);
  }, []);

  const instantaneLe = useInstantaneHorsLigne(
    'paiements-instantane', tranchesHorsLigne, appliquerInstantane, !!schoolId && !!yearLabel && !paymentLoading,
  );

  const value: PaymentContextType = {
    tuitionConfigs, annexServices, payments, serviceEnrollments, paymentLoading,
    instantaneLe,
    setTuitionConfig, getTuitionConfig,
    addAnnexService, updateAnnexService, deleteAnnexService, getServicesForClass,
    enrollInService, unenrollFromService, getStudentEnrollment,
    isEnrolledInService, getStudentActiveServices, getAvailableServicesForStudent,
    addPayment, cancelPayment, getStudentPayments,
    hasPaidInscription, hasPaidTuitionMonth, hasPaidService,
    getTotalCollectedForYear,
  };

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>;
};

export const usePayment = () => {
  const ctx = useContext(PaymentContext);
  if (!ctx) throw new Error('usePayment must be used within PaymentProvider');
  return ctx;
};
