export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      annex_services: {
        Row: {
          academic_year_label: string
          amount: number
          class_ids: string[]
          created_at: string
          description: string | null
          frequency: string
          id: string
          is_obligatory: boolean
          name: string
          school_id: string
          scope: string
          updated_at: string
        }
        Insert: {
          academic_year_label: string
          amount: number
          class_ids?: string[]
          created_at?: string
          description?: string | null
          frequency: string
          id?: string
          is_obligatory?: boolean
          name: string
          school_id: string
          scope?: string
          updated_at?: string
        }
        Update: {
          academic_year_label?: string
          amount?: number
          class_ids?: string[]
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          is_obligatory?: boolean
          name?: string
          school_id?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "annex_services_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          academic_year_label: string
          class_id: string | null
          class_name: string
          created_at: string
          date: string
          day_index: number
          end_time: string
          group_id: string
          group_name: string
          id: string
          schedule_event_id: string | null
          school_id: string
          start_time: string
          student_attendance_complete: boolean
          subject_name: string
          teacher_attendance_complete: boolean
          teacher_id: string | null
          teacher_name: string | null
          updated_at: string
        }
        Insert: {
          academic_year_label: string
          class_id?: string | null
          class_name: string
          created_at?: string
          date: string
          day_index: number
          end_time: string
          group_id?: string
          group_name?: string
          id?: string
          schedule_event_id?: string | null
          school_id: string
          start_time: string
          student_attendance_complete?: boolean
          subject_name: string
          teacher_attendance_complete?: boolean
          teacher_id?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_label?: string
          class_id?: string | null
          class_name?: string
          created_at?: string
          date?: string
          day_index?: number
          end_time?: string
          group_id?: string
          group_name?: string
          id?: string
          schedule_event_id?: string | null
          school_id?: string
          start_time?: string
          student_attendance_complete?: boolean
          subject_name?: string
          teacher_attendance_complete?: boolean
          teacher_id?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_schedule_event_id_fkey"
            columns: ["schedule_event_id"]
            isOneToOne: false
            referencedRelation: "schedule_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          payment_method: string | null
          plan: string
          provider_token: string | null
          raw_ipn: Json | null
          ref_command: string
          school_id: string
          status: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_method?: string | null
          plan: string
          provider_token?: string | null
          raw_ipn?: Json | null
          ref_command: string
          school_id: string
          status?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_method?: string | null
          plan?: string
          provider_token?: string | null
          raw_ipn?: Json | null
          ref_command?: string
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_filiere_assignments: {
        Row: {
          academic_year_label: string
          assigned_at: string
          class_id: string
          filiere_id: string
          id: string
          school_id: string
        }
        Insert: {
          academic_year_label: string
          assigned_at?: string
          class_id: string
          filiere_id: string
          id?: string
          school_id: string
        }
        Update: {
          academic_year_label?: string
          assigned_at?: string
          class_id?: string
          filiere_id?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_filiere_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_filiere_assignments_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_filiere_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
          niveau: string | null
          school_id: string
          student_limit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          niveau?: string | null
          school_id: string
          student_limit?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          niveau?: string | null
          school_id?: string
          student_limit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      filiere_choice_groups: {
        Row: {
          coefficient: number
          created_at: string
          filiere_id: string
          id: string
          label: string
          niveau: string
          ordering: number
          school_id: string
        }
        Insert: {
          coefficient: number
          created_at?: string
          filiere_id: string
          id?: string
          label: string
          niveau: string
          ordering?: number
          school_id: string
        }
        Update: {
          coefficient?: number
          created_at?: string
          filiere_id?: string
          id?: string
          label?: string
          niveau?: string
          ordering?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filiere_choice_groups_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filiere_choice_groups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      filiere_choice_options: {
        Row: {
          choice_group_id: string
          created_at: string
          id: string
          ordering: number
          school_id: string
          subject_name: string
        }
        Insert: {
          choice_group_id: string
          created_at?: string
          id?: string
          ordering?: number
          school_id: string
          subject_name: string
        }
        Update: {
          choice_group_id?: string
          created_at?: string
          id?: string
          ordering?: number
          school_id?: string
          subject_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "filiere_choice_options_choice_group_id_fkey"
            columns: ["choice_group_id"]
            isOneToOne: false
            referencedRelation: "filiere_choice_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filiere_choice_options_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      filiere_facultative_subjects: {
        Row: {
          coefficient: number
          created_at: string
          filiere_id: string
          id: string
          name: string
          niveau: string
          ordering: number
          school_id: string
        }
        Insert: {
          coefficient: number
          created_at?: string
          filiere_id: string
          id?: string
          name: string
          niveau: string
          ordering?: number
          school_id: string
        }
        Update: {
          coefficient?: number
          created_at?: string
          filiere_id?: string
          id?: string
          name?: string
          niveau?: string
          ordering?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filiere_facultative_subjects_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filiere_facultative_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      filiere_mandatory_subjects: {
        Row: {
          coefficient: number
          created_at: string
          filiere_id: string
          id: string
          name: string
          niveau: string
          ordering: number
          school_id: string
        }
        Insert: {
          coefficient: number
          created_at?: string
          filiere_id: string
          id?: string
          name: string
          niveau: string
          ordering?: number
          school_id: string
        }
        Update: {
          coefficient?: number
          created_at?: string
          filiere_id?: string
          id?: string
          name?: string
          niveau?: string
          ordering?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filiere_mandatory_subjects_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filiere_mandatory_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      filiere_student_choices: {
        Row: {
          choice_group_id: string
          chosen_at: string
          chosen_by: string
          chosen_subject_name: string
          class_filiere_assignment_id: string
          id: string
          school_id: string
          student_enrollment_id: string
          updated_at: string
        }
        Insert: {
          choice_group_id: string
          chosen_at?: string
          chosen_by: string
          chosen_subject_name: string
          class_filiere_assignment_id: string
          id?: string
          school_id: string
          student_enrollment_id: string
          updated_at?: string
        }
        Update: {
          choice_group_id?: string
          chosen_at?: string
          chosen_by?: string
          chosen_subject_name?: string
          class_filiere_assignment_id?: string
          id?: string
          school_id?: string
          student_enrollment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filiere_student_choices_choice_group_id_fkey"
            columns: ["choice_group_id"]
            isOneToOne: false
            referencedRelation: "filiere_choice_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filiere_student_choices_class_filiere_assignment_id_fkey"
            columns: ["class_filiere_assignment_id"]
            isOneToOne: false
            referencedRelation: "class_filiere_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filiere_student_choices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filiere_student_choices_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      filieres: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          niveaux: string[]
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          niveaux?: string[]
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          niveaux?: string[]
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filieres_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_period_classes: {
        Row: {
          class_id: string
          created_at: string
          id: string
          period_id: string
          school_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          period_id: string
          school_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          period_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_period_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_period_classes_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "grade_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_period_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_periods: {
        Row: {
          academic_year_label: string
          created_at: string
          end_date: string | null
          id: string
          name: string
          ordering: number
          school_id: string
          start_date: string | null
          type: string
        }
        Insert: {
          academic_year_label: string
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          ordering?: number
          school_id: string
          start_date?: string | null
          type: string
        }
        Update: {
          academic_year_label?: string
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          ordering?: number
          school_id?: string
          start_date?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          composition: number | null
          devoir1: number | null
          devoir2: number | null
          devoir3: number | null
          devoir4: number | null
          devoir5: number | null
          id: string
          note: number | null
          school_id: string
          student_enrollment_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          composition?: number | null
          devoir1?: number | null
          devoir2?: number | null
          devoir3?: number | null
          devoir4?: number | null
          devoir5?: number | null
          id?: string
          note?: number | null
          school_id: string
          student_enrollment_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          composition?: number | null
          devoir1?: number | null
          devoir2?: number | null
          devoir3?: number | null
          devoir4?: number | null
          devoir5?: number | null
          id?: string
          note?: number | null
          school_id?: string
          student_enrollment_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      locked_months: {
        Row: {
          id: string
          locked_at: string
          month_key: string
          school_id: string
        }
        Insert: {
          id?: string
          locked_at?: string
          month_key: string
          school_id: string
        }
        Update: {
          id?: string
          locked_at?: string
          month_key?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locked_months_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      niveau_default_subjects: {
        Row: {
          coefficient: number
          created_at: string
          id: string
          is_facultative: boolean
          name: string
          niveau: string
          ordering: number
          school_id: string
        }
        Insert: {
          coefficient: number
          created_at?: string
          id?: string
          is_facultative?: boolean
          name: string
          niveau: string
          ordering?: number
          school_id: string
        }
        Update: {
          coefficient?: number
          created_at?: string
          id?: string
          is_facultative?: boolean
          name?: string
          niveau?: string
          ordering?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "niveau_default_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          academic_year_label: string
          amount: number
          cancelled_at: string | null
          cancelled_by: string | null
          id: string
          method: string
          month_key: string | null
          note: string | null
          paid_at: string
          received_by: string | null
          reference: string | null
          school_id: string
          service_id: string | null
          status: string
          student_enrollment_id: string
          student_unique_id: string
          type: string
        }
        Insert: {
          academic_year_label: string
          amount: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          id?: string
          method: string
          month_key?: string | null
          note?: string | null
          paid_at?: string
          received_by?: string | null
          reference?: string | null
          school_id: string
          service_id?: string | null
          status?: string
          student_enrollment_id: string
          student_unique_id: string
          type: string
        }
        Update: {
          academic_year_label?: string
          amount?: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          id?: string
          method?: string
          month_key?: string | null
          note?: string | null
          paid_at?: string
          received_by?: string | null
          reference?: string | null
          school_id?: string
          service_id?: string | null
          status?: string
          student_enrollment_id?: string
          student_unique_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "annex_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          email: string
          full_name: string | null
          id: string
          last_seen_at: string | null
          registered_at: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          email: string
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          registered_at?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          registered_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      published_bulletins: {
        Row: {
          class_id: string
          data: Json
          id: string
          period_id: string
          published_at: string
          published_by: string | null
          school_id: string
          student_enrollment_id: string
        }
        Insert: {
          class_id: string
          data: Json
          id?: string
          period_id: string
          published_at?: string
          published_by?: string | null
          school_id: string
          student_enrollment_id: string
        }
        Update: {
          class_id?: string
          data?: Json
          id?: string
          period_id?: string
          published_at?: string
          published_by?: string | null
          school_id?: string
          student_enrollment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "published_bulletins_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_bulletins_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "grade_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_bulletins_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_bulletins_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_bulletins_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_events: {
        Row: {
          academic_year_label: string
          class_id: string
          class_name: string
          color: string
          created_at: string
          day_index: number
          end_time: string
          group_id: string
          group_name: string
          id: string
          school_id: string
          start_time: string
          subject_name: string
          teacher_id: string | null
          teacher_name: string | null
          updated_at: string
        }
        Insert: {
          academic_year_label: string
          class_id: string
          class_name: string
          color?: string
          created_at?: string
          day_index: number
          end_time: string
          group_id?: string
          group_name?: string
          id?: string
          school_id: string
          start_time: string
          subject_name: string
          teacher_id?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_label?: string
          class_id?: string
          class_name?: string
          color?: string
          created_at?: string
          day_index?: number
          end_time?: string
          group_id?: string
          group_name?: string
          id?: string
          school_id?: string
          start_time?: string
          subject_name?: string
          teacher_id?: string | null
          teacher_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      school_accounts: {
        Row: {
          auth_user_id: string | null
          class_name: string | null
          created_at: string
          display_id: string
          display_name: string
          email: string
          id: string
          is_active: boolean
          password_encrypted: string | null
          password_plain: string | null
          role: string
          school_id: string
          school_name: string
          student_enrollment_id: string | null
          teacher_enrollment_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          class_name?: string | null
          created_at?: string
          display_id: string
          display_name: string
          email: string
          id?: string
          is_active?: boolean
          password_encrypted?: string | null
          password_plain?: string | null
          role: string
          school_id: string
          school_name?: string
          student_enrollment_id?: string | null
          teacher_enrollment_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          class_name?: string | null
          created_at?: string
          display_id?: string
          display_name?: string
          email?: string
          id?: string
          is_active?: boolean
          password_encrypted?: string | null
          password_plain?: string | null
          role?: string
          school_id?: string
          school_name?: string
          student_enrollment_id?: string | null
          teacher_enrollment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_accounts_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: true
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_accounts_teacher_enrollment_id_fkey"
            columns: ["teacher_enrollment_id"]
            isOneToOne: true
            referencedRelation: "teacher_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      school_members: {
        Row: {
          id: string
          invited_by: string | null
          is_active: boolean
          joined_at: string
          permissions: string[]
          role: string
          school_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          permissions?: string[]
          role?: string
          school_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string
          permissions?: string[]
          role?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_years: {
        Row: {
          closed_at: string | null
          created_at: string
          end_date: string
          id: string
          is_closed: boolean
          label: string
          name: string
          school_id: string
          start_date: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          end_date: string
          id?: string
          is_closed?: boolean
          label: string
          name: string
          school_id: string
          start_date: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          end_date?: string
          id?: string
          is_closed?: boolean
          label?: string
          name?: string
          school_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          city: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json
          slug: string | null
          subscription_expires_at: string | null
          subscription_plan: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          slug?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          slug?: string | null
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: []
      }
      service_enrollments: {
        Row: {
          academic_year_label: string
          created_at: string
          end_month_index: number | null
          id: string
          school_id: string
          service_id: string
          start_month_index: number
          student_enrollment_id: string
        }
        Insert: {
          academic_year_label: string
          created_at?: string
          end_month_index?: number | null
          id?: string
          school_id: string
          service_id: string
          start_month_index: number
          student_enrollment_id: string
        }
        Update: {
          academic_year_label?: string
          created_at?: string
          end_month_index?: number | null
          id?: string
          school_id?: string
          service_id?: string
          start_month_index?: number
          student_enrollment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_enrollments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "annex_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_enrollments_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      student_attendances: {
        Row: {
          id: string
          is_justified: boolean
          justification: string | null
          recorded_at: string
          school_id: string
          session_id: string
          status: string
          student_enrollment_id: string
        }
        Insert: {
          id?: string
          is_justified?: boolean
          justification?: string | null
          recorded_at?: string
          school_id: string
          session_id: string
          status?: string
          student_enrollment_id: string
        }
        Update: {
          id?: string
          is_justified?: boolean
          justification?: string | null
          recorded_at?: string
          school_id?: string
          session_id?: string
          status?: string
          student_enrollment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_attendances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attendances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attendances_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          academic_year_label: string
          class_id: string | null
          enrolled_at: string
          id: string
          school_id: string
          status: string
          student_profile_id: string
          updated_at: string
        }
        Insert: {
          academic_year_label: string
          class_id?: string | null
          enrolled_at?: string
          id?: string
          school_id: string
          status?: string
          student_profile_id: string
          updated_at?: string
        }
        Update: {
          academic_year_label?: string
          class_id?: string | null
          enrolled_at?: string
          id?: string
          school_id?: string
          status?: string
          student_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_profile_id_fkey"
            columns: ["student_profile_id"]
            isOneToOne: false
            referencedRelation: "student_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          photo_url: string | null
          place_of_birth: string | null
          residence: string | null
          school_id: string
          sex: string
          tutor1_email: string | null
          tutor1_full_name: string | null
          tutor1_phone: string
          tutor1_status: string
          tutor2_email: string | null
          tutor2_full_name: string | null
          tutor2_phone: string | null
          tutor2_status: string | null
          unique_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          photo_url?: string | null
          place_of_birth?: string | null
          residence?: string | null
          school_id: string
          sex: string
          tutor1_email?: string | null
          tutor1_full_name?: string | null
          tutor1_phone?: string
          tutor1_status?: string
          tutor2_email?: string | null
          tutor2_full_name?: string | null
          tutor2_phone?: string | null
          tutor2_status?: string | null
          unique_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          photo_url?: string | null
          place_of_birth?: string | null
          residence?: string | null
          school_id?: string
          sex?: string
          tutor1_email?: string | null
          tutor1_full_name?: string | null
          tutor1_phone?: string
          tutor1_status?: string
          tutor2_email?: string | null
          tutor2_full_name?: string | null
          tutor2_phone?: string | null
          tutor2_status?: string | null
          unique_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subject_settings: {
        Row: {
          active: boolean
          custom_coefficient: number | null
          id: string
          override_reason: string | null
          school_id: string
          student_enrollment_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          custom_coefficient?: number | null
          id?: string
          override_reason?: string | null
          school_id: string
          student_enrollment_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          custom_coefficient?: number | null
          id?: string
          override_reason?: string | null
          school_id?: string
          student_enrollment_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subject_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_settings_student_enrollment_id_fkey"
            columns: ["student_enrollment_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_settings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_settings: {
        Row: {
          devoir1_active: boolean
          devoir2_active: boolean
          devoir3_active: boolean
          devoir4_active: boolean
          devoir5_active: boolean
          id: string
          school_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          devoir1_active?: boolean
          devoir2_active?: boolean
          devoir3_active?: boolean
          devoir4_active?: boolean
          devoir5_active?: boolean
          id?: string
          school_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          devoir1_active?: boolean
          devoir2_active?: boolean
          devoir3_active?: boolean
          devoir4_active?: boolean
          devoir5_active?: boolean
          id?: string
          school_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_settings_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_id: string
          coefficient: number
          created_at: string
          id: string
          name: string
          ordering: number
          period_id: string
          school_id: string
          subject_type: string
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          coefficient?: number
          created_at?: string
          id?: string
          name: string
          ordering?: number
          period_id: string
          school_id: string
          subject_type?: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          coefficient?: number
          created_at?: string
          id?: string
          name?: string
          ordering?: number
          period_id?: string
          school_id?: string
          subject_type?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "grade_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_attendances: {
        Row: {
          effective_minutes: number
          id: string
          is_locked: boolean
          justification: string | null
          recorded_at: string
          school_id: string
          session_id: string
          status: string
          teacher_enrollment_id: string
          theoretical_minutes: number
        }
        Insert: {
          effective_minutes?: number
          id?: string
          is_locked?: boolean
          justification?: string | null
          recorded_at?: string
          school_id: string
          session_id: string
          status?: string
          teacher_enrollment_id: string
          theoretical_minutes: number
        }
        Update: {
          effective_minutes?: number
          id?: string
          is_locked?: boolean
          justification?: string | null
          recorded_at?: string
          school_id?: string
          session_id?: string
          status?: string
          teacher_enrollment_id?: string
          theoretical_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_attendances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_attendances_teacher_enrollment_id_fkey"
            columns: ["teacher_enrollment_id"]
            isOneToOne: false
            referencedRelation: "teacher_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_enrollments: {
        Row: {
          academic_year_label: string
          contract_type: string
          enrolled_at: string
          id: string
          payment_type: string
          salary_amount: number
          school_id: string
          status: string
          teacher_profile_id: string
          updated_at: string
          years_experience: number
        }
        Insert: {
          academic_year_label: string
          contract_type: string
          enrolled_at?: string
          id?: string
          payment_type: string
          salary_amount?: number
          school_id: string
          status?: string
          teacher_profile_id: string
          updated_at?: string
          years_experience?: number
        }
        Update: {
          academic_year_label?: string
          contract_type?: string
          enrolled_at?: string
          id?: string
          payment_type?: string
          salary_amount?: number
          school_id?: string
          status?: string
          teacher_profile_id?: string
          updated_at?: string
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_enrollments_teacher_profile_id_fkey"
            columns: ["teacher_profile_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_profiles: {
        Row: {
          created_at: string
          date_of_birth: string | null
          diploma: string | null
          email: string | null
          emergency_phone: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          photo_url: string | null
          place_of_birth: string | null
          residence: string | null
          school_id: string
          sex: string | null
          unique_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          diploma?: string | null
          email?: string | null
          emergency_phone?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          photo_url?: string | null
          place_of_birth?: string | null
          residence?: string | null
          school_id: string
          sex?: string | null
          unique_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          diploma?: string | null
          email?: string | null
          emergency_phone?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          photo_url?: string | null
          place_of_birth?: string | null
          residence?: string | null
          school_id?: string
          sex?: string | null
          unique_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      tuition_configs: {
        Row: {
          academic_year_label: string
          class_id: string
          created_at: string
          id: string
          inscription_fee: number
          monthly_fee: number
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_year_label: string
          class_id: string
          created_at?: string
          id?: string
          inscription_fee?: number
          monthly_fee?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          academic_year_label?: string
          class_id?: string
          created_at?: string
          id?: string
          inscription_fee?: number
          monthly_fee?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuition_configs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuition_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_niveau_defaults_to_class: {
        Args: { p_academic_year_label: string; p_class_id: string }
        Returns: undefined
      }
      assign_class_filiere: {
        Args: {
          p_academic_year_label: string
          p_class_id: string
          p_filiere_id: string
        }
        Returns: {
          academic_year_label: string
          assigned_at: string
          class_id: string
          filiere_id: string
          id: string
          school_id: string
        }
        SetofOptions: {
          from: "*"
          to: "class_filiere_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_manage_payments: { Args: never; Returns: boolean }
      cancel_payment: {
        Args: { p_cancelled_by: string; p_payment_id: string }
        Returns: {
          academic_year_label: string
          amount: number
          cancelled_at: string | null
          cancelled_by: string | null
          id: string
          method: string
          month_key: string | null
          note: string | null
          paid_at: string
          received_by: string | null
          reference: string | null
          school_id: string
          service_id: string | null
          status: string
          student_enrollment_id: string
          student_unique_id: string
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clear_subject_grades_column: {
        Args: { _column_name: string; _subject_id: number }
        Returns: undefined
      }
      create_student_user: {
        Args: {
          _academic_year_id: string
          _class_id: string
          _date_of_birth: string
          _email: string
          _first_name: string
          _last_name: string
          _password: string
          _phone: string
          _place_of_birth: string
          _residence: string
          _school_id: string
          _sex: string
          _student_identifier: string
          _tutor_info: Json
        }
        Returns: Json
      }
      create_teacher_user: {
        Args: {
          _contract_type: string
          _date_of_birth: string
          _diploma: string
          _email: string
          _emergency_phone: string
          _first_name: string
          _last_name: string
          _password: string
          _payment_type: string
          _phone: string
          _place_of_birth: string
          _residence: string
          _salary_amount: number
          _school_id: string
          _sex: string
          _subject_specialty: string
          _years_experience: number
        }
        Returns: Json
      }
      generate_student_unique_id: {
        Args: { p_school_id: string }
        Returns: string
      }
      generate_teacher_unique_id: {
        Args: { p_school_id: string }
        Returns: string
      }
      get_my_account_school_id: { Args: never; Returns: string }
      get_my_school_id: { Args: never; Returns: string }
      get_my_student_class_id: { Args: never; Returns: string }
      get_my_student_enrollment_id: { Args: never; Returns: string }
      get_my_subject_ranks: {
        Args: never
        Returns: {
          class_average: number
          rank_position: number
          subject_id: string
          total_students: number
        }[]
      }
      get_my_teacher_class_ids: { Args: never; Returns: string[] }
      get_my_teacher_enrollment_id: { Args: never; Returns: string }
      get_user_school_id:
        | { Args: never; Returns: string }
        | { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_school_defaults: {
        Args: { _academic_year_id: string; _school_id: string }
        Returns: undefined
      }
      is_school_admin: { Args: never; Returns: boolean }
      materialize_filiere_period: {
        Args: { p_class_id: string; p_filiere_id: string; p_period_id: string }
        Returns: undefined
      }
      materialize_niveau_defaults: {
        Args: { p_class_id: string; p_period_id: string }
        Returns: undefined
      }
      materialize_student_subjects: {
        Args: { p_student_enrollment_id: string }
        Returns: undefined
      }
      resolve_filiere_choice: {
        Args: {
          p_actor: string
          p_choice_group_id: string
          p_student_enrollment_id: string
          p_subject_name: string
        }
        Returns: {
          choice_group_id: string
          chosen_at: string
          chosen_by: string
          chosen_subject_name: string
          class_filiere_assignment_id: string
          id: string
          school_id: string
          student_enrollment_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "filiere_student_choices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reveal_school_account_password: {
        Args: { p_account_id: string }
        Returns: string
      }
      sync_period_filiere_subjects: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      sync_period_from_previous: {
        Args: { p_period_id: string }
        Returns: undefined
      }
      sync_period_niveau_defaults: {
        Args: { p_period_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin_school" | "teacher" | "secretary"
      subscription_status: "trial" | "active" | "suspended" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin_school", "teacher", "secretary"],
      subscription_status: ["trial", "active", "suspended", "cancelled"],
    },
  },
} as const
