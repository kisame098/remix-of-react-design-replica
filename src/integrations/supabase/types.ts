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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          closed_at: string | null
          created_at: string | null
          end_date: string
          id: string
          is_active: boolean | null
          is_closed: boolean | null
          name: string
          school_id: string
          start_date: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          name: string
          school_id: string
          start_date: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          is_closed?: boolean | null
          name?: string
          school_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          schedule_event_id: string | null
          school_id: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          schedule_event_id?: string | null
          school_id: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          schedule_event_id?: string | null
          school_id?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
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
        ]
      }
      classes: {
        Row: {
          academic_year_id: string
          created_at: string | null
          id: string
          name: string
          school_id: string
          student_limit: number
          updated_at: string | null
        }
        Insert: {
          academic_year_id: string
          created_at?: string | null
          id?: string
          name: string
          school_id: string
          student_limit?: number
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string
          created_at?: string | null
          id?: string
          name?: string
          school_id?: string
          student_limit?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_periods: {
        Row: {
          academic_year_id: string
          created_at: string | null
          end_date: string | null
          id: number
          name: string
          school_id: string
          start_date: string | null
          type: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string | null
          end_date?: string | null
          id?: number
          name: string
          school_id: string
          start_date?: string | null
          type: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: number
          name?: string
          school_id?: string
          start_date?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_periods_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
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
          class_id: string
          composition: number | null
          created_at: string | null
          devoir1: number | null
          devoir2: number | null
          devoir3: number | null
          devoir4: number | null
          devoir5: number | null
          id: string
          note: number | null
          period_id: number
          school_id: string
          student_id: string
          subject_id: number
          updated_at: string | null
        }
        Insert: {
          class_id: string
          composition?: number | null
          created_at?: string | null
          devoir1?: number | null
          devoir2?: number | null
          devoir3?: number | null
          devoir4?: number | null
          devoir5?: number | null
          id?: string
          note?: number | null
          period_id: number
          school_id: string
          student_id: string
          subject_id: number
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          composition?: number | null
          created_at?: string | null
          devoir1?: number | null
          devoir2?: number | null
          devoir3?: number | null
          devoir4?: number | null
          devoir5?: number | null
          id?: string
          note?: number | null
          period_id?: number
          school_id?: string
          student_id?: string
          subject_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "grade_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_events: {
        Row: {
          academic_year_id: string
          class_id: string
          created_at: string | null
          day_index: number
          end_time: string
          group_id: string
          id: string
          room: string | null
          school_id: string
          start_time: string
          subject_id: number | null
          teacher_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          academic_year_id: string
          class_id: string
          created_at?: string | null
          day_index: number
          end_time: string
          group_id?: string
          id?: string
          room?: string | null
          school_id: string
          start_time: string
          subject_id?: number | null
          teacher_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string
          class_id?: string
          created_at?: string | null
          day_index?: number
          end_time?: string
          group_id?: string
          id?: string
          room?: string | null
          school_id?: string
          start_time?: string
          subject_id?: number | null
          teacher_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "schedule_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          id: string
          name: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: []
      }
      student_attendance: {
        Row: {
          id: string
          is_justified: boolean | null
          justification: string | null
          recorded_at: string
          recorded_by: string | null
          session_id: string
          status: string
          student_id: string
        }
        Insert: {
          id?: string
          is_justified?: boolean | null
          justification?: string | null
          recorded_at?: string
          recorded_by?: string | null
          session_id: string
          status?: string
          student_id: string
        }
        Update: {
          id?: string
          is_justified?: boolean | null
          justification?: string | null
          recorded_at?: string
          recorded_by?: string | null
          session_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          academic_year_id: string
          class_id: string
          enrolled_at: string | null
          id: string
          student_id: string
        }
        Insert: {
          academic_year_id: string
          class_id: string
          enrolled_at?: string | null
          id?: string
          student_id: string
        }
        Update: {
          academic_year_id?: string
          class_id?: string
          enrolled_at?: string | null
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subject_configs: {
        Row: {
          custom_coefficient: number | null
          id: string
          is_active: boolean | null
          lv_level: string | null
          student_id: string
          subject_id: number
        }
        Insert: {
          custom_coefficient?: number | null
          id?: string
          is_active?: boolean | null
          lv_level?: string | null
          student_id: string
          subject_id: number
        }
        Update: {
          custom_coefficient?: number | null
          id?: string
          is_active?: boolean | null
          lv_level?: string | null
          student_id?: string
          subject_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_subject_configs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_configs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_year_id: string
          created_at: string | null
          date_of_birth: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          password_text: string | null
          phone: string | null
          place_of_birth: string
          residence: string
          school_id: string
          sex: string
          student_identifier: string
          tutor_info: Json | null
          updated_at: string | null
        }
        Insert: {
          academic_year_id: string
          created_at?: string | null
          date_of_birth: string
          email?: string | null
          first_name: string
          id: string
          last_name: string
          password_text?: string | null
          phone?: string | null
          place_of_birth: string
          residence: string
          school_id: string
          sex: string
          student_identifier: string
          tutor_info?: Json | null
          updated_at?: string | null
        }
        Update: {
          academic_year_id?: string
          created_at?: string | null
          date_of_birth?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          password_text?: string | null
          phone?: string | null
          place_of_birth?: string
          residence?: string
          school_id?: string
          sex?: string
          student_identifier?: string
          tutor_info?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_configs: {
        Row: {
          created_at: string | null
          devoir1_active: boolean | null
          devoir2_active: boolean | null
          devoir3_active: boolean | null
          devoir4_active: boolean | null
          devoir5_active: boolean | null
          id: string
          lv_mode_active: boolean | null
          lv1_coefficient: number | null
          lv2_coefficient: number | null
          lv3_coefficient: number | null
          student_settings: Json | null
          subject_id: number
        }
        Insert: {
          created_at?: string | null
          devoir1_active?: boolean | null
          devoir2_active?: boolean | null
          devoir3_active?: boolean | null
          devoir4_active?: boolean | null
          devoir5_active?: boolean | null
          id?: string
          lv_mode_active?: boolean | null
          lv1_coefficient?: number | null
          lv2_coefficient?: number | null
          lv3_coefficient?: number | null
          student_settings?: Json | null
          subject_id: number
        }
        Update: {
          created_at?: string | null
          devoir1_active?: boolean | null
          devoir2_active?: boolean | null
          devoir3_active?: boolean | null
          devoir4_active?: boolean | null
          devoir5_active?: boolean | null
          id?: string
          lv_mode_active?: boolean | null
          lv1_coefficient?: number | null
          lv2_coefficient?: number | null
          lv3_coefficient?: number | null
          student_settings?: Json | null
          subject_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "subject_configs_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: true
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_id: string
          coefficient: number | null
          created_at: string | null
          id: number
          name: string
          period_id: number
          school_id: string
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          coefficient?: number | null
          created_at?: string | null
          id?: number
          name: string
          period_id: number
          school_id: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          coefficient?: number | null
          created_at?: string | null
          id?: number
          name?: string
          period_id?: number
          school_id?: string
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
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_attendance: {
        Row: {
          effective_minutes: number | null
          id: string
          is_locked: boolean | null
          justification: string | null
          recorded_at: string
          recorded_by: string | null
          session_id: string
          status: string
          teacher_id: string
          theoretical_minutes: number | null
        }
        Insert: {
          effective_minutes?: number | null
          id?: string
          is_locked?: boolean | null
          justification?: string | null
          recorded_at?: string
          recorded_by?: string | null
          session_id: string
          status?: string
          teacher_id: string
          theoretical_minutes?: number | null
        }
        Update: {
          effective_minutes?: number | null
          id?: string
          is_locked?: boolean | null
          justification?: string | null
          recorded_at?: string
          recorded_by?: string | null
          session_id?: string
          status?: string
          teacher_id?: string
          theoretical_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          contract_type: string | null
          created_at: string | null
          date_of_birth: string | null
          diploma: string | null
          email: string | null
          emergency_phone: string | null
          first_name: string
          id: string
          last_name: string
          password_text: string | null
          payment_type: string | null
          phone: string | null
          place_of_birth: string | null
          residence: string | null
          salary_amount: number | null
          school_id: string
          sex: string | null
          subject_specialty: string | null
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          contract_type?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          diploma?: string | null
          email?: string | null
          emergency_phone?: string | null
          first_name: string
          id: string
          last_name: string
          password_text?: string | null
          payment_type?: string | null
          phone?: string | null
          place_of_birth?: string | null
          residence?: string | null
          salary_amount?: number | null
          school_id: string
          sex?: string | null
          subject_specialty?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          contract_type?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          diploma?: string | null
          email?: string | null
          emergency_phone?: string | null
          first_name?: string
          id?: string
          last_name?: string
          password_text?: string | null
          payment_type?: string | null
          phone?: string | null
          place_of_birth?: string | null
          residence?: string | null
          salary_amount?: number | null
          school_id?: string
          sex?: string | null
          subject_specialty?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      get_user_school_id:
        | { Args: never; Returns: string }
        | { Args: { _user_id: string }; Returns: string }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      initialize_school_defaults: {
        Args: { _academic_year_id: string; _school_id: string }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
