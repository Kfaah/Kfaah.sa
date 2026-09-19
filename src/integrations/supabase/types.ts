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
      abandoned_carts: {
        Row: {
          abandoned_at: string
          amount: number | null
          created_at: string
          donor_id: string | null
          donor_name: string | null
          donor_phone: string | null
          external_id: string | null
          follow_up_status: string
          followed_up_at: string | null
          followed_up_by: string | null
          id: string
          organization_id: string | null
          project_name: string | null
          raw_data: Json | null
          recovered: boolean
          recovery_notes: string | null
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          abandoned_at: string
          amount?: number | null
          created_at?: string
          donor_id?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          external_id?: string | null
          follow_up_status?: string
          followed_up_at?: string | null
          followed_up_by?: string | null
          id?: string
          organization_id?: string | null
          project_name?: string | null
          raw_data?: Json | null
          recovered?: boolean
          recovery_notes?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          abandoned_at?: string
          amount?: number | null
          created_at?: string
          donor_id?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          external_id?: string | null
          follow_up_status?: string
          followed_up_at?: string | null
          followed_up_by?: string | null
          id?: string
          organization_id?: string | null
          project_name?: string | null
          raw_data?: Json | null
          recovered?: boolean
          recovery_notes?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abandoned_carts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accountability_questions: {
        Row: {
          answer: string | null
          answer_yes_no: string | null
          answered_at: string | null
          answered_by: string | null
          category: string
          context: string | null
          created_at: string
          deep_analysis_id: string | null
          evidence_check_id: string | null
          evidence_findings: Json | null
          evidence_notes: string | null
          evidence_score: number | null
          evidence_url: string | null
          evidence_verdict: string | null
          expected_evidence: string | null
          generated_task_id: string | null
          id: string
          last_check_score: number | null
          last_check_verdict: string | null
          organization_id: string
          priority: string
          question_text: string
          reminder_count: number
          reminder_sent_at: string | null
          status: string
          target_employee_id: string | null
          target_job_role: string
          title: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          answer_yes_no?: string | null
          answered_at?: string | null
          answered_by?: string | null
          category: string
          context?: string | null
          created_at?: string
          deep_analysis_id?: string | null
          evidence_check_id?: string | null
          evidence_findings?: Json | null
          evidence_notes?: string | null
          evidence_score?: number | null
          evidence_url?: string | null
          evidence_verdict?: string | null
          expected_evidence?: string | null
          generated_task_id?: string | null
          id?: string
          last_check_score?: number | null
          last_check_verdict?: string | null
          organization_id: string
          priority?: string
          question_text: string
          reminder_count?: number
          reminder_sent_at?: string | null
          status?: string
          target_employee_id?: string | null
          target_job_role: string
          title: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
          answer_yes_no?: string | null
          answered_at?: string | null
          answered_by?: string | null
          category?: string
          context?: string | null
          created_at?: string
          deep_analysis_id?: string | null
          evidence_check_id?: string | null
          evidence_findings?: Json | null
          evidence_notes?: string | null
          evidence_score?: number | null
          evidence_url?: string | null
          evidence_verdict?: string | null
          expected_evidence?: string | null
          generated_task_id?: string | null
          id?: string
          last_check_score?: number | null
          last_check_verdict?: string | null
          organization_id?: string
          priority?: string
          question_text?: string
          reminder_count?: number
          reminder_sent_at?: string | null
          status?: string
          target_employee_id?: string | null
          target_job_role?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      accountability_tasks: {
        Row: {
          ai_generated: boolean
          ai_reason: string | null
          assigned_employee_id: string | null
          category: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          description: string | null
          detailed_instructions: string | null
          due_date: string | null
          evidence_score_when_generated: number | null
          gap_reason: string | null
          id: string
          organization_id: string
          parent_question_id: string | null
          priority: string
          source: string
          source_id: string | null
          status: string
          target_job_role: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          ai_reason?: string | null
          assigned_employee_id?: string | null
          category?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string | null
          detailed_instructions?: string | null
          due_date?: string | null
          evidence_score_when_generated?: number | null
          gap_reason?: string | null
          id?: string
          organization_id: string
          parent_question_id?: string | null
          priority?: string
          source?: string
          source_id?: string | null
          status?: string
          target_job_role?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          ai_reason?: string | null
          assigned_employee_id?: string | null
          category?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string | null
          detailed_instructions?: string | null
          due_date?: string | null
          evidence_score_when_generated?: number | null
          gap_reason?: string | null
          id?: string
          organization_id?: string
          parent_question_id?: string | null
          priority?: string
          source?: string
          source_id?: string | null
          status?: string
          target_job_role?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      action_plan_tasks: {
        Row: {
          action_plan_id: string
          ai_suggested_employee_id: string | null
          ai_suggestion_reason: string | null
          assigned_employee_id: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          impact: string
          organization_id: string
          priority: number
          start_date: string | null
          status: string
          subtasks: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          action_plan_id: string
          ai_suggested_employee_id?: string | null
          ai_suggestion_reason?: string | null
          assigned_employee_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: string
          organization_id: string
          priority?: number
          start_date?: string | null
          status?: string
          subtasks?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          action_plan_id?: string
          ai_suggested_employee_id?: string | null
          ai_suggestion_reason?: string | null
          assigned_employee_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: string
          organization_id?: string
          priority?: number
          start_date?: string | null
          status?: string
          subtasks?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plan_tasks_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_tasks_ai_suggested_employee_id_fkey"
            columns: ["ai_suggested_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_tasks_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plan_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plans: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          organization_id: string
          progress: number
          source: string
          source_insight_id: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          organization_id: string
          progress?: number
          source?: string
          source_insight_id?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          organization_id?: string
          progress?: number
          source?: string
          source_insight_id?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_source_insight_id_fkey"
            columns: ["source_insight_id"]
            isOneToOne: false
            referencedRelation: "admin_ai_insights_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      active_task: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          started_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          started_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          started_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_task_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_task_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_related_employees: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          executive_plan_id: string
          id: string
          notes: string | null
          organization_id: string | null
          role_in_activity: string | null
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          executive_plan_id: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          role_in_activity?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          executive_plan_id?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          role_in_activity?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_related_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_related_employees_executive_plan_id_fkey"
            columns: ["executive_plan_id"]
            isOneToOne: false
            referencedRelation: "executive_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_related_employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_related_tasks: {
        Row: {
          created_at: string
          created_by: string | null
          day_offset: number
          description: string | null
          dispatched_task_id: string | null
          display_order: number
          employee_id: string
          estimated_minutes: number
          executive_plan_id: string
          id: string
          is_dispatched: boolean
          organization_id: string | null
          phase: string
          priority: string
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_offset?: number
          description?: string | null
          dispatched_task_id?: string | null
          display_order?: number
          employee_id: string
          estimated_minutes?: number
          executive_plan_id: string
          id?: string
          is_dispatched?: boolean
          organization_id?: string | null
          phase: string
          priority?: string
          source?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_offset?: number
          description?: string | null
          dispatched_task_id?: string | null
          display_order?: number
          employee_id?: string
          estimated_minutes?: number
          executive_plan_id?: string
          id?: string
          is_dispatched?: boolean
          organization_id?: string | null
          phase?: string
          priority?: string
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_related_tasks_dispatched_task_id_fkey"
            columns: ["dispatched_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_related_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_related_tasks_executive_plan_id_fkey"
            columns: ["executive_plan_id"]
            isOneToOne: false
            referencedRelation: "executive_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_related_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_ai_insights_cache: {
        Row: {
          created_at: string
          generated_at: string
          generated_by: string | null
          id: string
          insight: Json
          metrics_snapshot: Json | null
          organization_id: string
          period_from: string | null
          period_label: string
          period_to: string | null
        }
        Insert: {
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          insight: Json
          metrics_snapshot?: Json | null
          organization_id: string
          period_from?: string | null
          period_label: string
          period_to?: string | null
        }
        Update: {
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          insight?: Json
          metrics_snapshot?: Json | null
          organization_id?: string
          period_from?: string | null
          period_label?: string
          period_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_ai_insights_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_runs: {
        Row: {
          ai_model: string | null
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          events_detected: number
          id: string
          ideas_generated: number
          insights_generated: number
          organization_id: string | null
          scope: Json | null
          started_at: string
          status: string
          summary: string | null
          tasks_generated: number
          trigger_source: string
          triggered_by: string | null
          upload_id: string | null
        }
        Insert: {
          ai_model?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          events_detected?: number
          id?: string
          ideas_generated?: number
          insights_generated?: number
          organization_id?: string | null
          scope?: Json | null
          started_at?: string
          status?: string
          summary?: string | null
          tasks_generated?: number
          trigger_source?: string
          triggered_by?: string | null
          upload_id?: string | null
        }
        Update: {
          ai_model?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          events_detected?: number
          id?: string
          ideas_generated?: number
          insights_generated?: number
          organization_id?: string | null
          scope?: Json | null
          started_at?: string
          status?: string
          summary?: string | null
          tasks_generated?: number
          trigger_source?: string
          triggered_by?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          error_details: Json | null
          error_message: string | null
          file_size_bytes: number | null
          github_commit_sha: string | null
          github_commit_url: string | null
          github_path: string | null
          id: string
          started_at: string
          status: string
          tables_count: number | null
          total_rows: number | null
          trigger_type: string
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_details?: Json | null
          error_message?: string | null
          file_size_bytes?: number | null
          github_commit_sha?: string | null
          github_commit_url?: string | null
          github_path?: string | null
          id?: string
          started_at?: string
          status?: string
          tables_count?: number | null
          total_rows?: number | null
          trigger_type?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_details?: Json | null
          error_message?: string | null
          file_size_bytes?: number | null
          github_commit_sha?: string | null
          github_commit_url?: string | null
          github_path?: string | null
          id?: string
          started_at?: string
          status?: string
          tables_count?: number | null
          total_rows?: number | null
          trigger_type?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bank_transfers: {
        Row: {
          amount: number
          bank_name: string | null
          created_at: string
          id: string
          matched_donation_id: string | null
          notes: string | null
          organization_id: string | null
          raw_data: Json | null
          reconciliation_status: string
          sender_name: string | null
          sender_phone: string | null
          transfer_date: string
          transfer_number: string | null
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          amount: number
          bank_name?: string | null
          created_at?: string
          id?: string
          matched_donation_id?: string | null
          notes?: string | null
          organization_id?: string | null
          raw_data?: Json | null
          reconciliation_status?: string
          sender_name?: string | null
          sender_phone?: string | null
          transfer_date: string
          transfer_number?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string | null
          created_at?: string
          id?: string
          matched_donation_id?: string | null
          notes?: string | null
          organization_id?: string | null
          raw_data?: Json | null
          reconciliation_status?: string
          sender_name?: string | null
          sender_phone?: string | null
          transfer_date?: string
          transfer_number?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transfers_matched_donation_id_fkey"
            columns: ["matched_donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          collected_amount: number
          created_at: string
          description: string | null
          donations_count: number
          end_date: string | null
          external_id: string | null
          goal_amount: number | null
          id: string
          name: string
          organization_id: string | null
          raw_data: Json | null
          start_date: string | null
          status: string
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          collected_amount?: number
          created_at?: string
          description?: string | null
          donations_count?: number
          end_date?: string | null
          external_id?: string | null
          goal_amount?: number | null
          id?: string
          name: string
          organization_id?: string | null
          raw_data?: Json | null
          start_date?: string | null
          status?: string
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          collected_amount?: number
          created_at?: string
          description?: string | null
          donations_count?: number
          end_date?: string | null
          external_id?: string | null
          goal_amount?: number | null
          id?: string
          name?: string
          organization_id?: string | null
          raw_data?: Json | null
          start_date?: string | null
          status?: string
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      data_uploads_log: {
        Row: {
          ai_analysis: Json | null
          ai_analyzed_at: string | null
          ai_model: string | null
          completed_at: string | null
          created_at: string
          detected_schema: string | null
          duplicate_rows: number
          error_log: Json | null
          failed_rows: number
          file_name: string
          file_path: string | null
          file_type: string
          for_date: string | null
          id: string
          inserted_rows: number
          organization_id: string | null
          status: string
          storage_bucket: string | null
          total_rows: number
          uploaded_by: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          ai_model?: string | null
          completed_at?: string | null
          created_at?: string
          detected_schema?: string | null
          duplicate_rows?: number
          error_log?: Json | null
          failed_rows?: number
          file_name: string
          file_path?: string | null
          file_type: string
          for_date?: string | null
          id?: string
          inserted_rows?: number
          organization_id?: string | null
          status?: string
          storage_bucket?: string | null
          total_rows?: number
          uploaded_by: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          ai_model?: string | null
          completed_at?: string | null
          created_at?: string
          detected_schema?: string | null
          duplicate_rows?: number
          error_log?: Json | null
          failed_rows?: number
          file_name?: string
          file_path?: string | null
          file_type?: string
          for_date?: string | null
          id?: string
          inserted_rows?: number
          organization_id?: string | null
          status?: string
          storage_bucket?: string | null
          total_rows?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_uploads_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deep_analyses: {
        Row: {
          ai_model: string | null
          campaigns_analysis: Json | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          donations_summary: Json | null
          donors_segmentation: Json | null
          error_message: string | null
          gaps: Json | null
          id: string
          organization_id: string
          overall_assessment: string | null
          questions_generated: number
          recommendations: Json | null
          social_insights: Json | null
          sources: Json
          started_at: string
          status: string
          store_insights: Json | null
          strengths: Json | null
          tasks_generated: number
          trigger_source: string
          updated_at: string
          upload_id: string | null
          website_insights: Json | null
        }
        Insert: {
          ai_model?: string | null
          campaigns_analysis?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          donations_summary?: Json | null
          donors_segmentation?: Json | null
          error_message?: string | null
          gaps?: Json | null
          id?: string
          organization_id: string
          overall_assessment?: string | null
          questions_generated?: number
          recommendations?: Json | null
          social_insights?: Json | null
          sources?: Json
          started_at?: string
          status?: string
          store_insights?: Json | null
          strengths?: Json | null
          tasks_generated?: number
          trigger_source?: string
          updated_at?: string
          upload_id?: string | null
          website_insights?: Json | null
        }
        Update: {
          ai_model?: string | null
          campaigns_analysis?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          donations_summary?: Json | null
          donors_segmentation?: Json | null
          error_message?: string | null
          gaps?: Json | null
          id?: string
          organization_id?: string
          overall_assessment?: string | null
          questions_generated?: number
          recommendations?: Json | null
          social_insights?: Json | null
          sources?: Json
          started_at?: string
          status?: string
          store_insights?: Json | null
          strengths?: Json | null
          tasks_generated?: number
          trigger_source?: string
          updated_at?: string
          upload_id?: string | null
          website_insights?: Json | null
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
          organization_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          amount: number
          created_at: string
          currency: string
          donation_date: string
          donation_number: string
          donor_id: string | null
          donor_name: string | null
          donor_phone: string | null
          id: string
          organization_id: string | null
          payment_method: string | null
          project_id: string | null
          project_name: string | null
          raw_data: Json | null
          source: string | null
          status: string
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          donation_date: string
          donation_number: string
          donor_id?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          id?: string
          organization_id?: string | null
          payment_method?: string | null
          project_id?: string | null
          project_name?: string | null
          raw_data?: Json | null
          source?: string | null
          status?: string
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          donation_date?: string
          donation_number?: string
          donor_id?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          id?: string
          organization_id?: string | null
          payment_method?: string | null
          project_id?: string | null
          project_name?: string | null
          raw_data?: Json | null
          source?: string | null
          status?: string
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_insights: {
        Row: {
          affected_entities: Json | null
          ai_model: string | null
          category: string
          created_at: string
          details: Json | null
          expires_at: string | null
          generated_at: string
          id: string
          insight_type: string
          is_active: boolean
          is_pinned: boolean
          metrics: Json | null
          organization_id: string | null
          recommended_actions: Json | null
          severity: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_entities?: Json | null
          ai_model?: string | null
          category: string
          created_at?: string
          details?: Json | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          insight_type: string
          is_active?: boolean
          is_pinned?: boolean
          metrics?: Json | null
          organization_id?: string | null
          recommended_actions?: Json | null
          severity?: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_entities?: Json | null
          ai_model?: string | null
          category?: string
          created_at?: string
          details?: Json | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          insight_type?: string
          is_active?: boolean
          is_pinned?: boolean
          metrics?: Json | null
          organization_id?: string | null
          recommended_actions?: Json | null
          severity?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donor_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_letters_log: {
        Row: {
          created_at: string
          donor_id: string | null
          format: string
          generated_by: string | null
          id: string
          letter_type: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          donor_id?: string | null
          format: string
          generated_by?: string | null
          id?: string
          letter_type: string
          organization_id: string
        }
        Update: {
          created_at?: string
          donor_id?: string | null
          format?: string
          generated_by?: string | null
          id?: string
          letter_type?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "donor_letters_log_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_letters_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_lifecycle_events: {
        Row: {
          amount: number | null
          created_at: string
          donor_id: string | null
          event_date: string
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string | null
          task_generated: boolean
        }
        Insert: {
          amount?: number | null
          created_at?: string
          donor_id?: string | null
          event_date: string
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          task_generated?: boolean
        }
        Update: {
          amount?: number | null
          created_at?: string
          donor_id?: string | null
          event_date?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          task_generated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "donor_lifecycle_events_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_lifecycle_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_spend_summary: {
        Row: {
          donor_id: string
          fully_spent: boolean
          fully_spent_message: string | null
          last_updated: string
          organization_id: string
          primary_project: string | null
          projects_funded: Json
          total_allocated: number
          total_donated: number
          total_spent_visible: number
        }
        Insert: {
          donor_id: string
          fully_spent?: boolean
          fully_spent_message?: string | null
          last_updated?: string
          organization_id: string
          primary_project?: string | null
          projects_funded?: Json
          total_allocated?: number
          total_donated?: number
          total_spent_visible?: number
        }
        Update: {
          donor_id?: string
          fully_spent?: boolean
          fully_spent_message?: string | null
          last_updated?: string
          organization_id?: string
          primary_project?: string | null
          projects_funded?: Json
          total_allocated?: number
          total_donated?: number
          total_spent_visible?: number
        }
        Relationships: [
          {
            foreignKeyName: "donor_spend_summary_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: true
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_spend_summary_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donors: {
        Row: {
          city: string | null
          created_at: string
          donations_count: number
          email: string | null
          external_id: string | null
          first_donation_at: string | null
          full_name: string
          gender: string | null
          id: string
          last_donation_at: string | null
          notes: string | null
          organization_id: string | null
          phone: string | null
          segment: string
          total_donated: number
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          donations_count?: number
          email?: string | null
          external_id?: string | null
          first_donation_at?: string | null
          full_name: string
          gender?: string | null
          id?: string
          last_donation_at?: string | null
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          segment?: string
          total_donated?: number
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          donations_count?: number
          email?: string | null
          external_id?: string | null
          first_donation_at?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          last_donation_at?: string | null
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          segment?: string
          total_donated?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employee_ai_usage_logs: {
        Row: {
          context: Json | null
          created_at: string
          feature: string
          id: string
          organization_id: string | null
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          feature: string
          id?: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          feature?: string
          id?: string
          organization_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      employee_assistant_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          organization_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          organization_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          organization_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employee_assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          model: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          model?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "employee_assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_evaluation_scores: {
        Row: {
          created_at: string
          criterion_id: string
          employee_user_id: string
          evaluated_by: string | null
          id: string
          is_automatic: boolean
          notes: string | null
          organization_id: string | null
          period: string
          period_end: string | null
          period_start: string | null
          score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          criterion_id: string
          employee_user_id: string
          evaluated_by?: string | null
          id?: string
          is_automatic?: boolean
          notes?: string | null
          organization_id?: string | null
          period?: string
          period_end?: string | null
          period_start?: string | null
          score: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          criterion_id?: string
          employee_user_id?: string
          evaluated_by?: string | null
          id?: string
          is_automatic?: boolean
          notes?: string | null
          organization_id?: string | null
          period?: string
          period_end?: string | null
          period_start?: string | null
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_evaluation_scores_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "evaluation_criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_files: {
        Row: {
          category: string
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_intelligence_profiles: {
        Row: {
          ai_analyzed_at: string | null
          ai_summary: string | null
          career_goals: string | null
          certifications: Json | null
          communication_style: string | null
          created_at: string
          development_areas: Json | null
          employee_id: string | null
          focus_hours_per_day: number | null
          id: string
          languages: Json | null
          max_parallel_tasks: number | null
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          organization_id: string | null
          peak_hours: string | null
          personality_notes: string | null
          planning_preference: string | null
          preferred_domains: Json | null
          pressure_handling: string | null
          previous_roles: string | null
          technical_skills: Json | null
          unavailable_days: Json | null
          updated_at: string
          user_id: string
          work_style: string | null
          years_of_experience: number | null
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_summary?: string | null
          career_goals?: string | null
          certifications?: Json | null
          communication_style?: string | null
          created_at?: string
          development_areas?: Json | null
          employee_id?: string | null
          focus_hours_per_day?: number | null
          id?: string
          languages?: Json | null
          max_parallel_tasks?: number | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          organization_id?: string | null
          peak_hours?: string | null
          personality_notes?: string | null
          planning_preference?: string | null
          preferred_domains?: Json | null
          pressure_handling?: string | null
          previous_roles?: string | null
          technical_skills?: Json | null
          unavailable_days?: Json | null
          updated_at?: string
          user_id: string
          work_style?: string | null
          years_of_experience?: number | null
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_summary?: string | null
          career_goals?: string | null
          certifications?: Json | null
          communication_style?: string | null
          created_at?: string
          development_areas?: Json | null
          employee_id?: string | null
          focus_hours_per_day?: number | null
          id?: string
          languages?: Json | null
          max_parallel_tasks?: number | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          organization_id?: string | null
          peak_hours?: string | null
          personality_notes?: string | null
          planning_preference?: string | null
          preferred_domains?: Json | null
          pressure_handling?: string | null
          previous_roles?: string | null
          technical_skills?: Json | null
          unavailable_days?: Json | null
          updated_at?: string
          user_id?: string
          work_style?: string | null
          years_of_experience?: number | null
        }
        Relationships: []
      }
      employee_job_duties: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          employee_id: string | null
          estimated_time_minutes: number | null
          external_employee_ref: string | null
          frequency: string | null
          id: string
          import_id: string | null
          is_active: boolean
          organization_id: string | null
          priority: string
          raw_data: Json | null
          source: string
          source_row: number | null
          source_sheet: string | null
          tags: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          estimated_time_minutes?: number | null
          external_employee_ref?: string | null
          frequency?: string | null
          id?: string
          import_id?: string | null
          is_active?: boolean
          organization_id?: string | null
          priority?: string
          raw_data?: Json | null
          source?: string
          source_row?: number | null
          source_sheet?: string | null
          tags?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string | null
          estimated_time_minutes?: number | null
          external_employee_ref?: string | null
          frequency?: string | null
          id?: string
          import_id?: string | null
          is_active?: boolean
          organization_id?: string | null
          priority?: string
          raw_data?: Json | null
          source?: string
          source_row?: number | null
          source_sheet?: string | null
          tags?: Json | null
          title?: string
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
          is_viewer_account: boolean
          job_role: string
          join_date: string | null
          organization_id: string | null
          performance: number | null
          phone: string | null
          role_color: string | null
          role_level: Database["public"]["Enums"]["employee_role_level"]
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
          is_viewer_account?: boolean
          job_role: string
          join_date?: string | null
          organization_id?: string | null
          performance?: number | null
          phone?: string | null
          role_color?: string | null
          role_level?: Database["public"]["Enums"]["employee_role_level"]
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
          is_viewer_account?: boolean
          job_role?: string
          join_date?: string | null
          organization_id?: string | null
          performance?: number | null
          phone?: string | null
          role_color?: string | null
          role_level?: Database["public"]["Enums"]["employee_role_level"]
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
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_criteria: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_automatic: boolean
          metric_key: string | null
          name: string
          organization_id: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_automatic?: boolean
          metric_key?: string | null
          name: string
          organization_id?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_automatic?: boolean
          metric_key?: string | null
          name?: string
          organization_id?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      evidence_checks: {
        Row: {
          accountability_question_id: string | null
          ai_model: string | null
          created_at: string
          error_message: string | null
          evidence_url: string
          findings: Json | null
          id: string
          missing_items: Json | null
          organization_id: string
          recommendations: string | null
          score: number | null
          scrape_content_excerpt: string | null
          scrape_metadata: Json | null
          scrape_status: string
          strict_mode: boolean
          sub_checks: Json | null
          verdict: string | null
        }
        Insert: {
          accountability_question_id?: string | null
          ai_model?: string | null
          created_at?: string
          error_message?: string | null
          evidence_url: string
          findings?: Json | null
          id?: string
          missing_items?: Json | null
          organization_id: string
          recommendations?: string | null
          score?: number | null
          scrape_content_excerpt?: string | null
          scrape_metadata?: Json | null
          scrape_status?: string
          strict_mode?: boolean
          sub_checks?: Json | null
          verdict?: string | null
        }
        Update: {
          accountability_question_id?: string | null
          ai_model?: string | null
          created_at?: string
          error_message?: string | null
          evidence_url?: string
          findings?: Json | null
          id?: string
          missing_items?: Json | null
          organization_id?: string
          recommendations?: string | null
          score?: number | null
          scrape_content_excerpt?: string | null
          scrape_metadata?: Json | null
          scrape_status?: string
          strict_mode?: boolean
          sub_checks?: Json | null
          verdict?: string | null
        }
        Relationships: []
      }
      excel_plans: {
        Row: {
          columns: Json
          created_at: string
          id: string
          organization_id: string | null
          plan_name: string
          rows: Json
          sheet_name: string | null
          source_filename: string | null
          updated_at: string
          use_for_ai: boolean
          user_id: string | null
          year: number
        }
        Insert: {
          columns?: Json
          created_at?: string
          id?: string
          organization_id?: string | null
          plan_name?: string
          rows?: Json
          sheet_name?: string | null
          source_filename?: string | null
          updated_at?: string
          use_for_ai?: boolean
          user_id?: string | null
          year?: number
        }
        Update: {
          columns?: Json
          created_at?: string
          id?: string
          organization_id?: string | null
          plan_name?: string
          rows?: Json
          sheet_name?: string | null
          source_filename?: string | null
          updated_at?: string
          use_for_ai?: boolean
          user_id?: string | null
          year?: number
        }
        Relationships: []
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "executive_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_allocations: {
        Row: {
          allocation_type: string
          amount_allocated: number
          created_at: string
          donation_id: string
          donor_id: string | null
          expense_id: string
          id: string
          organization_id: string
        }
        Insert: {
          allocation_type: string
          amount_allocated: number
          created_at?: string
          donation_id: string
          donor_id?: string | null
          expense_id: string
          id?: string
          organization_id: string
        }
        Update: {
          allocation_type?: string
          amount_allocated?: number
          created_at?: string
          donation_id?: string
          donor_id?: string | null
          expense_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_allocations_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_allocations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_allocations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          default_allocation_pct: number
          id: string
          kind: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_allocation_pct?: number
          id?: string
          kind: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_allocation_pct?: number
          id?: string
          kind?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_url: string | null
          auto_classified: boolean
          campaign_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          kind: string
          organization_id: string
          project_id: string | null
          project_name: string | null
          status: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          auto_classified?: boolean
          campaign_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          kind: string
          organization_id: string
          project_id?: string | null
          project_name?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          auto_classified?: boolean
          campaign_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          kind?: string
          organization_id?: string
          project_id?: string | null
          project_name?: string | null
          status?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_donations: {
        Row: {
          amount: number | null
          attempted_at: string
          created_at: string
          donor_id: string | null
          donor_name: string | null
          donor_phone: string | null
          external_id: string | null
          failure_reason: string | null
          id: string
          organization_id: string | null
          payment_method: string | null
          project_name: string | null
          raw_data: Json | null
          retry_status: string
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          amount?: number | null
          attempted_at: string
          created_at?: string
          donor_id?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          external_id?: string | null
          failure_reason?: string | null
          id?: string
          organization_id?: string | null
          payment_method?: string | null
          project_name?: string | null
          raw_data?: Json | null
          retry_status?: string
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          amount?: number | null
          attempted_at?: string
          created_at?: string
          donor_id?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          external_id?: string | null
          failure_reason?: string | null
          id?: string
          organization_id?: string | null
          payment_method?: string | null
          project_name?: string | null
          raw_data?: Json | null
          retry_status?: string
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failed_donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failed_donations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts: {
        Row: {
          amount: number
          created_at: string
          delivery_status: string
          external_id: string | null
          gift_date: string | null
          giver_donor_id: string | null
          giver_name: string | null
          giver_phone: string | null
          id: string
          message: string | null
          occasion: string | null
          organization_id: string | null
          project_name: string | null
          raw_data: Json | null
          recipient_name: string | null
          recipient_phone: string | null
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          delivery_status?: string
          external_id?: string | null
          gift_date?: string | null
          giver_donor_id?: string | null
          giver_name?: string | null
          giver_phone?: string | null
          id?: string
          message?: string | null
          occasion?: string | null
          organization_id?: string | null
          project_name?: string | null
          raw_data?: Json | null
          recipient_name?: string | null
          recipient_phone?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_status?: string
          external_id?: string | null
          gift_date?: string | null
          giver_donor_id?: string | null
          giver_name?: string | null
          giver_phone?: string | null
          id?: string
          message?: string | null
          occasion?: string | null
          organization_id?: string | null
          project_name?: string | null
          raw_data?: Json | null
          recipient_name?: string | null
          recipient_phone?: string | null
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gifts_giver_donor_id_fkey"
            columns: ["giver_donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          initiative_id: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          initiative_id?: string
          organization_id?: string | null
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
          {
            foreignKeyName: "initiative_departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
            foreignKeyName: "initiatives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      innovation_messages: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          role: string
          suggestion_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          role: string
          suggestion_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "innovation_messages_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "innovation_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      innovation_suggestions: {
        Row: {
          ai_model: string | null
          area: string | null
          category: string
          created_at: string
          data_basis: Json | null
          effort: string | null
          generated_at: string
          id: string
          impact: string | null
          organization_id: string | null
          priority: string
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_model?: string | null
          area?: string | null
          category?: string
          created_at?: string
          data_basis?: Json | null
          effort?: string | null
          generated_at?: string
          id?: string
          impact?: string | null
          organization_id?: string | null
          priority?: string
          status?: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_model?: string | null
          area?: string | null
          category?: string
          created_at?: string
          data_basis?: Json | null
          effort?: string | null
          generated_at?: string
          id?: string
          impact?: string | null
          organization_id?: string | null
          priority?: string
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "innovation_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_profile_options: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          label: string
          question_id: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          question_id: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          question_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_profile_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "intelligence_profile_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_profile_questions: {
        Row: {
          created_at: string
          data_field: string
          display_order: number
          helper_text: string | null
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          max_value: number | null
          min_value: number | null
          organization_id: string | null
          placeholder: string | null
          question_key: string
          question_type: string
          step_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_field: string
          display_order?: number
          helper_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          max_value?: number | null
          min_value?: number | null
          organization_id?: string | null
          placeholder?: string | null
          question_key: string
          question_type: string
          step_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_field?: string
          display_order?: number
          helper_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          max_value?: number | null
          min_value?: number | null
          organization_id?: string | null
          placeholder?: string | null
          question_key?: string
          question_type?: string
          step_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_profile_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          from_admin: boolean
          id: string
          sender_user_id: string
          thread_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          from_admin?: boolean
          id?: string
          sender_user_id: string
          thread_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          from_admin?: boolean
          id?: string
          sender_user_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "internal_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          member_user_id: string
          organization_id: string | null
          subject: string | null
          unread_for_admin: boolean
          unread_for_member: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          member_user_id: string
          organization_id?: string | null
          subject?: string | null
          unread_for_admin?: boolean
          unread_for_member?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          member_user_id?: string
          organization_id?: string | null
          subject?: string | null
          unread_for_admin?: boolean
          unread_for_member?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaign_assets: {
        Row: {
          asset_type: string
          body: string | null
          campaign_id: string
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          metadata: Json | null
          organization_id: string
          title: string | null
        }
        Insert: {
          asset_type: string
          body?: string | null
          campaign_id: string
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          title?: string | null
        }
        Update: {
          asset_type?: string
          body?: string | null
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaign_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaign_channels: {
        Row: {
          assigned_to: string | null
          campaign_id: string
          channel: string
          created_at: string
          id: string
          message: string | null
          notes: string | null
          organization_id: string
          published_at: string | null
          scheduled_at: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id: string
          channel: string
          created_at?: string
          id?: string
          message?: string | null
          notes?: string | null
          organization_id: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          notes?: string | null
          organization_id?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaign_channels_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaign_metrics: {
        Row: {
          campaign_id: string
          channel: string | null
          clicks: number | null
          conversions: number | null
          cost: number | null
          donations_amount: number | null
          donations_count: number | null
          id: string
          impressions: number | null
          measured_at: string
          notes: string | null
          organization_id: string
        }
        Insert: {
          campaign_id: string
          channel?: string | null
          clicks?: number | null
          conversions?: number | null
          cost?: number | null
          donations_amount?: number | null
          donations_count?: number | null
          id?: string
          impressions?: number | null
          measured_at?: string
          notes?: string | null
          organization_id: string
        }
        Update: {
          campaign_id?: string
          channel?: string | null
          clicks?: number | null
          conversions?: number | null
          cost?: number | null
          donations_amount?: number | null
          donations_count?: number | null
          id?: string
          impressions?: number | null
          measured_at?: string
          notes?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          ai_generated: boolean | null
          ai_metadata: Json | null
          audience_filters: Json | null
          audience_segment: string | null
          budget_actual: number | null
          budget_planned: number | null
          content_angles: Json | null
          created_at: string
          created_by: string | null
          end_date: string | null
          expected_kpis: Json | null
          goal: string | null
          id: string
          name: string
          organization_id: string
          platforms: Json | null
          primary_message: string | null
          related_project: string | null
          season_key: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          ai_metadata?: Json | null
          audience_filters?: Json | null
          audience_segment?: string | null
          budget_actual?: number | null
          budget_planned?: number | null
          content_angles?: Json | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          expected_kpis?: Json | null
          goal?: string | null
          id?: string
          name: string
          organization_id: string
          platforms?: Json | null
          primary_message?: string | null
          related_project?: string | null
          season_key?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          ai_metadata?: Json | null
          audience_filters?: Json | null
          audience_segment?: string | null
          budget_actual?: number | null
          budget_planned?: number | null
          content_angles?: Json | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          expected_kpis?: Json | null
          goal?: string | null
          id?: string
          name?: string
          organization_id?: string
          platforms?: Json | null
          primary_message?: string | null
          related_project?: string | null
          season_key?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_ideas: {
        Row: {
          ai_generated: boolean
          ai_model: string | null
          channels: Json | null
          content_draft: string | null
          created_at: string
          data_basis: Json | null
          description: string
          effort_level: string | null
          expected_impact: string | null
          hashtags: Json | null
          id: string
          idea_type: string
          organization_id: string | null
          status: string
          target_segment: string | null
          title: string
          updated_at: string
          visuals_suggestion: string | null
        }
        Insert: {
          ai_generated?: boolean
          ai_model?: string | null
          channels?: Json | null
          content_draft?: string | null
          created_at?: string
          data_basis?: Json | null
          description: string
          effort_level?: string | null
          expected_impact?: string | null
          hashtags?: Json | null
          id?: string
          idea_type: string
          organization_id?: string | null
          status?: string
          target_segment?: string | null
          title: string
          updated_at?: string
          visuals_suggestion?: string | null
        }
        Update: {
          ai_generated?: boolean
          ai_model?: string | null
          channels?: Json | null
          content_draft?: string | null
          created_at?: string
          data_basis?: Json | null
          description?: string
          effort_level?: string | null
          expected_impact?: string | null
          hashtags?: Json | null
          id?: string
          idea_type?: string
          organization_id?: string | null
          status?: string
          target_segment?: string | null
          title?: string
          updated_at?: string
          visuals_suggestion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ideas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_playbook_memory: {
        Row: {
          audience_segment: string | null
          campaign_id: string | null
          channel: string | null
          confidence: number | null
          created_at: string
          evidence: Json | null
          finding: string
          id: string
          insight_type: string
          organization_id: string
        }
        Insert: {
          audience_segment?: string | null
          campaign_id?: string | null
          channel?: string | null
          confidence?: number | null
          created_at?: string
          evidence?: Json | null
          finding: string
          id?: string
          insight_type: string
          organization_id: string
        }
        Update: {
          audience_segment?: string | null
          campaign_id?: string | null
          channel?: string | null
          confidence?: number | null
          created_at?: string
          evidence?: Json | null
          finding?: string
          id?: string
          insight_type?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_playbook_memory_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_seasonal_events: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration_days: number | null
          gregorian_day: number | null
          gregorian_month: number | null
          hijri_day: number | null
          hijri_month: number | null
          id: string
          is_active: boolean | null
          key: string
          marketing_tips: Json | null
          name_ar: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          gregorian_day?: number | null
          gregorian_month?: number | null
          hijri_day?: number | null
          hijri_month?: number | null
          id?: string
          is_active?: boolean | null
          key: string
          marketing_tips?: Json | null
          name_ar: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_days?: number | null
          gregorian_day?: number | null
          gregorian_month?: number | null
          hijri_day?: number | null
          hijri_month?: number | null
          id?: string
          is_active?: boolean | null
          key?: string
          marketing_tips?: Json | null
          name_ar?: string
        }
        Relationships: []
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
      navigation_customization: {
        Row: {
          created_at: string
          custom_icon: string | null
          custom_label: string | null
          display_order: number
          id: string
          is_visible: boolean
          item_key: string
          organization_id: string | null
          updated_at: string
          visible_to_roles: Database["public"]["Enums"]["app_role"][] | null
        }
        Insert: {
          created_at?: string
          custom_icon?: string | null
          custom_label?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          item_key: string
          organization_id?: string | null
          updated_at?: string
          visible_to_roles?: Database["public"]["Enums"]["app_role"][] | null
        }
        Update: {
          created_at?: string
          custom_icon?: string | null
          custom_label?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          item_key?: string
          organization_id?: string | null
          updated_at?: string
          visible_to_roles?: Database["public"]["Enums"]["app_role"][] | null
        }
        Relationships: [
          {
            foreignKeyName: "navigation_customization_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          related_task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_plan_column_order_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_plan_custom_columns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "operational_plan_custom_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          monthly_target?: number
          operational_plan_id: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          monthly_target?: number
          operational_plan_id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_plan_months_operational_plan_id_fkey"
            columns: ["operational_plan_id"]
            isOneToOne: false
            referencedRelation: "operational_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_plan_months_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          estimated_budget: number
          id: string
          initiative: string | null
          initiative_id: string | null
          organization_id: string | null
          plan_name: string
          responsible_employee_id: string | null
          status: string
          strategic_goal: string | null
          strategic_goal_id: string | null
          sub_initiative: string | null
          sub_initiative_id: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          activity_name: string
          annual_target?: number
          created_at?: string
          display_order?: number | null
          estimated_budget?: number
          id?: string
          initiative?: string | null
          initiative_id?: string | null
          organization_id?: string | null
          plan_name?: string
          responsible_employee_id?: string | null
          status?: string
          strategic_goal?: string | null
          strategic_goal_id?: string | null
          sub_initiative?: string | null
          sub_initiative_id?: string | null
          updated_at?: string
          user_id: string
          year?: number
        }
        Update: {
          activity_name?: string
          annual_target?: number
          created_at?: string
          display_order?: number | null
          estimated_budget?: number
          id?: string
          initiative?: string | null
          initiative_id?: string | null
          organization_id?: string | null
          plan_name?: string
          responsible_employee_id?: string | null
          status?: string
          strategic_goal?: string | null
          strategic_goal_id?: string | null
          sub_initiative?: string | null
          sub_initiative_id?: string | null
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
            foreignKeyName: "operational_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          {
            foreignKeyName: "operational_plans_sub_initiative_id_fkey"
            columns: ["sub_initiative_id"]
            isOneToOne: false
            referencedRelation: "sub_initiatives"
            referencedColumns: ["id"]
          },
        ]
      }
      org_allocation_rules: {
        Row: {
          created_at: string
          marketing_pct: number
          operational_pct: number
          organization_id: string
          project_pct: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          marketing_pct?: number
          operational_pct?: number
          organization_id: string
          project_pct?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          marketing_pct?: number
          operational_pct?: number
          organization_id?: string
          project_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_allocation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_donor_tiers: {
        Row: {
          organization_id: string
          tier_a_channel: string
          tier_a_min: number
          tier_b_channel: string
          tier_b_min: number
          tier_c_channel: string
          tier_c_min: number
          tier_d_channel: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          organization_id: string
          tier_a_channel?: string
          tier_a_min?: number
          tier_b_channel?: string
          tier_b_min?: number
          tier_c_channel?: string
          tier_c_min?: number
          tier_d_channel?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          organization_id?: string
          tier_a_channel?: string
          tier_a_min?: number
          tier_b_channel?: string
          tier_b_min?: number
          tier_c_channel?: string
          tier_c_min?: number
          tier_d_channel?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_donor_tiers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_external_insights: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          occurred_at: string | null
          organization_id: string
          raw_data: Json | null
          source_id: string | null
          title: string
          url: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_at?: string | null
          organization_id: string
          raw_data?: Json | null
          source_id?: string | null
          title: string
          url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          occurred_at?: string | null
          organization_id?: string
          raw_data?: Json | null
          source_id?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_external_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_external_insights_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "org_external_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      org_external_sources: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          last_status: string | null
          last_synced_at: string | null
          news_path: string | null
          organization_id: string
          summary: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          news_path?: string | null
          organization_id: string
          summary?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          last_status?: string | null
          last_synced_at?: string | null
          news_path?: string | null
          organization_id?: string
          summary?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_external_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_branding: {
        Row: {
          accent_color: string | null
          created_at: string
          display_name: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          organization_id: string
          primary_color: string | null
          secondary_color: string | null
          site_name: string | null
          site_tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          display_name?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          organization_id: string
          primary_color?: string | null
          secondary_color?: string | null
          site_name?: string | null
          site_tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          display_name?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          site_name?: string | null
          site_tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_branding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_profiles: {
        Row: {
          about: string | null
          accent_color: string | null
          ai_analysis: Json | null
          ai_model: string | null
          auto_extracted_at: string | null
          created_at: string
          documents: Json
          facebook_url: string | null
          goals: string | null
          id: string
          instagram_url: string | null
          last_analyzed_at: string | null
          linkedin_url: string | null
          logo_url: string | null
          organization_id: string
          other_links: Json | null
          primary_color: string | null
          secondary_color: string | null
          snapchat_url: string | null
          store_url: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          about?: string | null
          accent_color?: string | null
          ai_analysis?: Json | null
          ai_model?: string | null
          auto_extracted_at?: string | null
          created_at?: string
          documents?: Json
          facebook_url?: string | null
          goals?: string | null
          id?: string
          instagram_url?: string | null
          last_analyzed_at?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          organization_id: string
          other_links?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          snapchat_url?: string | null
          store_url?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          about?: string | null
          accent_color?: string | null
          ai_analysis?: Json | null
          ai_model?: string | null
          auto_extracted_at?: string | null
          created_at?: string
          documents?: Json
          facebook_url?: string | null
          goals?: string | null
          id?: string
          instagram_url?: string | null
          last_analyzed_at?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          organization_id?: string
          other_links?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          snapchat_url?: string | null
          store_url?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          allow_self_signup: boolean
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string | null
          subscription_tier: string
          updated_at: string
        }
        Insert: {
          allow_self_signup?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Update: {
          allow_self_signup?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_email_deleted_ids: {
        Row: {
          deleted_at: string
          id: string
          provider_message_id: string
        }
        Insert: {
          deleted_at?: string
          id?: string
          provider_message_id: string
        }
        Update: {
          deleted_at?: string
          id?: string
          provider_message_id?: string
        }
        Relationships: []
      }
      platform_email_messages: {
        Row: {
          body: string
          created_at: string
          direction: string
          id: string
          in_reply_to: string | null
          provider_message_id: string | null
          raw_headers: Json
          received_at: string
          recipient_email: string | null
          sender_email: string
          subject: string | null
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          direction: string
          id?: string
          in_reply_to?: string | null
          provider_message_id?: string | null
          raw_headers?: Json
          received_at?: string
          recipient_email?: string | null
          sender_email: string
          subject?: string | null
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          id?: string
          in_reply_to?: string | null
          provider_message_id?: string | null
          raw_headers?: Json
          received_at?: string
          recipient_email?: string | null
          sender_email?: string
          subject?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_email_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "platform_email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_email_settings: {
        Row: {
          footer: string
          footer_enabled: boolean
          id: boolean
          sender_name: string
          signature: string
          signature_enabled: boolean
          updated_at: string
        }
        Insert: {
          footer?: string
          footer_enabled?: boolean
          id?: boolean
          sender_name?: string
          signature?: string
          signature_enabled?: boolean
          updated_at?: string
        }
        Update: {
          footer?: string
          footer_enabled?: boolean
          id?: boolean
          sender_name?: string
          signature?: string
          signature_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      platform_email_sync_settings: {
        Row: {
          created_at: string
          id: boolean
          last_synced_at: string | null
          sync_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          last_synced_at?: string | null
          sync_token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          last_synced_at?: string | null
          sync_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_email_threads: {
        Row: {
          created_at: string
          id: string
          is_trashed: boolean
          last_message_at: string
          owner_user_id: string | null
          recipient_email: string
          recipient_name: string | null
          subject: string
          trashed_at: string | null
          unread_for_owner: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_trashed?: boolean
          last_message_at?: string
          owner_user_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          subject: string
          trashed_at?: string | null
          unread_for_owner?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_trashed?: boolean
          last_message_at?: string
          owner_user_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          subject?: string
          trashed_at?: string | null
          unread_for_owner?: boolean
          updated_at?: string
        }
        Relationships: []
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
      projects_catalog: {
        Row: {
          category: string | null
          created_at: string
          external_code: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          external_code?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          external_code?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_catalog_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      secure_backup_logs: {
        Row: {
          backup_type: string
          commit_urls: Json
          created_at: string
          error_summary: string | null
          errors_count: number
          files_count: number
          finished_at: string | null
          id: string
          manifest: Json | null
          parts_count: number
          remote_path: string | null
          rows_count: number
          started_at: string
          status: string
          tables_count: number
          total_bytes: number
          updated_at: string
        }
        Insert: {
          backup_type?: string
          commit_urls?: Json
          created_at?: string
          error_summary?: string | null
          errors_count?: number
          files_count?: number
          finished_at?: string | null
          id?: string
          manifest?: Json | null
          parts_count?: number
          remote_path?: string | null
          rows_count?: number
          started_at?: string
          status?: string
          tables_count?: number
          total_bytes?: number
          updated_at?: string
        }
        Update: {
          backup_type?: string
          commit_urls?: Json
          created_at?: string
          error_summary?: string | null
          errors_count?: number
          files_count?: number
          finished_at?: string | null
          id?: string
          manifest?: Json | null
          parts_count?: number
          remote_path?: string | null
          rows_count?: number
          started_at?: string
          status?: string
          tables_count?: number
          total_bytes?: number
          updated_at?: string
        }
        Relationships: []
      }
      smart_report_suggestions: {
        Row: {
          audience: string | null
          benefit: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          is_archived: boolean
          organization_id: string
          priority: number | null
          title: string
        }
        Insert: {
          audience?: string | null
          benefit?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          is_archived?: boolean
          organization_id: string
          priority?: number | null
          title: string
        }
        Update: {
          audience?: string | null
          benefit?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          is_archived?: boolean
          organization_id?: string
          priority?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_report_suggestions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_tasks: {
        Row: {
          ai_generated: boolean
          ai_model: string | null
          assigned_to: string | null
          category: string
          completed_at: string | null
          completed_by: string | null
          context: Json | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          organization_id: string | null
          outcome_notes: string | null
          priority: string
          related_campaign_id: string | null
          related_donor_id: string | null
          source_event_id: string | null
          source_insight_id: string | null
          status: string
          suggested_channel: string | null
          suggested_message: string | null
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          ai_model?: string | null
          assigned_to?: string | null
          category: string
          completed_at?: string | null
          completed_by?: string | null
          context?: Json | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string | null
          outcome_notes?: string | null
          priority?: string
          related_campaign_id?: string | null
          related_donor_id?: string | null
          source_event_id?: string | null
          source_insight_id?: string | null
          status?: string
          suggested_channel?: string | null
          suggested_message?: string | null
          task_type: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          ai_model?: string | null
          assigned_to?: string | null
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          context?: Json | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string | null
          outcome_notes?: string | null
          priority?: string
          related_campaign_id?: string | null
          related_donor_id?: string | null
          source_event_id?: string | null
          source_insight_id?: string | null
          status?: string
          suggested_channel?: string | null
          suggested_message?: string | null
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_tasks_related_campaign_id_fkey"
            columns: ["related_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_tasks_related_donor_id_fkey"
            columns: ["related_donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smart_tasks_source_insight_id_fkey"
            columns: ["source_insight_id"]
            isOneToOne: false
            referencedRelation: "donor_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_duties_imports: {
        Row: {
          ai_notes: string | null
          completed_at: string | null
          created_at: string
          error_log: Json | null
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          imported_duties: number
          matched_employees: number
          organization_id: string | null
          sheet_summary: Json | null
          started_at: string | null
          status: string
          total_rows: number
          unmatched_rows: number
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          ai_notes?: string | null
          completed_at?: string | null
          created_at?: string
          error_log?: Json | null
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          imported_duties?: number
          matched_employees?: number
          organization_id?: string | null
          sheet_summary?: Json | null
          started_at?: string | null
          status?: string
          total_rows?: number
          unmatched_rows?: number
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          ai_notes?: string | null
          completed_at?: string | null
          created_at?: string
          error_log?: Json | null
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          imported_duties?: number
          matched_employees?: number
          organization_id?: string | null
          sheet_summary?: Json | null
          started_at?: string | null
          status?: string
          total_rows?: number
          unmatched_rows?: number
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      strategic_goal_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          organization_id: string | null
          strategic_goal_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          organization_id?: string | null
          strategic_goal_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          organization_id?: string | null
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
            foreignKeyName: "strategic_goal_departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "strategic_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_initiatives: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          initiative_id: string
          name: string
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          initiative_id: string
          name: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          initiative_id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_initiatives_initiative_id_fkey"
            columns: ["initiative_id"]
            isOneToOne: false
            referencedRelation: "initiatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_initiatives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          cancellation_reason: string | null
          created_at: string
          donor_id: string | null
          donor_name: string | null
          donor_phone: string | null
          end_date: string | null
          external_id: string | null
          id: string
          next_charge_date: string | null
          organization_id: string | null
          project_name: string | null
          raw_data: Json | null
          start_date: string
          status: string
          updated_at: string
          upload_id: string | null
        }
        Insert: {
          amount: number
          cancellation_reason?: string | null
          created_at?: string
          donor_id?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          end_date?: string | null
          external_id?: string | null
          id?: string
          next_charge_date?: string | null
          organization_id?: string | null
          project_name?: string | null
          raw_data?: Json | null
          start_date: string
          status?: string
          updated_at?: string
          upload_id?: string | null
        }
        Update: {
          amount?: number
          cancellation_reason?: string | null
          created_at?: string
          donor_id?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          end_date?: string | null
          external_id?: string | null
          id?: string
          next_charge_date?: string | null
          organization_id?: string | null
          project_name?: string | null
          raw_data?: Json | null
          start_date?: string
          status?: string
          updated_at?: string
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_drafts: {
        Row: {
          author_user_id: string
          body: string | null
          created_at: string
          id: string
          reply_to_message_id: string | null
          subject: string | null
          to_email: string | null
          to_name: string | null
          updated_at: string
        }
        Insert: {
          author_user_id: string
          body?: string | null
          created_at?: string
          id?: string
          reply_to_message_id?: string | null
          subject?: string | null
          to_email?: string | null
          to_name?: string | null
          updated_at?: string
        }
        Update: {
          author_user_id?: string
          body?: string | null
          created_at?: string
          id?: string
          reply_to_message_id?: string | null
          subject?: string | null
          to_email?: string | null
          to_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_drafts_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          category: string
          created_at: string
          id: string
          is_archived: boolean
          is_read: boolean
          is_spam: boolean
          is_starred: boolean
          is_trashed: boolean
          labels: string[]
          last_user_activity_at: string
          message: string
          organization_name: string | null
          sender_email: string
          sender_name: string
          sender_phone: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          is_spam?: boolean
          is_starred?: boolean
          is_trashed?: boolean
          labels?: string[]
          last_user_activity_at?: string
          message: string
          organization_name?: string | null
          sender_email: string
          sender_name: string
          sender_phone?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          is_spam?: boolean
          is_starred?: boolean
          is_trashed?: boolean
          labels?: string[]
          last_user_activity_at?: string
          message?: string
          organization_name?: string | null
          sender_email?: string
          sender_name?: string
          sender_phone?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      support_replies: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          from_owner: boolean
          id: string
          message_id: string
          read_by_user: boolean
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          from_owner?: boolean
          id?: string
          message_id: string
          read_by_user?: boolean
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          from_owner?: boolean
          id?: string
          message_id?: string
          read_by_user?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "support_replies_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_generation_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          days_covered: number
          employee_id: string | null
          error_message: string | null
          generated_tasks_count: number
          id: string
          message: string | null
          organization_id: string | null
          processed_employees: number
          request_payload: Json
          requested_month: number
          requested_year: number
          result: Json
          started_at: string | null
          status: string
          total_employees: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          days_covered?: number
          employee_id?: string | null
          error_message?: string | null
          generated_tasks_count?: number
          id?: string
          message?: string | null
          organization_id?: string | null
          processed_employees?: number
          request_payload?: Json
          requested_month: number
          requested_year: number
          result?: Json
          started_at?: string | null
          status?: string
          total_employees?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          days_covered?: number
          employee_id?: string | null
          error_message?: string | null
          generated_tasks_count?: number
          id?: string
          message?: string | null
          organization_id?: string | null
          processed_employees?: number
          request_payload?: Json
          requested_month?: number
          requested_year?: number
          result?: Json
          started_at?: string | null
          status?: string
          total_employees?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          id: string
          message: string | null
          organization_id: string
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
          organization_id: string
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
          organization_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_quality_evaluations: {
        Row: {
          actual_minutes: number | null
          ai_model: string | null
          created_at: string
          efficiency_notes: string | null
          evaluated_at: string
          expected_minutes: number | null
          id: string
          improvements: Json | null
          organization_id: string | null
          quality_score: number
          strengths: Json | null
          summary: string | null
          task_id: string
          time_efficiency_score: number | null
          time_ratio: number | null
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          ai_model?: string | null
          created_at?: string
          efficiency_notes?: string | null
          evaluated_at?: string
          expected_minutes?: number | null
          id?: string
          improvements?: Json | null
          organization_id?: string | null
          quality_score: number
          strengths?: Json | null
          summary?: string | null
          task_id: string
          time_efficiency_score?: number | null
          time_ratio?: number | null
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          ai_model?: string | null
          created_at?: string
          efficiency_notes?: string | null
          evaluated_at?: string
          expected_minutes?: number | null
          id?: string
          improvements?: Json | null
          organization_id?: string | null
          quality_score?: number
          strengths?: Json | null
          summary?: string | null
          task_id?: string
          time_efficiency_score?: number | null
          time_ratio?: number | null
          user_id?: string
        }
        Relationships: []
      }
      task_time_baselines: {
        Row: {
          avg_minutes: number
          baseline_key: string
          id: string
          last_updated: string
          organization_id: string
          samples: number
        }
        Insert: {
          avg_minutes?: number
          baseline_key: string
          id?: string
          last_updated?: string
          organization_id: string
          samples?: number
        }
        Update: {
          avg_minutes?: number
          baseline_key?: string
          id?: string
          last_updated?: string
          organization_id?: string
          samples?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_time_baselines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          dedupe_key: string | null
          description: string | null
          due_date: string | null
          estimated_time_minutes: number | null
          executive_plan_id: string | null
          id: string
          metadata: Json
          organization_id: string | null
          phase: string | null
          priority: string
          quality_percentage: number | null
          source: string | null
          source_activity_id: string | null
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
          dedupe_key?: string | null
          description?: string | null
          due_date?: string | null
          estimated_time_minutes?: number | null
          executive_plan_id?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          phase?: string | null
          priority?: string
          quality_percentage?: number | null
          source?: string | null
          source_activity_id?: string | null
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
          dedupe_key?: string | null
          description?: string | null
          due_date?: string | null
          estimated_time_minutes?: number | null
          executive_plan_id?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          phase?: string | null
          priority?: string
          quality_percentage?: number | null
          source?: string | null
          source_activity_id?: string | null
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
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_activity_id_fkey"
            columns: ["source_activity_id"]
            isOneToOne: false
            referencedRelation: "executive_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          is_default: boolean
          organization_id: string
          requested_at: string
          role_in_org: string
          user_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          organization_id: string
          requested_at?: string
          role_in_org?: string
          user_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          organization_id?: string
          requested_at?: string
          role_in_org?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      _upsert_baseline: {
        Args: { _actual: number; _key: string; _org: string }
        Returns: undefined
      }
      admin_can_access_org: { Args: { _org: string }; Returns: boolean }
      allocate_expense: { Args: { _expense_id: string }; Returns: undefined }
      can_manage_employee_file: {
        Args: { _owner_user_id: string }
        Returns: boolean
      }
      can_manage_intelligence_profile: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_user_role: { Args: { _target_user: string }; Returns: boolean }
      can_read_action_plan_file: { Args: { _folder: string }; Returns: boolean }
      can_read_task_attachment: { Args: { _owner: string }; Returns: boolean }
      create_direct_conversation: {
        Args: { _other_user_id: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      donations_overview: { Args: { p_org: string }; Returns: Json }
      elite_donors: {
        Args: { p_org: string }
        Returns: {
          abandoned_count: number
          activities: string[]
          campaigns_count: number
          donations_count: number
          donations_total: number
          gifts_count: number
          last_activity: string
          name: string
          phone: string
          pkey: string
          projects_count: number
          subs_count: number
        }[]
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_org_finance_defaults: {
        Args: { _org_id: string }
        Returns: undefined
      }
      eval_score_org_matches: {
        Args: { _criterion_id: string; _employee_user_id: string; _org: string }
        Returns: boolean
      }
      get_conversations_for_user: {
        Args: { _user_id: string }
        Returns: {
          conversation_id: string
          other_full_name: string
          other_user_id: string
          updated_at: string
        }[]
      }
      get_org_branding: {
        Args: { _org_id: string }
        Returns: {
          accent_color: string
          logo_url: string
          primary_color: string
          secondary_color: string
          updated_at: string
        }[]
      }
      get_org_member_roles: {
        Args: { _org_id?: string }
        Returns: {
          app_roles: Database["public"]["Enums"]["app_role"][]
          employee_id: string
          full_name: string
          job_role: string
          organization_id: string
          role_level: Database["public"]["Enums"]["employee_role_level"]
          user_id: string
          username: string
        }[]
      }
      get_org_membership_requests: {
        Args: { _org_slug?: string }
        Returns: {
          approval_status: string
          approved_at: string
          contact_email: string
          display_name: string
          id: string
          organization_id: string
          requested_at: string
          user_id: string
          username: string
        }[]
      }
      get_organization_by_slug: {
        Args: { _slug: string }
        Returns: {
          allow_self_signup: boolean
          id: string
          is_active: boolean
          logo_url: string
          name: string
          slug: string
        }[]
      }
      get_subordinate_employee_ids: {
        Args: { _manager_employee_id: string }
        Returns: {
          employee_id: string
        }[]
      }
      get_subordinate_user_ids: {
        Args: { _manager_user_id: string }
        Returns: {
          user_id: string
        }[]
      }
      get_user_account_email: { Args: { _user_id: string }; Returns: string }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
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
      is_demo_org: { Args: { _org_id: string }; Returns: boolean }
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_user_approved_in_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_viewer: { Args: { _user_id: string }; Returns: boolean }
      join_organization_by_slug: { Args: { _slug: string }; Returns: string }
      manager_can_access_org: { Args: { _org: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      rebuild_donor_profiles: { Args: { p_org: string }; Returns: number }
      review_membership_request: {
        Args: { _membership_id: string; _status: string }
        Returns: undefined
      }
      sb_dump_auth_table: {
        Args: { _limit?: number; _offset?: number; _table: string }
        Returns: Json
      }
      sb_dump_public_table: {
        Args: { _limit?: number; _offset?: number; _table: string }
        Returns: Json
      }
      sb_dump_storage_metadata: { Args: never; Returns: Json }
      sb_enqueue_backup_stage: {
        Args: { _backup_id: string; _cursor: number; _stage: string }
        Returns: number
      }
      sb_list_public_tables: {
        Args: never
        Returns: {
          row_estimate: number
          table_name: string
        }[]
      }
      set_org_member_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      store_overview: {
        Args: { p_from?: string; p_org: string; p_to?: string }
        Returns: Json
      }
      store_overview_guard: { Args: { p_org: string }; Returns: boolean }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id: string }
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
        | "super_admin"
        | "viewer"
      custom_column_type: "text" | "number" | "date" | "department" | "employee"
      employee_role_level: "employee" | "manager" | "admin"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "time_editor",
        "hr_manager",
        "finance_manager",
        "accountant",
        "super_admin",
        "viewer",
      ],
      custom_column_type: ["text", "number", "date", "department", "employee"],
      employee_role_level: ["employee", "manager", "admin"],
    },
  },
} as const
