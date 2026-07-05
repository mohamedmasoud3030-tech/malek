export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          id: string;
          account_name: string;
          account_code: string | null;
          currency: string;
          opening_balance: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['bank_accounts']['Row']> & Pick<Database['public']['Tables']['bank_accounts']['Row'], 'account_name'>;
        Update: Partial<Database['public']['Tables']['bank_accounts']['Row']>;
        Relationships: [];
      };
      bank_statement_imports: {
        Row: {
          id: string;
          bank_account_id: string;
          statement_name: string;
          statement_from: string | null;
          statement_to: string | null;
          imported_at: string;
          created_by: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['bank_statement_imports']['Row']> & Pick<Database['public']['Tables']['bank_statement_imports']['Row'], 'bank_account_id' | 'statement_name'>;
        Update: Partial<Database['public']['Tables']['bank_statement_imports']['Row']>;
        Relationships: [];
      };
      bank_statement_lines: {
        Row: {
          id: string;
          import_id: string | null;
          bank_account_id: string;
          transaction_date: string;
          description: string;
          reference: string | null;
          amount: number;
          status: 'unmatched' | 'matched' | 'ignored';
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['bank_statement_lines']['Row']> & Pick<Database['public']['Tables']['bank_statement_lines']['Row'], 'bank_account_id' | 'transaction_date' | 'amount'>;
        Update: Partial<Database['public']['Tables']['bank_statement_lines']['Row']>;
        Relationships: [];
      };
      bank_reconciliation_matches: {
        Row: {
          id: string;
          statement_line_id: string;
          matched_entity_type: 'payment' | 'receipt' | 'expense' | 'manual_adjustment';
          matched_entity_id: string;
          matched_amount: number;
          notes: string | null;
          matched_at: string;
          matched_by: string | null;
        };
        Insert: Partial<Database['public']['Tables']['bank_reconciliation_matches']['Row']> & Pick<Database['public']['Tables']['bank_reconciliation_matches']['Row'], 'statement_line_id' | 'matched_entity_type' | 'matched_entity_id' | 'matched_amount'>;
        Update: Partial<Database['public']['Tables']['bank_reconciliation_matches']['Row']>;
        Relationships: [];
      };
      company_settings: {
        Row: {
          id: string;
          singleton_key: boolean;
          company_name: string;
          legal_name: string | null;
          tax_number: string | null;
          registration_number: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          country: string | null;
          currency: string;
          locale: string;
          timezone: string;
          date_format: string;
          number_format: string;
          logo_url: string | null;
          invoice_prefix: string;
          contract_prefix: string;
          receipt_prefix: string;
          default_vat_rate: number;
          vat_enabled: boolean | null;
          vat_rate: number | null;
          vat_registration_number: string | null;
          notification_email_enabled: boolean;
          notification_sms_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['company_settings']['Row']>;
        Update: Partial<Database['public']['Tables']['company_settings']['Row']>;
        Relationships: [];
      };
      owners: {
        Row: {
          id: string;
          full_name: string;
          display_name: string | null;
          phone: string | null;
          email: string | null;
          national_id: string | null;
          tax_number: string | null;
          address: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['owners']['Row']> & Pick<Database['public']['Tables']['owners']['Row'], 'full_name'>;
        Update: Partial<Database['public']['Tables']['owners']['Row']>;
        Relationships: [];
      };
      owner_agreements: {
        Row: {
          id: string;
          owner_id: string;
          property_id: string;
          agreement_type: 'property_management' | 'master_lease';
          commission_type: 'FIXED_MONTHLY' | 'RATE';
          commission_value: number;
          starts_on: string;
          ends_on: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          property_id: string;
          agreement_type: 'property_management' | 'master_lease';
          commission_type: 'FIXED_MONTHLY' | 'RATE';
          commission_value: number;
          starts_on: string;
          ends_on?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['owner_agreements']['Insert']>;
        Relationships: [
          {
            foreignKeyName: 'owner_agreements_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'owner_agreements_property_id_fkey';
            columns: ['property_id'];
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
        ];
      };
      property_owners: {
        Row: {
          id: string;
          property_id: string;
          owner_id: string;
          ownership_percentage: number;
          is_primary: boolean;
          starts_on: string | null;
          ends_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['property_owners']['Row']> & Pick<Database['public']['Tables']['property_owners']['Row'], 'property_id' | 'owner_id'>;
        Update: Partial<Database['public']['Tables']['property_owners']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'property_owners_property_id_fkey';
            columns: ['property_id'];
            referencedRelation: 'properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'property_owners_owner_id_fkey';
            columns: ['owner_id'];
            referencedRelation: 'owners';
            referencedColumns: ['id'];
          },
        ];
      };
      lands: {
        Row: {
          id: string;
          plot_no: string | null;
          name: string | null;
          location: string | null;
          area: number | null;
          owner_id: string | null;
          purchase_price: number | null;
          owner_price: number | null;
          commission: number | null;
          category: string;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['lands']['Row']>;
        Update: Partial<Database['public']['Tables']['lands']['Row']>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          source: string;
          status: string;
          desired_unit_type: string | null;
          min_budget: number | null;
          max_budget: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['leads']['Row']> & Pick<Database['public']['Tables']['leads']['Row'], 'name'>;
        Update: Partial<Database['public']['Tables']['leads']['Row']>;
        Relationships: [];
      };
      commissions: {
        Row: {
          id: string;
          staff_name: string;
          type: string;
          status: string;
          source_id: string | null;
          deal_value: number | null;
          percentage: number | null;
          amount: number | null;
          paid_at: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['commissions']['Row']> & Pick<Database['public']['Tables']['commissions']['Row'], 'staff_name'>;
        Update: Partial<Database['public']['Tables']['commissions']['Row']>;
        Relationships: [];
      };
      communication_records: {
        Row: {
          id: string;
          contact_name: string;
          contact_phone: string | null;
          contact_email: string | null;
          channel: string;
          direction: string;
          status: string;
          subject: string | null;
          body: string;
          related_entity_type: string | null;
          related_entity_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['communication_records']['Row']> & Pick<Database['public']['Tables']['communication_records']['Row'], 'contact_name' | 'body'>;
        Update: Partial<Database['public']['Tables']['communication_records']['Row']>;
        Relationships: [];
      };
      contract_documents: {
        Row: {
          id: string;
          contract_id: string;
          file_name: string;
          file_url: string;
          storage_path: string;
          file_size: number | null;
          mime_type: string | null;
          uploaded_by: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['contract_documents']['Row']> & Pick<Database['public']['Tables']['contract_documents']['Row'], 'contract_id' | 'file_name' | 'file_url' | 'storage_path'>;
        Update: Partial<Database['public']['Tables']['contract_documents']['Row']>;
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          title: string;
          type: string;
          address: string;
          owner_name: string | null;
          purchase_value: number | null;
          current_value: number | null;
          status: 'active' | 'inactive' | 'maintenance' | 'sold';
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['properties']['Row']> & Pick<Database['public']['Tables']['properties']['Row'], 'title' | 'type' | 'address'>;
        Update: Partial<Database['public']['Tables']['properties']['Row']>;
        Relationships: [];
      };
      units: {
        Row: {
          id: string;
          name: string | null;
          property_id: string;
          unit_number: string;
          floor: string | null;
          status: 'available' | 'occupied' | 'maintenance' | 'reserved';
          rent_amount: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['units']['Row']> & Pick<Database['public']['Tables']['units']['Row'], 'property_id' | 'unit_number'>;
        Update: Partial<Database['public']['Tables']['units']['Row']>;
        Relationships: [];
      };
      people: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          email: string | null;
          national_id: string | null;
          type: 'tenant' | 'owner' | 'contact';
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['people']['Row']> & Pick<Database['public']['Tables']['people']['Row'], 'full_name' | 'type'>;
        Update: Partial<Database['public']['Tables']['people']['Row']>;
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          property_id: string;
          unit_id: string | null;
          tenant_id: string;
          start_date: string;
          end_date: string;
          rent_amount: number;
          payment_cycle: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
          payment_terms_id: string | null;
          status: 'draft' | 'active' | 'expired' | 'terminated';
          cancellation_reason: string | null;
          renewed_from_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          attachment_url: string | null;
          agreement_id: string | null;
        };
        Insert: Partial<Database['public']['Tables']['contracts']['Row']> & Pick<Database['public']['Tables']['contracts']['Row'], 'property_id' | 'tenant_id' | 'start_date' | 'end_date' | 'rent_amount'>;
        Update: Partial<Database['public']['Tables']['contracts']['Row']>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          contract_id: string;
          issue_date: string;
          due_date: string;
          amount: number;
          paid_amount: number;
          tax_rate: number | null;
          tax_amount: number | null;
          status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID' | 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'void' | string;
          notes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['invoices']['Row']> & Pick<Database['public']['Tables']['invoices']['Row'], 'contract_id' | 'issue_date' | 'due_date' | 'amount'>;
        Update: Partial<Database['public']['Tables']['invoices']['Row']>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string | null;
          amount: number;
          payment_method: 'cash' | 'bank_transfer' | 'card' | 'check' | 'other' | string;
          payment_date: string;
          reference_number: string | null;
          reference_no: string | null;
          contract_id: string | null;
          date_time: string | null;
          channel: string | null;
          status: string | null;
          notes: string | null;
          receipt_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['payments']['Row']> & Pick<Database['public']['Tables']['payments']['Row'], 'amount' | 'payment_method' | 'payment_date'>;
        Update: Partial<Database['public']['Tables']['payments']['Row']>;
        Relationships: [];
      };

      receipts: {
        Row: {
          id: string;
          no: string | null;
          contract_id: string | null;
          date_time: string;
          channel: string | null;
          amount: number;
          ref: string | null;
          notes: string | null;
          status: string | null;
          check_number: string | null;
          check_bank: string | null;
          check_date: string | null;
          check_status: string | null;
          voided_at: string | null;
          request_id: string | null;
          tenant_id: string | null;
          payment_id: string | null;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['receipts']['Row']> & Pick<Database['public']['Tables']['receipts']['Row'], 'contract_id' | 'date_time' | 'amount'>;
        Update: Partial<Database['public']['Tables']['receipts']['Row']>;
        Relationships: [];
      };

      receipt_allocations: {
        Row: {
          id: string;
          receipt_id: string;
          invoice_id: string | null;
          amount: number;
          tenant_id: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['receipt_allocations']['Row']> & Pick<Database['public']['Tables']['receipt_allocations']['Row'], 'receipt_id' | 'amount'>;
        Update: Partial<Database['public']['Tables']['receipt_allocations']['Row']>;
        Relationships: [];
      };

      maintenance_records: {
        Row: {
          id: string;
          no: string | null;
          property_id: string | null;
          unit_id: string | null;
          title: string | null;
          description: string | null;
          priority: 'low' | 'medium' | 'high' | 'urgent' | 'NORMAL' | string | null;
          status: 'open' | 'in_progress' | 'resolved' | 'closed' | string | null;
          assigned_to: string | null;
          cost: number | null;
          charged_to: string | null;
          notes: string | null;
          request_date: string | null;
          scheduled_date: string | null;
          work_description: string | null;
          technician_name: string | null;
          response_time_hours: number | null;
          expense_id: string | null;
          invoice_id: string | null;
          reported_by: string | null;
          completed_at: number | null;
          resolved_at: string | null;
          created_at: string | null;
          updated_at: string | null;
          attachment_url: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['maintenance_records']['Row']> & Pick<Database['public']['Tables']['maintenance_records']['Row'], 'status'>;
        Update: Partial<Database['public']['Tables']['maintenance_records']['Row']>;
        Relationships: [];
      };

      expenses: {
        Row: {
          id: string;
          property_id: string;
          category: string;
          amount: number;
          expense_date: string;
          cost_center_id: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          attachment_url: string | null;
        };
        Insert: Partial<Database['public']['Tables']['expenses']['Row']> & Pick<Database['public']['Tables']['expenses']['Row'], 'property_id' | 'category' | 'amount' | 'expense_date'>;
        Update: Partial<Database['public']['Tables']['expenses']['Row']>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          ts: number | null;
          user_id: string | null;
          username: string | null;
          action: string | null;
          entity: string | null;
          entity_id: string | null;
          note: string | null;
          table: string | null;
          details: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: { id: string; ts?: number | null; user_id?: string | null; username?: string | null; action?: string | null; entity?: string | null; entity_id?: string | null; note?: string | null; table?: string | null; details?: string | null; created_at?: string | null; updated_at?: string | null };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
        Relationships: [];
      };
      financial_operation_idempotency: {
        Row: {
          operation_name: string;
          request_id: string;
          response_payload: Json;
          created_at: string;
        };
        Insert: { operation_name: string; request_id: string; response_payload: Json; created_at?: string };
        Update: Partial<Database['public']['Tables']['financial_operation_idempotency']['Insert']>;
        Relationships: [];
      };
      cost_centers: {
        Row: {
          id: string;
          name: string;
          property_id: string | null;
          parent_id: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['cost_centers']['Row']> & Pick<Database['public']['Tables']['cost_centers']['Row'], 'name'>;
        Update: Partial<Database['public']['Tables']['cost_centers']['Row']>;
        Relationships: [];
      };
      payment_terms_templates: {
        Row: {
          id: string;
          name: string;
          installments: number | null;
          interval_type: 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'custom' | string | null;
          notes: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['payment_terms_templates']['Row']> & Pick<Database['public']['Tables']['payment_terms_templates']['Row'], 'name'>;
        Update: Partial<Database['public']['Tables']['payment_terms_templates']['Row']>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'ADMIN' | 'MANAGER' | 'USER' | null;
          status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED' | null;
          full_name: string | null;
          is_active: boolean;
          password_hash: string | null;
          last_login: string | null;
          deleted_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: { id: string; email: string; name: string; role?: 'ADMIN' | 'MANAGER' | 'USER' | null; status?: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED' | null; full_name?: string | null; is_active?: boolean; password_hash?: string | null; last_login?: string | null; deleted_at?: string | null; created_at?: string | null; updated_at?: string | null };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_property_with_agreement: {
        Args: {
          p_title: string;
          p_type: string;
          p_address: string;
          p_owner_id: string;
          p_agreement_type: string;
          p_commission_type: string;
          p_commission_value: number;
          p_agreement_starts_on: string;
          p_agreement_ends_on: string | null;
          p_owner_name: string | null;
          p_purchase_value: number | null;
          p_current_value: number | null;
          p_status: string;
          p_notes: string | null;
        };
        Returns: { property_id: string; agreement_id: string };
      };
      create_contract_atomic: {
        Args: {
          p_property_id: string;
          p_unit_id: string | null;
          p_tenant_id: string;
          p_agreement_id: string | null;
          p_start_date: string;
          p_end_date: string;
          p_rent_amount: number;
          p_payment_cycle: string;
          p_payment_terms_id: string | null;
          p_status: string;
          p_cancellation_reason: string | null;
          p_notes: string | null;
          p_attachment_url: string | null;
        };
        Returns: Json;
      };
      renew_contract_atomic: {
        Args: { old_contract_id: string; new_contract_data: Json };
        Returns: { status: 'renewed'; old_contract_id: string; new_contract_id: string };
      };
      record_invoice_payment_atomic: {
        Args: { payload: Json };
        Returns: { status: 'recorded'; request_id: string; invoice_id: string; payment_id: string; receipt_id: string; receipt_no?: string; success?: boolean; idempotent?: boolean };
      };
      post_receipt_atomic: {
        Args: { payload: Json };
        Returns: Json;
      };
      generate_invoices_from_active_contracts: { Args: Record<string, never>; Returns: number };
      rpt_financial_summary: { Args: { p_from: string; p_to: string }; Returns: { collected: number; expenses: number; net: number; revenue: number; net_income: number; overdue_amount: number; overdue_count: number; active_contracts: number; total_units: number; occupied_units: number; occupancy_rate: number; pending_invoices: number; period_from: string; period_to: string } };
      rpt_cash_flow: { Args: { p_from_date: string; p_to_date: string }; Returns: Json };
      rpt_vat_return: { Args: { p_from_date: string; p_to_date: string }; Returns: Json };
      void_receipt_atomic: {
        Args: { payload: Json };
        Returns: { success: boolean; voided_at: string };
      };
      resolve_maintenance_with_expense: {
        Args: { p_request_id: string; p_cost: number; p_notes?: string | null };
        Returns: { maintenance: Json; expense_id: string | null };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
