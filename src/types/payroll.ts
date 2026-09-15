import { PaymentMethod } from '@/types/payment';

// ─── Payroll Types ─────────────────────────────────────────────────────────

export type PayeeType = 'teacher' | 'staff';
export type PayrollPaymentType = 'hourly' | 'fixed';
export type PayrollMonthKey = string; // "YYYY-MM"

export const PAYROLL_PAYMENT_TYPE_LABELS: Record<PayrollPaymentType, string> = {
  hourly: 'Taux horaire',
  fixed:  'Salaire fixe mensuel',
};

// Salarié non-enseignant (comptable, gardien, etc.) — les professeurs restent
// dans teacher_enrollments, cette table ne couvre que le reste du personnel.
export interface PayrollEmployee {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleTitle: string;
  paymentType: PayrollPaymentType;
  salaryAmount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SalaryPaymentStatus = 'confirmed' | 'cancelled';

// Journal des paiements de salaire — couvre à la fois les profs
// (teacherEnrollmentId) et le personnel non-enseignant (payrollEmployeeId).
export interface SalaryPayment {
  id: string;
  payeeType: PayeeType;
  teacherEnrollmentId?: string;
  payrollEmployeeId?: string;
  periodMonthKey: PayrollMonthKey;
  hoursWorked?: number;
  amountDue: number;
  amountPaid: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  confirmedBy?: string;
  paidAt: string;
  status: SalaryPaymentStatus;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt: string;
}
