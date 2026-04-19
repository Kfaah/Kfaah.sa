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
      active_task: {
        Row: {
          created_at: string
          id: string
          started_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          started_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          started_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_task_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in_at: string
          check_out_at: string | null
          created_at: string
          date: string
          id: string
          user_id: string
        }
        Insert: {
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          date?: string
          id?: string
          user_id: string
        }
        Update: {
          check_in_at?: string
          check_out_at?: string | null
          created_at?: string
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      employee_files: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          direct_manager_id: string | null
          email: string
          executive_manager_id: string | null
          full_name: string
          id: string
          job_role: string
          join_date: string | null
          performance: number | null
          phone: string | null
          role_color: string | null
          signature_url: string | null
          status: string | null
          tasks_completed: number | null
          tasks_total: number | null
          title: string | null
          updated_at: string
          user_id: string | null
          username: string | null
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          direct_manager_id?: string | null
          email: string
          executive_manager_id?: string | null
          full_name: string
          id?: string
          job_role: string
          join_date?: string | null
          performance?: number | null
          phone?: string | null
          role_color?: string | null
          signature_url?: string | null
          status?: string | null
          tasks_completed?: number | null
          tasks_total?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          direct_manager_id?: string | null
          email?: string
          executive_manager_id?: string | null
          full_name?: string
          id?: string
          job_role?: string
          join_date?: string | null
          performance?: number | null
          phone?: string | null
          role_color?: string | null
          signature_url?: string | null
          status?: string | null
          tasks_completed?: number | null
          tasks_total?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_direct_manager_id_fkey"
            columns: ["direct_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_executive_manager_id_fkey"
            columns: ["executive_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_plans: {
        Row: {
          achieved: number
          created_at: string
          daily_target: number
          day: number
          id: string
          notes: string | null
          operational_plan_month_id: string
          status: string
          updated_at: string
        }
        Insert: {
          achieved?: number
          created_at?: string
          daily_target?: number
          day: number
          id?: string
          notes?: string | null
          operational_plan_month_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          achieved?: number
          created_at?: string
          daily_target?: number
          day?: number
          id?: string
          notes?: string | null
          operational_plan_month_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "executive_plans_operational_plan_month_id_fkey"
            columns: ["operational_plan_month_id"]
            isOneToOne: false
            referencedRelation: "operational_plan_months"
            referencedColumns: ["id"]
          },
        ]
      }
      file_categories: {
        Row: {
          created_at: string
          display_order: number | null
          icon: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hr_leave_balances: {
        Row: {
          created_at: string
          id: string
          remaining_days: number | null
          request_type_id: string
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          remaining_days?: number | null
          request_type_id: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
          year?: number
        }
        Update: {
          created_at?: string
          id?: string
          remaining_days?: number | null
          request_type_id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_balances_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "hr_request_types"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_request_approvals: {
        Row: {
          action: string
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          action: string
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          action?: string
          approver_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_request_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "hr_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_request_types: {
        Row: {
          body_template: string | null
          closing_text: string | null
          color: string | null
          created_at: string
          custom_fields: Json | null
          deducts_from_balance: boolean | null
          description: string | null
          greeting_text: string | null
          header_offset: number | null
          header_text: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          letterhead_url: string | null
          max_days: number | null
          name: string
          name_ar: string
          requires_attachment: boolean | null
          show_dates: boolean | null
          show_notes: boolean | null
          show_reason: boolean | null
          updated_at: string
          workflow_stages: Json | null
        }
        Insert: {
          body_template?: string | null
          closing_text?: string | null
          color?: string | null
          created_at?: string
          custom_fields?: Json | null
          deducts_from_balance?: boolean | null
          description?: string | null
          greeting_text?: string | null
          header_offset?: number | null
          header_text?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          letterhead_url?: string | null
          max_days?: number | null
          name: string
          name_ar: string
          requires_attachment?: boolean | null
          show_dates?: boolean | null
          show_notes?: boolean | null
          show_reason?: boolean | null
          updated_at?: string
          workflow_stages?: Json | null
        }
        Update: {
          body_template?: string | null
          closing_text?: string | null
          color?: string | null
          created_at?: string
          custom_fields?: Json | null
          deducts_from_balance?: boolean | null
          description?: string | null
          greeting_text?: string | null
          header_offset?: number | null
          header_text?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          letterhead_url?: string | null
          max_days?: number | null
          name?: string
          name_ar?: string
          requires_attachment?: boolean | null
          show_dates?: boolean | null
          show_notes?: boolean | null
          show_reason?: boolean | null
          updated_at?: string
          workflow_stages?: Json | null
        }
        Relationships: []
      }
      hr_request_workflow: {
        Row: {
          action_at: string | null
          action_by: string | null
          assigned_to: string | null
          comments: string | null
          created_at: string
          id: string
          request_id: string
          stage_id: string | null
          stage_name: string
          stage_order: number
          status: string
        }
        Insert: {
          action_at?: string | null
          action_by?: string | null
          assigned_to?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          request_id: string
          stage_id?: string | null
          stage_name: string
          stage_order: number
          status?: string
        }
        Update: {
          action_at?: string | null
          action_by?: string | null
          assigned_to?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          request_id?: string
          stage_id?: string | null
          stage_name?: string
          stage_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_request_workflow_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "hr_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_request_workflow_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "hr_workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approver_signature_url: string | null
          attachment_name: string | null
          attachment_url: string | null
          created_at: string
          current_stage: number | null
          custom_field_values: Json | null
          days_count: number | null
          direct_manager_id: string | null
          end_date: string | null
          executive_manager_approved: boolean | null
          executive_manager_approved_at: string | null
          executive_manager_id: string | null
          final_pdf_url: string | null
          hr_manager_approved: boolean | null
          hr_manager_approved_at: string | null
          hr_manager_id: string | null
          id: string
          manager_approved: boolean | null
          manager_approved_at: string | null
          notes: string | null
          reason: string | null
          rejection_reason: string | null
          request_number: string
          request_type_id: string
          start_date: string | null
          status: string
          substitute_approved: boolean | null
          substitute_approved_at: string | null
          substitute_employee_id: string | null
          updated_at: string
          user_id: string
          workflow_stage: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approver_signature_url?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          current_stage?: number | null
          custom_field_values?: Json | null
          days_count?: number | null
          direct_manager_id?: string | null
          end_date?: string | null
          executive_manager_approved?: boolean | null
          executive_manager_approved_at?: string | null
          executive_manager_id?: string | null
          final_pdf_url?: string | null
          hr_manager_approved?: boolean | null
          hr_manager_approved_at?: string | null
          hr_manager_id?: string | null
          id?: string
          manager_approved?: boolean | null
          manager_approved_at?: string | null
          notes?: string | null
          reason?: string | null
          rejection_reason?: string | null
          request_number: string
          request_type_id: string
          start_date?: string | null
          status?: string
          substitute_approved?: boolean | null
          substitute_approved_at?: string | null
          substitute_employee_id?: string | null
          updated_at?: string
          user_id: string
          workflow_stage?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approver_signature_url?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          current_stage?: number | null
          custom_field_values?: Json | null
          days_count?: number | null
          direct_manager_id?: string | null
          end_date?: string | null
          executive_manager_approved?: boolean | null
          executive_manager_approved_at?: string | null
          executive_manager_id?: string | null
          final_pdf_url?: string | null
          hr_manager_approved?: boolean | null
          hr_manager_approved_at?: string | null
          hr_manager_id?: string | null
          id?: string
          manager_approved?: boolean | null
          manager_approved_at?: string | null
          notes?: string | null
          reason?: string | null
          rejection_reason?: string | null
          request_number?: string
          request_type_id?: string
          start_date?: string | null
          status?: string
          substitute_approved?: boolean | null
          substitute_approved_at?: string | null
          substitute_employee_id?: string | null
          updated_at?: string
          user_id?: string
          workflow_stage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_requests_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "hr_request_types"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_workflow_stages: {
        Row: {
          approver_role: string | null
          approver_user_id: string | null
          auto_approve_after_days: number | null
          can_reject: boolean | null
          created_at: string
          id: string
          is_required: boolean | null
          request_type_id: string
          stage_name: string
          stage_order: number
          updated_at: string
        }
        Insert: {
          approver_role?: string | null
          approver_user_id?: string | null
          auto_approve_after_days?: number | null
          can_reject?: boolean | null
          created_at?: string
          id?: string
          is_required?: boolean | null
          request_type_id: string
          stage_name: string
          stage_order?: number
          updated_at?: string
        }
        Update: {
          approver_role?: string | null
          approver_user_id?: string | null
          auto_approve_after_days?: number | null
          can_reject?: boolean | null
          created_at?: string
          id?: string
          is_required?: boolean | null
          request_type_id?: string
          stage_name?: string
          stage_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_workflow_stages_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "hr_request_types"
            referencedColumns: ["id"]
          },
        ]
      }
      initiative_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          initiative_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          initiative_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          initiative_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiative_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiative_departments_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      initiatives: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          display_order: number | null
          id: string
          name: string
          strategic_goal_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          strategic_goal_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          strategic_goal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiatives_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiatives_strategic_goal_id_fkey"
            columns: ["strategic_goal_id"]
            isOneToOne: false
            referencedRelation: "strategic_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          color: string | null
          created_at: string
          department_id: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          conversation_id: string
          created_at: string
          id: string
          is_deleted: boolean
          message: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          message?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          message?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_task_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_plan_column_order: {
        Row: {
          column_key: string
          column_name: string
          created_at: string
          display_order: number
          id: string
          is_standard: boolean
          is_visible: boolean
          updated_at: string
        }
        Insert: {
          column_key: string
          column_name: string
          created_at?: string
          display_order?: number
          id?: string
          is_standard?: boolean
          is_visible?: boolean
          updated_at?: string
        }
        Update: {
          column_key?: string
          column_name?: string
          created_at?: string
          display_order?: number
          id?: string
          is_standard?: boolean
          is_visible?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      operational_plan_custom_columns: {
        Row: {
          column_type: Database["public"]["Enums"]["custom_column_type"]
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          column_type: Database["public"]["Enums"]["custom_column_type"]
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          column_type?: Database["public"]["Enums"]["custom_column_type"]
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      operational_plan_custom_values: {
        Row: {
          column_id: string
          created_at: string
          date_value: string | null
          department_id: string | null
          employee_id: string | null
          id: string
          number_value: number | null
          operational_plan_id: string
          text_value: string | null
          updated_at: string
        }
        Insert: {
          column_id: string
          created_at?: string
          date_value?: string | null
          department_id?: string | null
          employee_id?: string | null
          id?: string
          number_value?: number | null
          operational_plan_id: string
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          column_id?: string
          created_at?: string
          date_value?: string | null
          department_id?: string | null
          employee_id?: string | null
          id?: string
          number_value?: number | null
          operational_plan_id?: string
          text_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_plan_custom_values_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "operational_plan_custom_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_plan_custom_values_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_plan_custom_values_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_plan_custom_values_operational_plan_id_fkey"
            columns: ["operational_plan_id"]
            isOneToOne: false
            referencedRelation: "operational_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_plan_months: {
        Row: {
          created_at: string
          id: string
          month: number
          monthly_target: number
          operational_plan_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          monthly_target?: number
          operational_plan_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          monthly_target?: number
          operational_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_plan_months_operational_plan_id_fkey"
            columns: ["operational_plan_id"]
            isOneToOne: false
            referencedRelation: "operational_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_plans: {
        Row: {
          activity_name: string
          annual_target: number
          created_at: string
          display_order: number | null
          id: string
          initiative: string | null
          initiative_id: string | null
          responsible_employee_id: string | null
          status: string
          strategic_goal: string | null
          strategic_goal_id: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          activity_name: string
          annual_target?: number
          created_at?: string
          display_order?: number | null
          id?: string
          initiative?: string | null
          initiative_id?: string | null
          responsible_employee_id?: string | null
          status?: string
          strategic_goal?: string | null
          strategic_goal_id?: string | null
          updated_at?: string
          user_id: string
          year?: number
        }
        Update: {
          activity_name?: string
          annual_target?: number
          created_at?: string
          display_order?: number | null
          id?: string
          initiative?: string | null
          initiative_id?: string | null
          responsible_employee_id?: string | null
          status?: string
          strategic_goal?: string | null
          strategic_goal_id?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "operational_plans_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_plans_responsible_employee_id_fkey"
            columns: ["responsible_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_plans_strategic_goal_id_fkey"
            columns: ["strategic_goal_id"]
            isOneToOne: false
            referencedRelation: "strategic_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string | null
          first_name: string
          job_role: string | null
          last_name: string
          location: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          first_name?: string
          job_role?: string | null
          last_name?: string
          location?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          first_name?: string
          job_role?: string | null
          last_name?: string
          location?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      strategic_goal_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          strategic_goal_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          strategic_goal_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          strategic_goal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_goal_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_goal_departments_strategic_goal_id_fkey"
            columns: ["strategic_goal_id"]
            isOneToOne: false
            referencedRelation: "strategic_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_goals: {
        Row: {
          color: string | null
          created_at: string
          department_id: string | null
          description: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string
          year: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string
          year?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "strategic_goals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      task_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          id: string
          message: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_time_minutes: number | null
          ai_generated: boolean | null
          category: string | null
          completion_percentage: number | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_time_minutes: number | null
          executive_plan_id: string | null
          id: string
          priority: string
          quality_percentage: number | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_time_minutes?: number | null
          ai_generated?: boolean | null
          category?: string | null
          completion_percentage?: number | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_time_minutes?: number | null
          executive_plan_id?: string | null
          id?: string
          priority?: string
          quality_percentage?: number | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_time_minutes?: number | null
          ai_generated?: boolean | null
          category?: string | null
          completion_percentage?: number | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_time_minutes?: number | null
          executive_plan_id?: string | null
          id?: string
          priority?: string
          quality_percentage?: number | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_executive_plan_id_fkey"
            columns: ["executive_plan_id"]
            isOneToOne: false
            referencedRelation: "executive_plans"
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
      welcome_backgrounds: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          image_url: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          image_url: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      welcome_quotes: {
        Row: {
          created_at: string
          display_order: number | null
          emoji: string | null
          id: string
          is_active: boolean | null
          quote: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          quote: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          quote?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_time: { Args: { _user_id: string }; Returns: boolean }
      create_direct_conversation: {
        Args: { _other_user_id: string }
        Returns: string
      }
      get_accountants: { Args: never; Returns: string[] }
      get_conversations_for_user: {
        Args: { _user_id: string }
        Returns: {
          conversation_id: string
          other_full_name: string
          other_user_id: string
          updated_at: string
        }[]
      }
      get_finance_manager_id: { Args: never; Returns: string }
      get_hr_manager_id: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "time_editor"
        | "hr_manager"
        | "finance_manager"
        | "accountant"
      custom_column_type: "text" | "number" | "date" | "department" | "employee"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "time_editor",
        "hr_manager",
        "finance_manager",
        "accountant",
      ],
      custom_column_type: ["text", "number", "date", "department", "employee"],
    },
  },
} as const
