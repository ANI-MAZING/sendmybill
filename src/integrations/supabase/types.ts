export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type ProjectRow = {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  description: string | null;
  billing_model: string;
  status: string;
  start_date: string;
  end_date: string | null;
  currency: string;
  budget: number;
  billing_rate: number;
  internal_notes: string | null;
  billing_snapshot: Json;
  created_at: string;
  updated_at: string;
};
type MilestoneRow = {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  value: number;
  status: string;
  billing_trigger: boolean;
  created_at: string;
  updated_at: string;
};
type ProjectTaskRow = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  is_deliverable: boolean;
  created_at: string;
  updated_at: string;
};
type TimeEntryRow = {
  id: string;
  user_id: string;
  project_id: string;
  invoice_id: string | null;
  entry_date: string;
  duration_minutes: number;
  member_name: string;
  billable: boolean;
  hourly_rate: number;
  notes: string | null;
  timer_started_at: string | null;
  created_at: string;
  updated_at: string;
};
type PaymentRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  payment_date: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  payer: string;
  notes: string | null;
  attachment_path: string | null;
  created_at: string;
  updated_at: string;
};
type PaymentAllocationRow = {
  id: string;
  user_id: string;
  payment_id: string;
  invoice_id: string;
  amount: number;
  created_at: string;
  updated_at: string;
};
type ExpenseCategoryRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};
type ExpenseRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  category_id: string | null;
  expense_date: string;
  amount: number;
  tax_amount: number;
  currency: string;
  vendor: string;
  notes: string | null;
  receipt_path: string | null;
  is_recurring: boolean;
  recurrence_note: string | null;
  created_at: string;
  updated_at: string;
};
type AttachmentRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  record_type: string;
  record_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};
type ProjectEventRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  event_type: string;
  title: string;
  details: Json;
  created_at: string;
};
type FinancialAuditRow = {
  id: string;
  user_id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_data: Json | null;
  new_data: Json | null;
  created_at: string;
};
type InvoicePresetRow = {
  id: string;
  user_id: string;
  name: string;
  items: Json;
  tax_rate: number;
  notes: string | null;
  payment_terms: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      clients: {
        Row: {
          client_address: string | null;
          client_email: string;
          client_name: string;
          created_at: string;
          id: string;
          notes: string | null;
          phone: string | null;
          tags: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          client_address?: string | null;
          client_email: string;
          client_name: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          tags?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_address?: string | null;
          client_email?: string;
          client_name?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          archived_at: string | null;
          client_address: string | null;
          client_email: string;
          client_id: string | null;
          client_name: string;
          created_at: string;
          currency: string;
          discount_amount: number;
          discount_type: string;
          discount_value: number;
          due_date: string;
          document_type: string;
          expiry_date: string | null;
          converted_from_id: string | null;
          project_id: string | null;
          proforma_status: string | null;
          id: string;
          invoice_number: string;
          issue_date: string;
          items: Json;
          late_fee_notes: string | null;
          notes: string | null;
          payment_terms: string | null;
          seller_snapshot: Json;
          source_invoice_id: string | null;
          status: string;
          subtotal: number;
          tax_amount: number;
          tax_rate: number;
          template_id: string;
          total: number;
          updated_at: string;
          user_id: string;
          footer_text: string | null;
        };
        Insert: {
          archived_at?: string | null;
          client_address?: string | null;
          client_email: string;
          client_id?: string | null;
          client_name: string;
          created_at?: string;
          currency?: string;
          discount_amount?: number;
          discount_type?: string;
          discount_value?: number;
          due_date: string;
          document_type?: string;
          expiry_date?: string | null;
          converted_from_id?: string | null;
          project_id?: string | null;
          proforma_status?: string | null;
          id?: string;
          invoice_number: string;
          issue_date: string;
          items?: Json;
          late_fee_notes?: string | null;
          notes?: string | null;
          payment_terms?: string | null;
          seller_snapshot?: Json;
          source_invoice_id?: string | null;
          status?: string;
          subtotal?: number;
          tax_amount?: number;
          tax_rate?: number;
          template_id?: string;
          total?: number;
          updated_at?: string;
          user_id: string;
          footer_text?: string | null;
        };
        Update: {
          archived_at?: string | null;
          client_address?: string | null;
          client_email?: string;
          client_id?: string | null;
          client_name?: string;
          created_at?: string;
          currency?: string;
          discount_amount?: number;
          discount_type?: string;
          discount_value?: number;
          due_date?: string;
          document_type?: string;
          expiry_date?: string | null;
          converted_from_id?: string | null;
          project_id?: string | null;
          proforma_status?: string | null;
          id?: string;
          invoice_number?: string;
          issue_date?: string;
          items?: Json;
          late_fee_notes?: string | null;
          notes?: string | null;
          payment_terms?: string | null;
          seller_snapshot?: Json;
          source_invoice_id?: string | null;
          status?: string;
          subtotal?: number;
          tax_amount?: number;
          tax_rate?: number;
          template_id?: string;
          total?: number;
          updated_at?: string;
          user_id?: string;
          footer_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_source_invoice_id_fkey";
            columns: ["source_invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: TableDefinition<
        ProjectRow,
        Partial<ProjectRow> & {
          user_id: string;
          client_id: string;
          name: string;
        }
      >;
      project_milestones: TableDefinition<
        MilestoneRow,
        Partial<MilestoneRow> & {
          user_id: string;
          project_id: string;
          name: string;
        }
      >;
      project_tasks: TableDefinition<
        ProjectTaskRow,
        Partial<ProjectTaskRow> & {
          user_id: string;
          project_id: string;
          title: string;
        }
      >;
      time_entries: TableDefinition<
        TimeEntryRow,
        Partial<TimeEntryRow> & {
          user_id: string;
          project_id: string;
          duration_minutes: number;
          member_name: string;
        }
      >;
      payments: TableDefinition<
        PaymentRow,
        Partial<PaymentRow> & { user_id: string; amount: number; payer: string }
      >;
      payment_allocations: TableDefinition<
        PaymentAllocationRow,
        Partial<PaymentAllocationRow> & {
          user_id: string;
          payment_id: string;
          invoice_id: string;
          amount: number;
        }
      >;
      expense_categories: TableDefinition<
        ExpenseCategoryRow,
        Partial<ExpenseCategoryRow> & { user_id: string; name: string }
      >;
      expenses: TableDefinition<
        ExpenseRow,
        Partial<ExpenseRow> & {
          user_id: string;
          amount: number;
          vendor: string;
        }
      >;
      attachments: TableDefinition<
        AttachmentRow,
        Partial<AttachmentRow> & {
          user_id: string;
          record_type: string;
          file_name: string;
          storage_path: string;
        }
      >;
      project_events: TableDefinition<
        ProjectEventRow,
        Partial<ProjectEventRow> & {
          user_id: string;
          event_type: string;
          title: string;
        }
      >;
      financial_audit_log: TableDefinition<
        FinancialAuditRow,
        Partial<FinancialAuditRow> & {
          user_id: string;
          table_name: string;
          record_id: string;
          action: string;
        }
      >;
      invoice_presets: TableDefinition<
        InvoicePresetRow,
        Partial<InvoicePresetRow> & {
          user_id: string;
          name: string;
          items: Json;
        }
      >;
      profiles: {
        Row: {
          bank_account_number: string | null;
          bank_name: string | null;
          bank_routing_number: string | null;
          bank_swift_code: string | null;
          billing_mode: string | null;
          company_address: string | null;
          company_email: string | null;
          company_logo_url: string | null;
          company_name: string | null;
          company_phone: string | null;
          country_code: string | null;
          created_at: string;
          default_currency: string;
          default_payment_terms: number;
          default_tax_rate: number;
          email: string;
          full_name: string | null;
          id: string;
          invoice_next_number: number;
          invoice_prefix: string;
          invoice_accent_color: string;
          invoice_font: string;
          onboarding_completed: boolean;
          proforma_next_number: number;
          proforma_prefix: string;
          signature_url: string | null;
          tax_id: string | null;
          updated_at: string;
        };
        Insert: {
          bank_account_number?: string | null;
          bank_name?: string | null;
          bank_routing_number?: string | null;
          bank_swift_code?: string | null;
          billing_mode?: string | null;
          company_address?: string | null;
          company_email?: string | null;
          company_logo_url?: string | null;
          company_name?: string | null;
          company_phone?: string | null;
          country_code?: string | null;
          created_at?: string;
          default_currency?: string;
          default_payment_terms?: number;
          default_tax_rate?: number;
          email: string;
          full_name?: string | null;
          id: string;
          invoice_next_number?: number;
          invoice_prefix?: string;
          invoice_accent_color?: string;
          invoice_font?: string;
          onboarding_completed?: boolean;
          proforma_next_number?: number;
          proforma_prefix?: string;
          signature_url?: string | null;
          tax_id?: string | null;
          updated_at?: string;
        };
        Update: {
          bank_account_number?: string | null;
          bank_name?: string | null;
          bank_routing_number?: string | null;
          bank_swift_code?: string | null;
          billing_mode?: string | null;
          company_address?: string | null;
          company_email?: string | null;
          company_logo_url?: string | null;
          company_name?: string | null;
          company_phone?: string | null;
          country_code?: string | null;
          created_at?: string;
          default_currency?: string;
          default_payment_terms?: number;
          default_tax_rate?: number;
          email?: string;
          full_name?: string | null;
          id?: string;
          invoice_next_number?: number;
          invoice_prefix?: string;
          invoice_accent_color?: string;
          invoice_font?: string;
          onboarding_completed?: boolean;
          proforma_next_number?: number;
          proforma_prefix?: string;
          signature_url?: string | null;
          tax_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      convert_proforma: {
        Args: { p_proforma_id: string };
        Returns: string;
      };
      duplicate_invoice: {
        Args: { p_source_invoice_id: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
