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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          name: string
          reopen_reason: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          name: string
          reopen_reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          name?: string
          reopen_reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "accounting_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_type: string
          company_id: string
          created_at: string
          currency_code: string
          id: string
          is_active: boolean
          name: string
          no: string | null
          normal_balance: string
          precision: number
          updated_at: string
        }
        Insert: {
          account_type?: string
          company_id?: string
          created_at?: string
          currency_code?: string
          id: string
          is_active?: boolean
          name: string
          no?: string | null
          normal_balance?: string
          precision?: number
          updated_at?: string
        }
        Update: {
          account_type?: string
          company_id?: string
          created_at?: string
          currency_code?: string
          id?: string
          is_active?: boolean
          name?: string
          no?: string | null
          normal_balance?: string
          precision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      admin_support_audit_events: {
        Row: {
          action: string
          actor_id: string
          capability: string
          company_id: string
          created_at: string
          id: number
          idempotency_key: string
          outcome: string
          reason: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          capability: string
          company_id: string
          created_at?: string
          id?: never
          idempotency_key: string
          outcome: string
          reason: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          capability?: string
          company_id?: string
          created_at?: string
          id?: never
          idempotency_key?: string
          outcome?: string
          reason?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_support_audit_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_support_audit_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "admin_support_audit_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      admin_user_access_change_proposals: {
        Row: {
          company_id: string
          created_at: string
          current_active: boolean
          expires_at: string
          id: string
          idempotency_key: string
          prior_role: string
          proposed_active: boolean
          proposed_role: string
          reason: string
          requested_by: string
          status: string
          target_user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_active: boolean
          expires_at?: string
          id?: string
          idempotency_key: string
          prior_role: string
          proposed_active: boolean
          proposed_role: string
          reason: string
          requested_by: string
          status?: string
          target_user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_active?: boolean
          expires_at?: string
          id?: string
          idempotency_key?: string
          prior_role?: string
          proposed_active?: boolean
          proposed_role?: string
          reason?: string
          requested_by?: string
          status?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_access_change_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_user_access_change_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "admin_user_access_change_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      ai_assistant_budget_reservations: {
        Row: {
          company_id: string
          created_at: string
          request_id: string
          reserved_microusd: number
          usage_date: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          request_id: string
          reserved_microusd: number
          usage_date?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          request_id?: string
          reserved_microusd?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_budget_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_budget_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_assistant_budget_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      ai_assistant_rate_limits: {
        Row: {
          company_id: string
          request_count: number
          updated_at: string
          user_id: string
          window_started_at: string
        }
        Insert: {
          company_id: string
          request_count: number
          updated_at?: string
          user_id: string
          window_started_at: string
        }
        Update: {
          company_id?: string
          request_count?: number
          updated_at?: string
          user_id?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_rate_limits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_rate_limits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ai_assistant_rate_limits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          company_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          notification_type: string | null
          recipient_user_id: string | null
          role: string | null
          source_id: string | null
          source_type: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          notification_type?: string | null
          recipient_user_id?: string | null
          role?: string | null
          source_id?: string | null
          source_type?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          notification_type?: string | null
          recipient_user_id?: string | null
          role?: string | null
          source_id?: string | null
          source_type?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "app_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      app_permission_catalog: {
        Row: {
          admin_only: boolean
          label_ar: string
          permission: string
          requestable: boolean
        }
        Insert: {
          admin_only?: boolean
          label_ar: string
          permission: string
          requestable?: boolean
        }
        Update: {
          admin_only?: boolean
          label_ar?: string
          permission?: string
          requestable?: boolean
        }
        Relationships: []
      }
      attachments: {
        Row: {
          company_id: string
          created_at: string | null
          data_url: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          mime: string | null
          name: string | null
          size: number | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          data_url?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id: string
          mime?: string | null
          name?: string | null
          size?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          data_url?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          mime?: string | null
          name?: string | null
          size?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string | null
          action_timestamp: string
          created_at: string | null
          details: string | null
          entity: string | null
          entity_id: string | null
          id: string
          new_value: Json | null
          note: string | null
          old_value: Json | null
          table: string | null
          ts: number | null
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          action?: string | null
          action_timestamp?: string
          created_at?: string | null
          details?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          table?: string | null
          ts?: number | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          action?: string | null
          action_timestamp?: string
          created_at?: string | null
          details?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          table?: string | null
          ts?: number | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      automation_jobs: {
        Row: {
          config: Json | null
          created_at: number | null
          id: string
          is_enabled: boolean | null
          job_name: string
          job_type: string
          last_run_at: number | null
          last_run_result: string | null
          last_run_status: string | null
          schedule_cron: string | null
          schedule_interval_hours: number | null
          updated_at: number | null
        }
        Insert: {
          config?: Json | null
          created_at?: number | null
          id?: string
          is_enabled?: boolean | null
          job_name: string
          job_type: string
          last_run_at?: number | null
          last_run_result?: string | null
          last_run_status?: string | null
          schedule_cron?: string | null
          schedule_interval_hours?: number | null
          updated_at?: number | null
        }
        Update: {
          config?: Json | null
          created_at?: number | null
          id?: string
          is_enabled?: boolean | null
          job_name?: string
          job_type?: string
          last_run_at?: number | null
          last_run_result?: string | null
          last_run_status?: string | null
          schedule_cron?: string | null
          schedule_interval_hours?: number | null
          updated_at?: number | null
        }
        Relationships: []
      }
      automation_notifications: {
        Row: {
          body: string
          company_id: string
          created_at: string
          id: string
          is_read: boolean
          job_id: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          rule_id: string | null
          run_id: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          job_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          rule_id?: string | null
          run_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          job_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          rule_id?: string | null
          run_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automation_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automation_notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_notifications_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_notifications_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_enabled: boolean
          last_run_at: string | null
          last_run_result: string | null
          last_run_status: string | null
          name: string
          rule_type: string
          schedule_cron: string | null
          schedule_interval_hours: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          last_run_result?: string | null
          last_run_status?: string | null
          name: string
          rule_type: string
          schedule_cron?: string | null
          schedule_interval_hours?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          last_run_result?: string | null
          last_run_status?: string | null
          name?: string
          rule_type?: string
          schedule_cron?: string | null
          schedule_interval_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      automation_run_logs: {
        Row: {
          actions_taken: Json | null
          company_id: string
          completed_at: number | null
          error_message: string | null
          id: string
          is_system_generated: boolean | null
          items_failed: number | null
          items_processed: number | null
          job_id: string | null
          job_name: string
          rollback_performed: boolean | null
          rule_id: string | null
          started_at: number
          status: string
        }
        Insert: {
          actions_taken?: Json | null
          company_id?: string
          completed_at?: number | null
          error_message?: string | null
          id?: string
          is_system_generated?: boolean | null
          items_failed?: number | null
          items_processed?: number | null
          job_id?: string | null
          job_name: string
          rollback_performed?: boolean | null
          rule_id?: string | null
          started_at?: number
          status: string
        }
        Update: {
          actions_taken?: Json | null
          company_id?: string
          completed_at?: number | null
          error_message?: string | null
          id?: string
          is_system_generated?: boolean | null
          items_failed?: number | null
          items_processed?: number | null
          job_id?: string | null
          job_name?: string
          rollback_performed?: boolean | null
          rule_id?: string | null
          started_at?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_run_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_run_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automation_run_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automation_run_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_run_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          actions_taken: Json | null
          company_id: string
          completed_at: number | null
          error_message: string | null
          id: string
          is_system_generated: boolean | null
          items_failed: number | null
          items_processed: number | null
          job_id: string | null
          job_name: string
          retry_count: number
          rollback_performed: boolean | null
          rule_id: string | null
          started_at: number
          status: string
          updated_at: string | null
        }
        Insert: {
          actions_taken?: Json | null
          company_id?: string
          completed_at?: number | null
          error_message?: string | null
          id?: string
          is_system_generated?: boolean | null
          items_failed?: number | null
          items_processed?: number | null
          job_id?: string | null
          job_name: string
          retry_count?: number
          rollback_performed?: boolean | null
          rule_id?: string | null
          started_at?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          actions_taken?: Json | null
          company_id?: string
          completed_at?: number | null
          error_message?: string | null
          id?: string
          is_system_generated?: boolean | null
          items_failed?: number | null
          items_processed?: number | null
          job_id?: string | null
          job_name?: string
          retry_count?: number
          rollback_performed?: boolean | null
          rule_id?: string | null
          started_at?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automation_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "automation_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "automation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      background_job_events: {
        Row: {
          attempt_count: number
          code: string | null
          company_id: string
          created_at: string
          event_type: string
          id: number
          job_id: string
          request_key: string | null
        }
        Insert: {
          attempt_count: number
          code?: string | null
          company_id: string
          created_at?: string
          event_type: string
          id?: never
          job_id: string
          request_key?: string | null
        }
        Update: {
          attempt_count?: number
          code?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          id?: never
          job_id?: string
          request_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "background_job_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_job_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "background_job_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "background_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "background_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      background_job_schedules: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          failure_count: number
          id: string
          interval_minutes: number
          job_type: string
          last_error_code: string | null
          next_run_at: string
          payload: Json
          schedule_name: string
          source_id: string | null
          source_type: string
          timezone: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean
          failure_count?: number
          id?: string
          interval_minutes: number
          job_type: string
          last_error_code?: string | null
          next_run_at?: string
          payload?: Json
          schedule_name: string
          source_id?: string | null
          source_type: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          failure_count?: number
          id?: string
          interval_minutes?: number
          job_type?: string
          last_error_code?: string | null
          next_run_at?: string
          payload?: Json
          schedule_name?: string
          source_id?: string | null
          source_type?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_job_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_job_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "background_job_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      background_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          cancellation_reason: string | null
          cancellation_requested: boolean
          company_id: string
          created_at: string
          estimated_cost_microusd: number
          finished_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          last_error_code: string | null
          lease_expires_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          progress_code: string | null
          progress_current: number
          progress_total: number | null
          requested_by: string | null
          result_summary: Json
          source_id: string | null
          source_type: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          cancellation_reason?: string | null
          cancellation_requested?: boolean
          company_id: string
          created_at?: string
          estimated_cost_microusd?: number
          finished_at?: string | null
          id?: string
          idempotency_key: string
          job_type: string
          last_error_code?: string | null
          lease_expires_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          progress_code?: string | null
          progress_current?: number
          progress_total?: number | null
          requested_by?: string | null
          result_summary?: Json
          source_id?: string | null
          source_type: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          cancellation_reason?: string | null
          cancellation_requested?: boolean
          company_id?: string
          created_at?: string
          estimated_cost_microusd?: number
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          job_type?: string
          last_error_code?: string | null
          lease_expires_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          progress_code?: string | null
          progress_current?: number
          progress_total?: number | null
          requested_by?: string | null
          result_summary?: Json
          source_id?: string | null
          source_type?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "background_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "background_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "background_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_code: string | null
          account_name: string
          company_id: string
          created_at: string
          currency: string
          deleted_at: string | null
          id: string
          is_active: boolean
          opening_balance: number
          updated_at: string
        }
        Insert: {
          account_code?: string | null
          account_name: string
          company_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          account_code?: string | null
          account_name?: string
          company_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          opening_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      bank_reconciliation_matches: {
        Row: {
          company_id: string
          id: string
          matched_amount: number
          matched_at: string
          matched_by: string | null
          matched_entity_id: string
          matched_entity_type: string
          notes: string | null
          statement_line_id: string
        }
        Insert: {
          company_id?: string
          id?: string
          matched_amount: number
          matched_at?: string
          matched_by?: string | null
          matched_entity_id: string
          matched_entity_type: string
          notes?: string | null
          statement_line_id: string
        }
        Update: {
          company_id?: string
          id?: string
          matched_amount?: number
          matched_at?: string
          matched_by?: string | null
          matched_entity_id?: string
          matched_entity_type?: string
          notes?: string | null
          statement_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliation_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliation_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_reconciliation_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_reconciliation_matches_statement_line_id_fkey"
            columns: ["statement_line_id"]
            isOneToOne: true
            referencedRelation: "bank_statement_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_imports: {
        Row: {
          accepted_rows: number
          bank_account_id: string
          company_id: string
          created_by: string | null
          deleted_at: string | null
          duplicate_rows: number
          error_summary: Json
          file_fingerprint: string | null
          file_name: string | null
          file_size: number | null
          id: string
          imported_at: string
          payload_digest: string | null
          possible_duplicate_rows: number
          processed_at: string | null
          reference: string | null
          rejected_rows: number
          statement_from: string | null
          statement_name: string
          statement_to: string | null
          status: string
          total_rows: number
        }
        Insert: {
          accepted_rows?: number
          bank_account_id: string
          company_id?: string
          created_by?: string | null
          deleted_at?: string | null
          duplicate_rows?: number
          error_summary?: Json
          file_fingerprint?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          imported_at?: string
          payload_digest?: string | null
          possible_duplicate_rows?: number
          processed_at?: string | null
          reference?: string | null
          rejected_rows?: number
          statement_from?: string | null
          statement_name: string
          statement_to?: string | null
          status?: string
          total_rows?: number
        }
        Update: {
          accepted_rows?: number
          bank_account_id?: string
          company_id?: string
          created_by?: string | null
          deleted_at?: string | null
          duplicate_rows?: number
          error_summary?: Json
          file_fingerprint?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          imported_at?: string
          payload_digest?: string | null
          possible_duplicate_rows?: number
          processed_at?: string | null
          reference?: string | null
          rejected_rows?: number
          statement_from?: string | null
          statement_name?: string
          statement_to?: string | null
          status?: string
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_imports_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_statement_imports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          amount: number
          balance: number | null
          bank_account_id: string
          company_id: string
          created_at: string
          currency: string
          deleted_at: string | null
          description: string
          external_reference: string | null
          fingerprint: string | null
          id: string
          import_id: string | null
          reference: string | null
          status: string
          transaction_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          balance?: number | null
          bank_account_id: string
          company_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string
          external_reference?: string | null
          fingerprint?: string | null
          id?: string
          import_id?: string | null
          reference?: string | null
          status?: string
          transaction_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          balance?: number | null
          bank_account_id?: string
          company_id?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string
          external_reference?: string | null
          fingerprint?: string | null
          id?: string
          import_id?: string | null
          reference?: string | null
          status?: string
          transaction_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_statement_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "bank_statement_lines_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string | null
          deal_value: number | null
          expense_id: string | null
          id: string
          paid_at: number | null
          percentage: number | null
          source_id: string | null
          staff_id: string | null
          staff_name: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          company_id?: string
          created_at?: string | null
          deal_value?: number | null
          expense_id?: string | null
          id: string
          paid_at?: number | null
          percentage?: number | null
          source_id?: string | null
          staff_id?: string | null
          staff_name?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string | null
          deal_value?: number | null
          expense_id?: string | null
          id?: string
          paid_at?: number | null
          percentage?: number | null
          source_id?: string | null
          staff_id?: string | null
          staff_name?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      communication_delivery_outbox: {
        Row: {
          attempt_count: number
          channel: string
          company_id: string
          consent_confirmed_at: string | null
          created_at: string
          event_type: string
          human_reviewed_at: string | null
          human_reviewed_by: string | null
          id: string
          idempotency_key: string
          last_error_code: string | null
          locale: string
          next_attempt_at: string | null
          provider_id: string | null
          provider_reference_hash: string | null
          recipient_user_id: string
          reserved_cost_microusd: number
          source_id: string | null
          source_type: string
          status: string
          suppression_reason: string | null
          template_key: string
          template_version: number
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          company_id: string
          consent_confirmed_at?: string | null
          created_at?: string
          event_type: string
          human_reviewed_at?: string | null
          human_reviewed_by?: string | null
          id?: string
          idempotency_key: string
          last_error_code?: string | null
          locale: string
          next_attempt_at?: string | null
          provider_id?: string | null
          provider_reference_hash?: string | null
          recipient_user_id: string
          reserved_cost_microusd?: number
          source_id?: string | null
          source_type: string
          status: string
          suppression_reason?: string | null
          template_key: string
          template_version: number
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          company_id?: string
          consent_confirmed_at?: string | null
          created_at?: string
          event_type?: string
          human_reviewed_at?: string | null
          human_reviewed_by?: string | null
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          locale?: string
          next_attempt_at?: string | null
          provider_id?: string | null
          provider_reference_hash?: string | null
          recipient_user_id?: string
          reserved_cost_microusd?: number
          source_id?: string | null
          source_type?: string
          status?: string
          suppression_reason?: string | null
          template_key?: string
          template_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_delivery_outbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_delivery_outbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "communication_delivery_outbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      communication_preferences: {
        Row: {
          channel: string
          company_id: string
          enabled: boolean
          event_type: string
          locale: string
          quiet_hours_end: number
          quiet_hours_start: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          company_id: string
          enabled?: boolean
          event_type: string
          locale?: string
          quiet_hours_end?: number
          quiet_hours_start?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          company_id?: string
          enabled?: boolean
          event_type?: string
          locale?: string
          quiet_hours_end?: number
          quiet_hours_start?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "communication_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      communication_records: {
        Row: {
          body: string
          channel: string
          company_id: string
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          direction: string
          id: string
          related_entity_id: string | null
          related_entity_type: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          company_id?: string
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction?: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          company_id?: string
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction?: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "communication_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          locale: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          locale?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          locale?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_fee_tax_treatments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string
          effective_from: string
          effective_to: string | null
          fee_kind: string
          id: string
          status: string
          tax_code: string
          tax_rate: number
          updated_at: string
          version_no: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by: string
          effective_from: string
          effective_to?: string | null
          fee_kind: string
          id?: string
          status?: string
          tax_code: string
          tax_rate: number
          updated_at?: string
          version_no: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_to?: string | null
          fee_kind?: string
          id?: string
          status?: string
          tax_code?: string
          tax_rate?: number
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_fee_tax_treatments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_fee_tax_treatments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_fee_tax_treatments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_fee_tax_treatments_tax_code_fkey"
            columns: ["tax_code"]
            isOneToOne: false
            referencedRelation: "tax_code_catalog"
            referencedColumns: ["code"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_onboarding_completion: {
        Row: {
          company_id: string
          completed_at: string
          completed_by: string
        }
        Insert: {
          company_id: string
          completed_at?: string
          completed_by: string
        }
        Update: {
          company_id?: string
          completed_at?: string
          completed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_onboarding_completion_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_onboarding_completion_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_onboarding_completion_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_onboarding_events: {
        Row: {
          acted_at: string
          action: string
          actor: string
          authority: string | null
          company_id: string
          evidence_reference: string | null
          id: string
          reason: string | null
          requirement_code: string | null
        }
        Insert: {
          acted_at?: string
          action: string
          actor: string
          authority?: string | null
          company_id: string
          evidence_reference?: string | null
          id?: string
          reason?: string | null
          requirement_code?: string | null
        }
        Update: {
          acted_at?: string
          action?: string
          actor?: string
          authority?: string | null
          company_id?: string
          evidence_reference?: string | null
          id?: string
          reason?: string | null
          requirement_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_onboarding_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_onboarding_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_onboarding_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_onboarding_events_requirement_code_fkey"
            columns: ["requirement_code"]
            isOneToOne: false
            referencedRelation: "onboarding_requirement_templates"
            referencedColumns: ["code"]
          },
        ]
      }
      company_onboarding_waivers: {
        Row: {
          company_id: string
          evidence_reference: string | null
          id: string
          requirement_code: string
          revoked_at: string | null
          revoked_by: string | null
          waived_at: string
          waived_by: string
          waiver_authority: string
          waiver_reason: string
        }
        Insert: {
          company_id: string
          evidence_reference?: string | null
          id?: string
          requirement_code: string
          revoked_at?: string | null
          revoked_by?: string | null
          waived_at?: string
          waived_by: string
          waiver_authority: string
          waiver_reason: string
        }
        Update: {
          company_id?: string
          evidence_reference?: string | null
          id?: string
          requirement_code?: string
          revoked_at?: string | null
          revoked_by?: string | null
          waived_at?: string
          waived_by?: string
          waiver_authority?: string
          waiver_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_onboarding_waivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_onboarding_waivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_onboarding_waivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_onboarding_waivers_requirement_code_fkey"
            columns: ["requirement_code"]
            isOneToOne: false
            referencedRelation: "onboarding_requirement_templates"
            referencedColumns: ["code"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          allow_sole_admin_self_approval: boolean
          city: string | null
          company_id: string
          company_name: string
          contract_prefix: string
          country: string | null
          created_at: string
          currency: string
          date_format: string
          default_vat_rate: number
          email: string | null
          id: string
          invoice_prefix: string
          legal_name: string | null
          locale: string
          logo_url: string | null
          notification_email_enabled: boolean
          notification_sms_enabled: boolean
          number_format: string
          phone: string | null
          receipt_prefix: string
          registration_number: string | null
          singleton_key: boolean
          tax_number: string | null
          timezone: string
          updated_at: string
          vat_enabled: boolean | null
          vat_rate: number | null
          vat_registration_number: string | null
        }
        Insert: {
          address?: string | null
          allow_sole_admin_self_approval?: boolean
          city?: string | null
          company_id?: string
          company_name?: string
          contract_prefix?: string
          country?: string | null
          created_at?: string
          currency?: string
          date_format?: string
          default_vat_rate?: number
          email?: string | null
          id?: string
          invoice_prefix?: string
          legal_name?: string | null
          locale?: string
          logo_url?: string | null
          notification_email_enabled?: boolean
          notification_sms_enabled?: boolean
          number_format?: string
          phone?: string | null
          receipt_prefix?: string
          registration_number?: string | null
          singleton_key?: boolean
          tax_number?: string | null
          timezone?: string
          updated_at?: string
          vat_enabled?: boolean | null
          vat_rate?: number | null
          vat_registration_number?: string | null
        }
        Update: {
          address?: string | null
          allow_sole_admin_self_approval?: boolean
          city?: string | null
          company_id?: string
          company_name?: string
          contract_prefix?: string
          country?: string | null
          created_at?: string
          currency?: string
          date_format?: string
          default_vat_rate?: number
          email?: string | null
          id?: string
          invoice_prefix?: string
          legal_name?: string | null
          locale?: string
          logo_url?: string | null
          notification_email_enabled?: boolean
          notification_sms_enabled?: boolean
          number_format?: string
          phone?: string | null
          receipt_prefix?: string
          registration_number?: string | null
          singleton_key?: boolean
          tax_number?: string | null
          timezone?: string
          updated_at?: string
          vat_enabled?: boolean | null
          vat_rate?: number | null
          vat_registration_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      company_tax_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_sole_admin_exception: boolean
          status: string
          tax_code: string
          tax_rate: number
          updated_at: string
          version_no: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_sole_admin_exception?: boolean
          status?: string
          tax_code: string
          tax_rate: number
          updated_at?: string
          version_no: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_sole_admin_exception?: boolean
          status?: string
          tax_code?: string
          tax_rate?: number
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_tax_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_tax_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_tax_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company_tax_profiles_tax_code_fkey"
            columns: ["tax_code"]
            isOneToOne: false
            referencedRelation: "tax_code_catalog"
            referencedColumns: ["code"]
          },
        ]
      }
      "company-assets": {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          key: string
          mime_type: string | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          id?: string
          key: string
          mime_type?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          key?: string
          mime_type?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company-assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company-assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "company-assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      contract_balances: {
        Row: {
          balance_due: number
          company_id: string
          contract_id: string
          tenant_id: string | null
          total_invoiced: number
          total_paid: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          balance_due?: number
          company_id?: string
          contract_id: string
          tenant_id?: string | null
          total_invoiced?: number
          total_paid?: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          balance_due?: number
          company_id?: string
          contract_id?: string
          tenant_id?: string | null
          total_invoiced?: number
          total_paid?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_balances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_balances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_balances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_balances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_balances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_balances_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          company_id: string
          contract_id: string
          created_at: string
          deleted_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string
          contract_id: string
          created_at?: string
          deleted_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          contract_id?: string
          created_at?: string
          deleted_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      contract_evidence_events: {
        Row: {
          actor_id: string
          company_id: string
          contract_id: string
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          from_status: string | null
          id: string
          payload: Json
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_id: string
          company_id: string
          contract_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          from_status?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string
          company_id?: string
          contract_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          from_status?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_evidence_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_evidence_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_evidence_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_evidence_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_evidence_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_evidence_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_evidence_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
        ]
      }
      contract_inspection_templates: {
        Row: {
          active: boolean
          checklist_definition: Json
          code: string
          company_id: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_system_default: boolean
          kind: string
          title_ar: string
          version_no: number
        }
        Insert: {
          active?: boolean
          checklist_definition: Json
          code: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_system_default?: boolean
          kind: string
          title_ar: string
          version_no: number
        }
        Update: {
          active?: boolean
          checklist_definition?: Json
          code?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_system_default?: boolean
          kind?: string
          title_ar?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_inspection_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_inspection_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_inspection_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      contract_inspections: {
        Row: {
          checklist: Json
          company_id: string
          completed_at: string | null
          completed_by: string | null
          completion_request_id: string | null
          contract_id: string
          created_at: string
          created_by: string
          evidence_document_ids: string[]
          id: string
          inspected_on: string
          keys_and_access: Json
          kind: string
          meter_readings: Json
          office_signature: string | null
          request_id: string
          review_reason: string | null
          review_request_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          summary: string | null
          template_id: string
          template_snapshot: Json
          tenant_signature: string | null
          updated_at: string
        }
        Insert: {
          checklist: Json
          company_id: string
          completed_at?: string | null
          completed_by?: string | null
          completion_request_id?: string | null
          contract_id: string
          created_at?: string
          created_by: string
          evidence_document_ids?: string[]
          id?: string
          inspected_on: string
          keys_and_access?: Json
          kind: string
          meter_readings?: Json
          office_signature?: string | null
          request_id: string
          review_reason?: string | null
          review_request_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          summary?: string | null
          template_id: string
          template_snapshot: Json
          tenant_signature?: string | null
          updated_at?: string
        }
        Update: {
          checklist?: Json
          company_id?: string
          completed_at?: string | null
          completed_by?: string | null
          completion_request_id?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string
          evidence_document_ids?: string[]
          id?: string
          inspected_on?: string
          keys_and_access?: Json
          kind?: string
          meter_readings?: Json
          office_signature?: string | null
          request_id?: string
          review_reason?: string | null
          review_request_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          summary?: string | null
          template_id?: string
          template_snapshot?: Json
          tenant_signature?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_inspections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_inspections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_inspections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_inspections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_inspections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_inspections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_inspections_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_inspections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_inspection_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_registration_records: {
        Row: {
          authority_name_snapshot: string
          company_id: string
          contract_id: string
          created_at: string
          currency_snapshot: string | null
          deadline_days_snapshot: number | null
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          decision_request_id: string | null
          evidence_document_id: string | null
          expires_on: string | null
          external_request_reference: string | null
          fee_mode_snapshot: string
          fee_paid: number | null
          fee_value_snapshot: number | null
          id: string
          jurisdiction_code_snapshot: string
          legal_reference_snapshot: string
          registered_on: string | null
          registration_reference: string | null
          requirement_profile_id: string
          status: string
          submission_request_id: string
          submitted_at: string
          submitted_by: string
          submitted_on: string
          updated_at: string
        }
        Insert: {
          authority_name_snapshot: string
          company_id: string
          contract_id: string
          created_at?: string
          currency_snapshot?: string | null
          deadline_days_snapshot?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          decision_request_id?: string | null
          evidence_document_id?: string | null
          expires_on?: string | null
          external_request_reference?: string | null
          fee_mode_snapshot: string
          fee_paid?: number | null
          fee_value_snapshot?: number | null
          id?: string
          jurisdiction_code_snapshot: string
          legal_reference_snapshot: string
          registered_on?: string | null
          registration_reference?: string | null
          requirement_profile_id: string
          status: string
          submission_request_id: string
          submitted_at?: string
          submitted_by: string
          submitted_on: string
          updated_at?: string
        }
        Update: {
          authority_name_snapshot?: string
          company_id?: string
          contract_id?: string
          created_at?: string
          currency_snapshot?: string | null
          deadline_days_snapshot?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          decision_request_id?: string | null
          evidence_document_id?: string | null
          expires_on?: string | null
          external_request_reference?: string | null
          fee_mode_snapshot?: string
          fee_paid?: number | null
          fee_value_snapshot?: number | null
          id?: string
          jurisdiction_code_snapshot?: string
          legal_reference_snapshot?: string
          registered_on?: string | null
          registration_reference?: string | null
          requirement_profile_id?: string
          status?: string
          submission_request_id?: string
          submitted_at?: string
          submitted_by?: string
          submitted_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_registration_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_registration_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_registration_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_registration_records_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_registration_records_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_registration_records_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_registration_records_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contract_registration_records_requirement_profile_id_fkey"
            columns: ["requirement_profile_id"]
            isOneToOne: false
            referencedRelation: "contract_registration_requirement_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_registration_requirement_profiles: {
        Row: {
          approved_at: string
          approved_by_label: string
          authority_name: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string | null
          deadline_days: number | null
          effective_from: string
          effective_to: string | null
          fee_mode: string
          fee_value: number | null
          id: string
          jurisdiction_code: string
          legal_reference: string
          registration_required: boolean
        }
        Insert: {
          approved_at: string
          approved_by_label: string
          authority_name: string
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deadline_days?: number | null
          effective_from: string
          effective_to?: string | null
          fee_mode?: string
          fee_value?: number | null
          id?: string
          jurisdiction_code: string
          legal_reference: string
          registration_required: boolean
        }
        Update: {
          approved_at?: string
          approved_by_label?: string
          authority_name?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deadline_days?: number | null
          effective_from?: string
          effective_to?: string | null
          fee_mode?: string
          fee_value?: number | null
          id?: string
          jurisdiction_code?: string
          legal_reference?: string
          registration_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contract_registration_requirement_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_registration_requirement_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contract_registration_requirement_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      contracts: {
        Row: {
          agreement_id: string | null
          agreement_version_id: string | null
          approval_evidence: Json | null
          approval_status: string | null
          approved_at: string | null
          attachment_url: string | null
          billing_day: number
          cancellation_reason: string | null
          checker_signature: string | null
          checker_user_id: string | null
          collection_role_snapshot: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          end_date: string
          grace_days: number
          id: string
          is_sole_admin_exception: boolean
          maker_signature: string | null
          maker_user_id: string | null
          notes: string | null
          operating_model_snapshot: string | null
          payment_cycle: string
          payment_terms_id: string | null
          property_id: string
          reference: string | null
          rejected_at: string | null
          rejection_reason: string | null
          renewed_from_id: string | null
          rent_amount: number
          start_date: string
          status: string
          submitted_at: string | null
          tenant_id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          agreement_id?: string | null
          agreement_version_id?: string | null
          approval_evidence?: Json | null
          approval_status?: string | null
          approved_at?: string | null
          attachment_url?: string | null
          billing_day?: number
          cancellation_reason?: string | null
          checker_signature?: string | null
          checker_user_id?: string | null
          collection_role_snapshot?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          end_date: string
          grace_days?: number
          id?: string
          is_sole_admin_exception?: boolean
          maker_signature?: string | null
          maker_user_id?: string | null
          notes?: string | null
          operating_model_snapshot?: string | null
          payment_cycle?: string
          payment_terms_id?: string | null
          property_id: string
          reference?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          renewed_from_id?: string | null
          rent_amount: number
          start_date: string
          status?: string
          submitted_at?: string | null
          tenant_id: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          agreement_id?: string | null
          agreement_version_id?: string | null
          approval_evidence?: Json | null
          approval_status?: string | null
          approved_at?: string | null
          attachment_url?: string | null
          billing_day?: number
          cancellation_reason?: string | null
          checker_signature?: string | null
          checker_user_id?: string | null
          collection_role_snapshot?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          end_date?: string
          grace_days?: number
          id?: string
          is_sole_admin_exception?: boolean
          maker_signature?: string | null
          maker_user_id?: string | null
          notes?: string | null
          operating_model_snapshot?: string | null
          payment_cycle?: string
          payment_terms_id?: string | null
          property_id?: string
          reference?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          renewed_from_id?: string | null
          rent_amount?: number
          start_date?: string
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["agreement_id"]
          },
          {
            foreignKeyName: "contracts_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "owner_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "s08_master_lease_readiness"
            referencedColumns: ["master_lease_id"]
          },
          {
            foreignKeyName: "contracts_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["agreement_id"]
          },
          {
            foreignKeyName: "contracts_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "vw_active_owner_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_agreement_version_id_fkey"
            columns: ["agreement_version_id"]
            isOneToOne: false
            referencedRelation: "owner_agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contracts_payment_terms_id_fkey"
            columns: ["payment_terms_id"]
            isOneToOne: false
            referencedRelation: "payment_terms_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contracts_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contracts_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_unit_property_fkey"
            columns: ["unit_id", "property_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "property_id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          company_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          property_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          property_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          property_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "cost_centers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_application_claims: {
        Row: {
          allocation_amount: number
          application_effective_date: string | null
          application_journal_batch_id: string | null
          application_request_id: string | null
          applied_at: string | null
          applied_by: string | null
          approved_at: string | null
          approved_by: string | null
          claim_kind: string
          claim_note: string | null
          collection_role_snapshot: string | null
          company_id: string
          contract_id: string
          created_at: string
          created_by: string
          deposit_beneficiary_snapshot: string | null
          deposit_id: string
          evidence_uri: string
          id: string
          inspection_id: string | null
          invoice_id: string | null
          is_sole_admin_exception: boolean
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          request_id: string
          reversal_journal_batch_id: string | null
          reversal_reason: string | null
          reversal_request_id: string | null
          reversed_at: string | null
          reversed_by: string | null
          source_fingerprint: string
          status: string
          target_account_no: string
          target_type: string
          updated_at: string
        }
        Insert: {
          allocation_amount: number
          application_effective_date?: string | null
          application_journal_batch_id?: string | null
          application_request_id?: string | null
          applied_at?: string | null
          applied_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          claim_kind: string
          claim_note?: string | null
          collection_role_snapshot?: string | null
          company_id: string
          contract_id: string
          created_at?: string
          created_by: string
          deposit_beneficiary_snapshot?: string | null
          deposit_id: string
          evidence_uri: string
          id?: string
          inspection_id?: string | null
          invoice_id?: string | null
          is_sole_admin_exception?: boolean
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_id: string
          reversal_journal_batch_id?: string | null
          reversal_reason?: string | null
          reversal_request_id?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_fingerprint: string
          status?: string
          target_account_no: string
          target_type: string
          updated_at?: string
        }
        Update: {
          allocation_amount?: number
          application_effective_date?: string | null
          application_journal_batch_id?: string | null
          application_request_id?: string | null
          applied_at?: string | null
          applied_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          claim_kind?: string
          claim_note?: string | null
          collection_role_snapshot?: string | null
          company_id?: string
          contract_id?: string
          created_at?: string
          created_by?: string
          deposit_beneficiary_snapshot?: string | null
          deposit_id?: string
          evidence_uri?: string
          id?: string
          inspection_id?: string | null
          invoice_id?: string | null
          is_sole_admin_exception?: boolean
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          request_id?: string
          reversal_journal_batch_id?: string | null
          reversal_reason?: string | null
          reversal_request_id?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_fingerprint?: string
          status?: string
          target_account_no?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_application_claims_application_journal_batch_id_fkey"
            columns: ["application_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_application_claims_application_journal_batch_id_fkey"
            columns: ["application_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "deposit_application_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_application_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deposit_application_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deposit_application_claims_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "contract_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_application_claims_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_application_claims_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      deposit_refund_events: {
        Row: {
          amount: number
          cash_account_no: string
          company_id: string
          created_at: string
          deposit_id: string
          effective_date: string
          id: string
          journal_batch_id: string
          posted_at: string
          posted_by: string
          request_id: string
          reversal_journal_batch_id: string | null
          reversal_reason: string | null
          reversal_request_id: string | null
          reversed_at: string | null
          reversed_by: string | null
          source_fingerprint: string
          status: string
        }
        Insert: {
          amount: number
          cash_account_no: string
          company_id: string
          created_at?: string
          deposit_id: string
          effective_date: string
          id?: string
          journal_batch_id: string
          posted_at?: string
          posted_by: string
          request_id: string
          reversal_journal_batch_id?: string | null
          reversal_reason?: string | null
          reversal_request_id?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_fingerprint: string
          status?: string
        }
        Update: {
          amount?: number
          cash_account_no?: string
          company_id?: string
          created_at?: string
          deposit_id?: string
          effective_date?: string
          id?: string
          journal_batch_id?: string
          posted_at?: string
          posted_by?: string
          request_id?: string
          reversal_journal_batch_id?: string | null
          reversal_reason?: string | null
          reversal_request_id?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_fingerprint?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_refund_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_refund_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deposit_refund_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deposit_refund_events_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_refund_events_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "deposit_refund_events_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_refund_events_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      deposit_transactions: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          deposit_id: string
          description: string | null
          id: string
          journal_batch_id: string | null
          payment_method: string | null
          reason: string | null
          request_id: string
          reversal_of_id: string | null
          type: string
        }
        Insert: {
          amount: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          deposit_id: string
          description?: string | null
          id?: string
          journal_batch_id?: string | null
          payment_method?: string | null
          reason?: string | null
          request_id: string
          reversal_of_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          deposit_id?: string
          description?: string | null
          id?: string
          journal_batch_id?: string | null
          payment_method?: string | null
          reason?: string | null
          request_id?: string
          reversal_of_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deposit_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deposit_transactions_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "tenant_deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_transactions_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "deposit_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_reference_sequences: {
        Row: {
          company_id: string
          doc_type: string
          last_value: number
          prefix: string
          year: number
        }
        Insert: {
          company_id: string
          doc_type: string
          last_value?: number
          prefix: string
          year: number
        }
        Update: {
          company_id?: string
          doc_type?: string
          last_value?: number
          prefix?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_reference_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_reference_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "document_reference_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      due_from_owner_offsets: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          due_from_owner_id: string
          effective_date: string
          id: string
          journal_batch_id: string
          lawful_offset_evidence: string
          owner_id: string
          owner_settlement_id: string
          posted_by: string
          request_id: string
          reversal_journal_batch_id: string | null
          reversed_request_id: string | null
          source_fingerprint: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          due_from_owner_id: string
          effective_date: string
          id?: string
          journal_batch_id: string
          lawful_offset_evidence: string
          owner_id: string
          owner_settlement_id: string
          posted_by: string
          request_id: string
          reversal_journal_batch_id?: string | null
          reversed_request_id?: string | null
          source_fingerprint: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          due_from_owner_id?: string
          effective_date?: string
          id?: string
          journal_batch_id?: string
          lawful_offset_evidence?: string
          owner_id?: string
          owner_settlement_id?: string
          posted_by?: string
          request_id?: string
          reversal_journal_batch_id?: string | null
          reversed_request_id?: string | null
          source_fingerprint?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_from_owner_offsets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_offsets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "due_from_owner_offsets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "due_from_owner_offsets_due_from_owner_id_fkey"
            columns: ["due_from_owner_id"]
            isOneToOne: false
            referencedRelation: "due_from_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_offsets_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_offsets_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "due_from_owner_offsets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_offsets_owner_settlement_id_fkey"
            columns: ["owner_settlement_id"]
            isOneToOne: false
            referencedRelation: "owner_settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_offsets_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_offsets_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      due_from_owner_recoveries: {
        Row: {
          amount: number
          cash_account_no: string
          company_id: string
          created_at: string
          due_from_owner_id: string
          effective_date: string
          id: string
          journal_batch_id: string
          owner_id: string
          posted_by: string
          request_id: string
          reversal_journal_batch_id: string | null
          reversed_request_id: string | null
          source_fingerprint: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          cash_account_no: string
          company_id: string
          created_at?: string
          due_from_owner_id: string
          effective_date: string
          id?: string
          journal_batch_id: string
          owner_id: string
          posted_by: string
          request_id: string
          reversal_journal_batch_id?: string | null
          reversed_request_id?: string | null
          source_fingerprint: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_account_no?: string
          company_id?: string
          created_at?: string
          due_from_owner_id?: string
          effective_date?: string
          id?: string
          journal_batch_id?: string
          owner_id?: string
          posted_by?: string
          request_id?: string
          reversal_journal_batch_id?: string | null
          reversed_request_id?: string | null
          source_fingerprint?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_from_owner_recoveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_recoveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "due_from_owner_recoveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "due_from_owner_recoveries_due_from_owner_id_fkey"
            columns: ["due_from_owner_id"]
            isOneToOne: false
            referencedRelation: "due_from_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_recoveries_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_recoveries_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "due_from_owner_recoveries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_recoveries_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owner_recoveries_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      due_from_owners: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string
          id: string
          journal_batch_id: string | null
          lawful_offset_right: boolean
          offset_amount: number
          outstanding: number
          owner_agreement_id: string | null
          owner_id: string
          property_id: string | null
          recovered_amount: number
          request_id: string
          reversal_journal_batch_id: string | null
          reversed_request_id: string | null
          source_fingerprint: string
          source_id: string | null
          source_type: string
          status: string
          updated_at: string
          waived_amount: number
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          journal_batch_id?: string | null
          lawful_offset_right?: boolean
          offset_amount?: number
          outstanding: number
          owner_agreement_id?: string | null
          owner_id: string
          property_id?: string | null
          recovered_amount?: number
          request_id: string
          reversal_journal_batch_id?: string | null
          reversed_request_id?: string | null
          source_fingerprint: string
          source_id?: string | null
          source_type: string
          status?: string
          updated_at?: string
          waived_amount?: number
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          journal_batch_id?: string | null
          lawful_offset_right?: boolean
          offset_amount?: number
          outstanding?: number
          owner_agreement_id?: string | null
          owner_id?: string
          property_id?: string | null
          recovered_amount?: number
          request_id?: string
          reversal_journal_batch_id?: string | null
          reversed_request_id?: string | null
          source_fingerprint?: string
          source_id?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          waived_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "due_from_owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "due_from_owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "due_from_owners_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owners_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "due_from_owners_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["agreement_id"]
          },
          {
            foreignKeyName: "due_from_owners_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "owner_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owners_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "s08_master_lease_readiness"
            referencedColumns: ["master_lease_id"]
          },
          {
            foreignKeyName: "due_from_owners_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["agreement_id"]
          },
          {
            foreignKeyName: "due_from_owners_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "vw_active_owner_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owners_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_from_owners_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_url: string | null
          category: string
          charged_to: string | null
          company_id: string
          contract_id: string | null
          cost_center_id: string | null
          created_at: string
          date_time: string | null
          deleted_at: string | null
          description: string | null
          expense_date: string
          id: string
          no: string | null
          property_id: string
          reference: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          category: string
          charged_to?: string | null
          company_id?: string
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          date_time?: string | null
          deleted_at?: string | null
          description?: string | null
          expense_date: string
          id?: string
          no?: string | null
          property_id: string
          reference?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category?: string
          charged_to?: string | null
          company_id?: string
          contract_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          date_time?: string | null
          deleted_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          no?: string | null
          property_id?: string
          reference?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "expenses_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_operation_idempotency: {
        Row: {
          created_at: string
          operation_name: string
          request_id: string
          response_payload: Json
        }
        Insert: {
          created_at?: string
          operation_name: string
          request_id: string
          response_payload: Json
        }
        Update: {
          created_at?: string
          operation_name?: string
          request_id?: string
          response_payload?: Json
        }
        Relationships: []
      }
      fixed_monthly_daily_accrual_reversals: {
        Row: {
          accrual_id: string
          company_id: string
          created_at: string
          id: string
          original_economic_date: string
          original_journal_batch_id: string | null
          reason: string
          reversal_journal_batch_id: string | null
          reversed_by: string | null
        }
        Insert: {
          accrual_id: string
          company_id: string
          created_at?: string
          id?: string
          original_economic_date: string
          original_journal_batch_id?: string | null
          reason: string
          reversal_journal_batch_id?: string | null
          reversed_by?: string | null
        }
        Update: {
          accrual_id?: string
          company_id?: string
          created_at?: string
          id?: string
          original_economic_date?: string
          original_journal_batch_id?: string | null
          reason?: string
          reversal_journal_batch_id?: string | null
          reversed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_monthly_daily_accrual_reve_original_journal_batch_id_fkey"
            columns: ["original_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accrual_reve_original_journal_batch_id_fkey"
            columns: ["original_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accrual_reve_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: true
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accrual_reve_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: true
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accrual_reversals_accrual_id_fkey"
            columns: ["accrual_id"]
            isOneToOne: true
            referencedRelation: "fixed_monthly_daily_accruals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accrual_reversals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accrual_reversals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accrual_reversals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      fixed_monthly_daily_accruals: {
        Row: {
          accrual_date: string
          agreement_ends_on: string | null
          agreement_starts_on: string
          agreement_version_id: string
          calendar_day: number
          calendar_days: number
          company_id: string
          created_at: string
          executed_by: string | null
          fee_tax_code: string | null
          fee_tax_profile_id: string | null
          fee_tax_rate: number | null
          fee_tax_treatment_id: string | null
          gross_amount: number
          id: string
          journal_batch_id: string | null
          monthly_amount_omr: number
          monthly_contract_amount: number
          net_amount: number
          owner_agreement_id: string
          owner_id: string
          property_id: string
          rounding_rule: string
          source_fingerprint: string
          tax_amount: number
          tax_authority_status: string
          version_effective_from: string
          version_effective_to: string | null
        }
        Insert: {
          accrual_date: string
          agreement_ends_on?: string | null
          agreement_starts_on: string
          agreement_version_id: string
          calendar_day: number
          calendar_days: number
          company_id: string
          created_at?: string
          executed_by?: string | null
          fee_tax_code?: string | null
          fee_tax_profile_id?: string | null
          fee_tax_rate?: number | null
          fee_tax_treatment_id?: string | null
          gross_amount: number
          id?: string
          journal_batch_id?: string | null
          monthly_amount_omr: number
          monthly_contract_amount: number
          net_amount: number
          owner_agreement_id: string
          owner_id: string
          property_id: string
          rounding_rule: string
          source_fingerprint: string
          tax_amount: number
          tax_authority_status: string
          version_effective_from: string
          version_effective_to?: string | null
        }
        Update: {
          accrual_date?: string
          agreement_ends_on?: string | null
          agreement_starts_on?: string
          agreement_version_id?: string
          calendar_day?: number
          calendar_days?: number
          company_id?: string
          created_at?: string
          executed_by?: string | null
          fee_tax_code?: string | null
          fee_tax_profile_id?: string | null
          fee_tax_rate?: number | null
          fee_tax_treatment_id?: string | null
          gross_amount?: number
          id?: string
          journal_batch_id?: string | null
          monthly_amount_omr?: number
          monthly_contract_amount?: number
          net_amount?: number
          owner_agreement_id?: string
          owner_id?: string
          property_id?: string
          rounding_rule?: string
          source_fingerprint?: string
          tax_amount?: number
          tax_authority_status?: string
          version_effective_from?: string
          version_effective_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_monthly_daily_accruals_agreement_version_id_fkey"
            columns: ["agreement_version_id"]
            isOneToOne: false
            referencedRelation: "owner_agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_fee_tax_profile_id_fkey"
            columns: ["fee_tax_profile_id"]
            isOneToOne: false
            referencedRelation: "company_tax_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_fee_tax_treatment_id_fkey"
            columns: ["fee_tax_treatment_id"]
            isOneToOne: false
            referencedRelation: "company_fee_tax_treatments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: true
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: true
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["agreement_id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "owner_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "s08_master_lease_readiness"
            referencedColumns: ["master_lease_id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["agreement_id"]
          },
          {
            foreignKeyName: "fixed_monthly_daily_accruals_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "vw_active_owner_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_cash_flow_classifications: {
        Row: {
          account_id: string
          account_no: string
          classification: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          account_no: string
          classification: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          account_no?: string
          classification?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_cash_flow_classifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_cash_flow_classifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "gl_cash_flow_classifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      governance: {
        Row: {
          id: number
          locked_periods: Json | null
          read_only: boolean | null
        }
        Insert: {
          id?: number
          locked_periods?: Json | null
          read_only?: boolean | null
        }
        Update: {
          id?: number
          locked_periods?: Json | null
          read_only?: boolean | null
        }
        Relationships: []
      }
      invoice_credits: {
        Row: {
          accounting_classification: string | null
          amount: number
          company_id: string
          created_at: string
          created_by: string
          credit_type: string
          effective_date: string
          id: string
          invoice_id: string
          journal_batch_id: string | null
          net_amount: number | null
          original_invoice_posting_batch_id: string | null
          reason: string
          reason_code: string | null
          request_id: string
          reversal_journal_batch_id: string | null
          reversal_of_id: string | null
          reversal_reason: string | null
          reversal_request_id: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
          tax_amount: number | null
          tax_basis: string | null
          tax_code: string | null
          tax_profile_id: string | null
          tax_rate: number | null
          tax_snapshot_id: string | null
        }
        Insert: {
          accounting_classification?: string | null
          amount: number
          company_id: string
          created_at?: string
          created_by: string
          credit_type: string
          effective_date: string
          id?: string
          invoice_id: string
          journal_batch_id?: string | null
          net_amount?: number | null
          original_invoice_posting_batch_id?: string | null
          reason: string
          reason_code?: string | null
          request_id: string
          reversal_journal_batch_id?: string | null
          reversal_of_id?: string | null
          reversal_reason?: string | null
          reversal_request_id?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          tax_amount?: number | null
          tax_basis?: string | null
          tax_code?: string | null
          tax_profile_id?: string | null
          tax_rate?: number | null
          tax_snapshot_id?: string | null
        }
        Update: {
          accounting_classification?: string | null
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string
          credit_type?: string
          effective_date?: string
          id?: string
          invoice_id?: string
          journal_batch_id?: string | null
          net_amount?: number | null
          original_invoice_posting_batch_id?: string | null
          reason?: string
          reason_code?: string | null
          request_id?: string
          reversal_journal_batch_id?: string | null
          reversal_of_id?: string | null
          reversal_reason?: string | null
          reversal_request_id?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          tax_amount?: number | null
          tax_basis?: string | null
          tax_code?: string | null
          tax_profile_id?: string | null
          tax_rate?: number | null
          tax_snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_credits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_credits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invoice_credits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invoice_credits_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_credits_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_credits_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "invoice_credits_original_invoice_posting_batch_id_fkey"
            columns: ["original_invoice_posting_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_credits_original_invoice_posting_batch_id_fkey"
            columns: ["original_invoice_posting_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "invoice_credits_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_credits_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "invoice_credits_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "invoice_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_credits_tax_profile_id_fkey"
            columns: ["tax_profile_id"]
            isOneToOne: false
            referencedRelation: "company_tax_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_credits_tax_snapshot_id_fkey"
            columns: ["tax_snapshot_id"]
            isOneToOne: false
            referencedRelation: "taxable_line_tax_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment_tax_allocations: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          net_amount: number
          receipt_id: string
          tax_amount: number
          tax_snapshot_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          net_amount: number
          receipt_id: string
          tax_amount: number
          tax_snapshot_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          net_amount?: number
          receipt_id?: string
          tax_amount?: number
          tax_snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_tax_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_tax_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invoice_payment_tax_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invoice_payment_tax_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_tax_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_tax_allocations_tax_snapshot_id_fkey"
            columns: ["tax_snapshot_id"]
            isOneToOne: false
            referencedRelation: "taxable_line_tax_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          billing_period_end: string | null
          billing_period_start: string | null
          charge_type: string
          company_id: string
          contract_id: string
          created_at: string
          credited_amount: number
          deleted_at: string | null
          document_status: string
          due_date: string
          id: string
          invoice_accounting_classification: string | null
          invoice_agreement_version_id: string | null
          invoice_collection_role: string | null
          invoice_operating_model: string | null
          invoice_posting_batch_id: string | null
          issue_date: string
          no: string | null
          notes: string | null
          paid_amount: number
          reference: string | null
          status: string
          tax_amount: number
          tax_basis: string | null
          tax_code: string | null
          tax_profile_id: string | null
          tax_rate: number | null
          tax_snapshot_id: string | null
          tax_treatment: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          charge_type?: string
          company_id?: string
          contract_id: string
          created_at?: string
          credited_amount?: number
          deleted_at?: string | null
          document_status?: string
          due_date: string
          id?: string
          invoice_accounting_classification?: string | null
          invoice_agreement_version_id?: string | null
          invoice_collection_role?: string | null
          invoice_operating_model?: string | null
          invoice_posting_batch_id?: string | null
          issue_date: string
          no?: string | null
          notes?: string | null
          paid_amount?: number
          reference?: string | null
          status?: string
          tax_amount?: number
          tax_basis?: string | null
          tax_code?: string | null
          tax_profile_id?: string | null
          tax_rate?: number | null
          tax_snapshot_id?: string | null
          tax_treatment?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          charge_type?: string
          company_id?: string
          contract_id?: string
          created_at?: string
          credited_amount?: number
          deleted_at?: string | null
          document_status?: string
          due_date?: string
          id?: string
          invoice_accounting_classification?: string | null
          invoice_agreement_version_id?: string | null
          invoice_collection_role?: string | null
          invoice_operating_model?: string | null
          invoice_posting_batch_id?: string | null
          issue_date?: string
          no?: string | null
          notes?: string | null
          paid_amount?: number
          reference?: string | null
          status?: string
          tax_amount?: number
          tax_basis?: string | null
          tax_code?: string | null
          tax_profile_id?: string | null
          tax_rate?: number | null
          tax_snapshot_id?: string | null
          tax_treatment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "invoices_invoice_agreement_version_id_fkey"
            columns: ["invoice_agreement_version_id"]
            isOneToOne: false
            referencedRelation: "owner_agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_invoice_posting_batch_id_fkey"
            columns: ["invoice_posting_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_invoice_posting_batch_id_fkey"
            columns: ["invoice_posting_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "invoices_tax_profile_id_fkey"
            columns: ["tax_profile_id"]
            isOneToOne: false
            referencedRelation: "company_tax_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tax_snapshot_id_fkey"
            columns: ["tax_snapshot_id"]
            isOneToOne: false
            referencedRelation: "taxable_line_tax_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_batches: {
        Row: {
          accounting_period_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          effective_date: string
          event_id: string
          id: string
          is_legacy_compat: boolean
          late_posting: boolean
          period_resolution_reason: string | null
          posted_at: string | null
          posted_by: string | null
          posting_date: string | null
          reversal_of_batch_id: string | null
          source_id: string
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          accounting_period_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_date: string
          event_id: string
          id?: string
          is_legacy_compat?: boolean
          late_posting?: boolean
          period_resolution_reason?: string | null
          posted_at?: string | null
          posted_by?: string | null
          posting_date?: string | null
          reversal_of_batch_id?: string | null
          source_id?: string
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          accounting_period_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          effective_date?: string
          event_id?: string
          id?: string
          is_legacy_compat?: boolean
          late_posting?: boolean
          period_resolution_reason?: string | null
          posted_at?: string | null
          posted_by?: string | null
          posting_date?: string | null
          reversal_of_batch_id?: string | null
          source_id?: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_batches_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_batches_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["accounting_period_id"]
          },
          {
            foreignKeyName: "journal_batches_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["accounting_period_id"]
          },
          {
            foreignKeyName: "journal_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "journal_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "journal_batches_reversal_of_batch_id_fkey"
            columns: ["reversal_of_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_batches_reversal_of_batch_id_fkey"
            columns: ["reversal_of_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          batch_id: string
          company_id: string
          created_at: string
          credit: number
          date: string | null
          debit: number
          deleted_at: string | null
          id: string
          line_description: string | null
          no: string | null
          ref_entity_id: string | null
          ref_entity_type: string | null
          ref_source_id: string | null
          request_id: string | null
        }
        Insert: {
          account_id: string
          batch_id: string
          company_id?: string
          created_at?: string
          credit?: number
          date?: string | null
          debit?: number
          deleted_at?: string | null
          id: string
          line_description?: string | null
          no?: string | null
          ref_entity_id?: string | null
          ref_entity_type?: string | null
          ref_source_id?: string | null
          request_id?: string | null
        }
        Update: {
          account_id?: string
          batch_id?: string
          company_id?: string
          created_at?: string
          credit?: number
          date?: string | null
          debit?: number
          deleted_at?: string | null
          id?: string
          line_description?: string | null
          no?: string | null
          ref_entity_id?: string | null
          ref_entity_type?: string | null
          ref_source_id?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_company_fkey"
            columns: ["account_id", "company_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "journal_lines_batch_company_fkey"
            columns: ["batch_id", "company_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "journal_lines_batch_company_fkey"
            columns: ["batch_id", "company_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id", "company_id"]
          },
          {
            foreignKeyName: "journal_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "journal_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      lands: {
        Row: {
          area: number | null
          category: string | null
          commission: number | null
          company_id: string
          created_at: string | null
          id: string
          location: string | null
          name: string | null
          notes: string | null
          owner_id: string | null
          owner_price: number | null
          plot_no: string | null
          purchase_price: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          area?: number | null
          category?: string | null
          commission?: number | null
          company_id?: string
          created_at?: string | null
          id: string
          location?: string | null
          name?: string | null
          notes?: string | null
          owner_id?: string | null
          owner_price?: number | null
          plot_no?: string | null
          purchase_price?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          area?: number | null
          category?: string | null
          commission?: number | null
          company_id?: string
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string | null
          notes?: string | null
          owner_id?: string | null
          owner_price?: number | null
          plot_no?: string | null
          purchase_price?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lands_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lands_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lands_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      leads: {
        Row: {
          company_id: string
          created_at: string | null
          desired_unit_type: string | null
          email: string | null
          id: string
          max_budget: number | null
          min_budget: number | null
          name: string | null
          no: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          desired_unit_type?: string | null
          email?: string | null
          id: string
          max_budget?: number | null
          min_budget?: number | null
          name?: string | null
          no?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          desired_unit_type?: string | null
          email?: string | null
          id?: string
          max_budget?: number | null
          min_budget?: number | null
          name?: string | null
          no?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          assigned_to: string | null
          attachment_url: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          charged_to: string | null
          company_id: string
          completed_at: string | null
          cost: number | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          expense_id: string | null
          id: string
          invoice_id: string | null
          no: string | null
          notes: string | null
          priority: string | null
          property_id: string | null
          reference: string | null
          reported_by: string | null
          request_date: string | null
          request_id: string | null
          resolved_at: string | null
          response_time_hours: number | null
          scheduled_date: string | null
          service_provider_category_id: string | null
          service_provider_id: string | null
          status: string | null
          technician_name: string | null
          title: string | null
          unit_id: string | null
          updated_at: string | null
          work_description: string | null
        }
        Insert: {
          assigned_to?: string | null
          attachment_url?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          charged_to?: string | null
          company_id: string
          completed_at?: string | null
          cost?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
          no?: string | null
          notes?: string | null
          priority?: string | null
          property_id?: string | null
          reference?: string | null
          reported_by?: string | null
          request_date?: string | null
          request_id?: string | null
          resolved_at?: string | null
          response_time_hours?: number | null
          scheduled_date?: string | null
          service_provider_category_id?: string | null
          service_provider_id?: string | null
          status?: string | null
          technician_name?: string | null
          title?: string | null
          unit_id?: string | null
          updated_at?: string | null
          work_description?: string | null
        }
        Update: {
          assigned_to?: string | null
          attachment_url?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          charged_to?: string | null
          company_id?: string
          completed_at?: string | null
          cost?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
          no?: string | null
          notes?: string | null
          priority?: string | null
          property_id?: string | null
          reference?: string | null
          reported_by?: string | null
          request_date?: string | null
          request_id?: string | null
          resolved_at?: string | null
          response_time_hours?: number | null
          scheduled_date?: string | null
          service_provider_category_id?: string | null
          service_provider_id?: string | null
          status?: string | null
          technician_name?: string | null
          title?: string | null
          unit_id?: string | null
          updated_at?: string | null
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "maintenance_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "maintenance_records_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "maintenance_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_records_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_service_provider_category_company_fk"
            columns: ["service_provider_category_id", "company_id"]
            isOneToOne: false
            referencedRelation: "service_provider_categories"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "maintenance_service_provider_company_fk"
            columns: ["service_provider_id", "company_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      management_fee_tax_snapshots: {
        Row: {
          company_id: string
          created_at: string
          effective_date: string
          fee_kind: string
          id: string
          invoice_id: string
          journal_batch_id: string | null
          net_amount: number
          receipt_id: string
          tax_amount: number
          tax_code: string
          tax_profile_id: string | null
          tax_rate: number
          treatment_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          effective_date: string
          fee_kind: string
          id?: string
          invoice_id: string
          journal_batch_id?: string | null
          net_amount: number
          receipt_id: string
          tax_amount: number
          tax_code: string
          tax_profile_id?: string | null
          tax_rate: number
          treatment_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          effective_date?: string
          fee_kind?: string
          id?: string
          invoice_id?: string
          journal_batch_id?: string | null
          net_amount?: number
          receipt_id?: string
          tax_amount?: number
          tax_code?: string
          tax_profile_id?: string | null
          tax_rate?: number
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_fee_tax_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_fee_tax_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "management_fee_tax_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "management_fee_tax_snapshots_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_fee_tax_snapshots_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_fee_tax_snapshots_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "management_fee_tax_snapshots_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_fee_tax_snapshots_tax_profile_id_fkey"
            columns: ["tax_profile_id"]
            isOneToOne: false
            referencedRelation: "company_tax_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_fee_tax_snapshots_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "company_fee_tax_treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      master_lease_measurements: {
        Row: {
          annual_discount_rate_bps: number
          carrying_liability_before: number | null
          carrying_rou_before: number | null
          company_id: string
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          initial_direct_costs: number
          initial_liability: number
          initial_rou_asset: number
          input_fingerprint: string
          input_payload: Json
          lease_incentives: number
          liability_delta: number
          measurement_type: string
          owner_agreement_id: string
          periodic_rate: number
          periods_count: number
          periods_per_year: number
          posted_at: string | null
          prepayments: number
          request_id: string
          rou_adjustment: number
          scope_reduction_bps: number
          short_term_exempt: boolean
          status: string
          superseded_at: string | null
          supersedes_measurement_id: string | null
          termination_gain_loss: number
          version_no: number
        }
        Insert: {
          annual_discount_rate_bps: number
          carrying_liability_before?: number | null
          carrying_rou_before?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          initial_direct_costs?: number
          initial_liability?: number
          initial_rou_asset?: number
          input_fingerprint: string
          input_payload: Json
          lease_incentives?: number
          liability_delta?: number
          measurement_type: string
          owner_agreement_id: string
          periodic_rate: number
          periods_count: number
          periods_per_year: number
          posted_at?: string | null
          prepayments?: number
          request_id: string
          rou_adjustment?: number
          scope_reduction_bps?: number
          short_term_exempt?: boolean
          status?: string
          superseded_at?: string | null
          supersedes_measurement_id?: string | null
          termination_gain_loss?: number
          version_no: number
        }
        Update: {
          annual_discount_rate_bps?: number
          carrying_liability_before?: number | null
          carrying_rou_before?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          initial_direct_costs?: number
          initial_liability?: number
          initial_rou_asset?: number
          input_fingerprint?: string
          input_payload?: Json
          lease_incentives?: number
          liability_delta?: number
          measurement_type?: string
          owner_agreement_id?: string
          periodic_rate?: number
          periods_count?: number
          periods_per_year?: number
          posted_at?: string | null
          prepayments?: number
          request_id?: string
          rou_adjustment?: number
          scope_reduction_bps?: number
          short_term_exempt?: boolean
          status?: string
          superseded_at?: string | null
          supersedes_measurement_id?: string | null
          termination_gain_loss?: number
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "master_lease_measurements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lease_measurements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "master_lease_measurements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "master_lease_measurements_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["agreement_id"]
          },
          {
            foreignKeyName: "master_lease_measurements_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "owner_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lease_measurements_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "s08_master_lease_readiness"
            referencedColumns: ["master_lease_id"]
          },
          {
            foreignKeyName: "master_lease_measurements_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["agreement_id"]
          },
          {
            foreignKeyName: "master_lease_measurements_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "vw_active_owner_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_lease_measurements_supersedes_measurement_id_fkey"
            columns: ["supersedes_measurement_id"]
            isOneToOne: false
            referencedRelation: "master_lease_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      master_lease_schedule_rows: {
        Row: {
          closing_liability: number
          closing_rou_asset: number
          company_id: string
          created_at: string
          due_date: string
          id: string
          interest_amount: number
          measurement_id: string
          opening_liability: number
          payment_amount: number
          period_no: number
          posted_at: string | null
          principal_amount: number
          rou_depreciation: number
          superseded_at: string | null
        }
        Insert: {
          closing_liability: number
          closing_rou_asset: number
          company_id: string
          created_at?: string
          due_date: string
          id?: string
          interest_amount: number
          measurement_id: string
          opening_liability: number
          payment_amount: number
          period_no: number
          posted_at?: string | null
          principal_amount: number
          rou_depreciation: number
          superseded_at?: string | null
        }
        Update: {
          closing_liability?: number
          closing_rou_asset?: number
          company_id?: string
          created_at?: string
          due_date?: string
          id?: string
          interest_amount?: number
          measurement_id?: string
          opening_liability?: number
          payment_amount?: number
          period_no?: number
          posted_at?: string | null
          principal_amount?: number
          rou_depreciation?: number
          superseded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_lease_schedule_measurement_company_fk"
            columns: ["measurement_id", "company_id"]
            isOneToOne: false
            referencedRelation: "master_lease_measurements"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          company_id: string
          id: string
          is_enabled: boolean | null
          name: string | null
          template: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string
          id: string
          is_enabled?: boolean | null
          name?: string | null
          template?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          is_enabled?: boolean | null
          name?: string | null
          template?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "notification_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          updated_at: number | null
          user_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type: string
          updated_at?: number | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          updated_at?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_requirement_templates: {
        Row: {
          code: string
          completion_source: string | null
          label_ar: string
          required: boolean
          sort_order: number
          waiver_policy: string
        }
        Insert: {
          code: string
          completion_source?: string | null
          label_ar: string
          required?: boolean
          sort_order?: number
          waiver_policy?: string
        }
        Update: {
          code?: string
          completion_source?: string | null
          label_ar?: string
          required?: boolean
          sort_order?: number
          waiver_policy?: string
        }
        Relationships: []
      }
      outgoing_notifications: {
        Row: {
          company_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          is_system_generated: boolean | null
          message: string | null
          notification_type: string | null
          recipient_contact: string | null
          recipient_name: string | null
          sent_at: number | null
          source_id: string | null
          source_type: string | null
          status: string | null
          template_id: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id: string
          is_system_generated?: boolean | null
          message?: string | null
          notification_type?: string | null
          recipient_contact?: string | null
          recipient_name?: string | null
          sent_at?: number | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_system_generated?: boolean | null
          message?: string | null
          notification_type?: string | null
          recipient_contact?: string | null
          recipient_name?: string | null
          sent_at?: number | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          template_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outgoing_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outgoing_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "outgoing_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      owner_agreement_versions: {
        Row: {
          collection_role: string
          commission_recognition_basis: string
          commission_type: string
          commission_value: number
          company_id: string
          created_at: string
          created_by: string | null
          deposit_beneficiary: string | null
          deposit_custodian: string | null
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          offset_allowed: boolean
          operating_model: string
          owner_agreement_id: string
          reserve_amount: number
          superseded_at: string | null
          version_no: number
        }
        Insert: {
          collection_role: string
          commission_recognition_basis: string
          commission_type: string
          commission_value: number
          company_id: string
          created_at?: string
          created_by?: string | null
          deposit_beneficiary?: string | null
          deposit_custodian?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          offset_allowed?: boolean
          operating_model: string
          owner_agreement_id: string
          reserve_amount?: number
          superseded_at?: string | null
          version_no: number
        }
        Update: {
          collection_role?: string
          commission_recognition_basis?: string
          commission_type?: string
          commission_value?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          deposit_beneficiary?: string | null
          deposit_custodian?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          offset_allowed?: boolean
          operating_model?: string
          owner_agreement_id?: string
          reserve_amount?: number
          superseded_at?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "owner_agreement_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_agreement_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_agreement_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_agreement_versions_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["agreement_id"]
          },
          {
            foreignKeyName: "owner_agreement_versions_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "owner_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_agreement_versions_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "s08_master_lease_readiness"
            referencedColumns: ["master_lease_id"]
          },
          {
            foreignKeyName: "owner_agreement_versions_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["agreement_id"]
          },
          {
            foreignKeyName: "owner_agreement_versions_owner_agreement_id_fkey"
            columns: ["owner_agreement_id"]
            isOneToOne: false
            referencedRelation: "vw_active_owner_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_agreements: {
        Row: {
          agreement_type: string
          commission_type: string
          commission_value: number
          company_id: string | null
          created_at: string
          current_version_id: string | null
          ends_on: string | null
          id: string
          notes: string | null
          owner_id: string
          property_id: string
          reference: string | null
          starts_on: string
          updated_at: string
        }
        Insert: {
          agreement_type: string
          commission_type: string
          commission_value: number
          company_id?: string | null
          created_at?: string
          current_version_id?: string | null
          ends_on?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          property_id: string
          reference?: string | null
          starts_on: string
          updated_at?: string
        }
        Update: {
          agreement_type?: string
          commission_type?: string
          commission_value?: number
          company_id?: string | null
          created_at?: string
          current_version_id?: string | null
          ends_on?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          property_id?: string
          reference?: string | null
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_agreements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_agreements_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "owner_agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_agreements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "owner_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_balances: {
        Row: {
          commission: number
          company_id: string
          net_balance: number
          owner_id: string
          total_expenses: number
          total_income: number
          updated_at: string
        }
        Insert: {
          commission?: number
          company_id?: string
          net_balance?: number
          owner_id: string
          total_expenses?: number
          total_income?: number
          updated_at?: string
        }
        Update: {
          commission?: number
          company_id?: string
          net_balance?: number
          owner_id?: string
          total_expenses?: number
          total_income?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      owner_funds_event_cutovers: {
        Row: {
          approval_request_id: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string
          cutover_date: string
          gl_line_count: number
          opening_balance: number
          reason: string
          s08_review_id: string
          source_fingerprint: string
          status: string
        }
        Insert: {
          approval_request_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by: string
          cutover_date: string
          gl_line_count: number
          opening_balance: number
          reason: string
          s08_review_id: string
          source_fingerprint: string
          status?: string
        }
        Update: {
          approval_request_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          cutover_date?: string
          gl_line_count?: number
          opening_balance?: number
          reason?: string
          s08_review_id?: string
          source_fingerprint?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_funds_event_cutovers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_funds_event_cutovers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_funds_event_cutovers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_funds_event_cutovers_s08_review_id_fkey"
            columns: ["s08_review_id"]
            isOneToOne: false
            referencedRelation: "s08_frozen_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_funds_events: {
        Row: {
          amount_delta: number
          company_id: string
          contract_id: string | null
          created_at: string
          effective_date: string
          event_id: string
          id: string
          invoice_id: string | null
          journal_batch_id: string | null
          owner_id: string
          source_id: string
          source_type: string
        }
        Insert: {
          amount_delta: number
          company_id: string
          contract_id?: string | null
          created_at?: string
          effective_date: string
          event_id: string
          id?: string
          invoice_id?: string | null
          journal_batch_id?: string | null
          owner_id: string
          source_id: string
          source_type: string
        }
        Update: {
          amount_delta?: number
          company_id?: string
          contract_id?: string | null
          created_at?: string
          effective_date?: string
          event_id?: string
          id?: string
          invoice_id?: string | null
          journal_batch_id?: string | null
          owner_id?: string
          source_id?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_funds_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_funds_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_funds_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_funds_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_funds_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "owner_funds_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "owner_funds_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "owner_funds_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_funds_events_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_funds_events_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "owner_funds_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_settlement_expense_links: {
        Row: {
          company_id: string
          created_at: string
          expense_id: string
          id: string
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          reserved_at: string
          reserved_by: string | null
          settlement_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expense_id: string
          id?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          reserved_at?: string
          reserved_by?: string | null
          settlement_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expense_id?: string
          id?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          reserved_at?: string
          reserved_by?: string | null
          settlement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_settlement_expense_links_expense_fkey"
            columns: ["expense_id", "company_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "owner_settlement_expense_links_settlement_fkey"
            columns: ["settlement_id", "company_id"]
            isOneToOne: false
            referencedRelation: "owner_settlements"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      owner_settlement_payment_links: {
        Row: {
          company_id: string
          created_at: string
          id: string
          payment_id: string
          release_reason: string | null
          released_at: string | null
          released_by: string | null
          reserved_at: string
          reserved_by: string | null
          settlement_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          payment_id: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          reserved_at?: string
          reserved_by?: string | null
          settlement_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          payment_id?: string
          release_reason?: string | null
          released_at?: string | null
          released_by?: string | null
          reserved_at?: string
          reserved_by?: string | null
          settlement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_settlement_payment_links_payment_fkey"
            columns: ["payment_id", "company_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "owner_settlement_payment_links_settlement_fkey"
            columns: ["settlement_id", "company_id"]
            isOneToOne: false
            referencedRelation: "owner_settlements"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      owner_settlements: {
        Row: {
          amount: number | null
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          checker_user_id: string | null
          company_id: string
          created_at: string | null
          date: string | null
          gross_collected: number
          id: string
          is_sole_admin_exception: boolean
          maker_user_id: string | null
          method: string | null
          net_payable: number
          no: string | null
          notes: string | null
          office_fee: number
          offset_applied: number
          owner_expenses: number
          owner_id: string | null
          paid_at: string | null
          paid_by: string | null
          payment_reference: string | null
          period_end: string | null
          period_start: string | null
          property_id: string | null
          ref: string | null
          reference: string | null
          request_id: string | null
          status: string | null
          tax_amount: number
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checker_user_id?: string | null
          company_id?: string
          created_at?: string | null
          date?: string | null
          gross_collected?: number
          id: string
          is_sole_admin_exception?: boolean
          maker_user_id?: string | null
          method?: string | null
          net_payable?: number
          no?: string | null
          notes?: string | null
          office_fee?: number
          offset_applied?: number
          owner_expenses?: number
          owner_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          property_id?: string | null
          ref?: string | null
          reference?: string | null
          request_id?: string | null
          status?: string | null
          tax_amount?: number
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checker_user_id?: string | null
          company_id?: string
          created_at?: string | null
          date?: string | null
          gross_collected?: number
          id?: string
          is_sole_admin_exception?: boolean
          maker_user_id?: string | null
          method?: string | null
          net_payable?: number
          no?: string | null
          notes?: string | null
          office_fee?: number
          offset_applied?: number
          owner_expenses?: number
          owner_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          property_id?: string | null
          ref?: string | null
          reference?: string | null
          request_id?: string | null
          status?: string | null
          tax_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_settlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_settlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owner_settlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      owners: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          name: string
          national_id: string | null
          notes: string | null
          phone: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          name?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          name?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      payment_terms_templates: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          installments: number | null
          interval_type: string | null
          is_active: boolean | null
          name: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          installments?: number | null
          interval_type?: string | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          installments?: number | null
          interval_type?: string | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          channel: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          date_time: string | null
          deleted_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string
          receipt_id: string | null
          reference_no: string | null
          reference_number: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          channel?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          date_time?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method: string
          receipt_id?: string | null
          reference_no?: string | null
          reference_number?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          channel?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          date_time?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string
          receipt_id?: string | null
          reference_no?: string | null
          reference_number?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: true
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          national_id: string | null
          notes: string | null
          phone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "people_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      permission_requests: {
        Row: {
          company_id: string
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          id: string
          permission: string
          reason: string
          requester_user_id: string
          resource_route: string | null
          reviewer_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          id?: string
          permission: string
          reason?: string
          requester_user_id: string
          resource_route?: string | null
          reviewer_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decision_reason?: string | null
          id?: string
          permission?: string
          reason?: string
          requester_user_id?: string
          resource_route?: string | null
          reviewer_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "permission_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          company_id: string
          created_at: string
          current_value: number | null
          deleted_at: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          owner_name: string | null
          purchase_value: number | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          address: string
          company_id?: string
          created_at?: string
          current_value?: number | null
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          owner_name?: string | null
          purchase_value?: number | null
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          address?: string
          company_id?: string
          created_at?: string
          current_value?: number | null
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          owner_name?: string | null
          purchase_value?: number | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          company_id: string
          created_at: string
          ends_on: string | null
          id: string
          is_primary: boolean
          owner_id: string
          ownership_percentage: number
          property_id: string
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          is_primary?: boolean
          owner_id: string
          ownership_percentage?: number
          property_id: string
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          is_primary?: boolean
          owner_id?: string
          ownership_percentage?: number
          property_id?: string
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "property_owners_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "property_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_allocations: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          invoice_id: string | null
          receipt_id: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          receipt_id: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          invoice_id?: string | null
          receipt_id?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "receipt_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "receipt_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_void_requests: {
        Row: {
          company_id: string
          created_at: string
          execution_request_id: string | null
          id: string
          is_sole_admin_exception: boolean
          reason: string
          receipt_id: string
          request_id: string
          requested_at: string
          requested_by: string
          result_payload: Json | null
          reversal_batch_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          execution_request_id?: string | null
          id?: string
          is_sole_admin_exception?: boolean
          reason: string
          receipt_id: string
          request_id: string
          requested_at?: string
          requested_by: string
          result_payload?: Json | null
          reversal_batch_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          execution_request_id?: string | null
          id?: string
          is_sole_admin_exception?: boolean
          reason?: string
          receipt_id?: string
          request_id?: string
          requested_at?: string
          requested_by?: string
          result_payload?: Json | null
          reversal_batch_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_void_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_void_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "receipt_void_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          channel: string | null
          check_bank: string | null
          check_date: string | null
          check_number: string | null
          check_status: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          date_time: string
          deleted_at: string | null
          id: string
          maker_user_id: string | null
          no: string | null
          notes: string | null
          payment_id: string | null
          ref: string | null
          reference: string | null
          request_id: string | null
          status: string
          tenant_id: string | null
          updated_at: string | null
          voided_at: number | null
        }
        Insert: {
          amount: number
          channel?: string | null
          check_bank?: string | null
          check_date?: string | null
          check_number?: string | null
          check_status?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          date_time?: string
          deleted_at?: string | null
          id?: string
          maker_user_id?: string | null
          no?: string | null
          notes?: string | null
          payment_id?: string | null
          ref?: string | null
          reference?: string | null
          request_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
          voided_at?: number | null
        }
        Update: {
          amount?: number
          channel?: string | null
          check_bank?: string | null
          check_date?: string | null
          check_number?: string | null
          check_status?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          date_time?: string
          deleted_at?: string | null
          id?: string
          maker_user_id?: string | null
          no?: string | null
          notes?: string | null
          payment_id?: string | null
          ref?: string | null
          reference?: string | null
          request_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
          voided_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "receipts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "receipts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "receipts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      s08_frozen_reviews: {
        Row: {
          accounting_period_id: string | null
          analysis_results: Json | null
          analysis_version: string
          company_id: string
          created_at: string
          created_by: string | null
          creation_timestamp: string
          dataset_fingerprint: string
          dataset_lineage: string
          evidence_reference: string | null
          exceptions: Json | null
          id: string
          reconciliation_evidence: Json | null
          review_notes: string | null
          review_scope: Json
          reviewed_at: string | null
          reviewer_decision: string
          reviewer_id: string | null
          updated_at: string
        }
        Insert: {
          accounting_period_id?: string | null
          analysis_results?: Json | null
          analysis_version: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          creation_timestamp?: string
          dataset_fingerprint: string
          dataset_lineage: string
          evidence_reference?: string | null
          exceptions?: Json | null
          id?: string
          reconciliation_evidence?: Json | null
          review_notes?: string | null
          review_scope?: Json
          reviewed_at?: string | null
          reviewer_decision?: string
          reviewer_id?: string | null
          updated_at?: string
        }
        Update: {
          accounting_period_id?: string | null
          analysis_results?: Json | null
          analysis_version?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          creation_timestamp?: string
          dataset_fingerprint?: string
          dataset_lineage?: string
          evidence_reference?: string | null
          exceptions?: Json | null
          id?: string
          reconciliation_evidence?: Json | null
          review_notes?: string | null
          review_scope?: Json
          reviewed_at?: string | null
          reviewer_decision?: string
          reviewer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "s08_frozen_reviews_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s08_frozen_reviews_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["accounting_period_id"]
          },
          {
            foreignKeyName: "s08_frozen_reviews_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["accounting_period_id"]
          },
          {
            foreignKeyName: "s08_frozen_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s08_frozen_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "s08_frozen_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      s09_corrections: {
        Row: {
          accounting_period_id: string | null
          actor_id: string | null
          after_evidence: Json | null
          amount: number
          applied_at: string | null
          before_evidence: Json | null
          company_id: string
          correction_journal_batch_id: string | null
          created_at: string
          credit_account_id: string | null
          credit_account_no: string | null
          debit_account_id: string | null
          debit_account_no: string | null
          id: string
          idempotency_key: string | null
          lines: Json | null
          original_journal_batch_id: string | null
          reason: string
          request_id: string
          reversal_journal_batch_id: string | null
          reversal_reason: string | null
          reversed_at: string | null
          review_id: string
          source_id: string
          source_scope: Json
          source_type: string
          status: string
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          accounting_period_id?: string | null
          actor_id?: string | null
          after_evidence?: Json | null
          amount: number
          applied_at?: string | null
          before_evidence?: Json | null
          company_id?: string
          correction_journal_batch_id?: string | null
          created_at?: string
          credit_account_id?: string | null
          credit_account_no?: string | null
          debit_account_id?: string | null
          debit_account_no?: string | null
          id?: string
          idempotency_key?: string | null
          lines?: Json | null
          original_journal_batch_id?: string | null
          reason: string
          request_id: string
          reversal_journal_batch_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          review_id: string
          source_id: string
          source_scope?: Json
          source_type: string
          status?: string
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          accounting_period_id?: string | null
          actor_id?: string | null
          after_evidence?: Json | null
          amount?: number
          applied_at?: string | null
          before_evidence?: Json | null
          company_id?: string
          correction_journal_batch_id?: string | null
          created_at?: string
          credit_account_id?: string | null
          credit_account_no?: string | null
          debit_account_id?: string | null
          debit_account_no?: string | null
          id?: string
          idempotency_key?: string | null
          lines?: Json | null
          original_journal_batch_id?: string | null
          reason?: string
          request_id?: string
          reversal_journal_batch_id?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          review_id?: string
          source_id?: string
          source_scope?: Json
          source_type?: string
          status?: string
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "s09_corrections_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s09_corrections_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["accounting_period_id"]
          },
          {
            foreignKeyName: "s09_corrections_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["accounting_period_id"]
          },
          {
            foreignKeyName: "s09_corrections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s09_corrections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "s09_corrections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "s09_corrections_correction_journal_batch_id_fkey"
            columns: ["correction_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s09_corrections_correction_journal_batch_id_fkey"
            columns: ["correction_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "s09_corrections_original_journal_batch_id_fkey"
            columns: ["original_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s09_corrections_original_journal_batch_id_fkey"
            columns: ["original_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "s09_corrections_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s09_corrections_reversal_journal_batch_id_fkey"
            columns: ["reversal_journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "s09_corrections_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "s08_frozen_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      serials: {
        Row: {
          company_id: string
          contract: number | null
          expense: number | null
          id: number
          invoice: number | null
          journal_entry: number | null
          lead: number | null
          maintenance: number | null
          mission: number | null
          owner_settlement: number | null
          receipt: number | null
        }
        Insert: {
          company_id?: string
          contract?: number | null
          expense?: number | null
          id?: number
          invoice?: number | null
          journal_entry?: number | null
          lead?: number | null
          maintenance?: number | null
          mission?: number | null
          owner_settlement?: number | null
          receipt?: number | null
        }
        Update: {
          company_id?: string
          contract?: number | null
          expense?: number | null
          id?: number
          invoice?: number | null
          journal_entry?: number | null
          lead?: number | null
          maintenance?: number | null
          mission?: number | null
          owner_settlement?: number | null
          receipt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "serials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "serials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      service_provider_categories: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_provider_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_provider_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "service_provider_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      service_provider_category_links: {
        Row: {
          category_id: string
          company_id: string
          created_at: string
          id: string
          service_provider_id: string
        }
        Insert: {
          category_id: string
          company_id?: string
          created_at?: string
          id?: string
          service_provider_id: string
        }
        Update: {
          category_id?: string
          company_id?: string
          created_at?: string
          id?: string
          service_provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_provider_category_links_category_fk"
            columns: ["category_id", "company_id"]
            isOneToOne: false
            referencedRelation: "service_provider_categories"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "service_provider_category_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_provider_category_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "service_provider_category_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "service_provider_category_links_provider_fk"
            columns: ["service_provider_id", "company_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      service_providers: {
        Row: {
          address: string | null
          alternate_phone: string | null
          availability_notes: string | null
          company_id: string
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          registration_number: string | null
          service_area: string | null
          tax_number: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          alternate_phone?: string | null
          availability_notes?: string | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          registration_number?: string | null
          service_area?: string | null
          tax_number?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          alternate_phone?: string | null
          availability_notes?: string | null
          company_id?: string
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          registration_number?: string | null
          service_area?: string | null
          tax_number?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_providers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "service_providers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      status_history: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          company_id: string
          entity_id: string
          entity_type: string
          id: string
          new_status: string
          notes: string | null
          previous_status: string | null
          timestamp: number
          updated_at: number | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          company_id?: string
          entity_id: string
          entity_type: string
          id?: string
          new_status: string
          notes?: string | null
          previous_status?: string | null
          timestamp?: number
          updated_at?: number | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          company_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_status?: string
          notes?: string | null
          previous_status?: string | null
          timestamp?: number
          updated_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      status_transition_rules: {
        Row: {
          company_id: string
          entity_type: string
          from_status: string
          id: string
          required_fields: Json | null
          requires_cost: boolean | null
          to_status: string
          updated_at: number | null
        }
        Insert: {
          company_id?: string
          entity_type: string
          from_status: string
          id?: string
          required_fields?: Json | null
          requires_cost?: boolean | null
          to_status: string
          updated_at?: number | null
        }
        Update: {
          company_id?: string
          entity_type?: string
          from_status?: string
          id?: string
          required_fields?: Json | null
          requires_cost?: boolean | null
          to_status?: string
          updated_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "status_transition_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_transition_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "status_transition_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      support_request_events: {
        Row: {
          actor_id: string
          company_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: number
          idempotency_key: string | null
          reason: string | null
          support_request_id: string
          to_status: string
        }
        Insert: {
          actor_id: string
          company_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: never
          idempotency_key?: string | null
          reason?: string | null
          support_request_id: string
          to_status: string
        }
        Update: {
          actor_id?: string
          company_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: never
          idempotency_key?: string | null
          reason?: string | null
          support_request_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_request_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_request_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "support_request_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "support_request_events_support_request_id_fkey"
            columns: ["support_request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          acknowledged_at: string
          actual_behavior: string
          app_version: string
          category: string
          company_id: string
          created_at: string
          error_reference: string | null
          expected_behavior: string
          id: string
          public_note: string | null
          reference: string
          requester_id: string
          requester_role: string
          resolved_at: string | null
          route: string
          status: string
          updated_at: string
          urgency: string
        }
        Insert: {
          acknowledged_at?: string
          actual_behavior: string
          app_version: string
          category: string
          company_id: string
          created_at?: string
          error_reference?: string | null
          expected_behavior: string
          id?: string
          public_note?: string | null
          reference: string
          requester_id: string
          requester_role: string
          resolved_at?: string | null
          route: string
          status?: string
          updated_at?: string
          urgency: string
        }
        Update: {
          acknowledged_at?: string
          actual_behavior?: string
          app_version?: string
          category?: string
          company_id?: string
          created_at?: string
          error_reference?: string | null
          expected_behavior?: string
          id?: string
          public_note?: string | null
          reference?: string
          requester_id?: string
          requester_role?: string
          resolved_at?: string | null
          route?: string
          status?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "support_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      tax_code_catalog: {
        Row: {
          code: string
          created_at: string
          description: string | null
          is_active: boolean
          name_ar: string
          name_en: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          name_ar: string
          name_en: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      taxable_line_tax_snapshots: {
        Row: {
          account_no: string
          company_id: string
          created_at: string
          effective_date: string
          id: string
          journal_batch_id: string | null
          net_amount: number
          source_id: string
          source_type: string
          tax_amount: number
          tax_code: string
          tax_rate: number
        }
        Insert: {
          account_no: string
          company_id: string
          created_at?: string
          effective_date: string
          id?: string
          journal_batch_id?: string | null
          net_amount: number
          source_id: string
          source_type: string
          tax_amount: number
          tax_code: string
          tax_rate: number
        }
        Update: {
          account_no?: string
          company_id?: string
          created_at?: string
          effective_date?: string
          id?: string
          journal_batch_id?: string | null
          net_amount?: number
          source_id?: string
          source_type?: string
          tax_amount?: number
          tax_code?: string
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "taxable_line_tax_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxable_line_tax_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "taxable_line_tax_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "taxable_line_tax_snapshots_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxable_line_tax_snapshots_journal_batch_id_fkey"
            columns: ["journal_batch_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      tenant_balances: {
        Row: {
          balance_due: number | null
          company_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          balance_due?: number | null
          company_id?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          balance_due?: number | null
          company_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tenant_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tenant_balances_tenant_id_people_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_deposits: {
        Row: {
          company_id: string
          contract_id: string
          created_at: string
          deducted_amount: number
          deleted_at: string | null
          deposit_amount: number
          id: string
          notes: string | null
          property_id: string | null
          received_date: string
          reference: string | null
          refunded_amount: number
          remaining_amount: number
          request_id: string | null
          settled_date: string | null
          status: string
          tenant_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string
          contract_id: string
          created_at?: string
          deducted_amount?: number
          deleted_at?: string | null
          deposit_amount: number
          id?: string
          notes?: string | null
          property_id?: string | null
          received_date?: string
          reference?: string | null
          refunded_amount?: number
          remaining_amount?: number
          request_id?: string | null
          settled_date?: string | null
          status?: string
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          contract_id?: string
          created_at?: string
          deducted_amount?: number
          deleted_at?: string | null
          deposit_amount?: number
          id?: string
          notes?: string | null
          property_id?: string | null
          received_date?: string
          reference?: string | null
          refunded_amount?: number
          remaining_amount?: number
          request_id?: string | null
          settled_date?: string | null
          status?: string
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_deposits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_deposits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tenant_deposits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tenant_deposits_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_deposits_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "s08_retroactive_version_differences"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "tenant_deposits_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "tenant_deposits_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "v_balance_reconciliation_drift"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "tenant_deposits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "tenant_deposits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_deposits_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_profiles: {
        Row: {
          archived_at: string | null
          company_id: string
          cr_number: string | null
          created_at: string
          nationality: string | null
          po_box: string | null
          postal_code: string | null
          status: string
          tenant_id: string
          tenant_type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          company_id: string
          cr_number?: string | null
          created_at?: string
          nationality?: string | null
          po_box?: string | null
          postal_code?: string | null
          status?: string
          tenant_id: string
          tenant_type?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          company_id?: string
          cr_number?: string | null
          created_at?: string
          nationality?: string | null
          po_box?: string | null
          postal_code?: string | null
          status?: string
          tenant_id?: string
          tenant_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tenant_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tenant_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          floor: string | null
          id: string
          name: string | null
          notes: string | null
          property_id: string
          rent_amount: number | null
          status: string
          unit_number: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          floor?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          property_id: string
          rent_amount?: number | null
          status?: string
          unit_number: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          floor?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          property_id?: string
          rent_amount?: number | null
          status?: string
          unit_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_grants: {
        Row: {
          company_id: string
          granted_at: string
          granted_by: string
          id: string
          permission: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          granted_at?: string
          granted_by: string
          id?: string
          permission: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          granted_at?: string
          granted_by?: string
          id?: string
          permission?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_grants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_grants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "user_permission_grants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          last_login: string | null
          name: string
          password_hash: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: Database["public"]["Enums"]["entity_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login?: string | null
          name: string
          password_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login?: string | null
          name?: string
          password_hash?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      utility_bills: {
        Row: {
          amount: number
          attachment_url: string | null
          billing_period_end: string | null
          billing_period_start: string | null
          charged_to: Database["public"]["Enums"]["charged_to_type"] | null
          company_id: string
          consumption_units: number | null
          contract_id: string | null
          created_at: string | null
          current_reading: number | null
          deleted_at: string | null
          due_date: string
          expense_id: string | null
          id: string
          invoice_id: string | null
          meter_id: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          previous_reading: number | null
          property_id: string
          reference: string | null
          reference_no: string | null
          status: Database["public"]["Enums"]["utility_status"] | null
          type: string
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          charged_to?: Database["public"]["Enums"]["charged_to_type"] | null
          company_id?: string
          consumption_units?: number | null
          contract_id?: string | null
          created_at?: string | null
          current_reading?: number | null
          deleted_at?: string | null
          due_date: string
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
          meter_id?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          previous_reading?: number | null
          property_id: string
          reference?: string | null
          reference_no?: string | null
          status?: Database["public"]["Enums"]["utility_status"] | null
          type: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          billing_period_end?: string | null
          billing_period_start?: string | null
          charged_to?: Database["public"]["Enums"]["charged_to_type"] | null
          company_id?: string
          consumption_units?: number | null
          contract_id?: string | null
          created_at?: string | null
          current_reading?: number | null
          deleted_at?: string | null
          due_date?: string
          expense_id?: string | null
          id?: string
          invoice_id?: string | null
          meter_id?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          previous_reading?: number | null
          property_id?: string
          reference?: string | null
          reference_no?: string | null
          status?: Database["public"]["Enums"]["utility_status"] | null
          type?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utility_bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "utility_bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "utility_bills_meter_id_fkey"
            columns: ["meter_id"]
            isOneToOne: false
            referencedRelation: "utility_meters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_bills_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "utility_bills_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_bills_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_meters: {
        Row: {
          account_number: string
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          meter_number: string
          notes: string | null
          property_id: string
          provider_name: string | null
          responsible_party: string
          unit_id: string | null
          updated_at: string
          utility_type: string
        }
        Insert: {
          account_number: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          meter_number: string
          notes?: string | null
          property_id: string
          provider_name?: string | null
          responsible_party?: string
          unit_id?: string | null
          updated_at?: string
          utility_type: string
        }
        Update: {
          account_number?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          meter_number?: string
          notes?: string | null
          property_id?: string
          provider_name?: string | null
          responsible_party?: string
          unit_id?: string | null
          updated_at?: string
          utility_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_meters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_meters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "utility_meters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "utility_meters_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "utility_meters_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_meters_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_documents: {
        Row: {
          category: string
          company_id: string
          created_at: string
          deleted_at: string | null
          document_type: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          metadata: Json
          mime_type: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          document_type?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          document_type?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vault_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "vault_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      wp05_correction_proposals: {
        Row: {
          account_no: string | null
          accounting_period_id: string | null
          as_of: string
          checker_user_id: string | null
          company_id: string
          created_at: string
          decided_at: string | null
          decision_note: string | null
          evidence: Json
          gl_balance: number
          id: string
          idempotency_key: string
          maker_user_id: string | null
          proposal_type: string
          reason_code: string
          reason_detail: string
          recommended_action: string
          reconciliation_class: string
          request_id: string
          s09_correction_id: string | null
          status: string
          subledger_balance: number
          updated_at: string
          variance_amount: number
        }
        Insert: {
          account_no?: string | null
          accounting_period_id?: string | null
          as_of: string
          checker_user_id?: string | null
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          evidence?: Json
          gl_balance: number
          id?: string
          idempotency_key: string
          maker_user_id?: string | null
          proposal_type: string
          reason_code: string
          reason_detail: string
          recommended_action: string
          reconciliation_class: string
          request_id: string
          s09_correction_id?: string | null
          status?: string
          subledger_balance: number
          updated_at?: string
          variance_amount: number
        }
        Update: {
          account_no?: string | null
          accounting_period_id?: string | null
          as_of?: string
          checker_user_id?: string | null
          company_id?: string
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          evidence?: Json
          gl_balance?: number
          id?: string
          idempotency_key?: string
          maker_user_id?: string | null
          proposal_type?: string
          reason_code?: string
          reason_detail?: string
          recommended_action?: string
          reconciliation_class?: string
          request_id?: string
          s09_correction_id?: string | null
          status?: string
          subledger_balance?: number
          updated_at?: string
          variance_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "wp05_correction_proposals_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wp05_correction_proposals_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["accounting_period_id"]
          },
          {
            foreignKeyName: "wp05_correction_proposals_accounting_period_id_fkey"
            columns: ["accounting_period_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["accounting_period_id"]
          },
          {
            foreignKeyName: "wp05_correction_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wp05_correction_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "wp05_correction_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "wp05_correction_proposals_s09_correction_id_fkey"
            columns: ["s09_correction_id"]
            isOneToOne: false
            referencedRelation: "s09_corrections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_property_ownership: {
        Row: {
          agreement_ends_on: string | null
          agreement_id: string | null
          agreement_starts_on: string | null
          agreement_type: string | null
          commission_type: string | null
          commission_value: number | null
          company_id: string | null
          is_primary: boolean | null
          owner_id: string | null
          owner_name: string | null
          ownership_ends_on: string | null
          ownership_percentage: number | null
          ownership_starts_on: string | null
          property_id: string | null
          property_owner_id: string | null
          property_title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "property_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          account_id: string | null
          amount: number | null
          batch_id: string | null
          company_id: string | null
          created_at: string | null
          date: string | null
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          no: string | null
          request_id: string | null
          source_id: string | null
          status: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "journal_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      party_directory: {
        Row: {
          active: boolean | null
          company_id: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          live: boolean | null
          national_id: string | null
          party_key: string | null
          phone: string | null
          role: string | null
          source_id: string | null
          source_table: string | null
        }
        Relationships: []
      }
      s08_analysis_scope: {
        Row: {
          accounting_period: string | null
          accounting_period_id: string | null
          company_id: string | null
          company_name: string | null
          currency_code: string | null
          currency_precision: number | null
          end_date: string | null
          period_status: string | null
          start_date: string | null
        }
        Relationships: []
      }
      s08_liability_balances_by_period: {
        Row: {
          account_type: string | null
          accounting_period: string | null
          accounting_period_id: string | null
          agreement_id: string | null
          company_id: string | null
          company_name: string | null
          difference: number | null
          end_date: string | null
          gl_account_id: string | null
          gl_account_name: string | null
          gl_account_no: string | null
          gl_balance: number | null
          owner_id: string | null
          property_id: string | null
          source_class: string | null
          start_date: string | null
          subledger_balance: number | null
        }
        Relationships: []
      }
      s08_master_lease_readiness: {
        Row: {
          asset_class: string | null
          commencement_date: string | null
          company_id: string | null
          company_name: string | null
          discount_rate: number | null
          lease_liability_amount: number | null
          lease_term_months: number | null
          master_lease_id: string | null
          property_id: string | null
          property_name: string | null
          readiness: string | null
          rou_asset_amount: number | null
          short_term_election: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "owner_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      s08_retroactive_version_differences: {
        Row: {
          agreement_id: string | null
          agreement_version: string | null
          classification: string | null
          company_id: string | null
          contract_id: string | null
          contract_number: string | null
          current_collection_role: string | null
          current_commission_rate: number | null
          current_commission_type: string | null
          current_operating_model: string | null
          snapshot_collection_role: string | null
          snapshot_commission_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_analysis_scope"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "s08_liability_balances_by_period"
            referencedColumns: ["company_id"]
          },
        ]
      }
      s08_subledger_gl_reconciliation: {
        Row: {
          accounting_period: string | null
          closing_balance: number | null
          company_id: string | null
          company_name: string | null
          difference: number | null
          earliest_source: string | null
          finding_classification: string | null
          gl_account_no: string | null
          gl_balance: number | null
          latest_source: string | null
          opening_balance: number | null
          period_movements: number | null
          source_count: number | null
          subledger: string | null
          subledger_balance: number | null
        }
        Relationships: []
      }
      v_balance_reconciliation: {
        Row: {
          contract_id: string | null
          invoice_paid_amount: number | null
          invoiced_amount: number | null
          outstanding_amount: number | null
          paid_vs_payment_drift: number | null
          posted_payment_amount: number | null
          property_id: string | null
          tenant_id: string | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_unit_property_fkey"
            columns: ["unit_id", "property_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "property_id"]
          },
        ]
      }
      v_balance_reconciliation_drift: {
        Row: {
          contract_id: string | null
          invoice_paid_amount: number | null
          invoiced_amount: number | null
          outstanding_amount: number | null
          paid_vs_payment_drift: number | null
          posted_payment_amount: number | null
          property_id: string | null
          tenant_id: string | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_unit_property_fkey"
            columns: ["unit_id", "property_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id", "property_id"]
          },
        ]
      }
      vw_active_owner_agreements: {
        Row: {
          agreement_type: string | null
          commission_type: string | null
          commission_value: number | null
          ends_on: string | null
          id: string | null
          owner_id: string | null
          property_id: string | null
          starts_on: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_agreements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "current_property_ownership"
            referencedColumns: ["property_id"]
          },
          {
            foreignKeyName: "owner_agreements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _owner_statement_expenses: {
        Args: { p_from: string; p_owner_id: string; p_to: string }
        Returns: {
          deduction: number
          details: string
          gross: number
          property_name: string
          sort_no: string
          tx_date: string
          tx_type: string
        }[]
      }
      _r3: { Args: { v: number }; Returns: number }
      _safe_date: { Args: { v: string }; Returns: string }
      activate_contract_with_agreement_snapshot_atomic: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      apply_deposit_claim_atomic: { Args: { p_payload: Json }; Returns: Json }
      approve_contract_atomic: {
        Args: { p_checker_signature: string; p_contract_id: string }
        Returns: Json
      }
      approve_deposit_application_claim_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      approve_fee_tax_treatment_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      approve_owner_funds_cutover_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      approve_owner_settlement_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      approve_owner_settlement_atomic_s02_base: {
        Args: { p_payload: Json }
        Returns: Json
      }
      approve_receipt_void_atomic: { Args: { payload: Json }; Returns: Json }
      approve_tax_profile_atomic: { Args: { p_payload: Json }; Returns: Json }
      archive_service_provider_atomic: {
        Args: { p_provider_id: string }
        Returns: Json
      }
      assert_owner_funds_event_cutover: {
        Args: {
          p_company_id: string
          p_current_batch_id?: string
          p_effective_date: string
        }
        Returns: undefined
      }
      assert_owner_settlement_links_backfillable: {
        Args: never
        Returns: undefined
      }
      assert_owner_settlement_totals_fresh: {
        Args: { p_settlement_id: string }
        Returns: undefined
      }
      authorize_ai_assistant_access: { Args: never; Returns: Json }
      backfill_business_document_references: { Args: never; Returns: undefined }
      backfill_owner_settlement_links: { Args: never; Returns: Json }
      background_job_payload_valid: {
        Args: { p_job_type: string; p_payload: Json }
        Returns: boolean
      }
      calculate_owner_net_payout: {
        Args: {
          p_owner_id: string
          p_period_end: string
          p_period_start: string
          p_property_id?: string
        }
        Returns: {
          breakdown: Json
          gross_collected: number
          net_payable: number
          office_fee: number
          owner_expenses: number
          tax_amount: number
        }[]
      }
      cancel_background_job_atomic: {
        Args: { p_idempotency_key: string; p_job_id: string; p_reason: string }
        Returns: Json
      }
      cancel_commission_atomic: { Args: { p_payload: Json }; Returns: Json }
      cancel_owner_settlement_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      check_unit_maintenance_block: {
        Args: { p_unit_id: string }
        Returns: Json
      }
      claim_background_jobs_atomic: {
        Args: { p_company_id: string; p_limit?: number; p_worker_id: string }
        Returns: Json
      }
      close_journal_batch: { Args: { p_batch_id: string }; Returns: Json }
      communication_event_channel_allowed: {
        Args: { p_channel: string; p_event: string }
        Returns: boolean
      }
      communication_event_requires_human_review: {
        Args: { p_channel: string; p_event: string }
        Returns: boolean
      }
      communication_template_key: {
        Args: { p_channel: string; p_event: string; p_locale: string }
        Returns: string
      }
      complete_company_onboarding_atomic: { Args: never; Returns: Json }
      complete_contract_inspection_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      compute_tax_amount: {
        Args: { p_net: number; p_rate: number }
        Returns: number
      }
      consume_ai_assistant_quota_atomic: {
        Args: { p_max_requests?: number; p_window_seconds?: number }
        Returns: Json
      }
      contract_evidence_actor_can_operate: { Args: never; Returns: boolean }
      contract_evidence_actor_can_verify: { Args: never; Returns: boolean }
      contract_evidence_assert_documents: {
        Args: {
          p_company: string
          p_contract: string
          p_document_ids: string[]
        }
        Returns: undefined
      }
      contract_inspection_validate_checklist: {
        Args: {
          p_checklist: Json
          p_require_complete: boolean
          p_template: Json
        }
        Returns: undefined
      }
      create_accounting_period: { Args: { p_payload: Json }; Returns: Json }
      create_commission_atomic: { Args: { p_payload: Json }; Returns: Json }
      create_contract_atomic: {
        Args: {
          p_agreement_id: string
          p_attachment_url: string
          p_billing_day?: number
          p_cancellation_reason: string
          p_end_date: string
          p_grace_days?: number
          p_notes: string
          p_payment_cycle: string
          p_payment_terms_id: string
          p_property_id: string
          p_rent_amount: number
          p_start_date: string
          p_status: string
          p_tenant_id: string
          p_unit_id: string
        }
        Returns: Json
      }
      create_deposit_application_claim_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_deposit_application_claim_with_inspection_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_deposit_atomic: { Args: { p_payload: Json }; Returns: Json }
      create_expense_with_journal_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_expense_with_journal_atomic_phase3a1a_impl: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_fee_tax_treatment_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_future_owner_agreement_version_atomic: {
        Args: { p_owner_agreement_id: string; p_terms: Json }
        Returns: Json
      }
      create_invoice_credit_atomic: { Args: { p_payload: Json }; Returns: Json }
      create_maintenance_atomic: {
        Args: {
          p_assigned_to?: string
          p_attachment_url?: string
          p_description?: string
          p_priority?: string
          p_property_id: string
          p_request_id?: string
          p_scheduled_date?: string
          p_service_provider_category_id?: string
          p_service_provider_id?: string
          p_technician_name?: string
          p_title?: string
          p_unit_id?: string
        }
        Returns: Json
      }
      create_owner_agreement_atomic: {
        Args: { payload: Json }
        Returns: {
          agreement_type: string
          commission_type: string
          commission_value: number
          company_id: string | null
          created_at: string
          current_version_id: string | null
          ends_on: string | null
          id: string
          notes: string | null
          owner_id: string
          property_id: string
          reference: string | null
          starts_on: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "owner_agreements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_owner_agreement_version_atomic: {
        Args: { p_owner_agreement_id: string; p_terms: Json }
        Returns: {
          collection_role: string
          commission_recognition_basis: string
          commission_type: string
          commission_value: number
          company_id: string
          created_at: string
          created_by: string | null
          deposit_beneficiary: string | null
          deposit_custodian: string | null
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          offset_allowed: boolean
          operating_model: string
          owner_agreement_id: string
          reserve_amount: number
          superseded_at: string | null
          version_no: number
        }
        SetofOptions: {
          from: "*"
          to: "owner_agreement_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_owner_agreement_with_version_atomic: {
        Args: { payload: Json }
        Returns: Json
      }
      create_owner_funds_cutover_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_owner_receivable_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_owner_settlement_draft_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_property_with_agreement: {
        Args: {
          p_address: string
          p_agreement_ends_on?: string
          p_agreement_starts_on: string
          p_agreement_type: string
          p_commission_type: string
          p_commission_value: number
          p_current_value?: number
          p_notes?: string
          p_owner_id: string
          p_owner_name?: string
          p_purchase_value?: number
          p_status?: string
          p_title: string
          p_type: string
        }
        Returns: Json
      }
      create_property_with_versioned_agreement_atomic: {
        Args: {
          p_address: string
          p_agreement_ends_on?: string
          p_agreement_starts_on: string
          p_agreement_type: string
          p_collection_role?: string
          p_commission_type: string
          p_commission_value: number
          p_current_value?: number
          p_notes?: string
          p_owner_id: string
          p_owner_name?: string
          p_purchase_value?: number
          p_status?: string
          p_title: string
          p_type: string
        }
        Returns: Json
      }
      create_support_request_atomic: {
        Args: {
          p_actual_behavior: string
          p_app_version: string
          p_category: string
          p_error_reference: string
          p_expected_behavior: string
          p_route: string
          p_urgency: string
        }
        Returns: Json
      }
      create_tax_profile_atomic: { Args: { p_payload: Json }; Returns: Json }
      current_app_role: { Args: never; Returns: string }
      current_company_id: { Args: never; Returns: string }
      current_user_can_delegate_app_permission: {
        Args: { p_permission: string }
        Returns: boolean
      }
      current_user_has_effective_app_permission: {
        Args: { p_permission: string }
        Returns: boolean
      }
      current_user_has_support_capability: {
        Args: { p_capability: string }
        Returns: boolean
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      decide_contract_registration_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      decide_permission_request: {
        Args: { p_decision: string; p_reason?: string; p_request_id: string }
        Returns: {
          company_id: string
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          id: string
          permission: string
          reason: string
          requester_user_id: string
          resource_route: string | null
          reviewer_user_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "permission_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deduct_deposit_atomic: { Args: { p_payload: Json }; Returns: Json }
      deduct_deposit_atomic_phase3a1a_impl: {
        Args: { p_payload: Json }
        Returns: Json
      }
      diagnose_owner_settlement_duplication: {
        Args: never
        Returns: {
          company_id: string
          detail: Json
          finding_type: string
          subject: string
        }[]
      }
      dispatch_due_background_schedules_atomic: {
        Args: { p_limit?: number; p_now?: string }
        Returns: Json
      }
      enqueue_automation_rule_job_atomic: {
        Args: { p_request_id: string; p_rule_id: string }
        Returns: Json
      }
      enqueue_background_job_internal: {
        Args: {
          p_available_at?: string
          p_company_id: string
          p_idempotency_key: string
          p_job_type: string
          p_payload: Json
          p_priority?: number
          p_requested_by?: string
          p_source_id: string
          p_source_type: string
        }
        Returns: Json
      }
      ensure_company_account: {
        Args: {
          p_account_name: string
          p_account_no: string
          p_company_id: string
        }
        Returns: string
      }
      ensure_company_chart_of_accounts: { Args: never; Returns: Json }
      execute_automation_rule: { Args: { p_rule_id: string }; Returns: Json }
      execute_automation_rule_internal: {
        Args: { p_rule_id: string }
        Returns: Json
      }
      execute_fixed_monthly_accruals_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      execute_receipt_void_internal: { Args: { payload: Json }; Returns: Json }
      find_payment_account_id: {
        Args: { account_role: string }
        Returns: string
      }
      fixed_monthly_daily_amount_omr: {
        Args: { p_economic_date: string; p_monthly_amount: number }
        Returns: number
      }
      format_document_reference: {
        Args: {
          p_company_id: string
          p_doc_type: string
          p_prefix: string
          p_sequence: number
          p_year: number
        }
        Returns: string
      }
      generate_invoices_from_active_contracts: { Args: never; Returns: number }
      get_admin_support_operations_snapshot: {
        Args: { p_query?: string }
        Returns: Json
      }
      get_background_job_status: { Args: { p_job_id: string }; Returns: Json }
      get_company_onboarding_state: { Args: never; Returns: Json }
      get_contract_evidence_state: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      gl_accrue_fixed_monthly_day: {
        Args: {
          p_actor_id?: string
          p_agreement_version_id: string
          p_company_id: string
          p_economic_date: string
        }
        Returns: Json
      }
      gl_create_journal_batch: { Args: { p_payload: Json }; Returns: Json }
      gl_diagnose_historical_financial_integrity: {
        Args: never
        Returns: {
          category: string
          company_id: string
          details: Json
          entity_id: string
          finding: string
        }[]
      }
      gl_ensure_initial_open_period: {
        Args: { p_anchor_date: string; p_company_id: string }
        Returns: string
      }
      gl_lines_fingerprint: { Args: { p_lines: Json }; Returns: string }
      gl_ml_create_initial_measurement: {
        Args: { p_payload: Json }
        Returns: Json
      }
      gl_ml_create_remeasurement: { Args: { p_payload: Json }; Returns: Json }
      gl_ml_insert_schedule_rows: {
        Args: {
          p_company_id: string
          p_effective_date: string
          p_initial_liability: number
          p_initial_rou: number
          p_measurement_id: string
          p_payments: Json
          p_periodic_rate: number
          p_periods_per_year: number
          p_short_term_exempt: boolean
        }
        Returns: number
      }
      gl_ml_measure_payments: {
        Args: {
          p_annual_discount_rate_bps: number
          p_payments: Json
          p_periods_per_year: number
        }
        Returns: Json
      }
      gl_ml_post_initial_recognition: {
        Args: { p_payload: Json }
        Returns: Json
      }
      gl_ml_post_period: { Args: { p_payload: Json }; Returns: Json }
      gl_ml_post_remeasurement: { Args: { p_payload: Json }; Returns: Json }
      gl_ml_post_sublease_receipt: { Args: { p_payload: Json }; Returns: Json }
      gl_ml_provision_supporting_accounts: {
        Args: { p_company_id: string }
        Returns: Json
      }
      gl_pm_accrue_fixed_monthly_fee: {
        Args: { p_payload: Json }
        Returns: Json
      }
      gl_pm_list_batches: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          batch_id: string
          description: string
          effective_date: string
          event_id: string
          posted_at: string
          source_id: string
          source_type: string
          status: string
        }[]
      }
      gl_pm_post_broker_commission_approval: {
        Args: { p_payload: Json }
        Returns: Json
      }
      gl_pm_post_broker_commission_payment: {
        Args: { p_payload: Json }
        Returns: Json
      }
      gl_pm_post_collection_office_is_creditor: {
        Args: { p_payload: Json }
        Returns: Json
      }
      gl_pm_post_collection_owner_is_creditor: {
        Args: { p_payload: Json }
        Returns: Json
      }
      gl_pm_post_deposit_application: {
        Args: { p_payload: Json }
        Returns: Json
      }
      gl_pm_post_deposit_receipt: { Args: { p_payload: Json }; Returns: Json }
      gl_pm_post_deposit_refund: { Args: { p_payload: Json }; Returns: Json }
      gl_pm_post_invoice_office_is_creditor: {
        Args: { p_payload: Json }
        Returns: Json
      }
      gl_pm_post_owner_expense: { Args: { p_payload: Json }; Returns: Json }
      gl_pm_post_owner_payment: { Args: { p_payload: Json }; Returns: Json }
      gl_pm_require_account: {
        Args: { p_account_no: string; p_company_id: string }
        Returns: string
      }
      gl_pm_round_omr: { Args: { p_amount: number }; Returns: number }
      gl_post_journal_batch: { Args: { p_batch_id: string }; Returns: Json }
      gl_reconcile_subledgers: {
        Args: { p_as_of_date?: string }
        Returns: {
          account_name: string
          account_no: string
          details: Json
          gl_balance: number
          is_reconciled: boolean
          mismatch: number
          subledger_balance: number
        }[]
      }
      gl_resolve_accounting_period: {
        Args: { p_company_id: string; p_effective_date: string }
        Returns: {
          period_id: string
          reason: string
        }[]
      }
      gl_reverse_fixed_monthly_accrual: {
        Args: {
          p_accrual_id: string
          p_actor_id?: string
          p_company_id: string
          p_reason: string
        }
        Returns: Json
      }
      gl_run_fixed_monthly_accruals: {
        Args: {
          p_actor_id?: string
          p_agreement_version_id?: string
          p_company_id: string
          p_date_from: string
          p_date_to: string
        }
        Returns: Json
      }
      gl_validate_and_normalize_lines: {
        Args: { p_company_id: string; p_lines: Json }
        Returns: Json
      }
      import_bank_statement_batch_atomic: {
        Args: { payload: Json }
        Returns: Json
      }
      is_accountant: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_manager: { Args: never; Returns: boolean }
      is_app_user: { Args: never; Returns: boolean }
      is_background_service_worker: { Args: never; Returns: boolean }
      is_company_member: {
        Args: { target_company_id: string; target_user_id: string }
        Returns: boolean
      }
      is_operations: { Args: never; Returns: boolean }
      is_viewer: { Args: never; Returns: boolean }
      list_accounting_periods: { Args: never; Returns: Json }
      list_background_job_companies_atomic: {
        Args: { p_limit?: number }
        Returns: Json
      }
      list_chart_of_accounts: { Args: never; Returns: Json }
      list_fixed_monthly_accruals: { Args: { p_payload?: Json }; Returns: Json }
      list_journal_batches: { Args: { p_payload?: Json }; Returns: Json }
      list_journal_lines: { Args: { p_batch_id: string }; Returns: Json }
      list_my_support_requests: { Args: never; Returns: Json }
      list_permission_requests_for_review: {
        Args: { p_status?: string }
        Returns: {
          created_at: string
          decided_at: string
          decision_reason: string
          grant_active: boolean
          id: string
          permission: string
          reason: string
          requester_email: string
          requester_name: string
          requester_user_id: string
          resource_route: string
          reviewer_user_id: string
          status: string
        }[]
      }
      mask_admin_support_email: { Args: { p_value: string }; Returns: string }
      mask_admin_support_name: { Args: { p_value: string }; Returns: string }
      next_document_reference: {
        Args: {
          p_company_id: string
          p_doc_type: string
          p_prefix: string
          p_year: number
        }
        Returns: string
      }
      offset_owner_receivable_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      owner_agreement_version_for_contract_internal: {
        Args: {
          p_company_id: string
          p_end: string
          p_owner_agreement_id: string
          p_start: string
        }
        Returns: {
          collection_role: string
          commission_recognition_basis: string
          commission_type: string
          commission_value: number
          company_id: string
          created_at: string
          created_by: string | null
          deposit_beneficiary: string | null
          deposit_custodian: string | null
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          offset_allowed: boolean
          operating_model: string
          owner_agreement_id: string
          reserve_amount: number
          superseded_at: string | null
          version_no: number
        }
        SetofOptions: {
          from: "*"
          to: "owner_agreement_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owner_settlement_reservable_expenses: {
        Args: {
          p_company_id: string
          p_owner_id: string
          p_period_end: string
          p_period_start: string
          p_property_id?: string
        }
        Returns: string[]
      }
      owner_settlement_reservable_payments: {
        Args: {
          p_company_id: string
          p_owner_id: string
          p_period_end: string
          p_period_start: string
          p_property_id?: string
        }
        Returns: string[]
      }
      pay_commission_atomic: { Args: { p_payload: Json }; Returns: Json }
      pay_owner_settlement_atomic: { Args: { p_payload: Json }; Returns: Json }
      pay_owner_settlement_atomic_s02_base: {
        Args: { p_payload: Json }
        Returns: Json
      }
      payment_receipt_identity_preflight: {
        Args: never
        Returns: {
          payment_id_receipt_id_mismatches: number
          payments_without_receipt_id: number
          receipts_with_multiple_payments: number
          receipts_without_payment: number
        }[]
      }
      post_journal_event: { Args: { p_payload: Json }; Returns: Json }
      post_receipt_atomic: { Args: { payload: Json }; Returns: Json }
      post_taxable_collection_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      prepare_communication_preview_atomic: {
        Args: {
          p_channel: string
          p_consent_confirmed?: boolean
          p_event_type: string
          p_human_reviewed?: boolean
          p_idempotency_key: string
          p_locale?: string
          p_recipient_user_id: string
          p_source_id: string
          p_source_type: string
        }
        Returns: Json
      }
      preview_bank_statement_batch_atomic: {
        Args: { payload: Json }
        Returns: Json
      }
      process_automation_rule_background_internal: {
        Args: { p_company_id: string; p_rule_id: string }
        Returns: Json
      }
      process_background_job_atomic: {
        Args: { p_job_id: string; p_worker_id: string }
        Returns: Json
      }
      process_bank_reconciliation_match_atomic: {
        Args: { payload: Json }
        Returns: {
          company_id: string
          id: string
          matched_amount: number
          matched_at: string
          matched_by: string | null
          matched_entity_id: string
          matched_entity_type: string
          notes: string | null
          statement_line_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bank_reconciliation_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      propose_user_access_change_atomic: {
        Args: {
          p_idempotency_key: string
          p_proposed_active: boolean
          p_proposed_role: string
          p_reason: string
          p_target_user_id: string
        }
        Returns: Json
      }
      provision_company_chart_of_accounts: {
        Args: { p_company_id: string }
        Returns: Json
      }
      rc1_owner_agency_vat_payable_balance: {
        Args: { p_as_of?: string; p_company_id: string }
        Returns: {
          balance: number
          cnt: number
        }[]
      }
      recalculate_all_balances: { Args: never; Returns: undefined }
      recalculate_invoice_status: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      recalculate_owner_balance: {
        Args: { p_owner_id: string }
        Returns: undefined
      }
      recalculate_unit_statuses: { Args: never; Returns: number }
      record_invoice_payment_atomic: { Args: { payload: Json }; Returns: Json }
      record_invoice_payment_atomic_engine: {
        Args: { payload: Json }
        Returns: Json
      }
      recover_owner_receivable_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      refresh_property_owner_projection: {
        Args: { p_property_id: string }
        Returns: undefined
      }
      refund_deposit_atomic: { Args: { p_payload: Json }; Returns: Json }
      refund_deposit_atomic_phase3a1a_impl: {
        Args: { p_payload: Json }
        Returns: Json
      }
      refund_deposit_governed_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      reject_contract_atomic: {
        Args: {
          p_checker_signature: string
          p_contract_id: string
          p_reason: string
        }
        Returns: Json
      }
      reject_deposit_application_claim_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      renew_contract_atomic: {
        Args: { new_contract_data: Json; old_contract_id: string }
        Returns: Json
      }
      request_permission: {
        Args: {
          p_permission: string
          p_reason?: string
          p_resource_route?: string
        }
        Returns: {
          company_id: string
          created_at: string
          decided_at: string | null
          decision_reason: string | null
          id: string
          permission: string
          reason: string
          requester_user_id: string
          resource_route: string | null
          reviewer_user_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "permission_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_receipt_void_atomic: { Args: { payload: Json }; Returns: Json }
      require_company_account_id: {
        Args: { p_account_no: string; p_company_id: string }
        Returns: string
      }
      require_company_id: { Args: never; Returns: string }
      reserve_ai_assistant_budget_atomic: {
        Args: {
          p_company_daily_budget_microusd?: number
          p_request_id: string
          p_reserved_microusd?: number
          p_user_daily_request_limit?: number
        }
        Returns: Json
      }
      reset_company_onboarding_atomic: { Args: never; Returns: Json }
      resolve_active_fee_tax_treatment: {
        Args: {
          p_company_id: string
          p_effective_date: string
          p_fee_kind: string
        }
        Returns: {
          effective_from: string
          effective_to: string
          tax_code: string
          tax_profile_id: string
          tax_rate: number
          treatment_id: string
        }[]
      }
      resolve_active_tax_profile: {
        Args: { p_company_id: string; p_effective_date: string }
        Returns: {
          effective_from: string
          effective_to: string
          profile_id: string
          tax_code: string
          tax_rate: number
        }[]
      }
      resolve_maintenance_with_expense: {
        Args: { p_cost: number; p_notes?: string; p_request_id: string }
        Returns: Json
      }
      resolve_unit_operational_status: {
        Args: { p_fallback_status?: string; p_unit_id: string }
        Returns: string
      }
      retry_automation_run: { Args: { p_run_id: string }; Returns: Json }
      reverse_commission_atomic: { Args: { p_payload: Json }; Returns: Json }
      reverse_deposit_claim_atomic: { Args: { p_payload: Json }; Returns: Json }
      reverse_deposit_refund_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      reverse_fixed_monthly_accrual_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      reverse_invoice_credit_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      reverse_journal_batch: { Args: { p_batch_id: string }; Returns: Json }
      reverse_owner_receivable_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      reverse_owner_receivable_offset_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      reverse_owner_receivable_recovery_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      review_contract_inspection_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      revoke_onboarding_waiver_atomic: {
        Args: { p_code: string }
        Returns: Json
      }
      revoke_permission_grant: {
        Args: { p_permission: string; p_reason: string; p_user_id: string }
        Returns: Json
      }
      role_has_app_permission: {
        Args: { p_permission: string; p_role: string }
        Returns: boolean
      }
      rpt_aged_receivables: { Args: { p_as_of: string }; Returns: Json }
      rpt_balance_sheet: { Args: { p_as_of: string }; Returns: Json }
      rpt_cash_flow: {
        Args: { p_from_date: string; p_to_date: string }
        Returns: Json
      }
      rpt_daily_collection: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      rpt_dashboard_overview: {
        Args: { p_as_of?: string; p_from: string; p_to: string }
        Returns: Json
      }
      rpt_dashboard_snapshot: {
        Args: { p_as_of?: string; p_from: string; p_to: string }
        Returns: Json
      }
      rpt_financial_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          active_contracts: number
          collected: number
          expenses: number
          net: number
          net_income: number
          occupancy_rate: number
          occupied_units: number
          overdue_amount: number
          overdue_count: number
          pending_invoices: number
          period_from: string
          period_to: string
          revenue: number
          total_units: number
        }[]
      }
      rpt_general_ledger: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      rpt_income_statement: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      rpt_overdue_invoices: { Args: { p_as_of?: string }; Returns: Json }
      rpt_owner_financial_position: {
        Args: { p_from: string; p_owner_id: string; p_to: string }
        Returns: Json
      }
      rpt_owner_statement: {
        Args: { p_from: string; p_owner_id: string; p_to: string }
        Returns: Json
      }
      rpt_rc1_owner_agency_invoice_mapping_diagnostics: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          affected_reason: string
          collection_role: string
          company_id: string
          contract_id: string
          invoice_accounting_classification: string
          invoice_id: string
          issue_date: string
          source_account_numbers: string[]
          source_batch_id: string
          source_type: string
        }[]
      }
      rpt_rent_roll: { Args: { p_as_of?: string }; Returns: Json }
      rpt_tenant_statement: { Args: { p_contract_id: string }; Returns: Json }
      rpt_trial_balance: { Args: { p_as_of: string }; Returns: Json }
      rpt_vat_return: {
        Args: { p_from_date: string; p_to_date: string }
        Returns: Json
      }
      run_scheduled_automation_rules: { Args: never; Returns: Json }
      s08_analyze_deposit_exceptions: {
        Args: { p_company_id: string; p_period_id: string }
        Returns: {
          amount: number
          available_balance: number
          beneficiary: string
          claim_reference: string
          company_id: string
          contract_id: string
          deposit_id: string
          exception_code: string
          explanation: string
          period: string
          property_id: string
          severity: string
          tenant_id: string
          transaction_id: string
        }[]
      }
      s08_analyze_expense_misclassification: {
        Args: { p_company_id: string; p_period_id: string }
        Returns: {
          account_name: string
          account_no: string
          amount: number
          beneficiary: string
          charged_to: string
          company_id: string
          expense_id: string
          explanation: string
          finding_code: string
          period: string
          severity: string
        }[]
      }
      s08_analyze_frozen_review: {
        Args: {
          p_analysis_results?: Json
          p_exceptions?: Json
          p_reconciliation_evidence?: Json
          p_review_id: string
        }
        Returns: Json
      }
      s08_analyze_settlement_duplicates: {
        Args: { p_company_id: string; p_period_id: string }
        Returns: {
          accounting_period: string
          agreement_id: string
          company_id: string
          company_name: string
          currency: string
          explanation: string
          finding_code: string
          owner_id: string
          owner_name: string
          property_id: string
          property_name: string
          settlement_id: string
          settlement_status: string
          severity: string
          source_amount: number
          source_date: string
          source_id: string
          source_type: string
        }[]
      }
      s08_approve_frozen_review: {
        Args: { p_notes?: string; p_review_id: string }
        Returns: Json
      }
      s08_compute_dataset_fingerprint: {
        Args: { p_company_id: string; p_period_id: string }
        Returns: string
      }
      s08_create_frozen_review: { Args: { p_payload: Json }; Returns: Json }
      s08_list_frozen_reviews: { Args: { p_period_id?: string }; Returns: Json }
      s08_orphan_postings: {
        Args: { p_company_id: string; p_period_id: string }
        Returns: {
          batch_id: string
          company_id: string
          explanation: string
          finding_code: string
          severity: string
          source_id: string
          source_type: string
          status: string
        }[]
      }
      s08_reject_frozen_review: {
        Args: { p_reason?: string; p_review_id: string }
        Returns: Json
      }
      s08_round_egp: { Args: { p_amount: number }; Returns: number }
      s08_round_omr: { Args: { p_amount: number }; Returns: number }
      s08_verify_fingerprint: { Args: { p_review_id: string }; Returns: Json }
      s09_apply_correction: { Args: { p_correction_id: string }; Returns: Json }
      s09_create_correction_draft: { Args: { p_payload: Json }; Returns: Json }
      s09_list_corrections: {
        Args: { p_period_id?: string; p_status?: string }
        Returns: Json
      }
      s09_reverse_correction: {
        Args: { p_correction_id: string; p_reason: string }
        Returns: Json
      }
      s09_validate_correction: {
        Args: { p_correction_id: string }
        Returns: Json
      }
      s09_validate_correction_invariants: {
        Args: { p_correction_id: string }
        Returns: Json
      }
      save_contract_inspection_draft_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      save_service_provider_atomic: {
        Args: {
          p_category_ids?: string[]
          p_payload: Json
          p_provider_id: string
        }
        Returns: Json
      }
      set_my_communication_preference_atomic: {
        Args: {
          p_channel: string
          p_enabled: boolean
          p_event_type: string
          p_locale?: string
          p_quiet_hours_end?: number
          p_quiet_hours_start?: number
        }
        Returns: Json
      }
      set_sole_admin_self_approval_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      soft_delete_contract_atomic: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      submit_contract_for_approval_atomic: {
        Args: { p_contract_id: string; p_maker_signature: string }
        Returns: Json
      }
      submit_contract_registration_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      support_text_is_safe: { Args: { p_text: string }; Returns: boolean }
      terminate_contract_atomic: {
        Args: { p_contract_id: string; p_reason: string }
        Returns: Json
      }
      transition_maintenance_status_atomic: {
        Args: { p_next_status: string; p_reason?: string; p_request_id: string }
        Returns: Json
      }
      triage_support_request_atomic: {
        Args: {
          p_idempotency_key: string
          p_public_note: string
          p_reason: string
          p_request_id: string
          p_status: string
        }
        Returns: Json
      }
      update_accounting_period_status: {
        Args: { p_payload: Json }
        Returns: Json
      }
      update_commission_atomic: { Args: { p_payload: Json }; Returns: Json }
      update_contract_atomic: {
        Args: {
          p_agreement_id: string
          p_attachment_url: string
          p_cancellation_reason: string
          p_contract_id: string
          p_end_date: string
          p_notes: string
          p_payment_cycle: string
          p_payment_terms_id: string
          p_property_id: string
          p_rent_amount: number
          p_start_date: string
          p_status: string
          p_tenant_id: string
          p_unit_id: string
        }
        Returns: Json
      }
      update_contract_billing_policy_atomic: {
        Args: {
          p_billing_day: number
          p_contract_id: string
          p_grace_days: number
        }
        Returns: Json
      }
      update_expense_with_journal_atomic: {
        Args: { p_payload: Json }
        Returns: Json
      }
      update_expense_with_journal_atomic_phase3a1a_impl: {
        Args: { p_payload: Json }
        Returns: Json
      }
      update_owner_agreement_atomic: {
        Args: { p_agreement_id: string; payload: Json }
        Returns: {
          agreement_type: string
          commission_type: string
          commission_value: number
          company_id: string | null
          created_at: string
          current_version_id: string | null
          ends_on: string | null
          id: string
          notes: string | null
          owner_id: string
          property_id: string
          reference: string | null
          starts_on: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "owner_agreements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_support_request_status_atomic: {
        Args: { p_public_note?: string; p_request_id: string; p_status: string }
        Returns: Json
      }
      void_receipt_atomic:
        | {
            Args: {
              p_invoice_updates?: Json
              p_receipt_id: string
              p_reverse_entries?: Json
              p_voided_at?: string
            }
            Returns: Json
          }
        | { Args: { payload: Json }; Returns: Json }
      waive_onboarding_requirement_atomic: {
        Args: {
          p_code: string
          p_evidence_reference?: string
          p_reason: string
        }
        Returns: Json
      }
      wp01_is_sole_admin_allowed: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      wp02_gap008_round_omr: { Args: { p_amount: number }; Returns: number }
      wp05_approve_correction_proposal: {
        Args: { p_note?: string; p_proposal_id: string }
        Returns: Json
      }
      wp05_assert_cash_flow: {
        Args: { p_allow_unclassified?: boolean; p_from: string; p_to: string }
        Returns: Json
      }
      wp05_assert_no_unapproved_correction_postings: {
        Args: { p_company_id?: string }
        Returns: Json
      }
      wp05_assert_reconciliation: {
        Args: { p_as_of?: string; p_company_id?: string }
        Returns: Json
      }
      wp05_cash_accounts: { Args: never; Returns: string[] }
      wp05_cash_flow_drillthrough: {
        Args: { p_classification?: string; p_from: string; p_to: string }
        Returns: {
          account_id: string
          account_name: string
          account_no: string
          amount: number
          batch_id: string
          classification: string
          credit: number
          debit: number
          effective_date: string
          event_id: string
          line_description: string
          posted_at: string
          ref_entity_id: string
          ref_entity_type: string
          ref_source_id: string
          source_id: string
          source_type: string
        }[]
      }
      wp05_generate_correction_proposals: {
        Args: {
          p_accounting_period_id?: string
          p_as_of?: string
          p_request_id?: string
        }
        Returns: Json
      }
      wp05_gl_balance: {
        Args: { p_account_no: string; p_as_of?: string; p_company_id: string }
        Returns: number
      }
      wp05_gl_drillthrough: {
        Args: { p_account_no?: string; p_from: string; p_to: string }
        Returns: {
          account_name: string
          account_no: string
          batch_id: string
          credit: number
          debit: number
          effective_date: string
          event_id: string
          line_description: string
          posted_at: string
          ref_entity_id: string
          ref_entity_type: string
          ref_source_id: string
          source_id: string
          source_type: string
          status: string
        }[]
      }
      wp05_gl_line_count: {
        Args: { p_account_no: string; p_as_of?: string; p_company_id: string }
        Returns: number
      }
      wp05_gl_side_totals: {
        Args: { p_account_no: string; p_as_of?: string; p_company_id: string }
        Returns: {
          account_exists: boolean
          credits: number
          debits: number
          line_count: number
        }[]
      }
      wp05_list_correction_proposals: {
        Args: { p_as_of?: string; p_status?: string }
        Returns: Json
      }
      wp05_provision_default_cashflow_classifications: {
        Args: { p_company_id: string }
        Returns: Json
      }
      wp05_reconcile_all: {
        Args: { p_as_of?: string; p_company_id?: string }
        Returns: {
          abs_variance: number
          account_name: string
          account_no: string
          currency: string
          gl_balance: number
          gl_count: number
          reconciliation_class: string
          reconciliation_status: string
          subledger_balance: number
          subledger_count: number
          variance: number
        }[]
      }
      wp05_reject_correction_proposal: {
        Args: { p_proposal_id: string; p_reason: string }
        Returns: Json
      }
      wp05_round_omr: { Args: { p_amount: number }; Returns: number }
      wp05_rpt_balance_sheet_gl: { Args: { p_as_of: string }; Returns: Json }
      wp05_rpt_cash_flow_gl: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      wp05_rpt_general_ledger_gl: {
        Args: { p_account_no?: string; p_from: string; p_to: string }
        Returns: Json
      }
      wp05_rpt_profit_loss_gl: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      wp05_rpt_trial_balance_gl: { Args: { p_as_of: string }; Returns: Json }
      wp05_subledger_commission: {
        Args: { p_as_of?: string; p_company_id: string }
        Returns: {
          balance: number
          cnt: number
        }[]
      }
      wp05_subledger_due_from_owner: {
        Args: { p_as_of?: string; p_company_id: string }
        Returns: {
          balance: number
          cnt: number
        }[]
      }
      wp05_subledger_owner_payables: {
        Args: { p_as_of?: string; p_company_id: string }
        Returns: {
          balance: number
          cnt: number
        }[]
      }
      wp05_subledger_security_deposits: {
        Args: { p_as_of?: string; p_company_id: string }
        Returns: {
          balance: number
          cnt: number
        }[]
      }
      wp05_subledger_tenant_receivables: {
        Args: { p_as_of?: string; p_company_id: string }
        Returns: {
          balance: number
          cnt: number
        }[]
      }
      wp05_variance_diagnostics: {
        Args: { p_as_of?: string; p_company_id?: string }
        Returns: {
          abs_variance: number
          account_name: string
          account_no: string
          currency: string
          evidence: Json
          gl_balance: number
          proposal_type: string
          reason_code: string
          reason_detail: string
          recommended_action: string
          reconciliation_class: string
          reconciliation_status: string
          subledger_balance: number
          variance: number
        }[]
      }
    }
    Enums: {
      charged_to_type: "OWNER" | "TENANT" | "COMPANY"
      entity_status: "ACTIVE" | "INACTIVE" | "BLACKLISTED"
      user_role:
        | "ADMIN"
        | "MANAGER"
        | "USER"
        | "ACCOUNTANT"
        | "OPERATIONS"
        | "VIEWER"
      utility_status: "UNPAID" | "PAID" | "OVERDUE"
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
      charged_to_type: ["OWNER", "TENANT", "COMPANY"],
      entity_status: ["ACTIVE", "INACTIVE", "BLACKLISTED"],
      user_role: [
        "ADMIN",
        "MANAGER",
        "USER",
        "ACCOUNTANT",
        "OPERATIONS",
        "VIEWER",
      ],
      utility_status: ["UNPAID", "PAID", "OVERDUE"],
    },
  },
} as const
