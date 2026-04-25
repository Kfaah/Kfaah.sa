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
          completed_at: string | null
          created_at: string
          detected_schema: string | null
          duplicate_rows: number
          error_log: Json | null
          failed_rows: number
          file_name: string
          file_type: string
          for_date: string | null
          id: string
          inserted_rows: number
          organization_id: string | null
          status: string
          total_rows: number
          uploaded_by: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          detected_schema?: string | null
          duplicate_rows?: number
          error_log?: Json | null
          failed_rows?: number
          file_name: string
          file_type: string
          for_date?: string | null
          id?: string
          inserted_rows?: number
          organization_id?: string | null
          status?: string
          total_rows?: number
          uploaded_by: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          detected_schema?: string | null
          duplicate_rows?: number
          error_log?: Json | null
          failed_rows?: number
          file_name?: string
          file_type?: string
          for_date?: string | null
          id?: string
          inserted_rows?: number
          organization_id?: string | null
          status?: string
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
          id: string
          initiative: string | null
          initiative_id: string | null
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
      task_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          id: string
          message: string | null
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          organization_id: string
          role_in_org: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          organization_id: string
          role_in_org?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          organization_id?: string
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
      create_direct_conversation: {
        Args: { _other_user_id: string }
        Returns: string
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
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      join_organization_by_slug: { Args: { _slug: string }; Returns: string }
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
        "super_admin",
      ],
      custom_column_type: ["text", "number", "date", "department", "employee"],
      employee_role_level: ["employee", "manager", "admin"],
    },
  },
} as const
