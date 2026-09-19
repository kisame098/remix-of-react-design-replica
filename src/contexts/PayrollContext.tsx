import React, {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode, useMemo
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { useAuth } from './AuthContext';
import {
  PayrollEmployee, SalaryPayment, PayeeType, PayrollMonthKey,
} from '@/types/payroll';
import { getPaidAmountForPeriod as sumPaidForPeriod } from '@/lib/payroll';
import { useEnLigne } from '@/hooks/useEnLigne';
import { useInstantaneHorsLigne } from '@/hooks/useInstantaneHorsLigne';

// Les tables payroll_employees/salary_payments sont ajoutées via une migration
// collée manuellement par l'utilisateur (voir plan) — pas encore dans le
// Database type généré, donc accès non typé ici comme dans fetchAllRows.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ─── Mappers DB → TypeScript ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapPayrollEmployee = (r: any): PayrollEmployee => ({
  id:           r.id,
  firstName:    r.first_name,
  lastName:     r.last_name,
  phone:        r.phone ?? undefined,
  roleTitle:    r.role_title,
  paymentType:  r.payment_type,
  salaryAmount: Number(r.salary_amount),
  isActive:     r.is_active,
  createdAt:    r.created_at,
  updatedAt:    r.updated_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapSalaryPayment = (r: any): SalaryPayment => ({
  id:                   r.id,
  payeeType:            r.payee_type,
  teacherEnrollmentId:  r.teacher_enrollment_id ?? undefined,
  payrollEmployeeId:    r.payroll_employee_id ?? undefined,
  periodMonthKey:       r.period_month_key,
  hoursWorked:          r.hours_worked != null ? Number(r.hours_worked) : undefined,
  amountDue:            Number(r.amount_due),
  amountPaid:           Number(r.amount_paid),
  method:               r.method,
  reference:            r.reference ?? undefined,
  note:                 r.note ?? undefined,
  confirmedBy:          r.confirmed_by ?? undefined,
  paidAt:               r.paid_at,
  status:               r.status ?? 'confirmed',
  cancelledAt:          r.cancelled_at ?? undefined,
  cancelledBy:          r.cancelled_by ?? undefined,
  createdAt:            r.created_at,
});

// ─── Context Type ─────────────────────────────────────────────────────────────
interface PayrollContextType {
  payrollEmployees: PayrollEmployee[];
  salaryPayments:   SalaryPayment[];
  payrollLoading:   boolean;

  /** Date ISO des données réinstallées depuis l'appareil, hors connexion. */
  instantaneLe: string | null;

  // Personnel non-enseignant (CRUD)
  addPayrollEmployee: (data: Omit<PayrollEmployee, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>) => Promise<PayrollEmployee>;
  updatePayrollEmployee: (id: string, data: Partial<Pick<PayrollEmployee, 'firstName' | 'lastName' | 'phone' | 'roleTitle' | 'paymentType' | 'salaryAmount'>>) => Promise<void>;
  setPayrollEmployeeActive: (id: string, isActive: boolean) => Promise<void>;

  // Journal des paiements
  recordSalaryPayment: (data: Omit<SalaryPayment, 'id' | 'paidAt' | 'status' | 'cancelledAt' | 'cancelledBy' | 'createdAt'>) => Promise<SalaryPayment>;
  /** Annule un paiement (statut → 'cancelled', trace qui/quand) — ne le supprime jamais. */
  cancelSalaryPayment: (id: string) => Promise<void>;

  getPaymentsForEmployee: (payeeType: PayeeType, id: string) => SalaryPayment[];
  getPaidAmountForPeriod: (payeeType: PayeeType, id: string, periodMonthKey: PayrollMonthKey) => number;
}

const PayrollContext = createContext<PayrollContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const PayrollProvider = ({ children }: { children: ReactNode }) => {
  const { school, profile } = useAuth();
  const enLigne = useEnLigne();
  const schoolId: string | null = school?.id ?? null;

  const [payrollEmployees, setPayrollEmployees] = useState<PayrollEmployee[]>([]);
  const [salaryPayments,   setSalaryPayments]   = useState<SalaryPayment[]>([]);
  const [payrollLoading,   setPayrollLoading]   = useState(false);

  // ── Chargement initial — la paie est mensuelle-calendaire, pas d'année
  // scolaire à filtrer (contrairement à PaymentContext).
  useEffect(() => {
    if (!schoolId) {
      setPayrollEmployees([]);
      setSalaryPayments([]);
      return;
    }

    // Hors connexion, la requête n'aboutirait pas et le voyant resterait
    // allumé : l'instantané enregistré prend le relais.
    if (!enLigne) { setPayrollLoading(false); return; }
    setPayrollLoading(true);

    Promise.all([
      fetchAllRows('payroll_employees', q => q
        .eq('school_id', schoolId)
        .order('created_at', { ascending: true })),
      fetchAllRows('salary_payments', q => q
        .eq('school_id', schoolId)
        .order('paid_at', { ascending: false })),
    ]).then(([eRes, pRes]) => {
      if (eRes.data) setPayrollEmployees(eRes.data.map(mapPayrollEmployee));
      if (pRes.data) setSalaryPayments(pRes.data.map(mapSalaryPayment));
    }).finally(() => {
      setPayrollLoading(false);
    });
  }, [schoolId, enLigne]);

  // ── Personnel non-enseignant ───────────────────────────────────────────────
  const addPayrollEmployee = useCallback(async (
    data: Omit<PayrollEmployee, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>
  ): Promise<PayrollEmployee> => {
    if (!schoolId) throw new Error('No school context');

    const tempId = `tmp-${Date.now()}`;
    const now = new Date().toISOString();
    const optimistic: PayrollEmployee = { ...data, id: tempId, isActive: true, createdAt: now, updatedAt: now };
    setPayrollEmployees(prev => [...prev, optimistic]);

    const { data: row, error } = await sb
      .from('payroll_employees')
      .insert({
        school_id:     schoolId,
        first_name:    data.firstName,
        last_name:     data.lastName,
        phone:         data.phone ?? null,
        role_title:    data.roleTitle,
        payment_type:  data.paymentType,
        salary_amount: data.salaryAmount,
      })
      .select()
      .single();

    if (error || !row) {
      setPayrollEmployees(prev => prev.filter(e => e.id !== tempId));
      throw error ?? new Error('Failed to create employee');
    }

    const saved = mapPayrollEmployee(row);
    setPayrollEmployees(prev => prev.map(e => e.id === tempId ? saved : e));
    return saved;
  }, [schoolId]);

  const updatePayrollEmployee = useCallback(async (
    id: string,
    data: Partial<Pick<PayrollEmployee, 'firstName' | 'lastName' | 'phone' | 'roleTitle' | 'paymentType' | 'salaryAmount'>>
  ) => {
    if (!schoolId) return;

    setPayrollEmployees(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));

    await sb
      .from('payroll_employees')
      .update({
        ...(data.firstName    !== undefined && { first_name:    data.firstName }),
        ...(data.lastName     !== undefined && { last_name:     data.lastName }),
        ...(data.phone        !== undefined && { phone:         data.phone ?? null }),
        ...(data.roleTitle    !== undefined && { role_title:    data.roleTitle }),
        ...(data.paymentType  !== undefined && { payment_type:  data.paymentType }),
        ...(data.salaryAmount !== undefined && { salary_amount: data.salaryAmount }),
      })
      .eq('id', id)
      .eq('school_id', schoolId);
  }, [schoolId]);

  const setPayrollEmployeeActive = useCallback(async (id: string, isActive: boolean) => {
    if (!schoolId) return;

    setPayrollEmployees(prev => prev.map(e => e.id === id ? { ...e, isActive } : e));

    await sb
      .from('payroll_employees')
      .update({ is_active: isActive })
      .eq('id', id)
      .eq('school_id', schoolId);
  }, [schoolId]);

  // ── Journal des paiements ────────────────────────────────────────────────────
  const recordSalaryPayment = useCallback(async (
    data: Omit<SalaryPayment, 'id' | 'paidAt' | 'status' | 'cancelledAt' | 'cancelledBy' | 'createdAt'>
  ): Promise<SalaryPayment> => {
    if (!schoolId) throw new Error('No school context');

    const { data: row, error } = await sb
      .from('salary_payments')
      .insert({
        school_id:              schoolId,
        payee_type:             data.payeeType,
        teacher_enrollment_id:  data.teacherEnrollmentId ?? null,
        payroll_employee_id:    data.payrollEmployeeId ?? null,
        period_month_key:       data.periodMonthKey,
        hours_worked:           data.hoursWorked ?? null,
        amount_due:             data.amountDue,
        amount_paid:            data.amountPaid,
        method:                 data.method,
        reference:              data.reference ?? null,
        note:                   data.note ?? null,
        confirmed_by:           data.confirmedBy ?? null,
      })
      .select()
      .single();

    if (error || !row) throw error ?? new Error('Failed to record salary payment');

    const saved = mapSalaryPayment(row);
    setSalaryPayments(prev => [saved, ...prev]);
    return saved;
  }, [schoolId]);

  // Annulation = pièce comptable qui reste, jamais une suppression — passe
  // uniquement par le RPC audité `cancel_salary_payment` (trace qui/quand en base).
  const cancelSalaryPayment = useCallback(async (id: string) => {
    const cancelledBy = profile?.full_name || profile?.email || undefined;
    const { data, error } = await supabase.rpc('cancel_salary_payment' as never, {
      p_payment_id: id,
      p_cancelled_by: cancelledBy ?? '',
    } as never);
    if (error) throw error;
    if (data) setSalaryPayments(prev => prev.map(p => p.id === id ? mapSalaryPayment(data) : p));
  }, [profile]);

  const getPaymentsForEmployee = useCallback((payeeType: PayeeType, id: string): SalaryPayment[] =>
    salaryPayments.filter(p =>
      p.payeeType === payeeType &&
      (payeeType === 'teacher' ? p.teacherEnrollmentId === id : p.payrollEmployeeId === id)
    ),
  [salaryPayments]);

  // Un paiement annulé n'est plus de l'argent réellement versé.
  // Calcul pur dans src/lib/payroll.ts (couvert par payroll.test.ts).
  const getPaidAmountForPeriod = useCallback((payeeType: PayeeType, id: string, periodMonthKey: PayrollMonthKey): number =>
    sumPaidForPeriod(salaryPayments, payeeType, id, periodMonthKey),
  [salaryPayments]);

  // ── Instantané hors connexion ──────────────────────────────────────────────
  // Les écrans lisent ce contexte, jamais Supabase : garder ces tranches rend
  // l'écran consultable sans réseau. On n'enregistre qu'une fois le chargement
  // terminé, sinon l'état vide du démarrage effacerait l'instantané.
  const tranchesHorsLigne = useMemo(() => ({ payrollEmployees, salaryPayments }), [payrollEmployees, salaryPayments]);

  const appliquerInstantane = useCallback((t: typeof tranchesHorsLigne) => {
    setPayrollEmployees(t.payrollEmployees);
    setSalaryPayments(t.salaryPayments);
  }, []);

  const instantaneLe = useInstantaneHorsLigne(
    'salaires-instantane', tranchesHorsLigne, appliquerInstantane, !!schoolId && !payrollLoading,
  );

  const value: PayrollContextType = {
    payrollEmployees, salaryPayments, payrollLoading,
    instantaneLe,
    addPayrollEmployee, updatePayrollEmployee, setPayrollEmployeeActive,
    recordSalaryPayment, cancelSalaryPayment,
    getPaymentsForEmployee, getPaidAmountForPeriod,
  };

  return <PayrollContext.Provider value={value}>{children}</PayrollContext.Provider>;
};

export const usePayroll = () => {
  const ctx = useContext(PayrollContext);
  if (!ctx) throw new Error('usePayroll must be used within PayrollProvider');
  return ctx;
};
